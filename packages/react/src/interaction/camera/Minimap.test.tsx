/**
 * jsdom has no 2D canvas context, so the drawing path is inert here; the
 * pan math is covered by cameraController.test.ts. These tests cover the
 * component contract: structure, the disabled placeholder, sizing, and
 * the render-event subscription lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Core } from "cytoscape";
import { Minimap } from "./Minimap";
import { resetCoreHandleWarnings } from "../core-handle";

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
