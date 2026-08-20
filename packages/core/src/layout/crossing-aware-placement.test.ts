import { describe, it, expect } from "vitest";
import {
  optimizePlacement,
  type PlacementNode,
  type PlacementEdge,
} from "./crossing-aware-placement";
import { countCrossings } from "../metrics/layout-metrics";

/** Reference crossing count computed from a positions map + edges. */
function crossingsOf(
  positions: Map<string, { x: number; y: number }>,
  sizes: Map<string, { width: number; height: number }>,
  edges: readonly PlacementEdge[],
): number {
  return countCrossings(
    edges.map((e) => {
      const s = positions.get(e.source)!;
      const t = positions.get(e.target)!;
      const ss = sizes.get(e.source)!;
      const ts = sizes.get(e.target)!;
      return {
        id: e.id,
        points: [
          { x: s.x + ss.width / 2, y: s.y + ss.height / 2 },
          { x: t.x + ts.width / 2, y: t.y + ts.height / 2 },
        ],
      };
    }),
  );
}

describe("optimizePlacement", () => {
  it("reduces crossings on a 4-node crossing fixture", () => {
    const nodes: PlacementNode[] = [
      { id: "A", x: 0, y: 0, width: 10, height: 10 },
      { id: "B", x: 100, y: 0, width: 10, height: 10 },
      { id: "C", x: 0, y: 100, width: 10, height: 10 },
      { id: "D", x: 100, y: 100, width: 10, height: 10 },
    ];
    const edges: PlacementEdge[] = [
      { id: "e1", source: "A", target: "D" },
      { id: "e2", source: "B", target: "C" },
    ];

    const result = optimizePlacement(nodes, edges, { seed: 7 });

    expect(result.crossingsBefore).toBe(1);
    expect(result.crossingsAfter).toBeLessThan(result.crossingsBefore);
    expect(result.improved).toBe(true);
    // Same node id set preserved.
    expect([...result.positions.keys()].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("is deterministic for a fixed seed", () => {
    const nodes: PlacementNode[] = [
      { id: "A", x: 0, y: 0, width: 10, height: 10 },
      { id: "B", x: 100, y: 0, width: 10, height: 10 },
      { id: "C", x: 0, y: 100, width: 10, height: 10 },
      { id: "D", x: 100, y: 100, width: 10, height: 10 },
    ];
    const edges: PlacementEdge[] = [
      { id: "e1", source: "A", target: "D" },
      { id: "e2", source: "B", target: "C" },
    ];

    const r1 = optimizePlacement(nodes, edges, { seed: 42 });
    const r2 = optimizePlacement(nodes, edges, { seed: 42 });

    expect([...r1.positions.entries()].sort()).toEqual(
      [...r2.positions.entries()].sort(),
    );
    expect(r1.crossingsAfter).toBe(r2.crossingsAfter);
  });

  it("returns seed unchanged when input is already crossing-free", () => {
    const nodes: PlacementNode[] = [
      { id: "A", x: 0, y: 0, width: 10, height: 10 },
      { id: "B", x: 50, y: 0, width: 10, height: 10 },
      { id: "C", x: 100, y: 0, width: 10, height: 10 },
      { id: "D", x: 150, y: 0, width: 10, height: 10 },
    ];
    const edges: PlacementEdge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "C" },
      { id: "e3", source: "C", target: "D" },
    ];

    const result = optimizePlacement(nodes, edges);

    expect(result.crossingsBefore).toBe(0);
    expect(result.crossingsAfter).toBe(0);
    expect(result.iterations).toBeLessThanOrEqual(1);
    for (const n of nodes) {
      expect(result.positions.get(n.id)).toEqual({ x: n.x, y: n.y });
    }
  });

  it("respects the wall-clock budget", () => {
    // 20 nodes in a grid with many crossing edges.
    const nodes: PlacementNode[] = [];
    for (let i = 0; i < 20; i++) {
      nodes.push({
        id: `n${i}`,
        x: (i % 5) * 40,
        y: Math.floor(i / 5) * 40,
        width: 10,
        height: 10,
      });
    }
    const edges: PlacementEdge[] = [];
    for (let i = 0; i < 20; i++) {
      edges.push({
        id: `e${i}`,
        source: `n${i}`,
        target: `n${(i + 7) % 20}`,
      });
    }

    const result = optimizePlacement(nodes, edges, {
      seed: 3,
      budgetMs: 50,
    });

    expect(result.elapsedMs).toBeLessThan(200);
    expect(result.crossingsAfter).toBeLessThanOrEqual(result.crossingsBefore);
    // Sanity: verify reported crossings match a re-computation.
    const sizes = new Map<string, { width: number; height: number }>();
    for (const n of nodes)
      sizes.set(n.id, { width: n.width, height: n.height });
    expect(crossingsOf(result.positions, sizes, edges)).toBe(
      result.crossingsAfter,
    );
  });

  it("does not mutate input arrays", () => {
    const nodes: PlacementNode[] = [
      { id: "A", x: 0, y: 0, width: 10, height: 10 },
      { id: "B", x: 100, y: 0, width: 10, height: 10 },
      { id: "C", x: 0, y: 100, width: 10, height: 10 },
      { id: "D", x: 100, y: 100, width: 10, height: 10 },
    ];
    const edges: PlacementEdge[] = [
      { id: "e1", source: "A", target: "D" },
      { id: "e2", source: "B", target: "C" },
    ];
    const nodesBefore = JSON.parse(JSON.stringify(nodes));
    const edgesBefore = JSON.parse(JSON.stringify(edges));

    optimizePlacement(nodes, edges, { seed: 11 });

    expect(nodes).toEqual(nodesBefore);
    expect(edges).toEqual(edgesBefore);
  });
});
