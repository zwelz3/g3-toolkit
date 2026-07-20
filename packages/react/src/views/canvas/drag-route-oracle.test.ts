/**
 * Drag-route oracles (G3L:QLT-007): the fixed reference behaviors for
 * routed structural edges under node drag, written BEFORE any routing
 * rework so improvements have an unambiguous baseline.
 *
 * What is pinned as PASSING (the shipped guarantees):
 *   1. Segment round-trip: `segmentsToPoints` exactly inverts
 *      `routeToSegments` at the original endpoints (data is the single
 *      truth for bends).
 *   2. Orthogonality under drag: `rescaleBends` (the live re-anchor's
 *      separable bilinear rescale) preserves axis-alignment of an
 *      orthogonal route when one endpoint moves.
 *
 * What is pinned as an EXPECTED FAILURE (the honest open gap,
 * G3L:RTE-011): obstacle clearance under drag. The rescale is a
 * geometric remap, not a re-route, so a drag can pull a route THROUGH
 * an obstacle box that the original ELK route avoided. The two OPEN pins were
 * FLIPPED to plain `it` on 2026-07-11 when G3L:RTE-011 landed
 * (resolveDragRoute); they now gate the production drag policy.
 */
import { describe, expect, it } from "vitest";
import {
  rescaleBends,
  resolveDragRoute,
  routeToSegments,
  segmentsToPoints,
} from "./structural-to-cytoscape";

const EPS = 1e-6;

/** An orthogonal ELK-style route around an obstacle: exits east, drops
 *  south past the obstacle, continues east into the target. */
const SOURCE = { x: 0, y: 50 };
const TARGET = { x: 200, y: 150 };
const ROUTE = [SOURCE, { x: 60, y: 50 }, { x: 60, y: 150 }, TARGET] as const;
/** The box the route deliberately bends around. */
const OBSTACLE = { x: 90, y: 20, width: 80, height: 100 };

function isAxisAligned(points: readonly { x: number; y: number }[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) return false;
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

function segmentIntersectsBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
): boolean {
  // Axis-aligned segments against an axis-aligned box: interval math.
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  const bx2 = box.x + box.width;
  const by2 = box.y + box.height;
  // Strict interior overlap (touching the border is tolerated; edges
  // legitimately hug node borders at the spacing minimum).
  return (
    x1 < bx2 - EPS && x2 > box.x + EPS && y1 < by2 - EPS && y2 > box.y + EPS
  );
}

function polylineClearsObstacle(
  points: readonly { x: number; y: number }[],
  box: { x: number; y: number; width: number; height: number },
): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (segmentIntersectsBox(a, b, box)) return false;
  }
  return true;
}

