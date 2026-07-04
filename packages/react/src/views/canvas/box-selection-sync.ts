/**
 * Box (lasso) selection -> selection-store sync.
 *
 * WHY NOT `boxend` + `:selected`: cytoscape emits `boxend` BEFORE it
 * applies the box's selection. In the installed cytoscape 3.33.4
 * mouseup handler the order is:
 *
 *   cy.emit('boxend');
 *   box.emit('box').stdFilter(eleWouldBeSelected).select().emit('boxselect');
 *
 * so a `boxend` handler reading `cy.nodes(":selected")` sees the
 * PRE-box state: empty on the first gesture, and on every later gesture
 * the PREVIOUS box's leftover `:selected` set (nothing else cleared
 * it). The old sync here therefore ran one gesture behind (field
 * report 2026-07-04: box {1,3,5} rendered nothing; box {2,4} rendered
 * {1,3,5} with {2,4} queued). jsdom tests bypass the renderer's
 * gesture pipeline entirely, which is why only live browser use
 * caught it; box-selection-sync.test.ts reproduces both the lag and
 * the fix against a real headless core.
 *
 * THE SYNC: cytoscape emits `box` once per element inside the box (all
 * boxed elements, before its own select pass filters to selectable
 * ones). Collect node ids from those events and flush ONCE on a
 * microtask: `box`, `select`, and `boxselect` all emit synchronously in
 * the same mouseup call stack, so by the first microtask cytoscape has
 * finished its own selection pass. The flush clears cytoscape's
 * internal `:selected` state (this codebase highlights via the
 * .g3t-selected class, never `:selected`) and pushes the boxed node
 * ids into the store.
 */
import type { Core, EventObject } from "cytoscape";

export function registerBoxSelectionSync(
  cy: Core,
  selectNodes: (ids: string[]) => void,
): void {
  let boxedIds: string[] = [];
  let flushQueued = false;

  cy.on("box", (e: EventObject) => {
    const target = e.target as { isNode?: () => boolean; id: () => string };
    if (typeof target.isNode === "function" && target.isNode()) {
      boxedIds.push(target.id());
    }
    if (!flushQueued) {
      flushQueued = true;
      queueMicrotask(() => {
        flushQueued = false;
        const ids = boxedIds;
        boxedIds = [];
        // Undo cytoscape's own :selected pass; highlighting is
        // class-based here.
        cy.elements().unselect();
        if (ids.length > 0) selectNodes(ids);
      });
    }
  });
}
