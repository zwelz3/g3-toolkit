/**
 * Tests for F1-F8 features.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UGM } from "@core/ugm";
import { ComboManager } from "@core/combo";
import {
  computeIncrementalUpdate,
  capturePositions,
} from "@core/layout/incremental-layout";
import {
  createLocalAnnotationStore,
  AnnotationPanel,
} from "@interaction/annotations";
import { PropertyEditor } from "@interaction/property-editor";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", {
    types: ["Person"],
    properties: { name: "Alice", age: 30 },
  });
  ugm.addNode("b", { types: ["Person"], properties: { name: "Bob", age: 25 } });
  ugm.addNode("c", { types: ["Org"], properties: { name: "Acme" } });
  ugm.addEdge("a", "c", { type: "worksAt" });
  ugm.addEdge("b", "c", { type: "worksAt" });
  return ugm;
}

// ── F2: Incremental Layout ──────────────────────────────────────

describe("computeIncrementalUpdate (F2)", () => {
  it("detects no changes", () => {
    const prev = new Map([["a", { x: 0, y: 0 }]]);
    const result = computeIncrementalUpdate(
      prev,
      new Set(["a"]),
      new Set(["a"]),
    );
    expect(result.mode).toBe("none");
  });

  it("detects small addition as incremental", () => {
    const prev = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 10, y: 10 }],
    ]);
    const result = computeIncrementalUpdate(
      prev,
      new Set(["a", "b", "c"]),
      new Set(["a", "b"]),
    );
    expect(result.mode).toBe("incremental");
    expect(result.addedIds).toEqual(["c"]);
    expect(result.lockedIds).toContain("a");
    expect(result.lockedIds).toContain("b");
  });

  it("detects large change as full relayout", () => {
    const prev = new Map([["a", { x: 0, y: 0 }]]);
    const result = computeIncrementalUpdate(
      prev,
      new Set(["x", "y", "z"]),
      new Set(["a"]),
    );
    expect(result.mode).toBe("full");
  });
});

// ── F3: Combo Manager ───────────────────────────────────────────

describe("ComboManager (F3)", () => {
  it("creates and dissolves combos", () => {
    const mgr = new ComboManager();
    const id = mgr.createCombo(["a", "b"], "Team");
    expect(mgr.get(id)?.label).toBe("Team");
    expect(mgr.get(id)?.memberIds.has("a")).toBe(true);

    mgr.dissolve(id);
    expect(mgr.get(id)).toBeUndefined();
  });

  it("toggles collapse state", () => {
    const mgr = new ComboManager();
    const id = mgr.createCombo(["a", "b"]);
    expect(mgr.get(id)?.collapsed).toBe(false);

    mgr.toggleCollapse(id);
    expect(mgr.get(id)?.collapsed).toBe(true);

    mgr.toggleCollapse(id);
    expect(mgr.get(id)?.collapsed).toBe(false);
  });

  it("applies collapsed combos to UGM", () => {
    const ugm = makeUGM();
    const mgr = new ComboManager();
    const id = mgr.createCombo(["a", "b"], "People");
    mgr.collapse(id);

    const result = mgr.applyToUGM(ugm);
    // a and b should be hidden; combo node should exist
    expect(result.hasNode("a")).toBe(false);
    expect(result.hasNode("b")).toBe(false);
    expect(result.hasNode(id)).toBe(true);
    expect(result.getNode(id)?.properties.name).toBe("People");
  });

  it("applies expanded combos with parent field", () => {
    const ugm = makeUGM();
    const mgr = new ComboManager();
    const id = mgr.createCombo(["a", "b"], "Team");
    // Default is expanded

    const result = mgr.applyToUGM(ugm);
    expect(result.hasNode("a")).toBe(true);
    expect(result.getNode("a")?.properties.parent).toBe(id);
  });

  it("serializes and deserializes", () => {
    const mgr = new ComboManager();
    mgr.createCombo(["a", "b"], "Team");
    mgr.createCombo(["c"], "Solo");

    const json = mgr.serialize();
    const restored = ComboManager.deserialize(json);
    expect(restored.getAll().length).toBe(2);
    expect(restored.findComboForNode("a")).toBeDefined();
  });
});

// ── F4: Annotations ─────────────────────────────────────────────

describe("AnnotationPanel (F4)", () => {
  it("shows empty state when no element selected", () => {
    render(<AnnotationPanel elementId={null} />);
    expect(screen.getByText(/Select a node/i)).toBeInTheDocument();
  });

  it("renders text input when element is selected", () => {
    render(<AnnotationPanel elementId="test-node" />);
    expect(screen.getByTestId("annotation-input")).toBeInTheDocument();
  });
});

describe("createLocalAnnotationStore (F4)", () => {
  it("stores and retrieves annotations", async () => {
    const store = createLocalAnnotationStore("test-annot");
    await store.set("n1", {
      elementId: "n1",
      text: "Test note",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = await store.get("n1");
    expect(result?.text).toBe("Test note");

    await store.delete("n1");
    const deleted = await store.get("n1");
    expect(deleted).toBeNull();
  });
});

// ── F5: Property Editor ─────────────────────────────────────────

describe("PropertyEditor (F5)", () => {
  it("renders non-internal properties", () => {
    const ugm = makeUGM();
    render(<PropertyEditor ugm={ugm} elementType="node" elementId="a" />);
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("enters edit mode on click", async () => {
    const ugm = makeUGM();
    render(<PropertyEditor ugm={ugm} elementType="node" elementId="a" />);
    fireEvent.click(screen.getByText("Alice"));
    const input = screen.getByTestId("edit-name");
    expect(input).toBeInTheDocument();
  });

  it("calls onEdit callback", async () => {
    const ugm = makeUGM();
    const onEdit = {
      onPropertyChange: vi.fn().mockResolvedValue(true),
    };
    render(
      <PropertyEditor
        ugm={ugm}
        elementType="node"
        elementId="a"
        onEdit={onEdit}
      />,
    );
    fireEvent.click(screen.getByText("Alice"));
    const input = screen.getByTestId("edit-name");
    fireEvent.change(input, { target: { value: "Alicia" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onEdit.onPropertyChange).toHaveBeenCalledWith(
        "node",
        "a",
        "name",
        "Alice",
        "Alicia",
      );
    });
  });
});
