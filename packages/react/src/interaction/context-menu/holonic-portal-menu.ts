/**
 * Holonic portal context-menu integration.
 *
 * Registers a "Traverse portal..." right-click item for each holon node
 * (M3.E2.T4). Previously this lived as a method on `HolonicAdapter` in
 * @g3t/core, but that forced core to depend on @g3t/react's menu types
 * (a boundary violation). The logic is UI-registration; it belongs here.
 *
 * @see specs/05-integration-holonic.md R5.2
 */

import type { ContextMenuManager } from "./ContextMenuManager";
import type { MenuTarget } from "./types";
import type { HolonicAdapter, Portal, UGM } from "@g3t/core";

/**
 * Register portal traversal items on the context menu (M3.E2.T4).
 *
 * @param adapter      The HolonicAdapter wrapping the dataset.
 * @param menuManager  The context-menu plugin host.
 * @param onTraverse   Called when the user picks a portal; receives the
 *                     Portal and the projected interior UGM.
 */
export function registerPortalMenuItems(
  adapter: HolonicAdapter,
  menuManager: ContextMenuManager,
  onTraverse: (portal: Portal, result: UGM) => void,
): void {
  const dataset = adapter.dataset;
  const projectInterior = adapter.projectHolonInterior.bind(adapter);

  menuManager.register("holonic-portals", [
    {
      id: "traverse-portal",
      label: "Traverse portal...",
      icon: "🔗",
      filter: (target: MenuTarget) => {
        if (target.type !== "node") return false;
        const holon = dataset.holons.find((h) => h.id === target.id);
        return !!holon && holon.portals.length > 0;
      },
      action: (target: MenuTarget) => {
        const holon = dataset.holons.find((h) => h.id === target.id);
        if (!holon || holon.portals.length === 0) return;
        const portal = holon.portals[0];
        if (portal) {
          const result = projectInterior(holon);
          onTraverse(portal, result);
        }
      },
    },
  ]);
}
