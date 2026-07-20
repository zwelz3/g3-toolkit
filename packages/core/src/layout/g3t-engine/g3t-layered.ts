/**
 * The g3t layered layout engine, stage D1 (WS-D; spec LAY-001..006).
 *
 * Flat graphs end-to-end: IR, greedy cycle removal (Eades-Lin-
 * Smyth), layering, BUDGETED crossing minimization (barycenter +
 * transpose with early exit: the design's load-bearing decision),
 * median placement with overlap resolution, geometry emission. No
 * edge routing by design (the router boundary stays).
 *
 * D1 deviations from the end-state design, recorded here and in the
 * design doc:
 * - Layering is tightened longest-path (network-simplex's tight-
 *   tree phase, without pivoting). Full network-simplex and
 *   Coffman-Graham (LAY-002's selectable pair) land in D2.
 * - Placement is iterative median with collision resolution;
 *   Brandes-Koepf (LAY-004) lands in D2.
 * - Containers are out of scope until the D2 containment pre-pass;
 *   the engine seam in layoutStructural only routes FLAT inputs
 *   here.
 *
 * Determinism (QLT-001): all iteration orders are id-sorted; ties
 * break lexicographically; identical inputs emit identical bytes.
 */
import type { StructuralGeometry, StructuralGraphInput } from "../structural";

export interface G3tLayoutOptions {
  /** Gap between layers (flow axis). Default 64. */
  layerSpacing?: number;
  /** Gap between nodes within a layer. Default 24. */
  nodeSpacing?: number;
  /** Crossing-minimization time budget in ms. Default 60. */
  orderingBudgetMs?: number;
  /** Maximum barycenter+transpose sweep pairs. Default 8. */
  maxSweeps?: number;
  /** Layering strategy (LAY-002). Default "network-simplex". */
  layering?: "network-simplex" | "coffman-graham" | "tight-tree";
  /** Network-simplex time budget in ms (anytime: ranks stay
   *  feasible between pivots, so expiry returns the best-so-far
   *  layering). Default 120. */
  /* PRF-001 phase allocation: NS 80 / ordering 60 / routing 80
   * within the 300 ms total; raise for quality-over-latency. */
  layeringBudgetMs?: number;
  /** Layer width bound for coffman-graham (node count). Default 8. */
  layerWidth?: number;
  /** Placement strategy (LAY-004). Default "brandes-koepf". */
  placement?: "brandes-koepf" | "median";
  /**
   * Scene-routing escalation budget in ms (default 80): gap routes
   * that intersect a box escalate to the grid router until the
   * budget is spent; the simple route stands after (best-so-far).
   */
  routingBudgetMs?: number;
}

interface FlatNode {
  id: string;
  width: number;
  height: number;
}
interface FlatEdge {
  id: string;
  source: string;
  target: string;
}

/** Guarded accessor (house rule: no non-null assertions in source).
 *  Engine invariants guarantee presence; a miss is a bug and throws. */
function at<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`g3t engine invariant: ${what}`);
  return v;
}

const DEFAULT_W = 100;
const DEFAULT_H = 44;

function flatten(input: StructuralGraphInput): {
  nodes: FlatNode[];
  edges: FlatEdge[];
} {
  const nodes = [...input.nodes]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((n) => ({
      id: n.id,
      width: n.width ?? DEFAULT_W,
      height: n.height ?? DEFAULT_H,
    }));
  const edges = [...input.edges]
    .filter((e) => e.source !== e.target)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((e) => ({ id: e.id, source: e.source, target: e.target }));
  return { nodes, edges };
}

/** Greedy cycle removal (Eades-Lin-Smyth): returns the edge ids to
 *  treat as reversed so the remainder is acyclic. */
