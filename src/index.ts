/**
 * g3-toolkit public API.
 *
 * Core modules (D6: framework-agnostic):
 */
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

export {
  ContextMenuManager,
  createDefaultMenuManager,
} from "./interaction/context-menu";
export type {
  MenuItem,
  MenuTarget,
  MenuTargetType,
} from "./interaction/context-menu";

/**
 * View components (D13: React):
 */
export { CytoscapeCanvas } from "./views/canvas";
export type { CytoscapeCanvasProps } from "./views/canvas";
export { ugmToCytoscapeElements } from "./views/canvas";
export {
  OKABE_ITO_COLORS,
  NODE_SHAPES,
  buildTypeVisualMap,
} from "./views/canvas";

export { DetailInspector } from "./views/inspector";
export type { DetailInspectorProps } from "./views/inspector";

export { TableView } from "./views/table";
export type { TableViewProps } from "./views/table";

/**
 * State (M1):
 */
export { useSelectionStore } from "./state";
export type { SelectionState } from "./state";
export { UndoRedoStack } from "./state";
export type { UndoRedoOptions } from "./state";

/**
 * Core modules (M1, D6: framework-agnostic):
 */
export { WorkingSetManager } from "./core/working-set-manager";
export type { ViewType, LimitCheckResult } from "./core/working-set-manager";

/**
 * Interaction modules (M1):
 */
export { expandNeighbors } from "./interaction/neighbors";
export type { ExpandResult } from "./interaction/neighbors";

export { FacetFilter } from "./interaction/filter";
export type { FacetFilterProps } from "./interaction/filter";

export { SearchBar } from "./interaction/search";
export type { SearchBarProps, SearchResult } from "./interaction/search";

export { TagManager } from "./interaction/tag-manager";

export { GroupingManager } from "./interaction/grouping";
export type { GroupInfo } from "./interaction/grouping";

export { LayoutSwitcher, usePinState } from "./interaction/layout-switcher";
export type {
  LayoutSwitcherProps,
  PinState,
} from "./interaction/layout-switcher";

/**
 * Layout engines (M2, D6: framework-agnostic):
 */
export type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./core/layout";
export { ForceLayout } from "./core/layout";
export { HierarchyLayout } from "./core/layout";
export { DagreLayout } from "./core/layout";
export { ElkLayout } from "./core/layout";

/**
 * Adapters (M3, D6: framework-agnostic):
 */
export type { GraphAdapter, SchemaModel } from "./core/adapter";
export { SparqlAdapter } from "./core/adapter";
export { CypherAdapter } from "./core/adapter";
export { HolonicAdapter } from "./core/adapter";
export { GremlinAdapter } from "./core/adapter";
export type { GremlinAdapterConfig } from "./core/adapter";
export { RestAdapter } from "./core/adapter/rest-adapter";
export type {
  RestAdapterConfig,
  RestResponseMapping,
  RestNodeMapping,
  RestEdgeMapping,
} from "./core/adapter/rest-adapter";

/**
 * Middleware (M10.5, D6):
 */
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

/**
 * Event Bus (M10.5, D6):
 */
export { G3tEventBus, eventBus } from "./core/event-bus";
export type { G3tEvents, G3tEventName } from "./core/event-bus";

/**
 * DataPipeline (M11, D6):
 */
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

/**
 * Property Filtering (M11, D6):
 */
export {
  evaluateFilter,
  createViewFilter,
  applyViewFilter,
  showOnlySelected,
  hideSelected,
  expandToNHops,
} from "./core/filter";
export type { PropertyFilter, FilterGroup, ViewFilter } from "./core/filter";

/**
 * Linked Charts (M11, D13):
 */
export { LinkedChart } from "./charts";
export type { LinkedChartProps, ChartType } from "./charts";

export type { Holon, Portal, HolonicDataset } from "./core/adapter";

export { ingestAlgorithmResults } from "./core/algorithm-adapter";

