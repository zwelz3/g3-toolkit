/**
 * Browser-acceptance test hooks (the postmortem-mandated harness
 * channel; planning/expand-collapse-postmortem.md gates 1-4).
 *
 * Specs need to assert DRAWN state (compound bounds, port anchors,
 * overlay routes) against the GEOMETRY document, through the real
 * renderer. This module publishes live handles to `window.__g3t`
 * ONLY when the page was opened with `?e2e=1`, and only from DEMO
 * code: the packages stay clean of test plumbing.
 *
 * Contract (consumed by tests/e2e/*acceptance*.spec.ts):
 *   window.__g3t = {
 *     canvases: Map<key, CyLike>       // live cytoscape instances
 *     scenes:   Map<key, StructuralScene> // the structural doc a
 *                                         // canvas is rendering
 *   }
 * Keys are shell-chosen ("mbse", "style-lab-legacy",
 * "style-lab-engine"). Entries are overwritten per mount; specs read
 * the CURRENT scene after waiting on visible state, never a cached
 * copy.
 */
import type { Core } from "cytoscape";
import type { StructuralGeometry, StructuralGraphInput } from "@g3t/core";

export interface E2eScene {
  input: StructuralGraphInput;
  geometry: StructuralGeometry;
}

interface E2eRegistry {
  canvases: Map<string, Core>;
  scenes: Map<string, E2eScene>;
}

declare global {
  interface Window {
    __g3t?: E2eRegistry;
  }
}

export function e2eEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("e2e")
  );
}

function registry(): E2eRegistry {
  const w = window;
  if (!w.__g3t) w.__g3t = { canvases: new Map(), scenes: new Map() };
  return w.__g3t;
}

/** onReady callback that publishes the live instance, or undefined
 *  when not in e2e mode (so shells can pass it unconditionally). */
export function publishCanvas(key: string): ((cy: Core) => void) | undefined {
  if (!e2eEnabled()) return undefined;
  return (cy: Core) => {
    registry().canvases.set(key, cy);
  };
}

/** Publish (or clear) the structural scene a canvas renders. No-op
 *  outside e2e mode. */
export function publishScene(key: string, scene: E2eScene | null): void {
  if (!e2eEnabled()) return;
  if (scene === null) registry().scenes.delete(key);
  else registry().scenes.set(key, scene);
}
