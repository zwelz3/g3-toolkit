/**
 * R-7 (upstream register, 2026-08-03): a compound container dragged
 * or resized under a force layout can end up overlapping unrelated
 * nodes, and there was no supported way to settle the neighbours
 * around it. The request offered "an option to re-run the layout
 * with the moved container fixed, OR a statement that it is out of
 * scope". Out of scope is the wrong answer for a graph toolkit whose
 * containers are draggable, and the mechanism is small: lock the
 * elements the user placed, run the layout INCREMENTALLY so the rest
 * settles around them, unlock.
 */
import type { Core, LayoutOptions } from "cytoscape";

export interface RelayoutAroundFixedOptions {
  /** Element ids to hold in place (the moved container, usually
   *  with its descendants: pass includeDescendants). */
  fixed: readonly string[];
  /** Layout name; defaults to the incremental force layout. */
  name?: string;
  /** Extra layout options merged last. */
  layoutOptions?: Record<string, unknown>;
  /** Also lock every descendant of each fixed compound parent
   *  (default true: moving a container should not scatter its own
   *  children). */
  includeDescendants?: boolean;
}

/**
 * Re-runs the layout with `fixed` held in place so neighbours settle
 * around them. Resolves when the layout stops. Locks are always
 * released, including on layout error.
 */
export async function relayoutAroundFixed(
  cy: Core,
  options: RelayoutAroundFixedOptions,
): Promise<void> {
  const { fixed, includeDescendants = true } = options;
  if (typeof cy.destroyed === "function" && cy.destroyed()) return;

  let held = cy.collection();
  for (const id of fixed) {
    const ele = cy.getElementById(id);
    if (ele.nonempty()) {
      held = held.union(ele);
      if (includeDescendants && ele.isParent()) {
        held = held.union(ele.descendants());
      }
    }
  }
  if (held.empty()) return;

  // cytoscape's filter callback is typed as the union singular
  // argument; nodes carry locked(), edges do not.
  const previouslyLocked = held.nodes().filter((e) => e.locked());
  held.lock();
  try {
    await new Promise<void>((resolve) => {
      const layout = cy.layout({
        name: options.name ?? "fcose",
        // Incremental: the point is to settle AROUND the fixed
        // elements, not to re-derive the whole arrangement.
        randomize: false,
        animate: false,
        fit: false,
        ...options.layoutOptions,
      } as unknown as LayoutOptions);
      layout.one("layoutstop", () => resolve());
      layout.run();
    });
  } finally {
    held.unlock();
    previouslyLocked.lock();
  }
}
