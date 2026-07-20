/**
 * allShortestPaths (review 9.17). Pins: a diamond yields BOTH routes
 * (the singular finder's one-path behavior was the finding); the
 * union excludes longer detours; the count caps rather than
 * exploding; disconnected pairs report not-found.
 */
import { describe, it, expect } from "vitest";
import { UGM } from "../ugm/ugm";
import { allShortestPaths } from "./path-analysis";

function diamond(): UGM {
  const g = new UGM();
  for (const id of ["s", "a", "b", "t", "d"]) g.addNode(id, { types: ["N"] });
  g.addEdge("s", "a", { type: "e" });
  g.addEdge("s", "b", { type: "e" });
  g.addEdge("a", "t", { type: "e" });
  g.addEdge("b", "t", { type: "e" });
  // A longer detour that must NOT join the union.
  g.addEdge("s", "d", { type: "e" });
  g.addEdge("d", "a", { type: "e" });
  return g;
}

describe("allShortestPaths", () => {
  it("returns the union of BOTH diamond routes, excluding the detour", () => {
    const r = allShortestPaths(diamond(), "s", "t");
    expect(r.found).toBe(true);
    expect(r.length).toBe(2);
    expect(r.pathCount).toBe(2);
    expect([...r.nodeIds].sort()).toEqual(["a", "b", "s", "t"]);
    expect(r.edgeIds).toHaveLength(4);
    expect(r.nodeIds).not.toContain("d");
  });

  it("caps the route count instead of exploding", () => {
    // A 6-stage lattice: 2^6 = 64 routes, above the 50 default cap.
    const g = new UGM();
    g.addNode("n0", { types: ["N"] });
    for (let i = 0; i < 6; i++) {
      g.addNode(`a${i}`, { types: ["N"] });
      g.addNode(`b${i}`, { types: ["N"] });
      g.addNode(`n${i + 1}`, { types: ["N"] });
      g.addEdge(`n${i}`, `a${i}`, { type: "e" });
      g.addEdge(`n${i}`, `b${i}`, { type: "e" });
      g.addEdge(`a${i}`, `n${i + 1}`, { type: "e" });
      g.addEdge(`b${i}`, `n${i + 1}`, { type: "e" });
    }
    const r = allShortestPaths(g, "n0", "n6");
    expect(r.found).toBe(true);
    expect(r.pathCount).toBe(50);
  });

  it("reports not-found for disconnected pairs", () => {
    const g = new UGM();
    g.addNode("x", { types: ["N"] });
    g.addNode("y", { types: ["N"] });
    const r = allShortestPaths(g, "x", "y");
    expect(r.found).toBe(false);
    expect(r.pathCount).toBe(0);
  });
});
