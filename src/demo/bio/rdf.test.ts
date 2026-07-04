import { describe, it, expect } from "vitest";
import { bioGraph, rdfToUgm, rawTripleUgm } from "./rdf";

describe("rawTripleUgm", () => {
  it("renders every triple as an edge with literals and types as nodes", () => {
    const raw = rawTripleUgm(bioGraph);
    const literalNodes = raw.getNodeIds().filter((id) => id.startsWith("lit:"));
    expect(literalNodes.length).toBeGreaterThan(0);
    // Every triple contributes exactly one edge.
    let edges = 0;
    raw.forEachEdge(() => {
      edges += 1;
    });
    expect(edges).toBe(bioGraph.triples.length);
  });

  it("is visibly larger than the projected view (the collapse story)", () => {
    const raw = rawTripleUgm(bioGraph);
    const projected = rdfToUgm(bioGraph);
    expect(raw.getNodeIds().length).toBeGreaterThan(
      projected.getNodeIds().length,
    );
  });
});
