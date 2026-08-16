// Capability dashboard (view layer). Where the dev-server scenarios are
// domain stories, this foregrounds the toolkit surface they don't:
// charts, stats, algorithms and derived properties, plus the adjacency
// matrix and the type-flow sankey folded in when the Schema Dashboard
// was retired (planning/schema-dashboard-retirement.md).
export { AnalyticsDashboard } from "./AnalyticsDashboard";
export type { AnalyticsDashboardProps } from "./AnalyticsDashboard";

// Data layer (the ingest boundary; exported so integrators can see the
// pattern and tests can exercise it directly).
export {
  buildSupplyNetwork,
  fetchSupplyNodes,
  fetchSupplyEdges,
} from "./supply-data";
export type { SupplyNode, SupplyEdge, Tier } from "./supply-data";
