/**
 * @g3t/core public API.
 *
 * Framework-agnostic (D6): zero React, zero Zustand, zero Cytoscape imports.
 *
 * The boundary here is enforced two ways: (1) physical separation
 * (packages/core/src/ cannot relatively-import from packages/react/src/), and
 * (2) the module-boundary test in test/module-boundary.test.ts which
 * dynamically imports every entry below and asserts none of them pull in React.
 */

// ── Data model ──────────────────────────────────────────────────────
export { UGM } from "./ugm";
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
} from "./ugm";

// ── Adapters ────────────────────────────────────────────────────────
export type { GraphAdapter, SchemaModel } from "./adapter";
export { SparqlAdapter } from "./adapter";
export { CypherAdapter } from "./adapter";
export { HolonicAdapter } from "./adapter";
export { GremlinAdapter } from "./adapter";
export type { GremlinAdapterConfig } from "./adapter";
export { RestAdapter } from "./adapter/rest-adapter";
export type {
  RestAdapterConfig,
  RestResponseMapping,
  RestNodeMapping,
  RestEdgeMapping,
} from "./adapter/rest-adapter";
export type { Holon, Portal, HolonicDataset } from "./adapter";

// ── Middleware ──────────────────────────────────────────────────────
export {
  composeMiddleware,
  defaultFetch,
  bearerAuth,
  apiKeyHeader,
  retryOnError,
  requestLogger,
} from "./middleware";
export type {
  AdapterRequest,
  AdapterResponse,
  Middleware,
} from "./middleware";

// ── Event bus ───────────────────────────────────────────────────────
export { G3tEventBus, eventBus } from "./event-bus";
export type { G3tEvents, G3tEventName } from "./event-bus";

// ── Pipeline (chart data integration) ───────────────────────────────
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

// ── Filter ──────────────────────────────────────────────────────────
export {
  evaluateFilter,
  createViewFilter,
  applyViewFilter,
  showOnlySelected,
  hideSelected,
  expandToNHops,
} from "./filter";
export type { PropertyFilter, FilterGroup, ViewFilter } from "./filter";

// ── SHACL ───────────────────────────────────────────────────────────
export { validateShacl, summarizeValidation, ShaclValidator } from "./shacl";
export type {
  ShaclShape,
  ShaclPropertyConstraint,
  ShaclViolation,
  ShaclValidationResult,
} from "./shacl";

// ── Style override (models only; React store is in @g3t/react/state) ──
export {
  overridesToCytoscapeStyles,
  ICONS,
  ICON_NAMES,
  svgToDataUri,
  serializeOverrides,
  deserializeOverrides,
  TypeMenuProvider,
  createDefaultTypeMenuProvider,
} from "./style-override";
export type {
  NodeStyleOverride,
  CytoscapeShape,
  TypeMenuItem,
} from "./style-override";

// ── Advanced (provenance, derived properties, pinning) ──────────────
export {
  extractProvOProperties,
  PROVO_MAPPINGS,
  DerivedPropertyEngine,
  pinNodes,
  unpinAll,
} from "./advanced";
export type { DerivedProperty } from "./advanced";

// ── Projection (RDF → LPG) ──────────────────────────────────────────
export {
  ProjectionPipeline,
  localPart,
  castLiteral,
  RDF,
} from "./projection";
export type {
  RDFTriple,
  RDFGraph,
  RDFObjectType,
  ProjectionStep,
  ProjectionStepConfig,
} from "./projection";
export {
  typeCollapse,
  literalCollapse,
  blankNodeCollapse,
  listCollapse,
  reificationCollapse,
} from "./projection";
export { createPresetPipeline, checkRenderPermission } from "./projection";
export type {
  PresetName,
  HolonicProjectionPipeline,
  ViewTarget,
  RenderRequest,
} from "./projection";

// ── Diff ────────────────────────────────────────────────────────────
export { diffGraphs, computeSchemaHash } from "./diff";
export type {
  DiffResult,
  NodeDiff,
  EdgeDiff,
  PropertyChange,
} from "./diff";

// ── Algorithms and utilities ────────────────────────────────────────
export { ingestAlgorithmResults } from "./algorithm-adapter";
export {
  virtualizeRelationalData,
  parseCSV,
} from "./relational-virtualizer";
export type { VirtualizeOptions } from "./relational-virtualizer";

// ── Layout engines (D6: pure compute) ───────────────────────────────
export {
  ForceLayout,
  HierarchyLayout,
  DagreLayout,
  ElkLayout,
} from "./layout";
export type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./layout";
export {
  computeIncrementalUpdate,
  applyIncrementalLayout,
  capturePositions,
  IncrementalLayout,
} from "./layout/incremental-layout";
export type { IncrementalLayoutOptions } from "./layout/incremental-layout";

// ── Combo (node grouping model) ─────────────────────────────────────
export { ComboManager } from "./combo";
export type { Combo } from "./combo";

// ── Working set (limits per view; D6 logic) ─────────────────────────
export { WorkingSetManager } from "./working-set-manager";
export type { ViewType, LimitCheckResult } from "./working-set-manager";

// ── Undo/redo stack (D6 pure logic; reclassified from @g3t/react in P3.2) ──
export { UndoRedoStack } from "./undo-redo";
export type { UndoRedoOptions } from "./undo-redo";

// ── Design tokens (D6 data; reclassified from @g3t/react in P3.2) ──
// `injectDesignTokens` writes CSS custom properties to documentElement and
// thus touches the DOM, but the values themselves are pure data.
export {
  DESIGN_TOKENS,
  DARK_SHADOWS,
  injectDesignTokens,
} from "./theme";

// ── Path analysis (D6; reclassified from @g3t/react in P3.2) ────────
export { findShortestPath } from "./path-analysis";
export type { PathResult, PathOptions } from "./path-analysis";
