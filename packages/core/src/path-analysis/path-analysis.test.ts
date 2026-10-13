/**
 * Path search options (issues #29 and #30): `maxHops` honored by
 * every search, `directed` traversal, a `nodeFilter` that exempts
 * the endpoints, a `PathGraph` read interface narrower than a UGM,
 * and `kShortestPaths` listing individual routes deterministically.
 */
import { describe, it, expect } from "vitest";
import { UGM } from "../ugm/ugm";
import {
  findShortestPath,
  allShortestPaths,
  kShortestPaths,
  type PathGraph,
} from "./path-analysis";

/** a - b - c - d, one edge per hop, ids named after their hop. */
function pathGraph(): UGM {
  const g = new UGM();
  for (const id of ["a", "b", "c", "d"]) g.addNode(id, { types: ["N"] });
  g.addEdge("a", "b", { key: "ab", type: "e" });
  g.addEdge("b", "c", { key: "bc", type: "e" });
  g.addEdge("c", "d", { key: "cd", type: "e" });
  return g;
}

describe("maxHops (issue #29)", () => {
  it("findShortestPath: a target beyond maxHops is not found", () => {
    const g = pathGraph();
    expect(findShortestPath(g, "a", "d", { maxHops: 2 }).found).toBe(false);
    const within = findShortestPath(g, "a", "d", { maxHops: 3 });
    expect(within.found).toBe(true);
    expect(within.length).toBe(3);
  });

  it("allShortestPaths: a target beyond maxHops is not found", () => {
    const g = pathGraph();
    const r = allShortestPaths(g, "a", "d", { maxHops: 2 });
    expect(r.found).toBe(false);
    expect(r.pathCount).toBe(0);
    expect(r.length).toBe(0);
    const within = allShortestPaths(g, "a", "d", { maxHops: 3 });
    expect(within.found).toBe(true);
    expect(within.length).toBe(3);
    expect(within.pathCount).toBe(1);
  });

  it("allShortestPaths: the bound stops the layered BFS, not just the result", () => {
    // A graph view that counts reads: with maxHops 1 from `a`, the
    // search must never ask for the edges of `c` or `d`.
    const g = pathGraph();
    const asked = new Set<string>();
    const view: PathGraph = {
      hasNode: (id) => g.hasNode(id),
      getNodeEdges: (id) => {
        asked.add(id);
        return g.getNodeEdges(id);
      },
      getEdgeEndpoints: (id) => g.getEdgeEndpoints(id),
      getEdge: (id) => g.getEdge(id),
    };
    expect(allShortestPaths(view, "a", "d", { maxHops: 1 }).found).toBe(false);
    expect([...asked].sort()).toEqual(["a"]);
  });
});

describe("PathGraph (issue #30)", () => {
  it("accepts an object implementing only the four read methods", () => {
    const g = pathGraph();
    const view: PathGraph = {
      hasNode: (id) => g.hasNode(id),
      getNodeEdges: (id) => g.getNodeEdges(id),
      getEdgeEndpoints: (id) => g.getEdgeEndpoints(id),
      getEdge: (id) => g.getEdge(id),
    };
    expect(findShortestPath(view, "a", "d").nodeIds).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(allShortestPaths(view, "a", "d").pathCount).toBe(1);
    expect(kShortestPaths(view, "a", "d", { k: 3 })).toEqual([
      { nodeIds: ["a", "b", "c", "d"], edgeIds: ["ab", "bc", "cd"] },
    ]);
  });

  it("a UGM is a PathGraph by construction", () => {
    const view: PathGraph = pathGraph();
    expect(findShortestPath(view, "a", "b").found).toBe(true);
  });
});

