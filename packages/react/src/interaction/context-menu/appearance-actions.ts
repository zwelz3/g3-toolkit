/**
 * Context-menu actions for node appearance and multi-selection.
 *
 * M12.E2.T3: "Edit Appearance" menu registration.
 * M12.E4.T1: Multi-selection context menu items.
 * M12.E4.T2: Bulk style application.
 *
 * Extracted from interaction/remaining-tickets.tsx during P3.5.
 */

import type { NodeStyleOverride } from "@g3t/core";
import type { ContextMenuManager } from "./ContextMenuManager";
import type { MenuTarget } from "./types";
import { useStyleOverrideStore } from "../../state/style-override-store";

// ── Edit Appearance Registration (M12.E2.T3) ────────────────────────

/**
 * Register "Edit Appearance" in the context menu.
 * The onEdit callback should open the NodeStyleEditor panel.
 */
export function registerEditAppearance(
  manager: ContextMenuManager,
  onEdit: (nodeId: string) => void,
): void {
  manager.register("style-override", [
    {
      id: "edit-appearance",
      label: "Edit Appearance",
      icon: "◉",
      filter: (target: MenuTarget) => target.type === "node",
      action: (target: MenuTarget) => {
        if (target.id) onEdit(target.id);
      },
      separator: true,
    },
  ]);
}

// ── Multi-Selection Context Menu (M12.E4.T1) ────────────────────────

/**
 * Register multi-selection menu items.
 * These appear when 2+ nodes are selected and the user right-clicks.
 */
export function registerMultiSelectMenu(
  manager: ContextMenuManager,
  callbacks: {
    onBulkColor?: (nodeIds: string[], color: string) => void;
    onBulkHide?: (nodeIds: string[]) => void;
    onShowOnly?: (nodeIds: string[]) => void;
    getSelectedIds: () => string[];
  },
): void {
  manager.register("multi-select", [
    {
      id: "bulk-set-color-red",
      label: "Set Color → Red",
      icon: "🔴",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        const ids = callbacks.getSelectedIds();
        callbacks.onBulkColor?.(ids, "#ef4444");
      },
    },
    {
      id: "bulk-set-color-blue",
      label: "Set Color → Blue",
      icon: "🔵",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        const ids = callbacks.getSelectedIds();
        callbacks.onBulkColor?.(ids, "#3b82f6");
      },
    },
    {
      id: "bulk-hide",
      label: "Hide Selected",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        callbacks.onBulkHide?.(callbacks.getSelectedIds());
      },
      separator: true,
    },
    {
      id: "show-only-selected",
      label: "Show Only Selected",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        callbacks.onShowOnly?.(callbacks.getSelectedIds());
      },
    },
  ]);
}

// ── Bulk Style Application (M12.E4.T2) ──────────────────────────────

/**
 * Apply a style override to multiple nodes at once.
 * Creates individual NodeStyleOverride entries for each node.
 */
export function applyBulkStyle(
  nodeIds: string[],
  style: Omit<NodeStyleOverride, "scope">,
): void {
  const { add } = useStyleOverrideStore.getState();
  for (const nodeId of nodeIds) {
    add({ ...style, scope: { nodeId } });
  }
}
