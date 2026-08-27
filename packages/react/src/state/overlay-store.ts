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
import type { StructuralOverlay, OverlayTone } from "@g3-toolkit/core";
import { OVERLAY_TONE_ORDER } from "@g3-toolkit/core";

export interface OverlayState {
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
  /** Resolved tone per member, strongest-wins across active overlays.
   *  Only elements whose winning tone is non-neutral appear; a
   *  neutral member is simply absent, so callers can treat "not in
   *  the map" as the plain emphasis that predates tones. */
  nodeTones: Map<string, OverlayTone>;
  edgeTones: Map<string, OverlayTone>;
}

/** Union semantics over the active overlays: a member of ANY active
 *  overlay is emphasized; with at least one overlay active, every
 *  non-member is de-emphasized. Pure; the canvas effect applies
 *  exactly this.
 *
 *  Tone resolution rides along on the same pass: an element in
 *  several active overlays takes the STRONGEST tone among them
 *  (OVERLAY_TONE_ORDER, strongest last), so a node that is both a
 *  violation and an info reads as a violation. */
export function computeOverlayMembership(
  overlays: StructuralOverlay[],
  activeIds: string[],
): OverlayMembership {
  const active = overlays.filter((o) => activeIds.includes(o.id));
  const memberNodes = new Set<string>();
  const memberEdges = new Set<string>();
  const nodeTones = new Map<string, OverlayTone>();
  const edgeTones = new Map<string, OverlayTone>();

  const rank = (t: OverlayTone) => OVERLAY_TONE_ORDER.indexOf(t);
  const raise = (map: Map<string, OverlayTone>, id: string, t: OverlayTone) => {
    // "neutral" is the absence of a tone, not a value worth storing:
    // keeping it out means a caller can test map.has(id) for "this
    // element wants a tone treatment".
    if (t === "neutral") return;
    const current = map.get(id);
    if (current === undefined || rank(t) > rank(current)) map.set(id, t);
  };

  for (const overlay of active) {
    const tone = overlay.tone ?? "neutral";
    for (const id of overlay.nodeIds) {
      memberNodes.add(id);
      raise(nodeTones, id, tone);
    }
    for (const id of overlay.edgeIds) {
      memberEdges.add(id);
      raise(edgeTones, id, tone);
    }
  }
  return {
    anyActive: active.length > 0,
    memberNodes,
    memberEdges,
    nodeTones,
    edgeTones,
  };
}
