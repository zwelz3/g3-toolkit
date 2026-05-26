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
