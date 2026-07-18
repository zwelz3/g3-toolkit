// WS-D D3a elk-pins: oracles below that carry engineKind: "elk"
// pin ELK-PIPELINE mechanics (injected-engine counting, elk cache
// keys, LAY-018 collapse holds). They are removed with the elk
// pipeline at D3b; g3t-generic cache oracles live in
// structural-engine-cache.test.ts. LAY-018 position-hold under the
// g3t engine lands with the collapse reintroduction (recorded in
// the WS-D design doc).
/**
 * Structural geometry tests (Group A, round 31): the validated ELK
 * compartment recipe, asserted end to end through elkjs.
 *
 * @see specs/01-functional-views.md R1.18 (capped in-progress:
 *      geometry only; canvas application is the next slice)
 */
import { describe, it, expect, vi } from "vitest";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  buildStructuralElkGraph,
  layoutStructural,
  estimateTextSize,
  isChainEdgeId,
  type StructuralGraphInput,
  type ElkEngine,
} from "./structural";

/** The «Block»/part fixture from containers slice 1, upgraded to compartments. */
function blockFixture(): StructuralGraphInput {
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
              { id: "sensor.acc", text: "accuracy : xsd:double [0..1]" },
            ],
          },
          {
            id: "operations",
            title: "operations",
            rows: [{ id: "sensor.run", text: "calibrate() : void" }],
          },
        ],
        ports: [{ id: "sensor.out", side: "EAST" }],
      },
      {
        id: "lens",
        header: { stereotype: "Block", name: "Lens" },
        compartments: [
          {
            id: "attributes",
            rows: [
              { id: "lens.focal", text: "focalLength : xsd:double [1..1]" },
            ],
          },
        ],
        ports: [{ id: "lens.in", side: "WEST" }],
      },
      { id: "note", width: 100, height: 40 },
    ],
    edges: [
      {
        id: "feeds",
        source: "sensor",
        target: "lens",
        sourcePort: "sensor.out",
        targetPort: "lens.in",
      },
      { id: "annotates", source: "note", target: "sensor" },
    ],
  };
}

describe("buildStructuralElkGraph", () => {
  it("gives every row of a container the same explicit width (max measured + padding)", () => {
    const { graph } = buildStructuralElkGraph(blockFixture());
    const sensor = graph.children!.find((c) => c.id === "sensor")!;
    const widths = new Set(sensor.children!.map((c) => c.width));
    expect(widths.size).toBe(1);
    const widest = Math.max(
      ...[
        "calibrationDate : xsd:date [1..1]",
        "accuracy : xsd:double [0..1]",
      ].map((t) => estimateTextSize(t, "row").width),
    );
    expect([...widths][0]!).toBeGreaterThanOrEqual(widest);
  });

  it("chains rows with synthetic edges in declared order, titles included", () => {
    const { graph } = buildStructuralElkGraph(blockFixture());
    const sensor = graph.children!.find((c) => c.id === "sensor")!;
    // 2 titles + 3 rows = 5 planned rows -> 4 chain edges
    expect(sensor.children!.length).toBe(5);
    expect(sensor.edges!.length).toBe(4);
    for (const e of sensor.edges!) expect(isChainEdgeId(e.id)).toBe(true);
  });

  it("does NOT set INCLUDE_CHILDREN on the root (containers own their sub-layout)", () => {
    const { graph } = buildStructuralElkGraph(blockFixture());
    expect(graph.layoutOptions!["elk.hierarchyHandling"]).toBeUndefined();
  });

  it("reserves the header strip as container top padding", () => {
    const { graph, headerHeight } = buildStructuralElkGraph(blockFixture());
    const sensor = graph.children!.find((c) => c.id === "sensor")!;
    expect(sensor.layoutOptions!["elk.padding"]).toContain(
      `top=${headerHeight}`,
    );
  });

  it("routes port-attached edges to the port ids", () => {
    const { graph } = buildStructuralElkGraph(blockFixture());
    const feeds = graph.edges!.find((e) => e.id === "feeds")!;
    expect(feeds.sources).toEqual(["sensor.out"]);
    expect(feeds.targets).toEqual(["lens.in"]);
  });
});

