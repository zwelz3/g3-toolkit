/**
 * Compartment-collapse context-menu actions.
 *
 * @see roadmap/design/structural-rendering.md
 * @see specs/01-functional-views.md R1.18
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ContextMenuManager } from "./ContextMenuManager";
import {
  registerCompartmentCollapseActions,
  compartmentCollapseSubmenu,
} from "./compartment-collapse-menu";
import { useCompartmentCollapseStore } from "../../state/compartment-collapse-store";
import type { MenuTarget } from "./types";

function containerTarget(id: string, compartmentIds: string[]): MenuTarget {
  return {
    type: "node",
    id,
    position: { x: 0, y: 0 },
    data: {
      _structuralContainer: true,
      _compartmentIds: compartmentIds,
    },
  };
}

describe("registerCompartmentCollapseActions", () => {
  beforeEach(() => {
    useCompartmentCollapseStore.getState().clear();
  });

  it("offers the toggle on structural containers, hides it elsewhere", () => {
    const manager = new ContextMenuManager();
    registerCompartmentCollapseActions(manager);

    const onContainer = manager.resolve(
      containerTarget("Sensor", ["attributes", "operations"]),
    );
    expect(onContainer.map((i) => i.id)).toContain("collapse-compartments");

    const plainNode: MenuTarget = {
      type: "node",
      id: "plain",
      position: { x: 0, y: 0 },
      data: {},
    };
    expect(manager.resolve(plainNode).map((i) => i.id)).not.toContain(
      "collapse-compartments",
    );

    const bg: MenuTarget = { type: "background", position: { x: 0, y: 0 } };
    expect(manager.resolve(bg).map((i) => i.id)).not.toContain(
      "collapse-compartments",
    );
  });

  it("toggling collapses all of a container's compartments at once", () => {
    const manager = new ContextMenuManager();
    registerCompartmentCollapseActions(manager);
    const target = containerTarget("Sensor", ["attributes", "operations"]);
    const item = manager
      .resolve(target)
      .find((i) => i.id === "collapse-compartments")!;

    item.action(target);
    expect(
      [...useCompartmentCollapseStore.getState().collapsedKeys].sort(),
    ).toEqual(["Sensor::attributes", "Sensor::operations"]);

    // Second invocation expands them all (toggleAll semantics).
    item.action(target);
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([]);
  });

  it("does not offer the action for a container with no compartments", () => {
    const manager = new ContextMenuManager();
    registerCompartmentCollapseActions(manager);
    const empty = containerTarget("Empty", []);
    expect(manager.resolve(empty).map((i) => i.id)).not.toContain(
      "collapse-compartments",
    );
  });

  it("offers a compartment-scoped toggle when a row is right-clicked", () => {
    const manager = new ContextMenuManager();
    registerCompartmentCollapseActions(manager);
    const rowTarget: MenuTarget = {
      type: "node",
      id: "Sensor::attributes::row1",
      position: { x: 0, y: 0 },
      data: { parent: "Sensor", _compartment: "attributes" },
    };
    const items = manager.resolve(rowTarget).map((i) => i.id);
    expect(items).toContain("collapse-this-compartment");
    expect(items).not.toContain("collapse-compartments");

    const action = manager
      .resolve(rowTarget)
      .find((i) => i.id === "collapse-this-compartment")!;
    action.action(rowTarget);
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([
      "Sensor::attributes",
    ]);
    action.action(rowTarget);
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([]);
  });

  it("toggles only the clicked compartment, leaving siblings alone", () => {
    const manager = new ContextMenuManager();
    registerCompartmentCollapseActions(manager);
    useCompartmentCollapseStore.getState().collapse("Sensor::operations");
    const attrRow: MenuTarget = {
      type: "node",
      id: "Sensor::attributes::row1",
      position: { x: 0, y: 0 },
      data: { parent: "Sensor", _compartment: "attributes" },
    };
    manager
      .resolve(attrRow)
      .find((i) => i.id === "collapse-this-compartment")!
      .action(attrRow);
    expect(
      [...useCompartmentCollapseStore.getState().collapsedKeys].sort(),
    ).toEqual(["Sensor::attributes", "Sensor::operations"]);
  });
});

describe("compartmentCollapseSubmenu", () => {
  beforeEach(() => {
    useCompartmentCollapseStore.getState().clear();
  });

  it("returns one toggle per compartment when there are 2+", () => {
    const sub = compartmentCollapseSubmenu(
      containerTarget("Sensor", ["attributes", "operations"]),
    );
    expect(sub.map((i) => i.id)).toEqual([
      "collapse-compartment-attributes",
      "collapse-compartment-operations",
    ]);
    sub[1]!.action({} as MenuTarget);
    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([
      "Sensor::operations",
    ]);
  });

  it("returns nothing for a single-compartment container", () => {
    expect(
      compartmentCollapseSubmenu(containerTarget("Lens", ["attributes"])),
    ).toEqual([]);
  });

  it("returns nothing for non-containers", () => {
    const plain: MenuTarget = {
      type: "node",
      id: "p",
      position: { x: 0, y: 0 },
      data: {},
    };
    expect(compartmentCollapseSubmenu(plain)).toEqual([]);
  });
});
