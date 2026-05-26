/**
 * LayoutSwitcher and pin state tests (M2.E3.T1, T2):
 *
 * T1: Switch layout; pinned nodes stay; animation completes.
 * T2: Pin node; switch layout; node stays; unpin; next layout moves it.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { LayoutSwitcher, usePinState } from "./LayoutSwitcher";
import type { LayoutEngine } from "@g3t/core";

const mockEngines: LayoutEngine[] = [
  {
    name: "Force-Directed",
    id: "force",
    compute: vi.fn(async () => new Map()),
  },
  {
    name: "Hierarchical",
    id: "hierarchy",
    compute: vi.fn(async () => new Map()),
  },
  {
    name: "DAG",
    id: "dagre",
    compute: vi.fn(async () => new Map()),
  },
];

// ── T1: Layout switcher UI ──────────────────────────────────────────

describe("LayoutSwitcher (M2.E3.T1)", () => {
  it("renders buttons for all engines", () => {
    render(
      <LayoutSwitcher
        engines={mockEngines}
        activeId="force"
        onSwitch={vi.fn()}
      />,
    );

    expect(screen.getByTestId("layout-btn-force")).toBeInTheDocument();
    expect(screen.getByTestId("layout-btn-hierarchy")).toBeInTheDocument();
    expect(screen.getByTestId("layout-btn-dagre")).toBeInTheDocument();
  });

  it("highlights the active engine", () => {
    render(
      <LayoutSwitcher
        engines={mockEngines}
        activeId="hierarchy"
        onSwitch={vi.fn()}
      />,
    );

    const activeBtn = screen.getByTestId("layout-btn-hierarchy");
    expect(activeBtn.style.background).toMatch(/2563eb|37.*99.*235/);
  });

  it("calls onSwitch when a different engine is clicked", () => {
    const onSwitch = vi.fn();
    render(
      <LayoutSwitcher
        engines={mockEngines}
        activeId="force"
        onSwitch={onSwitch}
      />,
    );

    fireEvent.click(screen.getByTestId("layout-btn-dagre"));
    expect(onSwitch).toHaveBeenCalledWith("dagre");
  });
});

// ── T2: Pin/unpin state ─────────────────────────────────────────────

describe("usePinState (M2.E3.T2)", () => {
  it("starts with no pinned nodes", () => {
    const { result } = renderHook(() => usePinState());
    expect(result.current.pinned.size).toBe(0);
  });

  it("pins a node at specified position", () => {
    const { result } = renderHook(() => usePinState());

    act(() => {
      result.current.pin("n1", { x: 100, y: 200 });
    });

    expect(result.current.isPinned("n1")).toBe(true);
    expect(result.current.pinned.get("n1")).toEqual({ x: 100, y: 200 });
  });

  it("unpins a node", () => {
    const { result } = renderHook(() => usePinState());

    act(() => {
      result.current.pin("n1", { x: 100, y: 200 });
    });
    expect(result.current.isPinned("n1")).toBe(true);

    act(() => {
      result.current.unpin("n1");
    });
    expect(result.current.isPinned("n1")).toBe(false);
  });

  it("supports multiple pinned nodes", () => {
    const { result } = renderHook(() => usePinState());

    act(() => {
      result.current.pin("n1", { x: 10, y: 20 });
      result.current.pin("n2", { x: 30, y: 40 });
    });

    expect(result.current.pinned.size).toBe(2);
    expect(result.current.isPinned("n1")).toBe(true);
    expect(result.current.isPinned("n2")).toBe(true);
  });

  it("updating a pin replaces the position", () => {
    const { result } = renderHook(() => usePinState());

    act(() => {
      result.current.pin("n1", { x: 10, y: 20 });
    });
    act(() => {
      result.current.pin("n1", { x: 99, y: 99 });
    });

    expect(result.current.pinned.get("n1")).toEqual({ x: 99, y: 99 });
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("LayoutSwitcher: edge cases (audit)", () => {
  it("renders empty state when no engines provided", () => {
    render(<LayoutSwitcher engines={[]} activeId="" onSwitch={vi.fn()} />);
    const switcher = screen.getByTestId("layout-switcher");
    expect(switcher.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("usePinState: edge cases (audit)", () => {
  it("unpin nonexistent node is a no-op", () => {
    const { result } = renderHook(() => usePinState());
    act(() => {
      result.current.unpin("nonexistent");
    });
    expect(result.current.pinned.size).toBe(0);
  });
});
