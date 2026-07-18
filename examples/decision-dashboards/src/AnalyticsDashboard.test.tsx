/**
 * AnalyticsDashboard render contract (canvas stubbed, everything else
 * real). Exists separately from dashboards.test.tsx, whose charter is
 * pure functions only. Pins the CoverageMeter fold: one meter per tier,
 * width equal to the computed origin coverage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { stubChartDims } from "../../../tests/chart-dims";
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
  specs: [] as Array<{ color?: string; size?: string }>,
  menus: [] as CapturedMenu[],
  hidden: [] as Array<ReadonlySet<string> | undefined>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    // The popout internally composes the real CytoscapeCanvas via a
    // package-internal import this partial mock cannot reach; the
    // dashboard test's concern is the WIRING (opens with the right
    // hops, closes), so the popout is stubbed and its internals are
    // covered by its own suite.
    // SankeyView draws on a 2d canvas jsdom cannot provide; the
    // wiring assertion only needs the mount. Its own suite covers
    // rendering.
    SankeyView: () => <div data-testid="sankey-view" />,
    NeighborhoodPopout: (props: {
      focusId: string;
      defaultHops?: number;
      onClose: () => void;
    }) => (
      <div data-testid="g3t-neighborhood-popout">
        <span data-testid="popout-hops">{props.defaultHops ?? 1}-hop</span>
        <button data-testid="popout-close" onClick={props.onClose} />
      </div>
    ),
    CytoscapeCanvas: (props: {
      ugm: UGM;
      menuManager?: CapturedMenu;
      hidden?: ReadonlySet<string>;
      encodingSpec?: {
        node: {
          color?: { driver?: string };
          size?: { driver?: string };
        };
      };
    }) => {
      if (props.menuManager) captured.menus.push(props.menuManager);
      captured.hidden.push(props.hidden);
      captured.specs.push({
        color: props.encodingSpec?.node.color?.driver,
        size: props.encodingSpec?.node.size?.driver,
      });
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { useEmphasisStore, useSelectionStore } from "@g3t/react";
import { buildSupplyNetwork, originCoverageByTier } from "./supply-data";

afterEach(cleanup);

stubChartDims();

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
    // cleanup() must precede the store reset: the dashboard (and its
    // LinkedChart/TableView children) subscribe to the selection
    // store, so resetting while mounted re-renders outside act().
    cleanup();
    useSelectionStore.getState().selectNodes([]);
    useEmphasisStore.getState().clear();
    captured.menus.length = 0;
    captured.hidden.length = 0;
  });

  it("registers the full toolkit node set (registerToolkitActions)", () => {
    render(<AnalyticsDashboard />);
    const labels = resolveOn(nodeId()).map((i) => i.label);
    for (const expected of [
      "Pin / unpin position",
      "Inspect",
      "View Neighbors",
      "Expand Neighbors",
      "Focus (2-hop)",
      "Find Paths To Here",
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

  it("Find Paths To Here: selected node is the source, clicked the target, result is an EFFECT (4.6/4.12)", () => {
    render(<AnalyticsDashboard />);
    const ugm = buildSupplyNetwork();
    const id = nodeId();
    const neighbor = ugm.getNeighbors(id)[0]!;
    act(() => {
      useSelectionStore.getState().selectNodes([neighbor]);
    });
    const items = resolveOn(id);
    act(() => {
      items.find((i) => i.label === "Find Paths To Here")!.action(at(id));
    });
    // The path renders as an emphasis effect, NOT as selection: the
    // clicked node was never added to the selection.
    expect(useSelectionStore.getState().selectedNodeIds.has(id)).toBe(false);
    const emphasis = useEmphasisStore.getState();
    expect(emphasis.active).toBe(true);
    expect(emphasis.effectNodeIds.has(id)).toBe(true);
    expect(emphasis.effectNodeIds.has(neighbor)).toBe(true);
    expect(emphasis.emphasizedEdgeIds.size).toBeGreaterThan(0);
    // Direction: the status names source -> target (selected first).
    expect(screen.getByTestId("menu-status").textContent).toContain(
      `${neighbor} \u2192 ${id}`.replace("\\u2192", "\u2192"),
    );
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

  it("View Neighbors opens the floating popout instead of selecting (4.10)", () => {
    render(<AnalyticsDashboard />);
    const id = nodeId();
    const items = resolveOn(id);
    act(() => {
      items.find((i) => i.label === "View Neighbors")!.action(at(id));
    });
    // No selection mutation; a popout instead, closable.
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
    expect(screen.getByTestId("g3t-neighborhood-popout")).toBeDefined();
    expect(screen.getByTestId("popout-hops").textContent).toBe("1-hop"); // 9.20: always opens at ONE hop; the stepper widens;
    act(() => {
      screen.getByTestId("popout-close").click();
    });
    expect(screen.queryByTestId("g3t-neighborhood-popout")).toBeNull();
  });

  it("Inspect opens the inspector panel (4.11)", () => {
    render(<AnalyticsDashboard />);
    const id = nodeId();
    const items = resolveOn(id);
    act(() => {
      items.find((i) => i.label === "Inspect")!.action(at(id));
    });
    expect(screen.getByTestId("dashboard-inspector")).toBeDefined();
    act(() => {
      screen.getByTestId("inspector-close").click();
    });
    expect(screen.queryByTestId("dashboard-inspector")).toBeNull();
  });

  it("Collapse Neighbors is absent until neighbors are selected, then contracts the selection (4.12)", () => {
    render(<AnalyticsDashboard />);
    const ugm = buildSupplyNetwork();
    const id = nodeId();
    const neighbors = ugm.getNeighbors(id);
    expect(neighbors.length).toBeGreaterThan(0);

    // Wired-or-absent: nothing selected, no collapse item.
    expect(resolveOn(id).map((i) => i.label)).not.toContain(
      "Collapse Neighbors",
    );

    act(() => {
      useSelectionStore.getState().selectNodes([id, ...neighbors]);
    });
    const items = resolveOn(id);
    expect(items.map((i) => i.label)).toContain("Collapse Neighbors");
    act(() => {
      items.find((i) => i.label === "Collapse Neighbors")!.action(at(id));
    });
    const after = useSelectionStore.getState().selectedNodeIds;
    expect(after.has(id)).toBe(true);
    for (const n of neighbors) expect(after.has(n)).toBe(false);
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

describe("demonstrations have visible consequences (5.1/5.2)", () => {
  it("the relocated matrix and sankey tabs render (5.5)", () => {
    render(<AnalyticsDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Adjacency matrix" }));
    expect(screen.getByTestId("matrix-view")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Type flows (sankey)" }),
    );
    expect(screen.getByTestId("sankey-view")).toBeDefined();
  });

  it("the rail carries ONLY Origin coverage (12.6 ruling)", () => {
    render(<AnalyticsDashboard />);
    expect(screen.getByText("Origin coverage by tier")).toBeDefined();
    expect(screen.queryByText("Algorithm demonstrations")).toBeNull();
    expect(screen.queryByText(/Derive a property/)).toBeNull();
  });
});
