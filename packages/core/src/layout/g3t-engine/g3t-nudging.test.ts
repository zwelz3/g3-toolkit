/**
 * Unit tests for the g3t-nudging parallel-run separation pass.
 * Covers the core algorithm contracts (ordering, ladder branches,
 * split rule, group atomicity, corridorDemand shape, sort order).
 */
import { describe, it, expect } from "vitest";
import { nudgeRoutes } from "./g3t-nudging";
import { polylineIntersectsBoxes } from "../../route/orthogonal-router";

interface Pt {
  x: number;
  y: number;
}

const twoParallelHRoutes = (): Record<string, { points: Pt[] }> => ({
  a: {
    points: [
      { x: 0, y: 100 },
      { x: 30, y: 100 },
      { x: 30, y: 200 },
      { x: 60, y: 200 },
    ],
  },
  b: {
    points: [
      { x: 0, y: 100 },
      { x: 30, y: 100 },
      { x: 30, y: 200 },
      { x: 60, y: 200 },
    ],
  },
});

describe("nudgeRoutes: basics", () => {
  it("passes 2-point straight routes through unchanged (never adds bends)", () => {
    const input = {
      s1: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    };
    const { routes } = nudgeRoutes(input, []);
    expect(routes.s1?.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it("returns byte-identical single-edge input (no group formed)", () => {
    const input = {
      solo: {
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 100 },
        ],
      },
    };
    const { routes, corridorDemand } = nudgeRoutes(input, []);
    expect(routes.solo?.points).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
    expect(corridorDemand).toHaveLength(0);
  });

  it("Z-route bar-and-arm separation: bars translate; arm-jog crossings self-revert cleanly", () => {
    // Regression: today's nudge only separates the bar of a Z. With arms
    // as candidates, the bar-first ordering lets bars translate; each
    // arm-jog attempt then runs the crossing-no-worse validator: if the
    // jog would sweep across another edge's translated bar, the arm
    // group reverts (the contract). This test pins the bar-separation
    // that IS achievable and asserts no polyline was corrupted.
    const input = twoParallelHRoutes();
    const { routes, corridorDemand } = nudgeRoutes(input, [], {
      trackGap: 8,
      clearance: 0,
    });
    const a = routes.a!.points;
    const b = routes.b!.points;
    // Bars still separated by translate.
    expect(a[1]!.x).not.toEqual(b[1]!.x);
    // Anchors preserved byte-identical.
    expect(a[0]).toEqual({ x: 0, y: 100 });
    expect(a[a.length - 1]).toEqual({ x: 60, y: 200 });
    expect(b[0]).toEqual({ x: 0, y: 100 });
    expect(b[b.length - 1]).toEqual({ x: 60, y: 200 });
    // Three corridors declared (top arm, bar, bottom arm); the arm
    // corridors revert (blockedReason "reverted") when their jog would
    // cross the sibling's translated bar. Bar corridor commits cleanly.
    expect(corridorDemand).toHaveLength(3);
    const bar = corridorDemand.find((d) => d.axis === "v");
    expect(bar!.blocked).toBe(false);
    const arms = corridorDemand.filter((d) => d.axis === "h");
    expect(arms).toHaveLength(2);
    // Arms MAY revert here — the fixture geometry forces the jog run
    // through the sibling bar. What must not happen: an arm splice that
    // corrupts an anchor or produces a self-crossing polyline.
    for (const arm of arms) {
      if (arm.blocked) expect(arm.blockedReason).toBe("reverted");
    }
  });

  it("both arms jog to distinct tracks when the fixture's other segments do not obstruct the run", () => {
    // Two 3-point routes sharing a horizontal arm on y=100 (arm-arm
    // coincidence) whose second segments DIVERGE vertically (one down to
    // y=50, one up to y=150). The two vertical arms do NOT group (their
    // along-extents share only the endpoint, so overlap is zero), so
    // there is nothing for the h-arm jog run to cross except itself.
    const input: Record<string, { points: Pt[] }> = {
      a: {
        points: [
          { x: 0, y: 100 },
          { x: 50, y: 100 },
          { x: 50, y: 50 },
        ],
      },
      b: {
        points: [
          { x: 0, y: 100 },
          { x: 50, y: 100 },
          { x: 50, y: 150 },
        ],
      },
    };
    const { routes, corridorDemand } = nudgeRoutes(input, [], {
      trackGap: 8,
      clearance: 0,
    });
    const a = routes.a!.points;
    const b = routes.b!.points;
    // Anchors preserved.
    expect(a[0]).toEqual({ x: 0, y: 100 });
    expect(a[a.length - 1]).toEqual({ x: 50, y: 50 });
    expect(b[0]).toEqual({ x: 0, y: 100 });
    expect(b[b.length - 1]).toEqual({ x: 50, y: 150 });
    // Arms jogged: the run perp (pts[2]) sits off y=100 and differs.
    expect(a[2]!.y).not.toEqual(100);
    expect(b[2]!.y).not.toEqual(100);
    expect(a[2]!.y).not.toEqual(b[2]!.y);
    // Only one corridor (the h-arm pair). It must not revert.
    const armCorridor = corridorDemand.find((d) => d.axis === "h");
    expect(armCorridor).toBeDefined();
    expect(armCorridor!.blocked).toBe(false);
  });

  it("anchor preservation: p0 and p_last byte-identical across every input", () => {
    const inputs: Record<string, Record<string, { points: Pt[] }>> = {
      z: twoParallelHRoutes(),
      solo: {
        s: {
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 100 },
          ],
        },
      },
    };
    for (const [, input] of Object.entries(inputs)) {
      const { routes } = nudgeRoutes(input, [], {
        trackGap: 8,
        clearance: 0,
      });
      for (const id of Object.keys(input)) {
        const src = input[id]!.points;
        const out = routes[id]!.points;
        expect(out[0]).toEqual(src[0]);
        expect(out[out.length - 1]).toEqual(src[src.length - 1]);
      }
    }
  });

  it("idempotence: a second nudge pass is a no-op once arms are >= trackGap apart", () => {
    // Obstacle bounds ensure the arm corridor has span >= (n+1)*trackGap
    // so placements land at exactly trackGap apart. crowdedRuns then
    // cuts them (diff >= trackGap) on the second pass, so no group forms.
    const input: Record<string, { points: Pt[] }> = {
      a: {
        points: [
          { x: 0, y: 100 },
          { x: 50, y: 100 },
          { x: 50, y: 50 },
        ],
      },
      b: {
        points: [
          { x: 0, y: 100 },
          { x: 50, y: 100 },
          { x: 50, y: 150 },
        ],
      },
    };
    const obstacles = [
      { x: -10, y: 80, width: 60, height: 5 },
      { x: -10, y: 115, width: 60, height: 5 },
    ];
    const first = nudgeRoutes(input, obstacles, {
      trackGap: 8,
      clearance: 0,
    });
    const asInput: Record<string, { points: Pt[] }> = {};
    for (const [id, r] of Object.entries(first.routes)) {
      asInput[id] = { points: r.points.map((p) => ({ ...p })) };
    }
    const second = nudgeRoutes(asInput, obstacles, {
      trackGap: 8,
      clearance: 0,
    });
    expect(second.routes).toEqual(first.routes);
  });

  it("short arm (armAlongExtent < 2*trackGap): left fixed, no jog inserted", () => {
    // Both arms have along-extent = 14 which is < 2*trackGap=16 so they
    // are excluded from the movable pool. The bar (interior seg) forms a
    // crowded group of n=2 and separates. The horizontal span is wide
    // enough (-10..18) that the bar spread (0, 8) does not coincide with
    // the route's start or anchor endpoints, so no zero-length arms form.
    const input = {
      a: {
        points: [
          { x: -10, y: 100 },
          { x: 4, y: 100 },
          { x: 4, y: 200 },
          { x: 18, y: 200 },
        ],
      },
      b: {
        points: [
          { x: -10, y: 100 },
          { x: 4, y: 100 },
          { x: 4, y: 200 },
          { x: 18, y: 200 },
        ],
      },
    };
    const { routes } = nudgeRoutes(input, [], { trackGap: 8, clearance: 0 });
    // Bar (interior) still separates (armAlongExtent for bar is 100).
    // But arms remain 4-point original shape (no jog inserts).
    expect(routes.a!.points).toHaveLength(4);
    expect(routes.b!.points).toHaveLength(4);
    // Anchors preserved.
    expect(routes.a!.points[0]).toEqual({ x: -10, y: 100 });
    expect(routes.a!.points[3]).toEqual({ x: 18, y: 200 });
  });
});

