/**
 * Force-directed edge bundling: determinism, endpoint preservation,
 * parallel-edge convergence, and the maxEdges bypass.
 */
import { describe, it, expect } from "vitest";
import {
  bundleEdges,
  bundledPolylineToSegments,
  type BundlingEdge,
  type XY,
} from "./edge-bundling";

function twoParallel(): {
  positions: Record<string, XY>;
  edges: BundlingEdge[];
} {
  return {
    positions: {
      a1: { x: 0, y: 0 },
      a2: { x: 100, y: 0 },
      b1: { x: 0, y: 10 },
      b2: { x: 100, y: 10 },
    },
    edges: [
      { id: "a", source: "a1", target: "a2" },
      { id: "b", source: "b1", target: "b2" },
    ],
  };
}

describe("bundleEdges", () => {
  it("is deterministic across runs", () => {
    const { positions, edges } = twoParallel();
    const r1 = bundleEdges(positions, edges);
    const r2 = bundleEdges(positions, edges);
    expect(r1.skipped).toBe(false);
    expect(r2.skipped).toBe(false);
    for (const e of edges) {
      const p1 = r1.routes.get(e.id)!;
      const p2 = r2.routes.get(e.id)!;
      expect(p1.length).toBe(p2.length);
      for (let i = 0; i < p1.length; i++) {
        expect(p1[i]!.x).toBe(p2[i]!.x);
        expect(p1[i]!.y).toBe(p2[i]!.y);
      }
    }
  });

  it("preserves endpoints exactly (referential identity)", () => {
    const { positions, edges } = twoParallel();
    const { routes } = bundleEdges(positions, edges);
    for (const e of edges) {
      const poly = routes.get(e.id)!;
      // Referential equality: bundleEdges re-pins the endpoints from
      // the input positions object, so no numerical drift can appear.
      expect(poly[0]).toBe(positions[e.source]);
      expect(poly[poly.length - 1]).toBe(positions[e.target]);
    }
  });

  it("bundles two near-parallel edges: interior midpoints converge", () => {
    const { positions, edges } = twoParallel();
    const { routes } = bundleEdges(positions, edges);
    const a = routes.get("a")!;
    const b = routes.get("b")!;
    // Both were subdivided identically, so pick the middle interior.
    expect(a.length).toBe(b.length);
    const mid = Math.floor(a.length / 2);
    const inputGap = 10; // y=0 vs y=10 midpoints, initial gap 10
    const bundledGap = Math.abs(a[mid]!.y - b[mid]!.y);
    expect(bundledGap).toBeLessThan(inputGap);
  });

  it("does NOT move node positions (only interior polyline points move)", () => {
    const { positions, edges } = twoParallel();
    const snapshot = JSON.parse(JSON.stringify(positions)) as typeof positions;
    bundleEdges(positions, edges);
    // Same object identity AND same values.
    expect(positions).toEqual(snapshot);
  });

  it("degenerate self-loop returns the trivial [s, t] with no interior", () => {
    const positions: Record<string, XY> = { p: { x: 5, y: 5 } };
    const { routes } = bundleEdges(positions, [
      { id: "loop", source: "p", target: "p" },
    ]);
    const r = routes.get("loop")!;
    expect(r.length).toBe(2);
    expect(r[0]).toBe(positions.p);
    expect(r[1]).toBe(positions.p);
  });

  it("returns skipped=true when input exceeds maxEdges, and keeps endpoints", () => {
    // 5 edges, cap 3.
    const positions: Record<string, XY> = {};
    const edges: BundlingEdge[] = [];
    for (let i = 0; i < 10; i++) {
      positions[`n${i}`] = { x: i * 10, y: 0 };
    }
    for (let i = 0; i < 5; i++) {
      edges.push({ id: `e${i}`, source: `n${i}`, target: `n${i + 5}` });
    }
    const { routes, skipped } = bundleEdges(positions, edges, { maxEdges: 3 });
    expect(skipped).toBe(true);
    for (const e of edges) {
      const poly = routes.get(e.id)!;
      expect(poly.length).toBe(2);
      expect(poly[0]).toBe(positions[e.source]);
      expect(poly[1]).toBe(positions[e.target]);
    }
  });

  it("drops edges whose endpoints are missing from positions", () => {
    const positions: Record<string, XY> = {
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
    };
    const { routes } = bundleEdges(positions, [
      { id: "real", source: "a", target: "b" },
      { id: "dangling", source: "a", target: "ghost" },
    ]);
    expect(routes.has("real")).toBe(true);
    expect(routes.has("dangling")).toBe(false);
  });

  it("accepts positions as a Map or plain object", () => {
    const { positions, edges } = twoParallel();
    const asMap = new Map(Object.entries(positions));
    const rObj = bundleEdges(positions, edges);
    const rMap = bundleEdges(asMap, edges);
    for (const e of edges) {
      const a = rObj.routes.get(e.id)!;
      const b = rMap.routes.get(e.id)!;
      expect(a.length).toBe(b.length);
      for (let i = 0; i < a.length; i++) {
        expect(a[i]!.x).toBe(b[i]!.x);
        expect(a[i]!.y).toBe(b[i]!.y);
      }
    }
  });
});

describe("bundledPolylineToSegments", () => {
  it("returns null for a straight 2-point polyline (no interior)", () => {
    const seg = bundledPolylineToSegments([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(seg).toBeNull();
  });

  it("projects interior bends onto source->target weights/distances", () => {
    // A single interior bend above the horizontal source->target line.
    const seg = bundledPolylineToSegments([
      { x: 0, y: 0 },
      { x: 50, y: -10 },
      { x: 100, y: 0 },
    ]);
    expect(seg).not.toBeNull();
    expect(seg!.weights).toEqual([0.5]);
    // Right-hand normal in screen space (y down) of the +x direction
    // is (0, +1), so a bend at y=-10 (screen-up) is distance -10.
    expect(seg!.distances).toEqual([-10]);
  });

  it("returns null for a degenerate axis (coincident endpoints)", () => {
    const seg = bundledPolylineToSegments([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ]);
    expect(seg).toBeNull();
  });
});