describe("layoutStructural", () => {
  it("stacks rows zero-gap in declared order at uniform width inside the container", async () => {
    const geom = await layoutStructural(blockFixture());
    const rows = Object.entries(geom.nodes)
      .filter(([, g]) => g.kind === "row" && g.parent === "sensor")
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => a.y - b.y);
    expect(rows.map((r) => r.id)).toEqual([
      "sensor::attributes::title",
      "sensor.cal",
      "sensor.acc",
      "sensor::operations::title",
      "sensor.run",
    ]);
    const xs = new Set(rows.map((r) => r.x));
    const widths = new Set(rows.map((r) => r.width));
    expect(xs.size).toBe(1);
    expect(widths.size).toBe(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.y).toBeCloseTo(rows[i - 1]!.y + rows[i - 1]!.height, 5);
    }
  });

  it("sizes the container to exactly header strip + row heights and the shared width", async () => {
    const geom = await layoutStructural(blockFixture());
    const container = geom.nodes["sensor"]!;
    const rows = Object.values(geom.nodes).filter(
      (g) => g.kind === "row" && g.parent === "sensor",
    );
    const rowsHeight = rows.reduce((s, r) => s + r.height, 0);
    expect(container.height).toBeCloseTo(geom.headerHeight + rowsHeight, 5);
    expect(container.width).toBeCloseTo(rows[0]!.width, 5);
  });

  it("places fixed-side ports on the declared boundary", async () => {
    const geom = await layoutStructural(blockFixture());
    const sensor = geom.nodes["sensor"]!;
    const out = geom.ports["sensor.out"]!;
    expect(out.node).toBe("sensor");
    expect(out.side).toBe("EAST");
    // East port sits on the right boundary: ELK places fixed-side
    // ports straddling the border, so the port box must intersect
    // the boundary line (within one port-width of it).
    const rightEdge = sensor.x + sensor.width;
    expect(Math.abs(out.x + out.width / 2 - rightEdge)).toBeLessThanOrEqual(
      out.width,
    );
    const lens = geom.nodes["lens"]!;
    const inn = geom.ports["lens.in"]!;
    expect(Math.abs(inn.x + inn.width / 2 - lens.x)).toBeLessThanOrEqual(
      inn.width,
    );
  });

  it("keeps row coordinates absolute (row x/y offset by the container origin)", async () => {
    const geom = await layoutStructural(blockFixture());
    const container = geom.nodes["sensor"]!;
    const firstRow = geom.nodes["sensor::attributes::title"]!;
    expect(firstRow.x).toBeCloseTo(container.x, 5);
    expect(firstRow.y).toBeCloseTo(container.y + geom.headerHeight, 5);
  });

  it("carries renderer passthroughs: header text, row text, compartment, divider", async () => {
    const geom = await layoutStructural(blockFixture());
    expect(geom.nodes["sensor"]!.text).toBe("\u00ABBlock\u00BB Sensor");
    expect(geom.nodes["sensor.cal"]!.text).toBe(
      "calibrationDate : xsd:date [1..1]",
    );
    expect(geom.nodes["sensor.cal"]!.compartment).toBe("attributes");
    expect(geom.nodes["sensor::operations::title"]!.divider).toBe(true);
    expect(geom.nodes["sensor.cal"]!.divider).toBeUndefined();
  });

  it("lays plain nodes and containers out together in the top-level direction", async () => {
    const geom = await layoutStructural(blockFixture(), {
      direction: "RIGHT",
    });
    expect(geom.nodes["note"]!.kind).toBe("node");
    // sensor -> lens via ports: lens strictly right of sensor.
    const sensor = geom.nodes["sensor"]!;
    const lens = geom.nodes["lens"]!;
    expect(lens.x).toBeGreaterThan(sensor.x + sensor.width - 1);
  });

  it("produces a version-1 document", async () => {
    const geom = await layoutStructural(blockFixture());
    expect(geom.version).toBe(1);
  });
});

