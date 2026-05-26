/**
 * N-degree neighbor expansion (M1.E3.T1).
 *
 * Given a node ID, find all neighbors at depth N in the UGM.
 * Returns the set of node IDs discovered. The caller decides
 * whether to add them to the selection or visible set.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/02-functional-interaction.md R2.4
 */

import type { UGM } from "@core/ugm";
import type { WorkingSetManager } from "@core/working-set-manager";

export interface ExpandResult {
  /** Node IDs discovered at all depths up to N. */
  discoveredIds: string[];
  /** Whether the expansion would exceed the working-set limit. */
  exceedsLimit: boolean;
  /** The limit that would be exceeded (if applicable). */
  limit?: number;
  /** Total count including existing visible nodes. */
  totalCount: number;
}

/**
 * Find all neighbors of `startNodeId` at depth 1..N.
 * Uses BFS to avoid revisiting nodes.
 */
export function expandNeighbors(
  ugm: UGM,
  startNodeId: string,
  depth: number = 1,
  currentVisibleCount: number = 0,
  workingSetManager?: WorkingSetManager,
): ExpandResult {
  const visited = new Set<string>([startNodeId]);
  let frontier = [startNodeId];

  for (let d = 0; d < depth; d++) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of ugm.getNeighbors(nodeId)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextFrontier.push(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  // Remove the start node from discovered set
  visited.delete(startNodeId);
  const discoveredIds = [...visited];
  const totalCount = currentVisibleCount + discoveredIds.length;

  let exceedsLimit = false;
  let limit: number | undefined;

  if (workingSetManager) {
    const check = workingSetManager.checkLimit("canvas", totalCount);
    exceedsLimit = !check.allowed;
    limit = check.limit;
  }

  return { discoveredIds, exceedsLimit, totalCount, limit };
}
