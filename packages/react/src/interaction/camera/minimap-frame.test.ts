import { describe, it, expect } from "vitest";
import {
  computeMinimapFrame,
  projectToMinimap,
  type Box,
} from "./minimap-frame";

const W = 200;
const H = 140;
const P = 10;
const GRAPH: Box = { x1: 0, y1: 0, x2: 100, y2: 80 };

const within = (pt: { x: number; y: number }, w = W, h = H, pad = P): boolean =>
  pt.x >= pad - 1e-9 &&
  pt.x <= w - pad + 1e-9 &&
  pt.y >= pad - 1e-9 &&
  pt.y <= h - pad + 1e-9;

describe("computeMinimapFrame", () => {
  it("frames to the graph when the viewport sits inside it (overview unchanged)", () => {
    const view: Box = { x1: 20, y1: 20, x2: 60, y2: 50 };
    const f = computeMinimapFrame(GRAPH, view, W, H, P);
    expect(f.frameX1).toBe(0);
    expect(f.frameY1).toBe(0);
    // graph fills the available area and the viewport rect nests inside it
    expect(within(projectToMinimap(f, GRAPH.x2, GRAPH.y2))).toBe(true);
    expect(within(projectToMinimap(f, view.x1, view.y1))).toBe(true);
    expect(within(projectToMinimap(f, view.x2, view.y2))).toBe(true);
  });

  it("expands to include the viewport, keeping its rect within the canvas when zoomed out", () => {
    const view: Box = { x1: -200, y1: -150, x2: 300, y2: 250 }; // larger than graph
    const f = computeMinimapFrame(GRAPH, view, W, H, P);
    expect(f.frameX1).toBe(-200);
    expect(f.frameY1).toBe(-150);
    const vtl = projectToMinimap(f, view.x1, view.y1);
    const vbr = projectToMinimap(f, view.x2, view.y2);
    // the viewport rectangle does NOT clip: both corners are inside the canvas
    expect(within(vtl)).toBe(true);
    expect(within(vbr)).toBe(true);
    // the graph is now drawn smaller than the viewport rect (nested in white space)
    const gtl = projectToMinimap(f, GRAPH.x1, GRAPH.y1);
    const gbr = projectToMinimap(f, GRAPH.x2, GRAPH.y2);
    expect(gbr.x - gtl.x).toBeLessThan(vbr.x - vtl.x);
    expect(gbr.y - gtl.y).toBeLessThan(vbr.y - vtl.y);
  });

  it("keeps the viewport rect within the canvas when panned entirely into white space", () => {
    const view: Box = { x1: 300, y1: 200, x2: 500, y2: 360 }; // disjoint from graph
    const f = computeMinimapFrame(GRAPH, view, W, H, P);
    const vtl = projectToMinimap(f, view.x1, view.y1);
    const vbr = projectToMinimap(f, view.x2, view.y2);
    expect(within(vtl)).toBe(true);
    expect(within(vbr)).toBe(true);
    // the graph remains in the frame too (still an overview)
    expect(within(projectToMinimap(f, GRAPH.x1, GRAPH.y1))).toBe(true);
  });

  it("is continuous at the boundary (no scale jump as the viewport reaches the graph edge)", () => {
    const justInside = computeMinimapFrame(
      GRAPH,
      { x1: 0, y1: 0, x2: 100, y2: 80 },
      W,
      H,
      P,
    );
    const justOutside = computeMinimapFrame(
      GRAPH,
      { x1: -1, y1: -1, x2: 101, y2: 81 },
      W,
      H,
      P,
    );
    expect(Math.abs(justInside.scale - justOutside.scale)).toBeLessThan(
      justInside.scale * 0.05,
    );
  });
});
