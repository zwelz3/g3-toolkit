/**
 * Position pins (roadmap/design/toolbar-and-layouts.md, shipped
 * round 17): per-node position locks, composing with the toolbar's
 * whole-graph "Pin all".
 *
 * Composition semantics, exactly as designed: pin-all is the UNION
 * (everything locked while active); releasing pin-all returns to the
 * per-node pin set, never clears it. The canvas derives the locked
 * set through computeLockedIds so the rule is pure and tested.
 */

import { create } from "zustand";

interface PositionPinState {
  /** Per-node pins (nodeIds). */
  pinnedIds: string[];
  /** Whole-graph pin (the toolbar's "Pin all"). */
  allPinned: boolean;
  pin: (nodeId: string) => void;
  unpin: (nodeId: string) => void;
  toggle: (nodeId: string) => void;
  setAllPinned: (all: boolean) => void;
  clear: () => void;
}

export const usePositionPinStore = create<PositionPinState>((set) => ({
  pinnedIds: [],
  allPinned: false,
  pin: (nodeId) =>
    set((s) =>
      s.pinnedIds.includes(nodeId)
        ? s
        : { pinnedIds: [...s.pinnedIds, nodeId] },
    ),
  unpin: (nodeId) =>
    set((s) => ({ pinnedIds: s.pinnedIds.filter((id) => id !== nodeId) })),
  toggle: (nodeId) =>
    set((s) =>
      s.pinnedIds.includes(nodeId)
        ? { pinnedIds: s.pinnedIds.filter((id) => id !== nodeId) }
        : { pinnedIds: [...s.pinnedIds, nodeId] },
    ),
  setAllPinned: (all) => set({ allPinned: all }),
  clear: () => set({ pinnedIds: [], allPinned: false }),
}));

/** The set of node ids that must be LOCKED given the current pin
 *  state. Pure; the canvas effect locks exactly this set and unlocks
 *  everything else. */
export function computeLockedIds(
  allPinned: boolean,
  pinnedIds: string[],
  allNodeIds: string[],
): Set<string> {
  if (allPinned) return new Set(allNodeIds);
  return new Set(pinnedIds.filter((id) => allNodeIds.includes(id)));
}