export {
  virtualizeRelationalData,
  parseCSV,
} from "./core/relational-virtualizer";
export type { VirtualizeOptions } from "./core/relational-virtualizer";

/**
 * Projection Pipeline (M4, D6: framework-agnostic):
 */
export {
  ProjectionPipeline,
  localPart,
  castLiteral,
  RDF,
} from "./core/projection";
export type {
  RDFTriple,
  RDFGraph,
  RDFObjectType,
  ProjectionStep,
  ProjectionStepConfig,
} from "./core/projection";
export {
  typeCollapse,
  literalCollapse,
  blankNodeCollapse,
  listCollapse,
  reificationCollapse,
} from "./core/projection";
export { createPresetPipeline, checkRenderPermission } from "./core/projection";
export type {
  PresetName,
  HolonicProjectionPipeline,
  ViewTarget,
  RenderRequest,
} from "./core/projection";

/**
 * Diff engine (M6, D6):
 */
export { diffGraphs, computeSchemaHash } from "./core/diff";
export type {
  DiffResult,
  NodeDiff,
  EdgeDiff,
  PropertyChange,
} from "./core/diff";

/**
 * Secondary views (M5, D13: React):
 */
export { TimelineView } from "./views/timeline";
export type { TimelineViewProps } from "./views/timeline";

export { MapView } from "./views/map";
export type { MapViewProps } from "./views/map";

export { StatsPanel } from "./views/stats";
export type { StatsPanelProps } from "./views/stats";

export { TreeView } from "./views/tree";
export type { TreeViewProps } from "./views/tree";

/**
 * Schema & Diff views (M6, D13: React):
 */
export { SchemaView } from "./views/schema";
export type { SchemaViewProps } from "./views/schema";

export { DiffRenderer } from "./views/schema";
export type { DiffRendererProps } from "./views/schema";

/**
 * Workspace (M6, D13: React):
 */
export {
  WorkspaceShell,
  saveWorkspace,
  loadWorkspace,
  getDefaultLayoutForRole,
} from "./workspace";
export type {
  WorkspaceShellProps,
  WorkspaceState,
  ViewFactory,
  RoleName,
} from "./workspace";

/**
 * Path analysis (M7, D6):
 */
export { findShortestPath } from "./interaction/path-analysis";
export type { PathResult, PathOptions } from "./interaction/path-analysis";

/**
 * Query editor (M7, D13: React):
 */
export { QueryEditor } from "./views/query";
export type { QueryEditorProps, QueryLanguage } from "./views/query";

/**
 * Chart views (M7, D13: React):
 */
export { SankeyView } from "./views/sankey";
export type { SankeyViewProps, FlowMode } from "./views/sankey";

export { MatrixView } from "./views/matrix";
export type { MatrixViewProps } from "./views/matrix";

/**
 * Accessibility (M8, D13: React):
 */
export {
  AriaCompanion,
  useAnnounce,
  HIGH_CONTRAST_DEFAULTS,
  HIGH_CONTRAST_ON,
} from "./a11y";
export type { AriaCompanionProps, HighContrastConfig } from "./a11y";

/**
 * Theming (M8.5, D6/D13):
 */
export {
  useThemeStore,
  deriveCytoscapeStyle,
  deriveEChartsTheme,
  LIGHT_THEME,
  DARK_THEME,
  HIGH_CONTRAST_THEME,
  THEME_PRESETS,
} from "./theme";
export type { G3tTheme } from "./theme";

/**
 * Visual Encoding (M8.5):
 */
export {
  encodingToCytoscapeStyle,
  DEFAULT_ENCODING,
  EncodingPanel,
  CanvasLegend,
} from "./interaction/encoding";
export type {
  EncodingConfig,
  EncodingPanelProps,
  CanvasLegendProps,
} from "./interaction/encoding";

/**
 * UX Surface (M8.5):
 */
