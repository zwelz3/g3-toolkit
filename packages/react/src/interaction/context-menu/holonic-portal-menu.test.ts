/**
 * HolonicAdapter portal menu integration test (M3.E2.T4).
 *
 * Extracted from packages/core/src/adapter/adapter.test.ts during
 * Phase 4: this is an integration test between the HolonicAdapter
 * (in @g3t/core) and the context-menu plumbing (in @g3t/react), so
 * structurally it belongs in @g3t/react's test suite, not core's.
 */

import { describe, it, expect, vi } from "vitest";
import { HolonicAdapter, type HolonicDataset } from "@g3t/core";
import { ContextMenuManager } from "./ContextMenuManager";
import { registerPortalMenuItems } from "./holonic-portal-menu";

describe("HolonicAdapter portal menu (M3.E2.T4)", () => {
  it("registers portal traverse menu item for holon nodes", () => {
    const dataset: HolonicDataset = {
      holons: [
        {
          id: "h1",
          label: "Cell",
          types: ["IntelCell"],
          properties: {},
          portals: [
            {
              id: "p1",
              label: "link",
              sourceHolonId: "h1",
              targetHolonId: "h2",
            },
          ],
          interiorNodes: [{ id: "inner", types: ["X"], properties: {} }],
        },
        {
          id: "h2",
          label: "Other",
          types: ["Other"],
          properties: {},
          portals: [],
        },
      ],
    };

    const adapter = new HolonicAdapter(dataset);
    const menuManager = new ContextMenuManager();
    const onTraverse = vi.fn();

    registerPortalMenuItems(adapter, menuManager, onTraverse);

    // Resolve for a holon node with portals
    const items = menuManager.resolve({
      type: "node",
      id: "h1",
      position: { x: 0, y: 0 },
    });
    expect(items.map((i) => i.id)).toContain("traverse-portal");

    // Resolve for a non-holon node
    const noItems = menuManager.resolve({
      type: "node",
      id: "h2",
      position: { x: 0, y: 0 },
    });
    expect(noItems.map((i) => i.id)).not.toContain("traverse-portal");
  });

  it("traverse action calls onTraverse with interior UGM", () => {
    const dataset: HolonicDataset = {
      holons: [
        {
          id: "h1",
          label: "Cell",
          types: ["IntelCell"],
          properties: {},
          portals: [
            {
              id: "p1",
              label: "link",
              sourceHolonId: "h1",
              targetHolonId: "h2",
            },
          ],
          interiorNodes: [{ id: "inner", types: ["X"], properties: {} }],
        },
        {
          id: "h2",
          label: "Other",
          types: ["Other"],
          properties: {},
          portals: [],
        },
      ],
    };

    const adapter = new HolonicAdapter(dataset);
    const menuManager = new ContextMenuManager();
    const onTraverse = vi.fn();

    registerPortalMenuItems(adapter, menuManager, onTraverse);

    const items = menuManager.resolve({
      type: "node",
      id: "h1",
      position: { x: 0, y: 0 },
    });
    const traverseItem = items.find((i) => i.id === "traverse-portal");
    traverseItem?.action({ type: "node", id: "h1", position: { x: 0, y: 0 } });

    expect(onTraverse).toHaveBeenCalledOnce();
    const [portal, result] = onTraverse.mock.calls[0] ?? [];
    expect(portal.id).toBe("p1");
    expect(result.nodeCount).toBe(1); // inner node
  });
});
