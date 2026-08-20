/**
 * Route nudging post-pass (parallel-run separation).
 *
 * Consumes the polylines emitted by `routeStructuralEdges` (any
 * variant: simple template, grid escalation, detour) and separates
 * parallel interior segments that would otherwise land in the same
 * corridor pixels. Producer-agnostic: runs on the final route map.
 *
 * Algorithm (see roadmap brief 04 for the corridor-supply contract
 * this pass feeds): normalize, decompose into axis-aligned segments,
 * group parallel segments into corridors, order by corridor-local
 * divergence, place tracks with a min-displacement two-sweep at
 * `trackGap` spacing, degrade evenly when the corridor is narrower
 * than requested, revert per-group on validation failure. All groups
 * plan against ONE immutable input snapshot then commit atomically.
 *
 * The pass measures corridor demand (max tracks per corridor) and
 * exposes it as `corridorDemand` so a later phase (dummy chains,
 * channel router) can reserve layout space in the corridors that
 * ran out of room.
 */
import type { RouteBox } from "../../route/orthogonal-router";
import { polylineIntersectsBoxes } from "../../route/orthogonal-router";
import { dedupeCollinear, type Pt } from "./g3t-polyline-utils";

export interface NudgingOptions {
  /** Target inter-track separation, px. Default 8. */
  trackGap?: number;
  /** Minimum clearance from an obstacle box face, px. Default 8. */
  clearance?: number;
  /** Capture-band multiplier: two segments group when their perpendicular
   *  coordinates are within `trackGap * captureBandFactor`. Default 2. */
  captureBandFactor?: number;
  /** Layout bounding box; used to clamp open-corridor spread. When
   *  absent the pass derives it from the obstacle box union plus
   *  one trackGap margin. */
  layoutBounds?: { x: number; y: number; width: number; height: number };
}

export interface CorridorDemandBase {
  axis: "h" | "v";
  corridorKey: string;
  midline: number;
  extent: [number, number];
  edgeIds: string[];
  tracksRequired: number;
  spanAvailable: number;
  spanRequired: number;
  deficit: number;
}
export type CorridorDemand =
  | (CorridorDemandBase & {
      blocked: true;
      blockedReason: "occluded" | "reverted";
    })
  | (CorridorDemandBase & { blocked: false; blockedReason?: never });

export interface NudgeResult {
  routes: Record<string, { points: Pt[] }>;
  corridorDemand: CorridorDemand[];
}

interface MovableSeg {
  edgeId: string;
  segIndex: number;
  axis: "h" | "v";
  perp: number;
  extent: [number, number];
  /** "bar": interior segment, separated by translate.
   *  "arm": first or last segment with one endpoint pinned to a terminal
   *  anchor. Separated by inserting a jog so the interior of the run
   *  moves onto a distinct track while the anchor stays byte-identical. */
  kind: "bar" | "arm";
  /** For kind="arm", the polyline index of the anchored endpoint (0 for
   *  first-segment arms, pts.length-1 for last-segment arms). -1 for bars. */
  anchoredIdx: number;
}

interface LayoutBound {
  xLo: number;
  xHi: number;
  yLo: number;
  yHi: number;
}

/**
 * Nudge a route map so parallel interior segments spread across
 * distinct tracks. Idempotent: a route with no group members is
 * emitted as `dedupeCollinear(input)` and never modified further.
 *
 * Runs the separation pass TWICE (owner ruling 2026-08-20b). The first
 * pass spreads the coincident jog BARS of a K(n,n) storm apart. That
 * spread lengthens the horizontal ARMS that fed those bars, and two
 * arms of a crossing edge-pair (wi_j / wj_i) that used to meet exactly
 * at the shared midline now overlap along a shared y — a new collinear
 * overlap that did not exist in the pass-1 input, so pass 1's grouping
 * (which decomposes the PRE-spread geometry) cannot see it. A second
 * pass decomposes the committed pass-1 geometry, sees the now-overlapping
 * arms, and separates them. The drift assertion consumes pass 1's
 * corridorDemand unchanged, so the measurement contract is preserved.
 * Converges: pass-1 already separates bars beyond trackGap, so pass 2's
 * crowded-run cut leaves them untouched and only acts on the residual
 * arm overlaps.
 */
export function nudgeRoutes(
  input: Record<string, { points: Pt[] }>,
  obstacles: readonly RouteBox[],
  options?: NudgingOptions,
): NudgeResult {
  // Arms coincident in the RAW input are a pre-existing pattern the router
  // chose; the nudge must not disturb them (the "only move what is actually
  // crowded" invariant). Only arm overlaps CREATED by the pass-1 bar-spread
  // are the pass-2 target. Capture the pre-existing set so pass 2 can tell
  // the two apart.
  const preExisting = computeRawArmOverlaps(input);
  const first = nudgePass(input, obstacles, options, false, null);
  // Pass 2 is ARMS-ONLY: it exists solely to catch arm overlaps that the
  // pass-1 bar-spread created, and must not re-plan bars (that would
  // re-move runs pass 1 deliberately left alone — the "nudge moved an
  // edge for no reason" regression the unit tests pin).
  const second = nudgePass(first.routes, obstacles, options, true, preExisting);
  return { routes: second.routes, corridorDemand: first.corridorDemand };
}

