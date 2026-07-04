/**
 * Structural scene -> Cytoscape conversion (slice A2). Runs the REAL
 * core layout (elkjs works headless) and asserts the element
 * semantics: parents without positions, header/divider furniture,
 * selectable drag-locked rows, decoration ports, port-attached
 * edges, and center-based preset positions.
 *
 * @see specs/01-functional-views.md R1.18
 */
import { describe, it, expect, vi } from "vitest";
import {
  layoutStructural,
  edgePortId,
  type StructuralGraphInput,
} from "@g3t/core";
import {
  structuralToCytoscapeElements,
  routeToSegments,
  segmentsToPoints,
  rescaleBends,
  migratedSide,
  sidePoint,
  routeBetweenSides,
  taxiDirectionClass,
  STRUCTURAL_RULES,
  structuralThemeRules,
  wireStructuralCompartmentToggle,
} from "./structural-to-cytoscape";

function fixture(): StructuralGraphInput {
  return {
    nodes: [
      {
        id: "sensor",
        header: { stereotype: "Block", name: "Sensor" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [
              { id: "sensor.cal", text: "calibrationDate : xsd:date [1..1]" },
            ],
          },
        ],
        ports: [{ id: "sensor.out", side: "EAST" }],
      },
      { id: "note", width: 100, height: 40 },
    ],
    edges: [
      {
        id: "feeds",
        source: "sensor",
        target: "note",
        sourcePort: "sensor.out",
      },
    ],
  };
}

async function convert() {
  const input = fixture();
  const geometry = await layoutStructural(input);
  return {
    input,
    geometry,
    elements: structuralToCytoscapeElements(input, geometry),
  };
}

describe("obstacle-aware edge routing", () => {
  // Reconstruct each interior bend from its (weight, distance) using the
  // same orthonormal basis the projection used; an exact round-trip is
  // the headlessly-verifiable contract (the rendered side and quality
  // are not, and are confirmed in the browser).
  const reconstruct = (
    pts: { x: number; y: number }[],
    s: { x: number; y: number },
    t: { x: number; y: number },
  ) => {
    const seg = routeToSegments(pts, s, t)!;
    const ax = t.x - s.x;
    const ay = t.y - s.y;
    const len = Math.hypot(ax, ay);
    const ux = ax / len;
    const uy = ay / len;
    const nx = -uy;
    const ny = ux;
    return seg.weights.map((w, i) => {
      const d = seg.distances[i]!;
      return {
        x: s.x + w * len * ux + d * nx,
        y: s.y + w * len * uy + d * ny,
      };
    });
  };

  it("reconstructs interior bends exactly on an axis-aligned route", () => {
    const s = { x: 30, y: 20 };
    const t = { x: 230, y: 20 };
    const got = reconstruct(
      [s, { x: 30, y: -30 }, { x: 230, y: -30 }, t],
      s,
      t,
    );
    expect(got[0]!.x).toBeCloseTo(30, 9);
    expect(got[0]!.y).toBeCloseTo(-30, 9);
    expect(got[1]!.x).toBeCloseTo(230, 9);
    expect(got[1]!.y).toBeCloseTo(-30, 9);
  });

  it("reconstructs interior bends exactly on a diagonal axis", () => {
    // A non-axis-aligned source->target exercises the real projection
    // (both dot products non-trivial), where an off-by-rotation bug hides.
    const s = { x: 0, y: 0 };
    const t = { x: 100, y: 100 };
    const got = reconstruct([s, { x: 20, y: 80 }, { x: 70, y: 10 }, t], s, t);
    expect(got[0]!.x).toBeCloseTo(20, 9);
    expect(got[0]!.y).toBeCloseTo(80, 9);
    expect(got[1]!.x).toBeCloseTo(70, 9);
    expect(got[1]!.y).toBeCloseTo(10, 9);
  });

  it("emits exactly one control value per interior bend", () => {
    const seg = routeToSegments(
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: -5 },
        { x: 30, y: 0 },
        { x: 40, y: 0 },
      ],
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    expect(seg.weights).toHaveLength(3);
    expect(seg.distances).toHaveLength(3);
  });

  it("preserves orthogonality: reconstructed segments stay axis-aligned", () => {
    // An L-shaped, axis-aligned route with one right-angle bend.
    const source = { x: 0, y: 0 };
    const target = { x: 200, y: 100 };
    const seg = routeToSegments(
      [source, { x: 200, y: 0 }, target],
      source,
      target,
    )!;
    // Reconstruct the interior bends in absolute coordinates from the
    // distance/weight control values, then walk source -> bends -> target.
    const len = Math.hypot(target.x - source.x, target.y - source.y);
    const ux = (target.x - source.x) / len;
    const uy = (target.y - source.y) / len;
    const nx = -uy;
    const ny = ux;
    const bends = seg.weights.map((w, i) => ({
      x: source.x + w * len * ux + seg.distances[i]! * nx,
      y: source.y + w * len * uy + seg.distances[i]! * ny,
    }));
    const path = [source, ...bends, target];
    for (let i = 1; i < path.length; i++) {
      const horizontal = Math.abs(path[i]!.y - path[i - 1]!.y) < 1e-6;
      const vertical = Math.abs(path[i]!.x - path[i - 1]!.x) < 1e-6;
      expect(horizontal || vertical).toBe(true);
    }
  });

  it("returns null for a straight 2-point route (nothing to route)", () => {
    expect(
      routeToSegments(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ),
    ).toBeNull();
  });

  it("returns null for a degenerate zero-length axis", () => {
    expect(
      routeToSegments(
        [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
          { x: 10, y: 10 },
        ],
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ),
    ).toBeNull();
  });

  it("defines the routed rule after the base edge rule so segments wins", () => {
    const base = STRUCTURAL_RULES.findIndex(
      (r) => r.selector === "edge.g3t-structural-edge",
    );
    const routed = STRUCTURAL_RULES.findIndex(
      (r) => r.selector === "edge.g3t-structural-edge-routed",
    );
    expect(base).toBeGreaterThanOrEqual(0);
    expect(routed).toBeGreaterThan(base); // last-wins overrides curve-style
    const rule = STRUCTURAL_RULES[routed]!;
    expect(rule.style["curve-style"]).toBe("segments");
    expect(rule.style["segment-distances"]).toBe("data(_segDist)");
    expect(rule.style["segment-weights"]).toBe("data(_segWeight)");
  });
});

