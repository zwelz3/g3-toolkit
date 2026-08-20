/**
 * PRF-003 brief 05a: fallback-classifier unit oracles (owner Jake,
 * 2026-08-14). Exercises each of the three conditions: same-layer,
 * anti-monotone, compound-boundary.
 */
import { describe, expect, it } from "vitest";
import {
  classifyFallback,
  type FallbackEdge,
  type FallbackNodeInfo,
} from "./g3t-fallback-classifier";

function n(
  id: string,
  layer: number,
  parent: string | null,
  bbox: { x: number; y: number; width: number; height: number },
): FallbackNodeInfo {
  return { id, layer, parent, bbox };
}

describe("classifyFallback (PRF-003 05a)", () => {
  it("5a: same-layer edge classifies as 'same-layer'", () => {
    const nodes: FallbackNodeInfo[] = [
      n("a", 0, null, { x: 0, y: 0, width: 40, height: 40 }),
      n("b", 0, null, { x: 100, y: 0, width: 40, height: 40 }),
    ];
    const edges: FallbackEdge[] = [{ id: "e", source: "a", target: "b" }];
    const { edges: out } = classifyFallback(edges, nodes, "RIGHT");
    expect(out.get("e")).toBe("same-layer");
  });

  it("5b: backward arc under RIGHT flow classifies as 'anti-monotone'", () => {
    const nodes: FallbackNodeInfo[] = [
      n("a", 0, null, { x: 0, y: 0, width: 40, height: 40 }),
      n("b", 1, null, { x: 100, y: 0, width: 40, height: 40 }),
    ];
    // Edge from layer 1 back to layer 0 — target.layer < source.layer.
    const edges: FallbackEdge[] = [{ id: "back", source: "b", target: "a" }];
    const { edges: out } = classifyFallback(edges, nodes, "RIGHT");
    expect(out.get("back")).toBe("anti-monotone");
  });

  it("5b: forward arc under RIGHT flow is NOT classified as fallback", () => {
    const nodes: FallbackNodeInfo[] = [
      n("a", 0, null, { x: 0, y: 0, width: 40, height: 40 }),
      n("b", 1, null, { x: 100, y: 0, width: 40, height: 40 }),
    ];
    const edges: FallbackEdge[] = [{ id: "fwd", source: "a", target: "b" }];
    const { edges: out } = classifyFallback(edges, nodes, "RIGHT");
    expect(out.has("fwd")).toBe(false);
  });

  it("5b: dominant flow flips with direction (LEFT: descending is forward)", () => {
    const nodes: FallbackNodeInfo[] = [
      n("a", 0, null, { x: 0, y: 0, width: 40, height: 40 }),
      n("b", 1, null, { x: 100, y: 0, width: 40, height: 40 }),
    ];
    // Under LEFT, a->b (ascending) is backward.
    const edges: FallbackEdge[] = [{ id: "e", source: "a", target: "b" }];
    const { edges: out } = classifyFallback(edges, nodes, "LEFT");
    expect(out.get("e")).toBe("anti-monotone");
  });

  it("5c: compound-boundary via AABB overlap with non-shared container", () => {
    // Container 'C' sits between endpoints; neither endpoint's parent
    // is 'C', so it is not a shared ancestor. Route AABB overlaps 'C'.
    const nodes: FallbackNodeInfo[] = [
      n("a", 0, null, { x: 0, y: 0, width: 40, height: 40 }),
      n("b", 1, null, { x: 200, y: 0, width: 40, height: 40 }),
      // C is a container with a child so it counts as a compound; its
      // bbox intrudes on the a->b route AABB.
      n("C", 0, null, { x: 80, y: 0, width: 60, height: 60 }),
      n("child_of_c", 0, "C", { x: 90, y: 10, width: 20, height: 20 }),
    ];
    const edges: FallbackEdge[] = [{ id: "e", source: "a", target: "b" }];
    const { edges: out } = classifyFallback(edges, nodes, "RIGHT");
    expect(out.get("e")).toBe("compound-boundary");
  });

  it("5c: container that IS a shared ancestor does not trigger fallback", () => {
    // Both endpoints live inside container 'C'. C's bbox trivially
    // overlaps the a->b route AABB, but C is a shared ancestor so 5c
    // does not fire (and 5a/5b do not apply here).
    const nodes: FallbackNodeInfo[] = [
      n("C", 0, null, { x: 0, y: 0, width: 300, height: 100 }),
      n("a", 0, "C", { x: 10, y: 20, width: 40, height: 40 }),
      n("b", 1, "C", { x: 200, y: 20, width: 40, height: 40 }),
    ];
    const edges: FallbackEdge[] = [{ id: "e", source: "a", target: "b" }];
    const { edges: out } = classifyFallback(edges, nodes, "RIGHT");
    expect(out.has("e")).toBe(false);
  });

  it("evaluation order: same-layer wins over anti-monotone and compound-boundary", () => {
    // Same-layer AND backward AND crosses a foreign container: label
    // stays 'same-layer' (the first condition that fires).
    const nodes: FallbackNodeInfo[] = [
      n("a", 0, null, { x: 0, y: 0, width: 40, height: 40 }),
      n("b", 0, null, { x: 200, y: 0, width: 40, height: 40 }),
      n("C", 0, null, { x: 80, y: 0, width: 60, height: 60 }),
      n("child_of_c", 0, "C", { x: 90, y: 10, width: 20, height: 20 }),
    ];
    const edges: FallbackEdge[] = [{ id: "e", source: "a", target: "b" }];
    const { edges: out } = classifyFallback(edges, nodes, "RIGHT");
    expect(out.get("e")).toBe("same-layer");
  });

  it("ordinary forward, non-compound edge is not in the fallback set", () => {
    const nodes: FallbackNodeInfo[] = [
      n("a", 0, null, { x: 0, y: 0, width: 40, height: 40 }),
      n("b", 1, null, { x: 100, y: 0, width: 40, height: 40 }),
    ];
    const edges: FallbackEdge[] = [{ id: "e", source: "a", target: "b" }];
    const { edges: out } = classifyFallback(edges, nodes, "RIGHT");
    expect(out.size).toBe(0);
  });
});
