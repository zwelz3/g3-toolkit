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
  /**
   * Currently selected node IDs.
   *
   * `ReadonlySet` on purpose. This store is one of the three declared
   * host-integration channels, so the collection is handed to code this
   * package does not own; typed as a mutable `Set` a host could call
   * `.add()` on it and change the selection without going through an
   * action, leaving subscribers unnotified and the canvas out of sync
   * with the store. The narrowing is compile-time only, so nothing
   * changes at runtime for a host that was already using the actions.
   */
  selectedNodeIds: ReadonlySet<string>;
  /** Currently selected edge IDs. See {@link selectedNodeIds}. */
  selectedEdgeIds: ReadonlySet<string>;
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
  /**
   * Clear all node and edge selections.
   *
   * The uniform reset name across every exported store. The other six
   * have always called it `clear`; this one called it `clearSelection`,
   * so a host wiring up two stores had to remember which was which.
   */
  clear: () => void;
  /**
   * @deprecated Use {@link clear}. Kept working so this is not a
   * breaking change, and removed no earlier than the next major, per
   * the deprecation policy in RELEASE.md.
   */
  clearSelection: () => void;
  /** Toggle a node in/out of selection (ctrl-click). */
  toggleNodeSelection: (id: string) => void;
  /** Set the hovered node (or null to clear hover). */
  setHover: (nodeId: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()(
  devtools(
    (set, get) => ({
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

      clear: () =>
        set({
          selectedNodeIds: new Set(),
          selectedEdgeIds: new Set(),
        }),
      // The deprecated alias DELEGATES rather than duplicating the
      // reset. Two copies of the same set() would be two things to keep
      // in step for as long as the alias lives.
      clearSelection: () => get().clear(),

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