/** Stable unordered key for an arm pair, keyed by edge id + rounded perp.
 *  An arm's perp is its anchored coordinate and does not change between the
 *  raw input and the pass-1 output, so the key is comparable across passes. */
function armPairKey(a: string, pa: number, b: string, pb: number): string {
  const ka = `${a}|${Math.round(pa)}`;
  const kb = `${b}|${Math.round(pb)}`;
  return ka < kb ? `${ka}::${kb}` : `${kb}::${ka}`;
}

/** Arm pairs (first/last segments) that already share a perp AND overlap
 *  along-axis in the RAW route map. These pre-date any nudging, so pass 2
 *  leaves them exactly where the router put them. */
function computeRawArmOverlaps(
  input: Record<string, { points: Pt[] }>,
): Set<string> {
  interface RawArm {
    edgeId: string;
    axis: "h" | "v";
    perp: number;
    e0: number;
    e1: number;
  }
  const arms: RawArm[] = [];
  for (const [edgeId, route] of Object.entries(input)) {
    const pts = dedupeCollinear(route.points.map((p) => ({ ...p })));
    if (pts.length < 3) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a === undefined || b === undefined) continue;
      if (i !== 0 && i !== pts.length - 2) continue; // arms only
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      if (dx < 1e-6 && dy < 1e-6) continue;
      if (dx > 1e-6 && dy > 1e-6) continue;
      const axis: "h" | "v" = dx >= dy ? "h" : "v";
      const along1 = axis === "h" ? a.x : a.y;
      const along2 = axis === "h" ? b.x : b.y;
      arms.push({
        edgeId,
        axis,
        perp: axis === "h" ? a.y : a.x,
        e0: Math.min(along1, along2),
        e1: Math.max(along1, along2),
      });
    }
  }
  const set = new Set<string>();
  for (let i = 0; i < arms.length; i++) {
    for (let j = i + 1; j < arms.length; j++) {
      const a = arms[i];
      const b = arms[j];
      if (a === undefined || b === undefined) continue;
      if (a.axis !== b.axis) continue;
      if (Math.abs(a.perp - b.perp) > 0.5) continue;
      if (Math.min(a.e1, b.e1) - Math.max(a.e0, b.e0) > 1e-6)
        set.add(armPairKey(a.edgeId, a.perp, b.edgeId, b.perp));
    }
  }
  return set;
}

/** One separation pass: decompose → group → plan → atomic commit.
 *  When `armsOnly`, bar (interior) segments are excluded from the movable
 *  pool so only terminal arms are considered for separation. `preExisting`
 *  (pass 2 only) names arm pairs that already overlapped before nudging;
 *  their guard is kept so the pass never disturbs a pre-existing pattern. */