describe("directed traversal (issue #30)", () => {
  /** a -> b -> c, plus c -> a closing a cycle; d -> c points INTO c. */
  function directed(): UGM {
    const g = new UGM();
    for (const id of ["a", "b", "c", "d"]) g.addNode(id, { types: ["N"] });
    g.addEdge("a", "b", { key: "ab", type: "e" });
    g.addEdge("b", "c", { key: "bc", type: "e" });
    g.addEdge("c", "a", { key: "ca", type: "e" });
    g.addEdge("d", "c", { key: "dc", type: "e" });
    return g;
  }

  it("findShortestPath follows edge direction only when asked", () => {
    const g = directed();
    // Undirected: c - a is one hop.
    expect(findShortestPath(g, "a", "c").length).toBe(1);
    // Directed: a -> b -> c.
    const r = findShortestPath(g, "a", "c", { directed: true });
    expect(r.nodeIds).toEqual(["a", "b", "c"]);
    expect(r.edgeIds).toEqual(["ab", "bc"]);
    // Nothing leaves d's target side: c cannot reach d.
    expect(findShortestPath(g, "c", "d", { directed: true }).found).toBe(false);
    expect(findShortestPath(g, "c", "d").found).toBe(true);
  });

  it("allShortestPaths keeps the backward walk directed", () => {
    const g = directed();
    const r = allShortestPaths(g, "a", "c", { directed: true });
    expect(r.found).toBe(true);
    expect(r.length).toBe(2);
    expect(r.pathCount).toBe(1);
    expect([...r.nodeIds].sort()).toEqual(["a", "b", "c"]);
    expect([...r.edgeIds].sort()).toEqual(["ab", "bc"]);
    expect(allShortestPaths(g, "c", "d", { directed: true }).found).toBe(false);
  });

  it("allShortestPaths directed: an incoming edge from a closer node is not a predecessor", () => {
    // s -> x -> t and s -> y, t -> y. Undirected, y sits at distance 1
    // from s and is adjacent to t, so s - y - t would be a second
    // shortest route; directed, the y - t edge points the wrong way.
    const g = new UGM();
    for (const id of ["s", "x", "y", "t"]) g.addNode(id, { types: ["N"] });
    g.addEdge("s", "x", { key: "sx", type: "e" });
    g.addEdge("x", "t", { key: "xt", type: "e" });
    g.addEdge("s", "y", { key: "sy", type: "e" });
    g.addEdge("t", "y", { key: "ty", type: "e" });
    expect(allShortestPaths(g, "s", "t").pathCount).toBe(2);
    const r = allShortestPaths(g, "s", "t", { directed: true });
    expect(r.pathCount).toBe(1);
    expect([...r.edgeIds].sort()).toEqual(["sx", "xt"]);
  });

  it("kShortestPaths respects direction", () => {
    const g = directed();
    expect(kShortestPaths(g, "a", "c", { k: 5, directed: true })).toEqual([
      { nodeIds: ["a", "b", "c"], edgeIds: ["ab", "bc"] },
    ]);
    const undirected = kShortestPaths(g, "a", "c", { k: 5 });
    expect(undirected.map((p) => p.edgeIds)).toEqual([["ca"], ["ab", "bc"]]);
  });
});

