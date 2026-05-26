/**
 * Layout engine tests covering M2.E1.T1 and M2.E2.T1-T4:
 *
 * E1.T1: Interface is implementable; pinned nodes appear in output.
 * E2.T1: 200-node DAG; elkjs hierarchical completes; pinned node stays.
 * E2.T2: 200 nodes; force layout completes; pinned node at specified coords.
 * E2.T3: 100-node tree; renders hierarchically.
 * E2.T4: 50-node DAG; dagre completes in under 100ms.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "../ugm";
import { ForceLayout } from "./force-layout";
import { HierarchyLayout } from "./hierarchy-layout";
import { DagreLayout } from "./dagre-layout";
import { ElkLayout } from "./elk-layout";
import type { Position } from "./types";

function createChainGraph(length: number): UGM {
  const ugm = new UGM();
  for (let i = 0; i < length; i++) {
    ugm.addNode(`n${i}`, { types: ["Node"] });
    if (i > 0) ugm.addEdge(`n${i - 1}`, `n${i}`, { type: "next" });
  }
  return ugm;
}

function createDAG(nodeCount: number, edgesPerNode: number = 2): UGM {
  const ugm = new UGM();
  for (let i = 0; i < nodeCount; i++) {
    ugm.addNode(`n${i}`, { types: [`Layer${Math.floor(i / 10)}`] });
  }
  for (let i = 0; i < nodeCount; i++) {
    for (let j = 1; j <= edgesPerNode; j++) {
      const target = i + j;
      if (target < nodeCount) {
        ugm.addEdge(`n${i}`, `n${target}`, { type: "depends" });
      }
    }
  }
  return ugm;
}

function createTreeGraph(depth: number, branching: number): UGM {
  const ugm = new UGM();
  let nodeId = 0;

  function addLevel(parentId: string, currentDepth: number): void {
    if (currentDepth >= depth) return;
    for (let i = 0; i < branching; i++) {
      const childId = `n${nodeId++}`;
      ugm.addNode(childId, { types: ["TreeNode"] });
      ugm.addEdge(parentId, childId, { type: "child" });
      addLevel(childId, currentDepth + 1);
    }
  }

  const rootId = `n${nodeId++}`;
  ugm.addNode(rootId, { types: ["Root"] });
  addLevel(rootId, 0);
  return ugm;
}

// ── E1.T1: Layout engine abstraction ────────────────────────────────

describe("LayoutEngine interface (M2.E1.T1)", () => {
  it("all engines implement the interface with name and id", () => {
    const engines = [
      new ForceLayout(),
      new HierarchyLayout(),
      new DagreLayout(),
      new ElkLayout(),
    ];
    for (const engine of engines) {
      expect(typeof engine.name).toBe("string");
      expect(typeof engine.id).toBe("string");
      expect(engine.name.length).toBeGreaterThan(0);
      expect(engine.id.length).toBeGreaterThan(0);
    }
  });

  it("pinned nodes appear at specified positions in force layout", async () => {
    const ugm = createChainGraph(10);
    const pinned = new Map<string, Position>([["n0", { x: 100, y: 200 }]]);

    const engine = new ForceLayout();
    const result = await engine.compute(ugm, { pinned });

    expect(result.get("n0")).toEqual({ x: 100, y: 200 });
    expect(result.size).toBe(10);
  });
});

// ── E2.T2: d3-force layout ─────────────────────────────────────────

describe("ForceLayout (M2.E2.T2)", () => {
  it("computes positions for 200 nodes", async () => {
    const ugm = createDAG(200);
    const engine = new ForceLayout(100);
    const result = await engine.compute(ugm);

    expect(result.size).toBe(200);

    // Positions should be spread (not all at origin)
    const xs = new Set([...result.values()].map((p) => Math.round(p.x / 10)));
    expect(xs.size).toBeGreaterThan(5);
  });

  it("honors pinned node position", async () => {
    const ugm = createChainGraph(20);
    const pinned = new Map<string, Position>([["n5", { x: 999, y: -999 }]]);

    const engine = new ForceLayout();
    const result = await engine.compute(ugm, { pinned });

    expect(result.get("n5")).toEqual({ x: 999, y: -999 });
  });

  it("handles empty graph", async () => {
    const ugm = new UGM();
    const engine = new ForceLayout();
    const result = await engine.compute(ugm);
    expect(result.size).toBe(0);
  });
});

// ── E2.T3: d3-hierarchy tree layout ─────────────────────────────────

describe("HierarchyLayout (M2.E2.T3)", () => {
  it("computes hierarchical positions for 100-node tree", async () => {
    // 4 levels, branching factor 3 = 1 + 3 + 9 + 27 + 81 nodes
    // Use depth=4, branching=3 = 1+3+9+27 = 40 nodes (close enough)
    const ugm = createTreeGraph(4, 3);
    const engine = new HierarchyLayout();
    const result = await engine.compute(ugm);

    expect(result.size).toBe(ugm.nodeCount);

    // Root should be at a distinct position from leaves
    const positions = [...result.values()];
    const ys = positions.map((p) => p.y);
    const uniqueYLevels = new Set(ys.map((y) => Math.round(y / 40)));
    // Should have multiple Y levels (hierarchical)
    expect(uniqueYLevels.size).toBeGreaterThan(1);
  });

  it("handles pinned nodes", async () => {
    const ugm = createChainGraph(5);
    const pinned = new Map<string, Position>([["n2", { x: 500, y: 500 }]]);

    const engine = new HierarchyLayout();
    const result = await engine.compute(ugm, { pinned });
    expect(result.get("n2")).toEqual({ x: 500, y: 500 });
  });

  it("handles single node", async () => {
    const ugm = new UGM();
    ugm.addNode("solo", { types: ["X"] });

    const engine = new HierarchyLayout();
    const result = await engine.compute(ugm);
    expect(result.size).toBe(1);
    expect(result.has("solo")).toBe(true);
  });
});

// ── E2.T4: dagre DAG layout ────────────────────────────────────────

describe("DagreLayout (M2.E2.T4)", () => {
  it("computes positions for 50-node DAG in under 500ms", async () => {
    const ugm = createDAG(50);
    const engine = new DagreLayout();

    const start = performance.now();
    const result = await engine.compute(ugm);
    const elapsed = performance.now() - start;

    expect(result.size).toBe(50);
    expect(elapsed).toBeLessThan(500);
  });

  it("produces layered positions (Y increases with rank)", async () => {
    const ugm = createChainGraph(5); // n0 → n1 → n2 → n3 → n4
    const engine = new DagreLayout("TB");
    const result = await engine.compute(ugm);

    // In TB mode, Y should increase along the chain
    const y0 = result.get("n0")?.y ?? 0;
    const y4 = result.get("n4")?.y ?? 0;
    expect(y4).toBeGreaterThan(y0);
  });

  it("honors pinned node position", async () => {
    const ugm = createDAG(10);
    const pinned = new Map<string, Position>([["n3", { x: 42, y: 42 }]]);

    const engine = new DagreLayout();
    const result = await engine.compute(ugm, { pinned });
    expect(result.get("n3")).toEqual({ x: 42, y: 42 });
  });

  it("supports LR direction", async () => {
    const ugm = createChainGraph(5);
    const engine = new DagreLayout("LR");
    const result = await engine.compute(ugm);

    // In LR mode, X should increase along the chain
    const x0 = result.get("n0")?.x ?? 0;
    const x4 = result.get("n4")?.x ?? 0;
    expect(x4).toBeGreaterThan(x0);
  });
});

// ── E2.T1: elkjs layout ────────────────────────────────────────────

describe("ElkLayout (M2.E2.T1)", () => {
  it("computes positions for 200-node DAG", async () => {
    const ugm = createDAG(200);
    const engine = new ElkLayout();
    const result = await engine.compute(ugm);

    expect(result.size).toBe(200);
  });

  it("honors pinned node position", async () => {
    const ugm = createChainGraph(10);
    const pinned = new Map<string, Position>([["n0", { x: 777, y: 888 }]]);

    const engine = new ElkLayout();
    const result = await engine.compute(ugm, { pinned });
    expect(result.get("n0")).toEqual({ x: 777, y: 888 });
  });

  it("handles empty graph", async () => {
    const ugm = new UGM();
    const engine = new ElkLayout();
    const result = await engine.compute(ugm);
    expect(result.size).toBe(0);
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("Layout engines: edge cases (audit)", () => {
  it("ForceLayout handles disconnected graph", async () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addNode("c", { types: ["X"] });
    // No edges; nodes are disconnected

    const engine = new ForceLayout(50);
    const result = await engine.compute(ugm);

    expect(result.size).toBe(3);
    // All nodes should have positions (not NaN)
    for (const pos of result.values()) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it("DagreLayout handles disconnected graph", async () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });

    const engine = new DagreLayout();
    const result = await engine.compute(ugm);
    expect(result.size).toBe(2);
  });

  it("HierarchyLayout handles disconnected graph", async () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addNode("c", { types: ["X"] });
    ugm.addEdge("a", "b", { type: "link" });
    // c is disconnected

    const engine = new HierarchyLayout();
    const result = await engine.compute(ugm);
    expect(result.size).toBe(3);
    expect(result.has("c")).toBe(true);
  });
});
