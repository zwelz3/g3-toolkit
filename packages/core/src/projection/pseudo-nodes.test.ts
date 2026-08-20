/**
 * Brief 06: pseudo-node spreading transforms (hubBurst / busCollapse).
 *
 * Covers the headlessly-verifiable Verification items: transform
 * round-trip invert coverage, the both-endpoints-hub tie-break,
 * junction id safety, and pseudo-flag isolation through the UGM
 * consumers that live in @g3t/core (subgraph export + algorithm
 * adapter). The encoding-mapper skip guard lives in @g3t/react and is
 * asserted there.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "../ugm";
import {
  hubBurst,
  busCollapse,
  isPseudoNode,
  filterPseudoNodes,
  filterPseudoEdges,
  PSEUDO_CONNECTOR_TYPE,
  PSEUDO_TRUNK_TYPE,
} from "./pseudo-nodes";
import { exportSubgraphJson } from "../export/subgraph-export";
import { ingestAlgorithmResults } from "../algorithm-adapter/algorithm-adapter";

function star(hub: string, spokes: number, type = "rel"): UGM {
  const ugm = new UGM();
  ugm.addNode(hub, { types: ["Hub"] });
  for (let i = 0; i < spokes; i++) {
    const n = `${hub}-n${i}`;
    ugm.addNode(n, { types: ["Leaf"] });
    ugm.addEdge(hub, n, { type });
  }
  return ugm;
}

function originalEdgeCount(ugm: UGM): number {
  return ugm.edgeCount;
}

describe("hubBurst", () => {
  it("bursts a high-degree node into one satellite per (type,direction) group", () => {
    const ugm = star("H", 5);
    const { ugm: out, satellites } = hubBurst(ugm, { k: 3 });

    // One satellite for the single (rel,out) group.
    expect(satellites.size).toBe(1);
    const [satId, satInfo] = [...satellites][0]!;
    expect(satInfo.hub).toBe("H");
    expect(satInfo.groupKey).toBe("rel|out");
    expect(isPseudoNode(out.getNode(satId)!)).toBe(true);

    // Hub keeps exactly one connector to the satellite; satellite fans
    // out to all five real neighbors.
    const connector = out.getEdgesBetween("H", satId);
    expect(connector.length).toBe(1);
    expect(out.getEdge(connector[0]!)!.type).toBe(PSEUDO_CONNECTOR_TYPE);
    expect(
      out.getNeighbors(satId).filter((n) => n.startsWith("H-n")).length,
    ).toBe(5);
  });

  it("invert covers every original edge exactly once", () => {
    const ugm = star("H", 5);
    const { invert } = hubBurst(ugm, { k: 3 });
    expect(invert.size).toBe(originalEdgeCount(ugm));
    for (const a of invert.values()) {
      expect(a.burst).toBe(true);
      expect(a.satellite).toBeDefined();
    }
  });

  it("leaves a graph with no hub untouched (all edges pass through)", () => {
    const ugm = star("H", 2);
    const { satellites, invert } = hubBurst(ugm, { k: 12 });
    expect(satellites.size).toBe(0);
    expect([...invert.values()].every((a) => a.burst === false)).toBe(true);
  });

  it("both-endpoints-hub edge is owned by the higher-degree endpoint", () => {
    const ugm = new UGM();
    ugm.addNode("A", { types: ["Hub"] });
    ugm.addNode("B", { types: ["Hub"] });
    // A gets degree 5 (4 spokes + A-B), B gets degree 4 (3 spokes + A-B).
    for (let i = 0; i < 4; i++) {
      ugm.addNode(`ax${i}`, { types: ["Leaf"] });
      ugm.addEdge("A", `ax${i}`, { type: "rel" });
    }
    for (let i = 0; i < 3; i++) {
      ugm.addNode(`bx${i}`, { types: ["Leaf"] });
      ugm.addEdge("B", `bx${i}`, { type: "rel" });
    }
    const abEdge = ugm.addEdge("A", "B", { type: "link" });

    const { invert } = hubBurst(ugm, { k: 2 });
    const assign = invert.get(abEdge)!;
    expect(assign.burst).toBe(true);
    expect(assign.hub).toBe("A"); // 5 > 4
    expect(assign.neighbor).toBe("B");
  });

  it("ties on equal degree break to the lexicographically smaller id", () => {
    const ugm = new UGM();
    ugm.addNode("zeta", { types: ["Hub"] });
    ugm.addNode("alpha", { types: ["Hub"] });
    // Equal degree 4 each (3 spokes + the shared edge).
    for (let i = 0; i < 3; i++) {
      ugm.addNode(`z${i}`, { types: ["Leaf"] });
      ugm.addEdge("zeta", `z${i}`, { type: "rel" });
      ugm.addNode(`a${i}`, { types: ["Leaf"] });
      ugm.addEdge("alpha", `a${i}`, { type: "rel" });
    }
    const shared = ugm.addEdge("zeta", "alpha", { type: "link" });
    const { invert } = hubBurst(ugm, { k: 2 });
    expect(invert.get(shared)!.hub).toBe("alpha"); // alpha < zeta
  });

  it("does not mutate the input UGM", () => {
    const ugm = star("H", 5);
    const before = ugm.nodeCount;
    hubBurst(ugm, { k: 3 });
    expect(ugm.nodeCount).toBe(before);
    expect(ugm.hasNode("pseudo:sat:H:rel|out")).toBe(false);
  });
});

describe("busCollapse", () => {
  function fanIn(sink: string, sources: number, type = "flows"): UGM {
    const ugm = new UGM();
    ugm.addNode(sink, { types: ["Sink"] });
    for (let i = 0; i < sources; i++) {
      const s = `${sink}-s${i}`;
      ugm.addNode(s, { types: ["Source"] });
      ugm.addEdge(s, sink, { type });
    }
    return ugm;
  }

  it("collapses a >= kBus fan-in into a junction with trunk + taps", () => {
    const ugm = fanIn("T", 3);
    const { ugm: out, junctions, invert } = busCollapse(ugm, { kBus: 3 });

    expect(junctions.size).toBe(1);
    const [jId, jInfo] = [...junctions][0]!;
    expect(jInfo.sinkHub).toBe("T");
    expect(jInfo.edgeGroupKey).toBe("flows");
    expect(isPseudoNode(out.getNode(jId)!)).toBe(true);

    // Exactly one trunk junction->sink.
    const trunk = out.getEdgesBetween(jId, "T");
    expect(trunk.length).toBe(1);
    expect(out.getEdge(trunk[0]!)!.type).toBe(PSEUDO_TRUNK_TYPE);
    // Invert recovers every collapsed original edge exactly once.
    expect(invert.get(jId)!.length).toBe(3);
    expect(new Set(invert.get(jId)).size).toBe(3);
  });

  it("leaves a below-threshold fan-in untouched", () => {
    const ugm = fanIn("T", 2);
    const { junctions } = busCollapse(ugm, { kBus: 3 });
    expect(junctions.size).toBe(0);
  });

  it("distinct groups get distinct junction ids that never collide with real ids", () => {
    const ugm = new UGM();
    for (const sink of ["T1", "T2"]) {
      ugm.addNode(sink, { types: ["Sink"] });
      for (let i = 0; i < 3; i++) {
        const s = `${sink}-s${i}`;
        ugm.addNode(s, { types: ["Source"] });
        ugm.addEdge(s, sink, { type: "flows" });
      }
    }
    const { ugm: out, junctions } = busCollapse(ugm, { kBus: 3 });
    const ids = [...junctions.keys()];
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id.startsWith("pseudo:bus:")).toBe(true);
      expect(ugm.hasNode(id)).toBe(false); // no real node shares the id
      expect(out.hasNode(id)).toBe(true);
    }
  });
});

describe("pseudo-flag isolation", () => {
  it("isPseudoNode / filter helpers key on the property flag", () => {
    const real: NodeAttributesLike = { types: ["X"], properties: {} };
    const fake: NodeAttributesLike = {
      types: ["Pseudo"],
      properties: { pseudo: true },
    };
    expect(isPseudoNode(real)).toBe(false);
    expect(isPseudoNode(fake)).toBe(true);
    const kept = filterPseudoNodes([
      { attributes: real },
      { attributes: fake },
    ]);
    expect(kept.length).toBe(1);
    const edges = filterPseudoEdges(
      [
        { source: "a", target: "b" },
        { source: "a", target: "pseudo:sat:a:rel|out" },
      ],
      new Set(["pseudo:sat:a:rel|out"]),
    );
    expect(edges.length).toBe(1);
  });

  it("no pseudo id leaks into an exported subgraph", () => {
    const { ugm: out } = hubBurst(star("H", 5), { k: 3 });
    const json = exportSubgraphJson(out);
    expect(json).not.toContain("pseudo:");
    expect(json).not.toContain(PSEUDO_CONNECTOR_TYPE);
  });

  it("algorithm ingest skips a pseudo node", () => {
    const { ugm: out, satellites } = hubBurst(star("H", 5), { k: 3 });
    const satId = [...satellites.keys()][0]!;
    ingestAlgorithmResults(out, new Map([[satId, { pagerank: 0.9 }]]));
    expect(out.getNode(satId)!.properties.pagerank).toBeUndefined();
  });
});

// Minimal structural shape so the helper unit tests do not depend on a
// full UGM instance.
type NodeAttributesLike = {
  types: string[];
  properties: Record<string, unknown>;
};
