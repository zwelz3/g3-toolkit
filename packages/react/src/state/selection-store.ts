/**
 * Selection store: cross-view selection state managed by Zustand.
 *
 * All views (canvas, table, timeline, map) read and write to this
 * store. Changes trigger re-renders in subscribed components.
 *
 * @see specs/02-functional-interaction.md R2.5
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface SelectionState {
  /** Currently selected node IDs. */
  selectedNodeIds: Set<string>;
  /** Currently selected edge IDs. */
  selectedEdgeIds: Set<string>;
  /** Node currently being hovered (null if none). */
  hoveredNodeId: string | null;

  /** Replace the entire selection with the given node IDs. */
  selectNodes: (ids: string[]) => void;
  /** Replace the entire selection with the given edge IDs. */
  selectEdges: (ids: string[]) => void;
  /** Add node IDs to the existing selection (shift-click). */
  addNodesToSelection: (ids: string[]) => void;
  /** Remove ids from the node selection (review 4.12: the collapse
   *  counterpart to addNodesToSelection). */
  removeNodesFromSelection: (ids: string[]) => void;
  /** Add edge IDs to the existing selection. */
  addEdgesToSelection: (ids: string[]) => void;
  /** Clear all node and edge selections. */
  clearSelection: () => void;
  /** Toggle a node in/out of selection (ctrl-click). */
  toggleNodeSelection: (id: string) => void;
  /** Set the hovered node (or null to clear hover). */
  setHover: (nodeId: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()(
  devtools(
    (set) => ({
      selectedNodeIds: new Set<string>(),
      selectedEdgeIds: new Set<string>(),
      hoveredNodeId: null,

      selectNodes: (ids) =>
        set({
          selectedNodeIds: new Set(ids),
          selectedEdgeIds: new Set(),
        }),

      selectEdges: (ids) =>
        set({
          selectedNodeIds: new Set(),
          selectedEdgeIds: new Set(ids),
        }),

      addNodesToSelection: (ids) =>
        set((state) => {
          const next = new Set(state.selectedNodeIds);
          for (const id of ids) next.add(id);
          return { selectedNodeIds: next };
        }),

      removeNodesFromSelection: (ids) =>
        set((state) => {
          const next = new Set(state.selectedNodeIds);
          for (const id of ids) next.delete(id);
          return { selectedNodeIds: next };
        }),

      addEdgesToSelection: (ids) =>
        set((state) => {
          const next = new Set(state.selectedEdgeIds);
          for (const id of ids) next.add(id);
          return { selectedEdgeIds: next };
        }),

      clearSelection: () =>
        set({
          selectedNodeIds: new Set(),
          selectedEdgeIds: new Set(),
        }),

      toggleNodeSelection: (id) =>
        set((state) => {
          const next = new Set(state.selectedNodeIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { selectedNodeIds: next };
        }),

      setHover: (nodeId) => set({ hoveredNodeId: nodeId }),
    }),
    { name: "g3t-selection" },
  ),
);
