/**
 * Compartment collapse store (the collapse canvas slice).
 *
 * @see roadmap/design/structural-rendering.md
 * @see specs/01-functional-views.md R1.18
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  useCompartmentCollapseStore,
  collapsedCompartmentSet,
} from "./compartment-collapse-store";

describe("useCompartmentCollapseStore", () => {
  beforeEach(() => {
    useCompartmentCollapseStore.getState().clear();
  });

  it("collapse/expand are idempotent", () => {
    const s = useCompartmentCollapseStore.getState();
    s.collapse("A::ops");
    s.collapse("A::ops");
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([
      "A::ops",
    ]);
    s.expand("A::ops");
    s.expand("A::ops");
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([]);
  });

  it("toggle flips a single key", () => {
    const s = useCompartmentCollapseStore.getState();
    s.toggle("A::ops");
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toContain(
      "A::ops",
    );
    s.toggle("A::ops");
    expect(useCompartmentCollapseStore.getState().collapsedKeys).not.toContain(
      "A::ops",
    );
  });

  it("toggleAll collapses a batch when not all are collapsed", () => {
    useCompartmentCollapseStore.getState().collapse("A::attrs");
    useCompartmentCollapseStore.getState().toggleAll(["A::attrs", "A::ops"]);
    expect(
      [...useCompartmentCollapseStore.getState().collapsedKeys].sort(),
    ).toEqual(["A::attrs", "A::ops"]);
  });

  it("toggleAll expands a batch when all are already collapsed", () => {
    useCompartmentCollapseStore.getState().setCollapsed(["A::attrs", "A::ops"]);
    useCompartmentCollapseStore.getState().toggleAll(["A::attrs", "A::ops"]);
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([]);
  });

  it("toggleAll leaves unrelated keys untouched", () => {
    useCompartmentCollapseStore.getState().setCollapsed(["B::ops"]);
    useCompartmentCollapseStore.getState().toggleAll(["A::attrs"]);
    expect(
      [...useCompartmentCollapseStore.getState().collapsedKeys].sort(),
    ).toEqual(["A::attrs", "B::ops"]);
  });

  it("setCollapsed replaces the whole set (restore path)", () => {
    useCompartmentCollapseStore.getState().collapse("A::ops");
    useCompartmentCollapseStore.getState().setCollapsed(["X::y", "Z::w"]);
    expect(
      [...useCompartmentCollapseStore.getState().collapsedKeys].sort(),
    ).toEqual(["X::y", "Z::w"]);
  });

  it("collapsedCompartmentSet yields a Set for layoutStructural", () => {
    const set = collapsedCompartmentSet(["A::ops", "A::ops"]);
    expect(set instanceof Set).toBe(true);
    expect(set.size).toBe(1);
  });
});