export function removeCycles(
  nodes: readonly FlatNode[],
  edges: readonly FlatEdge[],
): Set<string> {
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    inn.set(n.id, []);
  }
  for (const e of edges) {
    out.get(e.source)?.push(e.id);
    inn.get(e.target)?.push(e.id);
  }
  const left: string[] = [];
  const right: string[] = [];
  const alive = new Set(nodes.map((n) => n.id));
  const edgeById = new Map(edges.map((e) => [e.id, e] as const));
  // Incremental degrees (PRF-001 flip finding): the per-query
  // filter recomputation was O(V*E) across the run; removing a node
  // now decrements its neighbors instead.
  const outDeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const inDeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (e.source === e.target) continue;
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }
  const removeNode = (id: string): void => {
    alive.delete(id);
    for (const eid of out.get(id) ?? []) {
      const e = edgeById.get(eid);
      if (e !== undefined && alive.has(e.target)) {
        inDeg.set(e.target, (inDeg.get(e.target) ?? 1) - 1);
      }
    }
    for (const eid of inn.get(id) ?? []) {
      const e = edgeById.get(eid);
      if (e !== undefined && alive.has(e.source)) {
        outDeg.set(e.source, (outDeg.get(e.source) ?? 1) - 1);
      }
    }
  };
  const degOut = (id: string): number => outDeg.get(id) ?? 0;
  const degIn = (id: string): number => inDeg.get(id) ?? 0;
  while (alive.size > 0) {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const id of [...alive].sort()) {
        if (degOut(id) === 0) {
          right.unshift(id);
          removeNode(id);
          progressed = true;
        }
      }
      for (const id of [...alive].sort()) {
        if (degIn(id) === 0) {
          left.push(id);
          removeNode(id);
          progressed = true;
        }
      }
    }
    if (alive.size > 0) {
      let best: string | null = null;
      let bestScore = -Infinity;
      for (const id of [...alive].sort()) {
        const score = degOut(id) - degIn(id);
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (best !== null) {
        left.push(best);
        removeNode(best);
      }
    }
  }
  const order = new Map([...left, ...right].map((id, i) => [id, i] as const));
  const reversed = new Set<string>();
  for (const e of edges) {
    const a = order.get(e.source) ?? 0;
    const b = order.get(e.target) ?? 0;
    if (a > b) reversed.add(e.id);
  }
  return reversed;
}

/** Tightened longest-path layering: longest-path from sources, then
 *  pull every node down toward its nearest successor (the tight-tree
 *  tightening; removes the slack longest-path leaves on sparse
 *  branches). Returns id -> layer (0-based). */
export function assignLayers(
  nodes: readonly FlatNode[],
  edges: readonly FlatEdge[],
  reversed: ReadonlySet<string>,
): Map<string, number> {
  const succ = new Map<string, string[]>();
  const pred = new Map<string, string[]>();
  for (const n of nodes) {
    succ.set(n.id, []);
    pred.set(n.id, []);
  }
  for (const e of edges) {
    const [s, t] = reversed.has(e.id)
      ? [e.target, e.source]
      : [e.source, e.target];
    succ.get(s)?.push(t);
    pred.get(t)?.push(s);
  }
  const layer = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    const got = layer.get(id);
    if (got !== undefined) return got;
    if (seen.has(id)) return 0; // safety: cycles were removed
    seen.add(id);
    let l = 0;
    for (const p of pred.get(id) ?? []) {
      l = Math.max(l, visit(p, seen) + 1);
    }
    layer.set(id, l);
    return l;
  };
  for (const n of nodes) visit(n.id, new Set());
  // Tightening: pull nodes with successors down to minSucc - 1.
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      const ss = succ.get(n.id) ?? [];
      if (ss.length === 0) continue;
      const target = Math.min(...ss.map((t) => layer.get(t) ?? 0)) - 1;
      if (target > (layer.get(n.id) ?? 0)) {
        layer.set(n.id, target);
        changed = true;
      }
    }
  }
  return layer;
}

function countCrossingsBetween(
  upper: readonly string[],
  lowerIndex: ReadonlyMap<string, number>,
  adj: ReadonlyMap<string, readonly string[]>,
): number {
  // Sequence of lower indices in upper order; count inversions.
  const seq: number[] = [];
  for (const u of upper) {
    const targets = [...(adj.get(u) ?? [])]
      .map((t) => lowerIndex.get(t))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);
    seq.push(...targets);
  }
  let crossings = 0;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      const a = seq[i];
      const b = seq[j];
      if (a !== undefined && b !== undefined && a > b) crossings++;
    }
  }
  return crossings;
}

/** Budgeted barycenter + transpose ordering. Returns layers as
 *  ordered id arrays and the achieved crossing count. */
