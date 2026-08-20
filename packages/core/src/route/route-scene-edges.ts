/**
 * Post-layout obstacle-aware edge routing for non-structural scenes.
 *
 * Pure geometry: given node boxes and edge endpoint pairs, produce per-edge
 * routed polylines via `routeOrthogonal`. Each edge is routed against the
 * scene's boxes MINUS the endpoint nodes' own boxes; the router's built-in
 * pruning (>64 obstacles) covers dense scenes.
 *
 * The `RouteTerminal.point` is placed at each endpoint's bounding box CENTER
 * (not on the border) and the `RouteTerminal.side` is inferred from the
 * relative position of source and target. The first/last route segments are
 * therefore perpendicular to the inferred cardinal side.
 *
 * Self-loops are excluded from routing entirely (returned as `null` result);
 * callers pass them through unchanged.
 */

import {
  routeOrthogonal,
  type RouteBox,
  type RouteSide,
} from "./orthogonal-router";

export interface SceneNodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneEdgeEndpoints {
  id: string;
  source: string;
  target: string;
}

export interface RouteSceneOptions {
  /** Router clearance around obstacle borders. Default 12. */
  clearance?: number;
  /** A* cost per bend; higher = straighter. Default 30. */
  bendPenalty?: number;
  /** Minimum length of first/last route segment. Default 28. */
  minStub?: number;
  /**
   * Grazing tolerance (px). Before the "direct-unless-crossing" decision each
   * obstacle box is INSET by this margin on all sides, so an edge whose
   * straight shot only clips the outer `grazeTolerance` shell of a node is
   * treated as NOT crossing and stays bezier. Only a shot that penetrates
   * deeper than the margin into a node body triggers a Z-route, which reduces
   * the number of routed (cornered) edges in sparse scenes. Applies to the
   * DECISION ONLY; the actual routeOrthogonal obstacle set keeps full box
   * geometry, so any route that does fire still clears node bodies with full
   * clearance. Default 0 (exact body test, no tolerance). Ignored in "always"
   * mode (which routes everything regardless of obstacles).
   */
  grazeTolerance?: number;
  /**
   * Routing mode. Default "direct-unless-crossing".
   * - "direct-unless-crossing": route orthogonally only when the straight
   *   LINE between box centers actually passes through another node's box
   *   (exact segment-vs-rectangle test); otherwise leave the edge unrouted
   *   (bezier). Straight is strongly preferred: an edge only detours when its
   *   direct shot genuinely crosses a node body, not merely when a node sits
   *   inside the shot's bounding rectangle.
   * - "always": route every edge orthogonally regardless of obstacles.
   */
  mode?: "direct-unless-crossing" | "always";
}

export interface SceneRoutedEdge {
  id: string;
  points: { x: number; y: number }[];
}

/** Result of the routing pass: per-edge polylines (only for edges that
 *  routed successfully). Edges with a missing endpoint, self-loops, or a
 *  null router result are OMITTED; callers should clear any stale routing
 *  data from those edges. */
export interface RouteSceneResult {
  routed: Map<string, { x: number; y: number }[]>;
}

/** Decide the exit/entry sides from the relative position of source and
 *  target BOX CENTERS. Horizontal-dominant (|dx| >= |dy|, tie included):
 *  east/west. Vertical-dominant (|dy| > |dx|): south/north. Zero-vector:
 *  source EAST, target WEST (exposed for tests; callers exclude self-loops
 *  before reaching this). */
export function inferTerminalSides(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
): { sourceSide: RouteSide; targetSide: RouteSide } {
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: "EAST", targetSide: "WEST" }
      : { sourceSide: "WEST", targetSide: "EAST" };
  }
  return dy > 0
    ? { sourceSide: "SOUTH", targetSide: "NORTH" }
    : { sourceSide: "NORTH", targetSide: "SOUTH" };
}

function boxCenter(b: SceneNodeBox): { x: number; y: number } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Shrink each box inward by `margin` on all sides for the grazing-tolerance
 *  crossing DECISION only (never for the actual route obstacle set). Boxes that
 *  collapse to non-positive extent (smaller than 2*margin in either axis) can
 *  only ever be grazed, so they are dropped from the decision entirely. */
function insetBoxes(boxes: readonly RouteBox[], margin: number): RouteBox[] {
  const out: RouteBox[] = [];
  for (const b of boxes) {
    const w = b.width - 2 * margin;
    const h = b.height - 2 * margin;
    if (w <= 0 || h <= 0) continue;
    out.push({ x: b.x + margin, y: b.y + margin, width: w, height: h });
  }
  return out;
}

/** True iff the straight segment a->b actually passes through any of the
 *  axis-aligned boxes (Liang-Barsky slab clip). Unlike
 *  `polylineIntersectsBoxes`, which tests each segment's BOUNDING BOX (exact
 *  only for axis-aligned segments), this is exact for a DIAGONAL center-to-
 *  center shot: a node that merely sits inside the shot's bounding rectangle
 *  but off the line does NOT count as a crossing. This is what makes the
 *  "direct-unless-crossing" mode strongly prefer straight edges. Endpoints
 *  are assumed to lie outside every box (callers exclude the edge's own
 *  source/target from `boxes`). Exported for direct unit testing. */
