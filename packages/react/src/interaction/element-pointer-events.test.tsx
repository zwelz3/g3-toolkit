/**
 * INT-001 oracles: the SAME handler contract across SvgAdapter,
 * CanvasAdapter, and StructuralSvgView. jsdom's zeroed bounding
 * rects make client coordinates equal element-local coordinates,
 * which is exactly what these dispatch tests need.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import type {
  SceneHit,
  StructuralGeometry,
  StructuralGraphInput,
  VisualAttributes,
} from "@g3t/core";
import { SvgAdapter } from "../views/svg/svg-adapter";
import { CanvasAdapter } from "../views/canvas2d/canvas-adapter";
import { StructuralSvgView } from "../views/svg/structural-svg-view";

const NODES = [{ id: "n1", x: 100, y: 100, width: 60, height: 60 }];
const RESOLVED = new Map<string, VisualAttributes>([
  ["n1", { shape: "rectangle", glyphs: [{ slot: "top-right", text: "2" }] }],
]);

describe.each([
  {
    name: "SvgAdapter",
    mount: (onElementClick: (i: { hit: SceneHit }) => void) =>
      render(
        <SvgAdapter
          nodes={NODES}
          edges={[]}
          resolved={RESOLVED}
          width={300}
          height={300}
          data-testid="t"
          onElementClick={onElementClick}
        />,
      ),
  },
  {
    name: "CanvasAdapter",
    mount: (onElementClick: (i: { hit: SceneHit }) => void) =>
      render(
        <CanvasAdapter
          nodes={NODES}
          edges={[]}
          resolved={RESOLVED}
          width={300}
          height={300}
          data-testid="t"
          onElementClick={onElementClick}
        />,
      ),
  },
])("INT-001 flat scene: $name", ({ mount }) => {
  it("click on the body dispatches with zone info; glyph zone outranks; misses stay silent", () => {
    const onClick = vi.fn();
    const { getByTestId } = mount(onClick);
    const el = getByTestId("t");
    fireEvent.click(el, { clientX: 100, clientY: 100 });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0]?.hit).toEqual({
      elementId: "n1",
      kind: "node",
      zone: "body",
    });
    // Glyph at (100 + 0.7*30, 100 - 0.7*30) = (121, 79).
    fireEvent.click(el, { clientX: 121, clientY: 79 });
    expect(onClick.mock.calls[1]?.[0]?.hit.zone).toBe("glyph");
    fireEvent.click(el, { clientX: 280, clientY: 280 });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("enter/leave fire on hit-key changes during pointer movement", () => {
    const enter = vi.fn();
    const leave = vi.fn();
    const { getByTestId } = render(
      <SvgAdapter
        nodes={NODES}
        edges={[]}
        resolved={RESOLVED}
        width={300}
        height={300}
        data-testid="el"
        onElementEnter={enter}
        onElementLeave={leave}
      />,
    );
    const el = getByTestId("el");
    fireEvent.pointerMove(el, { clientX: 100, clientY: 100 });
    expect(enter).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(el, { clientX: 102, clientY: 100 });
    expect(enter).toHaveBeenCalledTimes(1); // same key, no re-enter
    fireEvent.pointerMove(el, { clientX: 280, clientY: 280 });
    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave.mock.calls[0]?.[0]?.hit.elementId).toBe("n1");
  });
});

describe("INT-001 structural view (transform-aware)", () => {
  const input: StructuralGraphInput = {
    nodes: [
      {
        id: "box",
        header: { stereotype: "Block", name: "Box" },
        compartments: [{ id: "c0", rows: [{ id: "r1", text: "x" }] }],
      },
    ],
    edges: [],
  };
  // Bounding box width = 640 - 2*32 so the fit scale is exactly 1
  // and the translation is exactly (32, ...): the model->screen map
  // is then screen = model + 32 horizontally.
  const geometry: StructuralGeometry = {
    version: 1,
    headerHeight: 24,
    nodes: {
      box: { x: 0, y: 0, width: 576, height: 356, kind: "container" },
    },
    ports: {},
    edges: {},
  };

  it("clicks resolve through the inverse view transform with structural zones", () => {
    const onClick = vi.fn();
    const { getByTestId } = render(
      <StructuralSvgView
        input={input}
        geometry={geometry}
        width={640}
        height={420}
        data-testid="ssv"
        onElementClick={onClick}
      />,
    );
    const el = getByTestId("ssv");
    // Model (100, 12) is in the header band; screen = (132, 44).
    fireEvent.click(el, { clientX: 132, clientY: 44 });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0]?.hit).toEqual({
      elementId: "box",
      kind: "node",
      zone: "header",
    });
    // Model (100, 200): body. Screen (132, 232).
    fireEvent.click(el, { clientX: 132, clientY: 232 });
    expect(onClick.mock.calls[1]?.[0]?.hit.zone).toBe("body");
  });
});
