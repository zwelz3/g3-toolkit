/**
 * Tests for toolkit context menu actions and neighborhood builder.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { UGM } from "@g3t/core";
import { ContextMenuManager } from "../../interaction/context-menu";
import { G3tEventBus } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { useStyleOverrideStore } from "../../state/style-override-store";
import { usePositionPinStore } from "../../state/position-pin-store";
import {
  //
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "./toolkit-actions";

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
  useStyleOverrideStore.setState({ overrides: [] });
  usePositionPinStore.setState({ pinnedIds: [], allPinned: false });
});

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["Person"], properties: { name: "Alice" } });
  ugm.addNode("b", { types: ["Person"], properties: { name: "Bob" } });
  ugm.addNode("c", { types: ["Org"], properties: { name: "Acme" } });
  ugm.addNode("d", { types: ["Location"], properties: { name: "NYC" } });
  ugm.addEdge("a", "b", { type: "knows" });
  ugm.addEdge("b", "c", { type: "worksAt" });
  ugm.addEdge("c", "d", { type: "locatedIn" });
  return ugm;
}

// ── Single-Node Actions ─────────────────────────────────────────────

describe("registerToolkitActions: single-node", () => {
  it("registers inspect action", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    expect(items.find((i) => i.id === "inspect")).toBeDefined();
  });

  it("inspect selects the node", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "inspect")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["a"]),
    );
  });

  it("view-neighbors emits event", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    const handler = vi.fn();
    bus.on("context:viewNeighbors", handler);

    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });
    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "view-neighbors")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });

    expect(handler).toHaveBeenCalledWith({ nodeId: "a", hops: 2 });
  });

  it("expand-neighbors adds neighbors to selection", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "expand-neighbors")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });

    // "a" neighbors: "b"
    expect(useSelectionStore.getState().selectedNodeIds.has("b")).toBe(true);
  });

  it("edit-appearance emits event and calls callback", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    const onEdit = vi.fn();
    const handler = vi.fn();
    bus.on("context:editAppearance", handler);

    registerToolkitActions(manager, {
      ugm: makeUGM(),
      eventBus: bus,
      onEditAppearance: onEdit,
    });

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "edit-appearance")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });

    expect(handler).toHaveBeenCalledWith({ nodeId: "a" });
    expect(onEdit).toHaveBeenCalledWith("a");
  });

  it("registers exactly one pin action per node (pin-position; pin-node removed as a duplicate concept)", () => {
    const manager = new ContextMenuManager();
    registerToolkitActions(manager, {
      ugm: makeUGM(),
      eventBus: new G3tEventBus(),
    });
    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    const pinItems = items.filter((i) => /pin/i.test(i.label));
    expect(pinItems.map((i) => i.id)).toEqual(["pin-position"]);
  });

  it("hide-node emits event", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    const handler = vi.fn();
    bus.on("context:hideNodes", handler);

    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });
    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "hide-node")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });

    expect(handler).toHaveBeenCalledWith({ nodeIds: ["a"] });
  });

  it("node actions do not appear for edge targets", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    const items = manager.resolve({
      type: "edge",
      id: "e1",
      position: { x: 0, y: 0 },
    });
    expect(items.find((i) => i.id === "view-neighbors")).toBeUndefined();
    expect(items.find((i) => i.id === "expand-neighbors")).toBeUndefined();
  });
});

// ── Single-Edge Actions ─────────────────────────────────────────────

describe("registerToolkitActions: single-edge", () => {
  it("registers inspect-edge action", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    const items = manager.resolve({
      type: "edge",
      id: "e1",
      position: { x: 0, y: 0 },
    });
    expect(items.find((i) => i.id === "inspect-edge")).toBeDefined();
  });

  it("select-endpoints selects source and target", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    const items = manager.resolve({
      type: "edge",
      id: "e1",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "select-endpoints")
      ?.action({
        type: "edge",
        id: "e1",
        position: { x: 0, y: 0 },
        data: { source: "a", target: "b" },
      });

    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["a", "b"]),
    );
  });
});

// ── Multi-Select Actions ────────────────────────────────────────────

describe("registerToolkitActions: multi-select", () => {
  it("view-subgraph emits event with selected IDs", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    const handler = vi.fn();
    bus.on("context:viewSubgraph", handler);

    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    // Select 3 nodes
    useSelectionStore.getState().selectNodes(["a", "b", "c"]);

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "view-subgraph")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });

    expect(handler).toHaveBeenCalledWith({
      nodeIds: expect.arrayContaining(["a", "b", "c"]),
    });
  });

  it("find-shortest-path emits event when exactly 2 selected", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    const handler = vi.fn();
    bus.on("context:findPath", handler);

    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    useSelectionStore.getState().selectNodes(["a", "c"]);

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "find-shortest-path")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });

    expect(handler).toHaveBeenCalledWith({
      sourceId: expect.any(String),
      targetId: expect.any(String),
    });
  });

  it("bulk-color-red creates overrides for all selected", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    useSelectionStore.getState().selectNodes(["a", "b"]);

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "bulk-color-red")
      ?.action({ type: "node", id: "a", position: { x: 0, y: 0 } });

    const overrides = useStyleOverrideStore.getState().overrides;
    expect(overrides).toHaveLength(2);
    expect(overrides.every((o) => o.color === "#ef4444")).toBe(true);
  });

  it("multi-select items hidden when only 1 node selected", () => {
    const manager = new ContextMenuManager();
    const bus = new G3tEventBus();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    useSelectionStore.getState().selectNodes(["a"]);

    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    expect(items.find((i) => i.id === "view-subgraph")).toBeUndefined();
    expect(items.find((i) => i.id === "bulk-color-red")).toBeUndefined();
  });
});

// ── Neighborhood Builder ────────────────────────────────────────────

describe("buildNeighborhoodUGM", () => {
  it("builds 1-hop neighborhood", () => {
    const ugm = makeUGM();
    const sub = buildNeighborhoodUGM(ugm, "a", 1);
    expect(sub.nodeCount).toBe(2); // a, b
    expect(sub.edgeCount).toBe(1); // a→b
    expect(sub.hasNode("a")).toBe(true);
    expect(sub.hasNode("b")).toBe(true);
    expect(sub.hasNode("c")).toBe(false);
  });

  it("builds 2-hop neighborhood", () => {
    const ugm = makeUGM();
    const sub = buildNeighborhoodUGM(ugm, "a", 2);
    expect(sub.nodeCount).toBe(3); // a, b, c
    expect(sub.hasNode("c")).toBe(true);
    expect(sub.hasNode("d")).toBe(false);
  });

  it("builds 3-hop neighborhood (entire graph)", () => {
    const ugm = makeUGM();
    const sub = buildNeighborhoodUGM(ugm, "a", 3);
    expect(sub.nodeCount).toBe(4); // a, b, c, d
  });

  it("preserves node properties", () => {
    const ugm = makeUGM();
    const sub = buildNeighborhoodUGM(ugm, "a", 1);
    expect(sub.getNode("a")?.properties.name).toBe("Alice");
  });

  it("preserves edge data", () => {
    const ugm = makeUGM();
    const sub = buildNeighborhoodUGM(ugm, "a", 1);
    expect(sub.edgeCount).toBe(1);
  });
});

describe("pin-position action (round 17)", () => {
  it("toggles the node's position pin in the store", () => {
    const bus = new G3tEventBus();
    const manager = new ContextMenuManager();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });

    const target = { type: "node" as const, id: "a", position: { x: 0, y: 0 } };
    const items = manager.resolve(target);
    const pin = items.find((i) => i.id === "pin-position");
    expect(pin).toBeTruthy();
    pin!.action(target);
    expect(usePositionPinStore.getState().pinnedIds).toEqual(["a"]);
    pin!.action(target);
    expect(usePositionPinStore.getState().pinnedIds).toEqual([]);
  });

  it("acts on the whole selection coherently when the target is multi-selected (9.16)", () => {
    const bus = new G3tEventBus();
    const manager = new ContextMenuManager();
    registerToolkitActions(manager, { ugm: makeUGM(), eventBus: bus });
    useSelectionStore.getState().selectNodes(["a", "b", "c"]);
    // b is ALREADY pinned: a mixed selection. Pinning via unpinned
    // target a must pin ALL THREE (adopt the target's new state),
    // not toggle b off.
    usePositionPinStore.getState().pin("b");
    const target = { type: "node" as const, id: "a", position: { x: 0, y: 0 } };
    const pin = manager.resolve(target).find((i) => i.id === "pin-position");
    pin!.action(target);
    expect([...usePositionPinStore.getState().pinnedIds].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
    // And unpinning via now-pinned target a releases all three.
    pin!.action(target);
    expect(usePositionPinStore.getState().pinnedIds).toEqual([]);
  });
});