function nudgePass(
  input: Record<string, { points: Pt[] }>,
  obstacles: readonly RouteBox[],
  options: NudgingOptions | undefined,
  armsOnly: boolean,
  preExisting: Set<string> | null,
): NudgeResult {
  const trackGap = options?.trackGap ?? 8;
  const clearance = options?.clearance ?? 8;
  const bandFactor = options?.captureBandFactor ?? 2;
  const captureBand = trackGap * bandFactor;

  // Step 0: normalize. Idempotent, does not mutate.
  const normalized: Record<string, Pt[]> = {};
  for (const [id, route] of Object.entries(input)) {
    normalized[id] = dedupeCollinear(route.points.map((p) => ({ ...p })));
  }

  const layoutBound = deriveLayoutBound(
    obstacles,
    options?.layoutBounds,
    trackGap,
  );

  // Step 1: decompose into axis-aligned segments.
  //
  // Arms (first and last segments of a polyline) have one pinned end at
  // the terminal anchor. They cannot be translated, but their interior
  // run can be jogged onto a distinct track via inserted bends while the
  // anchor stays byte-identical. Bars (all interior segments) translate.
  // Short arms (along-extent < 2*trackGap) cannot fit a clean jog and are
  // excluded from the movable pool so they remain exactly where the
  // router put them; they still act as obstacles for other routes via
  // the shared `obstacles` box list.
  const segments: MovableSeg[] = [];
  for (const [edgeId, pts] of Object.entries(normalized)) {
    if (pts.length < 3) continue; // 2-point straight: never nudged
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a === undefined || b === undefined) continue;
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      if (dx < 1e-6 && dy < 1e-6) continue;
      if (dx > 1e-6 && dy > 1e-6) continue;
      const axis: "h" | "v" = dx >= dy ? "h" : "v";
      const perp = axis === "h" ? a.y : a.x;
      const along1 = axis === "h" ? a.x : a.y;
      const along2 = axis === "h" ? b.x : b.y;
      const extent: [number, number] = [
        Math.min(along1, along2),
        Math.max(along1, along2),
      ];
      const isArm = i === 0 || i === pts.length - 2;
      if (isArm) {
        const armAlongExtent = extent[1] - extent[0];
        // Short arm: cannot fit stub + rejoin without over-jogging past
        // the far bend. Leave it fixed; skip the movable pool.
        if (armAlongExtent < 2 * trackGap) continue;
        const anchoredIdx = i === 0 ? 0 : pts.length - 1;
        segments.push({
          edgeId,
          segIndex: i,
          axis,
          perp,
          extent,
          kind: "arm",
          anchoredIdx,
        });
      } else if (!armsOnly) {
        segments.push({
          edgeId,
          segIndex: i,
          axis,
          perp,
          extent,
          kind: "bar",
          anchoredIdx: -1,
        });
      }
    }
  }

  // Step 2: group by union-find with split rule.
  //
  // Arms and bars group freely with each other on the same axis: an arm
  // next to a bar in the same corridor is a real crowding pattern
  // (twoParallelHRoutes: two Zs' top arms coincide on y=100 as arm-arm;
  // their bars coincide at x=30 as bar-bar; each gets its own group).
  const movable = segments;
  const parent: number[] = movable.map((_, i) => i);
  const parentAt = (i: number): number => {
    const v = parent[i];
    return v === undefined ? i : v;
  };
  const find = (i: number): number => {
    let cur = i;
    while (parentAt(cur) !== cur) {
      const p = parentAt(cur);
      const g = parentAt(p);
      parent[cur] = g;
      cur = g;
    }
    return cur;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < movable.length; i++) {
    const a = movable[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < movable.length; j++) {
      const b = movable[j];
      if (b === undefined) continue;
      if (a.axis !== b.axis) continue;
      if (a.edgeId === b.edgeId && a.segIndex === b.segIndex) continue;
      if (Math.abs(a.perp - b.perp) > captureBand) continue;
      const oMin = Math.max(a.extent[0], b.extent[0]);
      const oMax = Math.min(a.extent[1], b.extent[1]);
      if (oMax <= oMin) continue;
      const pLo = Math.min(a.perp, b.perp);
      const pHi = Math.max(a.perp, b.perp);
      let split = false;
      for (const box of obstacles) {
        const bPerpLo = a.axis === "h" ? box.y : box.x;
        const bPerpHi = bPerpLo + (a.axis === "h" ? box.height : box.width);
        const bAlongLo = a.axis === "h" ? box.x : box.y;
        const bAlongHi = bAlongLo + (a.axis === "h" ? box.width : box.height);
        if (bPerpHi <= pLo || bPerpLo >= pHi) continue;
        if (bAlongHi <= oMin || bAlongLo >= oMax) continue;
        split = true;
        break;
      }
      if (split) continue;
      union(i, j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < movable.length; i++) {
    const r = find(i);
    const list = groups.get(r);
    if (list) list.push(i);
    else groups.set(r, [i]);
  }

  interface Placement {
    memberIdx: number;
    newPerp: number;
  }
  interface PlannedGroup {
    axis: "h" | "v";
    memberIdxs: number[];
    placements: Placement[];
    demand: CorridorDemand;
    attemptRewrite: boolean;
  }
  const planned: PlannedGroup[] = [];
  const usedKeys = new Set<string>();

  /**
   * Split a union-find group into the runs that actually need moving.
   *
   * Grouping is a TRANSITIVE closure over the capture band, so a chain
   * of segments each within `captureBand` of the next becomes one
   * group spanning far more than the band: A-B-C at 16px steps is a
   * single 32px group. Planning that whole chain as one evenly-spaced
   * run moves members that had no crowded neighbour on either side,
   * which is the "nudge moved an edge nowhere near another edge"
   * report. Capture is the right net to CATCH candidates with; it is
   * the wrong unit to PLAN with.
   *
   * Two segments only need separating when they are closer than one
   * track gap. So sort by perpendicular coordinate and cut wherever
   * consecutive members are already at least `trackGap` apart: what
   * survives is the maximal runs that genuinely overlap, and anything
   * already adequately spaced is left exactly where the router put it.
   */
  const crowdedRuns = (memberIdxs: number[]): number[][] => {
    const withPerp = memberIdxs
      .map((i) => ({ i, perp: movable[i]?.perp ?? 0 }))
      .sort((a, b) => a.perp - b.perp || a.i - b.i);
    const runs: number[][] = [];
    let run: { i: number; perp: number }[] = [];
    for (const m of withPerp) {
      const prev = run[run.length - 1];
      if (prev !== undefined && m.perp - prev.perp >= trackGap) {
        if (run.length >= 2) runs.push(run.map((r) => r.i));
        run = [];
      }
      run.push(m);
    }
    if (run.length >= 2) runs.push(run.map((r) => r.i));
    return runs;
  };

  // Deterministic iteration order for reproducible corridorKey suffixes.
  const groupList = Array.from(groups.values())
    .filter((m) => m.length >= 2)
    .flatMap(crowdedRuns)
    .filter((m) => m.length >= 2)
    .map((memberIdxs) => {
      const first = movable[memberIdxs[0] ?? -1];
      return { memberIdxs, first };
    })
    .filter(
      (g): g is { memberIdxs: number[]; first: MovableSeg } =>
        g.first !== undefined,
    );
  groupList.sort((ga, gb) => {
    if (ga.first.axis !== gb.first.axis)
      return ga.first.axis < gb.first.axis ? -1 : 1;
    if (Math.round(ga.first.perp) !== Math.round(gb.first.perp))
      return Math.round(ga.first.perp) - Math.round(gb.first.perp);
    return Math.round(ga.first.extent[0]) - Math.round(gb.first.extent[0]);
  });

  for (const { memberIdxs, first } of groupList) {
    const axis = first.axis;

    let extLo = Infinity;
    let extHi = -Infinity;
    let ownLo = Infinity;
    let ownHi = -Infinity;
    for (const i of memberIdxs) {
      const s = movable[i];
      if (s === undefined) continue;
      extLo = Math.min(extLo, s.extent[0]);
      extHi = Math.max(extHi, s.extent[1]);
      ownLo = Math.min(ownLo, s.perp);
      ownHi = Math.max(ownHi, s.perp);
    }

    let perpMin = -Infinity;
    let perpMax = Infinity;
    for (const box of obstacles) {
      const bAlongLo = axis === "h" ? box.x : box.y;
      const bAlongHi = bAlongLo + (axis === "h" ? box.width : box.height);
      if (bAlongHi <= extLo || bAlongLo >= extHi) continue;
      const bPerpLo = axis === "h" ? box.y : box.x;
      const bPerpHi = bPerpLo + (axis === "h" ? box.height : box.width);
      if (bPerpHi <= ownLo && bPerpHi > perpMin) perpMin = bPerpHi;
      if (bPerpLo >= ownHi && bPerpLo < perpMax) perpMax = bPerpLo;
    }
    const openLo = axis === "h" ? layoutBound.yLo : layoutBound.xLo;
    const openHi = axis === "h" ? layoutBound.yHi : layoutBound.xHi;
    if (perpMin === -Infinity)
      perpMin = Math.max(openLo, ownLo - memberIdxs.length * trackGap);
    if (perpMax === Infinity)
      perpMax = Math.min(openHi, ownHi + memberIdxs.length * trackGap);

    const faceLo = perpMin + clearance;
    const faceHi = perpMax - clearance;
    const spanAvailable = faceHi - faceLo;
    const midline = (faceLo + faceHi) / 2;
    const n = memberIdxs.length;
    const spanRequired = (n + 1) * trackGap;
    const deficit = Math.max(0, spanRequired - spanAvailable);

    const rawKey = `${axis}:${Math.round(midline)}:${Math.round(extLo)}..${Math.round(extHi)}`;
    let corridorKey = rawKey;
    let suffix = 0;
    while (usedKeys.has(corridorKey)) {
      corridorKey = `${rawKey}:${++suffix}`;
    }
    usedKeys.add(corridorKey);

    const ordered = orderByDivergence(memberIdxs, movable, normalized, axis);

    let placements: Placement[] = [];
    let attemptRewrite = true;
    let blocked = false;
    if (spanAvailable <= 0) {
      blocked = true;
      attemptRewrite = false;
    } else {
      // Centre the run on WHERE IT ALREADY IS, not on the corridor.
      //
      // This used to start from `midline`, the centre of the space
      // between the bounding obstacle faces. A run sitting comfortably
      // off to one side of a wide corridor was therefore dragged to
      // the middle of it: a large, surprising move that separation
      // never asked for, and the second half of the "nudge moved an
      // edge for no reason" report. Separation is a LOCAL property, so
      // the run keeps its own centre of mass and only spreads about
      // it, clamped so it still lands inside the corridor.
      const ownMid = (ownLo + ownHi) / 2;
      const gap =
        spanAvailable >= (n + 1) * trackGap
          ? trackGap
          : spanAvailable / (n + 1);
      const spread = (n - 1) * gap;
      const start = Math.min(
        Math.max(ownMid - spread / 2, faceLo),
        faceHi - spread,
      );
      placements = ordered.map((memberIdx, k) => ({
        memberIdx,
        newPerp: start + k * gap,
      }));
    }

    const base: CorridorDemandBase = {
      axis,
      corridorKey,
      midline,
      extent: [extLo, extHi],
      edgeIds: ordered
        .map((i) => movable[i]?.edgeId)
        .filter((id): id is string => id !== undefined),
      tracksRequired: n,
      spanAvailable,
      spanRequired,
      deficit,
    };
    const demand: CorridorDemand = blocked
      ? { ...base, blocked: true, blockedReason: "occluded" }
      : { ...base, blocked: false };

    planned.push({
      axis,
      memberIdxs: ordered,
      placements,
      demand,
      attemptRewrite,
    });
  }

  // Step 5: snapshot-plan / atomic-commit.
  const committed: Record<string, Pt[]> = {};
  for (const [id, pts] of Object.entries(normalized)) {
    committed[id] = pts.map((p) => ({ ...p }));
  }
  const finalDemand: CorridorDemand[] = [];

  // Order groups so bar translates (which do not shift indices) run
  // BEFORE arm jog splices (which do). Within arms, higher segIndex on
  // an edge runs first: an arm at segIndex=2 splicing pts[2..3] never
  // shifts the indices of a still-pending arm at segIndex=0, so its
  // segIndex reference into `committed` stays valid.
  //
  // Groups are classified by their first member's kind; a group is
  // homogeneous by construction (all members share axis + kind bucket
  // via the union-find split rule and short-arm filter).
  const groupKind = (g: (typeof planned)[number]): "bar" | "arm" => {
    const first = g.memberIdxs[0];
    if (first === undefined) return "bar";
    const s = movable[first];
    return s?.kind ?? "bar";
  };
  const groupMaxSegIndex = (g: (typeof planned)[number]): number => {
    let mx = -1;
    for (const i of g.memberIdxs) {
      const s = movable[i];
      if (s && s.segIndex > mx) mx = s.segIndex;
    }
    return mx;
  };
  const orderedPlanned = planned.slice().sort((a, b) => {
    const ka = groupKind(a);
    const kb = groupKind(b);
    if (ka !== kb) return ka === "bar" ? -1 : 1;
    if (ka === "arm") {
      // Descending segIndex among arms so higher-index splices run first.
      return groupMaxSegIndex(b) - groupMaxSegIndex(a);
    }
    return 0;
  });

  for (const group of orderedPlanned) {
    if (!group.attemptRewrite) {
      finalDemand.push(group.demand);
      continue;
    }
    const attemptResult = attemptGroupRewrite(
      group.placements,
      movable,
      committed,
      obstacles,
      trackGap,
      armsOnly,
      preExisting,
    );
    if (attemptResult.ok) {
      for (const [edgeId, pts] of Object.entries(attemptResult.rewritten)) {
        committed[edgeId] = pts;
      }
      finalDemand.push(group.demand);
      continue;
    }
    if (attemptResult.failureKind === "crossing") {
      finalDemand.push(makeRevertedDemand(group.demand));
      continue;
    }
    // Box-check failure: retry once at trackGap/2.
    const halvedGap = trackGap / 2;
    const halvedPlacements = replanPlacements(
      group.memberIdxs,
      movable,
      obstacles,
      halvedGap,
      clearance,
      options?.layoutBounds,
      group.axis,
    );
    if (halvedPlacements === null) {
      finalDemand.push(makeRevertedDemand(group.demand));
      continue;
    }
    const retry = attemptGroupRewrite(
      halvedPlacements,
      movable,
      committed,
      obstacles,
      trackGap,
      armsOnly,
      preExisting,
    );
    if (retry.ok) {
      for (const [edgeId, pts] of Object.entries(retry.rewritten)) {
        committed[edgeId] = pts;
      }
      finalDemand.push(group.demand);
    } else {
      finalDemand.push(makeRevertedDemand(group.demand));
    }
  }

  finalDemand.sort((a, b) => b.deficit - a.deficit);

  const outRoutes: Record<string, { points: Pt[] }> = {};
  for (const [id, pts] of Object.entries(committed)) {
    outRoutes[id] = { points: pts };
  }
  return { routes: outRoutes, corridorDemand: finalDemand };
}

function deriveLayoutBound(
  obstacles: readonly RouteBox[],
  supplied: NudgingOptions["layoutBounds"],
  trackGap: number,
): LayoutBound {
  if (supplied) {
    return {
      xLo: supplied.x,
      xHi: supplied.x + supplied.width,
      yLo: supplied.y,
      yHi: supplied.y + supplied.height,
    };
  }
  if (obstacles.length === 0) {
    return { xLo: -Infinity, xHi: Infinity, yLo: -Infinity, yHi: Infinity };
  }
  let xLo = Infinity;
  let xHi = -Infinity;
  let yLo = Infinity;
  let yHi = -Infinity;
  for (const b of obstacles) {
    xLo = Math.min(xLo, b.x);
    xHi = Math.max(xHi, b.x + b.width);
    yLo = Math.min(yLo, b.y);
    yHi = Math.max(yHi, b.y + b.height);
  }
  return {
    xLo: xLo - trackGap,
    xHi: xHi + trackGap,
    yLo: yLo - trackGap,
    yHi: yHi + trackGap,
  };
}

function orderByDivergence(
  memberIdxs: number[],
  movable: MovableSeg[],
  normalized: Record<string, Pt[]>,
  axis: "h" | "v",
): number[] {
  const keyOf = (i: number): [number, number, string] => {
    const s = movable[i];
    if (s === undefined) return [0, 0, ""];
    const pts = normalized[s.edgeId];
    if (pts === undefined) return [s.perp, s.perp, s.edgeId];
    const beforePt = pts[s.segIndex];
    const afterPt = pts[s.segIndex + 2];
    const perpOf = (p: Pt | undefined, fallback: number): number => {
      if (p === undefined) return fallback;
      return axis === "h" ? p.y : p.x;
    };
    return [perpOf(beforePt, s.perp), perpOf(afterPt, s.perp), s.edgeId];
  };
  return [...memberIdxs].sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
  });
}

