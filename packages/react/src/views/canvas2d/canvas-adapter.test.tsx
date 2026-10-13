/**
 * CanvasAdapter rasterization (issue #9). jsdom returns null from
 * `getContext("2d")`, so without this file the module-private
 * `paint()` never ran under the unit suite: the ARC-008 conformance
 * tests cover WHAT is drawn (the DrawOp list), nothing covered HOW the
 * ops reach the 2D context. Here `getContext` is spied on the
 * prototype to hand back a recording fake, which reaches paint()
 * through the component with no test seam in the source (the `canvas`
 * npm package stays out: pnpm-workspace.yaml `allowBuilds` rejects it
 * on purpose, and a real raster still would not assert the calls).
 *
 * Expectations are derived from buildDisplayList on the same scene,
 * so geometry (trimmed edge endpoints, donut angles) is never copied
 * by hand into this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { VisualAttributes } from "@g3-toolkit/core";
import { CanvasAdapter } from "./canvas-adapter";
import { buildDisplayList, type DrawOp } from "./display-list";

interface Call {
  name: string;
  args: unknown[];
}

interface Recorded {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
  gradients: Array<{ args: unknown[]; stops: Array<[number, string]> }>;
}

/** A 2D context that records every method call (by name) and every
 *  property assignment (as `set:<prop>`), in order. createLinearGradient
 *  returns a stop-recording stub so the gradient contents are visible. */
function recordingContext(): Recorded {
  const calls: Call[] = [];
  const gradients: Recorded["gradients"] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, prop) {
      if (prop === "createLinearGradient") {
        return (...args: unknown[]) => {
          const g = { args, stops: [] as Array<[number, string]> };
          gradients.push(g);
          calls.push({ name: "createLinearGradient", args });
          return {
            addColorStop: (offset: number, color: string) => {
              g.stops.push([offset, color]);
            },
          };
        };
      }
      return (...args: unknown[]) => {
        calls.push({ name: String(prop), args });
      };
    },
    set(_target, prop, value) {
      calls.push({ name: `set:${String(prop)}`, args: [value] });
      return true;
    },
  });
  return { ctx, calls, gradients };
}

const names = (calls: Call[], name: string): Call[] =>
  calls.filter((c) => c.name === name);

function setDpr(value: number): void {
  Object.defineProperty(window, "devicePixelRatio", {
    value,
    configurable: true,
    writable: true,
  });
}

const NODES = [
  { id: "a", x: 100, y: 60, width: 40, height: 30 },
  { id: "b", x: 300, y: 60, width: 40, height: 30 },
  { id: "c", x: 200, y: 200, width: 50, height: 50 },
  { id: "d", x: 320, y: 220, width: 36, height: 36 },
] as const;

const EDGES = [
  { id: "ab", source: "a", target: "b" },
  { id: "bc", source: "b", target: "c" },
  { id: "cd", source: "c", target: "d" },
] as const;

/** One scene that reaches every DrawOp kind and both gradient sites. */
function fullScene(): {
  nodes: typeof NODES;
  edges: typeof EDGES;
  resolved: Map<string, VisualAttributes>;
} {
  const resolved = new Map<string, VisualAttributes>([
    [
      "a",
      {
        shape: "rectangle",
        fill: "#111111",
        halo: { color: "#ff0000", width: 6 },
        gradient: { from: "#aa0000", to: "#00aa00" },
        labelText: "A",
        labelHalo: { color: "#000000", width: 2 },
      },
    ],
    [
      "b",
      {
        shape: "round-rectangle",
        donut: [
          { fraction: 0.5, color: "#0000ff" },
          { fraction: 0.5, color: "#00ffff" },
        ],
        glyphs: [{ slot: "top-right", text: "!" }],
        labelText: "B",
      },
    ],
    ["c", { shape: "diamond", opacity: 0.5 }],
    ["d", { shape: "triangle", labelText: "D", labelVisible: false }],
    ["ab", { strokeDash: [4, 2] }],
    ["bc", { gradient: { from: "#123456", to: "#654321" } }],
    ["cd", { taper: true, gradient: { from: "#010101", to: "#020202" } }],
  ]);
  return { nodes: NODES, edges: EDGES, resolved };
}

