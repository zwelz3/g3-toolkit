/**
 * Paging helpers (issue #6): stable ordering across calls, offset
 * clamping, comparator tie-break, and the descriptor arithmetic.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "../ugm";
import {
  pageItems,
  pageNodes,
  pageCategories,
  pageCount,
  pageIndex,
} from "./pagination";

function graphOf(ids: string[]): UGM {
  const ugm = new UGM();
  for (const id of ids) ugm.addNode(id, { types: ["T"], properties: {} });
  return ugm;
}

describe("pageNodes", () => {
  it("returns the same page for the same request across calls, whatever the insertion order", () => {
    const a = graphOf(["c", "a", "b", "e", "d"]);
    const b = graphOf(["e", "d", "c", "b", "a"]);
    const req = { offset: 1, size: 2 };
    expect(pageNodes(a, req).items).toEqual(["b", "c"]);
    expect(pageNodes(b, req).items).toEqual(["b", "c"]);
    expect(pageNodes(a, req)).toEqual(pageNodes(a, req));
  });

  it("orders by code unit, not locale (stable in every runtime)", () => {
    const ugm = graphOf(["b", "B", "a", "A"]);
    expect(pageNodes(ugm, { size: 10 }).items).toEqual(["A", "B", "a", "b"]);
  });

  it("covers every item exactly once across consecutive pages", () => {
    const ids = Array.from({ length: 23 }, (_, i) => `n${(i * 7) % 23}`);
    const ugm = graphOf(ids);
    const seen: string[] = [];
    let offset = 0;
    for (;;) {
      const page = pageNodes(ugm, { offset, size: 5 });
      seen.push(...page.items);
      offset += page.window.size;
      if (offset >= page.window.total) break;
    }
    expect(seen).toHaveLength(23);
    expect(new Set(seen).size).toBe(23);
  });

  it("reports an exact total and clamps the offset", () => {
    const ugm = graphOf(["a", "b", "c"]);
    const page = pageNodes(ugm, { offset: 10, size: 2 });
    expect(page.window).toEqual({
      offset: 3,
      size: 2,
      total: 3,
      totalExact: true,
    });
    expect(page.items).toEqual([]);
    expect(pageNodes(ugm, { offset: -4, size: 2 }).items).toEqual(["a", "b"]);
  });

  it("a comparator replaces the order and id breaks ties", () => {
    const ugm = graphOf(["x2", "y1", "x1", "y2"]);
    // Order by the trailing digit; "x1"/"y1" tie and fall back to id.
    const byDigit = (a: string, b: string) =>
      Number(a.slice(1)) - Number(b.slice(1));
    expect(pageNodes(ugm, { size: 4, order: byDigit }).items).toEqual([
      "x1",
      "y1",
      "x2",
      "y2",
    ]);
  });

  it("a mutation between calls shifts later pages without reordering untouched items", () => {
    const ugm = graphOf(["a", "c", "d"]);
    expect(pageNodes(ugm, { offset: 1, size: 2 }).items).toEqual(["c", "d"]);
    ugm.addNode("b", { types: ["T"], properties: {} });
    expect(pageNodes(ugm, { offset: 1, size: 2 }).items).toEqual(["b", "c"]);
    expect(pageNodes(ugm, { offset: 0, size: 1 }).items).toEqual(["a"]);
  });

  it("rejects a non-positive or fractional size", () => {
    const ugm = graphOf(["a"]);
    expect(() => pageNodes(ugm, { size: 0 })).toThrow(RangeError);
    expect(() => pageNodes(ugm, { size: 1.5 })).toThrow(RangeError);
  });
});

describe("pageCategories / pageItems", () => {
  it("pages a Set of labels in id order and does not mutate the input", () => {
    const set = new Set(["Org", "Person", "Asset"]);
    const input = [...set];
    const page = pageCategories(set, { size: 2 });
    expect(page.items).toEqual(["Asset", "Org"]);
    expect(page.window.total).toBe(3);
    expect([...set]).toEqual(input);
    const arr = ["b", "a"];
    pageItems(arr, { size: 1 });
    expect(arr).toEqual(["b", "a"]);
  });

  it("a 350-category request pages into 200 + 150 windows", () => {
    const cats = Array.from(
      { length: 350 },
      (_, i) => `T${String(i).padStart(3, "0")}`,
    );
    const first = pageCategories(cats, { size: 200 });
    const second = pageCategories(cats, { offset: 200, size: 200 });
    expect(first.items).toHaveLength(200);
    expect(second.items).toHaveLength(150);
    expect(first.items[0]).toBe("T000");
    expect(second.items[149]).toBe("T349");
    expect(pageCount(first.window)).toBe(2);
    expect(pageIndex(second.window)).toBe(1);
  });
});

describe("pageCount / pageIndex", () => {
  it("an empty result is one page, and sizes below 1 do not divide by zero", () => {
    expect(pageCount({ size: 50, total: 0 })).toBe(1);
    expect(pageCount({ size: 0, total: 5 })).toBe(5);
    expect(pageIndex({ offset: 0, size: 0 })).toBe(0);
    expect(pageIndex({ offset: 100, size: 50 })).toBe(2);
    expect(pageIndex({ offset: 149, size: 50 })).toBe(2);
  });
});