interface RewriteAttempt {
  ok: boolean;
  rewritten: Record<string, Pt[]>;
  failureKind?: "box" | "crossing";
}

interface SegEdit {
  segIndex: number;
  newPerp: number;
  axis: "h" | "v";
  kind: "bar" | "arm";
  anchoredIdx: number;
  /** Stub length for arm jogs. min(trackGap, armAlongExtent/3) so a
   *  short arm never over-jogs past its own far bend. Ignored for bars. */
  stubLen: number;
}

function attemptGroupRewrite(
  placements: { memberIdx: number; newPerp: number }[],
  movable: MovableSeg[],
  base: Record<string, Pt[]>,
  obstacles: readonly RouteBox[],
  trackGap: number,
  allowArmCollinearBypass: boolean,
  preExisting: Set<string> | null,
): RewriteAttempt {
  const bySeg = new Map<string, SegEdit[]>();
  for (const pl of placements) {
    const s = movable[pl.memberIdx];
    if (s === undefined) continue;
    const armAlongExtent = s.extent[1] - s.extent[0];
    const entry: SegEdit = {
      segIndex: s.segIndex,
      newPerp: pl.newPerp,
      axis: s.axis,
      kind: s.kind,
      anchoredIdx: s.anchoredIdx,
      stubLen: Math.min(trackGap, armAlongExtent / 3),
    };
    const list = bySeg.get(s.edgeId);
    if (list) list.push(entry);
    else bySeg.set(s.edgeId, [entry]);
  }
  const edgeIds = Array.from(bySeg.keys());
  const originalCrossings = new Map<string, number>();
  // K(n,n) lane-overlap bypass: interior bar segments (the vertical centers of
  // Z-routes) all stack at the midline x when no nudging has occurred. The
  // crossing guard scores "0 crossings before spread" because collinear segments
  // don't register as proper crossings — but then any spread introduces real
  // crossings (jogs crossing sibling arms), so the guard reverts and the lanes
  // stay piled. Per owner ruling 2026-08-20, lane overlap is WORSE than crossing.
  // Bypass only for BAR groups where two members share the same perp coordinate:
  // bar-bar collinear stacking is the pathological case. ARM groups keep the
  // guard in pass 1 — a terminal arm jog-crossing there is usually a real
  // regression that SHOULD revert.
  //
  // The ARMS-ONLY second pass (owner ruling 2026-08-20b) is the exception:
  // it runs on the committed pass-1 geometry precisely to fix the coincident
  // arm overlaps that the pass-1 bar-spread created (the symmetric K(n,n)
  // pairs wi_j / wj_i whose horizontal arms land on one shared y). Those
  // arms read as a single stacked line, so `allowArmCollinearBypass` lets a
  // GENUINE coincident arm group (two members within 0.5px on the perp axis)
  // spread even at a higher crossing count. The box-check guard below still
  // reverts any spread that pushes an arm through a node body. An arm pair
  // that ALREADY overlapped in the raw input (`preExisting`) is a pattern the
  // router chose, not a nudge artifact, so the bypass excludes it and its
  // guard stays — that keeps the "only move what the nudge crowded" invariant.
  const isBarOnlyGroup = placements.every(
    (pl) => movable[pl.memberIdx]?.kind === "bar",
  );
  let hasGroupCollinearOverlap = false;
  if ((isBarOnlyGroup || allowArmCollinearBypass) && placements.length >= 2) {
    outer: for (let pi = 0; pi < placements.length; pi++) {
      for (let pj = pi + 1; pj < placements.length; pj++) {
        const pa = placements[pi];
        const pb = placements[pj];
        if (pa === undefined || pb === undefined) continue;
        const sa = movable[pa.memberIdx];
        const sb = movable[pb.memberIdx];
        if (sa === undefined || sb === undefined) continue;
        if (isNaN(sa.perp) || isNaN(sb.perp)) continue;
        if (Math.abs(sa.perp - sb.perp) >= 0.5) continue;
        // Skip pairs that were already overlapping before nudging.
        if (
          allowArmCollinearBypass &&
          preExisting?.has(armPairKey(sa.edgeId, sa.perp, sb.edgeId, sb.perp))
        )
          continue;
        hasGroupCollinearOverlap = true;
        break outer;
      }
    }
  }
  for (let i = 0; i < edgeIds.length; i++) {
    for (let j = i + 1; j < edgeIds.length; j++) {
      const idI = edgeIds[i];
      const idJ = edgeIds[j];
      if (idI === undefined || idJ === undefined) continue;
      const a = base[idI];
      const b = base[idJ];
      if (a === undefined || b === undefined) continue;
      originalCrossings.set(`${idI}|${idJ}`, countCrossings(a, b));
    }
  }
  const rewritten: Record<string, Pt[]> = {};
  for (const [edgeId, edits] of bySeg) {
    const src = base[edgeId];
    if (src === undefined) continue;
    let pts: Pt[] = src.map((p) => ({ ...p }));

    // Snapshot anchors so we can assert byte-identity after splices.
    const armEdits = edits.filter((e) => e.kind === "arm");
    const anchorSnapshots = armEdits.map((e) => ({
      edit: e,
      x: pts[e.anchoredIdx]?.x,
      y: pts[e.anchoredIdx]?.y,
    }));

    // Apply bar edits first: translate both endpoints in-place. Bar edits
    // move a coordinate that is orthogonal to arm axes on either side, so
    // the arm's shared-endpoint along coordinate can change here; the arm
    // splice below re-reads pts[segIndex/segIndex+1] to pick that up.
    for (const edit of edits) {
      if (edit.kind !== "bar") continue;
      const a = pts[edit.segIndex];
      const b = pts[edit.segIndex + 1];
      if (a === undefined || b === undefined) continue;
      if (edit.axis === "h") {
        a.y = edit.newPerp;
        b.y = edit.newPerp;
      } else {
        a.x = edit.newPerp;
        b.x = edit.newPerp;
      }
    }

    // Apply arm edits from HIGH segIndex to LOW so a low-index splice
    // does not shift the index of a not-yet-processed high-index arm.
    const armEditsSorted = armEdits
      .slice()
      .sort((a, b) => b.segIndex - a.segIndex);
    for (const edit of armEditsSorted) {
      const anchorPt = pts[edit.anchoredIdx];
      if (anchorPt === undefined) continue;
      // The "other" endpoint of the arm segment (far bend). For a
      // first-segment arm (segIndex=0, anchoredIdx=0), far bend is at
      // segIndex+1. For a last-segment arm (segIndex=N-2, anchoredIdx=N-1),
      // far bend is at segIndex.
      const farIdx =
        edit.anchoredIdx === edit.segIndex ? edit.segIndex + 1 : edit.segIndex;
      const farPt = pts[farIdx];
      if (farPt === undefined) continue;

      const along = (p: Pt): number => (edit.axis === "h" ? p.x : p.y);
      const perpOf = (p: Pt): number => (edit.axis === "h" ? p.y : p.x);
      const makePt = (alongV: number, perpV: number): Pt =>
        edit.axis === "h" ? { x: alongV, y: perpV } : { x: perpV, y: alongV };

      const anchorAlong = along(anchorPt);
      const anchorPerp = perpOf(anchorPt);
      const farAlong = along(farPt);
      const delta = farAlong - anchorAlong;
      if (Math.abs(delta) < 2 * edit.stubLen) {
        // Post-bar-translate collapse: after a bar moved the shared
        // endpoint, the arm is now too short to fit stub + rejoin. Leave
        // it fixed rather than emitting a jog that would overshoot.
        continue;
      }
      const dir = delta >= 0 ? 1 : -1;
      const stubEndAlong = anchorAlong + edit.stubLen * dir;
      const stub = makePt(stubEndAlong, anchorPerp);
      const bend = makePt(stubEndAlong, edit.newPerp);
      const run = makePt(farAlong, edit.newPerp);

      // Splice: replace segment [pts[segIndex], pts[segIndex+1]] with the
      // jogged run. Anchor and far bend keep their original references so
      // the anchor's coordinates are preserved byte-identically.
      const before = pts.slice(0, edit.segIndex);
      const after = pts.slice(edit.segIndex + 2);
      if (edit.anchoredIdx === edit.segIndex) {
        // First-segment arm: anchor at start, far bend at end.
        pts = [...before, anchorPt, stub, bend, run, farPt, ...after];
      } else {
        // Last-segment arm: far bend at start, anchor at end.
        pts = [...before, farPt, run, bend, stub, anchorPt, ...after];
      }
    }

    // Anchor byte-identity guard: the polyline's terminal anchors must
    // never move. If an arm splice touched them the pass is unsafe.
    for (const snap of anchorSnapshots) {
      const idxAfter = snap.edit.anchoredIdx === 0 ? 0 : pts.length - 1;
      const p = pts[idxAfter];
      if (p === undefined || p.x !== snap.x || p.y !== snap.y) {
        return { ok: false, rewritten: {}, failureKind: "box" };
      }
    }

    const compact = pts.filter((p, idx) => {
      if (idx === 0) return true;
      const prev = pts[idx - 1];
      if (prev === undefined) return true;
      return p.x !== prev.x || p.y !== prev.y;
    });
    rewritten[edgeId] = dedupeCollinear(compact);
  }
  for (const pts of Object.values(rewritten)) {
    if (polylineIntersectsBoxes(pts, obstacles)) {
      return { ok: false, rewritten: {}, failureKind: "box" };
    }
  }
  for (let i = 0; i < edgeIds.length; i++) {
    for (let j = i + 1; j < edgeIds.length; j++) {
      const idI = edgeIds[i];
      const idJ = edgeIds[j];
      if (idI === undefined || idJ === undefined) continue;
      const a = rewritten[idI];
      const b = rewritten[idJ];
      if (a === undefined || b === undefined) continue;
      const now = countCrossings(a, b);
      const before = originalCrossings.get(`${idI}|${idJ}`) ?? 0;
      if (!hasGroupCollinearOverlap && now > before) {
        return { ok: false, rewritten: {}, failureKind: "crossing" }; // guard retained for bar groups
      }
    }
  }
  return { ok: true, rewritten };
}