export function orderLayers(
  nodes: readonly FlatNode[],
  edges: readonly FlatEdge[],
  reversed: ReadonlySet<string>,
  layerOf: ReadonlyMap<string, number>,
  options?: Pick<G3tLayoutOptions, "orderingBudgetMs" | "maxSweeps"> & {
    /** Warm-start seam (sketch): initial within-layer order. */
    initialOrder?: (ids: readonly string[]) => string[];
  },
): { layers: string[][]; crossings: number } {
  const budget = options?.orderingBudgetMs ?? 60;
  const maxSweeps = options?.maxSweeps ?? 8;
  const nLayers = Math.max(0, ...[...layerOf.values()].map((l) => l + 1));
  const layers: string[][] = Array.from({ length: nLayers }, () => []);
  for (const n of nodes) layers[layerOf.get(n.id) ?? 0]?.push(n.id);
  for (let i = 0; i < layers.length; i++) {
    const l = at(layers[i], `layer ${i}`);
    layers[i] = options?.initialOrder ? options.initialOrder(l) : l.sort();
  }
  const down = new Map<string, string[]>();
  const up = new Map<string, string[]>();
  for (const n of nodes) {
    down.set(n.id, []);
    up.set(n.id, []);
  }
  for (const e of edges) {
    const [s, t] = reversed.has(e.id)
      ? [e.target, e.source]
      : [e.source, e.target];
    down.get(s)?.push(t);
    up.get(t)?.push(s);
  }
  const totalCrossings = (): number => {
    let c = 0;
    for (let i = 0; i + 1 < layers.length; i++) {
      const idx = new Map(
        at(layers[i + 1], `layer ${i + 1}`).map((id, k) => [id, k] as const),
      );
      c += countCrossingsBetween(at(layers[i], `layer ${i}`), idx, down);
    }
    return c;
  };
  const t0 = Date.now();
  let best = totalCrossings();
  // In-sweep deadline (mirror of the NS granularity fix): a full
  // barycenter+transpose sweep is chunky at scale, so the deadline
  // is consulted inside the per-layer loops too; layers is always a
  // consistent (merely less-refined) ordering at any cut point.
  const expired = (): boolean => Date.now() - t0 > budget;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    if (expired()) break; // best-so-far, by design
    // Barycenter down then up.
    for (const dir of ["down", "up"] as const) {
      const range =
        dir === "down"
          ? [...Array(layers.length).keys()].slice(1)
          : [...Array(layers.length).keys()].slice(0, -1).reverse();
      for (const li of range) {
        if (expired()) break;
        const ref = at(
          dir === "down" ? layers[li - 1] : layers[li + 1],
          `ref layer around ${li}`,
        );
        const refIdx = new Map(ref.map((id, k) => [id, k] as const));
        const adj = dir === "down" ? up : down;
        const keyed = at(layers[li], `layer ${li}`).map((id, k) => {
          const ns = (adj.get(id) ?? [])
            .map((m) => refIdx.get(m))
            .filter((i): i is number => i !== undefined);
          const bc =
            ns.length === 0 ? k : ns.reduce((a, b) => a + b, 0) / ns.length;
          return { id, bc };
        });
        keyed.sort((a, b) => a.bc - b.bc || (a.id < b.id ? -1 : 1));
        layers[li] = keyed.map((x) => x.id);
      }
    }
    // Transpose refinement.
    for (let li = 0; li < layers.length && !expired(); li++) {
      const l = at(layers[li], `layer ${li}`);
      for (let k = 0; k + 1 < l.length; k++) {
        const swapped = [...l];
        const a = at(swapped[k], `slot ${k}`);
        swapped[k] = at(swapped[k + 1], `slot ${k + 1}`);
        swapped[k + 1] = a;
        const before = layerCrossingsAround(layers, li, down, up);
        const trial = [...layers];
        trial[li] = swapped;
        const after = layerCrossingsAround(trial, li, down, up);
        if (after < before) layers[li] = swapped;
      }
    }
    const now = totalCrossings();
    if (now >= best) break; // converged: early exit
    best = now;
  }
  return { layers, crossings: best };
}

function layerCrossingsAround(
  layers: readonly (readonly string[])[],
  li: number,
  down: ReadonlyMap<string, readonly string[]>,
  up: ReadonlyMap<string, readonly string[]>,
): number {
  let c = 0;
  if (li > 0) {
    const idx = new Map(
      at(layers[li], `layer ${li}`).map((id, k) => [id, k] as const),
    );
    c += countCrossingsBetween(
      at(layers[li - 1], `layer ${li - 1}`),
      idx,
      down,
    );
  }
  if (li + 1 < layers.length) {
    const idx = new Map(
      at(layers[li + 1], `layer ${li + 1}`).map((id, k) => [id, k] as const),
    );
    c += countCrossingsBetween(at(layers[li], `layer ${li}`), idx, down);
  }
  void up;
  return c;
}

