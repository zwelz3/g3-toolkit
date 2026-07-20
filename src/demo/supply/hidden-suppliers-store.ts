/**
 * Hidden-supplier state for the supply thread shell (review 3.8:
 * suppliers seed hidden so "Expand suppliers" is real graph
 * expansion). A zustand store, not component state, because the
 * context-menu closures are registered during render but read state
 * at event time; the canvas captures its menu manager once at mount,
 * so the manager must be stable and the state must be readable via
 * getState(), exactly like the selection store the same closures
 * already use.
 */
import { create } from "zustand";
import { buildDigitalThread } from "./model";

function seededHidden(): ReadonlySet<string> {
  const hidden = new Set<string>();
  buildDigitalThread().forEachNode((id, attrs) => {
    if (attrs.types.includes("Supplier")) hidden.add(id);
  });
  return hidden;
}

interface HiddenSuppliersState {
  hiddenIds: ReadonlySet<string>;
  /** Remove the given ids from the hidden set (expansion reveal). */
  reveal: (ids: readonly string[]) => void;
  revealAll: () => void;
  /** Back to the seeded state (tests; fresh-demo resets). */
  reset: () => void;
}

export const useHiddenSuppliersStore = create<HiddenSuppliersState>((set) => ({
  hiddenIds: seededHidden(),
  reveal: (ids) =>
    set((s) => {
      const next = new Set(s.hiddenIds);
      for (const id of ids) next.delete(id);
      return { hiddenIds: next };
    }),
  revealAll: () => set({ hiddenIds: new Set() }),
  reset: () => set({ hiddenIds: seededHidden() }),
}));
