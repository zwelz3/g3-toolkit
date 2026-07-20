/**
 * Layout quality metrics (G3L:QLT-002).
 *
 * The falsifiability oracle for every layout/routing change: crossing
 * count, bend count, total edge length, displacement-from-sketch, and
 * aspect ratio, computed as pure functions over renderer-neutral
 * geometry. Any candidate engine (internal layered, fCoSE-lineage
 * force, in-house router) must meet regression tolerances against the
 * incumbent (ELK / fcose) on shared fixtures BEFORE any surface
 * switches (G3L:ARC-005, G3L:LAY-014). Deterministic by construction
 * (no randomness, no ambient state) per G3L:ARC-006.
 *
 * Inputs are structural-geometry-shaped but deliberately generic so
 * non-structural scenes (canvas positions, future engines) can reuse
 * the same oracle. `metricsFromStructural` adapts a
 * StructuralGeometry document directly.
 */

import type { StructuralGeometry } from "../layout/structural";
import { isChainEdgeId } from "../layout/structural";

export interface MetricsNode {
  id: string;
  /** Absolute top-left, matching StructuralNodeGeometry. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MetricsEdge {
  id: string;
  /** Absolute polyline, endpoints included, in draw order. */
  points: readonly { x: number; y: number }[];
}

export interface LayoutMetricsInput {
  nodes: readonly MetricsNode[];
  edges: readonly MetricsEdge[];
}

export interface LayoutMetrics {
  /** Proper pairwise edge-segment crossings (shared endpoints excluded). */
  crossings: number;
  /** Interior direction changes summed over all edges (collinear
   *  interior points do not count as bends). */
  bends: number;
  /** Sum of polyline lengths over all edges. */
  totalEdgeLength: number;
  /** Bounding box of all node boxes; 0-area collapses to width/height 0. */
  bounds: { x: number; y: number; width: number; height: number };
  /** bounds.width / bounds.height; 1 when height is 0 (degenerate). */
  aspectRatio: number;
  nodeCount: number;
  edgeCount: number;
}

export interface SketchDisplacement {
  /** Mean Euclidean displacement over nodes present in BOTH inputs. */
  mean: number;
  /** Max Euclidean displacement over nodes present in both inputs. */
  max: number;
  /** Per-node displacement for nodes present in both inputs. */
  perNode: Record<string, number>;
  /** Node ids present in only one of the two inputs (excluded above). */
  unmatched: string[];
}

const EPS = 1e-9;

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * Proper intersection of segments p1-p2 and p3-p4. Touching at a
 * shared endpoint is NOT a crossing (edges legitimately meet at
 * ports/junctions); collinear overlap counts as one crossing (it is a
 * legibility defect the metric should see).
 */
export function segmentsCross(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const samePoint = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
  if (
    samePoint(p1, p3) ||
    samePoint(p1, p4) ||
    samePoint(p2, p3) ||
    samePoint(p2, p4)
  ) {
    return false;
  }
  const d1 = cross(p4.x - p3.x, p4.y - p3.y, p1.x - p3.x, p1.y - p3.y);
  const d2 = cross(p4.x - p3.x, p4.y - p3.y, p2.x - p3.x, p2.y - p3.y);
  const d3 = cross(p2.x - p1.x, p2.y - p1.y, p3.x - p1.x, p3.y - p1.y);
  const d4 = cross(p2.x - p1.x, p2.y - p1.y, p4.x - p1.x, p4.y - p1.y);
  if (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  ) {
    return true;
  }
  // Collinear overlap (all cross products ~0 with interval overlap).
  const onSeg = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
  ) =>
    Math.min(a.x, b.x) - EPS <= c.x &&
    c.x <= Math.max(a.x, b.x) + EPS &&
    Math.min(a.y, b.y) - EPS <= c.y &&
    c.y <= Math.max(a.y, b.y) + EPS;
  if (
    Math.abs(d1) < EPS &&
    Math.abs(d2) < EPS &&
    Math.abs(d3) < EPS &&
    Math.abs(d4) < EPS
  ) {
    return onSeg(p1, p2, p3) || onSeg(p1, p2, p4) || onSeg(p3, p4, p1);
  }
  return false;
}

/** Interior direction changes of one polyline (collinear points skipped). */
export function countBends(
  points: readonly { x: number; y: number }[],
): number {
  let bends = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    if (!a || !b || !c) continue;
    const turn = cross(b.x - a.x, b.y - a.y, c.x - b.x, c.y - b.y);
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    // A bend is any non-collinear turn; a collinear reversal (dot<0,
    // turn~0) also counts (the route doubles back on itself).
    if (Math.abs(turn) > EPS || dot < -EPS) bends++;
  }
  return bends;
}

