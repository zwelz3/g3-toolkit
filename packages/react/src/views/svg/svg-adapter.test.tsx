/**
 * SVG adapter conformance oracles (G3L:RND-001, F1). Two layers:
 * pure geometry helpers, and rendered-structure assertions through
 * a real jsdom render (SVG needs no canvas, so unlike the Cytoscape
 * path the F1 adapter is FULLY verifiable headlessly; the browser
 * harness then judges pixels and interaction).
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import type { VisualAttributes } from "@g3t/core";
import {
  donutArcs,
  SvgAdapter,
  taperPolygon,
  trimToEllipse,
} from "./svg-adapter";

describe("geometry helpers", () => {
  it("trimToEllipse lands on the ellipse boundary along the ray", () => {
    const p = trimToEllipse({ x: 100, y: 0 }, { x: 0, y: 0 }, 20, 10);
    expect(p.x).toBeCloseTo(20, 6);
    expect(p.y).toBeCloseTo(0, 6);
    const q = trimToEllipse({ x: 0, y: 100 }, { x: 0, y: 0 }, 20, 10);
    expect(q.x).toBeCloseTo(0, 6);
    expect(q.y).toBeCloseTo(10, 6);
  });

  it("donutArcs converts fractions to circumference dasharray with cumulative rotation", () => {
    const r = 10;
    const c = 2 * Math.PI * r;
    const arcs = donutArcs(
      [
        { fraction: 0.5, color: "a" },
        { fraction: 0.25, color: "b" },
      ],
      r,
    );
    expect(arcs).toHaveLength(2);
    expect(arcs[0]!.dasharray).toBe(`${0.5 * c} ${c}`);
    expect(arcs[0]!.rotate).toBeCloseTo(-90, 6);
    expect(arcs[1]!.rotate).toBeCloseTo(0.5 * 360 - 90, 6);
    // Out-of-range fractions clamp; zero-fraction segments drop.
    expect(donutArcs([{ fraction: 0, color: "x" }], r)).toHaveLength(0);
  });

  it("taperPolygon is wide at the source and narrow at the target", () => {
    const pts = taperPolygon({ x: 0, y: 0 }, { x: 100, y: 0 }, 8, 2)
      .split(" ")
      .map((p) => p.split(",").map(Number));
    // Source-side corners at y = +-4; target-side at y = +-1.
    expect(Math.abs(pts[0]![1]!)).toBeCloseTo(4, 6);
    expect(Math.abs(pts[3]![1]!)).toBeCloseTo(4, 6);
    expect(Math.abs(pts[1]![1]!)).toBeCloseTo(1, 6);
    expect(Math.abs(pts[2]![1]!)).toBeCloseTo(1, 6);
  });
});

describe("rendered structure (every decoration channel)", () => {
  const NODES = [
    { id: "n1", x: 60, y: 60, width: 40, height: 40 },
    { id: "n2", x: 200, y: 60, width: 40, height: 40 },
  ];
  const EDGES = [{ id: "e1", source: "n1", target: "n2" }];

  function renderWith(attrs: Record<string, VisualAttributes>): HTMLElement {
    const resolved = new Map(Object.entries(attrs));
    const { container } = render(
      <SvgAdapter
        nodes={NODES}
        edges={EDGES}
        resolved={resolved}
        width={280}
        height={140}
        data-testid="svg"
      />,
    );
    return container;
  }

  it("halo renders as a ring with the contract's color and width; pulse gates the animation class", () => {
    const c = renderWith({
      n1: { halo: { color: "#e03131", width: 6 }, pulse: true },
      n2: { halo: { color: "#333333", width: 4 } },
    });
    const h1 = c.querySelector("[data-svg-halo='n1']")!;
    expect(h1.getAttribute("stroke")).toBe("#e03131");
    expect(h1.getAttribute("stroke-width")).toBe("6");
    expect(h1.getAttribute("class")).toBe("g3t-svg-pulse");
    const h2 = c.querySelector("[data-svg-halo='n2']")!;
    expect(h2.getAttribute("class")).toBeNull();
  });

  it("glyphs render in their boundary slots with truncated text", () => {
    const c = renderWith({
      n1: {
        glyphs: [
          { slot: "top-right", text: "FLAGGED", fill: "#1971c2" },
          { slot: "bottom", text: "3" },
        ],
      },
    });
    const g = c.querySelector("[data-svg-glyph='n1:top-right']")!;
    expect(g.querySelector("circle")!.getAttribute("fill")).toBe("#1971c2");
    expect(g.querySelector("text")!.textContent).toBe("FLA");
    expect(c.querySelector("[data-svg-glyph='n1:bottom']")).not.toBeNull();
  });

  it("donut renders one arc per non-empty segment", () => {
    const c = renderWith({
      n1: {
        donut: [
          { fraction: 0.6, color: "#2f9e44" },
          { fraction: 0.4, color: "#e8590c" },
        ],
      },
    });
    const arcs = c.querySelectorAll("[data-svg-donut='n1'] circle");
    expect(arcs).toHaveLength(2);
    expect(arcs[0]!.getAttribute("stroke")).toBe("#2f9e44");
  });

  it("taper renders a filled quadrilateral; gradient paints it via a shared def", () => {
    const c = renderWith({
      e1: { taper: true, gradient: { from: "#1971c2", to: "#e03131" } },
    });
    const poly = c.querySelector("[data-svg-taper='e1']")!;
    const fill = poly.getAttribute("fill")!;
    expect(fill.startsWith("url(#g3t-grad-")).toBe(true);
    const defId = fill.slice(5, -1);
    expect(c.querySelector(`linearGradient[id='${defId}']`)).not.toBeNull();
  });

  it("label halo uses the native paint-order stroke; labelVisible false drops the node's label", () => {
    const c = renderWith({
      n1: {
        labelText: "Alpha",
        labelHalo: { color: "#ffffff", width: 2 },
      },
      n2: { labelText: "Hidden", labelVisible: false },
    });
    const l1 = c.querySelector("[data-svg-label='n1']")!;
    expect(l1.getAttribute("paint-order")).toBe("stroke");
    expect(l1.getAttribute("stroke")).toBe("#ffffff");
    expect(c.querySelector("[data-svg-label='n2']")).toBeNull();
  });

  it("edges trim to node silhouettes rather than centers", () => {
    const c = renderWith({ e1: { stroke: "#666666" } });
    const line = c.querySelector("[data-svg-edge='e1'] line")!;
    // n1 center x=60, radius 20: the trimmed start sits at x=80.
    expect(Number(line.getAttribute("x1"))).toBeCloseTo(80, 4);
    expect(Number(line.getAttribute("x2"))).toBeCloseTo(180, 4);
  });
});