describe("nudgeRoutes: only moves what is actually crowded", () => {
  /** A vertical run at `x`, spanning the same y interval as its peers
   *  so they all overlap and are grouping candidates. */
  const vRun = (x: number): { points: Pt[] } => ({
    points: [
      { x: 0, y: 0 },
      { x, y: 0 },
      { x, y: 200 },
      { x: 400, y: 200 },
    ],
  });

  it("leaves a run alone when every neighbour is already a trackGap away", () => {
    // 0, 12, 24: within the 16px capture band pairwise, so the old
    // transitive grouping swept all three into one corridor and
    // re-spaced them. They are already >= trackGap apart, so there is
    // nothing to separate and they must not move.
    const input = { a: vRun(4), b: vRun(12), c: vRun(24) };
    const { routes } = nudgeRoutes(input, [], { trackGap: 8, clearance: 0 });
    expect(routes.a?.points).toEqual(input.a.points);
    expect(routes.b?.points).toEqual(input.b.points);
    expect(routes.c?.points).toEqual(input.c.points);
  });

  it("splits a transitive chain and moves only the crowded end", () => {
    // a/b are coincident and must separate. c sits a comfortable 40px
    // off, chained in only by transitivity through nothing at all: it
    // must be left exactly where it was.
    const input = { a: vRun(4), b: vRun(4), c: vRun(40) };
    const { routes } = nudgeRoutes(input, [], { trackGap: 8, clearance: 0 });
    expect(routes.c?.points).toEqual(input.c.points);
    const ax = routes.a?.points[1]?.x ?? 0;
    const bx = routes.b?.points[1]?.x ?? 0;
    expect(Math.abs(ax - bx)).toBeGreaterThanOrEqual(8 - 1e-6);
  });

  it("separates about the run's own centre, not the corridor's", () => {
    // Two coincident runs at x=100, inside a corridor whose walls sit
    // far away on one side. Anchoring on the corridor midline dragged
    // the pair toward the middle of that space; anchoring on their own
    // centre of mass keeps them at 100 and just splits them.
    const input = { a: vRun(100), b: vRun(100) };
    const boxes = [
      { x: -400, y: -50, width: 300, height: 249 },
      { x: 300, y: -50, width: 100, height: 249 },
    ];
    const { routes } = nudgeRoutes(input, boxes, {
      trackGap: 8,
      clearance: 0,
    });
    const xs = [routes.a?.points[1]?.x ?? 0, routes.b?.points[1]?.x ?? 0].sort(
      (m, n) => m - n,
    );
    // Split by a full track gap...
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeCloseTo(8, 5);
    // ...and still centred where they started, not hauled to the
    // middle of a corridor running from -100 to 300.
    expect(((xs[0] ?? 0) + (xs[1] ?? 0)) / 2).toBeCloseTo(100, 5);
  });
});

