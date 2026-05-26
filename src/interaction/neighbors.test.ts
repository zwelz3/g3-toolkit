/**
 * N-degree neighbor tests (M1.E3.T1):
 * Seed with 10 nodes; expand; verify neighbors appear.
 * Exceed 500; verify limit check.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "@core/ugm";
import { WorkingSetManager } from "@core/working-set-manager";
import { expandNeighbors } from "./neighbors";

function createStarGraph(centerDegree: number): UGM {
  const ugm = new UGM();
  ugm.addNode("center", { types: ["Hub"] });
  for (let i = 0; i < centerDegree; i++) {
    ugm.addNode(`leaf-${i}`, { types: ["Leaf"] });
    ugm.addEdge("center", `leaf-${i}`, { type: "link" });
  }
  return ugm;
}

function createChainGraph(length: number): UGM {
  const ugm = new UGM();
  for (let i = 0; i < length; i++) {
    ugm.addNode(`n${i}`, { types: ["Node"] });
    if (i > 0) {
      ugm.addEdge(`n${i - 1}`, `n${i}`, { type: "next" });
    }
  }
  return ugm;
}

describe("expandNeighbors (M1.E3.T1)", () => {
  it("finds 1-degree neighbors of center in star graph", () => {
    const ugm = createStarGraph(5);
    const result = expandNeighbors(ugm, "center", 1);

    expect(result.discoveredIds).toHaveLength(5);
    expect(result.discoveredIds).toContain("leaf-0");
    expect(result.discoveredIds).toContain("leaf-4");
    expect(result.discoveredIds).not.toContain("center");
  });

  it("finds 2-degree neighbors in chain graph", () => {
    const ugm = createChainGraph(5); // n0 - n1 - n2 - n3 - n4
    const result = expandNeighbors(ugm, "n2", 2);

    // Depth 1: n1, n3
    // Depth 2: n0, n4
    expect(result.discoveredIds).toHaveLength(4);
    expect(result.discoveredIds).toContain("n0");
    expect(result.discoveredIds).toContain("n1");
    expect(result.discoveredIds).toContain("n3");
    expect(result.discoveredIds).toContain("n4");
  });

  it("does not revisit already-visited nodes", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addNode("c", { types: ["X"] });
    ugm.addEdge("a", "b", { type: "link" });
    ugm.addEdge("b", "c", { type: "link" });
    ugm.addEdge("c", "a", { type: "link" }); // cycle

    const result = expandNeighbors(ugm, "a", 3);
    // Should find b and c without infinite loop
    expect(result.discoveredIds).toHaveLength(2);
  });

  it("returns empty for isolated node", () => {
    const ugm = new UGM();
    ugm.addNode("alone", { types: ["X"] });

    const result = expandNeighbors(ugm, "alone", 1);
    expect(result.discoveredIds).toHaveLength(0);
  });

  it("checks working-set limit and flags exceedance", () => {
    const ugm = createStarGraph(10);
    const wsm = new WorkingSetManager({ canvas: 8 });

    const result = expandNeighbors(ugm, "center", 1, 0, wsm);
    // 10 neighbors + 0 existing = 10 > 8
    expect(result.exceedsLimit).toBe(true);
    expect(result.limit).toBe(8);
    expect(result.totalCount).toBe(10);
  });

  it("does not flag when under limit", () => {
    const ugm = createStarGraph(3);
    const wsm = new WorkingSetManager({ canvas: 500 });

    const result = expandNeighbors(ugm, "center", 1, 10, wsm);
    expect(result.exceedsLimit).toBe(false);
    expect(result.totalCount).toBe(13); // 3 new + 10 existing
  });

  it("accounts for currentVisibleCount in limit check", () => {
    const ugm = createStarGraph(5);
    const wsm = new WorkingSetManager({ canvas: 10 });

    const result = expandNeighbors(ugm, "center", 1, 8, wsm);
    // 5 new + 8 existing = 13 > 10
    expect(result.exceedsLimit).toBe(true);
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("expandNeighbors: edge cases (audit)", () => {
  it("depth 0 returns no neighbors", () => {
    const ugm = createStarGraph(5);
    const result = expandNeighbors(ugm, "center", 0);
    expect(result.discoveredIds).toHaveLength(0);
  });

  it("depth exceeding graph diameter returns all reachable nodes", () => {
    const ugm = createChainGraph(4); // n0 - n1 - n2 - n3
    const result = expandNeighbors(ugm, "n0", 100);
    // Should find n1, n2, n3 (all reachable) without error
    expect(result.discoveredIds).toHaveLength(3);
  });
});