/** Iterative median placement with within-layer overlap resolution.
 *  Returns id -> x center (flow axis is vertical: layers stack in
 *  y; x is the cross axis). */
export function placeNodes(
  nodes: readonly FlatNode[],
  edges: readonly FlatEdge[],
  reversed: ReadonlySet<string>,
  layers: readonly (readonly string[])[],
  nodeSpacing: number,
): Map<string, number> {
  const width = new Map(nodes.map((n) => [n.id, n.width] as const));
  const x = new Map<string, number>();
  // Initial: pack each layer left-to-right.
  for (const l of layers) {
    let cur = 0;
    for (const id of l) {
      const w = width.get(id) ?? DEFAULT_W;
      x.set(id, cur + w / 2);
      cur += w + nodeSpacing;
    }
  }
  const neighbors = new Map<string, string[]>();
  for (const n of nodes) neighbors.set(n.id, []);
  for (const e of edges) {
    void reversed;
    neighbors.get(e.source)?.push(e.target);
    neighbors.get(e.target)?.push(e.source);
  }
  for (let iter = 0; iter < 4; iter++) {
    for (const l of layers) {
      // Pull to neighbor median, then resolve overlaps left-to-right.
      const desired = l.map((id) => {
        const ns = (neighbors.get(id) ?? [])
          .map((m) => x.get(m))
          .filter((v): v is number => v !== undefined)
          .sort((a, b) => a - b);
        const mid =
          ns.length === 0
            ? at(x.get(id), `x of ${id}`)
            : at(ns[Math.floor(ns.length / 2)], "median neighbor");
        return { id, want: mid };
      });
      let minLeft = -Infinity;
      for (const d of desired) {
        const w = width.get(d.id) ?? DEFAULT_W;
        const left = Math.max(d.want - w / 2, minLeft);
        x.set(d.id, left + w / 2);
        minLeft = left + w + nodeSpacing;
      }
    }
  }
  return x;
}

/** LAY-002 strategy dispatch. */
export function layersFor(
  nodes: readonly FlatNode[],
  edges: readonly FlatEdge[],
  reversed: ReadonlySet<string>,
  options?: Pick<
    G3tLayoutOptions,
    "layering" | "layerWidth" | "layeringBudgetMs"
  >,
): Map<string, number> {
  switch (options?.layering ?? "network-simplex") {
    case "coffman-graham":
      return layeringCoffmanGraham(
        nodes,
        edges,
        reversed,
        options?.layerWidth ?? 8,
      );
    case "tight-tree":
      return assignLayers(nodes, edges, reversed);
    default:
      return layeringNetworkSimplex(
        nodes,
        edges,
        reversed,
        options?.layeringBudgetMs,
      );
  }
}

/** Flat layered layout, end to end. Synchronous and pure. */
export function g3tLayoutFlat(
  input: StructuralGraphInput,
  options?: G3tLayoutOptions,
): StructuralGeometry {
  const { nodes, edges } = flatten(input);
  const layerSpacing = options?.layerSpacing ?? 64;
  const nodeSpacing = options?.nodeSpacing ?? 24;
  const reversed = removeCycles(nodes, edges);
  const layerOf = layersFor(nodes, edges, reversed, options);
  const { layers } = orderLayers(nodes, edges, reversed, layerOf, options);
  const x =
    (options?.placement ?? "brandes-koepf") === "brandes-koepf"
      ? placeBrandesKoepf(nodes, edges, reversed, layers, nodeSpacing)
      : placeNodes(nodes, edges, reversed, layers, nodeSpacing);
  const heightOf = new Map(nodes.map((n) => [n.id, n.height] as const));
  const widthOf = new Map(nodes.map((n) => [n.id, n.width] as const));
  const geoNodes: StructuralGeometry["nodes"] = {};
  let y = 0;
  for (const l of layers) {
    const layerH = Math.max(0, ...l.map((id) => heightOf.get(id) ?? DEFAULT_H));
    for (const id of l) {
      const w = widthOf.get(id) ?? DEFAULT_W;
      const h = heightOf.get(id) ?? DEFAULT_H;
      geoNodes[id] = {
        x: (x.get(id) ?? 0) - w / 2,
        y: y + (layerH - h) / 2,
        width: w,
        height: h,
        kind: "node",
      };
    }
    y += layerH + layerSpacing;
  }
  // No edge routes by design (the router boundary stays).
  return { version: 1, nodes: geoNodes, ports: {}, edges: {}, headerHeight: 0 };
}

