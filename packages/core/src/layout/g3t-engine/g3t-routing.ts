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

export function routeStructuralEdges(
  input: StructuralGraphInput,
  geometry: StructuralGeometry,
  options?: { routingBudgetMs?: number; direction?: string },
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
  const sideFor = (from: string, to: string): RouteSide =>
    horizontal
      ? centerX(to) >= centerX(from)
        ? "EAST"
        : "WEST"
      : centerY(to) >= centerY(from)
        ? "SOUTH"
        : "NORTH";
  // The fan coordinate is the CROSS axis: y-anchors on E/W sides
  // under horizontal flow, x-anchors on N/S sides under vertical.
  const crossOf = horizontal ? centerY : centerX;
  for (const e of edges) {
    if (!e.sourcePort) {
      const sd = sideFor(e.source, e.target);
      const k = fanKey(e.source, sd);
      const list = fans.get(k);
      const entry = { edge: e.id, otherX: crossOf(e.target) };
      if (list) list.push(entry);
      else fans.set(k, [entry]);
    }
    if (!e.targetPort) {
      const sd = sideFor(e.target, e.source);
      const k = fanKey(e.target, sd);
      const list = fans.get(k);
      const entry = { edge: e.id, otherX: crossOf(e.source) };
      if (list) list.push(entry);
      else fans.set(k, [entry]);
    }
  }
  const fanOffset = new Map<string, number>(); // `${edge}@${node}` -> cross coord
  for (const [key, list] of fans) {
    const [node] = key.split("#");
    const g = node === undefined ? undefined : boxOf.get(node);
    if (g === undefined) continue;
    const sorted = [...list].sort(
      (a, b) => a.otherX - b.otherX || (a.edge < b.edge ? -1 : 1),
    );
    sorted.forEach((a, i) => {
      const frac = (i + 1) / (sorted.length + 1);
      fanOffset.set(
        `${a.edge}@${node}`,
        horizontal ? g.y + frac * g.height : g.x + frac * g.width,
      );
    });
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
  ): { point: Pt; side: RouteSide } | null => {
    const node = end === "s" ? e.source : e.target;
    const portId = end === "s" ? e.sourcePort : e.targetPort;
    if (portId !== undefined) {
      const p = geometry.ports[portId];
      if (p !== undefined) {
        const cx = p.x + p.width / 2;
        const cy = p.y + p.height / 2;
        return { point: { x: cx, y: cy }, side: p.side };
      }
    }
    const g = boxOf.get(node);
    if (g === undefined) return null;
    const other = end === "s" ? e.target : e.source;
    const side = sideFor(node, other);
    const cross =
      fanOffset.get(`${e.id}@${node}`) ??
      (horizontal ? g.y + g.height / 2 : g.x + g.width / 2);
    if (horizontal) {
      return {
        point: { x: side === "EAST" ? g.x + g.width : g.x, y: cross },
        side,
      };
    }
    return {
      point: { x: cross, y: side === "SOUTH" ? g.y + g.height : g.y },
      side,
    };
  };

  const t0 = Date.now();
  for (const e of edges) {
    const s = anchorOf(e, "s");
    const t = anchorOf(e, "t");
    if (s === null || t === null) continue;
    // Gap route: jog once at the midline between the two anchor
    // borders, along the flow axis: a vertical jog in the gap under
    // horizontal flow, a horizontal jog under vertical flow.
    const simple = horizontal
      ? ((): Pt[] => {
          const midX = (s.point.x + t.point.x) / 2;
          return dedupeCollinear([
            s.point,
            { x: midX, y: s.point.y },
            { x: midX, y: t.point.y },
            t.point,
          ]);
        })()
      : ((): Pt[] => {
          const midY = (s.point.y + t.point.y) / 2;
          return dedupeCollinear([
            s.point,
            { x: s.point.x, y: midY },
            { x: t.point.x, y: midY },
            t.point,
          ]);
        })();
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
        b.id !== e.source &&
        b.id !== e.target &&
        b.x < bx2 &&
        b.x + b.width > bx1 &&
        b.y < by2 &&
        b.y + b.height > by1,
    );
    if (!polylineIntersectsBoxes(simple, near)) {
      out[e.id] = { points: simple };
      continue;
    }
    const clear = obstacles.filter(
      (b) => b.id !== e.source && b.id !== e.target,
    );
    // Escalate under budget, and ONLY below the grid router's own
    // documented obstacle threshold (64): above it each escalation
    // costs 100+ ms in the full-grid fallback, which is exactly the
    // recorded PRF-002 finding that from-scratch scene routing at
    // scale belongs to the channel router (D3b). Long-span edges in
    // large scenes keep their simple routes, honestly: they may
    // cross boxes until LAY-005 dummies or the channel router land.
    if (obstacles.length <= 64 && Date.now() - t0 < budgetMs) {
      const routed = routeOrthogonal({
        source: { point: s.point, side: s.side },
        target: { point: t.point, side: t.side },
        obstacles: clear,
      });
      if (routed !== null) {
        out[e.id] = { points: routed.points };
        continue;
      }
    }
    out[e.id] = { points: simple };
  }
  return out;
}
