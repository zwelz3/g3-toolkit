/**
 * Context-menu actions for structural-view compartment collapse
 * (roadmap/design/structural-rendering.md, the collapse canvas
 * slice; R1.18 third acceptance criterion).
 *
 * Two surfaces, one store: this is the PER-CONTAINER runtime surface
 * (the component-config surface is the host setting the store's
 * initial state). The action filters to structural CONTAINER nodes
 * (which carry `_structuralContainer` and `_compartmentIds` from the
 * converter), reads the container's compartment ids from the target
 * data, and toggles them in the collapse store. The canvas host
 * subscribes to that store and re-runs layoutStructural, so the
 * container actually shrinks (collapse is a layout-time input).
 *
 * Usage:
 *   const manager = new ContextMenuManager();
 *   registerCompartmentCollapseActions(manager);
 *   // host: on collapse-store change, re-run layoutStructural with
 *   // collapsedCompartmentSet(store.collapsedKeys) and pass the new
 *   // geometry to CytoscapeCanvas.
 */

import { compartmentKey } from "@g3t/core";
import type { ContextMenuManager } from "./ContextMenuManager";
import type { MenuItem, MenuTarget } from "./types";
import { useCompartmentCollapseStore } from "../../state/compartment-collapse-store";

/** True when the target is a structural container with compartments. */
function isStructuralContainer(target: MenuTarget): boolean {
  return (
    target.type === "node" &&
    target.data?.["_structuralContainer"] === true &&
    Array.isArray(target.data["_compartmentIds"]) &&
    (target.data["_compartmentIds"] as unknown[]).length > 0
  );
}

/** True when the target is a compartment ROW (carries its parent
 *  container id and compartment id), so a right-click on a row can
 *  toggle just that one compartment. */
function isCompartmentRow(target: MenuTarget): boolean {
  return (
    target.type === "node" &&
    typeof target.data?.["parent"] === "string" &&
    typeof target.data["_compartment"] === "string"
  );
}

/** Compartment ids carried on a structural container target. */
function compartmentIdsOf(target: MenuTarget): string[] {
  const ids = target.data?.["_compartmentIds"];
  return Array.isArray(ids) ? (ids as string[]) : [];
}

/**
 * Register the compartment collapse actions:
 * - on a CONTAINER: "Collapse/expand compartments" toggles all of the
 *   container's compartments at once.
 * - on a compartment ROW: "Collapse/expand this compartment" toggles
 *   only the compartment the row belongs to (round-40 review: a row
 *   right-click should be compartment-scoped, since the cxttap target
 *   already carries the row's parent and _compartment).
 */
export function registerCompartmentCollapseActions(
  manager: ContextMenuManager,
): void {
  const containerItem: MenuItem = {
    id: "collapse-compartments",
    label: "Collapse / expand compartments",
    icon: "\u25A4", // ▤
    filter: isStructuralContainer,
    action: (target) => {
      const nodeId = target.id;
      if (!nodeId) return;
      const keys = compartmentIdsOf(target).map((cid) =>
        compartmentKey(nodeId, cid),
      );
      useCompartmentCollapseStore.getState().toggleAll(keys);
    },
  };

  const rowItem: MenuItem = {
    id: "collapse-this-compartment",
    label: "Collapse / expand this compartment",
    icon: "\u25A4",
    filter: isCompartmentRow,
    action: (target) => {
      const parent = target.data?.["parent"];
      const compartment = target.data?.["_compartment"];
      if (typeof parent !== "string" || typeof compartment !== "string") {
        return;
      }
      useCompartmentCollapseStore
        .getState()
        .toggle(compartmentKey(parent, compartment));
    },
  };

  manager.register("structural-collapse", [containerItem, rowItem]);
}

/**
 * Build the per-compartment submenu for a specific container target.
 * Hosts rendering a richer menu can call this to offer "collapse just
 * operations" alongside the toggle-all action. Returns [] for
 * non-containers or single-compartment containers.
 */
export function compartmentCollapseSubmenu(target: MenuTarget): MenuItem[] {
  if (!isStructuralContainer(target) || !target.id) return [];
  const ids = compartmentIdsOf(target);
  if (ids.length < 2) return [];
  const nodeId = target.id;
  return ids.map((cid) => ({
    id: `collapse-compartment-${cid}`,
    label: `Toggle "${cid}"`,
    filter: () => true,
    action: () => {
      useCompartmentCollapseStore
        .getState()
        .toggle(compartmentKey(nodeId, cid));
    },
  }));
}
