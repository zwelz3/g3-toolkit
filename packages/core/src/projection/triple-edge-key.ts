/**
 * Stable edge key for a triple-derived edge (issue #48).
 *
 * The SPARQL adapter and the projection pipeline both turn a
 * subject/predicate/object triple whose object is a resource into one
 * UGM edge. Both used to let graphology generate the edge id, so a host
 * that reloaded the same data saw different ids per load, and the same
 * triple appearing twice in the input (two SELECT rows that bind it,
 * or a duplicate in a triple list) became two parallel edges. One
 * helper serves both paths so their ids cannot diverge: the same
 * triple yields the same id whether it arrived through an endpoint or
 * through `ProjectionPipeline.project`.
 *
 * Shape: the triple's N-Triples line without the trailing dot,
 * `<subject> <predicate> <object>`, with ` <graph>` appended (N-Quads
 * style) when a graph is given. The brackets are delimiters, not a
 * claim that each component is an IRI: a SPARQL blank-node subject is
 * bracketed too. The leading `<` is what keeps an edge key disjoint
 * from every node id these paths produce. Node ids are IRIs (which
 * cannot begin with `<`, and cannot contain `<`, `>` or a space at
 * all), CURIEs, or blank-node labels, so no edge key can equal a node
 * id, and the canvas hands Cytoscape ONE id space for nodes and edges
 * in which the second element with a given id is dropped. The key is
 * injective over the triple as long as no component contains `>`,
 * which the IRI grammar already forbids. Cytoscape ids are looked up
 * with `getElementById`, which takes any string, so spaces and
 * brackets are safe there.
 *
 * Named graph: it does NOT participate unless the caller passes one.
 * Neither core path carries a graph today. The adapter binds only
 * `?s ?p ?o` (a `?g` binding is ignored, and `expandNeighborhood`
 * queries the merged default graph with no GRAPH clause), and
 * `RDFTriple` has no graph field, so both merge every named graph into
 * one triple set and the same triple from two graphs is one edge. The
 * optional argument exists for a host that carries quads and keeps
 * graphs distinct; passing it makes the per-graph edges distinct keys.
 *
 * Duplicate policy at the call sites: the first occurrence wins and a
 * later identical triple is skipped, never thrown and never added as a
 * parallel edge, matching every other adapter.
 */
export function tripleEdgeKey(
  subject: string,
  predicate: string,
  object: string,
  graph?: string,
): string {
  const spo = `<${subject}> <${predicate}> <${object}>`;
  return graph === undefined ? spo : `${spo} <${graph}>`;
}
