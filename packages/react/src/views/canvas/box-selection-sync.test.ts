/**
 * Headless verification of the box-selection sync ordering fix.
 *
 * A real (headless) cytoscape core receives the EXACT emit sequence the
 * installed 3.33.4 renderer produces at mouseup (copied from its
 * source; the gesture itself needs a browser, the ordering does not):
 *
 *   cy.emit('boxend');
 *   box.emit('box').stdFilter(el => el.selectable() && !el.selected())
 *      .select().emit('boxselect');
 *
 * The OLD sync (boxend + `:selected` read) provably receives nothing
 * under this order; the new per-`box`-event sync must deliver the
 * boxed node ids and clear cytoscape's internal selection.
 */
import { describe, it, expect, vi } from "vitest";
import cytoscape from "cytoscape";
import { registerBoxSelectionSync } from "./box-selection-sync";

function makeCy() {
  return cytoscape({
    headless: true,
    elements: [
      { data: { id: "a" } },
      { data: { id: "b" } },
      { data: { id: "c" } },
      { data: { id: "ab", source: "a", target: "b" } },
    ],
  });
}

/** Replays the 3.33.4 mouseup emit order for a boxed collection. */
function emulateBoxGesture(cy: cytoscape.Core, boxedIds: string[]) {
  let box = cy.collection();
  for (const id of boxedIds) box = box.union(cy.getElementById(id));
  cy.emit("boxend");
  box
    .emit("box")
    .filter((el) => el.selectable() && !el.selected())
    .select()
    .emit("boxselect");
}

describe("registerBoxSelectionSync", () => {
  it("delivers the boxed node ids after cytoscape's own select pass", async () => {
    const cy = makeCy();
    const selectNodes = vi.fn();
    registerBoxSelectionSync(cy, selectNodes);

    emulateBoxGesture(cy, ["a", "b", "ab"]);
    // Synchronously nothing has flushed yet (microtask boundary).
    expect(selectNodes).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(selectNodes).toHaveBeenCalledTimes(1);
    expect(selectNodes.mock.calls[0]?.[0]?.sort()).toEqual(["a", "b"]); // nodes only
    // Cytoscape's internal :selected state is cleared (class-based
    // highlighting doctrine).
    expect(cy.$(":selected").length).toBe(0);
  });

  it("proves the old boxend + :selected read receives nothing under this order", async () => {
    const cy = makeCy();
    const seen: string[][] = [];
    cy.on("boxend", () => {
      seen.push(cy.nodes(":selected").map((n) => n.id()));
    });

    emulateBoxGesture(cy, ["a", "b"]);
    await Promise.resolve();
    expect(seen).toEqual([[]]); // the read the old sync depended on
  });

  it("reproduces the reported one-gesture lag of the OLD sync (field report 2026-07-04)", async () => {
    // Maintainer observation: box {a,b} renders nothing; box {c} then
    // renders {a,b}, with {c} queued. The old handler read :selected
    // inside boxend and was the only thing clearing it, so each gesture
    // delivered the PREVIOUS gesture's set.
    const cy = makeCy();
    const delivered: string[][] = [];
    cy.on("boxend", () => {
      const boxedNodes = cy.nodes(":selected").map((n) => n.id());
      cy.elements().unselect();
      if (boxedNodes.length > 0) delivered.push(boxedNodes);
    });

    emulateBoxGesture(cy, ["a", "b"]); // renders nothing
    emulateBoxGesture(cy, ["c"]); // renders the PREVIOUS set
    expect(delivered).toEqual([["a", "b"]]);
    // ...and {c} sits queued in :selected for a third gesture.
    expect(cy.$(":selected").map((el) => el.id())).toEqual(["c"]);
  });

  it("the NEW sync delivers each gesture's own set with no lag or queue", async () => {
    const cy = makeCy();
    const delivered: string[][] = [];
    registerBoxSelectionSync(cy, (ids) => delivered.push([...ids].sort()));

    emulateBoxGesture(cy, ["a", "b"]);
    await Promise.resolve();
    emulateBoxGesture(cy, ["c"]);
    await Promise.resolve();

    expect(delivered).toEqual([["a", "b"], ["c"]]);
    expect(cy.$(":selected").length).toBe(0); // nothing queued
  });

  it("flushes independent gestures independently", async () => {
    const cy = makeCy();
    const selectNodes = vi.fn();
    registerBoxSelectionSync(cy, selectNodes);

    emulateBoxGesture(cy, ["a"]);
    await Promise.resolve();
    emulateBoxGesture(cy, ["b", "c"]);
    await Promise.resolve();

    expect(selectNodes).toHaveBeenCalledTimes(2);
    expect(selectNodes.mock.calls[0]?.[0]).toEqual(["a"]);
    expect(selectNodes.mock.calls[1]?.[0]?.sort()).toEqual(["b", "c"]);
  });

  it("stays silent for an empty box", async () => {
    const cy = makeCy();
    const selectNodes = vi.fn();
    registerBoxSelectionSync(cy, selectNodes);
    emulateBoxGesture(cy, []);
    await Promise.resolve();
    expect(selectNodes).not.toHaveBeenCalled();
  });
});
