export { useSelectionStore } from "./selection-store";
export type { SelectionState } from "./selection-store";

// UndoRedoStack moved to @g3t/core in P3.2; re-exported here for backwards
// compatibility. Prefer importing directly from @g3t/core in new code.
export { UndoRedoStack } from "@g3t/core";
export type { UndoRedoOptions } from "@g3t/core";

export { useStyleOverrideStore } from "./style-override-store";
