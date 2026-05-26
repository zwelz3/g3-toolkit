/**
 * ContextMenuManager tests covering E0.4 acceptance criteria:
 *
 * T1: Register item; invoke; verify action callback.
 * T3: Register plugin item with filter; verify filtered resolution.
 */

import { describe, it, expect, vi } from "vitest";
import {
  ContextMenuManager,
  createDefaultMenuManager,
} from "./ContextMenuManager";
import type { MenuTarget } from "./types";

const nodeTarget: MenuTarget = {
  type: "node",
  id: "alice",
  position: { x: 100, y: 200 },
  data: { types: ["Person"] },
};

const edgeTarget: MenuTarget = {
  type: "edge",
  id: "edge-1",
  position: { x: 150, y: 250 },
  data: { type: "knows" },
};

const bgTarget: MenuTarget = {
  type: "background",
  position: { x: 300, y: 400 },
};

// ── T1: Context menu infrastructure ─────────────────────────────────

describe("ContextMenuManager (M0.E4.T1)", () => {
  it("registers and resolves built-in items", () => {
    const manager = new ContextMenuManager();
    const action = vi.fn();

    manager.addBuiltinItems([{ id: "test-item", label: "Test", action }]);

    const items = manager.resolve(nodeTarget);
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toBe("Test");
  });

  it("invokes action when item is triggered", () => {
    const manager = new ContextMenuManager();
    const action = vi.fn();

    manager.addBuiltinItems([{ id: "test-item", label: "Test", action }]);

    const items = manager.resolve(nodeTarget);
    items[0]!.action(nodeTarget);
    expect(action).toHaveBeenCalledWith(nodeTarget);
  });

  it("filters items by target type", () => {
    const manager = new ContextMenuManager();

    manager.addBuiltinItems([
      {
        id: "node-only",
        label: "Node Only",
        action: vi.fn(),
        filter: (t) => t.type === "node",
      },
      {
        id: "edge-only",
        label: "Edge Only",
        action: vi.fn(),
        filter: (t) => t.type === "edge",
      },
      {
        id: "always",
        label: "Always",
        action: vi.fn(),
      },
    ]);

    const nodeItems = manager.resolve(nodeTarget);
    expect(nodeItems.map((i) => i.id)).toEqual(["node-only", "always"]);

    const edgeItems = manager.resolve(edgeTarget);
    expect(edgeItems.map((i) => i.id)).toEqual(["edge-only", "always"]);

    const bgItems = manager.resolve(bgTarget);
    expect(bgItems.map((i) => i.id)).toEqual(["always"]);
  });
});

describe("createDefaultMenuManager (M0.E4.T1)", () => {
  it("includes Inspect and Copy IRI for nodes", () => {
    const onInspect = vi.fn();
    const manager = createDefaultMenuManager({ onInspect });
    const items = manager.resolve(nodeTarget);

    expect(items.map((i) => i.id)).toContain("inspect-properties");
    expect(items.map((i) => i.id)).toContain("copy-iri");
  });

  it("excludes Inspect and Copy IRI for background", () => {
    const manager = createDefaultMenuManager();
    const items = manager.resolve(bgTarget);

    expect(items).toHaveLength(0);
  });

  it("fires onInspect callback", () => {
    const onInspect = vi.fn();
    const manager = createDefaultMenuManager({ onInspect });
    const items = manager.resolve(nodeTarget);

    const inspectItem = items.find((i) => i.id === "inspect-properties");
    inspectItem!.action(nodeTarget);
    expect(onInspect).toHaveBeenCalledWith(nodeTarget);
  });
});

// ── T2: Wire to Cytoscape (tested via integration, not unit) ────────
// Wiring is a React concern tested in CytoscapeCanvas integration.
// The manager's resolve() is the unit-testable surface.

describe("ContextMenuManager: right-click targets (M0.E4.T2)", () => {
  it("resolves different items for node vs edge vs background", () => {
    const manager = createDefaultMenuManager();

    const nodeItems = manager.resolve(nodeTarget);
    const edgeItems = manager.resolve(edgeTarget);
    const bgItems = manager.resolve(bgTarget);

    // Nodes and edges get inspect + copy; background gets nothing
    expect(nodeItems.length).toBeGreaterThan(0);
    expect(edgeItems.length).toBeGreaterThan(0);
    expect(bgItems).toHaveLength(0);
  });
});

// ── T3: Plugin extension API ────────────────────────────────────────

describe("ContextMenuManager plugin API (M0.E4.T3)", () => {
  it("registers plugin items that appear in resolution", () => {
    const manager = createDefaultMenuManager();
    const pluginAction = vi.fn();

    manager.register("my-plugin", [
      { id: "plugin-action", label: "Plugin Action", action: pluginAction },
    ]);

    const items = manager.resolve(nodeTarget);
    expect(items.map((i) => i.id)).toContain("plugin-action");
  });

  it("plugin items with filter only appear when filter matches", () => {
    const manager = new ContextMenuManager();

    manager.register("typed-plugin", [
      {
        id: "person-action",
        label: "Person Only",
        action: vi.fn(),
        filter: (t) =>
          t.type === "node" &&
          Array.isArray(t.data?.types) &&
          t.data.types.includes("Person"),
      },
    ]);

    const personTarget: MenuTarget = {
      type: "node",
      id: "alice",
      position: { x: 0, y: 0 },
      data: { types: ["Person"] },
    };
    const orgTarget: MenuTarget = {
      type: "node",
      id: "acme",
      position: { x: 0, y: 0 },
      data: { types: ["Organization"] },
    };

    const personItems = manager.resolve(personTarget);
    expect(personItems.map((i) => i.id)).toContain("person-action");

    const orgItems = manager.resolve(orgTarget);
    expect(orgItems.map((i) => i.id)).not.toContain("person-action");
  });

  it("unregisters plugin items", () => {
    const manager = new ContextMenuManager();
    manager.register("temp-plugin", [
      { id: "temp", label: "Temp", action: vi.fn() },
    ]);

    expect(manager.resolve(nodeTarget).map((i) => i.id)).toContain("temp");

    manager.unregister("temp-plugin");
    expect(manager.resolve(nodeTarget).map((i) => i.id)).not.toContain("temp");
  });

  it("tracks registered plugin IDs", () => {
    const manager = new ContextMenuManager();
    manager.register("plugin-a", [{ id: "a", label: "A", action: vi.fn() }]);
    manager.register("plugin-b", [{ id: "b", label: "B", action: vi.fn() }]);

    expect(manager.getRegisteredPlugins().sort()).toEqual([
      "plugin-a",
      "plugin-b",
    ]);
  });

  it("adds separator before plugin group", () => {
    const manager = createDefaultMenuManager();
    manager.register("my-plugin", [
      { id: "plugin-item", label: "Plugin", action: vi.fn() },
    ]);

    const items = manager.resolve(nodeTarget);
    const pluginItem = items.find((i) => i.id === "plugin-item");
    expect(pluginItem!.separator).toBe(true);
  });
});
