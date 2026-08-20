export type { GraphAdapter, SchemaModel } from "./types";
export { SparqlAdapter, tripleTermToValue } from "./sparql-adapter";
export type { RdfTerm, TripleTerm } from "./sparql-adapter";
export { CypherAdapter } from "./cypher-adapter";
export { HolonicAdapter } from "./holonic-adapter";
export { GremlinAdapter } from "./gremlin-adapter";
export type { Holon, Portal, HolonicDataset } from "./holonic-adapter";
export type { GremlinAdapterConfig } from "./gremlin-adapter";
// RestAdapter's config types were exported from the root barrel but the
// CLASS was exported from nowhere, so a capability the docs list as
// shipped had no import path. Reachable from both entries now.
export { RestAdapter } from "./rest-adapter";
export type {
  RestAdapterConfig,
  RestResponseMapping,
  RestNodeMapping,
  RestEdgeMapping,
} from "./rest-adapter";
export {
  AdapterArgumentError,
  MAX_TRAVERSAL_DEPTH,
  assertPlainIdentifier,
  assertSafeIri,
  coerceDepth,
} from "./query-safety";
export {
  AdapterHttpError,
  MAX_ERROR_BODY_CHARS,
  assertOk,
} from "./adapter-error";
