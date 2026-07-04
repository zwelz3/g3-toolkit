/**
 * Structural compartment collapse state (roadmap/design/
 * structural-rendering.md, the collapse canvas slice). Holds the SET
 * of collapsed `${nodeId}::${compartmentId}` keys for structural
 * views, mirroring the position-pin store: the canvas host subscribes
 * and re-runs layoutStructural with the collapsed set folded into the
 * input (collapse is a LAYOUT-TIME input, not a style hide, so the
 * container actually shrinks).
 *
 * Built-in context-menu actions and host code both write here; the
 * store is the single source of truth and serializes into the
 * workspace document alongside pins and positions (a later
 * workspace-slice concern; the shape is chosen to drop in).
 *
 * Keys are built with `compartmentKey` from @g3t/core so producers
 * and consumers agree on the format.
 */

import { create } from "zustand";

interface CompartmentCollapseState {
  /** Collapsed `${nodeId}::${compartmentId}` keys. */
  collapsedKeys: string[];
  /** Collapse one compartment (idempotent). */
  collapse: (key: string) => void;
  /** Expand one compartment (idempotent). */
  expand: (key: string) => void;
  /** Toggle one compartment. */
  toggle: (key: string) => void;
  /** Toggle a batch as a unit: if ALL are collapsed, expand all;
   *  otherwise collapse all. Matches the "collapse this container's
   *  compartments" menu action. */
  toggleAll: (keys: readonly string[]) => void;
  /** Replace the entire collapsed set (host-driven, e.g. restore). */
  setCollapsed: (keys: readonly string[]) => void;
  clear: () => void;
}

export const useCompartmentCollapseStore = create<CompartmentCollapseState>(
  (set) => ({
    collapsedKeys: [],
    collapse: (key) =>
      set((s) =>
        s.collapsedKeys.includes(key)
          ? s
          : { collapsedKeys: [...s.collapsedKeys, key] },
      ),
    expand: (key) =>
      set((s) => ({
        collapsedKeys: s.collapsedKeys.filter((k) => k !== key),
      })),
    toggle: (key) =>
      set((s) =>
        s.collapsedKeys.includes(key)
          ? { collapsedKeys: s.collapsedKeys.filter((k) => k !== key) }
          : { collapsedKeys: [...s.collapsedKeys, key] },
      ),
    toggleAll: (keys) =>
      set((s) => {
        const current = new Set(s.collapsedKeys);
        const allCollapsed =
          keys.length > 0 && keys.every((k) => current.has(k));
        if (allCollapsed) {
          for (const k of keys) current.delete(k);
        } else {
          for (const k of keys) current.add(k);
        }
        return { collapsedKeys: [...current] };
      }),
    setCollapsed: (keys) => set({ collapsedKeys: [...keys] }),
    clear: () => set({ collapsedKeys: [] }),
  }),
);

/** The collapsed set as a Set, ready for layoutStructural's
 *  `collapsedCompartments` option. */
export function collapsedCompartmentSet(keys: readonly string[]): Set<string> {
  return new Set(keys);
}
