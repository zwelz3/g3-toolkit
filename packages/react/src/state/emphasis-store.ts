/**
 * Emphasis/effects layer (review 4.6 / CY-2): a first-class visual
 * state DISTINCT from selection.
 *
 * The review's antipattern: path operations called
 * `selectNodes(path.nodeIds)`, so a computed route was
 * indistinguishable from a user's selection, and nothing muted the
 * rest of the graph. An effect instead:
 *
 * - emphasizes the EDGES along the result (distinct color/width),
 * - keeps the result's nodes at full opacity WITHOUT selection
 *   styling (no outline; a route is not a selection),
 * - dims everything else while the effect is active.
 *
 * Same architecture as selection sync: a zustand store the canvas
 * subscribes to, applied as CSS classes in a batch (class changes
 * fire no cytoscape selection events, so no loops). Menu actions and
 * hosts read/write via getState() at event time.
 */
import { create } from "zustand";

export interface EmphasisState {
  active: boolean;
  /** Nodes that are PART of the effect: full opacity, no styling. */
  effectNodeIds: ReadonlySet<string>;
  /** Edges the effect emphasizes (e.g. the path's edges). */
  emphasizedEdgeIds: ReadonlySet<string>;
  /** Human-readable description for a host's clear-affordance chip. */
  label: string | null;
  setPathEffect: (
    nodeIds: readonly string[],
    edgeIds: readonly string[],
    label?: string,
  ) => void;
  clear: () => void;
}

export const useEmphasisStore = create<EmphasisState>((set) => ({
  active: false,
  effectNodeIds: new Set(),
  emphasizedEdgeIds: new Set(),
  label: null,
  setPathEffect: (nodeIds, edgeIds, label) =>
    set({
      active: true,
      effectNodeIds: new Set(nodeIds),
      emphasizedEdgeIds: new Set(edgeIds),
      label: label ?? null,
    }),
  clear: () =>
    set({
      active: false,
      effectNodeIds: new Set(),
      emphasizedEdgeIds: new Set(),
      label: null,
    }),
}));

/** The class surface the stylesheet rules target. */
export const EMPHASIS_EDGE_CLASS = "g3t-effect-edge";
export const EMPHASIS_DIM_CLASS = "g3t-effect-dim";

/** Minimal structural view of a cytoscape Core (unit-testable with a
 *  plain fake; the real Core satisfies it). */
export interface EmphasisCoreLike {
  batch: (fn: () => void) => void;
  elements: () => {
    addClass: (c: string) => unknown;
    removeClass: (c: string) => unknown;
  };
  getElementById: (id: string) => {
    length: number;
    addClass: (c: string) => unknown;
    removeClass: (c: string) => unknown;
  };
}

/**
 * Apply the emphasis state as classes. Dim-by-default then exempt:
 * everything dims, effect members and emphasized edges un-dim, and
 * emphasized edges additionally take the effect-edge class. Inactive
 * state strips both classes everywhere.
 */
export function applyEmphasisClasses(
  cy: EmphasisCoreLike,
  state: Pick<EmphasisState, "active" | "effectNodeIds" | "emphasizedEdgeIds">,
): void {
  cy.batch(() => {
    const all = cy.elements();
    all.removeClass(EMPHASIS_DIM_CLASS);
    all.removeClass(EMPHASIS_EDGE_CLASS);
    if (!state.active) return;
    cy.elements().addClass(EMPHASIS_DIM_CLASS);
    for (const id of state.effectNodeIds) {
      const el = cy.getElementById(id);
      if (el.length > 0) el.removeClass(EMPHASIS_DIM_CLASS);
    }
    for (const id of state.emphasizedEdgeIds) {
      const el = cy.getElementById(id);
      if (el.length > 0) {
        el.removeClass(EMPHASIS_DIM_CLASS);
        el.addClass(EMPHASIS_EDGE_CLASS);
      }
    }
  });
}
