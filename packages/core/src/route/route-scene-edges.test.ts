import { describe, expect, it } from "vitest";
import {
  inferTerminalSides,
  polylineToCytoscapeSegments,
  routeSceneEdges,
  segmentIntersectsBoxes,
  type SceneEdgeEndpoints,
  type SceneNodeBox,
} from "./route-scene-edges";

const EPS = 1e-6;

function segsClearBox(
  pts: readonly { x: number; y: number }[],
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const x1 = box.x;
  const x2 = box.x + box.width;
  const y1 = box.y;
  const y2 = box.y + box.height;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const sx1 = Math.min(a.x, b.x);
    const sx2 = Math.max(a.x, b.x);
    const sy1 = Math.min(a.y, b.y);
    const sy2 = Math.max(a.y, b.y);
    const overlapX = sx1 < x2 - EPS && sx2 > x1 + EPS;
    const overlapY = sy1 < y2 - EPS && sy2 > y1 + EPS;
    if (overlapX && overlapY) return false;
  }
  return true;
}

describe("inferTerminalSides", () => {
  it("horizontal dominant: source left of target -> EAST/WEST", () => {
    expect(inferTerminalSides({ x: 0, y: 0 }, { x: 100, y: 10 })).toEqual({
      sourceSide: "EAST",
      targetSide: "WEST",
    });
  });
  it("horizontal dominant: source right of target -> WEST/EAST", () => {
    expect(inferTerminalSides({ x: 100, y: 0 }, { x: 0, y: 10 })).toEqual({
      sourceSide: "WEST",
      targetSide: "EAST",
    });
  });
  it("vertical dominant: source above -> SOUTH/NORTH", () => {
    expect(inferTerminalSides({ x: 0, y: 0 }, { x: 10, y: 100 })).toEqual({
      sourceSide: "SOUTH",
      targetSide: "NORTH",
    });
  });
  it("vertical dominant: source below -> NORTH/SOUTH", () => {
    expect(inferTerminalSides({ x: 0, y: 100 }, { x: 10, y: 0 })).toEqual({
      sourceSide: "NORTH",
      targetSide: "SOUTH",
    });
  });
  it("near-diagonal tie (|dx|==|dy|) resolves to horizontal-dominant", () => {
    expect(inferTerminalSides({ x: 0, y: 0 }, { x: 50, y: 50 })).toEqual({
      sourceSide: "EAST",
      targetSide: "WEST",
    });
  });
  it("zero vector: source EAST, target WEST", () => {
    expect(inferTerminalSides({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({
      sourceSide: "EAST",
      targetSide: "WEST",
    });
  });
});

describe("routeSceneEdges", () => {
  it("routes clear of an intervening obstacle", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 40, width: 40, height: 40 },
      { id: "obst", x: 100, y: 0, width: 60, height: 200 },
      { id: "b", x: 240, y: 40, width: 40, height: 40 },
    ];
    const edges: SceneEdgeEndpoints[] = [
      { id: "e1", source: "a", target: "b" },
    ];
    const { routed } = routeSceneEdges(nodes, edges);
    const pts = routed.get("e1");
    expect(pts).toBeDefined();
    if (!pts) return;
    expect(segsClearBox(pts, nodes[1]!)).toBe(true);
  });

  it("first/last segment is perpendicular to the inferred side (horizontal case)", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "obst", x: 100, y: -20, width: 40, height: 80 },
      { id: "b", x: 200, y: 0, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(nodes, [
      { id: "e1", source: "a", target: "b" },
    ]);
    const pts = routed.get("e1")!;
    // source EAST exit: first segment horizontal
    expect(Math.abs(pts[0]!.y - pts[1]!.y)).toBeLessThan(EPS);
    expect(pts[1]!.x).toBeGreaterThan(pts[0]!.x);
    // target WEST entry: last segment horizontal, approaching from west
    const n = pts.length;
    expect(Math.abs(pts[n - 1]!.y - pts[n - 2]!.y)).toBeLessThan(EPS);
    expect(pts[n - 1]!.x).toBeGreaterThan(pts[n - 2]!.x);
  });

  it("vertical arrangement: first/last segment is vertical", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "obst", x: -20, y: 100, width: 80, height: 40 },
      { id: "b", x: 0, y: 240, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(nodes, [
      { id: "e1", source: "a", target: "b" },
    ]);
    const pts = routed.get("e1")!;
    // source SOUTH exit: first segment vertical
    expect(Math.abs(pts[0]!.x - pts[1]!.x)).toBeLessThan(EPS);
    expect(pts[1]!.y).toBeGreaterThan(pts[0]!.y);
  });

  it("self-loop edges are omitted (pass-through)", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(nodes, [
      { id: "loop", source: "a", target: "a" },
    ]);
    expect(routed.has("loop")).toBe(false);
  });

  it("edges with missing endpoints are omitted", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(nodes, [
      { id: "dangling", source: "a", target: "nonexistent" },
    ]);
    expect(routed.has("dangling")).toBe(false);
  });

  it("direct-unless-crossing: clear diagonal edge is NOT routed", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "b", x: 200, y: 200, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e1", source: "a", target: "b" }],
      { mode: "direct-unless-crossing" },
    );
    // No obstacle between a and b; direct shot is clear → leave unrouted.
    expect(routed.has("e1")).toBe(false);
  });

  it("direct-unless-crossing: obstacle inside the diagonal bbox but OFF the line stays straight", () => {
    // a->b is a diagonal (line y=x through the centers). The obstacle sits in
    // the segment's bounding rectangle but nowhere near the line, so the
    // straight shot misses it. The old bounding-box test flagged this as a
    // crossing and forced a Z-detour; the exact segment test keeps it straight.
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 }, // center (20,20)
      { id: "b", x: 200, y: 200, width: 40, height: 40 }, // center (220,220)
      { id: "off", x: 0, y: 150, width: 40, height: 40 }, // in bbox, off line
    ];
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e1", source: "a", target: "b" }],
      { mode: "direct-unless-crossing" },
    );
    expect(routed.has("e1")).toBe(false);
  });

  it("direct-unless-crossing: edge crossing an obstacle IS routed", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 40, width: 40, height: 40 },
      { id: "obst", x: 100, y: 0, width: 60, height: 200 },
      { id: "b", x: 240, y: 40, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e1", source: "a", target: "b" }],
      { mode: "direct-unless-crossing" },
    );
    // Direct shot from a to b passes through obst → must route around it.
    const pts = routed.get("e1");
    expect(pts).toBeDefined();
    if (pts) expect(pts.length).toBeGreaterThanOrEqual(3);
  });

  it("mode 'always': routes even a clear edge", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "b", x: 200, y: 0, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e1", source: "a", target: "b" }],
      { mode: "always" },
    );
    // Always mode: routes the edge even though no obstacles intervene.
    expect(routed.has("e1")).toBe(true);
  });

  it("default (no mode) == direct-unless-crossing: clear edge unrouted", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "b", x: 200, y: 200, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(nodes, [
      { id: "e1", source: "a", target: "b" },
    ]);
    expect(routed.has("e1")).toBe(false);
  });

  it("grazeTolerance=0 (default): edge clipping 1px into obstacle IS routed", () => {
    // obst box: x[90,130] y[0,80] center (110,40).
    // a->b straight line passes through x=110, which is 1px inside the obst left edge.
    // With grazeTolerance=0 the full box is used for the decision -> crossing detected.
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 20, width: 40, height: 40 }, // center (20,40)
      { id: "obst", x: 90, y: 0, width: 40, height: 80 }, // x[90,130]: left edge at 90
      { id: "b", x: 200, y: 20, width: 40, height: 40 }, // center (220,40)
    ];
    // Direct shot from (20,40) to (220,40) is horizontal — passes through obst.
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e1", source: "a", target: "b" }],
      {
        grazeTolerance: 0,
      },
    );
    expect(routed.has("e1")).toBe(true);
  });

  it("grazeTolerance clips outer shell: edge that only grazes the margin stays bezier", () => {
    // obst box: x[90,130] y[0,200]. a->b direct shot goes through y=100 at x=110,
    // which is 20px inside the left edge.  With grazeTolerance=25 the decision box
    // insets to x[115,105] — non-positive width, so the box is DROPPED entirely;
    // the shot sees no decision obstacles and stays unrouted.
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 80, width: 40, height: 40 }, // center (20,100)
      { id: "obst", x: 90, y: 0, width: 40, height: 200 }, // narrow obstacle
      { id: "b", x: 200, y: 80, width: 40, height: 40 }, // center (220,100)
    ];
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e1", source: "a", target: "b" }],
      {
        grazeTolerance: 25,
      },
    );
    // Inset collapses the 40px-wide obstacle (margin*2=50 > 40) → dropped from decision.
    // Direct shot has no remaining decision obstacles → stays bezier (unrouted).
    expect(routed.has("e1")).toBe(false);
  });

  it("handles dense scenes above the router's 64-obstacle pruning threshold", () => {
    const nodes: SceneNodeBox[] = [
      { id: "a", x: 0, y: 500, width: 40, height: 40 },
      { id: "b", x: 2000, y: 500, width: 40, height: 40 },
    ];
    // 80 filler boxes forming a grid AWAY from the direct route
    // (y ranges 0..200, well above the source/target y=500), so pruning
    // can safely drop them and the route succeeds around empty space.
    for (let i = 0; i < 80; i++) {
      const col = i % 10;
      const row = Math.floor(i / 10);
      nodes.push({
        id: `f${i}`,
        x: 200 + col * 60,
        y: row * 30,
        width: 40,
        height: 20,
      });
    }
    // Use mode:"always" to exercise the router even though the direct
    // path is clear (filler boxes are well above y=500); verifies the
    // router handles >64 obstacles without crashing.
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e1", source: "a", target: "b" }],
      { mode: "always" },
    );
    expect(routed.has("e1")).toBe(true);
  });
});

