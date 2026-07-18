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
// ARCHIVED FROM THE PUBLIC SURFACE (owner ruling 2026-07-12,
// "archive don't delete"): six clusters of delivered, tested feature
// surface with no in-repo consumer left the barrel; the modules and
// their tests REMAIN in the tree and keep running (no rot, no
// deletion). Registry with the restore procedure: ARCHIVE.md at the
// package root. Analysis: planning/g3l/dead-code-analysis.md.
// DEMOTED FROM THE PUBLIC BARREL (2026-07-11 dead-code round):
// twenty internal helpers (text sizing, ELK graph assembly, QLT
// metric internals, SHACL row formatting, RDF term utilities) had no
// consumer outside @g3t/core; their tests import relatively and
// still run. Full analysis and the T2 ruling table (tested feature
// surface, NOT removed): planning/g3l/dead-code-analysis.md.
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
export type { GremlinAdapterConfig } from "./adapter";
export type {
  RestAdapterConfig,
  RestResponseMapping,
  RestNodeMapping,
  RestEdgeMapping,
} from "./adapter/rest-adapter";
export type { Holon, Portal, HolonicDataset } from "./adapter";

// ── Middleware ──────────────────────────────────────────────────────
export type { AdapterRequest, AdapterResponse, Middleware } from "./middleware";

// ── Event bus ───────────────────────────────────────────────────────
export { G3tEventBus, eventBus } from "./event-bus";
export type { G3tEvents, G3tEventName } from "./event-bus";

// ── Pipeline (chart data integration) ───────────────────────────────
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
export {
  validateShacl,
  summarizeValidation,
  ShaclValidator,
  shaclShapesToStructural,
  closedShapeIds,
  shaclRowSeverities,
  shaclRowId,
  reportFromValidationResults,
  severityOverlays,
  shaclResultDrivers,
  reportFocusNodes,
  resultSelectionIds,
  resultDetail,
} from "./shacl";
export type {
  ShaclShape,
  ShaclPropertyConstraint,
  ShaclViolation,
  ShaclValidationResult,
  ShaclToStructuralOptions,
  ShaclReportDocument,
  ShaclReportResult,
  ShaclSeverity,
  ShaclResultTargets,
  ShaclResultDetail,
} from "./shacl";

// ── Style override (models only; React store is in @g3t/react/state) ──
export {
  overridesToCytoscapeStyles,
  ICONS,
  ICON_NAMES,
} from "./style-override";
export type {
  NodeStyleOverride,
  CytoscapeShape,
  TypeMenuItem,
} from "./style-override";

// ── Advanced (provenance, derived properties, pinning) ──────────────
export { DerivedPropertyEngine, pinNodes } from "./advanced";
export type { DerivedProperty } from "./advanced";

// ── Projection (RDF → LPG) ──────────────────────────────────────────
export { ProjectionPipeline, RDF } from "./projection";
export type {
  RDFTriple,
  RDFGraph,
  RDFObjectType,
  ProjectionStep,
  ProjectionStepConfig,
} from "./projection";
export { typeCollapse } from "./projection";
export { createPresetPipeline } from "./projection";
export type {
  PresetName,
  HolonicProjectionPipeline,
  ViewTarget,
  RenderRequest,
} from "./projection";

// ── Diff ────────────────────────────────────────────────────────────
export { diffGraphs, computeSchemaHash } from "./diff";
export type { DiffResult, NodeDiff, EdgeDiff, PropertyChange } from "./diff";

// ── Algorithms and utilities ────────────────────────────────────────
export {
  ingestAlgorithmResults,
  parseAlgorithmResult,
  overlayFromPath,
  applyAlgorithmResult,
  connectedComponents,
  degreeCentrality,
} from "./algorithm-adapter";
export type {
  AlgorithmResultDocument,
  StructuralOverlay,
} from "./algorithm-adapter";
export { virtualizeRelationalData, parseCSV } from "./relational-virtualizer";
export type { VirtualizeOptions } from "./relational-virtualizer";

