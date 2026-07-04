/**
 * jsdom has no 2D canvas context, so the drawing path is inert here; the
 * pan math is covered by cameraController.test.ts. These tests cover the
 * component contract: structure, the disabled placeholder, sizing, and
 * the render-event subscription lifecycle.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Core } from "cytoscape";
import { Minimap } from "./Minimap";

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
