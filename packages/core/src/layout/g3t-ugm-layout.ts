/**
 * g3t layered layout for UGM graph views (D3b part 1, 2026-07-19).
 *
 * Replaces ElkLayout in the layout-engine registry: elkjs left the
 * tree, and the in-house layered engine serves the same "layered /
 * hierarchical" toolbar option by adapting the UGM to a flat
 * structural input. Pins are honored by overriding the computed
 * position for pinned ids (the layered engine has no native pin
 * support yet; recorded, not hidden).
 */
import type { UGM } from "../ugm";
import type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./types";
import { layoutStructural } from "./structural";

export class G3tLayeredLayout implements LayoutEngine {
  readonly name = "Layered (g3t)";
  readonly id = "layered";

  async compute(ugm: UGM, options?: LayoutOptions): Promise<LayoutResult> {
    const pinned = options?.pinned ?? new Map<string, Position>();
    const nodes: { id: string; width: number; height: number }[] = [];
    ugm.forEachNode((id) => {
      nodes.push({ id, width: 40, height: 40 });
    });
    const edges: { id: string; source: string; target: string }[] = [];
    ugm.forEachEdge((edgeId, _attrs, source, target) => {
      edges.push({ id: edgeId, source, target });
    });
    const geometry = await layoutStructural(
      { nodes, edges },
      { routeEdges: false },
    );
    const result: LayoutResult = new Map();
    for (const n of nodes) {
      const pin = pinned.get(n.id);
      if (pin) {
        result.set(n.id, pin);
        continue;
      }
      const g = geometry.nodes[n.id];
      result.set(n.id, g ? { x: g.x, y: g.y } : { x: 0, y: 0 });
    }
    return result;
  }
}
