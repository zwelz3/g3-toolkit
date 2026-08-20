/* eslint-disable @typescript-eslint/no-non-null-assertion --
 * Hot-loop file: we allocate typed arrays with known lengths and
 * then index them by counter i in [0, length). Every `!` is against
 * an index we just constructed inside the same function; the
 * per-line disables would dominate the file. */
/**
 * Force-directed edge bundling (Holten & van Wijk 2009).
 *
 * Dense-scene legibility for the "hairball" middle ground where
 * hundreds to low-thousands of visible edges obscure structure.
 * Pairs naturally with collapseByCluster (scale/collapse-by-cluster.ts)
 * for the aggregated links between supernodes.
 *
 * Contract (brief 16):
 *   - Pure geometry: `bundleEdges(positions, edges, opts) => routes`,
 *     zero React, zero Cytoscape, zero rendering dependencies.
 *   - Deterministic: no RNG, fixed subdivision + iteration schedule.
 *     Same input yields byte-identical polylines.
 *   - Bounded: `opts.maxEdges` (default 2000) short-circuits to
 *     `{ skipped: true }` for oversized inputs, since compatibility
 *     is O(E^2).
 *   - Endpoint-preserving: `route[0]` and `route[last]` are the
 *     input endpoint positions (per-node identity, exact numbers).
 *   - Compatibility precomputed ONCE across all cycles.
 *
 * References:
 *   Holten, D., & van Wijk, J. J. (2009). Force-Directed Edge
 *   Bundling for Graph Visualization. Computer Graphics Forum, 28(3).
 */

export interface XY {
  x: number;
  y: number;
}

export interface BundlingEdge {
  id: string;
  source: string;
  target: string;
}

export interface BundleEdgesOptions {
  /**
   * Above this edge count, bundling is skipped and the input is
   * returned unbundled. Guards the O(E^2) compatibility matrix.
   * Default: 2000.
   */
  maxEdges?: number;
  /** Number of subdivision cycles. Default: 6. */
  cycles?: number;
  /** Iterations in cycle 0 (halved each subsequent cycle). Default: 50. */
  iterations?: number;
  /** Initial step size (halved each cycle). Default: 0.4. */
  stepSize?: number;
  /** Global spring stiffness. Default: 0.1. */
  stiffness?: number;
  /**
   * Edges below this compatibility (0..1) exert no force on each
   * other. Default: 0.6 (Holten's suggestion).
   */
  compatibilityThreshold?: number;
}

export interface BundleEdgesResult {
  /**
   * Bundled polyline per input edge (id-keyed). Each polyline starts
   * at the source position and ends at the target position; interior
   * points are the subdivided, bundled control points.
   *
   * Self-loops (source === target) are returned as the pair
   * [source, target] with no interior bend — the algorithm makes no
   * sense for degenerate 1-point edges.
   */
  routes: Map<string, XY[]>;
  /**
   * True when the input exceeded `maxEdges` and no bundling ran.
   * `routes` then contains the straight [source, target] polyline
   * per edge (caller can render exactly what it would have without
   * this module).
   */
  skipped: boolean;
}

const EPS = 1e-9;

/** Squared Euclidean distance. */
function dist2(a: XY, b: XY): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Euclidean distance. */
function dist(a: XY, b: XY): number {
  return Math.sqrt(dist2(a, b));
}