describe("structuralToCytoscapeElements", () => {
  it("emits containers as positionless compound parents without labels", async () => {
    const { elements } = await convert();
    const container = elements.find((e) => e.data.id === "sensor")!;
    expect(container.classes).toContain("g3t-structural-container");
    expect(container.position).toBeUndefined();
    expect(container.data).not.toHaveProperty("_label");
  });

  it("synthesizes a non-selectable header child spanning the header strip", async () => {
    const { elements, geometry } = await convert();
    const header = elements.find((e) => e.data.id === "sensor::header")!;
    expect(header.data.parent).toBe("sensor");
    expect(header.selectable).toBe(false);
    expect(header.grabbable).toBe(false);
    expect(header.data._label).toBe("\u00ABBlock\u00BB Sensor");
    expect(header.data._h).toBe(geometry.headerHeight);
    // Centered in the strip at the container's top.
    const c = geometry.nodes["sensor"]!;
    expect(header.position!.x).toBeCloseTo(c.x + c.width / 2, 5);
    expect(header.position!.y).toBeCloseTo(c.y + geometry.headerHeight / 2, 5);
  });

  it("emits rows as selectable, drag-locked children with center positions", async () => {
    const { elements, geometry } = await convert();
    const row = elements.find((e) => e.data.id === "sensor.cal")!;
    expect(row.classes).toContain("g3t-structural-row");
    expect(row.classes).not.toContain("divider");
    expect(row.selectable).toBe(true);
    expect(row.grabbable).toBe(false);
    expect(row.data.parent).toBe("sensor");
    expect(row.data._compartment).toBe("attributes");
    const g = geometry.nodes["sensor.cal"]!;
    expect(row.position!.x).toBeCloseTo(g.x + g.width / 2, 5);
    expect(row.position!.y).toBeCloseTo(g.y + g.height / 2, 5);
  });

  it("marks compartment-title dividers as non-selectable furniture", async () => {
    const { elements } = await convert();
    const divider = elements.find(
      (e) => e.data.id === "sensor::attributes::title",
    )!;
    expect(divider.classes).toContain("g3t-structural-divider");
    expect(divider.selectable).toBe(false);
  });

  it("emits ports as non-selectable, non-grabbable top-level siblings", async () => {
    const { elements } = await convert();
    const port = elements.find((e) => e.data.id === "sensor.out")!;
    expect(port.classes).toBe("g3t-structural-port");
    // Sibling, NOT a child: no parent (a child cannot sit outside
    // its compound container).
    expect(port.data.parent).toBeUndefined();
    expect(port.data._portHost).toBe("sensor");
    expect(port.selectable).toBe(false);
    expect(port.grabbable).toBe(false);
    expect(port.data._side).toBe("EAST");
  });

  it("routes port-attached edges to the port element", async () => {
    const { elements } = await convert();
    const edge = elements.find((e) => e.data.id === "feeds")!;
    // The declared source port is unchanged; the body (target) end now
    // attaches to the synth port ELK distributed on the node side.
    expect(edge.data.source).toBe("sensor.out");
    expect(edge.data.target).toBe(edgePortId("feeds", "t"));
  });

  it("carries an edge label onto the element when supplied", () => {
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", width: 60, height: 40 },
        { id: "b", width: 60, height: 40 },
      ],
      edges: [{ id: "ref", source: "a", target: "b", label: "worksFor" }],
    };
    const geometry = {
      version: 1 as const,
      headerHeight: 22,
      ports: {},
      nodes: {
        a: { x: 0, y: 0, width: 60, height: 40, kind: "node" as const },
        b: { x: 200, y: 0, width: 60, height: 40, kind: "node" as const },
      },
    };
    const els = structuralToCytoscapeElements(input, geometry);
    const edge = els.find((e) => e.data.id === "ref")!;
    expect(edge.data._label).toBe("worksFor");
  });

  it("classes UML edge kinds and defaults to plain association (A3)", () => {
    const geometry = {
      version: 1 as const,
      headerHeight: 22,
      ports: {},
      nodes: {
        a: { x: 0, y: 0, width: 60, height: 40, kind: "node" as const },
        b: { x: 200, y: 0, width: 60, height: 40, kind: "node" as const },
      },
    };
    const mk = (kind?: StructuralGraphInput["edges"][number]["kind"]) => {
      const input: StructuralGraphInput = {
        nodes: [
          { id: "a", width: 60, height: 40 },
          { id: "b", width: 60, height: 40 },
        ],
        edges: [{ id: "e", source: "a", target: "b", kind }],
      };
      return structuralToCytoscapeElements(input, geometry).find(
        (e) => e.data.id === "e",
      )!;
    };
    // A plain association carries no kind class (and _kind defaults).
    const assoc = mk();
    expect(assoc.classes).toBe("g3t-structural-edge");
    expect(assoc.data._kind).toBe("association");
    // Each UML kind adds its class.
    expect(mk("composition").classes).toContain("g3t-uml-composition");
    expect(mk("aggregation").classes).toContain("g3t-uml-aggregation");
    expect(mk("generalization").classes).toContain("g3t-uml-generalization");
    expect(mk("dependency").classes).toContain("g3t-uml-dependency");
  });

  it("renders an obstacle-avoiding route via segments, dropping taxi", () => {
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", width: 60, height: 40 },
        { id: "b", width: 60, height: 40 },
      ],
      edges: [{ id: "e", source: "a", target: "b" }],
    };
    const geometry = {
      version: 1 as const,
      headerHeight: 22,
      ports: {},
      nodes: {
        a: { x: 0, y: 0, width: 60, height: 40, kind: "node" as const },
        b: { x: 200, y: 0, width: 60, height: 40, kind: "node" as const },
      },
      // Up-and-over detour: two interior bends above the a->b axis. The
      // route endpoints are ignored by the projection; only the interior
      // bends are projected, against the center-to-center clipped basis.
      edges: {
        e: {
          points: [
            { x: 60, y: 20 },
            { x: 60, y: -30 },
            { x: 200, y: -30 },
            { x: 200, y: 20 },
          ],
        },
      },
    };
    const edge = structuralToCytoscapeElements(input, geometry).find(
      (e) => e.data.id === "e",
    )!;
    // Routed class present; taxi direction classes absent.
    expect(edge.classes).toContain("g3t-structural-edge-routed");
    expect(edge.classes).not.toContain("taxi");
    expect(edge.classes).not.toContain("g3t-structural-edge-downward");
    // Basis clips along the center-to-center line to each node's inner
    // edge (a's right edge (60,20), b's left edge (200,20)); both bends
    // sit 50px above that horizontal axis (distance -50) at its ends
    // (weights 0 and 1).
    expect(edge.data._segWeight).toBe("0 1");
    expect(edge.data._segDist).toBe("-50 -50");
  });

  it("carries the source-side taxi-direction on a routed edge for a perpendicular release", () => {
    // A routed edge whose source attaches on the SOUTH face. While routed
    // (curve-style: segments) the direction is inert, but it must be present
    // so that releasing the route on drag re-attaches the edge perpendicular
    // (downward out of the south face) instead of flat against the node.
    const sEport = edgePortId("e", "s");
    const tEport = edgePortId("e", "t");
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", width: 60, height: 40 },
        { id: "b", width: 60, height: 40 },
      ],
      edges: [{ id: "e", source: "a", target: "b" }],
    };
    const geometry = {
      version: 1 as const,
      headerHeight: 22,
      ports: {
        [sEport]: {
          x: 30,
          y: 40,
          width: 1,
          height: 1,
          side: "SOUTH" as const,
          node: "a",
        },
        [tEport]: {
          x: 230,
          y: 0,
          width: 1,
          height: 1,
          side: "NORTH" as const,
          node: "b",
        },
      },
      nodes: {
        a: { x: 0, y: 0, width: 60, height: 40, kind: "node" as const },
        b: { x: 200, y: 0, width: 60, height: 40, kind: "node" as const },
      },
      edges: {
        e: {
          points: [
            { x: 30, y: 40 },
            { x: 30, y: 80 },
            { x: 230, y: 80 },
            { x: 230, y: 0 },
          ],
        },
      },
    };
    const edge = structuralToCytoscapeElements(input, geometry).find(
      (e) => e.data.id === "e",
    )!;
    expect(edge.classes).toContain("g3t-structural-edge-routed");
    // Dormant perpendicular-exit direction from the SOUTH source side.
    expect(edge.classes).toContain("g3t-structural-edge-downward");
  });

  it("keeps taxi for a declared-port edge even when a route exists", () => {
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", ports: [{ id: "a.p", side: "EAST" }] },
        { id: "b", ports: [{ id: "b.p", side: "WEST" }] },
      ],
      edges: [
        {
          id: "e",
          source: "a",
          target: "b",
          sourcePort: "a.p",
          targetPort: "b.p",
        },
      ],
    };
    const geometry = {
      version: 1 as const,
      headerHeight: 22,
      ports: {
        "a.p": {
          node: "a",
          side: "EAST" as const,
          x: 60,
          y: 14,
          width: 12,
          height: 12,
        },
        "b.p": {
          node: "b",
          side: "WEST" as const,
          x: 200,
          y: 14,
          width: 12,
          height: 12,
        },
      },
      nodes: {
        a: { x: 0, y: 0, width: 60, height: 40, kind: "container" as const },
        b: { x: 200, y: 0, width: 60, height: 40, kind: "container" as const },
      },
      edges: {
        e: {
          points: [
            { x: 72, y: 20 },
            { x: 90, y: -30 },
            { x: 190, y: -30 },
            { x: 200, y: 20 },
          ],
        },
      },
    };
    const edge = structuralToCytoscapeElements(input, geometry).find(
      (e) => e.data.id === "e",
    )!;
    // Declared-port edges keep the port's perpendicular taxi exit; the
    // obstacle route is intentionally not applied, so no segments data.
    expect(edge.classes).not.toContain("g3t-structural-edge-routed");
    expect(edge.data._segDist).toBeUndefined();
    expect(edge.data._segWeight).toBeUndefined();
    // It still attaches to the declared port.
    expect(edge.data.source).toBe("a.p");
  });

  it("keeps taxi for a straight 2-point route (no bend to route around)", () => {
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", width: 60, height: 40 },
        { id: "b", width: 60, height: 40 },
      ],
      edges: [{ id: "e", source: "a", target: "b" }],
    };
    const geometry = {
      version: 1 as const,
      headerHeight: 22,
      ports: {},
      nodes: {
        a: { x: 0, y: 0, width: 60, height: 40, kind: "node" as const },
        b: { x: 200, y: 0, width: 60, height: 40, kind: "node" as const },
      },
      edges: {
        e: {
          points: [
            { x: 30, y: 20 },
            { x: 230, y: 20 },
          ],
        },
      },
    };
    const edge = structuralToCytoscapeElements(input, geometry).find(
      (e) => e.data.id === "e",
    )!;
    expect(edge.classes).not.toContain("routed");
    expect(edge.data._segDist).toBeUndefined();
  });

  it("ships UML edge stylesheet rules with the canonical arrow ends (A3)", () => {
    const comp = STRUCTURAL_RULES.find(
      (r) => r.selector === "edge.g3t-uml-composition",
    )!;
    // Composition: filled diamond at the SOURCE (whole) end.
    expect(comp.style["source-arrow-shape"]).toBe("diamond");
    expect(comp.style["source-arrow-fill"]).toBe("filled");
    const gen = STRUCTURAL_RULES.find(
      (r) => r.selector === "edge.g3t-uml-generalization",
    )!;
    // Generalization: hollow triangle at the TARGET (parent) end.
    expect(gen.style["target-arrow-shape"]).toBe("triangle");
    expect(gen.style["target-arrow-fill"]).toBe("hollow");
    const dep = STRUCTURAL_RULES.find(
      (r) => r.selector === "edge.g3t-uml-dependency",
    )!;
    expect(dep.style["line-style"]).toBe("dashed");
  });

  it("tags each container's bottom row for corner rounding", async () => {
    const { elements } = await convert();
    // sensor.cal is the only non-title row, hence the bottom one.
    const last = elements.find((e) => e.data.id === "sensor.cal")!;
    expect(last.classes).toContain("g3t-structural-row-last");
    const title = elements.find(
      (e) => e.data.id === "sensor::attributes::title",
    )!;
    expect(title.classes).not.toContain("g3t-structural-row-last");
  });

  it("positions ports flush outside the container, offset clear of the border", async () => {
    const { elements, geometry } = await convert();
    const port = elements.find((e) => e.data.id === "sensor.out")!;
    const host = geometry.nodes["sensor"]!;
    const raw = geometry.ports["sensor.out"]!;
    // EAST: ELK puts the port box just outside (left edge at the
    // container's right edge); the converter then pushes it outward
    // by the border offset (round 42) so the strokes do not collide.
    // The port's INNER edge therefore sits strictly OUTSIDE the
    // container's right edge, not merely on it.
    const innerEdge = port.position!.x - raw.width / 2;
    expect(innerEdge).toBeGreaterThan(host.x + host.width);
  });

  it("labels plain nodes with their id when no header is given", async () => {
    const { elements } = await convert();
    const note = elements.find((e) => e.data.id === "note")!;
    expect(note.data._label).toBe("note");
  });

  it("never emits the synthetic chain edges", async () => {
    const { elements } = await convert();
    const edges = elements.filter((e) => e.group === "edges");
    expect(edges).toHaveLength(1);
  });

  it("ships class-scoped stylesheet rules (inert without structural elements)", () => {
    for (const rule of STRUCTURAL_RULES) {
      // Every rule is scoped to a class the structural converter emits
      // (g3t-structural-* for nodes/edges, g3t-uml-* for UML edge
      // kinds), so the set is inert on a non-structural scene.
      expect(rule.selector).toMatch(/g3t-(structural|uml)/);
    }
    // The container rule must neutralize the generic :parent styling.
    const container = STRUCTURAL_RULES.find(
      (r) => r.selector === "node.g3t-structural-container",
    )!;
    expect(container.style["padding"]).toBe(0);
    expect(container.style["label"]).toBe("");
  });

  it("z-lifts a selected structural row and carries no invalid offset", () => {
    // Round 43 attempted an INSET ring (negative outline-offset) so a
    // selected child would not grow the compound container's bbox into the
    // ports. Cytoscape rejects negative outline-offset, so it never
    // rendered and was removed; the row keeps only the z-lift (its full
    // ring shows over later-painted siblings). A true inset needs a
    // theme-driven border and is deferred.
    const rule = STRUCTURAL_RULES.find(
      (r) => r.selector === "node.g3t-structural-row.g3t-selected",
    )!;
    expect(rule.style["z-index"]).toBe(9999);
    expect(rule.style["outline-offset"]).toBeUndefined();
  });

  it("keeps colors OUT of the static rules so dark mode is honored", () => {
    // Regression guard (round 41): hardcoded colors in STRUCTURAL_RULES
    // rendered rows light even in dark mode. Structure-only rules carry
    // no fill/stroke/text color; those come from structuralThemeRules.
    for (const rule of STRUCTURAL_RULES) {
      expect(rule.style["background-color"]).toBeUndefined();
      expect(rule.style["border-color"]).toBeUndefined();
      expect(rule.style["color"]).toBeUndefined();
      expect(rule.style["line-color"]).toBeUndefined();
    }
  });

  it("resolves structural colors from the theme (light vs dark differ)", () => {
    const light = {
      bgSecondary: "#f8f9fa",
      bgTertiary: "#e9ecef",
      canvasBg: "#ffffff",
      border: "#dee2e6",
      textPrimary: "#212529",
      textSecondary: "#495057",
      error: "#dc2626",
      warning: "#d97706",
      accentPrimary: "#2563eb",
    };
    const dark = {
      bgSecondary: "#25262b",
      bgTertiary: "#2c2e33",
      canvasBg: "#1a1b1e",
      border: "#373a40",
      textPrimary: "#e9ecef",
      textSecondary: "#adb5bd",
      error: "#f87171",
      warning: "#fbbf24",
      accentPrimary: "#4c8bf5",
    };
    const rowRule = (rules: ReturnType<typeof structuralThemeRules>) =>
      rules.find((r) => r.selector === "node.g3t-structural-row")!;
    const lightRow = rowRule(structuralThemeRules(light));
    const darkRow = rowRule(structuralThemeRules(dark));
    // Rows take the canvas surface, which flips between themes.
    expect(lightRow.style["background-color"]).toBe("#ffffff");
    expect(darkRow.style["background-color"]).toBe("#1a1b1e");
    expect(darkRow.style["color"]).toBe("#e9ecef");
    // Severity borders track the theme's semantic tokens.
    const darkViolation = structuralThemeRules(dark).find(
      (r) => r.selector === "node.g3t-structural-sev-violation",
    )!;
    expect(darkViolation.style["border-color"]).toBe("#f87171");
  });

  it("applies closed/open border classes from decorations (SHACL B3)", async () => {
    // Two containers so both branches are exercised: when a closed
    // set is supplied, members read closed and non-members read open.
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "Closed",
          header: { stereotype: "NodeShape", name: "Closed" },
          compartments: [
            { id: "c", rows: [{ id: "Closed.p", text: "p [1..1]" }] },
          ],
        },
        {
          id: "Open",
          header: { stereotype: "NodeShape", name: "Open" },
          compartments: [
            { id: "c", rows: [{ id: "Open.q", text: "q [0..1]" }] },
          ],
        },
      ],
      edges: [],
    };
    const geometry = await layoutStructural(input);
    const els = structuralToCytoscapeElements(input, geometry, {
      closedContainers: new Set(["Closed"]),
    });
    const closed = els.find((e) => e.data.id === "Closed")!;
    const open = els.find((e) => e.data.id === "Open")!;
    expect(closed.classes).toContain("g3t-structural-closed");
    expect(open.classes).toContain("g3t-structural-open");
  });

  it("applies per-row severity classes and data from decorations (SHACL B3)", async () => {
    const input = fixture();
    const geometry = await layoutStructural(input);
    const els = structuralToCytoscapeElements(input, geometry, {
      rowSeverities: new Map([["sensor.cal", "violation"]]),
    });
    const row = els.find((e) => e.data.id === "sensor.cal")!;
    expect(row.classes).toContain("g3t-structural-sev-violation");
    expect(row.data._severity).toBe("violation");
    // The compartment-title divider row is unmarked.
    const title = els.find((e) => e.data.id === "sensor::attributes::title")!;
    expect(title.classes).not.toContain("g3t-structural-sev");
    expect(title.data._severity).toBeUndefined();
  });

  it("leaves containers and rows undecorated when no decorations passed", async () => {
    const input = fixture();
    const geometry = await layoutStructural(input);
    const els = structuralToCytoscapeElements(input, geometry);
    const sensor = els.find((e) => e.data.id === "sensor")!;
    expect(sensor.classes).toBe("g3t-structural-container");
  });
});

