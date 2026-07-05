/**
 * AnalyticsDashboard render contract (canvas stubbed, everything else
 * real). Exists separately from dashboards.test.tsx, whose charter is
 * pure functions only. Pins the CoverageMeter fold: one meter per tier,
 * width equal to the computed origin coverage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import type { UGM } from "@g3t/core";

type CapturedMenu = {
  resolve: (t: {
    type: string;
    id?: string;
    position: { x: number; y: number };
  }) => Array<{
    label: string;
    action: (t: {
      type: string;
      id?: string;
      position: { x: number; y: number };
    }) => void;
  }>;
};
const captured = vi.hoisted(() => ({
  menus: [] as CapturedMenu[],
  hidden: [] as Array<ReadonlySet<string> | undefined>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      menuManager?: CapturedMenu;
      hidden?: ReadonlySet<string>;
    }) => {
      if (props.menuManager) captured.menus.push(props.menuManager);
      captured.hidden.push(props.hidden);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { useSelectionStore } from "@g3t/react";
import { buildSupplyNetwork, originCoverageByTier } from "./supply-data";

afterEach(cleanup);

describe("AnalyticsDashboard context menu (full toolkit action set)", () => {
  const nodeId = () => {
    const ugm = buildSupplyNetwork();
    return ugm.getNodeIds().find((id) => ugm.getNeighbors(id).length > 0)!;
  };
  const at = (id: string) => ({
    type: "node",
    id,
    position: { x: 0, y: 0 },
  });
  const resolveOn = (id: string) => {
    const manager = captured.menus.at(-1);
    expect(manager).toBeDefined();
    return manager!.resolve(at(id));
  };

  afterEach(() => {
    useSelectionStore.getState().selectNodes([]);
    captured.menus.length = 0;
    captured.hidden.length = 0;
  });

  it("registers the full toolkit node set (registerToolkitActions)", () => {
    render(<AnalyticsDashboard />);
    const labels = resolveOn(nodeId()).map((i) => i.label);
    for (const expected of [
      "Pin / unpin position",
      "Inspect",
      "View Neighbors (2-hop)",
      "Expand Neighbors",
      "Focus (2-hop)",
      "Find Paths From Here",
      "Edit Appearance",
      "Hide Node",
      "Copy ID",
    ]) {
      expect(labels).toContain(expected);
    }
  });

  it("Focus hides everything outside the neighborhood, and Show all restores", () => {
    render(<AnalyticsDashboard />);
    const id = nodeId();
    const items = resolveOn(id);
    act(() => {
      items.find((i) => i.label === "Focus (2-hop)")!.action(at(id));
    });
    const hidden = captured.hidden.at(-1);
    expect((hidden?.size ?? 0) > 0).toBe(true);
    expect(hidden?.has(id)).toBe(false);
    expect(screen.getByTestId("menu-status").textContent).toContain(
      "Focused on",
    );
    fireEvent.click(screen.getByRole("button", { name: /Show all/ }));
    expect(captured.hidden.at(-1)?.size ?? 0).toBe(0);
  });

  it("Find Paths From Here routes to the one other selected node", () => {
    render(<AnalyticsDashboard />);
    const ugm = buildSupplyNetwork();
    const id = nodeId();
    const neighbor = ugm.getNeighbors(id)[0]!;
    act(() => {
      useSelectionStore.getState().selectNodes([neighbor]);
    });
    const items = resolveOn(id);
    act(() => {
      items.find((i) => i.label === "Find Paths From Here")!.action(at(id));
    });
    expect(useSelectionStore.getState().selectedNodeIds.has(id)).toBe(true);
    expect(screen.getByTestId("menu-status").textContent).toContain("hop");
  });

  it("Edit Appearance mounts the NodeStyleEditor for the node", () => {
    render(<AnalyticsDashboard />);
    const id = nodeId();
    const items = resolveOn(id);
    act(() => {
      items.find((i) => i.label === "Edit Appearance")!.action(at(id));
    });
    expect(screen.getByTestId("dashboard-style-editor")).toBeDefined();
  });
});

describe("AnalyticsDashboard coverage section", () => {
  it("renders one CoverageMeter per tier at the computed width", () => {
    const rows = originCoverageByTier(buildSupplyNetwork());
    render(<AnalyticsDashboard />);
    for (const r of rows) {
      const meter = screen.getByTestId(`origin-coverage-${r.tier}`);
      const solid = meter.querySelector(
        "[data-testid='g3t-coverage-solid']",
      ) as HTMLElement;
      expect(solid.style.width).toBe(`${Math.round(r.substantiated * 100)}%`);
    }
    expect(screen.getByText("Origin coverage by tier")).toBeDefined();
  });
});
