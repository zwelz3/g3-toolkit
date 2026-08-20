/**
 * PRF-003 (brief 05a, owner Jake, 2026-08-14): channel router
 * (additive slice).
 *
 * Corridor/channel model: in a layered layout the inter-layer gaps
 * sized by brief 04 are first-class channels. An edge's path is a
 * sequence of channel traversals plus node-side stubs; ordering
 * inside a channel is combinatorial at construction time (libavoid
 * divergence sort) so crossings inside a channel are minimized by
 * ordering, not discovered by collision.
 *
 * SCOPE (05a): pure additive module. Reachable through
 * `routeStructuralEdges` behind the OFF-BY-DEFAULT `useChannelRouter`
 * flag and only when the caller supplies a `channelPlan`. 05b flips
 * the flag on inside `g3tLayoutStructural`, deletes the escalation
 * ladder, and re-pins the six-scenario LAY005_BASELINE. The
 * `useChannelRouter` flag is transient scaffolding that goes away
 * with 05b; it is NOT a permanent dual-path (no-legacy applies).
 */
import type { RouteBox } from "../../route/orthogonal-router";
import { routeOrthogonal, type RouteSide } from "../../route/orthogonal-router";
import { dedupeCollinear, type Pt } from "./g3t-polyline-utils";

/** One inter-layer channel. `axis` is the channel's TRAVEL axis (the
 *  axis edges cross it along): "v" for a horizontal-flow layout (the
 *  channel sits between layer i and layer i+1 along x; edges cross
 *  it moving in x while jogging in y), "h" for vertical-flow. Track
 *  offsets are applied along the CROSS axis to `midline`. */
export interface Channel {
  /** Boundary index (between layer i and layer i+1). */
  boundary: number;
  /** Travel axis for tracks inside this channel. "v" = tracks are
   *  offset along y (horizontal-flow layout); "h" = tracks along x. */
  axis: "v" | "h";
  /** Channel midline coordinate on the CROSS axis (y for "v", x for
   *  "h"). */
  midline: number;
  /** Layout's supply for this channel: the maximum number of tracks
   *  the channel width can host (from brief 04's
   *  `computeCorridorGap`). Track assignments overflowing this bound
   *  are routed via `routeOrthogonal` instead. */
  demand: number;
  /** Inter-track spacing, px. Matches `nudgeRoutes` default 8. */
  trackGap: number;
}

/** Layered-scene channel plan the router consumes. */
export interface ChannelPlan {
  /** Channels indexed by boundary (0 = between layers 0 and 1). */
  channels: readonly Channel[];
  /** Layer index per node id. Edges are ordered by SOURCE layer;
   *  edges spanning k boundaries traverse channels
   *  [min(sL,tL), max(sL,tL)). */
  layerOf: ReadonlyMap<string, number>;
  /** Flow direction of the layered scene. RIGHT/LEFT stack layers
   *  along x with channels sitting between them (axis "v"); DOWN/UP
   *  stack along y (axis "h"). */
  direction: "RIGHT" | "LEFT" | "DOWN" | "UP";
}

/** Edge in the channel model (id + endpoints + optional entry/exit
 *  cross-coord hints from anchor selection). */
export interface ChannelEdge {
  id: string;
  source: string;
  target: string;
  /** Cross-coord where the edge enters each channel it traverses.
   *  When omitted, defaults to source node's cross center (caller
   *  supplies once anchors resolve). */
  entryCross?: number;
  /** Cross-coord where the edge exits (target-side). Defaults to
   *  target node's cross center. */
  exitCross?: number;
}

/** Per-channel track assignment: edge id -> integer track index
 *  (0..demand-1 inside the channel). Edges whose assignment would
 *  exceed the channel's demand land in `overflow` and are routed via
 *  `routeOrthogonal` by the emitter. */
export interface TrackAssignment {
  /** channelBoundary -> Map<edgeId, trackIndex>. */
  tracks: Map<number, Map<string, number>>;
  /** Edge ids the plan could not host inside the channel budget. */
  overflow: Set<string>;
}

/** Libavoid divergence sort key: (entry cross, exit cross, edge id).
 *  Fully-tied entry+exit is crossing-equivalent under any stable
 *  sort; id gives determinism. */
function divergenceCompare(
  a: ChannelEdge,
  b: ChannelEdge,
  entry: (e: ChannelEdge) => number,
  exit: (e: ChannelEdge) => number,
): number {
  const ea = entry(a);
  const eb = entry(b);
  if (ea !== eb) return ea - eb;
  const xa = exit(a);
  const xb = exit(b);
  if (xa !== xb) return xa - xb;
  return a.id < b.id ? -1 : 1;
}

/**
 * Assign integer track indices to edges inside each channel they
 * traverse. Ordering is the libavoid divergence sort (entry, exit,
 * id); track count in a channel is bounded by that channel's
 * `demand`. Edges whose assigned index would land at or beyond
 * `demand` join the overflow set; the emitter falls back to
 * `routeOrthogonal` for those.
 *
 * Pure: builds and returns fresh maps.
 */