/**
 * Network-simplex layering (LAY-002; Gansner et al.). Minimizes
 * total edge span (Σ weight * (rank(target) - rank(source))) subject
 * to every edge spanning at least 1. Implementation notes: cut
 * values recomputed from scratch per pivot (O(V*E), fine at our
 * scale; incremental updates are an optimization, not a semantic);
 * pivots capped at 4*E with deterministic id-sorted iteration
 * (QLT-001).
 */
export function layeringNetworkSimplex(
  nodes: readonly { id: string }[],
  edges: readonly { id: string; source: string; target: string }[],
  reversed: ReadonlySet<string>,
  budgetMs = 80,
): Map<string, number> {
  const ids = nodes.map((n) => n.id).sort();
  const oriented = [...edges]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((e) =>
      reversed.has(e.id)
        ? { id: e.id, s: e.target, t: e.source }
        : { id: e.id, s: e.source, t: e.target },
    );
  // Initial feasible ranks: longest path.
  const rank = assignLayers(
    nodes.map((n) => ({ id: n.id, width: 1, height: 1 })),
    edges.map((e) => ({ ...e })),
    reversed,
  );
  const slack = (e: { s: string; t: string }): number =>
    (rank.get(e.t) ?? 0) - (rank.get(e.s) ?? 0) - 1;

  // Tight spanning forest, grown greedily and deterministically.
  const inTree = new Set<string>(); // edge ids
  const treeNodes = new Set<string>();
  const first = ids[0];
  if (first === undefined) return rank;
  // Frontier-based growth (PRF-001 flip finding): scanning ALL
  // edges per grown node was O(V*E) (~47 ms at R1 scale); the
  // frontier holds only tree-incident edges, kept in id order so
  // growth stays deterministic (QLT-001).
  const incident = new Map<string, number[]>(ids.map((id) => [id, []]));
  oriented.forEach((e, i) => {
    incident.get(e.s)?.push(i);
    incident.get(e.t)?.push(i);
  });
  const frontier = new Set<number>();
  const addNode = (id: string): void => {
    treeNodes.add(id);
    for (const i of incident.get(id) ?? []) frontier.add(i);
  };
  addNode(first);
  let guard = 0;
  while (treeNodes.size < ids.length && guard++ < ids.length * 2) {
    // Scan the frontier in insertion order (Set iteration order is
    // insertion order, and insertions are deterministic: incident
    // lists come from id-sorted edges and nodes join the tree in a
    // deterministic sequence), dropping settled (both-in) edges.
    let grown = false;
    let minSlack = Infinity;
    let dir = 0;
    for (const i of frontier) {
      const e = oriented[i];
      if (e === undefined) continue;
      const sIn = treeNodes.has(e.s);
      const tIn = treeNodes.has(e.t);
      if (sIn === tIn) {
        frontier.delete(i);
        continue;
      }
      const sl = slack(e);
      if (sl === 0) {
        inTree.add(e.id);
        frontier.delete(i);
        addNode(sIn ? e.t : e.s);
        grown = true;
        break;
      }
      if (sl < minSlack) {
        minSlack = sl;
        dir = sIn ? 1 : -1;
      }
    }
    if (grown) continue;
    if (!Number.isFinite(minSlack)) {
      // Disconnected component: seed it and continue.
      const next = ids.find((id) => !treeNodes.has(id));
      if (next === undefined) break;
      addNode(next);
      continue;
    }
    // Shift the tree by the minimum incident slack to make an
    // incident edge tight (toward the non-tree endpoint).
    for (const id of treeNodes) {
      rank.set(id, (rank.get(id) ?? 0) + dir * minSlack);
    }
  }

  const treeEdges = oriented.filter((e) => inTree.has(e.id));
  const nonTree = oriented.filter((e) => !inTree.has(e.id));
  const adj = new Map<string, { other: string; id: string }[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of treeEdges) {
    adj.get(e.s)?.push({ other: e.t, id: e.id });
    adj.get(e.t)?.push({ other: e.s, id: e.id });
  }
  const tailComponent = (cut: {
    s: string;
    t: string;
    id: string;
  }): Set<string> => {
    // Nodes on the SOURCE side when the cut edge is removed.
    const seen = new Set<string>([cut.s]);
    const stack = [cut.s];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (cur === undefined) break;
      for (const n of adj.get(cur) ?? []) {
        if (n.id === cut.id || seen.has(n.other)) continue;
        seen.add(n.other);
        stack.push(n.other);
      }
    }
    return seen;
  };
  const cutValue = (cut: { s: string; t: string; id: string }): number => {
    const tail = tailComponent(cut);
    let v = 0;
    for (const e of oriented) {
      const sTail = tail.has(e.s);
      const tTail = tail.has(e.t);
      if (sTail && !tTail) v += 1;
      else if (!sTail && tTail) v -= 1;
    }
    return v;
  };

  const maxPivots = Math.max(8, 4 * oriented.length);
  const t0 = Date.now();
  // Deadline granularity (PRF-001 flip finding): the leave-scan and
  // the final convergence scan are each O(V*E), so checking only
  // between pivots let NS overshoot its budget by a full scan. The
  // deadline is now checked INSIDE the scan (every few cut values);
  // a mid-scan break is safe because ranks only mutate after a
  // COMPLETE pivot, so the current ranks are always feasible.
  let expired = false;
  const deadline = (): boolean => {
    if (!expired && Date.now() - t0 > budgetMs) expired = true;
    return expired;
  };
  for (let pivot = 0; pivot < maxPivots && !deadline(); pivot++) {
    let leave: { s: string; t: string; id: string } | null = null;
    let scanned = 0;
    for (const e of treeEdges) {
      if ((scanned++ & 7) === 0 && deadline()) break;
      if (cutValue(e) < 0) {
        leave = e;
        break;
      }
    }
    if (leave === null) break;
    const tail = tailComponent(leave);
    // Entering edge: head-to-tail non-tree edge with minimum slack.
    let enter: { s: string; t: string; id: string } | null = null;
    let best = Infinity;
    for (const e of nonTree) {
      if (!tail.has(e.s) && tail.has(e.t)) {
        const sl = slack(e);
        if (sl < best) {
          best = sl;
          enter = e;
        }
      }
    }
    if (enter === null) break;
    // Shift the tail component DOWN by the entering edge's slack to
    // make it tight (its target sits in the tail); every other
    // head-to-tail edge had slack >= best, so all stay feasible.
    for (const id of tail) rank.set(id, (rank.get(id) ?? 0) - best);
    // Swap tree membership.
    inTree.delete(leave.id);
    inTree.add(enter.id);
    const li = treeEdges.findIndex((e) => e.id === leave?.id);
    if (li >= 0) treeEdges.splice(li, 1, enter);
    const ni = nonTree.findIndex((e) => e.id === enter?.id);
    if (ni >= 0) nonTree.splice(ni, 1, leave);
    // Rebuild adjacency.
    for (const id of ids) adj.set(id, []);
    for (const e of treeEdges) {
      adj.get(e.s)?.push({ other: e.t, id: e.id });
      adj.get(e.t)?.push({ other: e.s, id: e.id });
    }
  }
  // Normalize to zero-based ranks.
  const min = Math.min(...ids.map((id) => rank.get(id) ?? 0));
  for (const id of ids) rank.set(id, (rank.get(id) ?? 0) - min);
  return rank;
}

