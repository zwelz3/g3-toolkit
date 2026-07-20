/**
 * SPARQL results as a TableView-renderable UGM (review 5.19). The
 * plan's evaluation concluded TableView stays UGM-bound (its lower
 * half is node-selection and context-menu semantics, not a neutral
 * grid), so this is the sanctioned tabular adapter: one throwaway
 * UGM node per binding row, ordinal ids, properties keyed by the
 * SELECT variables. Rendered with hideBuiltinColumns (ordinal id and
 * constant type are noise) and selectable=false (ordinal ids written
 * into the SHARED selection store would clobber a live canvas
 * selection).
 *
 * Column order: every row is stamped with EVERY head variable ("" for
 * unbound OPTIONALs), so the registry's insertion order, and
 * therefore the column order, is the SELECT clause order.
 */
import { UGM } from "@g3t/core";
import { termText, type SparqlResult } from "../bio/sparql";

export function sparqlResultUgm(result: SparqlResult): UGM {
  const ugm = new UGM();
  if (!result.ok) return ugm;
  result.rows.forEach((row, i) => {
    const properties: Record<string, unknown> = {};
    for (const v of result.head) {
      const term = row[v];
      properties[v] = term === undefined ? "" : termText(term);
    }
    ugm.addNode(`r${i}`, { types: ["Result"], properties });
  });
  return ugm;
}
