/**
 * RoutingExplainShell contract test.
 *
 * StructuralSvgView and CytoscapeCanvas are stubbed (jsdom has no
 * canvas or ResizeObserver). The test pins:
 *  - mount: back affordance and flow diagram host render
 *  - mode control: the prop delivered to CytoscapeCanvas changes as
 *    the select changes
 *  - DEV-only: the "DEV only" badge renders (not a gate test, just
 *    confirms the label is present for reviewers)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { CyStylesheet } from "@g3t/react";
import type { StructuralGraphInput, StructuralGeometry } from "@g3t/core";

const captured = vi.hoisted(() => ({
  canvasCalls: [] as Array<{
    ugm: unknown;
    routeEdges: unknown;
  }>,
  svgCalls: [] as Array<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  }>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm?: unknown;
      routeEdges?: unknown;
      stylesheet?: CyStylesheet[];
      onReady?: (cy: unknown) => void;
    }) => {
      captured.canvasCalls.push({
        ugm: props.ugm,
        routeEdges: props.routeEdges,
      });
      return <div data-testid="canvas-stub" />;
    },
    StructuralSvgView: (props: {
      input: StructuralGraphInput;
      geometry: StructuralGeometry;
    }) => {
      captured.svgCalls.push({ input: props.input, geometry: props.geometry });
      return <div data-testid="svg-stub" />;
    },
  };
});

import { RoutingExplainShell } from "./RoutingExplainShell";

afterEach(() => {
  cleanup();
  captured.canvasCalls.length = 0;
  captured.svgCalls.length = 0;
});

describe("RoutingExplainShell", () => {
  it("mounts and renders the flow diagram host and canvas host", async () => {
    render(<RoutingExplainShell />);
    expect(screen.getByTestId("rexplain-flow-host")).toBeTruthy();
    expect(screen.getByTestId("rexplain-canvas-host")).toBeTruthy();
  });

  it("back affordance calls onBack", () => {
    const onBack = vi.fn();
    render(<RoutingExplainShell onBack={onBack} />);
    fireEvent.click(screen.getByTestId("rexplain-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("mode select defaults to direct and routes the canvas prop correctly", async () => {
    render(<RoutingExplainShell />);
    const select = screen.getByTestId(
      "rexplain-route-mode",
    ) as HTMLSelectElement;
    expect(select.value).toBe("direct");
    await waitFor(() => {
      const last = captured.canvasCalls.at(-1);
      expect(last).toBeTruthy();
      expect(last!.routeEdges).toEqual({ mode: "direct" });
    });
  });

  it("switching to orthogonal delivers mode=orthogonal to the canvas", async () => {
    render(<RoutingExplainShell />);
    fireEvent.change(screen.getByTestId("rexplain-route-mode"), {
      target: { value: "orthogonal" },
    });
    await waitFor(() => {
      const last = captured.canvasCalls.at(-1);
      expect(last!.routeEdges).toEqual({ mode: "orthogonal" });
    });
  });

  it("switching to off delivers routeEdges=false to the canvas", async () => {
    render(<RoutingExplainShell />);
    fireEvent.change(screen.getByTestId("rexplain-route-mode"), {
      target: { value: "off" },
    });
    await waitFor(() => {
      const last = captured.canvasCalls.at(-1);
      expect(last!.routeEdges).toBe(false);
    });
  });

  it("flow diagram is fed to StructuralSvgView after layout completes", async () => {
    render(<RoutingExplainShell />);
    await waitFor(() => {
      expect(captured.svgCalls.length).toBeGreaterThan(0);
    });
    const call = captured.svgCalls.at(-1)!;
    // The flow input has nodes including the mode-gate and router nodes
    const nodeIds = call.input.nodes.map((n) => n.id);
    expect(nodeIds).toContain("n-mode");
    expect(nodeIds).toContain("n-route");
    expect(nodeIds).toContain("n-structural");
  });

  it("DEV-only badge is visible", () => {
    render(<RoutingExplainShell />);
    expect(screen.getByText("DEV only")).toBeTruthy();
  });
});
