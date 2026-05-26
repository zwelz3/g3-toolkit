/**
 * Toolkit context menu actions.
 *
 * Registers a complete set of context menu items for single-node,
 * single-edge, and multi-select scenarios. Actions emit events
 * via the event bus so the application can wire up secondary views.
 *
 * Usage:
 *   const manager = new ContextMenuManager();
 *   registerToolkitActions(manager, { ugm, eventBus });
 */

import type { ContextMenuManager } from "@interaction/context-menu";
import type { MenuTarget } from "@interaction/context-menu";
import { UGM } from "@core/ugm";
import type { G3tEventBus } from "@core/event-bus/event-bus";
import { useSelectionStore } from "@state/selection-store";
import type { NodeStyleOverride } from "@core/style-override/style-override";
import { useStyleOverrideStore } from "@state/style-override-store";

// ── Configuration ───────────────────────────────────────────────────

export interface ToolkitActionConfig {
  ugm: UGM;
  eventBus: G3tEventBus;
  /** Default hops for "View Neighbors" action. */
  defaultHops?: number;
  /** Callback when "Edit Appearance" is selected. */
  onEditAppearance?: (nodeId: string) => void;
  /** Callback when "View Neighbors" opens a secondary view. */
  onViewNeighbors?: (nodeId: string, hops: number) => void;
}

// ── Registration ────────────────────────────────────────────────────