describe("nodeFilter (issue #30)", () => {
  /** s - hub - t (short, through the hub) and s - x - y - t (long). */
  function hubbed(): UGM {
    const g = new UGM();
    for (const id of ["s", "hub", "x", "y", "t"]) {
      g.addNode(id, { types: ["N"] });
    }
    g.addEdge("s", "hub", { key: "s-hub", type: "e" });
    g.addEdge("hub", "t", { key: "hub-t", type: "e" });
    g.addEdge("s", "x", { key: "sx", type: "e" });
    g.addEdge("x", "y", { key: "xy", type: "e" });
    g.addEdge("y", "t", { key: "yt", type: "e" });
    return g;
  }
  const noHub = (id: string) => id !== "hub";

  it("findShortestPath routes around a rejected node", () => {
    const g = hubbed();
    expect(findShortestPath(g, "s", "t").edgeIds).toEqual(["s-hub", "hub-t"]);
    const r = findShortestPath(g, "s", "t", { nodeFilter: noHub });
    expect(r.nodeIds).toEqual(["s", "x", "y", "t"]);
  });

  it("endpoints are exempt from the filter", () => {
    const g = hubbed();
    const rejectAll = () => false;
    // Direct neighbors still connect even though the filter rejects
    // every node, because the endpoints never consult it.
    expect(
      findShortestPath(g, "s", "hub", { nodeFilter: rejectAll }).found,
    ).toBe(true);
    expect(findShortestPath(g, "hub", "t", { nodeFilter: noHub }).found).toBe(
      true,
    );
    // Anything needing an intermediate node is cut.
    expect(findShortestPath(g, "s", "t", { nodeFilter: rejectAll }).found).toBe(
      false,
    );
    expect(allShortestPaths(g, "s", "t", { nodeFilter: rejectAll }).found).toBe(
      false,
    );
    expect(
      kShortestPaths(g, "s", "t", { k: 3, nodeFilter: rejectAll }),
    ).toEqual([]);
  });

  it("allShortestPaths and kShortestPaths skip the rejected node", () => {
    const g = hubbed();
    const all = allShortestPaths(g, "s", "t", { nodeFilter: noHub });
    expect(all.length).toBe(3);
    expect(all.nodeIds).not.toContain("hub");
    expect(all.pathCount).toBe(1);
    expect(kShortestPaths(g, "s", "t", { k: 5, nodeFilter: noHub })).toEqual([
      { nodeIds: ["s", "x", "y", "t"], edgeIds: ["sx", "xy", "yt"] },
    ]);
  });

  it("nodeFilter composes with maxHops: the detour can exceed the bound", () => {
    const g = hubbed();
    expect(findShortestPath(g, "s", "t", { maxHops: 2 }).found).toBe(true);
    expect(
      findShortestPath(g, "s", "t", { maxHops: 2, nodeFilter: noHub }).found,
    ).toBe(false);
    expect(
      kShortestPaths(g, "s", "t", { k: 5, maxHops: 2, nodeFilter: noHub }),
    ).toEqual([]);
  });
});

