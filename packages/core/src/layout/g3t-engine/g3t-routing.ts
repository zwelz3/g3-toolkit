/**
 * Scene edge routing for the g3t structural path (WS-D D3a).
 *
 * Layered layouts route through the inter-layer gaps, which are
 * empty BY CONSTRUCTION: each edge leaves its source border on a
 * side-aware stub, jogs once at the gap midline, and enters the
 * target border. Edges sharing a border are fanned deterministically
 * (ordered by the far endpoint's x) so they neither stack nor cross
 * at the anchor. Port-attached edges anchor AT the declared port.
 *
 * Cheap-first with correctness kept by verification: a gap route
 * that intersects a box (long spans without LAY-005 dummies can)
 * escalates to the sparse-grid router under a time budget with
 * best-so-far semantics; on budget expiry or router null, the
 * simple route stands. The channel router (PRF-003) replaces
 * escalation wholesale in D3b.
 */
import type { StructuralGeometry, StructuralGraphInput } from "../structural";
import type { RouteBox } from "../../route/orthogonal-router";
import {
  polylineIntersectsBoxes,
  routeOrthogonal,
  type RouteSide,
} from "../../route/orthogonal-router";
import { dedupeCollinear, type Pt } from "./g3t-polyline-utils";
import { nudgeRoutes } from "./g3t-nudging";
import {
  assignTracks,
  emitChannelRoute,
  routeChannelOverflow,
  type ChannelPlan,
} from "./g3t-channel-router";

/** VR-10 (owner Jake, 2026-08-14): the obstacle set a perimeter or
 *  detour route must be JUDGED against.
 *
 *  Both shapes sweep out past the field on the CROSS axis and run the
 *  whole TRAVEL axis, so their footprint is NOT the simple route's
 *  bounding box. Verifying them against the caller's `near` set (which
 *  is filtered by the simple route's bbox) shipped a full-field rail
 *  straight through an entire node row: prune-wall/L under DOWN flow,
 *  edge pskip.0. That row sat LEFT of the simple route's bbox, so it
 *  was invisible BOTH to the band bounds (`lo` landed inside the
 *  field, at the source column) and to the collision check (which
 *  never saw those 19 boxes).
 *
 *  A perimeter/detour polyline's extent on the travel axis is exactly
 *  the min/max of its defining points, so filtering the FULL obstacle
 *  set to that interval is provably equivalent to checking every box,
 *  at one linear pass per edge: no grid, no quadratic term, the
 *  PRF-002 budget is untouched. */
function travelBand(
  points: readonly Pt[],
  horizontalTravel: boolean,
  obstacles: readonly RouteBox[],
): RouteBox[] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const v = horizontalTravel ? p.x : p.y;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return obstacles.filter((b) =>
    horizontalTravel
      ? b.x < hi && b.x + b.width > lo
      : b.y < hi && b.y + b.height > lo,
  );
}

/** VR-10: cross-axis bounds that clear every box in `set`, padded by
 *  CLEAR. Offered as CANDIDATES, never as a replacement: a bound
 *  derived from a WIDER set sweeps further out, which clears more
 *  boxes on the cross axis but lengthens the two perpendicular runs
 *  that connect the rail to the tips -- and those can cross boxes the
 *  narrower bound never reached. Collect both, verify each, keep the
 *  one nearest the midline. */
function crossBounds(
  set: readonly RouteBox[],
  horizontalTravel: boolean,
  clear: number,
): { lo: number; hi: number } | null {
  if (set.length === 0) return null;
  return {
    lo: Math.min(...set.map((b) => (horizontalTravel ? b.y : b.x))) - clear,
    hi:
      Math.max(
        ...set.map((b) => (horizontalTravel ? b.y + b.height : b.x + b.width)),
      ) + clear,
  };
}

/** VR-9 (owner IBD screenshots, 2026-07-28): when the router fails
 *  in a dense corridor, the old fallback surrendered to the
 *  obstacle-blind simple template: mid-height edges ran straight
 *  THROUGH intermediate containers. This builds a perpendicular
 *  DETOUR around the near-obstacle band instead: sweep out past the
 *  band on the cross axis, across, and back in. Returns null when
 *  neither side of the band yields a clean route (the caller may
 *  then surrender honestly). Exported for direct unit testing. */
export function detourAround(
  sPoint: Pt,
  sTip: Pt,
  tPoint: Pt,
  tTip: Pt,
  obstacles: readonly RouteBox[],
  /** VR-10: the caller's simple-route near-set, when it has one. Its
   *  bounds stay in the candidate list (they are often the tighter,
   *  better-reading detour); they are just no longer TRUSTED without a
   *  full-band check. Defaults to `obstacles` so the 5-arg form is a
   *  band-only detour. */
  near: readonly RouteBox[] = obstacles,
): Pt[] | null {
  if (obstacles.length === 0) return null;
  const CLEAR = 16;
  const horizontalTravel =
    Math.abs(tTip.x - sTip.x) >= Math.abs(tTip.y - sTip.y);
  // VR-10: verification runs against the band the detour actually
  // sweeps -- the FULL obstacle set over this route's travel span --
  // not the caller's simple-route near-set, which by construction
  // omits the boxes a detour leaves that bbox to reach.
  const band = travelBand(
    [sPoint, sTip, tTip, tPoint],
    horizontalTravel,
    obstacles,
  );
  if (band.length === 0) return null;
  const mk = (cross: number): Pt[] =>
    dedupeCollinear(
      horizontalTravel
        ? [
            sPoint,
            sTip,
            { x: sTip.x, y: cross },
            { x: tTip.x, y: cross },
            tTip,
            tPoint,
          ]
        : [
            sPoint,
            sTip,
            { x: cross, y: sTip.y },
            { x: cross, y: tTip.y },
            tTip,
            tPoint,
          ],
    );
  const mid = horizontalTravel ? (sTip.y + tTip.y) / 2 : (sTip.x + tTip.x) / 2;
  const crosses: number[] = [];
  for (const bounds of [
    crossBounds(near, horizontalTravel, CLEAR),
    crossBounds(band, horizontalTravel, CLEAR),
  ]) {
    if (bounds === null) continue;
    for (const cross of [bounds.lo, bounds.hi]) {
      if (!crosses.includes(cross)) crosses.push(cross);
    }
  }
  const candidates = crosses
    .map((cross) => mk(cross))
    .filter((pts) => !polylineIntersectsBoxes(pts, band));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const detourOf = (pts: Pt[]): number => {
      const c = horizontalTravel ? (pts[2]?.y ?? mid) : (pts[2]?.x ?? mid);
      return Math.abs(c - mid);
    };
    return detourOf(a) - detourOf(b);
  });
  return candidates[0] ?? null;
}

