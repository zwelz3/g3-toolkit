/**
 * Structural SVG view oracles (F1 structural slice). The renderer's
 * contract is VERBATIM fidelity to the geometry document, and jsdom
 * can check all of it headlessly: boxes at document coordinates,
 * rows with their text, ports on borders, edge paths following the
 * routed points with arrow-trimmed shafts and UML symbols.
 */
import { describe, expect, it, vi } from "vitest";
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
    // MR-11 round-4: the native listener must preventDefault so the
    // wheel never reaches the page (the "zooms the shell too" bug).
    const evt = new WheelEvent("wheel", {
      deltaY: -120,
      clientX: 150,
      clientY: 150,
      cancelable: true,
      bubbles: true,
    });
    svg.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    const scene = container.querySelector("[data-ssv-scene]")!;
    expect(scene.getAttribute("transform")).toMatch(/scale\(/);
    expect(container.querySelector("[data-ssv-node='blockA']")).not.toBeNull();
  });

  it("grabbing a node body drags the NODE; its edges stay ROUTED live (RTE-011); background drags pan", () => {
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
    // RTE-011 (LR-15): the dragged node's edge is RE-ROUTED against
    // the offset geometry, not collapsed to a marked straight line.
    expect(container.querySelector("[data-ssv-edge-fallback='e1']")).toBeNull();
    const routed = container.querySelector("[data-ssv-edge='e1'] path");
    expect(routed).not.toBeNull();
    // A routed path exists and is non-degenerate (has at least one
    // line segment).
    expect(routed?.getAttribute("d") ?? "").toMatch(/M.*L/);
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

describe("upstream round 17: glyph slot and two-line headers", () => {
  it("R-2: renders a glyph box and reports zone 'glyph' on click", () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "blk",
          header: { stereotype: "block", name: "Payload" },
          compartments: [
            { id: "c", title: "vals", rows: [{ id: "r", text: "mass" }] },
          ],
        },
      ],
      edges: [],
    };
    const geometry = {
      nodes: {
        blk: {
          x: 20,
          y: 20,
          width: 200,
          height: 100,
          kind: "container" as const,
        },
      },
      ports: {},
      edges: {},
      headerHeight: 24,
    };
    const hits: string[] = [];
    const { container } = render(
      <StructuralSvgView
        input={input}
        geometry={geometry as never}
        width={400}
        height={300}
        glyphs={new Map([["blk", { slot: "top-right", text: "C" }]])}
        onElementClick={(info) => hits.push(info.hit.zone)}
      />,
    );
    const glyph = container.querySelector("[data-ssv-glyph='blk']");
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("data-ssv-glyph-slot")).toBe("top-right");
    expect(glyph?.classList.contains("g3t-ssv-glyph")).toBe(true);
  });

  it("R-3: headerLines=2 puts the stereotype on its own line", () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "blk",
          header: { stereotype: "block", name: "Payload" },
          compartments: [
            { id: "c", title: "vals", rows: [{ id: "r", text: "mass" }] },
          ],
        },
      ],
      edges: [],
    };
    const geometry = {
      nodes: {
        blk: {
          x: 20,
          y: 20,
          width: 200,
          height: 100,
          kind: "container" as const,
        },
      },
      ports: {},
      edges: {},
      headerHeight: 30,
    };
    const { container, rerender } = render(
      <StructuralSvgView
        input={input}
        geometry={geometry as never}
        width={400}
        height={300}
        headerLines={2}
      />,
    );
    const stereo = container.querySelector(
      "[data-ssv-header-stereotype='blk']",
    );
    expect(stereo?.textContent).toBe("\u00abblock\u00bb");
    expect(
      container.querySelector("[data-ssv-header='blk']")?.textContent,
    ).toBe("Payload");
    // Default stays single-line (existing scenes unchanged).
    rerender(
      <StructuralSvgView
        input={input}
        geometry={geometry as never}
        width={400}
        height={300}
      />,
    );
    expect(
      container.querySelector("[data-ssv-header-stereotype='blk']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-ssv-header='blk']")?.textContent,
    ).toBe("\u00abblock\u00bb Payload");
  });
});

