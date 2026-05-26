/**
 * Multi-select tests (M1.E3.T3):
 * Shift-click 3 nodes; all 3 selected.
 * Lasso visual test deferred to Playwright (requires rendering).
 *
 * Tests the selection store behavior that backs both shift-click
 * and lasso selection.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore } from "../state/selection-store";

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

describe("Multi-select via selection store (M1.E3.T3)", () => {
  it("shift-click pattern: addNodesToSelection accumulates", () => {
    const { selectNodes, addNodesToSelection } = useSelectionStore.getState();

    // First click (no shift)
    selectNodes(["n1"]);
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["n1"]),
    );

    // Shift-click adds
    addNodesToSelection(["n2"]);
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["n1", "n2"]),
    );

    // Another shift-click
    addNodesToSelection(["n3"]);
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["n1", "n2", "n3"]),
    );
  });

  it("lasso pattern: selectNodes replaces with multiple IDs", () => {
    const { selectNodes } = useSelectionStore.getState();

    // Lasso selects multiple nodes at once
    selectNodes(["n1", "n2", "n3", "n4", "n5"]);
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["n1", "n2", "n3", "n4", "n5"]),
    );

    // New lasso replaces
    selectNodes(["n3", "n4"]);
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["n3", "n4"]),
    );
  });

  it("clearSelection empties after multi-select", () => {
    const { selectNodes, clearSelection } = useSelectionStore.getState();

    selectNodes(["n1", "n2", "n3"]);
    clearSelection();
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
  });
});