describe("drag-route oracles (G3L:QLT-007)", () => {
  it("fixture sanity: the reference route is orthogonal and clears the obstacle", () => {
    expect(isAxisAligned(ROUTE)).toBe(true);
    expect(polylineClearsObstacle(ROUTE, OBSTACLE)).toBe(true);
  });

  it("PASS-pin: segmentsToPoints exactly inverts routeToSegments at the original endpoints", () => {
    const seg = routeToSegments(ROUTE, SOURCE, TARGET);
    expect(seg).not.toBeNull();
    if (!seg) return;
    const back = segmentsToPoints(seg.distances, seg.weights, SOURCE, TARGET);
    const interior = ROUTE.slice(1, -1);
    expect(back.length).toBe(interior.length);
    back.forEach((p, i) => {
      const q = interior[i];
      expect(q).toBeDefined();
      if (!q) return;
      expect(p.x).toBeCloseTo(q.x, 6);
      expect(p.y).toBeCloseTo(q.y, 6);
    });
  });

  it("PASS-pin: rescaleBends preserves orthogonality when one endpoint moves (body-edge drag)", () => {
    const interior = ROUTE.slice(1, -1);
    const movedSource = { x: SOURCE.x + 40, y: SOURCE.y + 90 };
    const bends = rescaleBends(interior, SOURCE, TARGET, movedSource, TARGET);
    const full = [movedSource, ...bends, TARGET];
    expect(isAxisAligned(full)).toBe(true);
  });

  it("PASS-pin: rescaleBends preserves orthogonality when a container drags its whole subtree", () => {
    const interior = ROUTE.slice(1, -1);
    const d = { x: -70, y: 35 };
    const movedSource = { x: SOURCE.x + d.x, y: SOURCE.y + d.y };
    const movedTarget = { x: TARGET.x + d.x, y: TARGET.y + d.y };
    const bends = rescaleBends(
      interior,
      SOURCE,
      TARGET,
      movedSource,
      movedTarget,
    );
    const full = [movedSource, ...bends, movedTarget];
    expect(isAxisAligned(full)).toBe(true);
    // A rigid translation of both endpoints must translate the bends
    // rigidly too (no stretch artifacts on a subtree drag).
    bends.forEach((b, i) => {
      const orig = interior[i];
      expect(orig).toBeDefined();
      if (!orig) return;
      expect(b.x).toBeCloseTo(orig.x + d.x, 6);
      expect(b.y).toBeCloseTo(orig.y + d.y, 6);
    });
  });

  // The honest open gap (G3L:RTE-011). The rescale slides the vertical
  // clearing segment (x=60) proportionally with the source->target
  // x-extent; stretching the extent past the obstacle's near face
  // remaps the route straight through the box ELK avoided
  // (60/200 * 400 = 120, inside the obstacle's 90..170 x-band).
  // Desired behavior (incremental rerouting): the route stays clear.
  // FLIPPED 2026-07-11 (the Round-1 acceptance change): G3L:RTE-011
  // landed as `resolveDragRoute` (rescale-when-clear,
  // obstacle-aware-reroute-when-not), so these pins now run the
  // PRODUCTION policy and gate as plain tests. MR-8's two symptoms
  // are the acceptance criteria: border-anchored perpendicular
  // terminals and no routes over other boxes.
  it("FLIPPED-pin (G3L:RTE-011): dragged routes clear obstacles via the drag policy", () => {
    const interior = ROUTE.slice(1, -1);
    // Drag the TARGET far right: the raw rescale would sweep the
    // clearing segment into the obstacle; the policy must detect the
    // collision and reroute clear.
    const movedTarget = { x: 400, y: TARGET.y };
    const points = resolveDragRoute({
      bends: interior,
      oldSource: SOURCE,
      oldTarget: TARGET,
      newSource: SOURCE,
      newTarget: movedTarget,
      srcSide: "EAST",
      tgtSide: "WEST",
      sameSide: true,
      obstacles: [OBSTACLE],
    });
    const full = [SOURCE, ...points, movedTarget];
    expect(polylineClearsObstacle(full, OBSTACLE)).toBe(true);
    // Sanity: the raw rescale really would have collided (the pin
    // still documents WHY the policy exists).
    const rescaled = rescaleBends(
      [...interior],
      SOURCE,
      TARGET,
      SOURCE,
      movedTarget,
    );
    expect(
      polylineClearsObstacle([SOURCE, ...rescaled, movedTarget], OBSTACLE),
    ).toBe(false);
  });

  it("FLIPPED-pin (G3L:RTE-011): mixed-attachment drag keeps clearance via the drag policy", () => {
    // FIXTURE CORRECTION at flip time: the round-1 expected-fail
    // version placed movedTarget at (130, 40), which is INSIDE the
    // obstacle (90..170 x 20..120): a polyline ending inside a box
    // can never clear it, so the pin as originally authored was
    // unsatisfiable and the it.fails marker masked it. In production
    // an anchor sits on its own node's border, never inside a
    // foreign obstacle. The corrected target sits below the
    // obstacle, approached from the south.
    const interior = ROUTE.slice(1, -1);
    const movedSource = { x: 30, y: 60 };
    const movedTarget = { x: 130, y: 160 };
    const points = resolveDragRoute({
      bends: interior,
      oldSource: SOURCE,
      oldTarget: TARGET,
      newSource: movedSource,
      newTarget: movedTarget,
      srcSide: "EAST",
      tgtSide: "SOUTH",
      sameSide: false,
      obstacles: [OBSTACLE],
    });
    const full = [movedSource, ...points, movedTarget];
    expect(polylineClearsObstacle(full, OBSTACLE)).toBe(true);
  });
});
