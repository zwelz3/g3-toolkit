/**
 * Routing Lab scenario tests: the generators are deterministic and
 * well-formed, and the structural engine's routing survives every
 * adversarial scenario with its core promises intact. These are the
 * pinned invariants an engine regression would break first:
 * - every input edge gets a routed polyline (full coverage),
 * - every routed segment is axis-parallel (orthogonality),
 * - no route passes through a box it neither starts nor ends at.
 * Crossings and bends are NOT pinned to exact numbers (they may shift
 * with engine tuning); only their structural floors are asserted.
 */
import { describe, it, expect } from "vitest";
import { layoutStructural } from "@g3t/core";
import { ROUTING_SCENARIOS, type ScenarioSize } from "./scenarios";
import { gradeRoutes } from "./quality";

const SIZES: ScenarioSize[] = ["S", "M", "L"];

describe("routing scenarios: generator well-formedness", () => {
  for (const sc of ROUTING_SCENARIOS) {
    it(`${sc.id}: unique ids, resolvable endpoints, monotone sizes`, () => {
      let prevNodes = 0;
      for (const size of SIZES) {
        const input = sc.build(size);
        const nodeIds = new Set(input.nodes.map((n) => n.id));
        expect(nodeIds.size).toBe(input.nodes.length);
        const edgeIds = new Set(input.edges.map((e) => e.id));
        expect(edgeIds.size).toBe(input.edges.length);
        const portIds = new Set(
          input.nodes.flatMap((n) => (n.ports ?? []).map((p) => p.id)),
        );
        for (const e of input.edges) {
          expect(nodeIds.has(e.source), `${sc.id}: ${e.id} source`).toBe(true);
          expect(nodeIds.has(e.target), `${sc.id}: ${e.id} target`).toBe(true);
          if (e.sourcePort) expect(portIds.has(e.sourcePort)).toBe(true);
          if (e.targetPort) expect(portIds.has(e.targetPort)).toBe(true);
        }
        expect(input.nodes.length).toBeGreaterThanOrEqual(prevNodes);
        prevNodes = input.nodes.length;
      }
    });

    it(`${sc.id}: deterministic (same size builds identical graphs)`, () => {
      expect(sc.build("M")).toEqual(sc.build("M"));
    });
  }
});