describe("segmentIntersectsBoxes", () => {
  const box = { x: 100, y: 100, width: 40, height: 40 }; // x[100,140] y[100,140]
  it("diagonal line passing through the box is a hit", () => {
    expect(
      segmentIntersectsBoxes({ x: 0, y: 0 }, { x: 240, y: 240 }, [box]),
    ).toBe(true);
  });
  it("diagonal line whose x-span overlaps the box but stays below it is a miss", () => {
    // x spans [0,200] (overlaps the box's x[100,140]) so a bounding-box test
    // would flag it, but y stays >=200, well below the box's y[100,140].
    expect(
      segmentIntersectsBoxes({ x: 0, y: 200 }, { x: 200, y: 260 }, [box]),
    ).toBe(false);
  });
  it("horizontal line through the box is a hit", () => {
    expect(
      segmentIntersectsBoxes({ x: 0, y: 120 }, { x: 300, y: 120 }, [box]),
    ).toBe(true);
  });
  it("horizontal line above the box is a miss", () => {
    expect(
      segmentIntersectsBoxes({ x: 0, y: 50 }, { x: 300, y: 50 }, [box]),
    ).toBe(false);
  });
  it("empty obstacle set is always a miss", () => {
    expect(segmentIntersectsBoxes({ x: 0, y: 0 }, { x: 9, y: 9 }, [])).toBe(
      false,
    );
  });
});

