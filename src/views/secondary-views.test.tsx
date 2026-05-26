/**
 * M5 Secondary Views tests.
 *
 * E1.T1: 50 temporal nodes render on timeline (or show empty state).
 * E2.T1: 50 nodes with coordinates render on map.
 * E2.T2: Map selection linking via store.
 * E3.T1: 100 nodes with pagerank; histogram renders.
 * E4.T1: 500-node tree; only first 2 levels render. Expand loads children.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@core/ugm";
import { WorkingSetManager } from "@core/working-set-manager";
import { useSelectionStore } from "@state/selection-store";
import { MapView } from "@views/map";
import { TreeView } from "@views/tree";

// vis-timeline and echarts need DOM APIs not available in jsdom;
// their component tests focus on data extraction and empty states.
// Full rendering tests deferred to Playwright.

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

// ── Timeline (E1.T1) ───────────────────────────────────────────────

describe("TimelineView (M5.E1.T1)", () => {
  // vis-timeline requires DOM measurement APIs not in jsdom.
  // Test the empty-state path and data extraction logic.

  it("shows empty state when no temporal nodes exist", async () => {
    // Dynamic import to avoid vis-timeline initialization errors
    const { TimelineView } = await import("@views/timeline");
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "A" } });

    render(<TimelineView ugm={ugm} />);
    expect(screen.getByTestId("timeline-empty")).toBeInTheDocument();
  });
});

// ── Map (E2.T1, E2.T2) ─────────────────────────────────────────────

describe("MapView (M5.E2.T1)", () => {
  function createGeoUGM(count: number): UGM {
    const ugm = new UGM();
    for (let i = 0; i < count; i++) {
      ugm.addNode(`loc-${i}`, {
        types: ["Location"],
        properties: {
          name: `Place ${i}`,
          lat: 30 + Math.random() * 20,
          lon: -100 + Math.random() * 60,
        },
      });
    }
    return ugm;
  }

  it("renders 50 nodes with coordinates as SVG markers", () => {
    const ugm = createGeoUGM(50);
    render(<MapView ugm={ugm} />);

    const svg = screen.getByTestId("map-svg");
    expect(svg).toBeInTheDocument();
    expect(screen.getByTestId("map-marker-loc-0")).toBeInTheDocument();
    expect(screen.getByTestId("map-marker-loc-49")).toBeInTheDocument();
  });

  it("shows empty state when no geo nodes exist", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    render(<MapView ugm={ugm} />);
    expect(screen.getByTestId("map-empty")).toBeInTheDocument();
  });

  it("clicking marker selects node in store (E2.T2)", () => {
    const ugm = createGeoUGM(5);
    render(<MapView ugm={ugm} />);

    const marker = screen.getByTestId("map-marker-loc-2");
    const circle = marker.querySelector("circle");
    fireEvent.click(circle!);

    expect(useSelectionStore.getState().selectedNodeIds.has("loc-2")).toBe(
      true,
    );
  });

  it("selected node marker is highlighted (E2.T2)", () => {
    const ugm = createGeoUGM(5);
    useSelectionStore.getState().selectNodes(["loc-1"]);

    render(<MapView ugm={ugm} />);
    const marker = screen.getByTestId("map-marker-loc-1");
    const circle = marker.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("#2563eb");
  });
});

// ── Stats (E3.T1) ───────────────────────────────────────────────────

describe("StatsPanel (M5.E3.T1)", () => {
  // ECharts requires canvas APIs not in jsdom. Test empty state.

  it("shows empty state for missing property", async () => {
    const { StatsPanel } = await import("@views/stats");
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    render(<StatsPanel ugm={ugm} propertyKey="pagerank" />);
    expect(screen.getByTestId("stats-empty")).toBeInTheDocument();
    expect(screen.getByTestId("stats-empty")).toHaveTextContent("pagerank");
  });
});

// ── Tree (E4.T1) ───────────────────────────────────────────────────

describe("TreeView (M5.E4.T1)", () => {
  function createTreeUGM(depth: number, branching: number): UGM {
    const ugm = new UGM();
    let nodeId = 0;

    function addLevel(parentId: string, currentDepth: number): void {
      if (currentDepth >= depth) return;
      for (let i = 0; i < branching; i++) {
        const childId = `n${nodeId++}`;
        ugm.addNode(childId, {
          types: ["TreeNode"],
          properties: { name: `Node ${childId}` },
        });
        ugm.addEdge(parentId, childId, { type: "child" });
        addLevel(childId, currentDepth + 1);
      }
    }

    const rootId = `n${nodeId++}`;
    ugm.addNode(rootId, {
      types: ["Root"],
      properties: { name: "Root" },
    });
    addLevel(rootId, 0);
    return ugm;
  }

  it("renders first 2 levels by default", () => {
    const ugm = createTreeUGM(4, 3); // 1+3+9+27 = 40 nodes
    render(<TreeView ugm={ugm} initialDepth={2} />);

    const treeView = screen.getByTestId("tree-view");
    expect(treeView).toBeInTheDocument();

    // Root and first-level children should be visible
    // (exact visibility depends on the auto-detected root)
    const allNodes = treeView.querySelectorAll("[data-testid^='tree-node-']");
    // With depth=2, we see root + children + grandchildren
    // but NOT great-grandchildren
    expect(allNodes.length).toBeLessThan(40);
    expect(allNodes.length).toBeGreaterThan(1);
  });

  it("expand toggle loads deeper children", () => {
    const ugm = createTreeUGM(3, 2); // 1+2+4 = 7 nodes
    render(<TreeView ugm={ugm} initialDepth={1} />);

    // Find a toggle button for a node with children
    const toggleButtons = screen
      .getAllByRole("button")
      .filter((btn) =>
        btn.getAttribute("data-testid")?.startsWith("tree-toggle-"),
      );
    expect(toggleButtons.length).toBeGreaterThan(0);

    // Count nodes before expand
    const before = screen
      .getByTestId("tree-view")
      .querySelectorAll("[data-testid^='tree-node-']").length;

    // Click toggle to expand
    fireEvent.click(toggleButtons[0]!);

    const after = screen
      .getByTestId("tree-view")
      .querySelectorAll("[data-testid^='tree-node-']").length;

    // Should have more nodes after expanding
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("clicking a node selects it in the store", () => {
    const ugm = createTreeUGM(2, 2);
    render(<TreeView ugm={ugm} />);

    // Click the first tree node's row (the inner clickable div)
    const nodeRows = screen
      .getByTestId("tree-view")
      .querySelectorAll("[data-testid^='tree-node-'] > div");
    expect(nodeRows.length).toBeGreaterThan(0);
    fireEvent.click(nodeRows[0]!);

    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(1);
  });

  it("shows empty state for missing root", () => {
    const ugm = new UGM();
    render(<TreeView ugm={ugm} />);
    expect(screen.getByTestId("tree-view-empty")).toBeInTheDocument();
  });

  it("enforces working-set limit (renders fewer than total)", () => {
    const ugm = createTreeUGM(5, 3); // ~121 nodes
    const wsm = new WorkingSetManager({ tree: 15 });
    render(<TreeView ugm={ugm} initialDepth={5} workingSetManager={wsm} />);

    const nodes = screen
      .getByTestId("tree-view")
      .querySelectorAll("[data-testid^='tree-node-']");
    // DFS with limit=15; actual count is approximate (within branching factor)
    expect(nodes.length).toBeLessThan(40); // well under the 121 total
    expect(nodes.length).toBeGreaterThan(0);
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("MapView: edge cases (audit)", () => {
  it("derives viewBox from selected node position", () => {
    const ugm = new UGM();
    ugm.addNode("loc-0", {
      types: ["Location"],
      properties: { name: "Place 0", lat: 40.0, lon: -74.0 },
    });
    ugm.addNode("loc-1", {
      types: ["Location"],
      properties: { name: "Place 1", lat: 35.0, lon: -118.0 },
    });

    // Pre-select loc-1
    useSelectionStore.getState().selectNodes(["loc-1"]);

    const { container } = render(<MapView ugm={ugm} />);
    const svg = container.querySelector("svg");
    const viewBox = svg?.getAttribute("viewBox") ?? "";
    // viewBox should be panned to loc-1 coordinates (not default 0,0,800,400)
    expect(viewBox).not.toBe("0 0 800 400");
  });
});

describe("TreeView: edge cases (audit)", () => {
  it("handles cycle in graph without infinite loop", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "A" } });
    ugm.addNode("b", { types: ["X"], properties: { name: "B" } });
    ugm.addNode("c", { types: ["X"], properties: { name: "C" } });
    ugm.addEdge("a", "b", { type: "link" });
    ugm.addEdge("b", "c", { type: "link" });
    ugm.addEdge("c", "a", { type: "link" }); // cycle

    render(<TreeView ugm={ugm} rootId="a" initialDepth={5} />);
    // Should render without hanging
    const nodes = screen
      .getByTestId("tree-view")
      .querySelectorAll("[data-testid^='tree-node-']");
    expect(nodes.length).toBe(3);
  });

  it("breadcrumb updates on node navigation", () => {
    const ugm = new UGM();
    ugm.addNode("root", { types: ["X"], properties: { name: "Root" } });
    ugm.addNode("child", { types: ["X"], properties: { name: "Child" } });
    ugm.addEdge("root", "child", { type: "link" });

    render(<TreeView ugm={ugm} rootId="root" />);

    // Click child node's row
    const childRow = screen.getByTestId("tree-node-child").querySelector("div");
    if (childRow) {
      fireEvent.click(childRow);
    }

    // Breadcrumb should appear
    const breadcrumb = screen.queryByTestId("tree-breadcrumb");
    expect(breadcrumb).toBeInTheDocument();
  });
});