describe("wireStructuralPortDrag", () => {
  // Minimal cy stub: records handlers + selectors, lets the test fire
  // grab/drag and observe port repositioning and routed-edge re-anchoring.
  type EdgeStub = {
    id: () => string;
    data: ((k: string) => unknown) & ((patch: Record<string, string>) => void);
    hasClass: (c: string) => boolean;
    source: () => {
      id: () => string;
      data: (k: string) => unknown;
      position: (p?: { x: number; y: number }) => { x: number; y: number };
    };
    target: () => {
      id: () => string;
      data: (k: string) => unknown;
      position: (p?: { x: number; y: number }) => { x: number; y: number };
    };
  };
  function stubCy(edges: EdgeStub[] = []) {
    const handlers: Record<string, ((evt: unknown) => void) | undefined> = {};
    const selectors: Record<string, string | undefined> = {};
    const portPos = { x: 100, y: 50 };
    const portNode = {
      id: () => "__g3t_eport__e1__s",
      data: (k: string) => (k === "_portHost" ? "sensor" : undefined),
      position: (p?: { x: number; y: number }) => {
        if (p) {
          portPos.x = p.x;
          portPos.y = p.y;
        }
        return portPos;
      },
      connectedEdges: () => edges,
    };
    const cy = {
      on: (evt: string, sel: string, fn: (e: unknown) => void) => {
        handlers[evt] = fn;
        selectors[evt] = sel;
      },
      removeListener: (evt: string) => {
        handlers[evt] = undefined;
      },
      nodes: () => ({
        filter: (pred: (n: unknown) => boolean) =>
          [portNode].filter((n) => pred(n)) as unknown[],
      }),
    };
    return { cy, handlers, selectors, portPos };
  }

  it("offsets a host's ports by the box drag delta", async () => {
    const { wireStructuralPortDrag } =
      await import("./structural-to-cytoscape");
    const { cy, handlers, portPos } = stubCy();
    const dispose = wireStructuralPortDrag(cy as never);
    const boxPos = { x: 0, y: 0 };
    const target = {
      id: () => "sensor",
      position: () => boxPos,
      width: () => 20,
      height: () => 20,
    };
    handlers["grab"]!({ target });
    boxPos.x = 20;
    boxPos.y = 10;
    handlers["drag"]!({ target });
    expect(portPos).toEqual({ x: 120, y: 60 });
    dispose();
    expect(handlers["drag"]).toBeUndefined();
  });

  it("rescales a routed edge: bends slide, moved end stays axis-aligned", async () => {
    const { wireStructuralPortDrag } =
      await import("./structural-to-cytoscape");
    // An up-and-over route: source (0,0) -> (0,-50) -> (200,-50) -> target
    // (200,0). Both eports exit NORTH (top). The source eport belongs to the
    // dragged box.
    const dataWrites: Record<string, string>[] = [];
    const store: Record<string, string> = {
      _segDist: "-50 -50",
      _segWeight: "0 1",
    };
    const side = (k: string) => (k === "_side" ? "NORTH" : undefined);
    const routedEdge: EdgeStub = {
      id: () => "e1",
      data: ((k?: string | Record<string, string>) => {
        if (typeof k === "string") return store[k];
        if (k) {
          Object.assign(store, k);
          dataWrites.push(k);
        }
        return undefined;
      }) as EdgeStub["data"],
      hasClass: (c: string) => c === "g3t-structural-edge-routed",
      source: () => ({
        id: () => "__g3t_eport__e1__s",
        data: side,
        position: () => ({ x: 0, y: 0 }),
      }),
      target: () => ({
        id: () => "tgt",
        data: side,
        position: () => ({ x: 200, y: 0 }),
      }),
    };
    const { cy, handlers } = stubCy([routedEdge]);
    wireStructuralPortDrag(cy as never);
    const boxPos = { x: 0, y: 0 };
    const target = {
      id: () => "sensor",
      position: () => boxPos,
      width: () => 20,
      height: () => 20,
    };
    handlers["grab"]!({ target });
    // Drag the source box right by 30 and down by 12 (small move: the face
    // stays NORTH, the ELK bends rescale rather than re-route).
    boxPos.x = 30;
    boxPos.y = 12;
    handlers["drag"]!({ target });
    // The recompute writes data (the routed rule maps the render from data),
    // so a subsequent grab reconstructs from values matching the moved end.
    expect(dataWrites.length).toBeGreaterThan(0);
    const last = dataWrites[dataWrites.length - 1]!;
    const distances = last["_segDist"]!.split(" ").map(Number);
    const weights = last["_segWeight"]!.split(" ").map(Number);
    const newSource = { x: 30, y: 12 };
    const newTarget = { x: 200, y: 0 };
    const bends = segmentsToPoints(distances, weights, newSource, newTarget);
    // Bends slide with the box (not pinned at the old x): the first tracks
    // the moved source x, the over bend the target x.
    expect(bends[0]!.x).toBeCloseTo(30, 5);
    expect(bends[1]!.x).toBeCloseTo(200, 5);
    // Reconstructed route is orthogonal (every segment axis-aligned).
    const path = [newSource, ...bends, newTarget];
    for (let i = 1; i < path.length; i++) {
      const horizontal = Math.abs(path[i]!.y - path[i - 1]!.y) < 1e-6;
      const vertical = Math.abs(path[i]!.x - path[i - 1]!.x) < 1e-6;
      expect(horizontal || vertical).toBe(true);
    }
  });

  it("binds plain (compartment-less) nodes as well as containers", async () => {
    const { wireStructuralPortDrag } =
      await import("./structural-to-cytoscape");
    const { cy, selectors } = stubCy();
    wireStructuralPortDrag(cy as never);
    expect(selectors["grab"]).toContain("g3t-structural-node");
    expect(selectors["grab"]).toContain("g3t-structural-container");
    expect(selectors["drag"]).toContain("g3t-structural-node");
  });

  it("ignores drag of a box with no recorded grab without error", async () => {
    const { wireStructuralPortDrag } =
      await import("./structural-to-cytoscape");
    const { cy, handlers } = stubCy();
    wireStructuralPortDrag(cy as never);
    const target = { id: () => "other", position: () => ({ x: 5, y: 5 }) };
    expect(() => handlers["drag"]!({ target })).not.toThrow();
  });

  it("stops tracking after free", async () => {
    const { wireStructuralPortDrag } =
      await import("./structural-to-cytoscape");
    const { cy, handlers, portPos } = stubCy();
    wireStructuralPortDrag(cy as never);
    const boxPos = { x: 0, y: 0 };
    const target = {
      id: () => "sensor",
      position: () => boxPos,
      width: () => 20,
      height: () => 20,
    };
    handlers["grab"]!({ target });
    handlers["free"]!({ target });
    const before = { ...portPos };
    boxPos.x = 99;
    handlers["drag"]!({ target });
    expect(portPos).toEqual(before);
  });
});

