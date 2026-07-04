/**
 * Inspector section collapse state. Holds the set of collapsed section
 * ids (e.g. "properties", "importance") for the NodePropertyInspector.
 *
 * The state is graph-wide, not per-element: the inspector reads and
 * writes the same store regardless of which node or edge is selected, so
 * a user who collapses "Graph importance" and expands "Properties" keeps
 * that containment when they click a different element. Section ids are
 * stable strings shared by the node and edge layouts, so collapsing a
 * shared section (like "properties") carries across both.
 *
 * Mirrors compartment-collapse-store: a single source of truth that host
 * code can also drive (e.g. to restore a saved layout).
 */

import { create } from "zustand";

interface InspectorSectionState {
  /** Collapsed section ids. */
  collapsed: string[];
  /** Toggle one section's collapsed state (idempotent per call). */
  toggle: (id: string) => void;
  /** Force a section collapsed (true) or expanded (false). */
  setSection: (id: string, isCollapsed: boolean) => void;
  /** Replace the entire collapsed set (host-driven, e.g. restore). */
  setCollapsed: (ids: readonly string[]) => void;
  /** Clear all collapse state (everything expanded). */
  clear: () => void;
}

export const useInspectorSectionStore = create<InspectorSectionState>(
  (set) => ({
    collapsed: [],
    toggle: (id) =>
      set((s) =>
        s.collapsed.includes(id)
          ? { collapsed: s.collapsed.filter((x) => x !== id) }
          : { collapsed: [...s.collapsed, id] },
      ),
    setSection: (id, isCollapsed) =>
      set((s) => {
        const has = s.collapsed.includes(id);
        if (isCollapsed && !has) return { collapsed: [...s.collapsed, id] };
        if (!isCollapsed && has)
          return { collapsed: s.collapsed.filter((x) => x !== id) };
        return s;
      }),
    setCollapsed: (ids) => set({ collapsed: [...ids] }),
    clear: () => set({ collapsed: [] }),
  }),
);