export function assignTracks(
  edges: readonly ChannelEdge[],
  plan: ChannelPlan,
): TrackAssignment {
  const tracks = new Map<number, Map<string, number>>();
  const overflow = new Set<string>();
  const byBoundary = new Map<number, ChannelEdge[]>();
  for (const e of edges) {
    const sL = plan.layerOf.get(e.source);
    const tL = plan.layerOf.get(e.target);
    if (sL === undefined || tL === undefined) continue;
    const lo = Math.min(sL, tL);
    const hi = Math.max(sL, tL);
    if (lo === hi) continue; // same-layer: caller routes as fallback
    for (let b = lo; b < hi; b++) {
      const list = byBoundary.get(b) ?? [];
      list.push(e);
      byBoundary.set(b, list);
    }
  }
  const channelByBoundary = new Map(plan.channels.map((c) => [c.boundary, c]));
  for (const [boundary, list] of byBoundary) {
    const channel = channelByBoundary.get(boundary);
    if (channel === undefined) {
      // No channel plan for this boundary: every edge overflows.
      for (const e of list) overflow.add(e.id);
      continue;
    }
    const crossOf = (e: ChannelEdge, end: "entry" | "exit"): number => {
      const v = end === "entry" ? e.entryCross : e.exitCross;
      return v ?? 0;
    };
    const sorted = [...list].sort((a, b) =>
      divergenceCompare(
        a,
        b,
        (e) => crossOf(e, "entry"),
        (e) => crossOf(e, "exit"),
      ),
    );
    const assigned = new Map<string, number>();
    sorted.forEach((e, i) => {
      if (i < channel.demand) assigned.set(e.id, i);
      else overflow.add(e.id);
    });
    tracks.set(boundary, assigned);
  }
  return { tracks, overflow };
}

/**
 * Emit a track-anchored polyline for a single edge that crosses one
 * or more channels. The route leaves the source anchor along the
 * source stub, enters each channel at `midline + offset`, jogs at the
 * channel offset, exits, and finally enters the target anchor.
 *
 * Track separation is expressed as GENUINE ORTHOGONAL BENDS (nonzero
 * offset from the channel midline): `dedupeCollinear` never collapses
 * a properly separated track. Two edges assigned the same integer
 * track in the same channel are a bug in `assignTracks`, not
 * something the emitter tolerates.
 *
 * Caller MUST supply the source/target anchors; the channel plan
 * decides only the interior geometry.
 */
export function emitChannelRoute(
  edge: ChannelEdge,
  anchors: {
    source: { point: Pt; side: RouteSide };
    sourceTip: Pt;
    target: { point: Pt; side: RouteSide };
    targetTip: Pt;
  },
  plan: ChannelPlan,
  assignment: TrackAssignment,
): Pt[] {
  const sL = plan.layerOf.get(edge.source);
  const tL = plan.layerOf.get(edge.target);
  if (sL === undefined || tL === undefined) {
    // No layer info: caller should have classified as fallback.
    return dedupeCollinear([
      anchors.source.point,
      anchors.sourceTip,
      anchors.targetTip,
      anchors.target.point,
    ]);
  }
  const ascending = sL < tL;
  const lo = Math.min(sL, tL);
  const hi = Math.max(sL, tL);
  const boundaries: number[] = [];
  for (let b = lo; b < hi; b++) boundaries.push(b);
  const traversed = ascending ? boundaries : [...boundaries].reverse();
  const channelByBoundary = new Map(plan.channels.map((c) => [c.boundary, c]));

  // Offset for a channel: t=0 sits on the midline, t=1 one trackGap
  // off, alternating sides so a saturated channel spreads symmetric
  // around the midline. Alternation is a pure function of the integer
  // track and stays deterministic.
  const offsetFor = (t: number, gap: number): number => {
    // 0 -> 0, 1 -> +gap, 2 -> -gap, 3 -> +2*gap, 4 -> -2*gap ...
    if (t === 0) return 0;
    const magnitude = Math.ceil(t / 2) * gap;
    return t % 2 === 1 ? magnitude : -magnitude;
  };

  const horizontal = plan.direction === "RIGHT" || plan.direction === "LEFT";
  const points: Pt[] = [anchors.source.point, anchors.sourceTip];
  let prev: Pt = anchors.sourceTip;
  for (const b of traversed) {
    const channel = channelByBoundary.get(b);
    if (channel === undefined) continue;
    const t = assignment.tracks.get(b)?.get(edge.id);
    if (t === undefined) continue; // overflow: caller handles
    const off = offsetFor(t, channel.trackGap);
    if (horizontal) {
      // channel travel is along x; jog is at y = midline+off.
      const y = channel.midline + off;
      // A non-zero offset must produce a real bend: enter the channel
      // at (prev.x, y), then exit at some x we choose. If the offset
      // is zero we still emit the jog as (prev.x, y)-(nextX, y) to
      // keep the shape uniform; dedupeCollinear will collapse it only
      // when it is genuinely collinear with the neighbors.
      const nextX = anchors.targetTip.x; // final x is the tip; jogs cascade through the same y band
      points.push({ x: prev.x, y });
      points.push({ x: nextX, y });
      prev = { x: nextX, y };
    } else {
      const x = channel.midline + off;
      const nextY = anchors.targetTip.y;
      points.push({ x, y: prev.y });
      points.push({ x, y: nextY });
      prev = { x, y: nextY };
    }
  }
  points.push(anchors.targetTip);
  points.push(anchors.target.point);
  return dedupeCollinear(points);
}

/**
 * Overflow router: for an edge whose channel assignment landed in
 * `assignment.overflow`, delegate to `routeOrthogonal`. Kept as its
 * own helper so the caller can slot the overflow path in wherever the
 * flag-on branch renders. Returns `null` on router failure; callers
 * fall back to the simple template (matches the ladder's honesty).
 */
export function routeChannelOverflow(
  anchors: {
    source: { point: Pt; side: RouteSide };
    sourceTip: Pt;
    target: { point: Pt; side: RouteSide };
    targetTip: Pt;
  },
  obstacles: readonly RouteBox[],
): Pt[] | null {
  const routed = routeOrthogonal({
    source: { point: anchors.sourceTip, side: anchors.source.side },
    target: { point: anchors.targetTip, side: anchors.target.side },
    obstacles,
  });
  if (routed === null) return null;
  return dedupeCollinear([
    anchors.source.point,
    ...routed.points,
    anchors.target.point,
  ]);
}
