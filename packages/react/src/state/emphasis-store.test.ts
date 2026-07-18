/**
 * Emphasis layer (review 4.6): the store lifecycle and the
 * class-application semantics, on a plain fake Core. The contract
 * under test is the review's requirement set: effect edges get a
 * distinct class, everything outside the effect dims, effect nodes
 * carry NO class at all (a route member must not read as selected),
 * and clearing strips everything.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  applyEmphasisClasses,
  EMPHASIS_DIM_CLASS,
  EMPHASIS_EDGE_CLASS,
  useEmphasisStore,
  type EmphasisCoreLike,
} from "./emphasis-store";

afterEach(() => {
  useEmphasisStore.getState().clear();
});

function fakeCore(ids: string[]) {
  const classes = new Map<string, Set<string>>(ids.map((i) => [i, new Set()]));
  const bulk = { added: [] as string[], removed: [] as string[] };
  const core: EmphasisCoreLike = {
    batch: (fn) => fn(),
    elements: () => ({
      addClass: (c) => {
        bulk.added.push(c);
        for (const set of classes.values()) set.add(c);
      },
      removeClass: (c) => {
        bulk.removed.push(c);
        for (const set of classes.values()) set.delete(c);
      },
    }),
    getElementById: (id) => ({
      length: classes.has(id) ? 1 : 0,
      addClass: (c) => classes.get(id)?.add(c),
      removeClass: (c) => classes.get(id)?.delete(c),
    }),
  };
  return { core, classes };
}

describe("useEmphasisStore", () => {
  it("setPathEffect activates with sets and label; clear resets", () => {
    useEmphasisStore
      .getState()
      .setPathEffect(["a", "b"], ["e1"], "Route a to b");
    const s = useEmphasisStore.getState();
    expect(s.active).toBe(true);
    expect(s.effectNodeIds.has("a")).toBe(true);
    expect(s.emphasizedEdgeIds.has("e1")).toBe(true);
    expect(s.label).toBe("Route a to b");
    useEmphasisStore.getState().clear();
    expect(useEmphasisStore.getState().active).toBe(false);
    expect(useEmphasisStore.getState().effectNodeIds.size).toBe(0);
  });
});

describe("applyEmphasisClasses", () => {
  it("dims the complement, emphasizes effect edges, leaves effect nodes unclassed", () => {
    const { core, classes } = fakeCore(["a", "b", "c", "e1", "e2"]);
    applyEmphasisClasses(core, {
      active: true,
      effectNodeIds: new Set(["a", "b"]),
      emphasizedEdgeIds: new Set(["e1"]),
    });
    // Outside the effect: dimmed.
    expect(classes.get("c")?.has(EMPHASIS_DIM_CLASS)).toBe(true);
    expect(classes.get("e2")?.has(EMPHASIS_DIM_CLASS)).toBe(true);
    // Effect nodes: full opacity, NO classes (not selection-styled).
    expect(classes.get("a")?.size).toBe(0);
    expect(classes.get("b")?.size).toBe(0);
    // Effect edge: emphasized, not dimmed.
    expect(classes.get("e1")?.has(EMPHASIS_EDGE_CLASS)).toBe(true);
    expect(classes.get("e1")?.has(EMPHASIS_DIM_CLASS)).toBe(false);
  });

  it("inactive state strips both classes everywhere", () => {
    const { core, classes } = fakeCore(["a", "e1"]);
    applyEmphasisClasses(core, {
      active: true,
      effectNodeIds: new Set(),
      emphasizedEdgeIds: new Set(["e1"]),
    });
    applyEmphasisClasses(core, {
      active: false,
      effectNodeIds: new Set(),
      emphasizedEdgeIds: new Set(),
    });
    expect(classes.get("a")?.size).toBe(0);
    expect(classes.get("e1")?.size).toBe(0);
  });

  it("ignores effect ids absent from the instance (stale sets never throw)", () => {
    const { core } = fakeCore(["a"]);
    expect(() =>
      applyEmphasisClasses(core, {
        active: true,
        effectNodeIds: new Set(["ghost"]),
        emphasizedEdgeIds: new Set(["phantom"]),
      }),
    ).not.toThrow();
  });
});
