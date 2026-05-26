/**
 * Selection store tests (M1.E1.T1):
 * select, add, clear, hover; verify state transitions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore } from "./selection-store";

// Reset store between tests
beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

describe("SelectionStore (M1.E1.T1)", () => {
  it("starts with empty selection", () => {
    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds.size).toBe(0);
    expect(state.selectedEdgeIds.size).toBe(0);
    expect(state.hoveredNodeId).toBeNull();
  });

  it("selectNodes replaces the selection", () => {
    const { selectNodes } = useSelectionStore.getState();
    selectNodes(["a", "b"]);

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds).toEqual(new Set(["a", "b"]));
    expect(state.selectedEdgeIds.size).toBe(0);
  });

  it("selectNodes clears previous selection", () => {
    const { selectNodes } = useSelectionStore.getState();
    selectNodes(["a", "b"]);
    selectNodes(["c"]);

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds).toEqual(new Set(["c"]));
  });

  it("selectEdges replaces edge selection and clears nodes", () => {
    const { selectNodes, selectEdges } = useSelectionStore.getState();
    selectNodes(["a"]);
    selectEdges(["e1", "e2"]);

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds.size).toBe(0);
    expect(state.selectedEdgeIds).toEqual(new Set(["e1", "e2"]));
  });

  it("addNodesToSelection appends to existing selection", () => {
    const { selectNodes, addNodesToSelection } = useSelectionStore.getState();
    selectNodes(["a"]);
    addNodesToSelection(["b", "c"]);

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("addEdgesToSelection appends to existing edge selection", () => {
    const { selectEdges, addEdgesToSelection } = useSelectionStore.getState();
    selectEdges(["e1"]);
    addEdgesToSelection(["e2"]);

    const state = useSelectionStore.getState();
    expect(state.selectedEdgeIds).toEqual(new Set(["e1", "e2"]));
  });

  it("clearSelection empties both sets", () => {
    const { selectNodes, selectEdges, clearSelection } =
      useSelectionStore.getState();
    selectNodes(["a", "b"]);
    selectEdges(["e1"]);
    clearSelection();

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds.size).toBe(0);
    expect(state.selectedEdgeIds.size).toBe(0);
  });

  it("setHover sets and clears the hovered node", () => {
    const { setHover } = useSelectionStore.getState();
    setHover("node-42");
    expect(useSelectionStore.getState().hoveredNodeId).toBe("node-42");

    setHover(null);
    expect(useSelectionStore.getState().hoveredNodeId).toBeNull();
  });

  it("addNodesToSelection is idempotent for existing IDs", () => {
    const { selectNodes, addNodesToSelection } = useSelectionStore.getState();
    selectNodes(["a"]);
    addNodesToSelection(["a", "b"]);

    const state = useSelectionStore.getState();
    expect(state.selectedNodeIds).toEqual(new Set(["a", "b"]));
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("SelectionStore: edge cases (audit)", () => {
  it("selectNodes with empty array clears selection", () => {
    const { selectNodes } = useSelectionStore.getState();
    selectNodes(["a", "b"]);
    selectNodes([]);
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
  });

  it("addNodesToSelection with empty array is a no-op", () => {
    const { selectNodes, addNodesToSelection } = useSelectionStore.getState();
    selectNodes(["a"]);
    addNodesToSelection([]);
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["a"]),
    );
  });
});

// ── Toggle selection (bug fix) ──────────────────────────────────────

describe("toggleNodeSelection", () => {
  it("adds node when not selected", () => {
    const { selectNodes, toggleNodeSelection } = useSelectionStore.getState();
    selectNodes(["a"]);
    toggleNodeSelection("b");
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("removes node when already selected", () => {
    const { selectNodes, toggleNodeSelection } = useSelectionStore.getState();
    selectNodes(["a", "b"]);
    toggleNodeSelection("a");
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["b"]),
    );
  });
});