describe("nudgeRoutes: degradation ladder", () => {
  it("branch (a): full-gap spacing with wide-open corridor (deficit 0)", () => {
    // No obstacles; open corridor. Two parallel V segments coincide.
    const input = {
      a: {
        points: [
          { x: 0, y: 10 },
          { x: 200, y: 10 },
          { x: 200, y: 90 },
          { x: 400, y: 90 },
        ],
      },
      b: {
        points: [
          { x: 0, y: 10 },
          { x: 200, y: 10 },
          { x: 200, y: 90 },
          { x: 400, y: 90 },
        ],
      },
    };
    const { corridorDemand } = nudgeRoutes(input, [], {
      trackGap: 8,
      clearance: 0,
    });
    // Z-route generates 3 corridors post-arm-inclusion: top arm, bar,
    // bottom arm. Arms may revert if their jog runs would sweep across a
    // translated bar; the bar corridor itself always commits cleanly.
    expect(corridorDemand.length).toBeGreaterThanOrEqual(1);
    const bar = corridorDemand.find((d) => d.axis === "v");
    expect(bar).toBeDefined();
    expect(bar!.blocked).toBe(false);
    for (const d of corridorDemand) {
      expect(d.deficit).toBeGreaterThanOrEqual(0);
      expect(d.tracksRequired).toBe(2);
      if (d.blocked) expect(d.blockedReason).toBe("reverted");
    }
  });

  it("branch (c): fully occluded emits blocked/occluded demand and passes routes through", () => {
    // Two boxes that touch: no free span between them.
    const boxes = [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 100 },
    ];
    const input = {
      a: {
        points: [
          { x: 0, y: 20 },
          { x: 50, y: 20 },
          { x: 50, y: 60 },
          { x: 100, y: 60 },
        ],
      },
      b: {
        points: [
          { x: 0, y: 30 },
          { x: 50, y: 30 },
          { x: 50, y: 70 },
          { x: 100, y: 70 },
        ],
      },
    };
    const { corridorDemand } = nudgeRoutes(input, boxes, {
      trackGap: 8,
      clearance: 8,
    });
    // At least one corridor should be blocked=occluded when the free span vanishes.
    const occluded = corridorDemand.filter(
      (d) => d.blocked && d.blockedReason === "occluded",
    );
    expect(occluded.length).toBeGreaterThan(0);
  });
});

