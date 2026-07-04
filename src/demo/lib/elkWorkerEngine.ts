/**
 * Worker-backed ELK engine for the demo shells.
 *
 * Structural layout (the block view) runs through elkjs. The bundled
 * build runs ON the calling thread, so a cold layout blocks rendering
 * for a beat; under React StrictMode's dev double-invoke it ran twice.
 * This wires the elkjs WORKER build so layout runs OFF the main thread,
 * then injects it into layoutStructural via @g3t/core's ElkEngine seam.
 *
 * Demo harness furniture: core stays framework-agnostic and never
 * constructs a Worker itself (a Worker URL is bundler-specific). If a
 * Worker cannot be created, this returns undefined and the caller falls
 * back to core's default synchronous engine, so the demo never breaks.
 */
import ELK from "elkjs/lib/elk-api.js";
import type { ElkEngine } from "@g3t/core";

// Created once, then reused; null records a failed attempt so we do not
// retry the construction (and silently keep using the sync fallback).
let cached: ElkEngine | null | undefined;

/**
 * The shared worker-backed ELK engine, or undefined if a Worker could
 * not be constructed (caller then uses core's default synchronous one).
 */
export function getWorkerElkEngine(): ElkEngine | undefined {
  if (cached !== undefined) return cached ?? undefined;
  try {
    const elk = new ELK({
      // Vite statically detects `new Worker(new URL(<literal>,
      // import.meta.url))` and bundles the worker; elk-worker expects a
      // classic worker, which is the default Worker type.
      workerFactory: () =>
        new Worker(new URL("elkjs/lib/elk-worker.min.js", import.meta.url)),
    });
    // elk-api's ELK is structurally an ElkEngine (layout(graph) =>
    // Promise<graph>); the cast bridges the two packages' ElkNode
    // declaration sites.
    cached = elk as unknown as ElkEngine;
  } catch {
    cached = null;
  }
  return cached ?? undefined;
}