export {
  HoverTooltip,
  ZoomControls,
  Toolbar,
  StatusBar,
  KeyboardShortcutModal,
} from "./interaction/toolbar";
export type {
  TooltipData,
  HoverTooltipProps,
  ZoomControlsProps,
  ToolbarProps,
  CanvasMode,
  StatusBarProps,
  KeyboardShortcutModalProps,
} from "./interaction/toolbar";

/**
 * FilterBuilder (M11, D13):
 */
export { FilterBuilder } from "./interaction/filter/FilterBuilder";
export type { FilterBuilderProps } from "./interaction/filter/FilterBuilder";

/**
 * Style Overrides (M12, D6):
 */
export {
  overridesToCytoscapeStyles,
  ICONS,
  ICON_NAMES,
  svgToDataUri,
  serializeOverrides,
  deserializeOverrides,
  TypeMenuProvider,
  createDefaultTypeMenuProvider,
} from "./core/style-override";
export type {
  NodeStyleOverride,
  CytoscapeShape,
  TypeMenuItem,
} from "./core/style-override";

/**
 * NodeStyleEditor (M12, D13):
 */
export { NodeStyleEditor } from "./interaction/encoding/NodeStyleEditor";
export type { NodeStyleEditorProps } from "./interaction/encoding/NodeStyleEditor";

/**
 * Advanced Features (M13, D6):
 */
export {
  extractProvOProperties,
  PROVO_MAPPINGS,
  DerivedPropertyEngine,
  pinNodes,
  unpinAll,
} from "./core/advanced";
export type { DerivedProperty } from "./core/advanced";

/**
 * Integration + UI (M12.E2.T3, M12.E4, M13.E2.T2, M13.E3.T2):
 */
export {
  registerEditAppearance,
  registerMultiSelectMenu,
  applyBulkStyle,
  TemporalRangeFilter,
  DerivedPropertyPanel,
} from "./interaction/remaining-tickets";
export type {
  TemporalRangeFilterProps,
  DerivedPropertyPanelProps,
} from "./interaction/remaining-tickets";

/**
 * Toolkit Context Menu Actions:
 */
export {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "./interaction/context-menu";
export type { ToolkitActionConfig } from "./interaction/context-menu";

/**
 * SHACL Validation (DE.1-2):
 */
export { validateShacl, summarizeValidation } from "./core/shacl";
export type {
  ShaclShape,
  ShaclPropertyConstraint,
  ShaclViolation,
  ShaclValidationResult,
} from "./core/shacl";
export { ShaclShapeBrowser } from "./views/schema/ShaclShapeBrowser";
export type { ShaclShapeBrowserProps } from "./views/schema/ShaclShapeBrowser";

export { useStyleOverrideStore } from "./state/style-override-store";

/**
 * F1-F8: Post-v1.0 features (now v1.0).
 */

// F2: Incremental layout
export {
  computeIncrementalUpdate,
  applyIncrementalLayout,
  capturePositions,
} from "./core/layout/incremental-layout";
export type { IncrementalLayoutOptions } from "./core/layout/incremental-layout";

// F3: Combo manager
export { ComboManager } from "./core/combo";
export type { Combo } from "./core/combo";

// F4: Annotations
export {
  AnnotationPanel,
  createLocalAnnotationStore,
} from "./interaction/annotations";
export type {
  Annotation,
  AnnotationStore,
  AnnotationPanelProps,
} from "./interaction/annotations";

// F5: Property editor
export { PropertyEditor } from "./interaction/property-editor";
export type {
  PropertyEditCallback,
  PropertyEditorProps,
} from "./interaction/property-editor";

// F6c: Temporal slider
export { TemporalSlider } from "./interaction/temporal";
export type { TemporalSliderProps } from "./interaction/temporal";

// LayoutManager (force controls, reset, freeze)
export { LayoutManager } from "./interaction/layout-manager";
export type { LayoutManagerProps } from "./interaction/layout-manager";
export type { LayoutOptions as LayoutManagerOptions } from "./interaction/layout-manager";
