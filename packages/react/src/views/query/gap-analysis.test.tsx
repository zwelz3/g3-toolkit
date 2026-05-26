/**
 * Gap analysis implementations tests:
 * - Path analysis (R2.13)
 * - Undo/redo stack (R2.14)
 * - Query editor (R1.13)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { findShortestPath } from "@g3t/core";
import { UndoRedoStack } from "@g3t/core";
import { QueryEditor } from "../../views/query";

// ── Path Analysis (R2.13) ──────────────────────────────────────────

describe("findShortestPath (R2.13)", () => {
  function createTestGraph(): UGM {
    const ugm = new UGM();
    for (let i = 0; i < 20; i++) {
      ugm.addNode(`n${i}`, { types: ["Node"] });
    }
    // Chain: n0-n1-n2-...-n19
    for (let i = 0; i < 19; i++) {
      ugm.addEdge(`n${i}`, `n${i + 1}`, { type: "next" });
    }
    // Shortcut: n0-n10
    ugm.addEdge("n0", "n10", { type: "shortcut" });
    return ugm;
  }

  it("finds shortest path between n0 and n19", () => {
    const ugm = createTestGraph();
    const result = findShortestPath(ugm, "n0", "n19");

    expect(result.found).toBe(true);
    expect(result.nodeIds[0]).toBe("n0");
    expect(result.nodeIds[result.nodeIds.length - 1]).toBe("n19");
    // Via shortcut: n0→n10→n11→...→n19 = 10 hops
    // Via chain: n0→n1→...→n19 = 19 hops
    // BFS finds the shortcut path
    expect(result.length).toBeLessThan(19);
  });

  it("returns same node for source == target", () => {
    const ugm = createTestGraph();
    const result = findShortestPath(ugm, "n5", "n5");

    expect(result.found).toBe(true);
    expect(result.nodeIds).toEqual(["n5"]);
    expect(result.length).toBe(0);
  });

  it("returns not found for disconnected nodes", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    // No edges

    const result = findShortestPath(ugm, "a", "b");
    expect(result.found).toBe(false);
  });

  it("returns not found for nonexistent nodes", () => {
    const ugm = createTestGraph();
    const result = findShortestPath(ugm, "n0", "missing");
    expect(result.found).toBe(false);
  });

  it("respects maxHops constraint", () => {
    const ugm = createTestGraph();
    const result = findShortestPath(ugm, "n0", "n19", { maxHops: 5 });
    // n0 to n19 requires at least 10 hops (via shortcut)
    expect(result.found).toBe(false);
  });

  it("respects edge type filter", () => {
    const ugm = createTestGraph();
    // Only traverse "next" edges (skip shortcut)
    const result = findShortestPath(ugm, "n0", "n19", {
      edgeTypes: ["next"],
    });

    expect(result.found).toBe(true);
    expect(result.length).toBe(19); // must take the long path
  });

  it("returns correct edge IDs along the path", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addNode("c", { types: ["X"] });
    const e1 = ugm.addEdge("a", "b", { type: "link" });
    const e2 = ugm.addEdge("b", "c", { type: "link" });

    const result = findShortestPath(ugm, "a", "c");
    expect(result.found).toBe(true);
    expect(result.edgeIds).toEqual([e1, e2]);
    expect(result.nodeIds).toEqual(["a", "b", "c"]);
  });
});

// ── Undo/Redo (R2.14) ──────────────────────────────────────────────

describe("UndoRedoStack (R2.14)", () => {
  it("undoes an add-node operation", () => {
    const stack = new UndoRedoStack();
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    // Record state before mutation
    stack.push(ugm);
    ugm.addNode("b", { types: ["X"] });
    expect(ugm.nodeCount).toBe(2);

    // Undo
    const restored = stack.undo(ugm);
    expect(restored).not.toBeNull();
    expect(restored!.nodeCount).toBe(1);
    expect(restored!.hasNode("a")).toBe(true);
    expect(restored!.hasNode("b")).toBe(false);
  });

  it("redoes after undo", () => {
    const stack = new UndoRedoStack();
    const ugm = new UGM();

    stack.push(ugm);
    ugm.addNode("a", { types: ["X"] });
    expect(ugm.nodeCount).toBe(1);

    const afterUndo = stack.undo(ugm)!;
    expect(afterUndo.nodeCount).toBe(0);

    const afterRedo = stack.redo(afterUndo)!;
    expect(afterRedo.nodeCount).toBe(1);
  });

  it("clears redo stack on new action", () => {
    const stack = new UndoRedoStack();
    const ugm = new UGM();

    stack.push(ugm); // state 0
    ugm.addNode("a", { types: ["X"] });

    const afterUndo = stack.undo(ugm)!;
    expect(stack.canRedo).toBe(true);

    // New action clears redo
    stack.push(afterUndo);
    afterUndo.addNode("b", { types: ["X"] });
    expect(stack.canRedo).toBe(false);
  });

  it("enforces max depth", () => {
    const stack = new UndoRedoStack({ maxDepth: 3 });
    const ugm = new UGM();

    for (let i = 0; i < 5; i++) {
      stack.push(ugm);
    }

    expect(stack.undoCount).toBe(3);
  });

  it("returns null when nothing to undo/redo", () => {
    const stack = new UndoRedoStack();
    const ugm = new UGM();

    expect(stack.undo(ugm)).toBeNull();
    expect(stack.redo(ugm)).toBeNull();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it("clear empties both stacks", () => {
    const stack = new UndoRedoStack();
    const ugm = new UGM();
    stack.push(ugm);
    stack.push(ugm);

    stack.clear();
    expect(stack.undoCount).toBe(0);
    expect(stack.redoCount).toBe(0);
  });
});

// ── Query Editor (R1.13) ────────────────────────────────────────────

describe("QueryEditor (R1.13)", () => {
  it("renders with language selector and execute button", () => {
    render(<QueryEditor />);

    expect(screen.getByTestId("query-editor")).toBeInTheDocument();
    expect(screen.getByTestId("query-language")).toBeInTheDocument();
    expect(screen.getByTestId("query-execute")).toBeInTheDocument();
    expect(screen.getByTestId("query-input")).toBeInTheDocument();
  });

  it("execute button is disabled without adapter", () => {
    render(<QueryEditor />);
    const btn = screen.getByTestId("query-execute") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("executes query and calls onResult", async () => {
    const mockUGM = new UGM();
    mockUGM.addNode("result", { types: ["X"] });

    const mockAdapter = {
      name: "Mock",
      id: "mock",
      query: vi.fn().mockResolvedValue(mockUGM),
      expandNeighborhood: vi.fn(),
      getSchema: vi.fn(),
      getNodeProperties: vi.fn(),
    };
    const onResult = vi.fn();

    render(<QueryEditor adapter={mockAdapter} onResult={onResult} />);

    // Type a query
    fireEvent.change(screen.getByTestId("query-input"), {
      target: { value: "SELECT * WHERE { ?s ?p ?o }" },
    });

    // Click execute
    fireEvent.click(screen.getByTestId("query-execute"));

    await waitFor(() => {
      expect(mockAdapter.query).toHaveBeenCalledWith(
        "SELECT * WHERE { ?s ?p ?o }",
      );
      expect(onResult).toHaveBeenCalledWith(mockUGM);
    });
  });

  it("displays error on query failure", async () => {
    const mockAdapter = {
      name: "Mock",
      id: "mock",
      query: vi.fn().mockRejectedValue(new Error("Syntax error")),
      expandNeighborhood: vi.fn(),
      getSchema: vi.fn(),
      getNodeProperties: vi.fn(),
    };
    const onError = vi.fn();

    render(<QueryEditor adapter={mockAdapter} onError={onError} />);

    fireEvent.change(screen.getByTestId("query-input"), {
      target: { value: "BAD QUERY" },
    });
    fireEvent.click(screen.getByTestId("query-execute"));

    await waitFor(() => {
      expect(screen.getByTestId("query-error")).toHaveTextContent(
        "Syntax error",
      );
    });
  });

  it("switches query language", () => {
    render(<QueryEditor />);

    fireEvent.change(screen.getByTestId("query-language"), {
      target: { value: "cypher" },
    });

    const input = screen.getByTestId("query-input") as HTMLTextAreaElement;
    expect(input.placeholder).toContain("MATCH");
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("findShortestPath: edge cases (audit)", () => {
  it("handles circular graph without infinite loop", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addNode("c", { types: ["X"] });
    ugm.addEdge("a", "b", { type: "link" });
    ugm.addEdge("b", "c", { type: "link" });
    ugm.addEdge("c", "a", { type: "link" });

    const result = findShortestPath(ugm, "a", "c");
    expect(result.found).toBe(true);
    // Direct path a→b→c or a←c (2 or 1 hop depending on direction)
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

describe("UndoRedoStack: edge cases (audit)", () => {
  it("supports multiple sequential undos", () => {
    const stack = new UndoRedoStack();
    const ugm = new UGM();

    stack.push(ugm); // state 0: empty
    ugm.addNode("a", { types: ["X"] });
    stack.push(ugm); // state 1: a
    ugm.addNode("b", { types: ["X"] });
    // current: a, b

    const after1 = stack.undo(ugm)!;
    expect(after1.nodeCount).toBe(1); // state 1: a

    const after2 = stack.undo(after1)!;
    expect(after2.nodeCount).toBe(0); // state 0: empty
  });
});

describe("QueryEditor: edge cases (audit)", () => {
  it("execute button disabled with empty query text", () => {
    const mockAdapter = {
      name: "Mock",
      id: "mock",
      query: vi.fn(),
      expandNeighborhood: vi.fn(),
      getSchema: vi.fn(),
      getNodeProperties: vi.fn(),
    };
    render(<QueryEditor adapter={mockAdapter} />);

    const btn = screen.getByTestId("query-execute") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
