/**
 * k-hop neighborhood extraction (review 4.10): BFS over undirected
 * adjacency from a focus node, composed with buildSubgraph so the
 * result carries the same working-set cap and truncation flag the
 * scale drill-in uses. Promoted from the Ontology Workbench's
 * demo-local projection so the NeighborhoodPopout and any shell can
 * share one implementation.
 */
import type { UGM } from "../ugm";
import {
  buildSubgraph,
  type SubgraphResult,
} from "../scale/collapse-by-cluster";

export interface KhopOptions {
  /** Working-set cap forwarded to buildSubgraph (default 1500). */
  limit?: number;
}

export function khopNeighborhood(
  ugm: UGM,
  focusId: string,
  hops: number,
  options?: KhopOptions,
): SubgraphResult {
  if (!ugm.hasNode(focusId)) {
    return buildSubgraph(ugm, [], options?.limit);
  }
  const keep = new Set<string>([focusId]);
  let frontier = [focusId];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of ugm.getNeighbors(id)) {
        if (!keep.has(n)) {
          keep.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return buildSubgraph(ugm, [...keep], options?.limit);
}