describe("kShortestPaths (issue #30)", () => {
  /**
   * s - a - t, s - b - t (two 2-hop routes), s - c - d - t (3 hops),
   * and a - b (which makes s - a - b - t and s - b - a - t 3-hop
   * routes too). Six loopless routes in all, three of length 3.
   */
  function routes(): UGM {
    const g = new UGM();
    for (const id of ["s", "a", "b", "c", "d", "t"]) {
      g.addNode(id, { types: ["N"] });
    }
    g.addEdge("s", "a", { key: "sa", type: "e" });
    g.addEdge("a", "t", { key: "at", type: "e" });
    g.addEdge("s", "b", { key: "sb", type: "e" });
    g.addEdge("b", "t", { key: "bt", type: "e" });
    g.addEdge("s", "c", { key: "sc", type: "e" });
    g.addEdge("c", "d", { key: "cd", type: "e" });
    g.addEdge("d", "t", { key: "dt", type: "e" });
    g.addEdge("a", "b", { key: "ab", type: "e" });
    return g;
  }

  it("lists paths in nondecreasing length, loopless, no duplicates", () => {
    const paths = kShortestPaths(routes(), "s", "t", { k: 10 });
    expect(paths).toHaveLength(5);
    const lengths = paths.map((p) => p.edgeIds.length);
    expect(lengths).toEqual([2, 2, 3, 3, 3]);
    const keys = new Set(paths.map((p) => p.edgeIds.join(">")));
    expect(keys.size).toBe(5);
    for (const p of paths) {
      expect(new Set(p.nodeIds).size).toBe(p.nodeIds.length);
      expect(p.nodeIds[0]).toBe("s");
      expect(p.nodeIds[p.nodeIds.length - 1]).toBe("t");
      expect(p.edgeIds).toHaveLength(p.nodeIds.length - 1);
    }
    expect(keys).toEqual(
      new Set(["sa>at", "sb>bt", "sc>cd>dt", "sa>ab>bt", "sb>ab>at"]),
    );
  });

  it("the first path matches findShortestPath; the shortest ones agree with allShortestPaths", () => {
    const g = routes();
    const paths = kShortestPaths(g, "s", "t", { k: 2 });
    const single = findShortestPath(g, "s", "t");
    expect(paths[0]).toEqual({
      nodeIds: single.nodeIds,
      edgeIds: single.edgeIds,
    });
    const union = allShortestPaths(g, "s", "t");
    expect(union.pathCount).toBe(2);
    expect(paths.flatMap((p) => p.edgeIds).sort()).toEqual(
      [...union.edgeIds].sort(),
    );
  });

  it("returns exactly k when more exist, fewer when k is larger than the count", () => {
    const g = routes();
    expect(kShortestPaths(g, "s", "t", { k: 1 })).toHaveLength(1);
    expect(kShortestPaths(g, "s", "t", { k: 3 })).toHaveLength(3);
    expect(kShortestPaths(g, "s", "t", { k: 100 })).toHaveLength(5);
    expect(kShortestPaths(g, "s", "t", { k: 0 })).toEqual([]);
  });

  it("is deterministic across calls", () => {
    const g = routes();
    const a = kShortestPaths(g, "s", "t", { k: 10 });
    const b = kShortestPaths(g, "s", "t", { k: 10 });
    expect(a).toEqual(b);
  });

  it("honors maxHops: longer routes fall out of the listing", () => {
    const g = routes();
    const paths = kShortestPaths(g, "s", "t", { k: 10, maxHops: 2 });
    expect(paths.map((p) => p.edgeIds.length)).toEqual([2, 2]);
    expect(kShortestPaths(g, "s", "t", { k: 10, maxHops: 1 })).toEqual([]);
  });

  it("honors edgeTypes", () => {
    const g = new UGM();
    for (const id of ["s", "a", "t"]) g.addNode(id, { types: ["N"] });
    g.addEdge("s", "t", { key: "direct", type: "cites" });
    g.addEdge("s", "a", { key: "sa", type: "knows" });
    g.addEdge("a", "t", { key: "at", type: "knows" });
    expect(
      kShortestPaths(g, "s", "t", { k: 5, edgeTypes: ["knows"] }).map(
        (p) => p.edgeIds,
      ),
    ).toEqual([["sa", "at"]]);
  });

  it("parallel edges are distinct paths over the same nodes", () => {
    const g = new UGM();
    g.addNode("s", { types: ["N"] });
    g.addNode("t", { types: ["N"] });
    g.addEdge("s", "t", { key: "e1", type: "e" });
    g.addEdge("s", "t", { key: "e2", type: "e" });
    const paths = kShortestPaths(g, "s", "t", { k: 5 });
    // Order between the two follows graphology's edge iteration, which
    // is deterministic but not insertion order; both must be listed.
    expect(paths.map((p) => p.edgeIds).sort()).toEqual([["e1"], ["e2"]]);
    expect(paths.every((p) => p.nodeIds.join() === "s,t")).toBe(true);
    expect(allShortestPaths(g, "s", "t").pathCount).toBe(2);
  });

  it("disconnected graphs and missing endpoints yield an empty list", () => {
    const g = new UGM();
    g.addNode("x", { types: ["N"] });
    g.addNode("y", { types: ["N"] });
    g.addNode("z", { types: ["N"] });
    g.addEdge("x", "y", { key: "xy", type: "e" });
    expect(kShortestPaths(g, "x", "z", { k: 3 })).toEqual([]);
    expect(kShortestPaths(g, "x", "missing", { k: 3 })).toEqual([]);
    expect(kShortestPaths(g, "missing", "x", { k: 3 })).toEqual([]);
  });

  it("source equal to target is the one trivial path", () => {
    const g = pathGraph();
    expect(kShortestPaths(g, "a", "a", { k: 3 })).toEqual([
      { nodeIds: ["a"], edgeIds: [] },
    ]);
  });
});
