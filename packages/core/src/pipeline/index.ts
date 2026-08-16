// WITHDRAWN 2026-08-15: PipelineRegistry, createCountByProperty,
// createEdgeTypeBreakdown, createActivityTimeline and
// createCommunityBreakdown. No adopter document named them and nothing
// in this repository used them. The four creators that remain are the
// ones the root barrel exports and the dashboards use, so the channel
// is still usable end to end. Modules and tests stay in the tree; see
// packages/core/ARCHIVE.md.
export {
  createCountByType,
  createDegreeDistribution,
  createPropertyCorrelation,
  createCentralityVsProperty,
} from "./pipeline";
export type {
  DataPipeline,
  CategoricalData,
  ScatterData,
  TimeSeriesData,
  CategoricalSelection,
  RangeSelection,
  PointSetSelection,
  ChartSelection,
} from "./pipeline";