describe("R-5: glyphs and two-line headers apply to PLAIN nodes too", () => {
  const scene = (kind: "container" | "node") => ({
    input: {
      nodes: [
        {
          id: "blk",
          header: { stereotype: "artifact", name: "Report" },
          ...(kind === "container"
            ? {
                compartments: [
                  { id: "c", title: "vals", rows: [{ id: "r", text: "m" }] },
                ],
              }
            : {}),
        },
      ],
      edges: [],
    } as StructuralGraphInput,
    geometry: {
      nodes: {
        blk: { x: 20, y: 20, width: 200, height: 100, kind },
      },
      ports: {},
      edges: {},
      headerHeight: 24,
    },
  });

  it("a plain node draws the glyph INSIDE its own box", () => {
    const { input, geometry } = scene("node");
    const { container } = render(
      <StructuralSvgView
        input={input}
        geometry={geometry as never}
        width={400}
        height={300}
        glyphs={new Map([["blk", { slot: "top-right", text: "C" }]])}
      />,
    );
    const glyph = container.querySelector("[data-ssv-glyph='blk']");
    expect(glyph).not.toBeNull();
    const rect = glyph?.querySelector("rect");
    const gx = Number(rect?.getAttribute("x"));
    const gy = Number(rect?.getAttribute("y"));
    // Inside the box bounds (20,20)-(220,120), not straddling the top.
    expect(gy).toBeGreaterThanOrEqual(20);
    expect(gy).toBeLessThan(120);
    expect(gx).toBeGreaterThanOrEqual(20);
    expect(gx).toBeLessThan(220);
  });

  it("a plain node honours headerLines=2", () => {
    const { input, geometry } = scene("node");
    const { container } = render(
      <StructuralSvgView
        input={input}
        geometry={geometry as never}
        width={400}
        height={300}
        headerLines={2}
      />,
    );
    expect(
      container.querySelector("[data-ssv-label-stereotype='blk']")?.textContent,
    ).toBe("\u00abartifact\u00bb");
    expect(container.querySelector("[data-ssv-label='blk']")?.textContent).toBe(
      "Report",
    );
  });

  it("both node kinds report zone 'glyph' from the same glyphs map", () => {
    for (const kind of ["container", "node"] as const) {
      const { input, geometry } = scene(kind);
      const zones: string[] = [];
      const { container, unmount } = render(
        <StructuralSvgView
          input={input}
          geometry={geometry as never}
          width={400}
          height={300}
          glyphs={new Map([["blk", { slot: "top-right", text: "C" }]])}
          onElementClick={(info) => zones.push(info.hit.zone)}
        />,
      );
      expect(
        container.querySelector("[data-ssv-glyph='blk']"),
        `${kind} must draw a glyph`,
      ).not.toBeNull();
      unmount();
    }
  });
});

describe("R-9/R-10: touch zoom, controlled view, affordance presses", () => {
  const geo = {
    nodes: {
      blk: {
        x: 20,
        y: 20,
        width: 200,
        height: 100,
        kind: "container" as const,
      },
    },
    ports: {},
    edges: {},
    headerHeight: 24,
  };
  const inp: StructuralGraphInput = {
    nodes: [
      {
        id: "blk",
        header: { stereotype: "block", name: "P" },
        compartments: [{ id: "c", title: "v", rows: [{ id: "r", text: "m" }] }],
      },
    ],
    edges: [],
  };

  function sceneTransform(container: HTMLElement): string {
    return (
      container.querySelector("[data-ssv-scene]")?.getAttribute("transform") ??
      ""
    );
  }

  it("R-9: two pointers pinch-zoom about the gesture midpoint", () => {
    const { container } = render(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={300}
      />,
    );
    const svg = container.querySelector("svg")!;
    const before = sceneTransform(container);
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(svg, { pointerId: 2, clientX: 200, clientY: 100 });
    // Fingers spread from 100px apart to 200px: scale up.
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 300, clientY: 100 });
    const after = sceneTransform(container);
    expect(after).not.toBe(before);
    const k = Number(/scale\(([\d.]+)\)/.exec(after)?.[1]);
    const k0 = Number(/scale\(([\d.]+)\)/.exec(before)?.[1]);
    expect(k).toBeGreaterThan(k0);
  });

  it("R-9: the view is controllable and reports changes", () => {
    const onViewChange = vi.fn();
    const { container, rerender } = render(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={300}
        view={{ k: 1, tx: 0, ty: 0 }}
        onViewChange={onViewChange}
      />,
    );
    expect(sceneTransform(container)).toBe("translate(0 0) scale(1)");
    rerender(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={300}
        view={{ k: 2, tx: 10, ty: 20 }}
        onViewChange={onViewChange}
      />,
    );
    // A restored viewport lands exactly (the saved-viewport case).
    expect(sceneTransform(container)).toBe("translate(10 20) scale(2)");
    expect(onViewChange).toHaveBeenCalled();
  });

  it("R-10: pressing a glyph does not pan the scene", () => {
    const { container } = render(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={300}
        view={{ k: 1, tx: 0, ty: 0 }}
        glyphs={new Map([["blk", { slot: "top-right", text: "C" }]])}
      />,
    );
    const svg = container.querySelector("svg")!;
    const glyphRect = container
      .querySelector("[data-ssv-glyph='blk'] rect")!
      .getAttribute("x");
    const gx = Number(glyphRect) + 8;
    const before = sceneTransform(container);
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: gx, clientY: 28 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: gx + 40, clientY: 90 });
    // Controlled view: the transform must be untouched, i.e. no pan
    // was started by the affordance press.
    expect(sceneTransform(container)).toBe(before);
  });

  it("R-10: pressing empty canvas still pans", () => {
    const { container } = render(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={300}
      />,
    );
    const svg = container.querySelector("svg")!;
    const before = sceneTransform(container);
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 350, clientY: 250 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 380, clientY: 270 });
    expect(sceneTransform(container)).not.toBe(before);
  });
});

