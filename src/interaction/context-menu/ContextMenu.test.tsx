/**
 * ContextMenu React component tests.
 * Verifies rendering, item clicks, and close behavior.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextMenu } from "./ContextMenu";
import type { MenuTarget, MenuItem } from "./types";

const target: MenuTarget = {
  type: "node",
  id: "alice",
  position: { x: 100, y: 200 },
};

function makeItems(action = vi.fn()): MenuItem[] {
  return [
    { id: "inspect", label: "Inspect", icon: "🔍", action },
    { id: "copy", label: "Copy IRI", icon: "📋", action },
  ];
}

describe("ContextMenu component", () => {
  it("renders menu items", () => {
    render(
      <ContextMenu items={makeItems()} target={target} onClose={vi.fn()} />,
    );

    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-inspect")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-copy")).toBeInTheDocument();
  });

  it("renders at the target position", () => {
    render(
      <ContextMenu items={makeItems()} target={target} onClose={vi.fn()} />,
    );

    const menu = screen.getByTestId("context-menu");
    expect(menu.style.left).toBe("100px");
    expect(menu.style.top).toBe("200px");
  });

  it("calls action and onClose when item is clicked", () => {
    const action = vi.fn();
    const onClose = vi.fn();

    render(
      <ContextMenu
        items={makeItems(action)}
        target={target}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId("menu-item-inspect"));

    expect(action).toHaveBeenCalledWith(target);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();

    render(
      <ContextMenu items={makeItems()} target={target} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on click outside the menu", () => {
    const onClose = vi.fn();

    render(
      <div data-testid="outside-area">
        <ContextMenu items={makeItems()} target={target} onClose={onClose} />
      </div>,
    );

    fireEvent.mouseDown(screen.getByTestId("outside-area"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when items array is empty", () => {
    const { container } = render(
      <ContextMenu items={[]} target={target} onClose={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("displays separator line when item has separator=true", () => {
    const items: MenuItem[] = [
      { id: "a", label: "A", action: vi.fn() },
      { id: "b", label: "B", action: vi.fn(), separator: true },
    ];

    render(<ContextMenu items={items} target={target} onClose={vi.fn()} />);

    const hrs = screen.getByTestId("context-menu").querySelectorAll("hr");
    expect(hrs.length).toBe(1);
  });
});
