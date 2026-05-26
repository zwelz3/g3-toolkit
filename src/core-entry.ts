/**
 * @g3t/core entry point.
 *
 * Framework-agnostic: zero React, zero Zustand, zero Cytoscape imports.
 * This is the D6 subset of the toolkit.
 */

// Data model
export { UGM } from "./core/ugm";
export type {
  NodeAttributes,
  EdgeAttributes,
  NodeInput,
  EdgeInput,
  QualifiedEdgeMeta,
  PropertyKeyRegistry,
  UGMEventType,
  NodeEventPayload,
  EdgeEventPayload,
  AttributeUpdatePayload,
  SerializedUGM,
  PropertyMap,
} from "./core/ugm";

// Adapters
export type { GraphAdapter, SchemaModel } from "./core/adapter";
export { SparqlAdapter } from "./core/adapter";
export { CypherAdapter } from "./core/adapter";
export { HolonicAdapter } from "./core/adapter";
export { RestAdapter } from "./core/adapter/rest-adapter";
export { GremlinAdapter } from "./core/adapter/gremlin-adapter";
export type {
  RestAdapterConfig,
  RestResponseMapping,
} from "./core/adapter/rest-adapter";
export type { GremlinAdapterConfig } from "./core/adapter/gremlin-adapter";

// Middleware
export {
  composeMiddleware,
  defaultFetch,
  bearerAuth,
  apiKeyHeader,
  retryOnError,
  requestLogger,
} from "./core/middleware";
export type {
  AdapterRequest,
  AdapterResponse,
  Middleware,
} from "./core/middleware";

// Event bus
export { G3tEventBus, eventBus } from "./core/event-bus";
export type { G3tEvents, G3tEventName } from "./core/event-bus";

// Pipeline
export {
  PipelineRegistry,
  createCountByType,
  createCountByProperty,
  createDegreeDistribution,
  createEdgeTypeBreakdown,
  createPropertyCorrelation,
  createCentralityVsProperty,
  createActivityTimeline,
  createCommunityBreakdown,
} from "./core/pipeline";
export type {
  DataPipeline,
  CategoricalData,
  ScatterData,
  TimeSeriesData,
  CategoricalSelection,
  RangeSelection,
  PointSetSelection,
  ChartSelection,
} from "./core/pipeline";

// Filter
export {
  evaluateFilter,
  createViewFilter,
  applyViewFilter,
  showOnlySelected,
  hideSelected,
  expandToNHops,
} from "./core/filter";
export type { PropertyFilter, FilterGroup, ViewFilter } from "./core/filter";

// SHACL
export { validateShacl, summarizeValidation } from "./core/shacl";
export type {
  ShaclShape,
  ShaclPropertyConstraint,
  ShaclViolation,
  ShaclValidationResult,
} from "./core/shacl";

// Style override (models only; store is in @g3t/react)
export {
  overridesToCytoscapeStyles,
  ICONS,
  ICON_NAMES,
  svgToDataUri,
  serializeOverrides,
  deserializeOverrides,
} from "./core/style-override";
export type { NodeStyleOverride, CytoscapeShape } from "./core/style-override";
export {
  TypeMenuProvider,
  createDefaultTypeMenuProvider,
} from "./core/style-override";
export type { TypeMenuItem } from "./core/style-override";

// Advanced
export {
  extractProvOProperties,
  PROVO_MAPPINGS,
  DerivedPropertyEngine,
  pinNodes,
  unpinAll,
} from "./core/advanced";
export type { DerivedProperty } from "./core/advanced";

// Projection
export { ProjectionPipeline } from "./core/projection";
export {
  blankNodeCollapse,
  literalCollapse,
  listCollapse,
  reificationCollapse,
} from "./core/projection";
export { createPresetPipeline } from "./core/projection";

// Algorithms + utilities
export { ingestAlgorithmResults } from "./core/algorithm-adapter";
export {
  virtualizeRelationalData,
  parseCSV,
} from "./core/relational-virtualizer";
export { diffGraphs, computeSchemaHash } from "./core/diff";