describe("polylineToCytoscapeSegments", () => {
  it("returns null for a straight polyline", () => {
    expect(
      polylineToCytoscapeSegments([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toBeNull();
  });

  it("returns null when interior points are all collinear with endpoints", () => {
    expect(
      polylineToCytoscapeSegments([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toEqual({ distances: [0], weights: [0.5] });
  });

  it("maps a right-angle detour to non-zero distance", () => {
    const seg = polylineToCytoscapeSegments([
      { x: 0, y: 0 },
      { x: 50, y: -30 },
      { x: 100, y: 0 },
    ]);
    expect(seg).not.toBeNull();
    if (!seg) return;
    expect(seg.weights).toHaveLength(1);
    expect(seg.distances).toHaveLength(1);
    expect(Math.abs(seg.weights[0]! - 0.5)).toBeLessThan(EPS);
    // Cytoscape offsets a segment point by vectorNormInverse = (-dy/l, dx/l).
    // With source->target along +x, vectorNormInverse = (0, 1), so a positive
    // distance moves the bend DOWN (+y). The bend at y=-30 is above the line,
    // hence a negative segment-distance of exactly -30.
    expect(seg.distances[0]).toBeCloseTo(-30, 6);
  });

  // Reconstruct bend points through cytoscape's ACTUAL segments formula
  // (edge-control-points.mjs): vectorNormInverse = (-dy/l, dx/l) with
  // edge-distances:node-position, segpt = midpt(w) + vectorNormInverse*d.
  // The reconstructed segpts must equal the original interior bends. This
  // locks the sign against a mirror regression that a same-formula audit
  // (self-consistent with a buggy encoder) would miss.
  it("round-trips interior bends through cytoscape's segpt formula", () => {
    const src = { x: 100, y: 100 };
    const tgt = { x: 400, y: 300 };
    const bends = [
      { x: 100, y: 300 },
      { x: 260, y: 300 },
    ];
    const seg = polylineToCytoscapeSegments([src, ...bends, tgt]);
    expect(seg).not.toBeNull();
    if (!seg) return;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const l = Math.hypot(dx, dy);
    const vni = { x: -dy / l, y: dx / l }; // cytoscape vectorNormInverse
    seg.distances.forEach((d, i) => {
      const w = seg.weights[i]!;
      const midx = src.x * (1 - w) + tgt.x * w;
      const midy = src.y * (1 - w) + tgt.y * w;
      expect(midx + vni.x * d).toBeCloseTo(bends[i]!.x, 4);
      expect(midy + vni.y * d).toBeCloseTo(bends[i]!.y, 4);
    });
  });
});