describe("routed-edge geometry helpers", () => {
  it("segmentsToPoints inverts routeToSegments (round-trip)", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 200, y: 0 };
    const original = [
      { x: 0, y: -50 },
      { x: 200, y: -50 },
    ];
    const seg = routeToSegments([source, ...original, target], source, target)!;
    const back = segmentsToPoints(seg.distances, seg.weights, source, target);
    back.forEach((p, i) => {
      expect(p.x).toBeCloseTo(original[i]!.x, 6);
      expect(p.y).toBeCloseTo(original[i]!.y, 6);
    });
  });

  const isOrtho = (path: { x: number; y: number }[]): boolean => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const horizontal = Math.abs(b.y - a.y) < 1e-6;
      const vertical = Math.abs(b.x - a.x) < 1e-6;
      if (!(horizontal || vertical)) return false;
    }
    return true;
  };

  it("rescaleBends slides interior bends proportionally with the box", () => {
    // Z route (0,0)->(50,0)->(50,100)->(100,100); the vertical channel sits
    // at the horizontal midpoint (fraction 0.5).
    const bends = [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    const out = rescaleBends(
      bends,
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 0 },
      { x: 200, y: 100 }, // target slid right: width 100 -> 200
    );
    // Channel stays at fraction 0.5 -> x = 100 (not pinned at 50).
    expect(out[0]).toEqual({ x: 100, y: 0 });
    expect(out[1]).toEqual({ x: 100, y: 100 });
    expect(isOrtho([{ x: 0, y: 0 }, ...out, { x: 200, y: 100 }])).toBe(true);
  });

  it("rescaleBends keeps endpoint-tied bends perpendicular when the source moves", () => {
    const bends = [
      { x: 50, y: 0 }, // shares y with source (tied, v=0)
      { x: 50, y: 100 }, // shares y with target (tied, v=1)
    ];
    const out = rescaleBends(
      bends,
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 20 }, // source dropped 20px
      { x: 100, y: 100 },
    );
    // First bend rides the source's y, last bend the target's y: both
    // adjoining segments stay axis-aligned.
    expect(out[0]!.y).toBeCloseTo(20, 6);
    expect(out[1]!.y).toBeCloseTo(100, 6);
    expect(isOrtho([{ x: 0, y: 20 }, ...out, { x: 100, y: 100 }])).toBe(true);
  });

  it("rescaleBends falls back to a fixed offset on a degenerate axis", () => {
    // Source and target share x (zero-width box): the bend's x-offset cannot
    // be a fraction, so it is preserved as an absolute offset from source.
    const out = rescaleBends(
      [{ x: 30, y: 50 }],
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 10, y: 0 },
      { x: 10, y: 100 },
    );
    expect(out[0]).toEqual({ x: 40, y: 50 }); // 10 + 30 offset; y scaled 0.5
  });

  it("migratedSide flips to the opposite face once the endpoint crosses the node", () => {
    const c = { x: 0, y: 0 };
    const half = { w: 50, h: 50 };
    // Original NORTH: endpoint well below the bottom edge -> migrate to SOUTH.
    expect(migratedSide("NORTH", c, half, { x: 0, y: 200 })).toBe("SOUTH");
    // Endpoint still above the top edge -> stay NORTH.
    expect(migratedSide("NORTH", c, half, { x: 0, y: -200 })).toBe("NORTH");
    // Horizontal axis preserved similarly.
    expect(migratedSide("WEST", c, half, { x: 200, y: 0 })).toBe("EAST");
    expect(migratedSide("EAST", c, half, { x: -200, y: 0 })).toBe("WEST");
  });

  it("migratedSide preserves the original axis and keeps the face within the hysteresis band", () => {
    const c = { x: 0, y: 0 };
    const half = { w: 50, h: 50 };
    // Up-and-over route exits NORTH though its target is due east: a small
    // separation within the node's band must NOT flip it to EAST.
    expect(migratedSide("NORTH", c, half, { x: 300, y: 10 })).toBe("NORTH");
    // Endpoint within the vertical band (|dy| <= half.h) holds the face.
    expect(migratedSide("SOUTH", c, half, { x: 0, y: 40 })).toBe("SOUTH");
    expect(migratedSide("SOUTH", c, half, { x: 0, y: -40 })).toBe("SOUTH");
  });

  it("sidePoint returns the center of the requested face", () => {
    const c = { x: 10, y: 20 };
    const half = { w: 5, h: 8 };
    expect(sidePoint(c, half, "EAST")).toEqual({ x: 15, y: 20 });
    expect(sidePoint(c, half, "WEST")).toEqual({ x: 5, y: 20 });
    expect(sidePoint(c, half, "SOUTH")).toEqual({ x: 10, y: 28 });
    expect(sidePoint(c, half, "NORTH")).toEqual({ x: 10, y: 12 });
  });

  it("routeBetweenSides is orthogonal for every side pairing", () => {
    const sides = ["NORTH", "SOUTH", "EAST", "WEST"] as const;
    const s = { x: 0, y: 0 };
    const t = { x: 130, y: 90 };
    for (const ss of sides) {
      for (const ts of sides) {
        const bends = routeBetweenSides(s, ss, t, ts, 15);
        expect(isOrtho([s, ...bends, t])).toBe(true);
      }
    }
  });

  it("routeBetweenSides stubs perpendicular to each face", () => {
    // SOUTH source, NORTH target: first segment leaves downward, last enters
    // from above (both vertical), connected by a Z.
    const bends = routeBetweenSides(
      { x: 0, y: 0 },
      "SOUTH",
      { x: 100, y: 100 },
      "NORTH",
      10,
    );
    expect(bends[0]).toEqual({ x: 0, y: 10 }); // source stub straight down
    expect(bends[bends.length - 1]).toEqual({ x: 100, y: 90 }); // target stub above
    expect(isOrtho([{ x: 0, y: 0 }, ...bends, { x: 100, y: 100 }])).toBe(true);
  });
});