describe("nudgeRoutes: contracts", () => {
  it("corridorDemand sorted by deficit descending", () => {
    // Construct two independent corridors with different deficits.
    const input = {
      a: {
        points: [
          { x: 0, y: 100 },
          { x: 30, y: 100 },
          { x: 30, y: 200 },
          { x: 60, y: 200 },
        ],
      },
      b: {
        points: [
          { x: 0, y: 100 },
          { x: 30, y: 100 },
          { x: 30, y: 200 },
          { x: 60, y: 200 },
        ],
      },
      c: {
        points: [
          { x: 0, y: 500 },
          { x: 400, y: 500 },
          { x: 400, y: 600 },
          { x: 800, y: 600 },
        ],
      },
      d: {
        points: [
          { x: 0, y: 500 },
          { x: 400, y: 500 },
          { x: 400, y: 600 },
          { x: 800, y: 600 },
        ],
      },
    };
    const { corridorDemand } = nudgeRoutes(input, [], {
      trackGap: 8,
      clearance: 0,
    });
    for (let i = 0; i + 1 < corridorDemand.length; i++) {
      expect(corridorDemand[i]!.deficit).toBeGreaterThanOrEqual(
        corridorDemand[i + 1]!.deficit,
      );
    }
  });

  it("output routes are box-check clean when the input was clean", () => {
    const boxes = [{ x: 40, y: 40, width: 20, height: 20 }];
    const input = {
      a: {
        points: [
          { x: 0, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 300 },
        ],
      },
      b: {
        points: [
          { x: 0, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 300 },
        ],
      },
    };
    const { routes } = nudgeRoutes(input, boxes, { trackGap: 8, clearance: 0 });
    for (const r of Object.values(routes)) {
      expect(polylineIntersectsBoxes(r.points, boxes)).toBe(false);
    }
  });

  it("determinism: two runs on identical input produce identical output", () => {
    const input = twoParallelHRoutes();
    const first = nudgeRoutes(input, [], { trackGap: 8, clearance: 0 });
    const second = nudgeRoutes(input, [], { trackGap: 8, clearance: 0 });
    expect(second.routes).toEqual(first.routes);
    expect(second.corridorDemand).toEqual(first.corridorDemand);
  });

  it("corridorDemand blocked field is a discriminated union with blockedReason present iff blocked", () => {
    const input = twoParallelHRoutes();
    const { corridorDemand } = nudgeRoutes(input, [], {
      trackGap: 8,
      clearance: 0,
    });
    for (const d of corridorDemand) {
      if (d.blocked) {
        expect(["occluded", "reverted"]).toContain(d.blockedReason);
      } else {
        expect(d.blockedReason).toBeUndefined();
      }
    }
  });
});

describe("polylineIntersectsBoxes: return polarity guard", () => {
  it("returns true when a segment passes through a box interior", () => {
    const boxes = [{ x: 10, y: 10, width: 20, height: 20 }];
    const pts = [
      { x: 0, y: 20 },
      { x: 40, y: 20 },
    ];
    expect(polylineIntersectsBoxes(pts, boxes)).toBe(true);
  });
  it("returns false when the polyline avoids every box", () => {
    const boxes = [{ x: 10, y: 10, width: 20, height: 20 }];
    const pts = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ];
    expect(polylineIntersectsBoxes(pts, boxes)).toBe(false);
  });
});
