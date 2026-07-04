/**
 * VA-26 runaway-growth probe (review finding, round 24): mount the
 * real island component with cytoscape mocked and count renders. A
 * React-state feedback loop explodes here; if this stays flat the
 * loop is browser-layout-driven instead.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useEffect } from "react";

const layoutRun = vi.fn();
vi.mock("cytoscape", () => {
  const cy = {
    layout: vi.fn(() => ({ run: layoutRun })),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    batch: vi.fn((fn: () => void) => fn()),
    nodes: vi.fn(() => ({ forEach: vi.fn(), length: 0 })),
    edges: vi.fn(() => ({ forEach: vi.fn(), length: 0 })),
    elements: vi.fn(() => ({ remove: vi.fn() })),
    add: vi.fn(),
    getElementById: vi.fn(() => ({
      nonempty: (): boolean => false,
      length: 0,
    })),
    style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
    zoom: vi.fn(() => 1),
    pan: vi.fn(),
    fit: vi.fn(),
    resize: vi.fn(),
    container: vi.fn(() => null),
    scratch: vi.fn(),
  };
  const factory = vi.fn(() => cy);
  (factory as unknown as Record<string, unknown>).use = vi.fn();
  return { default: factory };
});

import {
  Va26Algorithms,
  Va22CanvasLoop,
} from "../../scripts/visual-acceptance/va20-shared";

const counter = { renders: 0 };
function bump() {
  counter.renders += 1;
}
function CountRenders({ children }: { children: React.ReactNode }) {
  bump();
  useEffect(() => undefined);
  return <>{children}</>;
}

afterEach(() => {
  counter.renders = 0;
});

describe("VA-26 growth probe", () => {
  it("Va26 settles: render count stays flat after mount", async () => {
    render(
      <CountRenders>
        <Va26Algorithms live />
      </CountRenders>,
    );
    const after = counter.renders;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(counter.renders).toBe(after);
    expect(counter.renders).toBeLessThan(5);
  });

  it("control: Va22 settles identically", async () => {
    render(
      <CountRenders>
        <Va22CanvasLoop live />
      </CountRenders>,
    );
    const after = counter.renders;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(counter.renders).toBe(after);
  });
});