// ── Layout engines (D6: pure compute) ───────────────────────────────
export { ForceLayout, HierarchyLayout, DagreLayout, ElkLayout } from "./layout";
export type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./layout";
export type { IncrementalLayoutOptions } from "./layout/incremental-layout";
// ── Layout quality metrics (G3L:QLT-002): the falsifiability oracle
//    for engine comparisons and stability assertions ────────────────
export type {
  LayoutMetrics,
  LayoutMetricsInput,
  MetricsEdge,
  MetricsNode,
  SketchDisplacement,
} from "./metrics/layout-metrics";
// ── Style resolution core (G3L:ARC-002, STY-001..005): the pure
//    layered engine with dependency-tracked invalidation ────────────
export { StyleEngine, resolveStyles } from "./style/style-engine";
export type {
  DiagnosticsSink,
  InvalidationResult,
  StyleDiagnostic,
  StyleElement,
  StyleElementKind,
  StyleEngineConfig,
  StyleGraph,
  StyleRule,
  StyleRuleContext,
  StyleRuleDependencies,
  StyleSelector,
  StyleTheme,
} from "./style/style-engine";
export {
  contrastRatio,
  LIGHT_TOKENS,
  OKABE_ITO,
  relativeLuminance,
  themeFromTokens,
} from "./style/tokens";
export type { DesignTokens } from "./style/tokens";
export { applyLod, DEFAULT_LOD_SCHEDULE, resolveLod } from "./style/lod";
export type {
  LodContext,
  LodFeatureFlags,
  LodSchedule,
  LodTier,
  ResolvedLod,
} from "./style/lod";
export type {
  SerializableStyleRule,
  StyleConfigDocument,
  StyleConfigError,
  StyleConfigParseResult,
} from "./style/style-config-json";
export type {
  ArrowKind,
  DonutSegment,
  EdgeGradient,
  Glyph,
  Halo,
  NodeShape,
  VisualAttributeKey,
  VisualAttributes,
} from "./style/visual-attributes";
export {
  layoutStructural,
  isChainEdgeId,
  edgePortId,
  isEdgePortId,
} from "./layout/structural";
export type {
  StructuralGraphInput,
  StructuralNode,
  StructuralCompartment,
  StructuralRow,
  StructuralPort,
  StructuralEdge,
  StructuralGeometry,
  StructuralNodeGeometry,
  StructuralPortGeometry,
  StructuralEdgeGeometry,
  StructuralLayoutOptions,
  TextMeasure,
  PortSide,
  ElkEngine,
} from "./layout/structural";

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
  SEQUENTIAL_SCALE,
  DIVERGING_SCALE,
  scaleColor,
  prefersReducedMotion,
  injectDesignTokens,
} from "./theme";

// ── Path analysis (D6; reclassified from @g3t/react in P3.2) ────────
export { findShortestPath, allShortestPaths } from "./path-analysis";
export { khopNeighborhood } from "./path-analysis/khop";
export type { KhopOptions } from "./path-analysis/khop";
export type { PathResult, PathOptions } from "./path-analysis";
export * from "./export";
export { collapseByCluster, buildSubgraph } from "./scale/collapse-by-cluster";
export type {
  CollapseByClusterOptions,
  CollapseResult,
  SubgraphResult,
} from "./scale/collapse-by-cluster";

export {
  routeOrthogonal,
  polylineIntersectsBoxes,
} from "./route/orthogonal-router";
export type {
  OrthogonalRouteRequest,
  RouteBox,
  RouteSide,
  RouteTerminal,
} from "./route/orthogonal-router";
export {
  applyChangeSet,
  invertChangeSet,
  affectedRegion,
  serializeChangeSet,
  parseChangeSet,
} from "./model/change-set";
export type {
  StructuralChangeSet,
  StructuralDiff,
  ChangeSetDiagnostic,
  ApplyChangeSetResult,
  ChangeSetDocument,
} from "./model/change-set";
export {
  serializeGraphDocument,
  parseGraphDocument,
  validateGraphDocument,
  toStructuralInput,
  GRAPH_DOCUMENT_SCHEMA,
} from "./model/graph-document";
export type {
  GraphDocument,
  DocNode,
  DocEdge,
  DocPort,
  DocumentDiagnostic,
} from "./model/graph-document";
export { importElkJson } from "./model/elk-import";
export type { ElkJsonNode, ElkJsonEdge } from "./model/elk-import";
export { layoutStructuralWithChangeSet } from "./layout/change-driven-layout";
export type {
  ChangeDrivenLayoutResult,
  ChangeDrivenLayoutOptions,
} from "./layout/change-driven-layout";
export { hitTestScene, hitTestStructural, distToSegment } from "./hit/hit-test";
export type {
  SceneHit,
  StructuralHit,
  HitPoint,
  HitSceneNode,
  HitSceneEdge,
} from "./hit/hit-test";
