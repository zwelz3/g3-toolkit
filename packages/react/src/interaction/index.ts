/**
 * @g3t/react/controls subpath barrel.
 *
 * Interactive controls: encoding panels, filtering, search, toolbar,
 * context menus, tag/group managers, layout switching, etc.
 *
 * Implementation note: the source directory is named "interaction" for
 * historical reasons; the public subpath is "controls" via the package's
 * exports map.
 */

export * from "./encoding";
export { NodeStyleEditor } from "./encoding/NodeStyleEditor";
export type { NodeStyleEditorProps } from "./encoding/NodeStyleEditor";
export * from "./filter";
export { FilterBuilder } from "./filter/FilterBuilder";
export type { FilterBuilderProps } from "./filter/FilterBuilder";
export * from "./search";
export { SearchBar } from "./search/SearchBar";
export type { SearchBarProps } from "./search/SearchBar";
export * from "./toolbar";
export * from "./context-menu";
export {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "./context-menu/toolkit-actions";
export type { ToolkitActionConfig } from "./context-menu/toolkit-actions";
export * from "./tag-manager";
export * from "./grouping";
export * from "./layout-switcher";
export * from "./layout-manager";
export * from "./temporal";
export * from "./property-editor";
export * from "./annotations";

// path-analysis is D6 (per its own header) and was moved to @g3t/core
// in P3.x. Re-exported here for backwards compatibility. Prefer importing
// directly from @g3t/core in new code.
export { findShortestPath } from "@g3t/core";
export type { PathResult, PathOptions } from "@g3t/core";

// Loose-file exports
export { expandNeighbors } from "./neighbors";
export type { ExpandResult } from "./neighbors";
// (TemporalRangeFilter, DerivedPropertyPanel, registerEditAppearance,
//  registerMultiSelectMenu, applyBulkStyle: split from the former
//  remaining-tickets.tsx in P3.5. Symbols flow in via the earlier
//  `export * from` lines for ./context-menu, ./temporal, ./property-editor.)