describe("CanvasAdapter paint (recorded 2D context)", () => {
  let rec: Recorded;
  let getContext: ReturnType<typeof vi.spyOn>;
  const originalDpr = window.devicePixelRatio;

  beforeEach(() => {
    rec = recordingContext();
    getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => rec.ctx as never);
  });

  afterEach(() => {
    getContext.mockRestore();
    setDpr(originalDpr);
  });

  it("sizes the bitmap by devicePixelRatio and applies the transform once per paint", () => {
    setDpr(2);
    const scene = fullScene();
    const { container, rerender } = render(
      <CanvasAdapter
        {...scene}
        width={400}
        height={300}
        background="#0b1120"
      />,
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    const ops = buildDisplayList(scene);
    expect(ops.length).toBeGreaterThan(5);
    // Once per paint, not once per op.
    expect(names(rec.calls, "setTransform")).toEqual([
      { name: "setTransform", args: [2, 0, 0, 2, 0, 0] },
    ]);
    // The transform carries the scale, so clear/background stay in CSS px.
    expect(names(rec.calls, "clearRect")[0]?.args).toEqual([0, 0, 400, 300]);
    expect(names(rec.calls, "fillRect")[0]?.args).toEqual([0, 0, 400, 300]);
    expect(rec.calls[0]).toEqual({
      name: "setTransform",
      args: [2, 0, 0, 2, 0, 0],
    });
    // A second render paints again (and only once more).
    rerender(
      <CanvasAdapter {...scene} width={400} height={300} background="#000" />,
    );
    expect(names(rec.calls, "setTransform")).toHaveLength(2);
    expect(names(rec.calls, "clearRect")).toHaveLength(2);
  });

  it("skips the background fill when none is given", () => {
    const scene = fullScene();
    render(<CanvasAdapter {...scene} width={400} height={300} />);
    expect(names(rec.calls, "clearRect")).toHaveLength(1);
    expect(names(rec.calls, "fillRect")).toHaveLength(0);
  });

  it("a gradient node fill spans the op's x extents with both stops", () => {
    const scene = fullScene();
    render(<CanvasAdapter {...scene} width={400} height={300} />);
    const shapeA = buildDisplayList(scene).find(
      (op): op is Extract<DrawOp, { kind: "shape" }> =>
        op.kind === "shape" && op.id === "a",
    );
    expect(shapeA?.gradient).toEqual({ from: "#aa0000", to: "#00aa00" });
    const g = rec.gradients.find((x) => x.stops[0]?.[1] === "#aa0000");
    expect(g?.args).toEqual([
      shapeA!.x - shapeA!.width / 2,
      shapeA!.y,
      shapeA!.x + shapeA!.width / 2,
      shapeA!.y,
    ]);
    expect(g?.stops).toEqual([
      [0, "#aa0000"],
      [1, "#00aa00"],
    ]);
    // The gradient object itself becomes the fill paint.
    const setFill = rec.calls.find(
      (c) => c.name === "set:fillStyle" && typeof c.args[0] === "object",
    );
    expect(setFill).toBeDefined();
  });

  it("a gradient edge runs between the trimmed endpoints; a taper's between p1 and p2", () => {
    const scene = fullScene();
    render(<CanvasAdapter {...scene} width={400} height={300} />);
    const ops = buildDisplayList(scene);
    const edge = ops.find(
      (op): op is Extract<DrawOp, { kind: "edge" }> =>
        op.kind === "edge" && op.id === "bc",
    )!;
    const [p1, p2] = edge.points;
    const gEdge = rec.gradients.find((x) => x.stops[0]?.[1] === "#123456");
    expect(gEdge?.args).toEqual([p1!.x, p1!.y, p2!.x, p2!.y]);
    expect(gEdge?.stops).toEqual([
      [0, "#123456"],
      [1, "#654321"],
    ]);
    const taper = ops.find(
      (op): op is Extract<DrawOp, { kind: "taper" }> => op.kind === "taper",
    )!;
    const gTaper = rec.gradients.find((x) => x.stops[0]?.[1] === "#010101");
    expect(gTaper?.args).toEqual([
      taper.p1.x,
      taper.p1.y,
      taper.p2.x,
      taper.p2.y,
    ]);
    // Three gradient sites in the scene, three gradients created.
    expect(rec.gradients).toHaveLength(3);
  });

  it("a halo fills at reduced alpha and restores globalAlpha to 1 before the next op", () => {
    const scene = fullScene();
    render(<CanvasAdapter {...scene} width={400} height={300} />);
    const halo = buildDisplayList(scene).find(
      (op): op is Extract<DrawOp, { kind: "halo" }> => op.kind === "halo",
    )!;
    const i = rec.calls.findIndex(
      (c) =>
        c.name === "ellipse" &&
        c.args[0] === halo.x &&
        c.args[2] === halo.rx &&
        c.args[3] === halo.ry,
    );
    expect(i).toBeGreaterThan(-1);
    const after = rec.calls.slice(i + 1, i + 5).map((c) => [c.name, c.args]);
    expect(after).toEqual([
      ["set:fillStyle", ["#ff0000"]],
      ["set:globalAlpha", [0.35]],
      ["fill", []],
      ["set:globalAlpha", [1]],
    ]);
  });

  it("node opacity rides globalAlpha for the body and is reset after the stroke", () => {
    const scene = fullScene();
    render(<CanvasAdapter {...scene} width={400} height={300} />);
    const i = rec.calls.findIndex(
      (c) => c.name === "set:globalAlpha" && c.args[0] === 0.5,
    );
    expect(i).toBeGreaterThan(-1);
    const rest = rec.calls.slice(i + 1).map((c) => c.name);
    const resetAt = rest.indexOf("set:globalAlpha");
    expect(rest.slice(0, resetAt)).toEqual([
      "fill",
      "set:strokeStyle",
      "set:lineWidth",
      "setLineDash",
      "stroke",
      "setLineDash",
    ]);
    expect(rec.calls[i + 1 + resetAt]?.args).toEqual([1]);
  });

  it("each op kind reaches its path primitive", () => {
    const scene = fullScene();
    render(<CanvasAdapter {...scene} width={400} height={300} />);
    const ops = buildDisplayList(scene);
    const kinds = new Set(ops.map((o) => o.kind));
    expect([...kinds].sort()).toEqual([
      "donut-arc",
      "edge",
      "glyph",
      "halo",
      "label",
      "shape",
      "taper",
    ]);
    const count = (name: string) => names(rec.calls, name).length;
    // Shapes: rectangle -> rect, round-rectangle -> roundRect, diamond
    // and triangle -> polygon paths closed with closePath; the taper
    // polygon closes too.
    expect(count("rect")).toBe(1);
    expect(count("roundRect")).toBe(1);
    const polygonOps = ops.filter(
      (o) =>
        (o.kind === "shape" &&
          (o.shape === "diamond" || o.shape === "triangle")) ||
        o.kind === "taper",
    );
    expect(count("closePath")).toBe(polygonOps.length);
    // Halo is the only ellipse (every node declares a non-ellipse shape).
    expect(count("ellipse")).toBe(ops.filter((o) => o.kind === "halo").length);
    expect(count("arc")).toBe(ops.filter((o) => o.kind === "donut-arc").length);
    const textOps = ops.filter((o) => o.kind === "glyph" || o.kind === "label");
    expect(count("fillText")).toBe(textOps.length);
    expect(count("strokeText")).toBe(
      ops.filter((o) => o.kind === "label" && o.halo !== undefined).length,
    );
    // The hidden label (labelVisible false) never becomes text.
    expect(names(rec.calls, "fillText").some((c) => c.args[0] === "D")).toBe(
      false,
    );
    // The dashed edge sets its dash and clears it afterwards.
    const dashes = names(rec.calls, "setLineDash").map((c) => c.args[0]);
    expect(dashes).toContainEqual([4, 2]);
    expect(dashes[dashes.length - 1]).toEqual([]);
  });

  it("stays inert without a 2D context (the jsdom default) but still reports ops", () => {
    getContext.mockImplementation(() => null);
    const scene = fullScene();
    const { container } = render(
      <CanvasAdapter {...scene} width={400} height={300} />,
    );
    expect(rec.calls).toHaveLength(0);
    const canvas = container.querySelector("canvas");
    expect(Number(canvas?.getAttribute("data-g3t-ops"))).toBe(
      buildDisplayList(scene).length,
    );
  });
});