/** Midpoint of two points. */
function mid(a: XY, b: XY): XY {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Uniformly subdivide a polyline into `n` interior points plus the
 * two endpoints, i.e. returns n+2 points. Interior points are placed
 * at fractions 1/(n+1) .. n/(n+1) of the polyline's arc length so
 * subdivision does not drift toward long segments.
 */
function subdivide(points: readonly XY[], n: number): XY[] {
  if (points.length < 2) return points.slice();
  if (n === 0) return [points[0]!, points[points.length - 1]!];
  // Cumulative arc length per input vertex.
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1]! + dist(points[i - 1]!, points[i]!));
  }
  const total = cum[cum.length - 1]!;
  const out: XY[] = [points[0]!];
  if (total < EPS) {
    // Degenerate polyline: all coincident. Emit copies at the same point.
    for (let k = 0; k < n; k++) out.push({ ...points[0]! });
    out.push(points[points.length - 1]!);
    return out;
  }
  const step = total / (n + 1);
  let seg = 1;
  for (let k = 1; k <= n; k++) {
    const target = k * step;
    while (seg < cum.length && cum[seg]! < target) seg++;
    if (seg >= cum.length) {
      out.push({ ...points[points.length - 1]! });
      continue;
    }
    const a = points[seg - 1]!;
    const b = points[seg]!;
    const segLen = cum[seg]! - cum[seg - 1]!;
    const t = segLen < EPS ? 0 : (target - cum[seg - 1]!) / segLen;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * Angle compatibility Ca(P,Q) = |cos(theta)|, where theta is the
 * angle between the two edge direction vectors. Parallel edges score
 * 1, perpendicular edges score 0.
 */
function angleCompat(p1: XY, p2: XY, q1: XY, q2: XY): number {
  const px = p2.x - p1.x;
  const py = p2.y - p1.y;
  const qx = q2.x - q1.x;
  const qy = q2.y - q1.y;
  const pl = Math.hypot(px, py);
  const ql = Math.hypot(qx, qy);
  if (pl < EPS || ql < EPS) return 0;
  return Math.abs((px * qx + py * qy) / (pl * ql));
}

/**
 * Scale compatibility Cs(P,Q) = 2 / (lavg * min(lp,lq) + max(lp,lq) / lavg).
 * Rewards edges of similar length; drops sharply as one dwarfs the
 * other.
 */
function scaleCompat(lp: number, lq: number): number {
  const lavg = (lp + lq) / 2;
  if (lavg < EPS) return 0;
  const lmin = Math.min(lp, lq);
  const lmax = Math.max(lp, lq);
  if (lmin < EPS) return 0;
  // Cs = 2 / (Lavg/min + max/Lavg). Equals 1 when lp = lq.
  const denom = lavg / lmin + lmax / lavg;
  if (denom < EPS) return 0;
  return 2 / denom;
}

/**
 * Position compatibility Cp(P,Q) = lavg / (lavg + dist(midP, midQ)).
 * Rewards edges whose midpoints are close relative to their average
 * length.
 */
function positionCompat(mp: XY, mq: XY, lavg: number): number {
  if (lavg < EPS) return 0;
  return lavg / (lavg + dist(mp, mq));
}

/**
 * Visibility approximated by projecting each edge's endpoints onto
 * the other's line and taking the intersection with the other's
 * endpoints as a fractional overlap. The standard paper computes
 * per-point mutual visibility; this cheaper approximation is what
 * the brief allows.
 */
function visibilityCompat(p1: XY, p2: XY, q1: XY, q2: XY): number {
  const v = visibilityOneWay(p1, p2, q1, q2);
  const u = visibilityOneWay(q1, q2, p1, p2);
  return Math.min(v, u);
}

function visibilityOneWay(p1: XY, p2: XY, q1: XY, q2: XY): number {
  // Project q1 and q2 onto the line through p1-p2 in parameter t
  // (t=0 at p1, t=1 at p2). Overlap in [0,1] measures how much of
  // p sees q.
  const px = p2.x - p1.x;
  const py = p2.y - p1.y;
  const len2 = px * px + py * py;
  if (len2 < EPS) return 0;
  const t1 = ((q1.x - p1.x) * px + (q1.y - p1.y) * py) / len2;
  const t2 = ((q2.x - p1.x) * px + (q2.y - p1.y) * py) / len2;
  const lo = Math.max(0, Math.min(t1, t2));
  const hi = Math.min(1, Math.max(t1, t2));
  const overlap = Math.max(0, hi - lo);
  // Perpendicular distances of the two projected midpoints to p.
  const im = {
    x: p1.x + ((t1 + t2) / 2) * px,
    y: p1.y + ((t1 + t2) / 2) * py,
  };
  const mq = mid(q1, q2);
  const perp = dist(im, mq);
  const pl = Math.sqrt(len2);
  // Standard visibility: overlap fraction * (1 - 2*perp/lp) clamped.
  const v = overlap * Math.max(0, 1 - (2 * perp) / pl);
  return v;
}

export function bundleEdges(
  positions: Record<string, XY> | ReadonlyMap<string, XY>,
  edges: readonly BundlingEdge[],
  opts: BundleEdgesOptions = {},
): BundleEdgesResult {
  const {
    maxEdges = 2000,
    cycles = 6,
    iterations: I0 = 50,
    stepSize: S0 = 0.4,
    stiffness = 0.1,
    compatibilityThreshold = 0.6,
  } = opts;

  const posOf = (id: string): XY | undefined =>
    positions instanceof Map
      ? positions.get(id)
      : (positions as Record<string, XY>)[id];

  const routes = new Map<string, XY[]>();

  // Resolve endpoints. Edges missing either endpoint (dangling refs)
  // are dropped from the result: the caller supplied an inconsistent
  // input and the alternative — emitting NaN routes — would silently
  // corrupt downstream rendering.
  interface Resolved {
    id: string;
    s: XY;
    t: XY;
    length: number;
    mid: XY;
    /** True when source and target are (near-)coincident: no bundling. */
    degenerate: boolean;
  }
  const resolved: Resolved[] = [];
  for (const e of edges) {
    const s = posOf(e.source);
    const t = posOf(e.target);
    if (!s || !t) continue;
    const length = dist(s, t);
    resolved.push({
      id: e.id,
      s,
      t,
      length,
      mid: mid(s, t),
      degenerate: length < EPS,
    });
  }

  // Bypass path: too many edges, or nothing to bundle.
  if (resolved.length > maxEdges) {
    for (const r of resolved) routes.set(r.id, [r.s, r.t]);
    return { routes, skipped: true };
  }
  if (resolved.length === 0) {
    return { routes, skipped: false };
  }

  // ── Compatibility matrix (upper triangle; O(E^2) computed ONCE) ──
  // Edges below the threshold to each other exert no force; the
  // sparse pair list is walked every iteration but each pair costs
  // O(subdivisions) to update, so the up-front cost is worth it.
  const n = resolved.length;
  const compatPairs: Array<{ i: number; j: number; w: number }> = [];
  for (let i = 0; i < n; i++) {
    const a = resolved[i]!;
    if (a.degenerate) continue;
    for (let j = i + 1; j < n; j++) {
      const b = resolved[j]!;
      if (b.degenerate) continue;
      const ca = angleCompat(a.s, a.t, b.s, b.t);
      if (ca < EPS) continue;
      const cs = scaleCompat(a.length, b.length);
      if (cs < EPS) continue;
      const lavg = (a.length + b.length) / 2;
      const cp = positionCompat(a.mid, b.mid, lavg);
      if (cp < EPS) continue;
      const cv = visibilityCompat(a.s, a.t, b.s, b.t);
      const w = ca * cs * cp * cv;
      if (w >= compatibilityThreshold) {
        compatPairs.push({ i, j, w });
      }
    }
  }

  // ── Working polylines (initial 2-point straight lines). ──
  // Degenerate (zero-length) edges keep their trivial [s, t] and are
  // not subdivided; they cannot exchange force with anything.
  const poly: XY[][] = resolved.map((r) => [{ ...r.s }, { ...r.t }]);

  // ── Force-directed cycles ──
  //
  // Paper schedule (halving variant per brief): each cycle DOUBLES
  // subdivisions and HALVES iterations & step size. Starting P0=1
  // interior point, cycle 0 has 1 interior, cycle 1 has 2, ...
  //
  // Endpoints (index 0 and index last) are NEVER moved: they belong
  // to the source/target nodes and moving them would visibly detach
  // the edge from its endpoint. Test pins this.
  let P = 1;
  let iterations = I0;
  let step = S0;

  for (let cycle = 0; cycle < cycles; cycle++) {
    // Subdivide each non-degenerate polyline to (P + 2) points.
    for (let e = 0; e < n; e++) {
      if (resolved[e]!.degenerate) continue;
      poly[e] = subdivide(poly[e]!, P);
    }
    // Effective spring constant per Holten: k_p = K / (edgeLength * P).
    // Guards a fixed absolute spring stiffness against being dominated
    // by more interior points.
    const kByEdge = resolved.map((r) =>
      r.degenerate ? 0 : stiffness / (r.length * (P + 1)),
    );

    for (let iter = 0; iter < iterations; iter++) {
      // Force accumulator per edge per interior point (endpoints skipped).
      const forces: XY[][] = poly.map((pts) => pts.map(() => ({ x: 0, y: 0 })));

      // Spring forces (each interior point pulled by its two neighbors).
      for (let e = 0; e < n; e++) {
        if (resolved[e]!.degenerate) continue;
        const pts = poly[e]!;
        const k = kByEdge[e]!;
        for (let p = 1; p < pts.length - 1; p++) {
          const prev = pts[p - 1]!;
          const cur = pts[p]!;
          const next = pts[p + 1]!;
          const f = forces[e]![p]!;
          f.x += k * (prev.x - cur.x) + k * (next.x - cur.x);
          f.y += k * (prev.y - cur.y) + k * (next.y - cur.y);
        }
      }

      // Electrostatic (bundling) forces between compatible edge pairs.
      // Point p on edge i attracts point p on edge j (same index):
      // this is the Holten construction — same-index subdivision
      // points across two edges pull toward each other, weighted by
      // compatibility and inverse distance.
      for (const pair of compatPairs) {
        const pi = poly[pair.i]!;
        const pj = poly[pair.j]!;
        const fi = forces[pair.i]!;
        const fj = forces[pair.j]!;
        // Same interior-point count by construction (both went
        // through the same subdivide(_, P)); iterate interior only.
        for (let p = 1; p < pi.length - 1; p++) {
          const a = pi[p]!;
          const b = pj[p]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < EPS) continue;
          // Force magnitude: compatibility / distance (Holten uses
          // 1/d; some references use 1/(d*d). 1/d gives stronger
          // long-range attraction which is what bundling wants).
          const mag = pair.w / d;
          fi[p]!.x += dx * mag;
          fi[p]!.y += dy * mag;
          fj[p]!.x -= dx * mag;
          fj[p]!.y -= dy * mag;
        }
      }

      // Apply forces (interior points only, step-limited).
      for (let e = 0; e < n; e++) {
        if (resolved[e]!.degenerate) continue;
        const pts = poly[e]!;
        const f = forces[e]!;
        for (let p = 1; p < pts.length - 1; p++) {
          pts[p]!.x += step * f[p]!.x;
          pts[p]!.y += step * f[p]!.y;
        }
      }
    }

    P *= 2;
    iterations = Math.max(1, Math.floor(iterations / 2));
    step /= 2;
  }

  // Assemble the result. Endpoints are re-pinned from the input
  // positions (not the polyline's first/last) so ANY numerical drift
  // inside the loop cannot appear at the endpoint — the test asserts
  // referential equality here.
  for (let e = 0; e < n; e++) {
    const r = resolved[e]!;
    if (r.degenerate) {
      routes.set(r.id, [r.s, r.t]);
      continue;
    }
    const pts = poly[e]!;
    const out: XY[] = new Array(pts.length);
    out[0] = r.s;
    out[out.length - 1] = r.t;
    for (let p = 1; p < pts.length - 1; p++) out[p] = pts[p]!;
    routes.set(r.id, out);
  }

  return { routes, skipped: false };
}

