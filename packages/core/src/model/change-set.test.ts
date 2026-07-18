/**
 * Change-set oracles (G3L:MOD-010). The contract under test:
 * transactional apply with explicit cascades, diagnostics instead of
 * throws, exact diffs by construction, undo via inversion, the
 * LAY-020 locality seed, and the versioned wire format.
 */
import { describe, expect, it } from "vitest";
import type { StructuralGraphInput } from "@g3t/core";
import {
  affectedRegion,
  applyChangeSet,
  invertChangeSet,
  parseChangeSet,
  serializeChangeSet,
} from "./change-set";

const BASE: StructuralGraphInput = {
  nodes: [
    { id: "a", header: { name: "A" }, width: 80, height: 40 },
    { id: "b", header: { name: "B" }, width: 80, height: 40 },
    { id: "c", header: { name: "C" }, width: 80, height: 40 },
    {
      id: "box",
      header: { stereotype: "Block", name: "Box" },
      compartments: [{ id: "box.c0", rows: [{ id: "box.r0", text: "x" }] }],
    },
  ],
  edges: [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "abox", source: "a", target: "box", kind: "composition" },
  ],
};

describe("applyChangeSet", () => {
  it("applies adds, removals, and updates as one transaction with an exact diff", () => {
    const r = applyChangeSet(BASE, {
      addNodes: [{ id: "d", header: { name: "D" }, width: 60, height: 30 }],
      addEdges: [{ id: "cd", source: "c", target: "d" }],
      removeEdges: ["ab"],
      updateNodes: { c: { width: 120 } },
    });
    expect(r.diagnostics).toEqual([]);
    expect(r.diff.addedNodes).toEqual(["d"]);
    expect(r.diff.addedEdges).toEqual(["cd"]);
    expect(r.diff.removedEdges).toEqual(["ab"]);
    expect(r.diff.changedNodes).toEqual(["c"]);
    expect(r.input.nodes.find((n) => n.id === "c")?.width).toBe(120);
    // Purity: the base is untouched.
    expect(BASE.nodes.find((n) => n.id === "c")?.width).toBe(80);
  });

  it("removing a node cascades its incident edges, RECORDED in the diff", () => {
    const r = applyChangeSet(BASE, { removeNodes: ["b"] });
    expect(r.diff.removedNodes).toEqual(["b"]);
    expect(r.diff.cascadeRemovedEdges.sort()).toEqual(["ab", "bc"]);
    expect(r.input.edges.map((e) => e.id)).toEqual(["abox"]);
  });

  it("reports diagnostics per bad entry and applies the valid remainder", () => {
    const r = applyChangeSet(BASE, {
      removeNodes: ["ghost", "b"],
      addEdges: [{ id: "dangling", source: "a", target: "nope" }],
      addNodes: [{ id: "a", header: { name: "dup" } }],
      updateNodes: { b: { width: 9 } },
    });
    const codes = r.diagnostics.map((d) => d.code).sort();
    expect(codes).toEqual([
      "DANGLING_EDGE",
      "DUPLICATE_NODE",
      "REMOVED_AND_UPDATED",
      "UNKNOWN_NODE",
    ]);
    expect(r.diff.removedNodes).toEqual(["b"]);
  });

  it("remove + re-add of the same id in one set is legal and reported as both", () => {
    const r = applyChangeSet(BASE, {
      removeNodes: ["a"],
      addNodes: [{ id: "a", header: { name: "A2" }, width: 50, height: 20 }],
    });
    expect(r.diagnostics).toEqual([]);
    expect(r.diff.removedNodes).toEqual(["a"]);
    expect(r.diff.addedNodes).toEqual(["a"]);
    expect(r.input.nodes.find((n) => n.id === "a")?.header?.name).toBe("A2");
    // The old incident edges cascade (the re-added "a" is a NEW node).
    expect(r.diff.cascadeRemovedEdges.sort()).toEqual(["ab", "abox"]);
  });
});

describe("invertChangeSet", () => {
  it("applying the inverse to the AFTER state restores the BEFORE state, cascades included", () => {
    const cs = {
      removeNodes: ["b"],
      updateNodes: { c: { width: 200 } },
      addNodes: [{ id: "z", header: { name: "Z" }, width: 40, height: 20 }],
      addEdges: [{ id: "cz", source: "c", target: "z" }],
    };
    const after = applyChangeSet(BASE, cs);
    const inv = invertChangeSet(BASE, cs);
    const restored = applyChangeSet(after.input, inv);
    expect(restored.diagnostics).toEqual([]);
    const sortById = <T extends { id: string }>(xs: readonly T[]) =>
      [...xs].sort((p, q) => (p.id < q.id ? -1 : 1));
    expect(sortById(restored.input.nodes)).toEqual(sortById(BASE.nodes));
    expect(sortById(restored.input.edges)).toEqual(sortById(BASE.edges));
  });
});

describe("affectedRegion (the LAY-020 seed)", () => {
  it("a small leaf-node change is LOCAL with a one-hop region", () => {
    const r = applyChangeSet(BASE, { updateNodes: { c: { width: 99 } } });
    const loc = affectedRegion(BASE, r.diff);
    expect(loc.local).toBe(true);
    // c plus its one-hop neighbor b.
    expect(loc.region).toEqual(["b", "c"]);
  });

  it("touching a container is NOT local", () => {
    const r = applyChangeSet(BASE, { updateNodes: { box: { width: 300 } } });
    const loc = affectedRegion(BASE, r.diff);
    expect(loc.local).toBe(false);
  });
});

describe("wire format", () => {
  it("serialize/parse round-trips a version-1 document; junk is rejected with an error", () => {
    const cs = { removeNodes: ["b"], updateNodes: { c: { width: 1 } } };
    const parsed = parseChangeSet(serializeChangeSet(cs));
    expect("changeSet" in parsed && parsed.changeSet).toEqual(cs);
    expect("error" in parseChangeSet("{}")).toBe(true);
    expect("error" in parseChangeSet("not json")).toBe(true);
  });
});
