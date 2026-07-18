/**
 * Orthogonal obstacle-aware edge router (G3L:RTE-011; workstream B4).
 *
 * Purpose: incremental rerouting during interaction (MR-8): when a
 * node drags, its incident edges must (a) stay anchored at the node
 * BORDER, leaving perpendicular to the attach side, and (b) never
 * route over other nodes. ELK owns from-scratch scene routing; this
 * router owns the interactive path.
 *
 * Method: the classic sparse orthogonal visibility grid with A*
 * search and a bend penalty, per the published literature on
 * object-avoiding orthogonal connector routing (Wybrow, Marriott &
 * Stuckey's algorithm papers; this is an independent implementation
 * from the papers' ideas, no libavoid code, which stays rejected on
 * LGPL grounds). It is deliberately DISTINCT from the patented
 * interactive-routing methods surveyed in Phase 1 (US 8,542,234;
 * US 9,082,226; US 12,051,137): plain grid construction over
 * inflated obstacle borders, no incremental-nudge or
 * lane-reservation machinery from those claims.
 *
 * Coordinates are the same absolute space as StructuralGeometry
 * (top-left boxes, y down).
 */

export interface RouteBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RouteSide = "NORTH" | "SOUTH" | "EAST" | "WEST";

export interface RouteTerminal {
  /** Absolute anchor point ON the node border. The returned route
   *  starts/ends exactly here. */
  point: { x: number; y: number };
  /** The border side the anchor sits on; the first/last segment
   *  leaves/enters perpendicular to it (the MR-8(a) contract). */
  side: RouteSide;
}

export interface OrthogonalRouteRequest {
  source: RouteTerminal;
  target: RouteTerminal;
  /** Boxes the route must clear, EXCLUDING the endpoint nodes' own
   *  boxes (anchors sit on those borders by definition). */
  obstacles: readonly RouteBox[];
  /** Minimum distance kept from obstacle borders (and the length of
   *  the perpendicular exit stubs). Default 12. */
  clearance?: number;
  /** A* cost per direction change; higher = straighter routes.
   *  Default 30. */
  bendPenalty?: number;
  /** Minimum length of the FIRST and LAST route segments (the
   *  perpendicular exit stubs). UML relationship symbols (diamonds,
   *  hollow triangles) sit on the terminal segments; an immediate
   *  bend buries them (owner finding, 2026-07-11). Tried at full
   *  length first, degrading toward `clearance` when a long stub
   *  lands inside an inflated obstacle. Default 28. */
  minStub?: number;
}

interface Pt {
  x: number;
  y: number;
}

/** Guarded index access (the repo forbids non-null assertions in
 *  source): every call site's index is in range by construction, so
 *  a miss is a router invariant violation, not a routing failure. */
function at<T>(v: T | undefined): T {
  if (v === undefined) {
    throw new Error("orthogonal-router invariant: index out of range");
  }
  return v;
}

