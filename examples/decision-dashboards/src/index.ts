// Capability dashboards (view layer). Where the four dev-server
// scenarios are domain stories, these foreground the toolkit surface
// the scenarios don't: analytics (charts/stats/algorithms/derived
// properties) and structure (schema/matrix/sankey + the RDF paradigm).
export { AnalyticsDashboard } from "./AnalyticsDashboard";
export type { AnalyticsDashboardProps } from "./AnalyticsDashboard";
export { SchemaDashboard } from "./SchemaDashboard";
export type { SchemaDashboardProps } from "./SchemaDashboard";

// Data layer (the ingest boundary; exported so integrators can see the
// pattern and tests can exercise it directly).
export {
  buildSupplyNetwork,
  fetchSupplyNodes,
  fetchSupplyEdges,
} from "./supply-data";
export type { SupplyNode, SupplyEdge, Tier } from "./supply-data";