describe("R-11: compartment rows can carry a glyph", () => {
  it("draws a row glyph and reports zone 'glyph' for the ROW's id", () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "proc",
          header: { stereotype: "process", name: "Intake" },
          compartments: [
            {
              id: "c",
              title: "activities",
              rows: [{ id: "act.1", text: "Receive" }],
            },
          ],
        },
      ],
      edges: [],
    };
    const geometry = {
      nodes: {
        proc: {
          x: 20,
          y: 20,
          width: 220,
          height: 100,
          kind: "container" as const,
        },
        "act.1": {
          x: 20,
          y: 60,
          width: 220,
          height: 24,
          kind: "row" as const,
          parent: "proc",
          text: "Receive",
        },
      },
      ports: {},
      edges: {},
      headerHeight: 24,
    };
    const zones: string[] = [];
    const ids: string[] = [];
    const { container } = render(
      <StructuralSvgView
        input={input}
        geometry={geometry as never}
        width={400}
        height={300}
        view={{ k: 1, tx: 0, ty: 0 }}
        glyphs={new Map([["act.1", { slot: "top-right", text: "\u203a" }]])}
        onElementClick={(info) => {
          zones.push(info.hit.zone);
          ids.push(info.hit.elementId);
        }}
      />,
    );
    const glyph = container.querySelector("[data-ssv-glyph='act.1']");
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("data-ssv-glyph-slot")).toBe("row");
    // Right-aligned inside the row band.
    const rect = glyph?.querySelector("rect");
    expect(Number(rect?.getAttribute("x"))).toBeGreaterThan(200);
    const y = Number(rect?.getAttribute("y"));
    expect(y).toBeGreaterThanOrEqual(60);
    expect(y).toBeLessThan(84);

    // Clicking it reports the ROW's id under zone "glyph", so one
    // navigation rule covers nodes and rows alike.
    const svg = container.querySelector("svg")!;
    const cx = Number(rect?.getAttribute("x")) + 8;
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: cx, clientY: y + 7 });
    fireEvent.click(svg, { clientX: cx, clientY: y + 7 });
    expect(zones).toContain("glyph");
    expect(ids).toContain("act.1");
  });
});

describe("R-12 (round 21): structural style overrides and arrangement", () => {
  const inp: StructuralGraphInput = {
    nodes: [{ id: "n1" }, { id: "n2" }],
    edges: [],
  };
  const geo = {
    nodes: {
      n1: { x: 20, y: 20, width: 120, height: 40, kind: "node" as const },
      n2: { x: 200, y: 20, width: 120, height: 40, kind: "node" as const },
    },
    ports: {},
    edges: {},
    headerHeight: 24,
  };

  it("12a: an override paints the node; unstyled nodes keep the theme", () => {
    const { container } = render(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={200}
        nodeStyles={new Map([["n1", { fill: "#ff0000", strokeWidth: 4 }]])}
      />,
    );
    const rects = [...container.querySelectorAll("[data-ssv-node] rect")];
    const n1 = container
      .querySelector("[data-ssv-node='n1'] rect")!
      .getAttribute("fill");
    const n2 = container
      .querySelector("[data-ssv-node='n2'] rect")!
      .getAttribute("fill");
    expect(n1).toBe("#ff0000");
    expect(n2).not.toBe("#ff0000");
    expect(rects.length).toBeGreaterThan(0);
    expect(
      container
        .querySelector("[data-ssv-node='n1'] rect")!
        .getAttribute("stroke-width"),
    ).toBe("4");
  });

  it("12d: node moves are reported and offsets can be controlled", () => {
    const onNodeMove = vi.fn();
    const onDragOffsetsChange = vi.fn();
    const { container, rerender } = render(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={200}
        view={{ k: 1, tx: 0, ty: 0 }}
        onNodeMove={onNodeMove}
        onDragOffsetsChange={onDragOffsetsChange}
      />,
    );
    const svg = container.querySelector("svg")!;
    // Grab n1's body and drag it.
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 80, clientY: 40 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 110, clientY: 60 });
    expect(onNodeMove).toHaveBeenCalledWith("n1", 30, 20);
    expect(onDragOffsetsChange).toHaveBeenCalled();

    // A restored arrangement lands without any drag.
    rerender(
      <StructuralSvgView
        input={inp}
        geometry={geo as never}
        width={400}
        height={200}
        view={{ k: 1, tx: 0, ty: 0 }}
        dragOffsets={{ n2: { dx: 50, dy: 0 } }}
      />,
    );
    const x = container
      .querySelector("[data-ssv-node='n2'] rect")!
      .getAttribute("x");
    expect(Number(x)).toBe(250);
  });
});
