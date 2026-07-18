/**
 * Path analysis: shortest path between two nodes (M7.E0.T1, R2.13).
 *
 * Uses BFS for unweighted graphs. Returns the path as an ordered
 * list of node IDs and the edge IDs connecting them.
 *
 * Framework-agnostic (D6).
 */

import type { UGM } from "../ugm";

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
  /** Maximum hops to search (default: unlimited). */
  maxHops?: number;
  /** Edge types to traverse (default: all). */
  edgeTypes?: string[];
}

/**
 * Find the shortest path between two nodes using BFS.
 */
export function findShortestPath(
  ugm: UGM,
  sourceId: string,
  targetId: string,
  options?: PathOptions,
): PathResult {
  if (sourceId === targetId) {
    return { nodeIds: [sourceId], edgeIds: [], length: 0, found: true };
  }

  if (!ugm.hasNode(sourceId) || !ugm.hasNode(targetId)) {
    return { nodeIds: [], edgeIds: [], length: 0, found: false };
  }

  const maxHops = options?.maxHops ?? Infinity;
  const edgeTypeFilter = options?.edgeTypes ? new Set(options.edgeTypes) : null;

  // BFS with parent tracking
  const visited = new Set<string>([sourceId]);
  const parent = new Map<string, { nodeId: string; edgeId: string }>();
  let frontier = [sourceId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxHops) {
    const nextFrontier: string[] = [];
    depth++;

    for (const nodeId of frontier) {
      const edges = ugm.getNodeEdges(nodeId);

      for (const edgeId of edges) {
        const endpoints = ugm.getEdgeEndpoints(edgeId);
        if (!endpoints) continue;

        const edge = ugm.getEdge(edgeId);
        if (edgeTypeFilter && edge && !edgeTypeFilter.has(edge.type)) {
          continue;
        }

        const neighbor =
          endpoints.source === nodeId ? endpoints.target : endpoints.source;

        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        parent.set(neighbor, { nodeId, edgeId });
        nextFrontier.push(neighbor);

        if (neighbor === targetId) {
          // Reconstruct path
          return reconstructPath(parent, sourceId, targetId);
        }
      }
    }

    frontier = nextFrontier;
  }

  return { nodeIds: [], edgeIds: [], length: 0, found: false };
}

function reconstructPath(
  parent: Map<string, { nodeId: string; edgeId: string }>,
  sourceId: string,
  targetId: string,
): PathResult {
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

  return {
    nodeIds,
    edgeIds,
    length: edgeIds.length,
    found: true,
  };
}

/** Union of ALL shortest paths between two nodes (review 9.17: the
 *  singular findShortestPath made "Find paths to here" a one-path
 *  demo by construction). Layered BFS from the source records each
 *  node's distance; an edge belongs to the union iff it steps from
 *  distance d to d+1 along some shortest route, collected by walking
 *  backward from the target through distance-decreasing edges. The
 *  result is the SUBGRAPH of shortest routes (nodeIds/edgeIds), plus
 *  the route count (capped: counts can be exponential in dense
 *  graphs; the cap keeps the label honest as "50+"). */
export function allShortestPaths(
  ugm: UGM,
  sourceId: string,
  targetId: string,
  options?: PathOptions & { countCap?: number },
): PathResult & { pathCount: number } {
  const empty = { nodeIds: [], edgeIds: [], length: 0, found: false };
  if (!ugm.hasNode(sourceId) || !ugm.hasNode(targetId)) {
    return { ...empty, pathCount: 0 };
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
  const edgeTypeFilter = options?.edgeTypes ? new Set(options.edgeTypes) : null;
  const dist = new Map<string, number>([[sourceId, 0]]);
  let frontier = [sourceId];
  let depth = 0;
  while (frontier.length > 0 && !dist.has(targetId)) {
    depth++;
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const edgeId of ugm.getNodeEdges(nodeId)) {
        const endpoints = ugm.getEdgeEndpoints(edgeId);
        if (!endpoints) continue;
        const edge = ugm.getEdge(edgeId);
        if (edgeTypeFilter && edge && !edgeTypeFilter.has(edge.type)) continue;
        const neighbor =
          endpoints.source === nodeId ? endpoints.target : endpoints.source;
        if (!dist.has(neighbor)) {
          dist.set(neighbor, depth);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  const targetDist = dist.get(targetId);
  if (targetDist === undefined) return { ...empty, pathCount: 0 };

  // Backward walk: keep exactly the edges that DESCEND the distance
  // field toward the source; count routes by summing over
  // predecessors (capped).
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
    for (const edgeId of ugm.getNodeEdges(id)) {
      const endpoints = ugm.getEdgeEndpoints(edgeId);
      if (!endpoints) continue;
      const edge = ugm.getEdge(edgeId);
      if (edgeTypeFilter && edge && !edgeTypeFilter.has(edge.type)) continue;
      const other =
        endpoints.source === id ? endpoints.target : endpoints.source;
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
