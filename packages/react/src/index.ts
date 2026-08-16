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
export {
  SvgAdapter,
  donutArcs,
  taperPolygon,
  trimToEllipse,
} from "./views/svg/svg-adapter";
export type {
  SvgAdapterProps,
  SvgSceneEdge,
  SvgSceneNode,
} from "./views/svg/svg-adapter";
export { resolveDragAttachment } from "./views/canvas/structural-to-cytoscape";
export { CanvasAdapter } from "./views/canvas2d/canvas-adapter";
export { harvestSceneFromCy } from "./views/scene/harvest-scene";
export type { HarvestedScene } from "./views/scene/harvest-scene";
export type { CanvasAdapterProps } from "./views/canvas2d/canvas-adapter";
export {
  buildDisplayList,
  CANVAS_ADAPTER_CAPABILITIES,
} from "./views/canvas2d/display-list";
export type { DrawOp, CanvasScene } from "./views/canvas2d/display-list";
export {
  StructuralSvgView,
  STRUCTURAL_SVG_DARK,
} from "./views/svg/structural-svg-view";
export type {
  StructuralSvgTheme,
  StructuralSvgViewProps,
  SvgViewTransform,
} from "./views/svg/structural-svg-view";
export { useStructuralLayout } from "./views/canvas/use-structural-layout";
export type { StructuralLayoutResult } from "./views/canvas/use-structural-layout";
export * from "./views/canvas";
export * from "./views/table";
export * from "./views/inspector";
// NOT re-exported here: ./views/timeline. TimelineView statically imports
// vis-timeline and vis-data, which package.json declares OPTIONAL peers, so
// a package manager does not install them. Module resolution runs before
// tree-shaking, which means a re-export from this barrel makes the very
// first `import { CytoscapeCanvas } from "@g3t/react"` fail to resolve for
// every consumer who took the documented install. TimelineView ships on its
// own subpath instead: `@g3t/react/timeline`. Enforced by
// scripts/check-optional-peers.mjs.
export * from "./views/map";
export * from "./views/tree";
export * from "./views/schema";
export { ViewErrorBoundary } from "./views/error/ViewErrorBoundary";
export type {
  ViewErrorBoundaryProps,
  ViewErrorFallbackArgs,
} from "./views/error/ViewErrorBoundary";
export { FloatingLegend } from "./views/legend/FloatingLegend";
export { FloatingPanel } from "./views/popout/FloatingPanel";
export type { FloatingPanelProps } from "./views/popout/FloatingPanel";
export { NeighborhoodPopout } from "./views/popout/NeighborhoodPopout";
export type { NeighborhoodPopoutProps } from "./views/popout/NeighborhoodPopout";
export { ShaclShapeBrowser } from "./views/schema/ShaclShapeBrowser";
export type { ShaclShapeBrowserProps } from "./views/schema/ShaclShapeBrowser";
// The validator's shape model, re-exported alongside the components
// that consume it so `ShaclShape` on this entry means one thing. A
// display-only type in SchemaView used to own this name here, and it
// was structurally incompatible (it keys its constraint list
// `constraints`, core keys it `properties`), so an adopter who imported
// ShaclShape and built an array for ShaclShapeBrowser got a type the
// component rejected. That type is now SchemaViewShape, and SchemaView
// accepts either form.
export type { ShaclShape } from "@g3t/core";
export * from "./views/matrix";
export * from "./views/sankey";
export * from "./views/query";
export * from "./views/stats";
export * from "./views/coverage";
export * from "./views/provenance";

// ── Controls (interaction subdirs) ──────────────────────────────────
// R-7 / R-1 / R-10: these shipped behind the interaction barrel and
// were unreachable from the package entry, so a consumer following
// the documented recipe could not import them. Verified by the
// export gate now.
export {
  relayoutAroundFixed,
  type RelayoutAroundFixedOptions,
} from "./interaction/relayout";
export {
  useElementPointerEvents,
  defaultClickDragThreshold,
  type ElementPointerOptions,
  type ElementPointerHandlers,
} from "./interaction/element-pointer-events";
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
  G3tLayeredLayout,
  WorkingSetManager,
} from "@g3t/core";
// The engines' option bag, re-exported alongside them so `LayoutOptions`
// on this entry means the thing the engines actually accept. The
// LayoutManager panel's UI state used to own this name here, which
// type-checked against ForceLayout.compute() and silently discarded
// every force-tuning field (audit 2026-08); that type is now
// LayoutPanelOptions.
export type { LayoutOptions } from "@g3t/core";
export * from "./icons";

// ── VisualAttributes -> Cytoscape projection (G3L:ARC-008 posture):
//    the style engine's first consumer, used by the Style Lab and by
//    engine-driven canvas surfaces ─────────────────────────────────
export {
  applyVisualAttributes,
  edgeAttributesToCy,
  nodeAttributesToCy,
} from "./views/canvas/visual-attributes-to-cytoscape";
export type { CyProjection } from "./views/canvas/visual-attributes-to-cytoscape";
// The `stylesheet` prop's element type: consumers building custom rule
// arrays need it (the Style Lab is the first).
export type { CyStylesheet } from "./views/canvas/CytoscapeCanvas";
// The canvas default rule stack + theme rules, exported so conformance
// oracles (the Style Lab) can reproduce the REAL browser stylesheet
// stack headlessly instead of comparing bare-cytoscape paths (the
// MR-7 oracle blind spot, closed).
export {
  DEFAULT_STYLESHEET,
  themeColorRules,
} from "./views/canvas/CytoscapeCanvas";

// R-15 (register, 2026-08-06): types a consumer must NAME to use a
// documented prop. The reported instance (SvgViewTransform) was one
// of four; the type-reachability gate found the rest.
export type { NodeStyleTarget } from "./interaction/encoding/NodeStyleEditor";
export type { LegendElement } from "./interaction/encoding/SpecLegend";
export type { CanvasInteractionOptions } from "./views/canvas/CytoscapeCanvas";