export function routeStructuralEdges(
  input: StructuralGraphInput,
  geometry: StructuralGeometry,
  options?: {
    routingBudgetMs?: number;
    direction?: string;
    /** R-4 (round 17, 2026-07-28): which end is anchored FIRST.
     *  "target" resolves arrival points before source departures,
     *  so many-to-one flow spreads sources against the arrival
     *  order rather than against the target's center. Default
     *  "source" preserves existing scenes exactly. */
    anchor?: "source" | "target";
    /** Parallel-run separation post-pass (see g3t-nudging.ts).
     *  Groups coincident parallel interior segments into corridors
     *  and distributes them across distinct tracks. Currently OPT-IN
     *  (default false); the brief mandates a follow-up flip to
     *  default true, gated on a baseline re-pin. */
    nudge?: boolean;
    /** Long-edge perimeter policy (owner Jake, 2026-08-14): edges
     *  whose simple-route near-obstacle set contains at least this
     *  many boxes prefer a perimeter detour (VR-9 detourAround) over
     *  the interior corridor, so long lines through dense fields move
     *  to the outside where they read cleanly. Default 12; Infinity
     *  disables (single-line rollback). Ineligible edges are
     *  byte-identical to before. */
    longEdgeNear?: number;
    /** LAY-005 (owner Jake, 2026-08-14): dummy-chain bend hints per
     *  edge id, in source-to-target order. When an edge has hints and
     *  is NOT perimeter-eligible, the interior route seeds from these
     *  points instead of the single midpoint jog; the hints ride out
     *  as `intermediate` on the emitted geometry. Perimeter-eligible
     *  edges skip seeding by policy (the perimeter detour is the
     *  right shape for a long line through a dense field). */
    bendHints?: ReadonlyMap<string, readonly Pt[]>;
    /** PRF-003 brief 05a (owner Jake, 2026-08-14): route via the
     *  additive channel router (g3t-channel-router.ts) instead of the
     *  ladder. TRANSIENT SCAFFOLDING: 05a lands the module + unit
     *  oracles behind an off-by-default flag so 05b can flip it, delete
     *  the ladder, and re-pin the six-scenario baseline in one commit
     *  with an OBSERVED (not blind) after-value. Default false =>
     *  byte-identical to today. When true AND `channelPlan` is
     *  supplied, edges route through the channel model; when true but
     *  no plan is supplied, the flag has no effect (the ladder still
     *  runs). NO-LEGACY: 05b removes this flag when it lands the
     *  wire-up. */
    useChannelRouter?: boolean;
    /** PRF-003 brief 05a: channel/track plan the additive router
     *  consumes. Callers derive this from their layered layout
     *  (g3tLayoutStructural / g3tLayoutFlat carry the layer + corridor
     *  info); 05a keeps it caller-supplied so this brief lands without
     *  touching the layout pipeline. */
    channelPlan?: ChannelPlan;
    /** Minimum px between adjacent anchors on one side, with overflow
     *  onto the two adjacent sides once a side saturates. OPT-IN;
     *  omitted (the default) is byte-identical to today.
     *
     *  The plain fan divides a side into `count + 1` and takes the
     *  interior points, so its pitch is `extent / (count + 1)` with no
     *  floor. That is fine until a side is asked to absorb more edges
     *  than it has room for: 17 arrivals on a 52px-tall box land 2.9px
     *  apart, which is mathematically distinct and visually one line
     *  with 17 arrowheads stacked on it. No existing option helps,
     *  because none of them adds space.
     *
     *  When set, anchors are placed at AT LEAST this pitch, centred on
     *  the side. Once `count` exceeds what the side can hold, the
     *  outermost edges in fan order wrap around the corners onto the
     *  two perpendicular sides (an edge arriving from far above takes
     *  the north face), nearest-corner first, each overflow side
     *  pitch-limited in turn. Edges that overflow keep their fan
     *  ORDER, so the sequence still reads around the box.
     *
     *  A side is never given more than it can hold at this pitch. A
     *  box with genuinely too many incident edges saturates its
     *  overflow sides too, and those fall back to even division on the
     *  side they landed on: legibility degrades from there.
     *
     *  This REDUCES stacking, it does not abolish it, and the
     *  difference is worth stating. Placement here is an input to
     *  `anchorOf`, not the last word: VR-7f slides an anchor whose
     *  natural spot is covered by the counterpart box to the nearest
     *  exposed cross, and two anchors can slide onto the SAME cross
     *  because that choice is made per edge with no knowledge of its
     *  neighbours. An assigned side that is fully covered also falls
     *  through to the ordinary side walk, which takes that side's
     *  midpoint. Both paths can still coincide. Making distinctness a
     *  guarantee means teaching those two to see the anchors already
     *  placed, which is a larger change than this option.
     *
     *  Ordering caveat: the fan sorts by the far end's coordinate in
     *  the PRIMARY side's axis. Once an edge overflows around a
     *  corner, its own axis changes, so the sort key at the far end
     *  can be read in the other axis. That affects fan ORDER only,
     *  never placement, and it is the same imprecision the plain fan
     *  already carries for mixed-side pairs. */
    anchorPitch?: number;
    /** Target separation between nudged parallel runs, px. Default 8.
     *  Only read when `nudge` is on. Callers coming through the layout
     *  should set it there instead, so the corridor the layout
     *  RESERVES widens to match; setting it only here spreads runs
     *  into space that was never allocated. */
    trackGap?: number;
  },
): Record<string, { points: Pt[]; intermediate?: Pt[] }> {
  // Direction-aware (WS-D D3a fix): under horizontal flow (RIGHT/
  // LEFT, the default) edges leave EAST/WEST and jog VERTICALLY in
  // the inter-layer gap; under vertical flow they leave NORTH/SOUTH
  // and jog horizontally. Anchoring against the flow axis routes
  // through sibling boxes and escalates everything (measured: 800/
  // 800 escalations on R1).
  const direction = options?.direction ?? "RIGHT";
  const horizontal = direction === "RIGHT" || direction === "LEFT";
  const budgetMs = options?.routingBudgetMs ?? 80;
  // LAY-005 (owner Jake, 2026-08-14): absent -> Infinity (policy
  // disabled, so seeding applies to every hinted edge). Callers that
  // want the perimeter policy pass the threshold explicitly
  // (g3tLayoutStructural preserves the historical default of 12).
  const longEdgeNear = options?.longEdgeNear ?? Infinity;
  const bendHints = options?.bendHints;
  const useChannelRouter =
    (options?.useChannelRouter ?? false) && options?.channelPlan !== undefined;
  const channelPlan = useChannelRouter ? options?.channelPlan : undefined;
  const out: Record<string, { points: Pt[]; intermediate?: Pt[] }> = {};
  // Perimeter-routed edges collected during the loop; a post-pass
  // staggers coincident tracks so two long lines sharing a band do
  // not overlap exactly. (Once 01-nudging lands, its group machinery
  // treats each staggered band as an ordinary corridor group; this
  // stagger remains as deterministic pre-ordering.)
  interface PerimeterRec {
    edgeId: string;
    horizontal: boolean;
    side: "lo" | "hi";
    cross: number;
    build: (cross: number) => Pt[];
  }
  const perimeterRoutes: PerimeterRec[] = [];
  const topBoxes = Object.entries(geometry.nodes).filter(
    ([, g]) => g.kind !== "row",
  );
  const boxOf = new Map(topBoxes);
  // Obstacles keep their ids so per-edge endpoint exclusion is an id
  // comparison, not a coordinate comparison.
  const obstacles = topBoxes.map(([id, g]) => ({
    id,
    x: g.x,
    y: g.y,
    width: g.width,
    height: g.height,
  }));

  // Fan assignment: edges grouped by (node, side), ordered by the
  // OTHER endpoint's x so parallel edges spread without crossing.
  const edges = [...input.edges]
    .filter((e) => e.source !== e.target)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const centerX = (id: string): number => {
    const g = boxOf.get(id);
    return g === undefined ? 0 : g.x + g.width / 2;
  };
  const centerY = (id: string): number => {
    const g = boxOf.get(id);
    return g === undefined ? 0 : g.y + g.height / 2;
  };
  interface Attach {
    edge: string;
    otherX: number;
  }
  const fans = new Map<string, Attach[]>();
  const fanKey = (node: string, side: RouteSide): string => `${node}#${side}`;
  // VR-7b (owner verification 2026-07-27, BDD screenshots): the
  // DOMINANT separation axis picks the side pair, the flow axis
  // winning ties. The old flow-only rule made EAST/WEST
  // unreachable under a DOWN layout, so a horizontally adjacent
  // pair anchored top/bottom and the route wrapped around both
  // blocks.
  // VR-7f (owner re-verify 2026-07-28): sides come from SIGNED
  // BORDER GAPS, not center deltas. Center deltas misfire when
  // boxes OVERLAP (the OBC-over-SmallSat drop routed over the
  // host); the largest border gap is the direction with the most
  // open space (least intrusion under overlap), which also
  // subsumes the round-62 dominant-axis rule for separated boxes.
  // The flow axis breaks exact ties.
  const sidesFor = (from: string, to: string): RouteSide[] => {
    const fg = boxOf.get(from);
    const tg = boxOf.get(to);
    if (fg === undefined || tg === undefined) {
      const dx = centerX(to) - centerX(from);
      const dy = centerY(to) - centerY(from);
      const useX = horizontal
        ? Math.abs(dx) >= Math.abs(dy)
        : Math.abs(dx) > Math.abs(dy);
      return useX ? [dx >= 0 ? "EAST" : "WEST"] : [dy >= 0 ? "SOUTH" : "NORTH"];
    }
    const gaps: Array<{ side: RouteSide; gap: number }> = [
      { side: "EAST", gap: tg.x - (fg.x + fg.width) },
      { side: "WEST", gap: fg.x - (tg.x + tg.width) },
      { side: "SOUTH", gap: tg.y - (fg.y + fg.height) },
      { side: "NORTH", gap: fg.y - (tg.y + tg.height) },
    ];
    const flowFirst: Record<RouteSide, number> = horizontal
      ? { EAST: 0, WEST: 1, NORTH: 2, SOUTH: 3 }
      : { SOUTH: 0, NORTH: 1, EAST: 2, WEST: 3 };
    gaps.sort((a, b) => b.gap - a.gap || flowFirst[a.side] - flowFirst[b.side]);
    return gaps.map((g) => g.side);
  };
  const sideFor = (from: string, to: string): RouteSide =>
    sidesFor(from, to)[0] ?? "EAST";
  // VR-7b: the fan's tangent axis follows the SIDE, not the flow:
  // anchors on E/W sides spread along y, anchors on N/S sides along
  // x, whichever flow produced them. (The old flow-fixed tangent
  // made dominant-axis side selection place E/W anchors at an
  // x-coordinate.)
  const tangentOf = (side: RouteSide, id: string): number =>
    side === "EAST" || side === "WEST" ? centerY(id) : centerX(id);
  // Upstream R-4 (round 17, 2026-07-28): fan distribution is
  // GLOBAL already (both ends spread across their side before any
  // route is computed), so arrivals never stack. The residual their
  // report describes is the ORDERING INPUT: each end sorts by the
  // other node's CENTER, so on many-to-one flow every source sorts
  // against the same point and the spread carries no information
  // about where each edge actually arrives. anchor: "target"
  // resolves the TARGET ends first, then orders source fans by the
  // arrival coordinate already assigned, which is the "source knows
  // how much to spread" property they asked for.
  const anchorFirst = options?.anchor ?? "source";
  const fanOffset = new Map<string, number>(); // `${edge}@${node}` -> tangent coord
  // Anchor-pitch overflow (opt-in, see options.anchorPitch). ONLY
  // written when the option is set, and read only where it is present,
  // so the default path never sees it and stays byte-identical. A
  // separate map rather than widening fanOffset for the same reason:
  // the default fan is oracle-pinned and not worth the risk.
  const anchorPitch = options?.anchorPitch;
  const fanSide = new Map<string, RouteSide>(); // `${edge}@${node}` -> side
  /** The two sides perpendicular to `side`, low end first. Overflow
   *  wraps around the corners onto these. */
  const perpSides = (side: RouteSide): [RouteSide, RouteSide] =>
    side === "EAST" || side === "WEST" ? ["NORTH", "SOUTH"] : ["WEST", "EAST"];
  /** Span available for anchors on one side of `g`, as [min, max] in
   *  that side's tangent axis. */
  const spanOf = (
    g: { x: number; y: number; width: number; height: number },
    side: RouteSide,
    margin: number,
  ): [number, number] => {
    const ew = side === "EAST" || side === "WEST";
    const lo = (ew ? g.y : g.x) + margin;
    const hi = (ew ? g.y + g.height : g.x + g.width) - margin;
    return [lo, Math.max(lo, hi)];
  };
  /** Place `n` anchors centred on [lo, hi] at `pitch` spacing, or as
   *  many as fit. Returns fewer than `n` only when the span cannot
   *  hold them; the caller overflows the rest. */
  const placeAtPitch = (
    lo: number,
    hi: number,
    pitch: number,
    n: number,
  ): number[] => {
    if (n <= 0) return [];
    const span = hi - lo;
    const capacity = Math.max(1, Math.floor(span / pitch) + 1);
    const take = Math.min(n, capacity);
    if (take === 1) return [lo + span / 2];
    // Spread to the full span when there is room to spare, so a light
    // side still reads as an even fan rather than a tight cluster in
    // the middle; tighten to exactly `pitch` once it is crowded.
    // `(take - 1) * step <= span` holds either way, because capacity
    // is floor(span / pitch) + 1, so the run always fits inside the
    // span and `start` below never pushes it past `hi`.
    const step = Math.max(pitch, span / take);
    const total = step * (take - 1);
    const start = lo + Math.max(0, (span - total) / 2);
    return Array.from({ length: take }, (_, i) => start + i * step);
  };
  const collect = (ends: "source" | "target", align = false): void => {
    fans.clear();
    for (const e of edges) {
      const isSrc = ends === "source";
      const portSet = isSrc ? e.sourcePort : e.targetPort;
      if (portSet) continue;
      const self = isSrc ? e.source : e.target;
      const other = isSrc ? e.target : e.source;
      const sd = sideFor(self, other);
      const k = fanKey(self, sd);
      // When the other end is already anchored, sort against its
      // ASSIGNED arrival; otherwise fall back to its center.
      const assigned = fanOffset.get(`${e.id}@${other}`);
      const entry = {
        edge: e.id,
        otherX: assigned ?? tangentOf(sd, other),
      };
      const list = fans.get(k);
      if (list) list.push(entry);
      else fans.set(k, [entry]);
    }
    for (const [key, list] of fans) {
      const [node, sideRaw] = key.split("#");
      const g = node === undefined ? undefined : boxOf.get(node);
      if (g === undefined) continue;
      const ew = sideRaw === "EAST" || sideRaw === "WEST";
      const sorted = [...list].sort(
        (a, b) => a.otherX - b.otherX || (a.edge < b.edge ? -1 : 1),
      );
      const lo = ew ? g.y : g.x;
      const extent = ew ? g.height : g.width;
      if (anchorPitch !== undefined && anchorPitch > 0) {
        // Opt-in pitch + corner overflow. Takes precedence over both
        // branches below: it subsumes the even fan (it spreads to the
        // full span when there is room) and the align pass has no
        // answer for a saturated side, which is the case this exists
        // for.
        const MARGIN = 8;
        // Bound once, so the closure below takes a plain number rather
        // than relying on narrowing to survive into it.
        const pitchPx = anchorPitch;
        const primary = (sideRaw ?? "EAST") as RouteSide;
        const [pLo, pHi] = spanOf(g, primary, MARGIN);
        const onPrimary = placeAtPitch(pLo, pHi, pitchPx, sorted.length);
        const excess = sorted.length - onPrimary.length;
        // The MIDDLE of the fan keeps the primary side; the outermost
        // edges wrap around the corners, which is where they were
        // already heading. Split the excess evenly so neither corner
        // takes the whole overflow.
        const lowCount = Math.floor(excess / 2);
        const [lowSide, highSide] = perpSides(primary);
        const lowEdges = sorted.slice(0, lowCount);
        const midEdges = sorted.slice(lowCount, lowCount + onPrimary.length);
        const highEdges = sorted.slice(lowCount + onPrimary.length);
        midEdges.forEach((a, i) => {
          fanOffset.set(`${a.edge}@${node}`, onPrimary[i] ?? pLo);
          fanSide.set(`${a.edge}@${node}`, primary);
        });
        const placeOverflow = (group: typeof sorted, side: RouteSide): void => {
          if (group.length === 0) return;
          const [oLo, oHi] = spanOf(g, side, MARGIN);
          let pos = placeAtPitch(oLo, oHi, pitchPx, group.length);
          if (pos.length < group.length) {
            // This side saturated too. Fall back to even division on
            // it, so the anchors still separate as far as the border
            // allows instead of stacking on one point. Legibility
            // degrades past this; no anchor is lost.
            const oSpan = oHi - oLo;
            pos = group.map(
              (_, i) => oLo + ((i + 1) / (group.length + 1)) * oSpan,
            );
          }
          group.forEach((a, i) => {
            fanOffset.set(`${a.edge}@${node}`, pos[i] ?? oLo);
            fanSide.set(`${a.edge}@${node}`, side);
          });
        };
        placeOverflow(lowEdges, lowSide);
        placeOverflow(highEdges, highSide);
        continue;
      }
      if (align) {
        // R-4 v2 (consumer measurement 2026-08-03): sorting by the
        // other end's assigned coordinate is NOT enough. In a
        // layered scene the far boxes never overlap on the cross
        // axis, so that sort always reproduces the plain center
        // order and the two modes coincide exactly (measured: 0 of
        // 9 routes differ in a complete bipartite fixture, and 0 of
        // 34 real consumer views). The second pass now ALIGNS each
        // departure with the arrival already fixed at the other
        // end, clamped into this side's span and separated so
        // anchors never coincide. That is what actually removes the
        // late bends the request was about.
        const MARGIN = 8;
        const min = lo + MARGIN;
        const max = lo + extent - MARGIN;
        const gap = Math.min(
          16,
          Math.max(2, (max - min) / Math.max(1, sorted.length)),
        );
        // Desired positions are the far end's fixed anchors. A
        // forward pass enforces the minimum separation, then a
        // backward pass pulls the tail back inside the span; a
        // single clamp would collapse every saturated anchor onto
        // the boundary (two departures at the same point).
        const placed = sorted.map((a) =>
          Math.min(max, Math.max(min, a.otherX)),
        );
        for (let i = 1; i < placed.length; i++) {
          const prev = placed[i - 1] ?? min;
          if ((placed[i] ?? min) < prev + gap) placed[i] = prev + gap;
        }
        for (let i = placed.length - 1; i >= 0; i--) {
          const limit =
            i === placed.length - 1 ? max : (placed[i + 1] ?? max) - gap;
          if ((placed[i] ?? min) > limit) placed[i] = limit;
        }
        sorted.forEach((a, i) => {
          fanOffset.set(`${a.edge}@${node}`, placed[i] ?? min);
        });
        continue;
      }
      sorted.forEach((a, i) => {
        const frac = (i + 1) / (sorted.length + 1);
        fanOffset.set(`${a.edge}@${node}`, lo + frac * extent);
      });
    }
  };
  if (anchorFirst === "target") {
    // Arrivals first (even spread), then departures ALIGNED to them.
    collect("target");
    collect("source", true);
  } else {
    // Default: unchanged from v1.0.0, byte for byte.
    collect("source");
    collect("target");
  }

  const anchorOf = (
    e: {
      id: string;
      source: string;
      target: string;
      sourcePort?: string;
      targetPort?: string;
    },
    end: "s" | "t",
  ): { point: Pt; side: RouteSide; port?: boolean } | null => {
    const node = end === "s" ? e.source : e.target;
    const portId = end === "s" ? e.sourcePort : e.targetPort;
    if (portId !== undefined) {
      const p = geometry.ports[portId];
      if (p !== undefined) {
        // LR-20: anchor at the port's OUTER face center so arrowed
        // edges terminate at the port boundary, not behind it.
        const cx =
          p.side === "EAST"
            ? p.x + p.width
            : p.side === "WEST"
              ? p.x
              : p.x + p.width / 2;
        const cy =
          p.side === "SOUTH"
            ? p.y + p.height
            : p.side === "NORTH"
              ? p.y
              : p.y + p.height / 2;
        return { point: { x: cx, y: cy }, side: p.side, port: true };
      }
    }
    const g = boxOf.get(node);
    if (g === undefined) return null;
    const other = end === "s" ? e.target : e.source;
    // VR-7f (owner re-verify 2026-07-28): when the counterpart box
    // OVERLAPS this one, an anchor can land INSIDE the counterpart
    // (the OBC-over-SmallSat drop routed straight through the
    // host). Walk the gap-ordered sides; on each, slide the tangent
    // to an EXPOSED stretch of the border (outside the counterpart
    // plus clearance) when the natural spot is covered; fall to the
    // next side when the whole border is covered.
    const og = boxOf.get(other);
    const CLEAR = 8;
    const MARG = 6;
    const buildAnchor = (
      side: RouteSide,
      preferred: number | undefined,
    ): { point: Pt; side: RouteSide } | null => {
      const ew = side === "EAST" || side === "WEST";
      const border = ew
        ? side === "EAST"
          ? g.x + g.width
          : g.x
        : side === "SOUTH"
          ? g.y + g.height
          : g.y;
      const lo = (ew ? g.y : g.x) + MARG;
      const hi = (ew ? g.y + g.height : g.x + g.width) - MARG;
      const want = preferred ?? (ew ? g.y + g.height / 2 : g.x + g.width / 2);
      const mk = (cross: number): { point: Pt; side: RouteSide } => ({
        point: ew ? { x: border, y: cross } : { x: cross, y: border },
        side,
      });
      if (og === undefined) return mk(want);
      const coveredAxis = ew
        ? border > og.x - CLEAR && border < og.x + og.width + CLEAR
        : border > og.y - CLEAR && border < og.y + og.height + CLEAR;
      if (!coveredAxis) return mk(want);
      const cLo = (ew ? og.y : og.x) - CLEAR;
      const cHi = (ew ? og.y + og.height : og.x + og.width) + CLEAR;
      if (want <= cLo || want >= cHi) return mk(want);
      // Natural spot covered: nearest exposed cross on this border.
      const candidates: number[] = [];
      if (cLo >= lo) candidates.push(cLo);
      if (cHi <= hi) candidates.push(cHi);
      if (candidates.length === 0) return null; // fully covered side
      candidates.sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
      const chosen = candidates[0];
      return chosen === undefined ? null : mk(chosen);
    };
    const fanPreferred = fanOffset.get(`${e.id}@${node}`);
    // Anchor-pitch overflow assigned this edge to a specific side, so
    // try that one FIRST rather than the gap-ordered primary. Empty
    // unless options.anchorPitch is set, so the default walk below is
    // reached unchanged. VR-7f still applies: if the assigned side is
    // covered by the counterpart box we fall through to the normal
    // ordering rather than anchoring into another box.
    const assignedSide = fanSide.get(`${e.id}@${node}`);
    if (assignedSide !== undefined) {
      const a = buildAnchor(assignedSide, fanPreferred);
      if (a !== null) return a;
    }
    const ordered = sidesFor(node, other);
    for (let i = 0; i < ordered.length; i++) {
      const side = ordered[i];
      if (side === undefined) continue;
      if (side === assignedSide) continue; // already tried, and failed
      // `fanPreferred` is a coordinate in its OWN side's tangent axis.
      // On the default path that side is ordered[0], so passing it
      // there is correct. When overflow assigned a different side and
      // that side was rejected, the coordinate means nothing here (a
      // y from an EAST fan read as an x on NORTH), so drop it and take
      // the side's natural midpoint.
      const preferred =
        i === 0 && assignedSide === undefined ? fanPreferred : undefined;
      const a = buildAnchor(side, preferred);
      if (a !== null) return a;
    }
    // Everything covered (extreme containment): the primary side's
    // natural anchor, honestly.
    const primary = ordered[0] ?? "EAST";
    const ewP = primary === "EAST" || primary === "WEST";
    const cross =
      fanPreferred ?? (ewP ? g.y + g.height / 2 : g.x + g.width / 2);
    return ewP
      ? {
          point: { x: primary === "EAST" ? g.x + g.width : g.x, y: cross },
          side: primary,
        }
      : {
          point: { x: cross, y: primary === "SOUTH" ? g.y + g.height : g.y },
          side: primary,
        };
  };

  // PRF-003 brief 05a: pre-compute channel/track assignment before the
  // per-edge loop. Entry/exit cross-coord for the divergence sort uses
  // node centers (deterministic, geometry-only); the emitter reads this
  // per edge inside the loop. When `useChannelRouter` is off (default)
  // this whole block is dead code (channelPlan === undefined).
  const channelAssignment = channelPlan
    ? assignTracks(
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          entryCross:
            channelPlan.direction === "RIGHT" ||
            channelPlan.direction === "LEFT"
              ? centerY(e.source)
              : centerX(e.source),
          exitCross:
            channelPlan.direction === "RIGHT" ||
            channelPlan.direction === "LEFT"
              ? centerY(e.target)
              : centerX(e.target),
        })),
        channelPlan,
      )
    : null;

  const t0 = Date.now();
  for (const e of edges) {
    const s = anchorOf(e, "s");
    const t = anchorOf(e, "t");
    if (s === null || t === null) continue;
    // LR-21 (owner review 2026-07-22): NEAR-aligned anchor pairs got
    // a full Z jog for a few pixels of cross-axis delta (boxes of
    // different widths stack left-aligned, so their CENTERS differ
    // even when a direct line is the obviously right route). When
    // both ends are box anchors (ports stay where declared), the
    // cross delta is small, and the shared coordinate stays inside
    // BOTH boxes' side spans with margin, slide the two anchors to
    // the shared coordinate: the simple route then collapses to a
    // straight line.
    if (e.sourcePort === undefined && e.targetPort === undefined) {
      const SNAP = 12;
      const MARGIN = 6;
      const sg = boxOf.get(e.source);
      const tg = boxOf.get(e.target);
      // VR-7e (owner re-verify 2026-07-28): the snap follows the
      // SIDE PAIR, not the flow axis (the round-62 dominant-axis
      // change made E/W pairs reachable under vertical flow, and
      // this pass kept snapping the flow's cross coordinate:
      // vertical alignment never locked in the BDD). An E/W pair
      // snaps the shared Y; an N/S pair the shared X; mixed pairs
      // have no straight line to snap to.
      const ewPair =
        (s.side === "EAST" || s.side === "WEST") &&
        (t.side === "EAST" || t.side === "WEST");
      const nsPair =
        (s.side === "NORTH" || s.side === "SOUTH") &&
        (t.side === "NORTH" || t.side === "SOUTH");
      if (sg !== undefined && tg !== undefined && (ewPair || nsPair)) {
        const crossS = ewPair ? s.point.y : s.point.x;
        const crossT = ewPair ? t.point.y : t.point.x;
        const delta = Math.abs(crossS - crossT);
        if (delta > 0 && delta <= SNAP) {
          const shared = (crossS + crossT) / 2;
          const lo = (g: {
            x: number;
            y: number;
            width: number;
            height: number;
          }) => (ewPair ? g.y : g.x) + MARGIN;
          const hi = (g: {
            x: number;
            y: number;
            width: number;
            height: number;
          }) => (ewPair ? g.y + g.height : g.x + g.width) - MARGIN;
          if (
            shared >= lo(sg) &&
            shared <= hi(sg) &&
            shared >= lo(tg) &&
            shared <= hi(tg)
          ) {
            if (ewPair) {
              s.point.y = shared;
              t.point.y = shared;
            } else {
              s.point.x = shared;
              t.point.x = shared;
            }
          }
        }
      }
    }
    // Owner 2026-07-28: PURE PORT pairs also straighten when the
    // shared line stays WITHIN BOTH PORTS' OWN BODIES: the anchor
    // remains on the port (its 12px body edge), just off-center,
    // which SysML tools accept visually. Ports never leave their
    // declared bodies (the LR-21 principle holds).
    else if (e.sourcePort !== undefined && e.targetPort !== undefined) {
      const sp = geometry.ports[e.sourcePort];
      const tp = geometry.ports[e.targetPort];
      const ewPair =
        (s.side === "EAST" || s.side === "WEST") &&
        (t.side === "EAST" || t.side === "WEST");
      const nsPair =
        (s.side === "NORTH" || s.side === "SOUTH") &&
        (t.side === "NORTH" || t.side === "SOUTH");
      if (sp !== undefined && tp !== undefined && (ewPair || nsPair)) {
        const crossS = ewPair ? s.point.y : s.point.x;
        const crossT = ewPair ? t.point.y : t.point.x;
        const delta = Math.abs(crossS - crossT);
        if (delta > 0) {
          const shared = (crossS + crossT) / 2;
          const PAD = 1;
          const within = (g: {
            x: number;
            y: number;
            width: number;
            height: number;
          }): boolean =>
            ewPair
              ? shared >= g.y + PAD && shared <= g.y + g.height - PAD
              : shared >= g.x + PAD && shared <= g.x + g.width - PAD;
          if (within(sp) && within(tp)) {
            if (ewPair) {
              s.point.y = shared;
              t.point.y = shared;
            } else {
              s.point.x = shared;
              t.point.x = shared;
            }
          }
        }
      }
    }
    // VR-8 (owner verification 2026-07-26): MIXED pairs (one port,
    // one box: the parametric bindings) also straighten: the PORT
    // stays where declared (LR-21 principle) and the BOX anchor
    // slides to the port's tangent when facing sides align within
    // the snap and the coordinate stays inside the box's span.
    else if ((e.sourcePort === undefined) !== (e.targetPort === undefined)) {
      const boxEnd = e.sourcePort === undefined ? s : t;
      const portEnd = e.sourcePort === undefined ? t : s;
      const boxId = e.sourcePort === undefined ? e.source : e.target;
      const bg = boxOf.get(boxId);
      const SNAP = 12;
      const MARGIN = 6;
      const ewPair =
        (boxEnd.side === "EAST" || boxEnd.side === "WEST") &&
        (portEnd.side === "EAST" || portEnd.side === "WEST");
      const nsPair =
        (boxEnd.side === "NORTH" || boxEnd.side === "SOUTH") &&
        (portEnd.side === "NORTH" || portEnd.side === "SOUTH");
      if (bg !== undefined && (ewPair || nsPair)) {
        const portCross = ewPair ? portEnd.point.y : portEnd.point.x;
        const boxCross = ewPair ? boxEnd.point.y : boxEnd.point.x;
        const delta = Math.abs(portCross - boxCross);
        const lo = (ewPair ? bg.y : bg.x) + MARGIN;
        const hi = (ewPair ? bg.y + bg.height : bg.x + bg.width) - MARGIN;
        if (delta > 0 && delta <= SNAP && portCross >= lo && portCross <= hi) {
          if (ewPair) boxEnd.point.y = portCross;
          else boxEnd.point.x = portCross;
        }
      }
    }
    // LR-17 + VR-7a: EVERY anchored end gets a STUB along its side
    // normal (ports AND boxes), computed AFTER the snap pass so
    // snapped anchors keep matching tips. With stubs placing route
    // endpoints outside the blocks, endpoint boxes stay in the
    // obstacle set, so a route can no longer legally cross its own
    // source or target block (the BDD through-the-block screenshots).
    // Must EXCEED the escalated router's obstacle inflation
    // (clearance 12), or the stub tip sits inside the inflated
    // endpoint box and the router reports unreachable, falling back
    // to the crossing simple route.
    const STUB = 14;
    const outward = (a: { point: Pt; side: RouteSide }): Pt =>
      a.side === "EAST"
        ? { x: a.point.x + STUB, y: a.point.y }
        : a.side === "WEST"
          ? { x: a.point.x - STUB, y: a.point.y }
          : a.side === "SOUTH"
            ? { x: a.point.x, y: a.point.y + STUB }
            : { x: a.point.x, y: a.point.y - STUB };
    const sTip = outward(s);
    const tTip = outward(t);
    // PRF-003 brief 05a: channel router branch. When the flag is on
    // AND a plan is supplied, route via the channel model; overflow
    // (edges beyond a channel's demand) delegates to routeOrthogonal.
    // If both fail, fall through to `simple` so no edge disappears.
    if (channelPlan !== undefined && channelAssignment !== null) {
      const isOverflow = channelAssignment.overflow.has(e.id);
      if (!isOverflow) {
        const points = emitChannelRoute(
          {
            id: e.id,
            source: e.source,
            target: e.target,
          },
          {
            source: s,
            sourceTip: sTip,
            target: t,
            targetTip: tTip,
          },
          channelPlan,
          channelAssignment,
        );
        out[e.id] = { points };
        continue;
      }
      const overflowRoute = routeChannelOverflow(
        {
          source: s,
          sourceTip: sTip,
          target: t,
          targetTip: tTip,
        },
        obstacles,
      );
      if (overflowRoute !== null) {
        out[e.id] = { points: overflowRoute };
        continue;
      }
      // Overflow router refused: emit an honest simple template. The
      // channel-router path does NOT fall back to the escalation ladder
      // (05b deletes the ladder outright); dropping here mirrors the
      // ladder's end state and keeps the edge in the output.
      const sEwOF = s.side === "EAST" || s.side === "WEST";
      const tEwOF = t.side === "EAST" || t.side === "WEST";
      const simpleOF =
        sEwOF && tEwOF
          ? dedupeCollinear([
              s.point,
              sTip,
              { x: (sTip.x + tTip.x) / 2, y: sTip.y },
              { x: (sTip.x + tTip.x) / 2, y: tTip.y },
              tTip,
              t.point,
            ])
          : !sEwOF && !tEwOF
            ? dedupeCollinear([
                s.point,
                sTip,
                { x: sTip.x, y: (sTip.y + tTip.y) / 2 },
                { x: tTip.x, y: (sTip.y + tTip.y) / 2 },
                tTip,
                t.point,
              ])
            : dedupeCollinear([
                s.point,
                sTip,
                sEwOF ? { x: tTip.x, y: sTip.y } : { x: sTip.x, y: tTip.y },
                tTip,
                t.point,
              ]);
      out[e.id] = { points: simpleOF };
      continue;
    }
    // Gap route: jog once at the midline between the two anchor
    // borders, along the flow axis: a vertical jog in the gap under
    // horizontal flow, a horizontal jog under vertical flow.
    // VR-7d (owner re-verify 2026-07-28): the template follows the
    // SIDE GEOMETRY, not the flow axis. The old flow-based Z gave
    // an E/W pair under vertical flow a four-bend vertical jog by
    // construction (the owner's "defaulting to FOUR bends"). An
    // E/W pair takes the horizontal Z (0 bends when snapped, 2
    // otherwise); an N/S pair the vertical Z; a mixed pair a
    // single-corner L.
    const sEw = s.side === "EAST" || s.side === "WEST";
    const tEw = t.side === "EAST" || t.side === "WEST";
    const simple =
      sEw && tEw
        ? ((): Pt[] => {
            const midX = (sTip.x + tTip.x) / 2;
            return dedupeCollinear([
              s.point,
              sTip,
              { x: midX, y: sTip.y },
              { x: midX, y: tTip.y },
              tTip,
              t.point,
            ]);
          })()
        : !sEw && !tEw
          ? ((): Pt[] => {
              const midY = (sTip.y + tTip.y) / 2;
              return dedupeCollinear([
                s.point,
                sTip,
                { x: sTip.x, y: midY },
                { x: tTip.x, y: midY },
                tTip,
                t.point,
              ]);
            })()
          : // Mixed pair: one corner where the E/W tip's row meets
            // the N/S tip's column.
            dedupeCollinear([
              s.point,
              sTip,
              sEw ? { x: tTip.x, y: sTip.y } : { x: sTip.x, y: tTip.y },
              tTip,
              t.point,
            ]);
    // Verify against the boxes the route must clear (not its own
    // endpoints'). PRF: a bounding-box prefilter first: gap routes
    // are narrow corridors, so testing only obstacles that overlap
    // the route's bbox removes the O(edges x boxes) scan that
    // dominated scene routing at R1 scale.
    let bx1 = Infinity;
    let by1 = Infinity;
    let bx2 = -Infinity;
    let by2 = -Infinity;
    for (const pnt of simple) {
      bx1 = Math.min(bx1, pnt.x);
      by1 = Math.min(by1, pnt.y);
      bx2 = Math.max(bx2, pnt.x);
      by2 = Math.max(by2, pnt.y);
    }
    const near = obstacles.filter(
      (b) =>
        b.x < bx2 && b.x + b.width > bx1 && b.y < by2 && b.y + b.height > by1,
    );
    // Long-edge perimeter policy (owner ruling 2026-08-14): before
    // accepting a clean simple route through a dense field, prefer a
    // perimeter detour so the line reads outside the wall rather than
    // threading its interior corridors. Eligibility uses the same
    // near-set the accept check already computed. Null-safe: if no
    // detour clears, we fall through to the existing accept and the
    // simple route stands (the policy never converts a legal route
    // into a violation).
    if (near.length >= longEdgeNear) {
      const CLEAR = 16;
      const horizontalTravel =
        Math.abs(tTip.x - sTip.x) >= Math.abs(tTip.y - sTip.y);
      // VR-10 (owner Jake, 2026-08-14): eligibility is still judged on
      // the simple route's near-set (unchanged, so ineligible edges
      // stay byte-identical), but the perimeter rail is VERIFIED
      // against the travel band from the FULL obstacle set. `near`
      // omits everything outside the simple route's bbox, and a
      // perimeter rail leaves that bbox by definition -- that gap put
      // pskip.0 through 19 boxes of row p0 while passing its own
      // check. Both bound sets stay on offer (near ⊆ band, so the
      // near-derived rail is the tighter of the two when it verifies).
      const band = travelBand(
        [s.point, sTip, tTip, t.point],
        horizontalTravel,
        obstacles,
      );
      const build = (cross: number): Pt[] =>
        dedupeCollinear(
          horizontalTravel
            ? [
                s.point,
                sTip,
                { x: sTip.x, y: cross },
                { x: tTip.x, y: cross },
                tTip,
                t.point,
              ]
            : [
                s.point,
                sTip,
                { x: cross, y: sTip.y },
                { x: cross, y: tTip.y },
                tTip,
                t.point,
              ],
        );
      const mid = horizontalTravel
        ? (sTip.y + tTip.y) / 2
        : (sTip.x + tTip.x) / 2;
      const cands: Array<{ side: "lo" | "hi"; cross: number; pts: Pt[] }> = [];
      const seenCross = new Set<number>();
      for (const bounds of [
        crossBounds(near, horizontalTravel, CLEAR),
        crossBounds(band, horizontalTravel, CLEAR),
      ]) {
        if (bounds === null) continue;
        for (const side of ["lo", "hi"] as const) {
          const cross = side === "lo" ? bounds.lo : bounds.hi;
          if (seenCross.has(cross)) continue;
          seenCross.add(cross);
          const pts = build(cross);
          if (band.length > 0 && polylineIntersectsBoxes(pts, band)) continue;
          cands.push({ side, cross, pts });
        }
      }
      const chosen =
        cands.length === 0
          ? null
          : cands.sort(
              (a, b) => Math.abs(a.cross - mid) - Math.abs(b.cross - mid),
            )[0];
      if (chosen !== null && chosen !== undefined) {
        out[e.id] = { points: chosen.pts };
        perimeterRoutes.push({
          edgeId: e.id,
          horizontal: horizontalTravel,
          side: chosen.side,
          cross: chosen.cross,
          build,
        });
        continue;
      }
    }
    // LAY-005: bend-hint seeding for non-perimeter-eligible edges.
    // The hints came from dummy-chain placement, so they express the
    // ordering's preferred column at each intermediate layer; a
    // hint-seeded polyline threads through those bends and gives the
    // rest of the pipeline (routing verification, nudging, canvas
    // rendering) a route that already respects layered structure.
    // Perimeter-eligible edges skip seeding by policy (the perimeter
    // detour is the right shape for a long line through a dense
    // field). Hints ride out as `intermediate` on the emitted
    // geometry so downstream tooling can distinguish structural bends
    // from routing corrections.
    const hintsForEdge =
      bendHints !== undefined && near.length < longEdgeNear
        ? bendHints.get(e.id)
        : undefined;
    if (hintsForEdge !== undefined && hintsForEdge.length > 0) {
      const horizontalTravel =
        Math.abs(tTip.x - sTip.x) >= Math.abs(tTip.y - sTip.y);
      const seeded: Pt[] = [s.point, sTip];
      let prev: Pt = sTip;
      for (const h of hintsForEdge) {
        if (horizontalTravel) {
          seeded.push({ x: h.x, y: prev.y });
          seeded.push({ x: h.x, y: h.y });
        } else {
          seeded.push({ x: prev.x, y: h.y });
          seeded.push({ x: h.x, y: h.y });
        }
        prev = { x: h.x, y: h.y };
      }
      if (horizontalTravel) seeded.push({ x: tTip.x, y: prev.y });
      else seeded.push({ x: prev.x, y: tTip.y });
      seeded.push(tTip);
      seeded.push(t.point);
      const seededPts = dedupeCollinear(seeded);
      const seededNear = obstacles.filter((b) => {
        let sx1 = Infinity;
        let sy1 = Infinity;
        let sx2 = -Infinity;
        let sy2 = -Infinity;
        for (const pnt of seededPts) {
          sx1 = Math.min(sx1, pnt.x);
          sy1 = Math.min(sy1, pnt.y);
          sx2 = Math.max(sx2, pnt.x);
          sy2 = Math.max(sy2, pnt.y);
        }
        return (
          b.x < sx2 && b.x + b.width > sx1 && b.y < sy2 && b.y + b.height > sy1
        );
      });
      if (!polylineIntersectsBoxes(seededPts, seededNear)) {
        out[e.id] = { points: seededPts, intermediate: [...hintsForEdge] };
        continue;
      }
    }
    if (!polylineIntersectsBoxes(simple, near)) {
      out[e.id] = hintsForEdge
        ? { points: simple, intermediate: [...hintsForEdge] }
        : { points: simple };
      continue;
    }
    const clear = [...obstacles]; // VR-7a: endpoint boxes included
    // Escalate under budget, and ONLY below the grid router's own
    // documented obstacle threshold (64): above it each escalation
    // costs 100+ ms in the full-grid fallback, which is exactly the
    // recorded PRF-002 finding that from-scratch scene routing at
    // scale belongs to the channel router (D3b). Long-span edges in
    // large scenes keep their simple routes, honestly: they may
    // cross boxes until LAY-005 dummies or the channel router land.
    if (obstacles.length <= 64 && Date.now() - t0 < budgetMs) {
      // VR-7a retry ladder: (1) every box as an obstacle at default
      // clearance; (2) tight clearance for dense post-drag packings
      // where a stub tip lands inside a NEIGHBOR's inflation;
      // (3) the pre-VR-7 endpoint exclusion as a last resort, which
      // can cross its own blocks but never regresses below the old
      // baseline. Only then the honest simple fallback.
      const attempts: Array<{
        obstacles: typeof clear;
        clearance?: number;
      }> = [
        { obstacles: clear },
        { obstacles: clear, clearance: 4 },
        {
          obstacles: clear.filter(
            (b) => b.id !== e.source && b.id !== e.target,
          ),
        },
      ];
      let done = false;
      for (const attempt of attempts) {
        const routed = routeOrthogonal({
          source: { point: sTip, side: s.side },
          target: { point: tTip, side: t.side },
          obstacles: attempt.obstacles,
          ...(attempt.clearance !== undefined
            ? { clearance: attempt.clearance, minStub: attempt.clearance }
            : {}),
        });
        if (routed !== null) {
          out[e.id] = {
            points: dedupeCollinear([s.point, ...routed.points, t.point]),
            ...(hintsForEdge ? { intermediate: [...hintsForEdge] } : {}),
          };
          done = true;
          break;
        }
        if (Date.now() - t0 >= budgetMs) break;
      }
      if (done) continue;
    }
    // VR-9: the router failed everywhere; detour around the band
    // rather than drawing through it. Straight-simple only when
    // even the detour cannot clear (extreme containment).
    const detour = detourAround(s.point, sTip, t.point, tTip, obstacles, near);
    out[e.id] = {
      points: detour ?? simple,
      ...(hintsForEdge ? { intermediate: [...hintsForEdge] } : {}),
    };
  }
  // Deterministic perimeter stagger: coincident perimeter tracks on
  // the same side of a band derive an identical cross coordinate; walk
  // edge-id groups and offset each track beyond the first by index*8
  // OUTWARD (away from the field). This is input hygiene, not a
  // substitute for nudging; 01-nudging (when it lands) will subsume
  // the ordering, but keeping this pre-pass keeps snapshots stable.
  if (perimeterRoutes.length > 1) {
    const STAGGER = 8;
    const groups = new Map<string, PerimeterRec[]>();
    for (const rec of perimeterRoutes) {
      const key = `${rec.horizontal ? "H" : "V"}#${rec.side}#${Math.round(rec.cross)}`;
      const list = groups.get(key) ?? [];
      list.push(rec);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => (a.edgeId < b.edgeId ? -1 : 1));
      list.forEach((rec, i) => {
        if (i === 0) return;
        const delta = (rec.side === "lo" ? -1 : 1) * i * STAGGER;
        out[rec.edgeId] = { points: rec.build(rec.cross + delta) };
      });
    }
  }
  if (options?.nudge) {
    const { routes } = nudgeRoutes(out, obstacles, {
      trackGap: options?.trackGap,
    });
    return routes;
  }
  return out;
}