/** Coffman-Graham width-bounded layering (LAY-002): lexicographic
 *  labeling, then greedy layer fill of at most `width` nodes with
 *  all successors already placed in later layers (built sink-up). */
export function layeringCoffmanGraham(
  nodes: readonly { id: string }[],
  edges: readonly { id: string; source: string; target: string }[],
  reversed: ReadonlySet<string>,
  width: number,
): Map<string, number> {
  const ids = nodes.map((n) => n.id).sort();
  const succ = new Map<string, string[]>(ids.map((id) => [id, []]));
  const pred = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    const [s, t] = reversed.has(e.id)
      ? [e.target, e.source]
      : [e.source, e.target];
    succ.get(s)?.push(t);
    pred.get(t)?.push(s);
  }
  // Phase 1: labels 1..n, next label to the node whose PREDECESSOR
  // label set is lexicographically smallest among unlabeled nodes
  // with all predecessors labeled.
  const label = new Map<string, number>();
  for (let next = 1; next <= ids.length; next++) {
    let bestId: string | null = null;
    let bestKey: number[] | null = null;
    for (const id of ids) {
      if (label.has(id)) continue;
      const ps = pred.get(id) ?? [];
      if (!ps.every((p) => label.has(p))) continue;
      const key = ps.map((p) => label.get(p) ?? 0).sort((a, b) => b - a); // compare decreasing
      if (
        bestKey === null ||
        compareDecreasing(key, bestKey) < 0 ||
        (compareDecreasing(key, bestKey) === 0 &&
          bestId !== null &&
          id < bestId)
      ) {
        bestKey = key;
        bestId = id;
      }
    }
    if (bestId === null) break;
    label.set(bestId, next);
  }
  // Phase 2: fill layers from the sinks up: highest label first,
  // a node goes in the lowest layer above all its successors, and
  // layers hold at most `width`.
  const layerOf = new Map<string, number>();
  const layerCount = new Map<number, number>();
  const byLabelDesc = [...ids].sort(
    (a, b) => (label.get(b) ?? 0) - (label.get(a) ?? 0),
  );
  let maxLayer = 0;
  for (const id of byLabelDesc) {
    const ss = succ.get(id) ?? [];
    let l = 0;
    for (const t of ss) l = Math.max(l, (layerOf.get(t) ?? -1) + 1);
    while ((layerCount.get(l) ?? 0) >= width) l++;
    layerOf.set(id, l);
    layerCount.set(l, (layerCount.get(l) ?? 0) + 1);
    maxLayer = Math.max(maxLayer, l);
  }
  // Sink-up layers count DOWN the flow; flip so sources are layer 0.
  const flipped = new Map<string, number>();
  for (const id of ids) flipped.set(id, maxLayer - (layerOf.get(id) ?? 0));
  return flipped;
}

