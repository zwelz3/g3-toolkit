/**
 * @g3t/react entry point.
 *
 * React components and Zustand stores.
 * Peer deps: react, @g3t/core, cytoscape, zustand.
 */

// Views
export { CytoscapeCanvas } from "./views/canvas";
export { TableView } from "./views/table";
export { DetailInspector } from "./views/inspector";
export { TimelineView } from "./views/timeline";
export { MapView } from "./views/map";
export { TreeView } from "./views/tree";
export { SchemaView, DiffRenderer } from "./views/schema";
export { ShaclShapeBrowser } from "./views/schema/ShaclShapeBrowser";
export { MatrixView } from "./views/matrix";
export { SankeyView } from "./views/sankey";
export { QueryEditor } from "./views/query";
export { StatsPanel } from "./views/stats";

// Controls
export {
  EncodingPanel,
  CanvasLegend,
  DEFAULT_ENCODING,
  encodingToCytoscapeStyle,
} from "./interaction/encoding";
export { FacetFilter } from "./interaction/filter";
export { FilterBuilder } from "./interaction/filter/FilterBuilder";
export { SearchBar } from "./interaction/search";
export {
  Toolbar,
  ZoomControls,
  StatusBar,
  HoverTooltip,
  KeyboardShortcutModal,
} from "./interaction/toolbar";
export { ContextMenuManager } from "./interaction/context-menu";
export {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "./interaction/context-menu/toolkit-actions";
export { NodeStyleEditor } from "./interaction/encoding/NodeStyleEditor";
export {
  TemporalRangeFilter,
  DerivedPropertyPanel,
} from "./interaction/remaining-tickets";
export {
  registerEditAppearance,
  registerMultiSelectMenu,
  applyBulkStyle,
} from "./interaction/remaining-tickets";
export { LayoutSwitcher } from "./interaction/layout-switcher";
export { TagManager } from "./interaction/tag-manager";
export { GroupingManager } from "./interaction/grouping";

// State
export { useSelectionStore } from "./state/selection-store";
export { UndoRedoStack } from "./state/undo-redo";
export { useStyleOverrideStore } from "./state/style-override-store";

// Theme
export {
  useThemeStore,
  deriveCytoscapeStyle,
  deriveEChartsTheme,
} from "./theme/ThemeManager";
export {
  DESIGN_TOKENS,
  DARK_SHADOWS,
  injectDesignTokens,
} from "./theme/design-tokens";

// Accessibility
export { AriaCompanion } from "./a11y/AriaCompanion";

// Layout engines
export {
  ForceLayout,
  HierarchyLayout,
  DagreLayout,
  ElkLayout,
} from "./core/layout";

// Workspace (reference implementation)
export {
  WorkspaceShell,
  saveWorkspace,
  loadWorkspace,
} from "./workspace/WorkspaceShell";
export { WorkingSetManager } from "./core/working-set-manager";