describe("routing scenarios: engine survives the gauntlet", () => {
  for (const sc of ROUTING_SCENARIOS) {
    it(`${sc.id} (M): full coverage, orthogonal, no box violations`, async () => {
      const input = sc.build("M");
      const geometry = await layoutStructural(input, {
        direction: sc.direction,
      });

      // Every top-level node placed with a finite, positive box.
      for (const n of input.nodes) {
        const g = geometry.nodes[n.id];
        expect(g, `${sc.id}: ${n.id} placed`).toBeDefined();
        expect(Number.isFinite(g!.x) && Number.isFinite(g!.y)).toBe(true);
        expect(g!.width).toBeGreaterThan(0);
        expect(g!.height).toBeGreaterThan(0);
      }

      const q = gradeRoutes(input, geometry);
      expect(q.unrouted, `${sc.id}: unrouted edges`).toBe(0);
      expect(q.routed).toBe(input.edges.length);
      expect(q.diagonalSegments, `${sc.id}: diagonal segments`).toBe(0);
      expect(
        q.violations,
        `${sc.id}: routes through boxes: ${q.violatingEdges.join(", ")}`,
      ).toBe(0);
      expect(q.totalLength).toBeGreaterThan(0);
    });
  }

  // A9 hard trio: the correctness floor must hold at L too, where
  // prune-wall crosses the router's 64-obstacle prune threshold
  // (120 boxes) and storm-sandwich runs two K(6,6) gaps in sequence.
  for (const id of ["prune-wall", "counterflow-ladder", "storm-sandwich"]) {
    it(`${id} (L): correctness floor holds at full size`, async () => {
      const sc = ROUTING_SCENARIOS.find((s) => s.id === id)!;
      const input = sc.build("L");
      const geometry = await layoutStructural(input, {
        direction: sc.direction,
      });
      const q = gradeRoutes(input, geometry);
      expect(q.unrouted).toBe(0);
      expect(q.diagonalSegments).toBe(0);
      expect(
        q.violations,
        `${id} L routes through boxes: ${q.violatingEdges.join(", ")}`,
      ).toBe(0);
    });
  }

  // VR-10 regression (owner Jake, 2026-08-14, Routing Lab screenshot):
  // the correctness floor must hold under EVERY flow, not just each
  // scenario's declared direction. The perimeter rail and the VR-9
  // detour were verified against the SIMPLE route's near-set, which by
  // construction omits every box outside that route's bbox -- and both
  // shapes leave that bbox by definition. Under DOWN flow prune-wall's
  // full-field skip pskip.0 took a rail at x = (source column - 16),
  // inside the field, and sliced through all 19 boxes of row p0 while
  // passing its own collision check. RIGHT flow happened to hide it.
  // Every flow is now pinned; the Lab's flow selector is the surface
  // that found this.
  for (const sc of ROUTING_SCENARIOS) {
    for (const direction of ["DOWN", "RIGHT", "UP", "LEFT"] as const) {
      it(`${sc.id} (L, ${direction}): no box violations under any flow`, async () => {
        const input = sc.build("L");
        const geometry = await layoutStructural(input, { direction });
        const q = gradeRoutes(input, geometry);
        expect(q.unrouted, `${sc.id}/${direction} unrouted`).toBe(0);
        expect(q.diagonalSegments, `${sc.id}/${direction} diagonals`).toBe(0);
        expect(
          q.violations,
          `${sc.id}/${direction} routes through boxes: ${q.violatingEdges.join(", ")}`,
        ).toBe(0);
      });
    }
  }

  it("prune-wall: every size exceeds the router's 64-obstacle prune", () => {
    const sc = ROUTING_SCENARIOS.find((s) => s.id === "prune-wall")!;
    for (const size of SIZES) {
      expect(sc.build(size).nodes.length).toBeGreaterThan(64);
    }
  });

  it("storm-sandwich: both gaps congest (crossings well past one storm)", async () => {
    const sc = ROUTING_SCENARIOS.find((s) => s.id === "storm-sandwich")!;
    const input = sc.build("M");
    const geometry = await layoutStructural(input, { direction: sc.direction });
    const q = gradeRoutes(input, geometry);
    // Two K(5,5) gaps plus spans: crossings must exceed a single
    // K(5,5)'s unavoidable floor by a wide margin.
    expect(q.crossings).toBeGreaterThan(50);
  });

  it("crossing-storm: crossings are unavoidable and detected", async () => {
    const sc = ROUTING_SCENARIOS.find((s) => s.id === "crossing-storm")!;
    const input = sc.build("M");
    const geometry = await layoutStructural(input, { direction: sc.direction });
    const q = gradeRoutes(input, geometry);
    // K(6,6) has crossings by Turán-type counting no matter the order;
    // a zero here means the oracle went blind, not that routing won.
    expect(q.crossings).toBeGreaterThan(0);
  });

  // Long-edge perimeter policy (owner Jake, 2026-08-14): pskip edges
  // whose anchors span a wide portion of the field must route OUTSIDE
  // the row band, not through its interior corridors. Edges that the
  // layered pass compresses into a short span are correctly ineligible.
  for (const size of ["M", "L"] as const) {
    it(`prune-wall (${size}): wide-span skips route outside the row band`, async () => {
      const sc = ROUTING_SCENARIOS.find((s) => s.id === "prune-wall")!;
      const input = sc.build(size);
      const geometry = await layoutStructural(input, {
        direction: sc.direction,
      });
      const boxes = input.nodes.map((n) => geometry.nodes[n.id]!);
      const bandMinY = Math.min(...boxes.map((g) => g.y));
      const bandMaxY = Math.max(...boxes.map((g) => g.y + g.height));
      const bandMinX = Math.min(...boxes.map((g) => g.x));
      const bandMaxX = Math.max(...boxes.map((g) => g.x + g.width));
      const fieldWidth = bandMaxX - bandMinX;
      const edges = geometry.edges ?? {};
      const skipIds = Object.keys(edges).filter((id) =>
        id.startsWith("pskip."),
      );
      expect(skipIds.length).toBeGreaterThan(0);
      let wideCount = 0;
      for (const id of skipIds) {
        const pts = edges[id]!.points;
        const anchorSpan = Math.abs(pts[pts.length - 1]!.x - pts[0]!.x);
        // A wide-span skip is one whose anchors sit at least 80% of
        // the field width apart. The threshold was 0.5 pre-brief-04
        // (owner Jake, 2026-08-14, corridor supply); with per-corridor
        // gap widening the field grows in the dense direction and
        // borderline "half-field" skips no longer trip the perimeter
        // policy's near-count threshold (the route's near-set can
        // legitimately fall below the perimeter-eligibility floor).
        // 0.8 catches only true full-field rails, which remain the
        // pinned invariant.
        if (anchorSpan < fieldWidth * 0.8) continue;
        wideCount++;
        const interior = pts.slice(1, -1);
        const outside = interior.some((p) => p.y < bandMinY || p.y > bandMaxY);
        expect(outside, `${id} interior stays inside row band`).toBe(true);
      }
      // Confirm the scenario actually exercised the policy: full-field
      // rails always survive layering intact and must trigger.
      expect(wideCount, "no wide-span skip edges to test").toBeGreaterThan(0);
    });
  }

  it("longEdgeNear: Infinity disables the perimeter policy (rollback)", async () => {
    // The rollback contract is that with the policy off the router
    // reverts to its prior accept-then-escalate behavior for eligible
    // edges. In prune-wall the escalation ladder ALREADY perimeter-
    // routes the wide skips (their simple Z crosses obstacles), so the
    // two runs agree on those; the assertion here is the weaker one
    // that the option is accepted and layouts still complete.
    const sc = ROUTING_SCENARIOS.find((s) => s.id === "prune-wall")!;
    const input = sc.build("M");
    const geometry = await layoutStructural(input, {
      direction: sc.direction,
      longEdgeNear: Infinity,
    });
    const q = gradeRoutes(input, geometry);
    expect(q.unrouted).toBe(0);
    expect(q.violations).toBe(0);
  });

  // LAY-005 oracle no-regression (owner Jake, 2026-08-14). The two
  // adversarial long-span scenes get their crossings, bend counts,
  // and violation counts PINNED at the pre-LAY-005 baseline: the
  // dagre-style dummy chain must not regress these, though a strict
  // decrease is not required (pathological cases can generate
  // dummy-induced crossings). Raise a ceiling only with an owner
  // ruling and a same-round baseline re-record here.
  // Brief 04 (corridor supply, owner Jake, 2026-08-14) raised the
  // ceilings for crossing-storm: wider inter-layer gaps spread tracks
  // that used to overlap coincidentally, which is exactly the brief's
  // intent (spreading a coincident-run manifests as a legitimate
  // crossing in the polyline crossing-count oracle). The bounded
  // increase is 1.5x per brief verification #4; observed ratios are
  // well within.
  const LAY005_BASELINE: Record<
    string,
    Record<
      "S" | "M" | "L",
      { crossings: number; bends: number; violations: number }
    >
  > = {
    "span-gauntlet": {
      S: { crossings: 3, bends: 26, violations: 0 },
      M: { crossings: 2, bends: 26, violations: 0 },
      L: { crossings: 2, bends: 26, violations: 0 },
    },
    "crossing-storm": {
      S: { crossings: 96, bends: 64, violations: 0 },
      M: { crossings: 216, bends: 100, violations: 0 },
      L: { crossings: 406, bends: 144, violations: 0 },
    },
  };
  for (const [scId, sizes] of Object.entries(LAY005_BASELINE)) {
    for (const size of ["S", "M", "L"] as const) {
      const baseline = sizes[size];
      it(`LAY-005 ${scId} (${size}): crossings/bends/violations do not regress`, async () => {
        const sc = ROUTING_SCENARIOS.find((s) => s.id === scId)!;
        const input = sc.build(size);
        const geometry = await layoutStructural(input, {
          direction: sc.direction,
        });
        const q = gradeRoutes(input, geometry);
        expect(q.crossings, `${scId}/${size} crossings`).toBeLessThanOrEqual(
          baseline.crossings,
        );
        expect(q.bends, `${scId}/${size} bends`).toBeLessThanOrEqual(
          baseline.bends,
        );
        expect(q.violations, `${scId}/${size} violations`).toBeLessThanOrEqual(
          baseline.violations,
        );
      });
    }
  }

  it("routeEdges: false omits routes and the oracle reports the fallback", async () => {
    const sc = ROUTING_SCENARIOS.find((s) => s.id === "fan-bus")!;
    const input = sc.build("S");
    const geometry = await layoutStructural(input, {
      direction: sc.direction,
      routeEdges: false,
    });
    const q = gradeRoutes(input, geometry);
    expect(q.routed).toBe(0);
    expect(q.unrouted).toBe(input.edges.length);
  });
});
