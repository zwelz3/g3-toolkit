/**
 * SankeyView smoke coverage. Written at Schema Dashboard retirement
 * (review 5.5): the view relocated to the Analytics surface and had
 * NO suite of its own. With the SVG renderer the view runs directly
 * in jsdom; the pins are deliberately shallow (mounts, emits SVG for
 * a non-empty graph, survives an empty one).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { SankeyView } from "./SankeyView";
import { stubChartDims } from "../../../../../tests/chart-dims";

stubChartDims();
afterEach(cleanup);

// jsdom lacks ResizeObserver (the view observes its container).
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;

function smallUgm(): UGM {
  const g = new UGM();
  g.addNode("s1", { types: ["Supplier"] });
  g.addNode("p1", { types: ["Part"] });
  g.addNode("a1", { types: ["Assembly"] });
  g.addEdge("s1", "p1", { type: "supplies" });
  g.addEdge("p1", "a1", { type: "partOf" });
  return g;
}

describe("SankeyView", () => {
  it("mounts and emits SVG for a non-empty UGM", () => {
    render(<SankeyView ugm={smallUgm()} mode="sankey" />);
    const root = screen.getByTestId("sankey-view");
    expect(root.querySelector("svg")).not.toBeNull();
  });

  it("an empty graph renders the explicit empty state, not a blank chart", () => {
    render(<SankeyView ugm={new UGM()} mode="sankey" />);
    expect(screen.getByTestId("sankey-empty")).toBeDefined();
  });
});
