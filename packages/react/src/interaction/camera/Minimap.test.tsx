/**
 * jsdom has no 2D canvas context, so the drawing path is inert in the
 * first block; the pan math is covered by cameraController.test.ts.
 * Those tests cover the component contract: structure, the disabled
 * placeholder, sizing, and the render-event subscription lifecycle.
 * The second block installs a recording context so the paint path
 * runs too (issue #9).
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Core } from "cytoscape";
import { Minimap } from "./Minimap";
import { resetCoreHandleWarnings } from "../core-handle";
import { useThemeStore } from "../../theme/ThemeManager";

function mockCore() {
  const on = vi.fn();
  const off = vi.fn();
  const destroyed = vi.fn(() => false);
  return { core: { on, off, destroyed } as unknown as Core, on, off };
}

describe("Minimap", () => {
  it("renders a labeled region", () => {
    const { core } = mockCore();
    render(<Minimap core={core} ariaLabel="Overview" />);
    expect(screen.getByTestId("minimap")).toBeInTheDocument();
    expect(screen.getByLabelText("Overview")).toBeInTheDocument();
  });

  it("is a dimmed placeholder with no core", () => {
    render(<Minimap core={null} />);
    expect(screen.getByTestId("minimap")).toHaveAttribute("data-disabled");
  });

  it("is enabled once a core is provided", () => {
    const { core } = mockCore();
    render(<Minimap core={core} />);
    expect(screen.getByTestId("minimap")).not.toHaveAttribute("data-disabled");
  });

  it("subscribes to the canvas render event and cleans up on unmount", () => {
    const { core, on, off } = mockCore();
    const { unmount } = render(<Minimap core={core} />);
    expect(on).toHaveBeenCalledWith("render", expect.any(Function));
    unmount();
    expect(off).toHaveBeenCalledWith("render", expect.any(Function));
  });

  it("applies the configured width and height", () => {
    const { core } = mockCore();
    render(<Minimap core={core} width={120} height={90} />);
    const el = screen.getByTestId("minimap");
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("90px");
  });

  it("does not throw on pointer interaction while disabled", () => {
    render(<Minimap core={null} />);
    const canvas = screen.getByTestId("minimap").querySelector("canvas");
    expect(canvas).not.toBeNull();
    if (canvas) {
      expect(() =>
        fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 }),
      ).not.toThrow();
    }
  });
});

// Issue #18 (maintainer ruling 2026-10-13): the handle prop is `core`
// everywhere; `cy` survives one major as a deprecated alias.
describe("handle prop: core is canonical, cy a deprecated alias (issue #18)", () => {
  beforeEach(() => resetCoreHandleWarnings());

  it("core subscribes with no warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { core, on } = mockCore();
    render(<Minimap core={core} />);
    expect(on).toHaveBeenCalledWith("render", expect.any(Function));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("cy is accepted, enables the minimap, and warns ONCE in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { core, on } = mockCore();
    const { rerender } = render(<Minimap cy={core} />);
    rerender(<Minimap cy={core} />);
    render(<Minimap cy={mockCore().core} />);
    expect(on).toHaveBeenCalledWith("render", expect.any(Function));
    expect(screen.getAllByTestId("minimap")[0]).not.toHaveAttribute(
      "data-disabled",
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/Minimap.*`cy`.*deprecated/);
    warn.mockRestore();
  });

  it("when both are given, core wins and cy is ignored (no warning)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = mockCore();
    const b = mockCore();
    render(<Minimap core={a.core} cy={b.core} />);
    expect(a.on).toHaveBeenCalledWith("render", expect.any(Function));
    expect(b.on).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("omitting both is the disabled placeholder", () => {
    render(<Minimap />);
    expect(screen.getByTestId("minimap")).toHaveAttribute("data-disabled");
  });
});

/**
 * Paint path (issue #9). The default jsdom context is null, which is
 * why the block above never sees a draw call. Spying getContext on the
 * prototype hands the component a recording context so the painter
 * runs end to end against a fake core: bitmap sizing by dpr, the
 * background wash, one edge segment, one mark per top-level node (dot
 * or compound rectangle), the viewport indicator, and alpha restored.
 */
interface Call {
  name: string;
  args: unknown[];
}

function recordingContext(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get:
      (_t, prop) =>
      (...args: unknown[]) => {
        calls.push({ name: String(prop), args });
      },
    set(_t, prop, value) {
      calls.push({ name: `set:${String(prop)}`, args: [value] });
      return true;
    },
  });
  return { ctx, calls };
}

interface FakeNodeSpec {
  id: string;
  x: number;
  y: number;
  parent?: string;
  /** Model-space box for a compound container. */
  box?: { x1: number; y1: number; x2: number; y2: number };
}

/** The slice of the cytoscape Core the painter reads: nodes (with the
 *  :orphan selector), edges, the element bounding box, and the extent. */