export function segmentIntersectsBoxes(
  a: { x: number; y: number },
  b: { x: number; y: number },
  boxes: readonly RouteBox[],
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const box of boxes) {
    const minX = box.x;
    const minY = box.y;
    const maxX = box.x + box.width;
    const maxY = box.y + box.height;
    let t0 = 0;
    let t1 = 1;
    // Clip the parametric segment a + t*(b-a), t in [0,1], against one slab.
    // p<0: candidate entering; p>0: candidate leaving; p==0: parallel (outside
    // iff q<0). Returns false when the segment is wholly outside this boundary.
    const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) < 1e-12) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    if (
      clip(-dx, a.x - minX) &&
      clip(dx, maxX - a.x) &&
      clip(-dy, a.y - minY) &&
      clip(dy, maxY - a.y) &&
      t0 <= t1
    ) {
      return true;
    }
  }
  return false;
}

/** Route every edge in the scene around every other node. Self-loops and
 *  edges with unresolved endpoints are omitted from the returned map. */
export function routeSceneEdges(
  nodes: readonly SceneNodeBox[],
  edges: readonly SceneEdgeEndpoints[],
  opts: RouteSceneOptions = {},
): RouteSceneResult {
  const byId = new Map<string, SceneNodeBox>();
  for (const n of nodes) byId.set(n.id, n);
  const routed = new Map<string, { x: number; y: number }[]>();

  const mode = opts.mode ?? "direct-unless-crossing";

  for (const e of edges) {
    if (e.source === e.target) continue; // self-loops passed through
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    const sc = boxCenter(s);
    const tc = boxCenter(t);
    const { sourceSide, targetSide } = inferTerminalSides(sc, tc);
    const obstacles: RouteBox[] = [];
    for (const n of nodes) {
      if (n.id === s.id || n.id === t.id) continue;
      obstacles.push({ x: n.x, y: n.y, width: n.width, height: n.height });
    }
    // direct-unless-crossing: skip routing when the straight LINE between box
    // centers does not actually pass through any obstacle box (exact segment-
    // vs-rectangle test, not the bounding-box overlap that over-counted every
    // node inside the diagonal's bbox). The edge stays unrouted (bezier). Only
    // fall through to routeOrthogonal when the direct shot genuinely crosses a
    // node OR the mode is "always".
    const graze = opts.grazeTolerance ?? 0;
    const decisionBoxes = graze > 0 ? insetBoxes(obstacles, graze) : obstacles;
    if (
      mode === "direct-unless-crossing" &&
      !segmentIntersectsBoxes(sc, tc, decisionBoxes)
    ) {
      continue;
    }
    const res = routeOrthogonal({
      source: { point: sc, side: sourceSide },
      target: { point: tc, side: targetSide },
      obstacles,
      clearance: opts.clearance,
      bendPenalty: opts.bendPenalty,
      minStub: opts.minStub,
    });
    if (res && res.points.length >= 2) {
      routed.set(e.id, res.points);
    }
  }

  return { routed };
}

/** Convert a routed polyline into cytoscape `segment-distances` /
 *  `segment-weights` per its `curve-style: segments` contract. Terminal
 *  points (index 0 and last) are dropped; only interior bend points map
 *  onto segment-distances (perpendicular offset from the source-target
 *  line) and segment-weights (parametric position along that line).
 *
 *  Returns `null` when the polyline is straight (no interior bends): the
 *  caller should not stamp the routed class on such edges.
 */
export function polylineToCytoscapeSegments(
  points: readonly { x: number; y: number }[],
): { distances: number[]; weights: number[] } | null {
  if (points.length < 3) return null;
  const src = points[0];
  const tgt = points[points.length - 1];
  if (!src || !tgt) return null;
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return null; // degenerate
  const len = Math.sqrt(lenSq);
  const distances: number[] = [];
  const weights: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (!p) continue;
    const px = p.x - src.x;
    const py = p.y - src.y;
    // Weight: parametric projection onto source->target vector.
    const w = (px * dx + py * dy) / lenSq;
    // Distance: perpendicular offset along cytoscape's vectorNormInverse.
    // Cytoscape renders segpt = midpt + vectorNormInverse * d, with
    // vectorNormInverse = (-dy/l, dx/l) (edge-control-points.mjs). Solving
    // segpt == p for d gives (py*dx - px*dy)/len. The prior (px*dy - py*dx)
    // negated this, mirroring every bend across the source->target chord
    // (~2*offset error) and throwing detours back through the node they
    // routed around. routeToSegments (structural path) uses this sign.
    const d = (py * dx - px * dy) / len;
    weights.push(w);
    distances.push(d);
  }
  if (distances.length === 0) return null;
  return { distances, weights };
}