describe("taxiDirectionClass", () => {
  it("maps each ELK side to its perpendicular taxi exit class", () => {
    expect(taxiDirectionClass("SOUTH")).toBe("g3t-structural-edge-downward");
    expect(taxiDirectionClass("NORTH")).toBe("g3t-structural-edge-upward");
    expect(taxiDirectionClass("EAST")).toBe("g3t-structural-edge-rightward");
    expect(taxiDirectionClass("WEST")).toBe("g3t-structural-edge-leftward");
  });

  it("returns no class for an unknown side (edge falls back to taxi auto)", () => {
    expect(taxiDirectionClass(undefined)).toBe("");
    expect(taxiDirectionClass("DIAGONAL")).toBe("");
  });
});

describe("on-container compartment toggle", () => {
  it("emits a collapse toggle chip in the header for each compartmented container", async () => {
    const { elements, geometry } = await convert();
    const toggle = elements.find((e) => e.data.id === "sensor::toggle");
    expect(toggle).toBeDefined();
    expect(toggle!.data.parent).toBe("sensor");
    expect(String(toggle!.classes)).toContain("g3t-structural-toggle");
    expect(toggle!.data._toggleFor).toBe("sensor");
    expect(toggle!.data._compartmentIds).toEqual(["attributes"]);
    // Expanded by default (no collapsedContainers decoration): minus.
    expect(toggle!.data._glyph).toBe("\u2212");
    expect(toggle!.selectable).toBe(false);
    expect(toggle!.grabbable).toBe(false);
    // Sits in the header strip, toward its right edge.
    const c = geometry.nodes["sensor"]!;
    expect(toggle!.position!.y).toBeCloseTo(c.y + geometry.headerHeight / 2, 5);
    expect(toggle!.position!.x).toBeGreaterThan(c.x + c.width / 2);
    expect(toggle!.position!.x).toBeLessThanOrEqual(c.x + c.width);
  });

  it("omits the toggle for plain (compartment-less) nodes", async () => {
    const { elements } = await convert();
    expect(elements.find((e) => e.data.id === "note::toggle")).toBeUndefined();
  });

  it("renders the collapsed glyph and class when the container is collapsed", async () => {
    const input = fixture();
    const geometry = await layoutStructural(input);
    const els = structuralToCytoscapeElements(input, geometry, {
      collapsedContainers: new Set(["sensor"]),
    });
    const toggle = els.find((e) => e.data.id === "sensor::toggle");
    expect(toggle!.data._glyph).toBe("+"); // collapsed: plus
    expect(String(toggle!.classes)).toContain(
      "g3t-structural-toggle-collapsed",
    );
  });

  function stubTapCy() {
    const handlers: Record<string, ((e: unknown) => void) | undefined> = {};
    const cy = {
      on: (evt: string, _sel: string, fn: (e: unknown) => void) => {
        handlers[evt] = fn;
      },
      removeListener: (evt: string) => {
        handlers[evt] = undefined;
      },
    };
    return { cy, handlers };
  }

  it("forwards a chip tap to the host callback and stops propagation", () => {
    const { cy, handlers } = stubTapCy();
    const onToggle = vi.fn();
    const dispose = wireStructuralCompartmentToggle(cy as never, onToggle);

    const data: Record<string, unknown> = {
      _toggleFor: "sensor",
      _compartmentIds: ["attributes", "operations"],
    };
    const stopPropagation = vi.fn();
    handlers["tap"]!({
      target: { data: (k: string) => data[k] },
      stopPropagation,
    });

    expect(onToggle).toHaveBeenCalledWith("sensor", [
      "attributes",
      "operations",
    ]);
    expect(stopPropagation).toHaveBeenCalledTimes(1);

    dispose();
    expect(handlers["tap"]).toBeUndefined();
  });

  it("ignores a tap that lacks toggle data", () => {
    const { cy, handlers } = stubTapCy();
    const onToggle = vi.fn();
    wireStructuralCompartmentToggle(cy as never, onToggle);
    handlers["tap"]!({
      target: { data: () => undefined },
      stopPropagation: () => {},
    });
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("structuralToCytoscapeElements body-edge attachment ports", () => {
  it("attaches body edges to distinct synth ports and renders them invisibly", async () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "a",
          header: { name: "A" },
          compartments: [{ id: "c", rows: [{ id: "a.r", text: "row" }] }],
        },
        {
          id: "b",
          header: { name: "B" },
          compartments: [{ id: "c", rows: [{ id: "b.r", text: "row" }] }],
        },
        {
          id: "d",
          header: { name: "D" },
          compartments: [{ id: "c", rows: [{ id: "d.r", text: "row" }] }],
        },
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "a", target: "d" },
      ],
    };
    const geometry = await layoutStructural(input, { direction: "RIGHT" });
    const { structuralToCytoscapeElements } =
      await import("./structural-to-cytoscape");
    const els = structuralToCytoscapeElements(input, geometry);

    // Both body edges attach to their own source/target synth ports.
    const e1 = els.find((e) => e.data.id === "e1")!;
    const e2 = els.find((e) => e.data.id === "e2")!;
    expect(e1.data.source).toBe(edgePortId("e1", "s"));
    expect(e2.data.source).toBe(edgePortId("e2", "s"));
    // Distinct attachment points (the fan-out), not the shared node body.
    expect(e1.data.source).not.toBe(e2.data.source);
    expect(e1.data.source).not.toBe("a");

    // The synth ports exist as invisible nodes (so edges connect) but carry
    // the edge-port class, not the visible port class.
    const synthNode = els.find((n) => n.data.id === edgePortId("e1", "s"))!;
    expect(synthNode.classes).toBe("g3t-structural-edge-port");
  });
});