export function registerToolkitActions(
  manager: ContextMenuManager,
  config: ToolkitActionConfig,
): void {
  const hops = config.defaultHops ?? 2;
  const { selectNodes, selectEdges, addNodesToSelection } =
    useSelectionStore.getState();

  // ── Single-Node Actions ─────────────────────────────────────────

  manager.register("toolkit-node", [
    {
      id: "inspect",
      label: "Inspect",
      icon: "🔍",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (t.id) selectNodes([t.id]);
      },
    },
    {
      id: "view-neighbors",
      label: `View Neighbors (${hops}-hop)`,
      icon: "◎",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (!t.id) return;
        config.eventBus.emit("context:viewNeighbors", {
          nodeId: t.id,
          hops,
        });
        config.onViewNeighbors?.(t.id, hops);
      },
    },
    {
      id: "expand-neighbors",
      label: "Expand Neighbors",
      icon: "⊕",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (!t.id) return;
        const neighbors = config.ugm.getNeighbors(t.id);
        addNodesToSelection(neighbors);
      },
    },
    {
      id: "focus-neighborhood",
      label: `Focus (${hops}-hop)`,
      icon: "◉",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (!t.id) return;
        config.eventBus.emit("context:focusNode", {
          nodeId: t.id,
          hops,
        });
      },
    },
    {
      id: "find-paths-from",
      label: "Find Paths From Here",
      icon: "⟶",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (!t.id) return;
        const selected = useSelectionStore.getState().selectedNodeIds;
        // If another node is already selected, find path between them
        const others = [...selected].filter((id) => id !== t.id);
        if (others.length === 1) {
          config.eventBus.emit("context:findPath", {
            sourceId: t.id,
            targetId: others[0]!,
          });
        }
      },
    },
    {
      id: "edit-appearance",
      label: "Edit Appearance",
      icon: "🎨",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (!t.id) return;
        config.eventBus.emit("context:editAppearance", { nodeId: t.id });
        config.onEditAppearance?.(t.id);
      },
      separator: true,
    },
    {
      id: "pin-node",
      label: "Pin Node",
      icon: "📌",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (t.id) {
          config.eventBus.emit("context:pinNodes", { nodeIds: [t.id] });
        }
      },
    },
    {
      id: "hide-node",
      label: "Hide Node",
      icon: "👁",
      filter: (t) => t.type === "node",
      action: (t) => {
        if (t.id) {
          config.eventBus.emit("context:hideNodes", { nodeIds: [t.id] });
        }
      },
    },
    {
      id: "copy-id",
      label: "Copy ID",
      icon: "📋",
      filter: (t) => t.type === "node" || t.type === "edge",
      action: (t) => {
        if (t.id && typeof navigator !== "undefined") {
          navigator.clipboard?.writeText(t.id);
        }
      },
      separator: true,
    },
  ]);

  // ── Single-Edge Actions ─────────────────────────────────────────

  manager.register("toolkit-edge", [
    {
      id: "inspect-edge",
      label: "Inspect Edge",
      icon: "🔍",
      filter: (t) => t.type === "edge",
      action: (t) => {
        if (t.id) selectEdges([t.id]);
      },
    },
    {
      id: "select-endpoints",
      label: "Select Endpoints",
      icon: "◇",
      filter: (t) => t.type === "edge",
      action: (t) => {
        if (!t.id) return;
        const source = t.data?.source as string | undefined;
        const target = t.data?.target as string | undefined;
        if (source && target) {
          selectNodes([source, target]);
        }
      },
    },
    {
      id: "hide-edge",
      label: "Hide Edge",
      icon: "👁",
      filter: (t) => t.type === "edge",
      action: (t) => {
        if (t.id) {
          config.eventBus.emit("context:hideNodes", { nodeIds: [t.id] });
        }
      },
    },
  ]);

  // ── Multi-Select Actions ────────────────────────────────────────

  manager.register("toolkit-multi", [
    {
      id: "view-subgraph",
      label: "View Subgraph",
      icon: "◎",
      filter: () => useSelectionStore.getState().selectedNodeIds.size > 1,
      action: () => {
        const ids = [...useSelectionStore.getState().selectedNodeIds];
        config.eventBus.emit("context:viewSubgraph", { nodeIds: ids });
      },
    },
    {
      id: "find-shortest-path",
      label: "Find Shortest Path",
      icon: "⟶",
      filter: () => useSelectionStore.getState().selectedNodeIds.size === 2,
      action: () => {
        const ids = [...useSelectionStore.getState().selectedNodeIds];
        if (ids.length === 2) {
          config.eventBus.emit("context:findPath", {
            sourceId: ids[0]!,
            targetId: ids[1]!,
          });
        }
      },
    },
    {
      id: "bulk-color-red",
      label: "Set Color → Red",
      icon: "🔴",
      filter: () => useSelectionStore.getState().selectedNodeIds.size > 1,
      action: () => {
        const ids = [...useSelectionStore.getState().selectedNodeIds];
        const { add } = useStyleOverrideStore.getState();
        for (const id of ids) {
          add({ scope: { nodeId: id }, color: "#ef4444" });
        }
      },
      separator: true,
    },
    {
      id: "bulk-color-blue",
      label: "Set Color → Blue",
      icon: "🔵",
      filter: () => useSelectionStore.getState().selectedNodeIds.size > 1,
      action: () => {
        const ids = [...useSelectionStore.getState().selectedNodeIds];
        const { add } = useStyleOverrideStore.getState();
        for (const id of ids) {
          add({ scope: { nodeId: id }, color: "#3b82f6" });
        }
      },
    },
    {
      id: "pin-selected",
      label: "Pin Selected",
      icon: "📌",
      filter: () => useSelectionStore.getState().selectedNodeIds.size > 1,
      action: () => {
        const ids = [...useSelectionStore.getState().selectedNodeIds];
        config.eventBus.emit("context:pinNodes", { nodeIds: ids });
      },
    },
    {
      id: "hide-selected",
      label: "Hide Selected",
      icon: "👁",
      filter: () => useSelectionStore.getState().selectedNodeIds.size > 1,
      action: () => {
        const ids = [...useSelectionStore.getState().selectedNodeIds];
        config.eventBus.emit("context:hideNodes", { nodeIds: ids });
      },
    },
    {
      id: "show-only-selected",
      label: "Show Only Selected",
      icon: "🎯",
      filter: () => useSelectionStore.getState().selectedNodeIds.size > 1,
      action: () => {
        const ids = [...useSelectionStore.getState().selectedNodeIds];
        config.eventBus.emit("context:viewSubgraph", { nodeIds: ids });
      },
    },
  ]);
}

// ── Neighborhood UGM Builder ────────────────────────────────────────

/**
 * Create a new UGM containing only the N-hop neighborhood of a node.
 * Useful for populating a secondary "neighborhood view" canvas.
 */
export function buildNeighborhoodUGM(
  sourceUGM: UGM,
  centerNodeId: string,
  hops: number,
): UGM {
  // BFS to collect neighborhood node IDs
  const visited = new Set<string>();
  let frontier = new Set<string>([centerNodeId]);

  for (let i = 0; i <= hops; i++) {
    for (const id of frontier) visited.add(id);
    if (i === hops) break;
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of sourceUGM.getNeighbors(id)) {
        if (!visited.has(neighbor)) next.add(neighbor);
      }
    }
    frontier = next;
  }

  // Build the subgraph UGM
  const subUGM = new UGM();

  for (const id of visited) {
    const node = sourceUGM.getNode(id);
    if (node) {
      subUGM.addNode(id, { types: node.types, properties: node.properties });
    }
  }

  sourceUGM.forEachEdge((edgeId, attrs, source, target) => {
    if (visited.has(source) && visited.has(target)) {
      subUGM.addEdge(source, target, attrs);
    }
  });

  return subUGM;
}
