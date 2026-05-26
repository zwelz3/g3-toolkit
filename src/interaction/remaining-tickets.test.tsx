/**
 * Tests for remaining M12 + M13 tickets.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@core/ugm";
import { ContextMenuManager } from "@interaction/context-menu";
import { useStyleOverrideStore } from "@state/style-override-store";
import { DerivedPropertyEngine } from "@core/advanced/advanced";
import {
  //
  registerEditAppearance,
  registerMultiSelectMenu,
  applyBulkStyle,
  TemporalRangeFilter,
  DerivedPropertyPanel,
} from "./remaining-tickets";

beforeEach(() => {
  useStyleOverrideStore.setState({ overrides: [] });
});

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("n1", {
    types: ["Person"],
    properties: { name: "Alice", risk: 0.9, date: "2025-03-15" },
  });
  ugm.addNode("n2", {
    types: ["Person"],
    properties: { name: "Bob", risk: 0.3, date: "2025-06-20" },
  });
  ugm.addNode("n3", {
    types: ["Org"],
    properties: { name: "Acme", risk: 0.5, date: "2025-09-01" },
  });
  return ugm;
}

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

// ── Temporal Range Filter (M13.E2.T2) ───────────────────────────────

describe("TemporalRangeFilter", () => {
  it("renders two range sliders", () => {
    const ugm = makeUGM();
    render(
      <TemporalRangeFilter ugm={ugm} timeProperty="date" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("temporal-range-filter")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-min")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-max")).toBeInTheDocument();
  });

  it("sliders have correct min/max from UGM data", () => {
    const ugm = makeUGM();
    const onChange = vi.fn();
    render(
      <TemporalRangeFilter ugm={ugm} timeProperty="date" onChange={onChange} />,
    );
    const minSlider = screen.getByTestId("temporal-min") as HTMLInputElement;
    const maxSlider = screen.getByTestId("temporal-max") as HTMLInputElement;

    // Both sliders should have the same global min/max range
    expect(minSlider.min).toBe(maxSlider.min);
    expect(minSlider.max).toBe(maxSlider.max);
    // Min should be <= max
    expect(Number(minSlider.value)).toBeLessThanOrEqual(
      Number(maxSlider.value),
    );
  });
});

// ── Derived Property Panel (M13.E3.T2) ──────────────────────────────

describe("DerivedPropertyPanel", () => {
  it("renders name and expression inputs", () => {
    const ugm = makeUGM();
    const engine = new DerivedPropertyEngine();
    render(
      <DerivedPropertyPanel ugm={ugm} engine={engine} onCompute={vi.fn()} />,
    );
    expect(screen.getByTestId("derived-property-panel")).toBeInTheDocument();
    expect(screen.getByTestId("derived-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("derived-expression-input")).toBeInTheDocument();
    expect(screen.getByTestId("derived-compute")).toBeInTheDocument();
  });

  it("shows existing definitions", () => {
    const ugm = makeUGM();
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "combo", expression: "risk * 100", reactive: false });
    engine.compute(ugm);

    render(
      <DerivedPropertyPanel ugm={ugm} engine={engine} onCompute={vi.fn()} />,
    );
    expect(screen.getByTestId("derived-combo")).toBeInTheDocument();
    expect(screen.getByTestId("derived-combo")).toHaveTextContent("risk * 100");
  });
});
