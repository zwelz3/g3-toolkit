/**
 * dagre DAG layout engine (M2.E2.T4).
 *
 * Uses @dagrejs/dagre for fast directed acyclic graph layout.
 * Suitable for small-to-medium DAGs.
 */

import dagre from "@dagrejs/dagre";
import type { UGM } from "@core/ugm";
import type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./types";

export class DagreLayout implements LayoutEngine {
  readonly name = "DAG (Dagre)";
  readonly id = "dagre";

  private readonly rankdir: "TB" | "LR" | "BT" | "RL";

  constructor(rankdir: "TB" | "LR" | "BT" | "RL" = "TB") {
    this.rankdir = rankdir;
  }

  async compute(ugm: UGM, options?: LayoutOptions): Promise<LayoutResult> {
    const pinned = options?.pinned ?? new Map<string, Position>();

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: this.rankdir, nodesep: 50, ranksep: 80 });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes
    ugm.forEachNode((id) => {
      g.setNode(id, { width: 40, height: 40 });
    });

    // Add edges
    ugm.forEachEdge((_edgeId, _attrs, source, target) => {
      g.setEdge(source, target);
    });

    dagre.layout(g);

    // Build result map
    const result: LayoutResult = new Map();
    for (const id of g.nodes()) {
      const pin = pinned.get(id);
      if (pin) {
        result.set(id, pin);
      } else {
        const node = g.node(id);
        result.set(id, { x: node.x, y: node.y });
      }
    }

    return result;
  }
}
