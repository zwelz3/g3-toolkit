/**
 * Table multi-select tests (bug fixes).
 *
 * - ctrl+click toggles node in/out of selection
 * - shift+click selects range from last-clicked row
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { TableView } from "./TableView";

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

describe("Table multi-select (bug fixes)", () => {
  it("ctrl+click toggles node in selection", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "A" } });
    ugm.addNode("b", { types: ["X"], properties: { name: "B" } });
    ugm.addNode("c", { types: ["X"], properties: { name: "C" } });

    render(<TableView ugm={ugm} />);

    // Click A (plain)
    fireEvent.click(screen.getByTestId("table-row-a"));
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["a"]),
    );

    // Ctrl+click B (add to selection)
    fireEvent.click(screen.getByTestId("table-row-b"), { ctrlKey: true });
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["a", "b"]),
    );

    // Ctrl+click A again (remove from selection)
    fireEvent.click(screen.getByTestId("table-row-a"), { ctrlKey: true });
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["b"]),
    );
  });

  it("shift+click selects range", () => {
    const ugm = new UGM();
    for (let i = 0; i < 5; i++) {
      ugm.addNode(`n${i}`, { types: ["X"], properties: { name: `N${i}` } });
    }

    render(<TableView ugm={ugm} />);

    // Click first row (plain)
    fireEvent.click(screen.getByTestId("table-row-n0"));
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(1);

    // Shift+click third row (range select)
    fireEvent.click(screen.getByTestId("table-row-n2"), { shiftKey: true });
    const selected = useSelectionStore.getState().selectedNodeIds;
    expect(selected.size).toBeGreaterThanOrEqual(2);
  });

  it("plain click replaces selection", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "A" } });
    ugm.addNode("b", { types: ["X"], properties: { name: "B" } });

    render(<TableView ugm={ugm} />);

    fireEvent.click(screen.getByTestId("table-row-a"));
    fireEvent.click(screen.getByTestId("table-row-b"));
    // Plain click replaces; only B should be selected
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["b"]),
    );
  });
});
