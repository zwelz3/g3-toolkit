/**
 * Structural overlay registry (the structure-shaped half of the
 * algorithm story): named node/edge id sets registered as overlays,
 * independently toggleable, never mutating the UGM. The canvas
 * renders the union of ACTIVE overlays as emphasized members over
 * de-emphasized non-members, and restores fully when none are
 * active.
 *
 * @see specs/03-technical-data-layer.md R3.9 (structure-shaped
 * results as named overlays; implemented round 21, acceptance
 * verified through live review rounds 25-26)
 */

import { create } from "zustand";
import type { StructuralOverlay } from "@g3t/core";

interface OverlayState {
  overlays: StructuralOverlay[];
  activeIds: string[];
  register: (overlay: StructuralOverlay, activate?: boolean) => void;
  unregister: (id: string) => void;
  toggle: (id: string) => void;
  clear: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  overlays: [],
  activeIds: [],
  register: (overlay, activate = true) =>
    set((s) => ({
      overlays: [...s.overlays.filter((o) => o.id !== overlay.id), overlay],
      activeIds: activate
        ? [...s.activeIds.filter((id) => id !== overlay.id), overlay.id]
        : s.activeIds.filter((id) => id !== overlay.id),
    })),
  unregister: (id) =>
    set((s) => ({
      overlays: s.overlays.filter((o) => o.id !== id),
      activeIds: s.activeIds.filter((a) => a !== id),
    })),
  toggle: (id) =>
    set((s) => ({
      activeIds: s.activeIds.includes(id)
        ? s.activeIds.filter((a) => a !== id)
        : [...s.activeIds, id],
    })),
  clear: () => set({ overlays: [], activeIds: [] }),
}));

export interface OverlayMembership {
  anyActive: boolean;
  memberNodes: Set<string>;
  memberEdges: Set<string>;
}

/** Union semantics over the active overlays: a member of ANY active
 *  overlay is emphasized; with at least one overlay active, every
 *  non-member is de-emphasized. Pure; the canvas effect applies
 *  exactly this. */
export function computeOverlayMembership(
  overlays: StructuralOverlay[],
  activeIds: string[],
): OverlayMembership {
  const active = overlays.filter((o) => activeIds.includes(o.id));
  const memberNodes = new Set<string>();
  const memberEdges = new Set<string>();
  for (const overlay of active) {
    for (const id of overlay.nodeIds) memberNodes.add(id);
    for (const id of overlay.edgeIds) memberEdges.add(id);
  }
  return { anyActive: active.length > 0, memberNodes, memberEdges };
}
