/**
 * Structural SVG view oracles (F1 structural slice). The renderer's
 * contract is VERBATIM fidelity to the geometry document, and jsdom
 * can check all of it headlessly: boxes at document coordinates,
 * rows with their text, ports on borders, edge paths following the
 * routed points with arrow-trimmed shafts and UML symbols.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import type { StructuralGeometry, StructuralGraphInput } from "@g3t/core";
import { StructuralSvgView } from "./structural-svg-view";

const INPUT: StructuralGraphInput = {
  nodes: [
    {
      id: "blockA",
      header: { stereotype: "Block", name: "Alpha" },
      compartments: [
        {
          id: "blockA.c0",
          title: "values",
          rows: [{ id: "r1", text: "mass: kg" }],
        },
      ],
    },
    { id: "plainB", header: { name: "Beta" }, width: 100, height: 40 },
  ],
  edges: [
    {
      id: "e1",
      source: "blockA",
      target: "plainB",
      kind: "composition",
      label: "owns",
    },
  ],
};

const GEOMETRY: StructuralGeometry = {
  version: 1,
  headerHeight: 24,
  nodes: {
    blockA: { x: 10, y: 10, width: 160, height: 120, kind: "container" },
    "blockA.c0.title": {
      x: 14,
      y: 40,
      width: 152,
      height: 14,
      kind: "row",
      parent: "blockA",
      text: "values",
      divider: true,
    },
    r1: {
      x: 14,
      y: 56,
      width: 152,
      height: 16,
      kind: "row",
      parent: "blockA",
      compartment: "blockA.c0",
      text: "mass: kg",
    },
    plainB: {
      x: 300,
      y: 40,
      width: 100,
      height: 40,
      kind: "node",
      text: "Beta",
    },
  },
  ports: {
    p1: { node: "blockA", side: "EAST", x: 166, y: 60, width: 8, height: 8 },
  },
  edges: {
    e1: {
      points: [
        { x: 170, y: 64 },
        { x: 240, y: 64 },
        { x: 240, y: 60 },
        { x: 300, y: 60 },
      ],
    },
  },
};

function renderView() {
  const { container } = render(
    <StructuralSvgView
      input={INPUT}
      geometry={GEOMETRY}
      width={640}
      height={400}
      data-testid="ssv"
    />,
  );
  return container;
}

describe("StructuralSvgView", () => {
  it("renders containers at document coordinates with the header strip and stereotyped title", () => {
    const c = renderView();
    const node = c.querySelector("[data-ssv-node='blockA']")!;
    const body = node.querySelector("rect")!;
    expect(body.getAttribute("x")).toBe("10");
    expect(body.getAttribute("width")).toBe("160");
    const header = c.querySelector("[data-ssv-header='blockA']")!;
    expect(header.textContent).toBe("\u00abBlock\u00bb Alpha");
    // Header strip uses the document's headerHeight.
    const strip = node.querySelectorAll("rect")[1]!;
    expect(strip.getAttribute("height")).toBe("24");
  });

  it("renders rows with their text; divider rows styled as titles", () => {
    const c = renderView();
    const row = c.querySelector("[data-ssv-row='r1']")!;
    expect(row.textContent).toBe("mass: kg");
    const divider = c.querySelector("[data-ssv-row='blockA.c0.title']")!;
    expect(divider.getAttribute("font-style")).toBe("italic");
  });

  it("edge path follows the routed points with the shaft trimmed for the composition diamond", () => {
    const c = renderView();
    const path = c.querySelector("[data-ssv-edge-path='e1']")!;
    const d = path.getAttribute("d")!;
    // Route END (target side, no symbol there for composition)
    // remains exact; the SOURCE end is trimmed for the diamond, so
    // the first x is GREATER than the untrimmed 170.
    expect(d.endsWith("L300 60")).toBe(true);
    const firstX = Number(d.slice(1).split(" ")[0]);
    expect(firstX).toBeGreaterThan(170);
    // Composition: filled diamond at the SOURCE end.
    const arrow = c.querySelector("[data-ssv-arrow='e1:source']")!;
    expect(arrow.getAttribute("fill")).not.toBe("none");
    // Mid-edge label present.
    expect(c.querySelector("[data-ssv-edge-label='e1']")!.textContent).toBe(
      "owns",
    );
  });

  it("renders ports at their absolute boxes", () => {
    const c = renderView();
    const port = c.querySelector("[data-ssv-port='p1']")!;
    expect(port.getAttribute("x")).toBe("166");
    expect(port.getAttribute("width")).toBe("8");
  });

  it("dependency edges render dashed", () => {
    const { container } = render(
      <StructuralSvgView
        input={{
          nodes: INPUT.nodes,
          edges: [
            {
              id: "e2",
              source: "blockA",
              target: "plainB",
              kind: "dependency",
            },
          ],
        }}
        geometry={{
          ...GEOMETRY,
          edges: { e2: GEOMETRY.edges!.e1! },
        }}
        width={640}
        height={400}
      />,
    );
    const path = container.querySelector("[data-ssv-edge-path='e2']")!;
    expect(path.getAttribute("stroke-dasharray")).toBe("6 4");
  });
});

describe("MR-11 round-3 regressions", () => {
  it("wheel zoom does not crash after the handler returns (currentTarget capture)", () => {
    const { container } = render(
      <StructuralSvgView
        input={INPUT}
        geometry={GEOMETRY}
        width={640}
        height={400}
        data-testid="z"
      />,
    );
    const svg = container.querySelector("svg")!;
    // Two zooms + a re-render tick; the round-32 code threw inside
    // the deferred state updater here and unmounted the tree.
    fireEvent.wheel(svg, { deltaY: -120, clientX: 200, clientY: 150 });
    fireEvent.wheel(svg, { deltaY: 120, clientX: 100, clientY: 100 });
    const scene = container.querySelector("[data-ssv-scene]")!;
    expect(scene.getAttribute("transform")).toMatch(/scale\(/);
    expect(container.querySelector("[data-ssv-node='blockA']")).not.toBeNull();
  });

  it("grabbing a node body drags the NODE (its edges fall back straight); background drags pan", () => {
    const { container } = render(
      <StructuralSvgView
        input={INPUT}
        geometry={GEOMETRY}
        width={640}
        height={400}
        data-testid="d"
      />,
    );
    const svg = container.querySelector("svg")!;
    // jsdom lacks setPointerCapture; stub it.
    (svg as unknown as { setPointerCapture: () => void }).setPointerCapture =
      () => {};
    const before = container
      .querySelector("[data-ssv-node='plainB'] rect")!
      .getAttribute("x");
    // Fit for this geometry/viewport: k = min(576/390, 380/150, 1.5)
    // is not needed exactly; read the transform to compute screen
    // coords of plainB's center (350, 60 model).
    const scene = container.querySelector("[data-ssv-scene]")!;
    const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(
      scene.getAttribute("transform") ?? "",
    )!;
    const [tx, ty, k] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const sx = 350 * k + tx;
    const sy = 60 * k + ty;
    fireEvent.pointerDown(svg, { clientX: sx, clientY: sy, pointerId: 1 });
    fireEvent.pointerMove(svg, {
      clientX: sx + 30,
      clientY: sy,
      pointerId: 1,
    });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    const after = container
      .querySelector("[data-ssv-node='plainB'] rect")!
      .getAttribute("x");
    expect(Number(after)).toBeGreaterThan(Number(before));
    // The dragged node's edge fell back to a straight marked line.
    expect(
      container.querySelector("[data-ssv-edge-fallback='e1']"),
    ).not.toBeNull();
    // The view itself did NOT pan during the node drag.
    expect(scene.getAttribute("transform")).toContain(`translate(${tx} ${ty}`);
    // Background drag DOES pan.
    fireEvent.pointerDown(svg, { clientX: 630, clientY: 390, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: 600, clientY: 390, pointerId: 2 });
    fireEvent.pointerUp(svg, { pointerId: 2 });
    expect(scene.getAttribute("transform")).not.toContain(
      `translate(${tx} ${ty}`,
    );
  });
});
