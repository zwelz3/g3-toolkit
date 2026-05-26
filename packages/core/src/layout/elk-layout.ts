/**
 * elkjs layout engine (M2.E2.T1).
 *
 * Uses elkjs for hierarchical and layered layout. elkjs runs
 * layout computation asynchronously (Web Worker in browser,
 * async in Node).
 */

import ELK, {
  type ElkNode,
  type ElkExtendedEdge,
} from "elkjs/lib/elk.bundled.js";
import type { UGM } from "../ugm";
import type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./types";

export class ElkLayout implements LayoutEngine {
  readonly name = "Hierarchical (ELK)";
  readonly id = "elk";

  private readonly algorithm: string;
  private readonly elk: InstanceType<typeof ELK>;

  constructor(algorithm: string = "layered") {
    this.algorithm = algorithm;
    this.elk = new ELK();
  }

  async compute(ugm: UGM, options?: LayoutOptions): Promise<LayoutResult> {
    const pinned = options?.pinned ?? new Map<string, Position>();

    // Build ELK graph
    const children: ElkNode[] = [];
    ugm.forEachNode((id) => {
      const pin = pinned.get(id);
      children.push({
        id,
        width: 40,
        height: 40,
        ...(pin ? { x: pin.x, y: pin.y } : {}),
      });
    });

    const edges: ElkExtendedEdge[] = [];
    ugm.forEachEdge((edgeId, _attrs, source, target) => {
      edges.push({
        id: edgeId,
        sources: [source],
        targets: [target],
      });
    });

    const graph: ElkNode = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": this.algorithm,
        "elk.spacing.nodeNode": "60",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      },
      children,
      edges,
    };

    const laid = await this.elk.layout(graph);

    // Build result map
    const result: LayoutResult = new Map();
    for (const child of laid.children ?? []) {
      const pin = pinned.get(child.id);
      if (pin) {
        result.set(child.id, pin);
      } else {
        result.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
      }
    }

    return result;
  }
}
