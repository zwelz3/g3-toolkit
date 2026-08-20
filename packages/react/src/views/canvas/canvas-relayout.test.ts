/**
 * Unit tests for `runCanvasRelayout` (brief 23 relayoutSignal helper).
 * Mirrors the fake-cy pattern used by canvas-edge-routing.test.ts: the
 * pass reads visible node boxes + visible edge endpoint pairs, calls the
 * pure `optimizePlacement` from @g3t/core, and writes CENTER positions
 * back through `cy.getElementById(id).position(...)`. Structural scenes
 * are skipped by contract.
 */

import { describe, expect, it } from "vitest";
import type { Core } from "cytoscape";
import { runCanvasRelayout } from "./CytoscapeCanvas";

interface FakeNode {
  id: string;
  x: number; // box top-left x
  y: number; // box top-left y
  w: number;
  h: number;
  isParent?: boolean;
  hidden?: boolean;
  /** Written back by runCanvasRelayout via position({x,y}) — center. */
  center?: { x: number; y: number };
}
interface FakeEdge {
  id: string;
  source: string;
  target: string;
  hidden?: boolean;
  structuralRouted?: boolean;
}

function makeFakeCy(nodes: FakeNode[], edges: FakeEdge[]): Core {
  const collection = <T>(items: T[]) => ({
    length: items.length,
    forEach: (fn: (t: T) => void) => items.forEach(fn),
  });
  const nodeApi = (n: FakeNode) => ({
    id: () => n.id,
    isParent: () => n.isParent === true,
    boundingBox: () => ({ x1: n.x, y1: n.y, w: n.w, h: n.h }),
  });
  const edgeApi = (e: FakeEdge) => ({
    id: () => e.id,
    data: () => ({ id: e.id, source: e.source, target: e.target }),
  });
  return {
    nodes: (sel?: string) => {
      const visible =
        sel === ":visible" ? nodes.filter((n) => !n.hidden) : nodes;
      return collection(visible.map(nodeApi));
    },
    edges: (sel?: string) => {
      if (sel === ".g3t-structural-edge-routed") {
        return collection(edges.filter((e) => e.structuralRouted));
      }
      if (sel === ":visible") {
        return collection(edges.filter((e) => !e.hidden).map(edgeApi));
      }
      return collection(edges.map(edgeApi));
    },
    getElementById: (id: string) => ({
      position: (p: { x: number; y: number }) => {
        const n = nodes.find((nn) => nn.id === id);
        if (n) n.center = { x: p.x, y: p.y };
      },
    }),
    batch: (fn: () => void) => fn(),
  } as unknown as Core;
}

describe("runCanvasRelayout", () => {
  it("no-ops on structural scenes (structural-routed class present)", () => {
    const nodes: FakeNode[] = [{ id: "a", x: 0, y: 0, w: 40, h: 40 }];
    const edges: FakeEdge[] = [
      {
        id: "e",
        source: "a",
        target: "a",
        structuralRouted: true,
      },
    ];
    const cy = makeFakeCy(nodes, edges);
    const r = runCanvasRelayout(cy);
    expect(r.skipped).toBe(true);
    expect(nodes[0]!.center).toBeUndefined();
  });

  it("writes CENTER positions for every non-parent visible node, preserving the id set", () => {
    // K(2,2)-style crossing storm: two straight-line edges that cross
    // in the initial layout; optimizePlacement's swap should reduce or
    // preserve crossings and we assert positions were written back.
    const nodes: FakeNode[] = [
      { id: "a", x: 0, y: 0, w: 40, h: 40 },
      { id: "b", x: 200, y: 0, w: 40, h: 40 },
      { id: "c", x: 0, y: 200, w: 40, h: 40 },
      { id: "d", x: 200, y: 200, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = [
      { id: "e1", source: "a", target: "d" },
      { id: "e2", source: "b", target: "c" },
    ];
    const cy = makeFakeCy(nodes, edges);
    const r = runCanvasRelayout(cy, { budgetMs: 50, seed: 7 });
    expect(r.skipped).toBe(false);
    // Every non-parent node received a center-position write; id set
    // preserved (the "reposition only" contract the canvas relies on).
    for (const n of nodes) {
      expect(n.center).toBeDefined();
    }
    expect(r.crossingsAfter).toBeLessThanOrEqual(r.crossingsBefore);
  });

  it("skips :parent nodes (they have no drawn body)", () => {
    const nodes: FakeNode[] = [
      { id: "compound", x: 0, y: 0, w: 400, h: 400, isParent: true },
      { id: "a", x: 20, y: 20, w: 40, h: 40 },
      { id: "b", x: 300, y: 20, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = [{ id: "e", source: "a", target: "b" }];
    const cy = makeFakeCy(nodes, edges);
    runCanvasRelayout(cy, { budgetMs: 20, seed: 1 });
    // Parent never touched by the optimizer; leaves stay eligible.
    expect(nodes[0]!.center).toBeUndefined();
    expect(nodes[1]!.center).toBeDefined();
    expect(nodes[2]!.center).toBeDefined();
  });
});