function replanPlacements(
  memberIdxs: number[],
  movable: MovableSeg[],
  obstacles: readonly RouteBox[],
  gap: number,
  clearance: number,
  layoutBoundsOpt: NudgingOptions["layoutBounds"],
  axis: "h" | "v",
): { memberIdx: number; newPerp: number }[] | null {
  const layoutBound = deriveLayoutBound(obstacles, layoutBoundsOpt, gap);
  let extLo = Infinity;
  let extHi = -Infinity;
  let ownLo = Infinity;
  let ownHi = -Infinity;
  for (const i of memberIdxs) {
    const s = movable[i];
    if (s === undefined) continue;
    extLo = Math.min(extLo, s.extent[0]);
    extHi = Math.max(extHi, s.extent[1]);
    ownLo = Math.min(ownLo, s.perp);
    ownHi = Math.max(ownHi, s.perp);
  }
  let perpMin = -Infinity;
  let perpMax = Infinity;
  for (const box of obstacles) {
    const bAlongLo = axis === "h" ? box.x : box.y;
    const bAlongHi = bAlongLo + (axis === "h" ? box.width : box.height);
    if (bAlongHi <= extLo || bAlongLo >= extHi) continue;
    const bPerpLo = axis === "h" ? box.y : box.x;
    const bPerpHi = bPerpLo + (axis === "h" ? box.height : box.width);
    if (bPerpHi <= ownLo && bPerpHi > perpMin) perpMin = bPerpHi;
    if (bPerpLo >= ownHi && bPerpLo < perpMax) perpMax = bPerpLo;
  }
  const openLo = axis === "h" ? layoutBound.yLo : layoutBound.xLo;
  const openHi = axis === "h" ? layoutBound.yHi : layoutBound.xHi;
  if (perpMin === -Infinity)
    perpMin = Math.max(openLo, ownLo - memberIdxs.length * gap);
  if (perpMax === Infinity)
    perpMax = Math.min(openHi, ownHi + memberIdxs.length * gap);
  const faceLo = perpMin + clearance;
  const faceHi = perpMax - clearance;
  const spanAvailable = faceHi - faceLo;
  const n = memberIdxs.length;
  if (spanAvailable <= 0) return null;
  let effGap = gap;
  if (spanAvailable < (n + 1) * gap) effGap = spanAvailable / (n + 1);
  const spread = (n - 1) * effGap;
  // Own centre of mass, clamped into the corridor: same rule as the
  // primary placement above, and for the same reason. Anchoring on the
  // corridor midline here would undo the fix on any run that reaches
  // the replan path.
  const ownMid = (ownLo + ownHi) / 2;
  const start = Math.min(
    Math.max(ownMid - spread / 2, faceLo),
    faceHi - spread,
  );
  return memberIdxs.map((memberIdx, k) => ({
    memberIdx,
    newPerp: start + k * effGap,
  }));
}

function makeRevertedDemand(demand: CorridorDemand): CorridorDemand {
  return {
    axis: demand.axis,
    corridorKey: demand.corridorKey,
    midline: demand.midline,
    extent: demand.extent,
    edgeIds: demand.edgeIds,
    tracksRequired: demand.tracksRequired,
    spanAvailable: demand.spanAvailable,
    spanRequired: demand.spanRequired,
    deficit: demand.deficit,
    blocked: true,
    blockedReason: "reverted",
  };
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function segmentsCrossProper(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d1 = orient(b1, b2, a1);
  const d2 = orient(b1, b2, a2);
  const d3 = orient(a1, a2, b1);
  const d4 = orient(a1, a2, b2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
function countCrossings(a: readonly Pt[], b: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      const a1 = a[i - 1];
      const a2 = a[i];
      const b1 = b[j - 1];
      const b2 = b[j];
      if (a1 && a2 && b1 && b2 && segmentsCrossProper(a1, a2, b1, b2)) n++;
    }
  }
  return n;
}
