/**
 * Explorer contracts the canvas's additive update depends on, pinned
 * on the real biomedical projection: each step is a SUPERSET of the
 * previous one, an edge keeps its id across steps (the key is a
 * function of the data, not the UGM instance), the induced subgraph
 * carries exactly the full graph's edges among the drawn nodes, and a
 * step that adds nothing returns the same array so the shell can tell
 * a no-op from growth.
 */
import { describe, it, expect } from "vitest";
import { UGM } from "@g3-toolkit/core";
import { bioGraph, EX, rdfToUgm } from "./rdf";
import {
  edgeKey,
  expandNeighborhood,
  induceSubgraph,
  nodesOfType,
} from "./explore";

const full = rdfToUgm(bioGraph);
const edgeIds = (ugm: UGM): string[] => {
  const out: string[] = [];
  ugm.forEachEdge((id) => out.push(id));
  return out.sort();
};

describe("explore: seed and expansion", () => {
  it("seeds with every Disease node, in the full graph's order, and no edges", () => {
    const seed = nodesOfType(full, "Disease");
    expect(seed).toEqual([
      EX + "BreastCancer",
      EX + "LungCancer",
      EX + "Alzheimer",
    ]);
    expect(induceSubgraph(full, seed).edgeCount).toBe(0);
  });

  it("expands to the node plus its depth-1 neighbors, and is a no-op (same reference) once drawn", () => {
    const seed = nodesOfType(full, "Disease");
    const step1 = expandNeighborhood(full, seed, EX + "BreastCancer");
    expect(step1).not.toBe(seed);
    for (const id of seed) expect(step1).toContain(id);
    // BRCA1 and TP53 are associatedWith, Olaparib treats.
    expect(step1).toContain(EX + "BRCA1");
    expect(step1).toContain(EX + "TP53");
    expect(step1).toContain(EX + "Olaparib");
    expect(step1.length).toBe(seed.length + 3);
    // Repeating the same expansion adds nothing: the array comes back
    // as-is, which is the shell's "Expand disables" signal.
    expect(expandNeighborhood(full, step1, EX + "BreastCancer")).toBe(step1);
    expect(expandNeighborhood(full, step1, "urn:nope")).toBe(step1);
  });

  it("an undrawn selected node joins the subset together with its neighbors", () => {
    const seed = nodesOfType(full, "Disease");
    const step = expandNeighborhood(full, seed, EX + "p53");
    expect(step).toContain(EX + "p53");
    expect(step).toContain(EX + "TP53");
    expect(step).toContain(EX + "Apoptosis");
  });
});

describe("explore: induced subgraph with stable edge ids", () => {
  it("each step is a superset of the previous with every drawn edge id kept", () => {
    const seed = nodesOfType(full, "Disease");
    const s1 = expandNeighborhood(full, seed, EX + "BreastCancer");
    const s2 = expandNeighborhood(full, s1, EX + "TP53");
    const g1 = induceSubgraph(full, s1);
    const g2 = induceSubgraph(full, s2);
    for (const id of g1.getNodeIds()) expect(g2.hasNode(id)).toBe(true);
    const e1 = edgeIds(g1);
    expect(e1.length).toBeGreaterThan(0);
    for (const id of e1) expect(g2.hasEdge(id)).toBe(true);
    expect(g2.nodeCount).toBeGreaterThan(g1.nodeCount);
    expect(g2.edgeCount).toBeGreaterThan(g1.edgeCount);
    // TP53 -> LungCancer was not drawable in step 1 (LungCancer was
    // drawn, TP53 was not); step 2 carries it under the data key.
    expect(
      g2.hasEdge(edgeKey(EX + "TP53", "associatedWith", EX + "LungCancer")),
    ).toBe(true);
  });

  it("carries exactly the full graph's edges among the drawn nodes, with attributes", () => {
    const ids = [EX + "BreastCancer", EX + "BRCA1", EX + "TP53", EX + "p53"];
    const g = induceSubgraph(full, ids);
    const expected: string[] = [];
    const drawn = new Set(ids);
    full.forEachEdge((_id, attrs, source, target) => {
      if (drawn.has(source) && drawn.has(target))
        expected.push(edgeKey(source, attrs.type, target));
    });
    expect(edgeIds(g)).toEqual(expected.sort());
    const e = g.getEdge(edgeKey(EX + "TP53", "encodes", EX + "p53"));
    expect(e?.type).toBe("encodes");
    expect(e?.meta.confidence).toBe(1);
    expect(g.getNode(EX + "p53")?.properties.name).toBe(
      "Cellular tumor antigen p53",
    );
  });

  it("two independent builds of the same subset agree on every edge id (ids are data, not instance)", () => {
    const ids = nodesOfType(full, "Gene").concat(nodesOfType(full, "Protein"));
    expect(edgeIds(induceSubgraph(full, ids))).toEqual(
      edgeIds(induceSubgraph(full, [...ids].reverse())),
    );
  });

  it("parallel same-typed edges take an ordinal instead of throwing", () => {
    const g = new UGM();
    g.addNode("a", { types: ["T"], properties: {} });
    g.addNode("b", { types: ["T"], properties: {} });
    g.addEdge("a", "b", { type: "r" });
    g.addEdge("a", "b", { type: "r" });
    const sub = induceSubgraph(g, ["a", "b"]);
    expect(edgeIds(sub)).toEqual(["a|r|b", "a|r|b#1"]);
  });
});