/** Polyline length. */
export function polylineLength(
  points: readonly { x: number; y: number }[],
): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/**
 * Count pairwise edge crossings across DIFFERENT edges. Segments of
 * the same edge never count (a self-bend is a bend, not a crossing).
 * O(S^2) over segments: the oracle runs on fixtures, not per frame.
 */
export function countCrossings(edges: readonly MetricsEdge[]): number {
  interface Seg {
    edge: string;
    a: { x: number; y: number };
    b: { x: number; y: number };
  }
  const segs: Seg[] = [];
  for (const e of edges) {
    for (let i = 1; i < e.points.length; i++) {
      const a = e.points[i - 1];
      const b = e.points[i];
      if (!a || !b) continue;
      segs.push({ edge: e.id, a, b });
    }
  }
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i];
      const t = segs[j];
      if (!s || !t || s.edge === t.edge) continue;
      if (segmentsCross(s.a, s.b, t.a, t.b)) crossings++;
    }
  }
  return crossings;
}

/** Compute the full metric set for one laid-out scene. */
export function computeLayoutMetrics(input: LayoutMetricsInput): LayoutMetrics {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of input.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const hasNodes = input.nodes.length > 0;
  const bounds = hasNodes
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : { x: 0, y: 0, width: 0, height: 0 };
  let bends = 0;
  let totalEdgeLength = 0;
  for (const e of input.edges) {
    bends += countBends(e.points);
    totalEdgeLength += polylineLength(e.points);
  }
  return {
    crossings: countCrossings(input.edges),
    bends,
    totalEdgeLength,
    bounds,
    aspectRatio: bounds.height > EPS ? bounds.width / bounds.height : 1,
    nodeCount: input.nodes.length,
    edgeCount: input.edges.length,
  };
}

/**
 * Displacement of a layout from a sketch (prior positions), the
 * stability metric behind G3L:LAY-017/018: on a local change (e.g.
 * one compartment collapse), untouched elements should move less than
 * one grid unit. Positions compare top-left to top-left; callers
 * exclude the deliberately-changed elements via `ignore`.
 */
export function displacementFromSketch(
  current: ReadonlyMap<string, { x: number; y: number }>,
  sketch: ReadonlyMap<string, { x: number; y: number }>,
  ignore?: ReadonlySet<string>,
): SketchDisplacement {
  const perNode: Record<string, number> = {};
  const unmatched: string[] = [];
  let sum = 0;
  let max = 0;
  let n = 0;
  for (const [id, pos] of current) {
    if (ignore?.has(id)) continue;
    const prev = sketch.get(id);
    if (!prev) {
      unmatched.push(id);
      continue;
    }
    const d = Math.hypot(pos.x - prev.x, pos.y - prev.y);
    perNode[id] = d;
    sum += d;
    max = Math.max(max, d);
    n++;
  }
  for (const id of sketch.keys()) {
    if (ignore?.has(id)) continue;
    if (!current.has(id)) unmatched.push(id);
  }
  return { mean: n > 0 ? sum / n : 0, max, perNode, unmatched };
}

/** Adapt a StructuralGeometry document to the metrics input, using
 *  TOP-LEVEL container boxes as nodes and routed polylines as edges
 *  (synthetic chain edges excluded; row boxes are interior detail the
 *  scene-level metrics should not double-count). */
export function metricsFromStructural(
  geometry: StructuralGeometry,
  topLevelIds: ReadonlySet<string>,
): LayoutMetricsInput {
  const nodes: MetricsNode[] = [];
  for (const [id, g] of Object.entries(geometry.nodes)) {
    if (!topLevelIds.has(id)) continue;
    nodes.push({ id, x: g.x, y: g.y, width: g.width, height: g.height });
  }
  const edges: MetricsEdge[] = [];
  for (const [id, e] of Object.entries(geometry.edges ?? {})) {
    if (isChainEdgeId(id)) continue;
    edges.push({ id, points: e.points });
  }
  return { nodes, edges };
}

/** Top-left positions of the given ids, as a Map, for sketch math. */
export function positionsFromStructural(
  geometry: StructuralGeometry,
  ids: ReadonlySet<string>,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const [id, g] of Object.entries(geometry.nodes)) {
    if (ids.has(id)) out.set(id, { x: g.x, y: g.y });
  }
  return out;
}
