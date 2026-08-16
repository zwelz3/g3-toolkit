export { useSelectionStore } from "./selection-store";
export type { SelectionState } from "./selection-store";

// UndoRedoStack moved to @g3t/core in P3.2; re-exported here for backwards
// compatibility. Prefer importing directly from @g3t/core in new code.
export { UndoRedoStack } from "@g3t/core";
export type { UndoRedoOptions } from "@g3t/core";

// Every store's state type is exported. Four of the seven were not,
// so a host could subscribe to those stores but could not TYPE a
// selector over them without redeclaring the shape by hand, which then
// silently drifts. The stores are a declared integration channel; a
// channel you cannot name the type of is half a channel.
export {
  useStyleOverrideStore,
  overriddenNodeIds,
  overrideScopeSummary,
} from "./style-override-store";
export type { StyleOverrideState } from "./style-override-store";
export { usePositionPinStore, computeLockedIds } from "./position-pin-store";
export type { PositionPinState } from "./position-pin-store";
export { useOverlayStore, computeOverlayMembership } from "./overlay-store";
export type { OverlayMembership, OverlayState } from "./overlay-store";

export { useInspectorSectionStore } from "./inspector-section-store";
export type { InspectorSectionState } from "./inspector-section-store";
export {
  useEmphasisStore,
  applyEmphasisClasses,
  EMPHASIS_EDGE_CLASS,
  EMPHASIS_DIM_CLASS,
} from "./emphasis-store";
export type { EmphasisState, EmphasisCoreLike } from "./emphasis-store";
