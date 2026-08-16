/**
 * Style Override Zustand Store (moved from core to comply with D6).
 *
 * Core module exports the model types and pure functions.
 * This store manages the reactive state for React components.
 */

import { create } from "zustand";
import type { NodeStyleOverride } from "@g3t/core";

export interface StyleOverrideState {
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

/**
 * R-13 (register, 2026-08-05): which nodes on screen carry MANUAL
 * styling. Without this there is no supported way to ask, so a
 * legend asserting "this colour means this class" goes on
 * asserting it after a reader has repainted one node, and the
 * legend is silently false.
 *
 * Pure over the override list so a consumer can call it with a
 * store snapshot, a persisted list, or a subset in scope.
 */
export function overriddenNodeIds(
  overrides: readonly NodeStyleOverride[],
  ugm?: { getNodeIds: () => string[]; getNode: (id: string) => unknown },
): string[] {
  const direct = new Set<string>();
  const types = new Set<string>();
  for (const o of overrides) {
    if ("nodeId" in o.scope) direct.add(o.scope.nodeId);
    else if ("type" in o.scope) types.add(o.scope.type);
  }
  if (types.size === 0 || ugm === undefined) return [...direct];
  // A type-scoped override styles every node of that type, so the
  // answer needs the graph to resolve it.
  for (const id of ugm.getNodeIds()) {
    const attrs = ugm.getNode(id) as { types?: string[] } | undefined;
    if (attrs?.types?.some((t) => types.has(t)) === true) direct.add(id);
  }
  return [...direct];
}

/** R-13: the scopes currently overriding, for disclosure copy. */
export function overrideScopeSummary(overrides: readonly NodeStyleOverride[]): {
  nodes: number;
  types: string[];
} {
  const types: string[] = [];
  let nodes = 0;
  for (const o of overrides) {
    if ("nodeId" in o.scope) nodes += 1;
    else if ("type" in o.scope) types.push(o.scope.type);
  }
  return { nodes, types };
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
