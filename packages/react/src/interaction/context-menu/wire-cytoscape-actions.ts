/**
 * Cytoscape-side wiring for the toolkit context menu events.
 *
 * registerToolkitActions emits events on a G3tEventBus when a user
 * picks a context menu item (e.g. "Pin Node" → context:pinNodes).
 * The toolkit doesn't know about Cytoscape, so the demo / consumer
 * is responsible for translating those events into cytoscape
 * operations. This helper does that translation in one place so
 * every demo doesn't have to re-implement it.
 *
 * Usage:
 *
 *   useEffect(() => {
 *     if (!cyInstance) return;
 *     return wireCytoscapeContextActions(cyInstance, eventBus, ugm, {
 *       onViewNeighborhood: (subUGM) => setNeighborhoodUGM(subUGM),
 *     });
 *   }, [cyInstance, eventBus, ugm]);
 *
 * The returned unsubscribe cleans up every event subscription.
 *
 * @see registerToolkitActions for the menu-item side
 */

import type { Core } from "cytoscape";
import type { G3tEventBus } from "@g3t/core";
import type { UGM } from "@g3t/core";
import { buildNeighborhoodUGM } from "./toolkit-actions";

export interface WireCytoscapeContextActionsOptions {
  /**
   * Called when the user picks "View Neighbors" or "Focus N-hop".
   * Receives the subgraph UGM ready to render in a secondary view.
   */
  onViewNeighborhood?: (subUGM: UGM, centerId: string, hops: number) => void;
  /**
   * Called when the user picks "Find Shortest Path" with two nodes
   * selected. The toolkit emits the source/target; you decide what
   * the secondary view does with it.
   */
  onFindPath?: (sourceId: string, targetId: string) => void;
  /**
   * Called when the user picks "Edit Appearance" on a node. Open the
   * NodeStyleEditor in your application.
   */
  onEditAppearance?: (nodeId: string) => void;
}

/**
 * Subscribe to context menu events and translate them into cytoscape
 * operations. Returns a cleanup function that unsubscribes everything.
 */
export function wireCytoscapeContextActions(
  cy: Core,
  eventBus: G3tEventBus,
  ugm: UGM,
  options: WireCytoscapeContextActionsOptions = {},
): () => void {
  const unsubs: Array<() => void> = [];

  // Pin: lock node positions so layout doesn't move them.
  unsubs.push(
    eventBus.on("context:pinNodes", ({ nodeIds }) => {
      cy.batch(() => {
        for (const id of nodeIds) {
          const el = cy.getElementById(id);
          if (el.nonempty()) {
            el.lock();
            el.addClass("g3t-pinned");
          }
        }
      });
    }),
  );

  // Hide: visually hide the node and its incident edges. We use
  // 'display: none' rather than removing from the graph so the
  // operation is reversible.
  unsubs.push(
    eventBus.on("context:hideNodes", ({ nodeIds }) => {
      cy.batch(() => {
        for (const id of nodeIds) {
          const el = cy.getElementById(id);
          if (el.nonempty()) {
            el.style("display", "none");
            // Hide connected edges too so they don't dangle
            el.connectedEdges().style("display", "none");
            el.addClass("g3t-hidden");
          }
        }
      });
    }),
  );

  // Focus: zoom + fit the canvas to the N-hop neighborhood of the
  // requested node. The user's "I can see the surrounding context"
  // outcome doesn't require a separate panel.
  unsubs.push(
    eventBus.on("context:focusNode", ({ nodeId, hops }) => {
      // Build the neighborhood IDs once (don't materialize a UGM)
      const visited = new Set<string>([nodeId]);
      let frontier = new Set<string>([nodeId]);
      for (let i = 0; i < hops; i++) {
        const next = new Set<string>();
        for (const id of frontier) {
          for (const n of ugm.getNeighbors(id)) {
            if (!visited.has(n)) {
              visited.add(n);
              next.add(n);
            }
          }
        }
        frontier = next;
      }
      const collection = cy.collection();
      for (const id of visited) {
        const el = cy.getElementById(id);
        if (el.nonempty()) collection.merge(el);
      }
      if (collection.nonempty()) cy.fit(collection, 40);
    }),
  );

  // View neighbors: build a subgraph UGM and hand off to the
  // application. Default behavior if no callback is to log; that's
  // intentional: rendering a secondary canvas is an app concern.
  unsubs.push(
    eventBus.on("context:viewNeighbors", ({ nodeId, hops }) => {
      const subUGM = buildNeighborhoodUGM(ugm, nodeId, hops);
      options.onViewNeighborhood?.(subUGM, nodeId, hops);
    }),
  );

  // View subgraph: similar - build a UGM from the selected nodes
  // and their interconnections.
  unsubs.push(
    eventBus.on("context:viewSubgraph", ({ nodeIds }) => {
      const subUGM = new (ugm.constructor as new () => UGM)();
      for (const id of nodeIds) {
        const node = ugm.getNode(id);
        if (node) {
          subUGM.addNode(id, { types: node.types, properties: node.properties });
        }
      }
      const idSet = new Set(nodeIds);
      ugm.forEachEdge((_eid, attrs, source, target) => {
        if (idSet.has(source) && idSet.has(target)) {
          subUGM.addEdge(source, target, attrs);
        }
      });
      options.onViewNeighborhood?.(subUGM, nodeIds[0] ?? "", 0);
    }),
  );

  if (options.onFindPath) {
    unsubs.push(
      eventBus.on("context:findPath", ({ sourceId, targetId }) => {
        options.onFindPath!(sourceId, targetId);
      }),
    );
  }
  if (options.onEditAppearance) {
    unsubs.push(
      eventBus.on("context:editAppearance", ({ nodeId }) => {
        options.onEditAppearance!(nodeId);
      }),
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}
