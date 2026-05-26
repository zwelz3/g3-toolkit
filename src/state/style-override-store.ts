/**
 * Style Override Zustand Store (moved from core to comply with D6).
 *
 * Core module exports the model types and pure functions.
 * This store manages the reactive state for React components.
 */

import { create } from "zustand";
import type { NodeStyleOverride } from "@core/style-override/style-override";

interface StyleOverrideState {
  overrides: NodeStyleOverride[];
  add: (override: NodeStyleOverride) => void;
  remove: (scope: NodeStyleOverride["scope"]) => void;
  clear: () => void;
}

function scopeEquals(
  a: NodeStyleOverride["scope"],
  b: NodeStyleOverride["scope"],
): boolean {
  if ("nodeId" in a && "nodeId" in b) return a.nodeId === b.nodeId;
  if ("type" in a && "type" in b) return a.type === b.type;
  return false;
}

export const useStyleOverrideStore = create<StyleOverrideState>((set) => ({
  overrides: [],
  add: (override) =>
    set((state) => {
      const filtered = state.overrides.filter(
        (o) => !scopeEquals(o.scope, override.scope),
      );
      return { overrides: [...filtered, override] };
    }),
  remove: (scope) =>
    set((state) => ({
      overrides: state.overrides.filter((o) => !scopeEquals(o.scope, scope)),
    })),
  clear: () => set({ overrides: [] }),
}));
