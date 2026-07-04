/**
 * Interchange contract, overlays, and reference built-ins.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "../ugm";
import {
  parseAlgorithmResult,
  overlayFromDocument,
  applyAlgorithmResult,
  ingestEdgeAlgorithmResults,
  connectedComponents,
  degreeCentrality,
} from "./algorithm-results";
import { ingestAlgorithmResults } from "./algorithm-adapter";

function graph(): { ugm: UGM; e1: string; e2: string } {
  const ugm = new UGM();
  for (const id of ["a", "b", "c", "d"]) {
    ugm.addNode(id, { types: ["T"], properties: {} });
  }
  // addEdge generates and returns edge ids: capture them.
  const e1 = ugm.addEdge("a", "b", { type: "rel", properties: {} });
  const e2 = ugm.addEdge("b", "c", { type: "rel", properties: {} });
  // d is isolated: two components.
  return { ugm, e1, e2 };
}

describe("interchange contract v1", () => {
  it("parses property and overlay documents; rejects bad versions and kinds", () => {
    const doc = parseAlgorithmResult(
      JSON.stringify({
        version: 1,
        kind: "nodeProperties",
        algorithm: "networkx.pagerank",
        properties: { a: { pagerank: 0.4 } },
      }),
    );
    expect(doc.kind).toBe("nodeProperties");
    expect(() => parseAlgorithmResult('{"version": 2}')).toThrow(/version 2/);
    expect(() =>
      parseAlgorithmResult('{"version": 1, "kind": "magic"}'),
    ).toThrow(/Unknown result kind/);
    expect(() =>
      parseAlgorithmResult('{"version": 1, "kind": "overlay"}'),
    ).toThrow(/overlay.id/);
  });

  it("applies node and edge property documents into the UGM", () => {
    const { ugm, e1 } = graph();
    applyAlgorithmResult(
      ugm,
      parseAlgorithmResult(
        JSON.stringify({
          version: 1,
          kind: "nodeProperties",
          properties: { a: { pagerank: 0.4 }, ghost: { pagerank: 1 } },
        }),
      ),
      ingestAlgorithmResults,
    );
    expect(ugm.getNode("a")?.properties.pagerank).toBe(0.4);
    const edgeDoc = parseAlgorithmResult(
      JSON.stringify({
        version: 1,
        kind: "edgeProperties",
        properties: { [e1]: { betweenness: 0.9 } },
      }),
    );
    applyAlgorithmResult(ugm, edgeDoc, ingestAlgorithmResults);
    let seen: unknown;
    ugm.forEachEdge((id, attrs) => {
      if (id === e1) seen = attrs.properties.betweenness;
    });
    expect(seen).toBe(0.9);
  });

  it("converts overlay documents without touching the UGM", () => {
    const overlay = overlayFromDocument(
      parseAlgorithmResult(
        JSON.stringify({
          version: 1,
          kind: "overlay",
          algorithm: "networkx.minimum_spanning_tree",
          overlay: { id: "mst", nodeIds: ["a", "b"], edgeIds: ["e1"] },
        }),
      ),
    );
    expect(overlay).toMatchObject({
      id: "mst",
      label: "mst",
      nodeIds: ["a", "b"],
      edgeIds: ["e1"],
      algorithm: "networkx.minimum_spanning_tree",
    });
  });
});

describe("reference built-ins", () => {
  it("connectedComponents partitions, isolated node in its own component", () => {
    const comp = connectedComponents(graph().ugm);
    expect(comp.get("a")).toBe(comp.get("c"));
    expect(comp.get("d")).not.toBe(comp.get("a"));
  });

  it("degreeCentrality counts incident edges", () => {
    const deg = degreeCentrality(graph().ugm);
    expect(deg.get("b")).toBe(2);
    expect(deg.get("d")).toBe(0);
  });

  it("ingestEdgeAlgorithmResults skips unknown edge ids", () => {
    const { ugm, e2 } = graph();
    ingestEdgeAlgorithmResults(
      ugm,
      new Map([
        [e2, { flow: 3 }],
        ["nope", { flow: 9 }],
      ]),
    );
    let flow: unknown;
    ugm.forEachEdge((id, attrs) => {
      if (id === e2) flow = attrs.properties.flow;
    });
    expect(flow).toBe(3);
  });
});
