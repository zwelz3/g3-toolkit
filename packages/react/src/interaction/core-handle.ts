/**
 * One name for the Cytoscape handle (issue #18, maintainer ruling
 * 2026-10-13): every component that takes the instance `onReady` hands
 * out names the prop `core`. `GraphToolbar` shipped it as `cy` and
 * `Minimap` as `core`, so a shell wiring both wrote the same value
 * under two names in adjacent JSX, which read as two different things.
 *
 * `cy` is NOT removed: it stays accepted for one major as a deprecated
 * alias, so a 1.x consumer migrates on its own schedule. Resolution is
 * `core ?? cy`; when both are supplied `core` wins and `cy` is ignored,
 * so a caller mid-migration can never hand one component two
 * different instances. Omitting both resolves to null, the same
 * "canvas not mounted yet" state the components already handle.
 *
 * The deprecation warning fires ONCE per component in development
 * (module-level guard keyed by component name, the same NODE_ENV gate
 * CytoscapeCanvas uses for its own deprecated `structural` prop), and
 * only when the alias is the sole handle supplied. Production bundles
 * emit nothing. This module is internal: it is not re-exported from
 * the package entry points.
 */

import type { Core } from "cytoscape";

const warnedComponents = new Set<string>();

export function resolveCoreHandle(
  component: string,
  core: Core | null | undefined,
  cy: Core | null | undefined,
): Core | null {
  if (
    core === undefined &&
    cy !== undefined &&
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production" &&
    !warnedComponents.has(component)
  ) {
    warnedComponents.add(component);
    console.warn(
      `[g3t] ${component}'s \`cy\` prop is deprecated and will be removed in the next major: pass the Cytoscape instance as \`core\` instead.`,
    );
  }
  return core ?? cy ?? null;
}

/** Test seam: forget which components have already warned, so a suite
 *  can assert the once-per-component guard from a known state. */
export function resetCoreHandleWarnings(): void {
  warnedComponents.clear();
}