function fakeCore(specs: FakeNodeSpec[], edgePairs: Array<[string, string]>) {
  type FakeNode = {
    id: () => string;
    position: () => { x: number; y: number };
    parent: () => FakeNode[];
    isParent: () => boolean;
    boundingBox: () => {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      w: number;
      h: number;
    };
  };
  const byId = new Map<string, FakeNode>();
  for (const s of specs) {
    byId.set(s.id, {
      id: () => s.id,
      position: () => ({ x: s.x, y: s.y }),
      parent: () => {
        const p = s.parent ? byId.get(s.parent) : undefined;
        return p ? [p] : [];
      },
      isParent: () => specs.some((o) => o.parent === s.id),
      boundingBox: () => {
        const b = s.box ?? { x1: s.x, y1: s.y, x2: s.x, y2: s.y };
        return { ...b, w: b.x2 - b.x1, h: b.y2 - b.y1 };
      },
    });
  }
  const all = [...byId.values()];
  const xs = specs.map((s) => s.x);
  const ys = specs.map((s) => s.y);
  const bbox = {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
  const extent = { x1: -50, y1: -50, x2: 350, y2: 250, w: 400, h: 300 };
  const edges = edgePairs.map(([s, t]) => ({
    source: () => byId.get(s)!,
    target: () => byId.get(t)!,
  }));
  const core = {
    on: vi.fn(),
    off: vi.fn(),
    destroyed: () => false,
    nodes: (selector?: string) =>
      selector === ":orphan" ? all.filter((n) => n.parent().length === 0) : all,
    edges: () => edges,
    elements: () => ({
      boundingBox: () => ({
        ...bbox,
        w: bbox.x2 - bbox.x1,
        h: bbox.y2 - bbox.y1,
      }),
    }),
    extent: () => extent,
  };
  return core as unknown as Core;
}

describe("Minimap paint (recorded 2D context)", () => {
  let rec: ReturnType<typeof recordingContext>;
  let getContext: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rec = recordingContext();
    getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => rec.ctx as never);
  });
  afterEach(() => {
    getContext.mockRestore();
  });

  const names = (name: string) => rec.calls.filter((c) => c.name === name);

  it("paints the wash, one edge, one dot per leaf, and the viewport indicator", async () => {
    const core = fakeCore(
      [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 300, y: 200 },
      ],
      [["a", "b"]],
    );
    render(<Minimap core={core} width={200} height={140} />);
    await waitFor(() => expect(names("strokeRect")).toHaveLength(1));
    const theme = useThemeStore.getState().theme;
    // Bitmap sized by dpr (jsdom: 1), transform applied before the wash.
    expect(rec.calls[0]).toEqual({
      name: "setTransform",
      args: [1, 0, 0, 1, 0, 0],
    });
    expect(names("clearRect")[0]?.args).toEqual([0, 0, 200, 140]);
    expect(names("fillRect")[0]?.args).toEqual([0, 0, 200, 140]);
    expect(rec.calls.find((c) => c.name === "set:fillStyle")?.args[0]).toBe(
      theme.bgSecondary,
    );
    // One edge: a single moveTo/lineTo/stroke run.
    expect(names("moveTo")).toHaveLength(1);
    expect(names("lineTo")).toHaveLength(1);
    // Two leaves: two dots at the configured radius.
    const arcs = names("arc");
    expect(arcs).toHaveLength(2);
    expect(arcs.every((c) => c.args[2] === 2)).toBe(true);
    // Viewport indicator: a translucent fill then a 1px accent stroke.
    const fills = names("fillRect");
    expect(fills).toHaveLength(2);
    const strokeRect = names("strokeRect")[0]!;
    expect(strokeRect.args).toEqual(fills[1]!.args);
    const strokeColors = names("set:strokeStyle").map((c) => c.args[0]);
    expect(strokeColors[strokeColors.length - 1]).toBe(theme.accentPrimary);
    // Alpha is restored to 1 at the end of the frame.
    const alphas = names("set:globalAlpha").map((c) => c.args[0]);
    expect(alphas[alphas.length - 1]).toBe(1);
  });

  it("collapses a compound parent to one rectangle and honors nodeFilter", async () => {
    const core = fakeCore(
      [
        { id: "p", x: 50, y: 50, box: { x1: 0, y1: 0, x2: 100, y2: 100 } },
        { id: "c1", x: 20, y: 20, parent: "p" },
        { id: "c2", x: 80, y: 80, parent: "p" },
        { id: "leaf", x: 300, y: 200 },
        { id: "port", x: 310, y: 210 },
      ],
      [
        ["c1", "c2"],
        ["c2", "leaf"],
      ],
    );
    render(
      <Minimap
        core={core}
        width={200}
        height={140}
        nodeRadius={3}
        nodeFilter={(n) => n.id() !== "port"}
      />,
    );
    await waitFor(() => expect(names("strokeRect")).toHaveLength(2));
    // The intra-compound edge collapses to a point and is skipped; the
    // c2 -> leaf edge draws from the parent's mark.
    expect(names("moveTo")).toHaveLength(1);
    // Container: filled + stroked rectangle (plus the viewport pair).
    expect(names("fillRect")).toHaveLength(3);
    // One dot: the leaf. Children never draw; the port is filtered.
    const arcs = names("arc");
    expect(arcs).toHaveLength(1);
    expect(arcs[0]?.args[2]).toBe(3);
  });

  it("paints only the wash when the graph is empty", async () => {
    const core = fakeCore([], []);
    render(<Minimap core={core} />);
    await waitFor(() => expect(names("fillRect")).toHaveLength(1));
    expect(names("arc")).toHaveLength(0);
    expect(names("strokeRect")).toHaveLength(0);
  });
});