function compareDecreasing(a: readonly number[], b: readonly number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Brandes-Koepf coordinate assignment (LAY-004): four alignments
 * (up/down x left/right), median vertical alignment into blocks,
 * horizontal compaction with size-aware separation, then per-node
 * balancing (average of the middle pair of the four candidates).
 * NOTE: without LAY-005's dummy chains there are no inner segments,
 * so type-1 conflict marking is vacuous in this stage; it activates
 * when ESK dummies land.
 */
export function placeBrandesKoepf(
  nodes: readonly FlatNode[],
  edges: readonly FlatEdge[],
  reversed: ReadonlySet<string>,
  layers: readonly (readonly string[])[],
  nodeSpacing: number,
): Map<string, number> {
  const width = new Map(nodes.map((n) => [n.id, n.width] as const));
  const pos = new Map<string, { layer: number; index: number }>();
  layers.forEach((l, li) =>
    l.forEach((id, i) => pos.set(id, { layer: li, index: i })),
  );
  const down = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  const up = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    const [s, t] = reversed.has(e.id)
      ? [e.target, e.source]
      : [e.source, e.target];
    down.get(s)?.push(t);
    up.get(t)?.push(s);
  }
  const sortByIndex = (ids: readonly string[]): string[] =>
    [...ids].sort(
      (a, b) => (pos.get(a)?.index ?? 0) - (pos.get(b)?.index ?? 0),
    );

  const alignment = (
    vertical: "down" | "up",
    horizontal: "left" | "right",
  ): Map<string, number> => {
    const layerOrder =
      vertical === "down" ? [...layers.keys()] : [...layers.keys()].reverse();
    const neigh = vertical === "down" ? up : down;
    const root = new Map<string, string>();
    const alignTo = new Map<string, string>();
    for (const n of nodes) {
      root.set(n.id, n.id);
      alignTo.set(n.id, n.id);
    }
    for (const li of layerOrder) {
      const layer = layers[li];
      if (layer === undefined) continue;
      const scan = horizontal === "left" ? [...layer] : [...layer].reverse();
      let bound = horizontal === "left" ? -1 : Number.MAX_SAFE_INTEGER;
      for (const id of scan) {
        const ns = sortByIndex(neigh.get(id) ?? []);
        if (ns.length === 0) continue;
        const medians =
          ns.length % 2 === 1
            ? [ns[(ns.length - 1) / 2]]
            : horizontal === "left"
              ? [ns[ns.length / 2 - 1], ns[ns.length / 2]]
              : [ns[ns.length / 2], ns[ns.length / 2 - 1]];
        for (const m of medians) {
          if (m === undefined) continue;
          if (alignTo.get(id) !== id) break; // this node already aligned
          // No claimed-check on m: align[m] != m only marks m as its
          // block's current tail (the circular back-pointer);
          // overwriting extends the block. The strict bound below is
          // the double-claim protection (BK's r < pos[m]).
          const mi = pos.get(m)?.index ?? 0;
          const ok = horizontal === "left" ? mi > bound : mi < bound;
          if (!ok) continue;
          // Align id under m's block.
          const r = root.get(m) ?? m;
          alignTo.set(m, id);
          root.set(id, r);
          alignTo.set(id, r);
          bound = mi;
        }
      }
    }
    // Horizontal compaction: place blocks left-to-right (or the
    // mirror), respecting order and size-aware separation.
    const x = new Map<string, number>();
    const blockOf = (id: string): string => root.get(id) ?? id;
    const place = (li: number): void => {
      const layer = layers[li];
      if (layer === undefined) return;
      const order = horizontal === "left" ? [...layer] : [...layer].reverse();
      let edge = horizontal === "left" ? -Infinity : Infinity;
      for (const id of order) {
        const b = blockOf(id);
        const w = width.get(id) ?? DEFAULT_W;
        const cur = x.get(b);
        if (horizontal === "left") {
          const minX = edge === -Infinity ? 0 : edge + nodeSpacing + w / 2;
          const next = cur === undefined ? minX : Math.max(cur, minX);
          x.set(b, next);
          edge = next + w / 2;
        } else {
          const maxX = edge === Infinity ? 0 : edge - nodeSpacing - w / 2;
          const next = cur === undefined ? maxX : Math.min(cur, maxX);
          x.set(b, next);
          edge = next - w / 2;
        }
      }
    };
    // Two passes so block constraints propagate across layers.
    for (let pass = 0; pass < 2; pass++) {
      for (const li of layerOrder) place(li);
    }
    const out = new Map<string, number>();
    for (const n of nodes) out.set(n.id, x.get(blockOf(n.id)) ?? 0);
    return out;
  };

  const candidates = [
    alignment("down", "left"),
    alignment("down", "right"),
    alignment("up", "left"),
    alignment("up", "right"),
  ];
  // Align candidates to the narrowest layout: left-biased candidates
  // shift so their min matches its min; right-biased so their max
  // matches its max (the paper's alignment step; uniform
  // min-normalization would bend chains during balancing).
  const spans = candidates.map((c) => {
    const vs = [...c.values()];
    return { min: Math.min(...vs), max: Math.max(...vs) };
  });
  let narrowest = 0;
  for (let i = 1; i < candidates.length; i++) {
    const si = at(spans[i], "span");
    const sn = at(spans[narrowest], "span");
    if (si.max - si.min < sn.max - sn.min) narrowest = i;
  }
  const target = at(spans[narrowest], "span");
  candidates.forEach((c, i) => {
    const sp = at(spans[i], "span");
    const isLeft = i % 2 === 0; // order: DL, DR, UL, UR
    const shift = isLeft ? target.min - sp.min : target.max - sp.max;
    for (const [id, v] of c) c.set(id, v + shift);
  });
  const balanced = new Map<string, number>();
  for (const n of nodes) {
    const xs = candidates.map((c) => c.get(n.id) ?? 0).sort((a, b) => a - b);
    balanced.set(n.id, ((xs[1] ?? 0) + (xs[2] ?? 0)) / 2);
  }
  // Final overlap resolution per layer (balancing can reintroduce
  // slight overlaps with variable widths).
  for (const l of layers) {
    let minLeft = -Infinity;
    for (const id of l) {
      const w = width.get(id) ?? DEFAULT_W;
      const left = Math.max((balanced.get(id) ?? 0) - w / 2, minLeft);
      balanced.set(id, left + w / 2);
      minLeft = left + w + nodeSpacing;
    }
  }
  return balanced;
}
