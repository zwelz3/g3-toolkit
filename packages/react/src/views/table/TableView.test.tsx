/**
 * TableView tests covering E1.2 acceptance criteria:
 *
 * T1: render 100 nodes; sort by type; paginate.
 * T2: click row → canvas node highlights (via selection store).
 * T3: right-click table row → menu appears with base items.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { createDefaultMenuManager } from "../../interaction/context-menu";
import { TableView } from "./TableView";

function createTestUGM(count: number): UGM {
  const ugm = new UGM();
  for (let i = 0; i < count; i++) {
    ugm.addNode(`node-${i}`, {
      types: [`Type${i % 3}`],
      properties: { name: `Node ${i}`, score: Math.random() },
    });
  }
  return ugm;
}

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

// ── T1: TanStack Table component ────────────────────────────────────

describe("TableView rendering (M1.E2.T1)", () => {
  it("renders all columns including dynamic property keys", () => {
    const ugm = createTestUGM(5);
    render(<TableView ugm={ugm} />);

    // Fixed columns
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Types")).toBeInTheDocument();
    // Dynamic property columns from registry
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
  });

  it("renders 100 nodes with pagination (default pageSize 50)", () => {
    const ugm = createTestUGM(100);
    render(<TableView ugm={ugm} />);

    const pagination = screen.getByTestId("table-pagination");
    expect(pagination).toHaveTextContent("100 nodes");
    expect(pagination).toHaveTextContent("Page 1 of 2");
  });

  it("paginates to page 2", () => {
    const ugm = createTestUGM(100);
    render(<TableView ugm={ugm} />);

    const nextBtn = screen.getByText("Next →");
    fireEvent.click(nextBtn);

    const pagination = screen.getByTestId("table-pagination");
    expect(pagination).toHaveTextContent("Page 2 of 2");
  });

  it("sorts by column when header is clicked", () => {
    const ugm = new UGM();
    ugm.addNode("c", { types: ["Z"], properties: { name: "Charlie" } });
    ugm.addNode("a", { types: ["A"], properties: { name: "Alice" } });
    ugm.addNode("b", { types: ["M"], properties: { name: "Bob" } });

    render(<TableView ugm={ugm} />);

    // Click Types header to sort ascending
    fireEvent.click(screen.getByText("Types"));

    // Get all rows; first should be "A" after sort
    const rows = screen.getAllByRole("row");
    // Row 0 is header; row 1 is first data row
    const firstDataRow = rows[1]!;
    expect(within(firstDataRow).getByText("A")).toBeInTheDocument();
  });

  it("respects custom pageSize", () => {
    const ugm = createTestUGM(30);
    render(<TableView ugm={ugm} pageSize={10} />);

    const pagination = screen.getByTestId("table-pagination");
    expect(pagination).toHaveTextContent("Page 1 of 3");
  });

  it("shows node values in cells", () => {
    const ugm = new UGM();
    ugm.addNode("alice", {
      types: ["Person"],
      properties: { name: "Alice" },
    });

    render(<TableView ugm={ugm} />);

    const row = screen.getByTestId("table-row-alice");
    expect(within(row).getByText("alice")).toBeInTheDocument();
    expect(within(row).getByText("Person")).toBeInTheDocument();
    expect(within(row).getByText("Alice")).toBeInTheDocument();
  });
});

// ── T2: Table-to-canvas selection linking ───────────────────────────

describe("TableView selection linking (M1.E2.T2)", () => {
  it("clicking a row selects the node in the store", () => {
    const ugm = createTestUGM(5);
    render(<TableView ugm={ugm} />);

    fireEvent.click(screen.getByTestId("table-row-node-0"));

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds.has("node-0")).toBe(true);
  });

  it("highlights selected rows visually", () => {
    const ugm = createTestUGM(5);

    // Pre-select a node in the store
    useSelectionStore.getState().selectNodes(["node-2"]);

    render(<TableView ugm={ugm} />);

    const row = screen.getByTestId("table-row-node-2");
    // jsdom renders hex as rgb(); check for the blue indicator
    expect(row.getAttribute("data-selected")).toBe("true");
    // C1 selection signature: accent bar geometry from the token,
    // color from the active theme (no hardcoded blue).
    expect(row.style.borderLeft).toContain("--g3t-selection-bar-width");
    expect(row.style.borderLeft).toContain("--g3t-accent-primary");
  });

  it("clicking a different row replaces the selection", () => {
    const ugm = createTestUGM(5);
    render(<TableView ugm={ugm} />);

    fireEvent.click(screen.getByTestId("table-row-node-0"));
    fireEvent.click(screen.getByTestId("table-row-node-3"));

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds.has("node-0")).toBe(false);
    expect(state.selectedNodeIds.has("node-3")).toBe(true);
  });
});

// ── T3: Table right-click with context menu ─────────────────────────

describe("TableView right-click menu (M1.E2.T3)", () => {
  it("shows context menu on right-click with menu manager", () => {
    const ugm = createTestUGM(5);
    const menuManager = createDefaultMenuManager({
      onInspect: vi.fn(),
    });

    render(<TableView ugm={ugm} menuManager={menuManager} />);

    fireEvent.contextMenu(screen.getByTestId("table-row-node-1"));

    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(
      screen.getByTestId("menu-item-inspect-properties"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-copy-iri")).toBeInTheDocument();
  });

  it("does not show menu when no menuManager is provided", () => {
    const ugm = createTestUGM(5);
    render(<TableView ugm={ugm} />);

    fireEvent.contextMenu(screen.getByTestId("table-row-node-1"));

    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });

  it("closes context menu on click elsewhere", () => {
    const ugm = createTestUGM(5);
    const menuManager = createDefaultMenuManager();

    render(<TableView ugm={ugm} menuManager={menuManager} />);

    fireEvent.contextMenu(screen.getByTestId("table-row-node-0"));
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();

    // Click the table container to close
    fireEvent.click(screen.getByTestId("table-view"));

    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("TableView: edge cases (audit)", () => {
  it("renders empty state for UGM with no nodes", () => {
    const ugm = new UGM();
    render(<TableView ugm={ugm} />);

    const pagination = screen.getByTestId("table-pagination");
    expect(pagination).toHaveTextContent("0 nodes");
  });

  it("renders with large page size without crashing", () => {
    const ugm = createTestUGM(5);
    render(<TableView ugm={ugm} pageSize={10000} />);

    const pagination = screen.getByTestId("table-pagination");
    expect(pagination).toHaveTextContent("Page 1 of 1");
  });
});

describe("TableView column-visibility menu (bugfix: closeable)", () => {
  it("opens and closes via the toggle, a close button, and outside click", () => {
    const ugm = createTestUGM(5);
    render(<TableView ugm={ugm} />);
    const toggle = screen.getByTestId("column-visibility-toggle");

    // Open
    fireEvent.click(toggle);
    expect(screen.getByTestId("column-visibility-menu")).toBeTruthy();

    // Close via the ✕ button
    fireEvent.click(screen.getByTestId("column-visibility-close"));
    expect(screen.queryByTestId("column-visibility-menu")).toBeNull();

    // Open again, then close via an outside pointerdown
    fireEvent.click(toggle);
    expect(screen.getByTestId("column-visibility-menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("column-visibility-menu")).toBeNull();

    // Open again, then close via Escape
    fireEvent.click(toggle);
    expect(screen.getByTestId("column-visibility-menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("column-visibility-menu")).toBeNull();
  });
});
