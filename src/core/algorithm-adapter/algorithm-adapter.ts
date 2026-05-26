/**
 * AlgorithmResultAdapter (M3.E3.T1).
 *
 * Merges algorithm output (e.g., PageRank scores, community IDs)
 * into existing UGM node/edge properties.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/03-technical-data-layer.md R3.5
 * @see specs/09-design-decisions.md D4
 */

import type { UGM } from "@core/ugm";

/**
 * Ingest algorithm results into a UGM.
 * Each entry in the results map is merged as additional properties
 * on the corresponding node.
 */
export function ingestAlgorithmResults(
  ugm: UGM,
  results: Map<string, Record<string, unknown>>,
): void {
  for (const [nodeId, properties] of results) {
    if (ugm.hasNode(nodeId)) {
      ugm.updateNodeProperties(nodeId, properties);
    }
  }
}
