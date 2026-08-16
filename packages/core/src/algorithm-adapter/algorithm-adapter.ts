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

import type { UGM } from "../ugm";

/**
 * What an ingest call actually did.
 *
 * Ingest is a JOIN between a results map and the UGM, and every join
 * can miss. Results computed on a different snapshot, on the
 * pre-filter graph, or with a different id convention (prefixed IRIs
 * against local names is the recurring one) produce a map that merges
 * nothing while every call looks successful. The prior signature
 * returned `void`, so a host could not tell 500 matches from 0 except
 * by inspecting the graph afterward.
 *
 * `supplied` counts entries in the results map, not distinct ids: a
 * Map cannot hold a duplicate key, so the two coincide here.
 */
export interface AlgorithmIngestReport {
  /** Entries the caller supplied. */
  supplied: number;
  /** Entries whose id resolved to an element and were merged. */
  matched: number;
  /** Entries whose id resolved to nothing and were skipped. */
  unmatched: number;
}

/**
 * Ingest algorithm results into a UGM.
 * Each entry in the results map is merged as additional properties
 * on the corresponding node.
 *
 * Entries naming a node the UGM does not hold are skipped rather than
 * created: the results are an overlay on a known graph, and inventing
 * a property-only node would put an element on the canvas that no
 * source vouched for. The count of those skips is the return value.
 *
 * @returns counts of supplied, matched and unmatched entries.
 */
export function ingestAlgorithmResults(
  ugm: UGM,
  results: Map<string, Record<string, unknown>>,
): AlgorithmIngestReport {
  let matched = 0;
  for (const [nodeId, properties] of results) {
    if (ugm.hasNode(nodeId)) {
      ugm.updateNodeProperties(nodeId, properties);
      matched++;
    }
  }
  return {
    supplied: results.size,
    matched,
    unmatched: results.size - matched,
  };
}
