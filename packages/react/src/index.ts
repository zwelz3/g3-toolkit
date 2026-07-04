/**
 * @g3t/react public API.
 *
 * React 19 components, Zustand stores, and CSS for the toolkit's UI layer (D13).
 * Peer deps: react, react-dom, cytoscape, zustand, @tanstack/react-table, @g3t/core.
 *
 * Architectural boundary: this package may consume @g3t/core but must not
 * import from @g3t/charts. The reverse direction (@g3t/core consuming
 * @g3t/react) is forbidden and verified by packages/core/src/module-boundary.test.ts.
 */

// CSS side-effect import. Marked sideEffects: ["*.css"] in package.json so this
// is preserved by tree-shaking. Consumers who want CSS-free imports should
// migrate to the per-component subpath exports added in P2.4.
import "./theme/g3t-base.css";

// ── Views (each subdir re-exports its component and Props type) ─────
export * from "./views/canvas";
export * from "./views/table";
export * from "./views/inspector";
export * from "./views/timeline";
export * from "./views/map";
export * from "./views/tree";
export * from "./views/schema";
export { ShaclShapeBrowser } from "./views/schema/ShaclShapeBrowser";
export type { ShaclShapeBrowserProps } from "./views/schema/ShaclShapeBrowser";
export * from "./views/matrix";
export * from "./views/sankey";
export * from "./views/query";
export * from "./views/stats";
export * from "./views/coverage";
export * from "./views/provenance";

// ── Controls (interaction subdirs) ──────────────────────────────────
export * from "./interaction/encoding";
export { NodeStyleEditor } from "./interaction/encoding/NodeStyleEditor";
export type { NodeStyleEditorProps } from "./interaction/encoding/NodeStyleEditor";
export * from "./interaction/filter";
export { FilterBuilder } from "./interaction/filter/FilterBuilder";
export type { FilterBuilderProps } from "./interaction/filter/FilterBuilder";
export * from "./interaction/search";
export { SearchBar } from "./interaction/search/SearchBar";
export type { SearchBarProps } from "./interaction/search/SearchBar";
export * from "./interaction/toolbar";
export * from "./interaction/camera";
export * from "./interaction/context-menu";
export {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "./interaction/context-menu/toolkit-actions";
export type { ToolkitActionConfig } from "./interaction/context-menu/toolkit-actions";
export * from "./interaction/tag-manager";
export * from "./interaction/grouping";
export * from "./interaction/layout-switcher";
export * from "./interaction/layout-manager";
export * from "./interaction/temporal";
export * from "./interaction/property-editor";
export * from "./interaction/annotations";
export * from "./interaction/workspace/workspace";
export * from "./interaction/algorithms/AlgorithmPanel";

// path-analysis is D6 and was moved to @g3t/core in P3.x. Re-exported
// here for backwards compatibility. Prefer importing from @g3t/core directly.
export { findShortestPath } from "@g3t/core";
export type { PathResult, PathOptions } from "@g3t/core";

// Loose files in interaction/ (not in a subdir)
export { expandNeighbors } from "./interaction/neighbors";
export type { ExpandResult } from "./interaction/neighbors";

// (TemporalRangeFilter, DerivedPropertyPanel, registerEditAppearance,
//  registerMultiSelectMenu, applyBulkStyle were previously consolidated in
//  interaction/remaining-tickets.tsx. P3.5 split that 328-line process-artifact
//  module along functional lines. The symbols flow into this barrel via the
//  earlier `export * from` lines for ./interaction/{context-menu,temporal,property-editor}.)

// ── State stores ────────────────────────────────────────────────────
export * from "./state";

// ── Theme ───────────────────────────────────────────────────────────
export * from "./theme";

// ── Accessibility ───────────────────────────────────────────────────
export * from "./a11y";

// (WorkspaceShell, saveWorkspace, loadWorkspace, getDefaultLayoutForRole
//  moved to examples/full-workspace/ in P3.3. WorkspaceShell was always
//  intended as a reference implementation rather than a published part
//  of @g3t/react; consumers wanting that shape can copy from the example
//  or pull it directly via the @g3t/example-full-workspace package.)

// ── Re-exports from @g3t/core (convenience for existing consumers) ─────
// These can also be imported directly from @g3t/core; either form works.
export {
  ForceLayout,
  HierarchyLayout,
  DagreLayout,
  ElkLayout,
  WorkingSetManager,
} from "@g3t/core";
export * from "./icons";
