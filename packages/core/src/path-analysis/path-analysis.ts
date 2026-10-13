/**
 * Path analysis: shortest path between two nodes (M7.E0.T1, R2.13).
 *
 * Uses BFS for unweighted graphs. Returns the path as an ordered
 * list of node IDs and the edge IDs connecting them.
 *
 * Framework-agnostic (D6).
 */

import type { UGM } from "../ugm";

/**
 * The read surface the path functions need: exactly the four UGM
 * methods they call, nothing more. A host with its own index (an
 * adjacency table over 100,000 typed edges, say) can hand in an
 * object implementing just these four instead of building a UGM for
 * a read-only search, and the compiler, not a cast, keeps the
 * contract honest: the day a search reads a fifth method, this type
 * widens and every such host fails to typecheck rather than at
 * runtime. `UGM` satisfies it by construction (it is a Pick of UGM).
 */
export type PathGraph = Pick<
  UGM,
  "hasNode" | "getNodeEdges" | "getEdgeEndpoints" | "getEdge"
>;

export interface PathResult {
  /** Ordered node IDs from source to target. */
  nodeIds: string[];
  /** Edge IDs along the path. */
  edgeIds: string[];
  /** Path length (number of edges). */
  length: number;
  /** Whether a path was found. */
  found: boolean;
}

export interface PathOptions {
  /** Maximum hops to search (default: unlimited). A target farther
   *  than this comes back `found: false`; the search stops at the
   *  bound instead of running the graph to exhaustion. */
  maxHops?: number;
  /** Edge types to traverse (default: all). */
  edgeTypes?: string[];
  /** Follow edges from source to target only (default: false, every
   *  edge is walkable from either endpoint). */
  directed?: boolean;
  /** Admit a node into a path (default: every node). The two
   *  endpoints are exempt: a search between two hub nodes still
   *  finds them, the filter only decides which nodes may sit
   *  BETWEEN them. */
  nodeFilter?: (id: string) => boolean;
}

/** One simple (loopless) path, as kShortestPaths lists them. */
export interface SimplePath {
  /** Ordered node IDs from source to target. */
  nodeIds: string[];
  /** Edge IDs along the path, one per hop. */
  edgeIds: string[];
}

export interface KShortestPathsOptions extends PathOptions {
  /** How many paths to return at most. */
  k: number;
}

// ── Traversal (shared by every search below) ───────────────────────

/** Resolved options, so each step does no option parsing. */
interface Traversal {
  edgeTypes: Set<string> | null;
  directed: boolean;
  /** Whether a node may be stepped INTO (endpoints already exempt). */
  admit: (id: string) => boolean;
}

function resolveTraversal(
  options: PathOptions | undefined,
  sourceId: string,
  targetId: string,
): Traversal {
  const filter = options?.nodeFilter;
  return {
    edgeTypes: options?.edgeTypes ? new Set(options.edgeTypes) : null,
    directed: options?.directed === true,
    admit: filter
      ? (id) => id === sourceId || id === targetId || filter(id)
      : () => true,
  };
}

/**
 * The neighbors one hop from `nodeId`, in the graph's own edge
 * iteration order (which is what makes every search here
 * deterministic). `reverse` walks edges against their direction,
 * which the backward distance walk in allShortestPaths needs when
 * `directed` is on; it is a no-op for undirected traversal.
 */
function steps(
  graph: PathGraph,
  nodeId: string,
  t: Traversal,
  reverse = false,
): Array<{ neighbor: string; edgeId: string }> {
  const out: Array<{ neighbor: string; edgeId: string }> = [];
  for (const edgeId of graph.getNodeEdges(nodeId)) {
    const endpoints = graph.getEdgeEndpoints(edgeId);
    if (!endpoints) continue;
    const edge = graph.getEdge(edgeId);
    if (t.edgeTypes && edge && !t.edgeTypes.has(edge.type)) continue;
    let neighbor: string;
    if (t.directed) {
      const from = reverse ? endpoints.target : endpoints.source;
      if (from !== nodeId) continue;
      neighbor = reverse ? endpoints.source : endpoints.target;
    } else {
      neighbor =
        endpoints.source === nodeId ? endpoints.target : endpoints.source;
    }
    if (!t.admit(neighbor)) continue;
    out.push({ neighbor, edgeId });
  }
  return out;
}

/**
 * Bounded BFS from `sourceId` to `targetId` with parent tracking.
 * `excludedNodes` / `excludedEdges` exist for Yen's spur searches
 * (the root path's nodes and the already-listed continuations);
 * the public searches pass none. Returns null when the target is
 * unreachable within `maxHops`.
 */