const DIRS: readonly { dx: number; dy: number }[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

function stub(p: Pt, side: RouteSide, len: number): Pt {
  switch (side) {
    case "NORTH":
      return { x: p.x, y: p.y - len };
    case "SOUTH":
      return { x: p.x, y: p.y + len };
    case "EAST":
      return { x: p.x + len, y: p.y };
    case "WEST":
      return { x: p.x - len, y: p.y };
  }
}

function strictlyInside(p: Pt, b: RouteBox, eps: number): boolean {
  return (
    p.x > b.x + eps &&
    p.x < b.x + b.width - eps &&
    p.y > b.y + eps &&
    p.y < b.y + b.height - eps
  );
}

/**
 * Route an orthogonal, obstacle-clear polyline between two border
 * anchors. Returns the full point list INCLUDING both anchor points
 * (collinear interior points removed), or null when no clear path
 * exists in the grid (callers fall back to their previous behavior).
 */
export function routeOrthogonal(
  req: OrthogonalRouteRequest,
): { points: Pt[] } | null {
  // Obstacle pruning at scale (PRF-002 finding, 2026-07-12): the
  // sparse grid is quadratic in obstacle count, and interactive
  // scenes pass dozens of obstacles while from-scratch scene routing
  // (R1: 500 boxes per edge) passes hundreds. Above a threshold,
  // route against only the obstacles near the terminals' region,
  // then VERIFY the result against the FULL set; any crossing (or a
  // null) falls back to the unpruned computation, so pruning is an
  // optimization with correctness preserved by construction.
  if (req.obstacles.length > 64) {
    const c = req.clearance ?? 12;
    const margin = 8 * c + 2 * (req.minStub ?? 28) + 160;
    const x1 = Math.min(req.source.point.x, req.target.point.x) - margin;
    const x2 = Math.max(req.source.point.x, req.target.point.x) + margin;
    const y1 = Math.min(req.source.point.y, req.target.point.y) - margin;
    const y2 = Math.max(req.source.point.y, req.target.point.y) + margin;
    const near = req.obstacles.filter(
      (b) => b.x < x2 && b.x + b.width > x1 && b.y < y2 && b.y + b.height > y1,
    );
    if (near.length < req.obstacles.length) {
      const pruned = routeOrthogonal({ ...req, obstacles: near });
      if (
        pruned !== null &&
        !polylineIntersectsBoxes(pruned.points, req.obstacles)
      ) {
        return pruned;
      }
      // fall through to the full computation
    }
  }
  const clearance = req.clearance ?? 12;
  const bendPenalty = req.bendPenalty ?? 30;
  const minStub = Math.max(req.minStub ?? 28, clearance);
  const eps = 1e-6;

  // Inflate obstacles by clearance: grid points and segments must
  // stay OUT of the inflated interiors, which keeps real routes at
  // least `clearance` from real borders.
  const inflated: RouteBox[] = req.obstacles.map((b) => ({
    x: b.x - clearance,
    y: b.y - clearance,
    width: b.width + 2 * clearance,
    height: b.height + 2 * clearance,
  }));

  // Perpendicular exit stubs: the search runs stub-to-stub, and the
  // anchor points are prepended/appended verbatim, which GUARANTEES
  // the first/last segments are perpendicular to the attach sides
  // and at least the stub length long (the pre-bend buffer that
  // keeps UML terminal symbols on a straight run). Each terminal
  // independently degrades toward `clearance` when its long stub
  // would land inside an inflated obstacle.
  const stubLengths = [minStub, Math.max(clearance, minStub / 2), clearance];
  const freeStub = (p: Pt, side: RouteSide): Pt => {
    for (const len of stubLengths) {
      const cand = stub(p, side, len);
      if (!inflated.some((b) => strictlyInside(cand, b, eps))) return cand;
    }
    return stub(p, side, clearance);
  };
  const s = freeStub(req.source.point, req.source.side);
  const t = freeStub(req.target.point, req.target.side);

  // Interesting coordinates: every inflated border plus both stubs.
  const xsSet = new Set<number>([s.x, t.x]);
  const ysSet = new Set<number>([s.y, t.y]);
  for (const b of inflated) {
    xsSet.add(b.x);
    xsSet.add(b.x + b.width);
    ysSet.add(b.y);
    ysSet.add(b.y + b.height);
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const ys = [...ysSet].sort((a, b) => a - b);
  const xi = new Map(xs.map((v, i) => [v, i] as const));
  const yi = new Map(ys.map((v, i) => [v, i] as const));

  const cols = xs.length;
  const rows = ys.length;
  const nodeId = (cx: number, cy: number) => cy * cols + cx;
  const blockedPoint = (cx: number, cy: number): boolean => {
    const p = { x: at(xs[cx]), y: at(ys[cy]) };
    return inflated.some((b) => strictlyInside(p, b, eps));
  };
  // A step between ADJACENT interesting coords is blocked iff its
  // midpoint lies strictly inside an inflated box (borders are legal:
  // they already carry the clearance).
  const blockedStep = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): boolean => {
    const mid = {
      x: (at(xs[ax]) + at(xs[bx])) / 2,
      y: (at(ys[ay]) + at(ys[by])) / 2,
    };
    return inflated.some((b) => strictlyInside(mid, b, eps));
  };

  const sc = at(xi.get(s.x));
  const sr = at(yi.get(s.y));
  const tc = at(xi.get(t.x));
  const tr = at(yi.get(t.y));
  if (blockedPoint(sc, sr) || blockedPoint(tc, tr)) return null;

  // A* over (grid node, incoming direction) states; deterministic via
  // an insertion-order tiebreak.
  interface State {
    cx: number;
    cy: number;
    dir: number; // index into DIRS, -1 at start
    g: number;
    f: number;
    order: number;
    prev: State | null;
  }
  const h = (cx: number, cy: number) =>
    Math.abs(at(xs[cx]) - at(xs[tc])) + Math.abs(at(ys[cy]) - at(ys[tr]));
  const open: State[] = [];
  let counter = 0;
  const push = (st: State) => {
    open.push(st);
    let i = open.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const a = at(open[i]);
      const b = at(open[parent]);
      if (a.f < b.f || (a.f === b.f && a.order < b.order)) {
        open[i] = b;
        open[parent] = a;
        i = parent;
      } else break;
    }
  };
  const pop = (): State | undefined => {
    const top = open[0];
    const last = open.pop();
    if (open.length > 0 && last) {
      open[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        const better = (a: number, b: number) => {
          const A = at(open[a]);
          const B = at(open[b]);
          return A.f < B.f || (A.f === B.f && A.order < B.order);
        };
        if (l < open.length && better(l, best)) best = l;
        if (r < open.length && better(r, best)) best = r;
        if (best === i) break;
        const tmp = at(open[i]);
        open[i] = at(open[best]);
        open[best] = tmp;
        i = best;
      }
    }
    return top;
  };

  const bestG = new Map<number, number>(); // (node*4 + dir+? ) -> g
  const stateKey = (cx: number, cy: number, dir: number) =>
    nodeId(cx, cy) * 5 + (dir + 1);
  const start: State = {
    cx: sc,
    cy: sr,
    dir: -1,
    g: 0,
    f: h(sc, sr),
    order: counter++,
    prev: null,
  };
  push(start);
  bestG.set(stateKey(sc, sr, -1), 0);

  let goal: State | null = null;
  while (open.length > 0) {
    const cur = pop();
    if (cur === undefined) break;
    if (cur.cx === tc && cur.cy === tr) {
      goal = cur;
      break;
    }
    if ((bestG.get(stateKey(cur.cx, cur.cy, cur.dir)) ?? Infinity) < cur.g) {
      continue;
    }
    for (let d = 0; d < DIRS.length; d++) {
      const dir = at(DIRS[d]);
      const nx = cur.cx + dir.dx;
      const ny = cur.cy + dir.dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (blockedPoint(nx, ny)) continue;
      if (blockedStep(cur.cx, cur.cy, nx, ny)) continue;
      const stepLen =
        Math.abs(at(xs[nx]) - at(xs[cur.cx])) +
        Math.abs(at(ys[ny]) - at(ys[cur.cy]));
      const bend = cur.dir !== -1 && cur.dir !== d ? bendPenalty : 0;
      const g = cur.g + stepLen + bend;
      const key = stateKey(nx, ny, d);
      if (g < (bestG.get(key) ?? Infinity)) {
        bestG.set(key, g);
        push({
          cx: nx,
          cy: ny,
          dir: d,
          g,
          f: g + h(nx, ny),
          order: counter++,
          prev: cur,
        });
      }
    }
  }
  if (!goal) return null;

  // Reconstruct stub-to-stub, then wrap with the true anchors and
  // drop collinear interior points.
  const raw: Pt[] = [];
  for (let st: State | null = goal; st !== null; st = st.prev) {
    raw.push({ x: at(xs[st.cx]), y: at(ys[st.cy]) });
  }
  raw.reverse();
  const full: Pt[] = [req.source.point, ...raw, req.target.point];
  const points: Pt[] = [];
  for (const p of full) {
    const a = points[points.length - 2];
    const b = points[points.length - 1];
    if (
      b !== undefined &&
      Math.abs(b.x - p.x) < eps &&
      Math.abs(b.y - p.y) < eps
    ) {
      continue; // exact duplicate
    }
    if (
      a !== undefined &&
      b !== undefined &&
      ((Math.abs(a.x - b.x) < eps && Math.abs(b.x - p.x) < eps) ||
        (Math.abs(a.y - b.y) < eps && Math.abs(b.y - p.y) < eps))
    ) {
      points[points.length - 1] = p; // extend collinear run
      continue;
    }
    points.push(p);
  }
  return { points };
}

/**
 * Does an orthogonal polyline pass through any box interior?
 * (Touching a border is not a crossing.) Used to decide whether a
 * cheap rescale result is acceptable or an obstacle-aware reroute is
 * required (G3L:RTE-011 drag policy: preserve ELK's route shape when
 * it stays clear, reroute only on collision).
 */
export function polylineIntersectsBoxes(
  points: readonly { x: number; y: number }[],
  boxes: readonly RouteBox[],
): boolean {
  const eps = 1e-6;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const sx1 = Math.min(a.x, b.x);
    const sx2 = Math.max(a.x, b.x);
    const sy1 = Math.min(a.y, b.y);
    const sy2 = Math.max(a.y, b.y);
    for (const box of boxes) {
      const overlapX = sx1 < box.x + box.width - eps && sx2 > box.x + eps;
      const overlapY = sy1 < box.y + box.height - eps && sy2 > box.y + eps;
      if (overlapX && overlapY) return true;
    }
  }
  return false;
}
