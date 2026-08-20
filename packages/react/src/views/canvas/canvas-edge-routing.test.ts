/**
 * Unit tests for the exported `runCanvasEdgeRouting` pass (routeEdges
 * prop). The full component wiring (layoutstop attachment, generation
 * counter double-fire guard) is covered by the demo shells' e2e suite;
 * this file pins the pure pass's contract against a fake cy instance.
 */

import { describe, expect, it, vi } from "vitest";
import type { Core } from "cytoscape";
import { runCanvasEdgeRouting } from "./CytoscapeCanvas";

interface FakeNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isParent?: boolean;
  hidden?: boolean;
}
interface FakeEdge {
  id: string;
  source: string;
  target: string;
  data: Record<string, unknown>;
  classes: Set<string>;
  hidden?: boolean;
  structuralRouted?: boolean;
}

function makeFakeCy(nodes: FakeNode[], edges: FakeEdge[]): Core {
  const collection = <T>(items: T[]) => ({
    length: items.length,
    forEach: (fn: (t: T) => void) => items.forEach(fn),
    filter: (fn: (t: T) => boolean) => collection(items.filter(fn)),
  });
  const nodeApi = (n: FakeNode) => ({
    id: () => n.id,
    isParent: () => n.isParent === true,
    boundingBox: () => ({ x1: n.x, y1: n.y, w: n.w, h: n.h }),
  });
  const edgeApi = (e: FakeEdge) => ({
    id: () => e.id,
    data: (k?: string, v?: unknown) => {
      if (k === undefined)
        return { id: e.id, source: e.source, target: e.target };
      if (v === undefined) return e.data[k];
      e.data[k] = v;
      return undefined;
    },
    removeData: (k: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete e.data[k];
    },
    hasClass: (c: string) => e.classes.has(c),
    addClass: (c: string) => {
      e.classes.add(c);
    },
    removeClass: (c: string) => {
      e.classes.delete(c);
    },
  });
  return {
    nodes: (sel?: string) => {
      const visible =
        sel === ":visible" ? nodes.filter((n) => !n.hidden) : nodes;
      return collection(visible.map(nodeApi));
    },
    edges: (sel?: string) => {
      if (sel === ".g3t-structural-edge-routed") {
        return collection(edges.filter((e) => e.structuralRouted).map(edgeApi));
      }
      if (sel === ".g3t-canvas-edge-routed") {
        return collection(
          edges
            .filter((e) => e.classes.has("g3t-canvas-edge-routed"))
            .map(edgeApi),
        );
      }
      if (sel === ":visible") {
        return collection(edges.filter((e) => !e.hidden).map(edgeApi));
      }
      return collection(edges.map(edgeApi));
    },
    batch: (fn: () => void) => fn(),
  } as unknown as Core;
}

