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

interface Pt {
  x: number;
  y: number;
}

function dedupeCollinear(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    if (
      a !== undefined &&
      b !== undefined &&
      ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))
    ) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
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
  near: readonly RouteBox[],
): Pt[] | null {
  if (near.length === 0) return null;
  const CLEAR = 16;
  const horizontalTravel =
    Math.abs(tTip.x - sTip.x) >= Math.abs(tTip.y - sTip.y);
  const lo =
    Math.min(...near.map((b) => (horizontalTravel ? b.y : b.x))) - CLEAR;
  const hi =
    Math.max(
      ...near.map((b) => (horizontalTravel ? b.y + b.height : b.x + b.width)),
    ) + CLEAR;
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
  const candidates = [mk(lo), mk(hi)].filter(
    (pts) => !polylineIntersectsBoxes(pts, near),
  );
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
  },
): Record<string, { points: Pt[] }> {
  // Direction-aware (WS-D D3a fix): under horizontal flow (RIGHT/
  // LEFT, the default) edges leave EAST/WEST and jog VERTICALLY in
  // the inter-layer gap; under vertical flow they leave NORTH/SOUTH
  // and jog horizontally. Anchoring against the flow axis routes
  // through sibling boxes and escalates everything (measured: 800/
  // 800 escalations on R1).
  const direction = options?.direction ?? "RIGHT";
  const horizontal = direction === "RIGHT" || direction === "LEFT";
  const budgetMs = options?.routingBudgetMs ?? 80;
  const out: Record<string, { points: Pt[] }> = {};
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
    const ordered = sidesFor(node, other);
    for (let i = 0; i < ordered.length; i++) {
      const side = ordered[i];
      if (side === undefined) continue;
      const a = buildAnchor(side, i === 0 ? fanPreferred : undefined);
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
    if (!polylineIntersectsBoxes(simple, near)) {
      out[e.id] = { points: simple };
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
    const detour = detourAround(s.point, sTip, t.point, tTip, near);
    out[e.id] = { points: detour ?? simple };
  }
  return out;
}