// The "compartment collapse" describe block lived here; the feature
// was removed by ruling (2026-07-10). See
// planning/expand-collapse-postmortem.md.

describe("layoutStructural engine injection + de-dup", () => {
  // A spy engine that delegates to a real synchronous elkjs, so we can
  // both assert injection is honored and count how many ELK runs happen.
  function spyEngine(): {
    engine: ElkEngine;
    layout: ReturnType<typeof vi.fn>;
  } {
    const elk = new ELK();
    const layout = vi.fn((g: Parameters<ElkEngine["layout"]>[0]) =>
      elk.layout(g),
    );
    return { engine: { layout } as ElkEngine, layout };
  }

  it("lays out through an injected engine instead of the default", async () => {
    const { engine, layout } = spyEngine();
    const geom = await layoutStructural(blockFixture(), {
      engine,
      engineKind: "elk",
    });
    expect(layout).toHaveBeenCalledTimes(1);
    expect(Object.keys(geom.nodes).length).toBeGreaterThan(0);
  });

  it("de-dupes concurrent layouts of the same input to one ELK run", async () => {
    const { engine, layout } = spyEngine();
    const input = blockFixture();
    const [a, b] = await Promise.all([
      layoutStructural(input, { engineKind: "elk", engine }),
      layoutStructural(input, { engineKind: "elk", engine }),
    ]);
    expect(layout).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("de-dupes a sequential re-layout of the same input (cached result)", async () => {
    const { engine, layout } = spyEngine();
    const input = blockFixture();
    const first = await layoutStructural(input, { engineKind: "elk", engine });
    const second = await layoutStructural(input, { engineKind: "elk", engine });
    expect(layout).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("does NOT cache when a custom measure is supplied", async () => {
    const { engine, layout } = spyEngine();
    const input = blockFixture();
    await layoutStructural(input, {
      engineKind: "elk",
      engine,
      measure: estimateTextSize,
    });
    await layoutStructural(input, {
      engineKind: "elk",
      engine,
      measure: estimateTextSize,
    });
    expect(layout).toHaveBeenCalledTimes(2);
  });

  it("keys the cache by layout options (different direction = separate run)", async () => {
    const { engine, layout } = spyEngine();
    const input = blockFixture();
    await layoutStructural(input, {
      engineKind: "elk",
      engine,
      direction: "DOWN",
    });
    await layoutStructural(input, {
      engineKind: "elk",
      engine,
      direction: "RIGHT",
    });
    expect(layout).toHaveBeenCalledTimes(2);
  });
});

describe("layout readability knobs", () => {
  const rightExtent = (g: {
    nodes: Record<string, { x: number; width: number }>;
  }) => Math.max(...Object.values(g.nodes).map((n) => n.x + n.width));

  it("layerSpacing widens the layout and bypasses the cache", async () => {
    const input = blockFixture();
    const tight = await layoutStructural(input, { layerSpacing: 20 });
    const loose = await layoutStructural(input, { layerSpacing: 220 });
    // A larger inter-layer gap must widen the RIGHT-direction extent; if the
    // cache key ignored layerSpacing, loose would return tight's geometry.
    expect(rightExtent(loose)).toBeGreaterThan(rightExtent(tight) + 100);
  });
});

describe("edge-edge spacing control", () => {
  // Whether ELK's router actually separates a given pair of parallel edges
  // is structure- and version-dependent, so we assert the control wiring
  // deterministically: the configured gap reaches ELK's edge-edge spacing
  // options. (The geometric spread is verified on the real thread layout.)
  function spy() {
    const elk = new ELK();
    const layout = vi.fn((g: Parameters<ElkEngine["layout"]>[0]) =>
      elk.layout(g),
    );
    return { engine: { layout } as ElkEngine, layout };
  }
  const fixture = (id: string): StructuralGraphInput => ({
    nodes: [
      { id: `${id}-a`, width: 60, height: 40 },
      { id: `${id}-b`, width: 60, height: 40 },
    ],
    edges: [{ id: `${id}-e`, source: `${id}-a`, target: `${id}-b` }],
  });

  it("defaults parallel edge-edge spacing to a sane 24", async () => {
    const { engine, layout } = spy();
    await layoutStructural(fixture("def"), { engine, engineKind: "elk" });
    const opts = layout.mock.calls[0]![0].layoutOptions!;
    expect(opts["elk.spacing.edgeEdge"]).toBe("24");
    expect(opts["elk.layered.spacing.edgeEdgeBetweenLayers"]).toBe("24");
  });

  it("forwards a custom edgeEdgeSpacing to ELK's edge-edge spacing options", async () => {
    const { engine, layout } = spy();
    await layoutStructural(fixture("custom"), {
      engine,
      engineKind: "elk",
      edgeEdgeSpacing: 40,
    });
    const opts = layout.mock.calls[0]![0].layoutOptions!;
    expect(opts["elk.spacing.edgeEdge"]).toBe("40");
    expect(opts["elk.layered.spacing.edgeEdgeBetweenLayers"]).toBe("40");
  });

  it("keys the cache on edgeEdgeSpacing so the default does not alias an explicit 12", async () => {
    const { engine, layout } = spy();
    const input = fixture("cache");
    // Default (24) then an explicit 12 on the SAME input: the cache key must
    // reflect the resolved default, so these are two distinct ELK runs. If
    // the key normalized to the old 12, the second call would alias the
    // first's 24-spaced geometry.
    await layoutStructural(input, { engineKind: "elk", engine });
    await layoutStructural(input, {
      engineKind: "elk",
      engine,
      edgeEdgeSpacing: 12,
    });
    expect(layout).toHaveBeenCalledTimes(2);
  });
});

describe("edge routing (ELK sections)", () => {
  const near = (a: number, b: number, tol = 12) => Math.abs(a - b) <= tol;
  const portCenter = (p: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => ({
    x: p.x + p.width / 2,
    y: p.y + p.height / 2,
  });

  it("carries a routed polyline (start, bends, end) per non-chain edge by default", async () => {
    const geom = await layoutStructural(blockFixture());
    expect(geom.edges).toBeDefined();
    // Both author edges are routed; the declared-port flow edge and the
    // synth-port body edge alike.
    expect(Object.keys(geom.edges!).sort()).toEqual(["annotates", "feeds"]);
    for (const route of Object.values(geom.edges!)) {
      // start + end at minimum; a real orthogonal route adds bends.
      expect(route.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("reports route points in the same absolute frame as the ports", async () => {
    const geom = await layoutStructural(blockFixture());
    const route = geom.edges!.feeds!.points;
    expect(route.length).toBeGreaterThanOrEqual(2);
    const start = route[0]!;
    const end = route[route.length - 1]!;
    // feeds runs sensor.out -> lens.in; the route ends must sit on those
    // ports (within port size), or a `segments` renderer would skew.
    const out = portCenter(geom.ports["sensor.out"]!);
    const inn = portCenter(geom.ports["lens.in"]!);
    expect(near(start.x, out.x) && near(start.y, out.y)).toBe(true);
    expect(near(end.x, inn.x) && near(end.y, inn.y)).toBe(true);
  });

  it("never routes the synthetic row-ordering chain edges", async () => {
    const geom = await layoutStructural(blockFixture());
    for (const id of Object.keys(geom.edges!)) {
      expect(isChainEdgeId(id)).toBe(false);
    }
  });

  it("omits the routes (renderer falls back) when routeEdges is false", async () => {
    const geom = await layoutStructural(blockFixture(), { routeEdges: false });
    expect(geom.edges).toBeUndefined();
  });

  it("keys the cache on routeEdges so the two shapes do not alias", async () => {
    const input = blockFixture();
    const routed = await layoutStructural(input, { routeEdges: true });
    const bare = await layoutStructural(input, { routeEdges: false });
    expect(routed.edges).toBeDefined();
    expect(bare.edges).toBeUndefined();
  });
});