describe("runCanvasEdgeRouting", () => {
  it("stamps _segDist/_segWeight + class on edges that route with bends", () => {
    const nodes: FakeNode[] = [
      { id: "a", x: 0, y: 40, w: 40, h: 40 },
      { id: "obst", x: 100, y: 0, w: 60, h: 200 },
      { id: "b", x: 240, y: 40, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = [
      { id: "e1", source: "a", target: "b", data: {}, classes: new Set() },
    ];
    const cy = makeFakeCy(nodes, edges);
    const r = runCanvasEdgeRouting(cy, { maxEdges: 600 });
    expect(r.skipped).toBe(false);
    expect(r.routedCount).toBe(1);
    expect(edges[0]!.classes.has("g3t-canvas-edge-routed")).toBe(true);
    expect(edges[0]!.data._segDist).toBeDefined();
    expect(edges[0]!.data._segWeight).toBeDefined();
  });

  it("clears prior routing data when an edge no longer routes with bends", () => {
    // Straight-line arrangement (no obstacle): the pass yields no
    // interior bends, so any prior routing stamp must be cleared.
    const nodes: FakeNode[] = [
      { id: "a", x: 0, y: 40, w: 40, h: 40 },
      { id: "b", x: 200, y: 40, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = [
      {
        id: "e1",
        source: "a",
        target: "b",
        data: { _segDist: "10 20", _segWeight: "0.3 0.6" },
        classes: new Set(["g3t-canvas-edge-routed"]),
      },
    ];
    const cy = makeFakeCy(nodes, edges);
    runCanvasEdgeRouting(cy, { maxEdges: 600 });
    expect(edges[0]!.classes.has("g3t-canvas-edge-routed")).toBe(false);
    expect(edges[0]!.data._segDist).toBeUndefined();
    expect(edges[0]!.data._segWeight).toBeUndefined();
  });

  it("no-ops on structural scenes (structural-routed class present)", () => {
    const nodes: FakeNode[] = [
      { id: "a", x: 0, y: 0, w: 40, h: 40 },
      { id: "b", x: 200, y: 0, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = [
      {
        id: "structural",
        source: "a",
        target: "b",
        data: {},
        classes: new Set(),
        structuralRouted: true,
      },
      { id: "other", source: "a", target: "b", data: {}, classes: new Set() },
    ];
    const cy = makeFakeCy(nodes, edges);
    const r = runCanvasEdgeRouting(cy, { maxEdges: 600 });
    expect(r.skipped).toBe(true);
    expect(edges[1]!.classes.has("g3t-canvas-edge-routed")).toBe(false);
  });

  it("skips (and reports it) when visible-edge count exceeds maxEdges", () => {
    const nodes: FakeNode[] = [
      { id: "a", x: 0, y: 0, w: 40, h: 40 },
      { id: "b", x: 200, y: 0, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`,
      source: "a",
      target: "b",
      data: {},
      classes: new Set<string>(),
    }));
    const cy = makeFakeCy(nodes, edges);
    const r = runCanvasEdgeRouting(cy, { maxEdges: 3 });
    expect(r.skipped).toBe(true);
    expect(r.routedCount).toBe(0);
    for (const e of edges) {
      expect(e.classes.has("g3t-canvas-edge-routed")).toBe(false);
    }
  });

  it("drag-free scope: only reroutes edges incident to the given node", () => {
    const nodes: FakeNode[] = [
      { id: "a", x: 0, y: 40, w: 40, h: 40 },
      { id: "obst", x: 100, y: 0, w: 60, h: 200 },
      { id: "b", x: 240, y: 40, w: 40, h: 40 },
      { id: "c", x: 500, y: 40, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = [
      { id: "ab", source: "a", target: "b", data: {}, classes: new Set() },
      { id: "bc", source: "b", target: "c", data: {}, classes: new Set() },
    ];
    const cy = makeFakeCy(nodes, edges);
    const spy = vi.spyOn(cy, "batch");
    runCanvasEdgeRouting(cy, { maxEdges: 600 }, "a");
    expect(spy).toHaveBeenCalled();
    // Edge "ab" is incident to "a" and had an obstacle to route around:
    // it should carry the routed class.
    expect(edges[0]!.classes.has("g3t-canvas-edge-routed")).toBe(true);
    // Edge "bc" is NOT incident to "a": it must remain untouched.
    expect(edges[1]!.classes.has("g3t-canvas-edge-routed")).toBe(false);
    expect(edges[1]!.data._segDist).toBeUndefined();
  });

  it("skips compound parent nodes as obstacles", () => {
    // The parent has a huge bounding box overlapping the direct route,
    // but children cover the interior; excluding it means edges route
    // straight over the (empty) parent chrome and around real children.
    const nodes: FakeNode[] = [
      { id: "p", x: -100, y: -100, w: 500, h: 400, isParent: true },
      { id: "a", x: 0, y: 40, w: 40, h: 40 },
      { id: "b", x: 240, y: 40, w: 40, h: 40 },
    ];
    const edges: FakeEdge[] = [
      { id: "e1", source: "a", target: "b", data: {}, classes: new Set() },
    ];
    const cy = makeFakeCy(nodes, edges);
    const r = runCanvasEdgeRouting(cy, { maxEdges: 600 });
    expect(r.skipped).toBe(false);
    // No interior obstacle -> the route is straight -> no routed class.
    expect(edges[0]!.classes.has("g3t-canvas-edge-routed")).toBe(false);
  });
});