function bfs(
  graph: PathGraph,
  sourceId: string,
  targetId: string,
  t: Traversal,
  maxHops: number,
  excludedNodes?: ReadonlySet<string>,
  excludedEdges?: ReadonlySet<string>,
): SimplePath | null {
  const visited = new Set<string>([sourceId]);
  const parent = new Map<string, { nodeId: string; edgeId: string }>();
  let frontier = [sourceId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxHops) {
    const nextFrontier: string[] = [];
    depth++;
    for (const nodeId of frontier) {
      for (const { neighbor, edgeId } of steps(graph, nodeId, t)) {
        if (visited.has(neighbor)) continue;
        if (excludedEdges?.has(edgeId)) continue;
        if (excludedNodes?.has(neighbor)) continue;
        visited.add(neighbor);
        parent.set(neighbor, { nodeId, edgeId });
        nextFrontier.push(neighbor);
        if (neighbor === targetId) {
          return reconstructPath(parent, sourceId, targetId);
        }
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

function reconstructPath(
  parent: Map<string, { nodeId: string; edgeId: string }>,
  sourceId: string,
  targetId: string,
): SimplePath {
  const nodeIds: string[] = [targetId];
  const edgeIds: string[] = [];
  let current = targetId;

  while (current !== sourceId) {
    const p = parent.get(current);
    if (!p) break;
    edgeIds.unshift(p.edgeId);
    nodeIds.unshift(p.nodeId);
    current = p.nodeId;
  }

  return { nodeIds, edgeIds };
}

const NOT_FOUND: PathResult = {
  nodeIds: [],
  edgeIds: [],
  length: 0,
  found: false,
};

// ── Public searches ────────────────────────────────────────────────

/**
 * Find the shortest path between two nodes using BFS.
 */
export function findShortestPath(
  graph: PathGraph,
  sourceId: string,
  targetId: string,
  options?: PathOptions,
): PathResult {
  if (sourceId === targetId) {
    return { nodeIds: [sourceId], edgeIds: [], length: 0, found: true };
  }

  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) {
    return { ...NOT_FOUND };
  }

  const path = bfs(
    graph,
    sourceId,
    targetId,
    resolveTraversal(options, sourceId, targetId),
    options?.maxHops ?? Infinity,
  );
  if (!path) return { ...NOT_FOUND };
  return { ...path, length: path.edgeIds.length, found: true };
}

/** Union of ALL shortest paths between two nodes (review 9.17: the
 *  singular findShortestPath made "Find paths to here" a one-path
 *  demo by construction). Layered BFS from the source records each
 *  node's distance; an edge belongs to the union iff it steps from
 *  distance d to d+1 along some shortest route, collected by walking
 *  backward from the target through distance-decreasing edges. The
 *  result is the SUBGRAPH of shortest routes (nodeIds/edgeIds), plus
 *  the route count (capped: counts can be exponential in dense
 *  graphs; the cap keeps the label honest as "50+").
 *
 *  `maxHops` bounds the layered BFS exactly as it bounds
 *  findShortestPath: a target farther than the bound is `found:
 *  false` (issue #29: the loop used to read only the frontier, so a
 *  search between distant nodes on a large graph ran to exhaustion
 *  while the option documented a bound it did not apply). */
export function allShortestPaths(
  graph: PathGraph,
  sourceId: string,
  targetId: string,
  options?: PathOptions & { countCap?: number },
): PathResult & { pathCount: number } {
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) {
    return { ...NOT_FOUND, pathCount: 0 };
  }
  if (sourceId === targetId) {
    return {
      nodeIds: [sourceId],
      edgeIds: [],
      length: 0,
      found: true,
      pathCount: 1,
    };
  }
  const t = resolveTraversal(options, sourceId, targetId);
  const maxHops = options?.maxHops ?? Infinity;
  const dist = new Map<string, number>([[sourceId, 0]]);
  let frontier = [sourceId];
  let depth = 0;
  while (frontier.length > 0 && !dist.has(targetId) && depth < maxHops) {
    depth++;
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const { neighbor } of steps(graph, nodeId, t)) {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, depth);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  const targetDist = dist.get(targetId);
  if (targetDist === undefined) return { ...NOT_FOUND, pathCount: 0 };

  // Backward walk: keep exactly the edges that DESCEND the distance
  // field toward the source; count routes by summing over
  // predecessors (capped). Walking edges in reverse keeps a directed
  // search honest: a predecessor is a node whose edge points AT this
  // one, not merely a neighbor one layer closer.
  const cap = options?.countCap ?? 50;
  const nodeSet = new Set<string>([targetId]);
  const edgeSet = new Set<string>();
  const counts = new Map<string, number>([[sourceId, 1]]);
  const countOf = (id: string): number => {
    const memo = counts.get(id);
    if (memo !== undefined) return memo;
    const d = dist.get(id);
    if (d === undefined) return 0;
    let total = 0;
    for (const { neighbor: other, edgeId } of steps(graph, id, t, true)) {
      if (dist.get(other) === d - 1) {
        total = Math.min(cap, total + countOf(other));
        nodeSet.add(other);
        edgeSet.add(edgeId);
      }
    }
    counts.set(id, total);
    return total;
  };
  const pathCount = countOf(targetId);
  return {
    nodeIds: [...nodeSet],
    edgeIds: [...edgeSet],
    length: targetDist,
    found: true,
    pathCount,
  };
}

/**
 * The k shortest simple (loopless) paths between two nodes, in
 * nondecreasing hop count: the individual routes a host lists as
 * "path 3 of 12: A -knows- B -cites- C", which allShortestPaths
 * (a union subgraph plus a count) cannot give back.
 *
 * Algorithm: Yen's, with BFS as the shortest-path subroutine since
 * every hop weighs one. Chosen over enumerating only the
 * shortest-LENGTH routes because a listing that stops at the
 * shortest length answers "which routes tie for shortest" but not
 * "what is the next-best route", and the latter is what a path
 * finder shows once the first route is ruled out. Each returned path
 * costs at most L bounded BFS runs, where L is its hop count, so the
 * whole call is O(k * L * (n + m)) on a graph of n nodes and m
 * edges; `maxHops` caps L and every spur search, which is what keeps
 * a search on a 100,000-edge index from running to exhaustion.
 *
 * Deterministic: BFS walks edges in the graph's own iteration order,
 * and among candidates of equal length the one discovered first
 * wins, so the same graph and options list the same paths in the
 * same order every call. Parallel edges yield distinct paths (same
 * nodeIds, different edgeIds), matching how allShortestPaths counts
 * them. Fewer than k paths exist: the array is shorter. Disconnected
 * or missing endpoints: empty array. Source equals target: the one
 * trivial path.
 */
export function kShortestPaths(
  graph: PathGraph,
  sourceId: string,
  targetId: string,
  options: KShortestPathsOptions,
): SimplePath[] {
  const k = Math.floor(options.k);
  if (!(k >= 1)) return [];
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) return [];
  if (sourceId === targetId) return [{ nodeIds: [sourceId], edgeIds: [] }];

  const t = resolveTraversal(options, sourceId, targetId);
  const maxHops = options.maxHops ?? Infinity;

  const first = bfs(graph, sourceId, targetId, t, maxHops);
  if (!first) return [];

  const accepted: SimplePath[] = [first];
  // Candidate paths found by spur searches, keyed by their edge
  // sequence so the same path found from two spur nodes is listed
  // once. Insertion order breaks length ties (determinism).
  const candidates = new Map<string, SimplePath>();
  const keyOf = (p: SimplePath): string => JSON.stringify(p.edgeIds);
  const acceptedKeys = new Set<string>([keyOf(first)]);

  while (accepted.length < k) {
    const prev = accepted[accepted.length - 1];
    if (!prev) break;
    for (let j = 0; j < prev.nodeIds.length - 1; j++) {
      const spurNode = prev.nodeIds[j];
      if (spurNode === undefined) break;
      const rootNodes = prev.nodeIds.slice(0, j + 1);
      const rootEdges = prev.edgeIds.slice(0, j);

      // Every accepted path sharing this root must not be rediscovered:
      // remove the edge each of them takes out of the spur node. Roots
      // are compared by edge sequence, not node sequence, because on a
      // multigraph two paths through the same nodes over different
      // parallel edges are different roots.
      const excludedEdges = new Set<string>();
      for (const p of accepted) {
        if (p.edgeIds.length <= j) continue;
        let sameRoot = true;
        for (let i = 0; i < j; i++) {
          if (p.edgeIds[i] !== rootEdges[i]) {
            sameRoot = false;
            break;
          }
        }
        const next = p.edgeIds[j];
        if (sameRoot && next !== undefined) excludedEdges.add(next);
      }
      // The root's nodes (spur node excepted) are off limits, which is
      // what keeps every listed path loopless.
      const excludedNodes = new Set<string>(rootNodes);
      excludedNodes.delete(spurNode);

      const spur = bfs(
        graph,
        spurNode,
        targetId,
        t,
        maxHops - j,
        excludedNodes,
        excludedEdges,
      );
      if (!spur) continue;
      const total: SimplePath = {
        nodeIds: [...rootNodes, ...spur.nodeIds.slice(1)],
        edgeIds: [...rootEdges, ...spur.edgeIds],
      };
      const key = keyOf(total);
      if (acceptedKeys.has(key) || candidates.has(key)) continue;
      candidates.set(key, total);
    }

    if (candidates.size === 0) break;
    let bestKey: string | undefined;
    let best: SimplePath | undefined;
    for (const [key, p] of candidates) {
      if (!best || p.edgeIds.length < best.edgeIds.length) {
        best = p;
        bestKey = key;
      }
    }
    if (!best || bestKey === undefined) break;
    candidates.delete(bestKey);
    acceptedKeys.add(bestKey);
    accepted.push(best);
  }

  return accepted;
}
