/**
 * @g3t/react/views subpath barrel.
 *
 * View components: graph canvas, tabular, hierarchical, geographic,
 * schema browser, query editor, and statistics.
 *
 * TimelineView is NOT here. It statically imports the two optional peers
 * (vis-timeline, vis-data), so anything that re-exports it makes this
 * barrel unresolvable for a consumer who did not install them. It ships on
 * `@g3t/react/timeline` instead; see the note in ../index.ts.
 */

export * from "./canvas";
export * from "./table";
export * from "./inspector";
export * from "./map";
export * from "./tree";
export * from "./schema";
export { ShaclShapeBrowser } from "./schema/ShaclShapeBrowser";
export type { ShaclShapeBrowserProps } from "./schema/ShaclShapeBrowser";
// Same rationale as the root barrel: on this entry `ShaclShape` is the
// validator's model, and SchemaView's display-only type is
// SchemaViewShape.
export type { ShaclShape } from "@g3t/core";
export * from "./matrix";
export * from "./sankey";
export * from "./query";
export * from "./stats";

// Type-only re-exports so this subpath is self-sufficient. A consumer
// who imports CytoscapeCanvas or TableView from "@g3t/react/views" must
// be able to NAME the types their props take without also importing the
// root barrel; four of these were reachable only from there.
// `export type` on purpose: ContextMenuManager is a class, but nothing
// here needs to construct one, so this adds no runtime export.
// Enforced per entry point by scripts/check-type-reachability.mjs.
export type {
  CanvasInteractionOptions,
  CyStylesheet,
} from "./canvas/CytoscapeCanvas";
export type { ContextMenuManager } from "../interaction/context-menu/ContextMenuManager";
export type { EncodingSpec } from "../interaction/encoding/encoding-spec";