/**
 * Project a bundled polyline onto Cytoscape `segments` control values
 * (segment-distances / segment-weights), so the same routed-edge
 * class the structural converter uses can render it. Endpoints are
 * dropped (Cytoscape reconstructs them from the source/target node
 * positions); only interior bends are emitted.
 *
 * Returns null when the polyline has no interior bend (a straight
 * source->target route). Basis is the source->target line in screen
 * coordinates (y down); a positive distance offsets to the right-hand
 * normal, matching routeToSegments in the structural converter.
 */
export function bundledPolylineToSegments(
  points: readonly XY[],
): { distances: number[]; weights: number[] } | null {
  if (points.length < 3) return null;
  const s = points[0]!;
  const t = points[points.length - 1]!;
  const ax = t.x - s.x;
  const ay = t.y - s.y;
  const len2 = ax * ax + ay * ay;
  if (len2 < EPS) return null;
  const len = Math.sqrt(len2);
  const ux = ax / len;
  const uy = ay / len;
  const nx = -uy;
  const ny = ux;
  const distances: number[] = [];
  const weights: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i]!;
    const vx = pt.x - s.x;
    const vy = pt.y - s.y;
    weights.push((vx * ux + vy * uy) / len);
    distances.push(vx * nx + vy * ny);
  }
  return { distances, weights };
}
