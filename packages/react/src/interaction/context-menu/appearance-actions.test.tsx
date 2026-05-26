/**
 * Tests for appearance / multi-selection context-menu actions
 * (M12.E2.T3, M12.E4.T1, M12.E4.T2).
 *
 * Extracted from interaction/remaining-tickets.test.tsx during P3.5.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextMenuManager } from "./ContextMenuManager";
import {
  registerEditAppearance,
  registerMultiSelectMenu,
  applyBulkStyle,
} from "./appearance-actions";
import { useStyleOverrideStore } from "../../state/style-override-store";

beforeEach(() => {
  useStyleOverrideStore.setState({ overrides: [] });
});

// ── Edit Appearance Registration (M12.E2.T3) ────────────────────────

describe("registerEditAppearance", () => {
  it("registers 'Edit Appearance' menu item", () => {
    const manager = new ContextMenuManager();
    registerEditAppearance(manager, vi.fn());
    const items = manager.resolve({
      type: "node",
      id: "n1",
      position: { x: 0, y: 0 },
    });
    const editItem = items.find((i) => i.id === "edit-appearance");
    expect(editItem).toBeDefined();
    expect(editItem?.label).toBe("Edit Appearance");
  });

  it("calls onEdit with node ID when action invoked", () => {
    const manager = new ContextMenuManager();
    const onEdit = vi.fn();
    registerEditAppearance(manager, onEdit);
    const items = manager.resolve({
      type: "node",
      id: "n1",
      position: { x: 0, y: 0 },
    });
    const editItem = items.find((i) => i.id === "edit-appearance");
    editItem?.action({ type: "node", id: "n1", position: { x: 0, y: 0 } });
    expect(onEdit).toHaveBeenCalledWith("n1");
  });

  it("does not show for background clicks", () => {
    const manager = new ContextMenuManager();
    registerEditAppearance(manager, vi.fn());
    const items = manager.resolve({
      type: "background",
      position: { x: 0, y: 0 },
    });
    const editItem = items.find((i) => i.id === "edit-appearance");
    expect(editItem).toBeUndefined();
  });
});

// ── Multi-Selection Context Menu (M12.E4.T1) ────────────────────────

describe("registerMultiSelectMenu", () => {
  it("registers bulk color items", () => {
    const manager = new ContextMenuManager();
    registerMultiSelectMenu(manager, {
      getSelectedIds: () => ["n1", "n2"],
    });
    const items = manager.resolve({
      type: "node",
      id: "n1",
      position: { x: 0, y: 0 },
    });
    expect(items.find((i) => i.id === "bulk-set-color-red")).toBeDefined();
  });

  it("bulk items hidden when single selection", () => {
    const manager = new ContextMenuManager();
    registerMultiSelectMenu(manager, {
      getSelectedIds: () => ["n1"], // only 1 selected
    });
    const items = manager.resolve({
      type: "node",
      id: "n1",
      position: { x: 0, y: 0 },
    });
    const bulkItem = items.find((i) => i.id === "bulk-set-color-red");
    expect(bulkItem).toBeUndefined();
  });
});

// ── Bulk Style Application (M12.E4.T2) ──────────────────────────────

describe("applyBulkStyle", () => {
  it("creates individual overrides for each node", () => {
    applyBulkStyle(["n1", "n2", "n3"], { color: "#ff0000" });
    const overrides = useStyleOverrideStore.getState().overrides;
    expect(overrides).toHaveLength(3);
    expect(overrides.every((o) => o.color === "#ff0000")).toBe(true);
    expect(
      overrides.map((o) => ("nodeId" in o.scope ? o.scope.nodeId : "")),
    ).toEqual(["n1", "n2", "n3"]);
  });
});
