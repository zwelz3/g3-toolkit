/**
 * d3-hierarchy tree layout engine (M2.E2.T3).
 *
 * Uses d3-hierarchy's tree layout for hierarchical placement.
 * Requires a root node ID; non-tree edges are handled by placing
 * nodes at their tree position (cross-edges are visual only).
 */

import { hierarchy, tree } from "d3-hierarchy";
import type { UGM } from "../ugm";
import type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./types";

interface TreeNode {
  id: string;
  children: TreeNode[];
}

export class HierarchyLayout implements LayoutEngine {
  readonly name = "Hierarchical Tree";
  readonly id = "hierarchy";

  private readonly nodeWidth: number;
  private readonly nodeHeight: number;

  constructor(nodeWidth: number = 120, nodeHeight: number = 80) {
    this.nodeWidth = nodeWidth;
    this.nodeHeight = nodeHeight;
  }

  async compute(ugm: UGM, options?: LayoutOptions): Promise<LayoutResult> {
    const pinned = options?.pinned ?? new Map<string, Position>();

    // Build adjacency list (directed: source → target as parent → child)
    const children = new Map<string, string[]>();
    const hasParent = new Set<string>();

    ugm.forEachEdge((_id, _attrs, source, target) => {
      if (!children.has(source)) children.set(source, []);
      children.get(source)?.push(target);
      hasParent.add(target);
    });

    // Find root: node with no incoming edges; fall back to first node
    let rootId: string | null = null;
    ugm.forEachNode((id) => {
      if (rootId === null && !hasParent.has(id)) {
        rootId = id;
      }
    });
    if (rootId === null) {
      // No clear root; use first node
      const ids = ugm.getNodeIds();
      rootId = ids[0] ?? null;
    }
    if (rootId === null) {
      return new Map();
    }

    // Build tree structure (BFS to avoid cycles)
    const visited = new Set<string>();
    function buildTree(nodeId: string): TreeNode {
      visited.add(nodeId);
      const childIds = (children.get(nodeId) ?? []).filter(
        (c) => !visited.has(c),
      );
      return {
        id: nodeId,
        children: childIds.map((c) => buildTree(c)),
      };
    }
    const treeData = buildTree(rootId);

    // Apply d3 tree layout
    const root = hierarchy(treeData);
    const treeLayout = tree<TreeNode>().nodeSize([
      this.nodeWidth,
      this.nodeHeight,
    ]);
    treeLayout(root);

    // Build result map
    const result: LayoutResult = new Map();
    root.each((node) => {
      const pin = pinned.get(node.data.id);
      if (pin) {
        result.set(node.data.id, pin);
      } else {
        result.set(node.data.id, { x: node.x ?? 0, y: node.y ?? 0 });
      }
    });

    // Handle orphan nodes not in the tree
    ugm.forEachNode((id) => {
      if (!result.has(id)) {
        const pin = pinned.get(id);
        result.set(id, pin ?? { x: 0, y: result.size * 50 });
      }
    });

    return result;
  }
}
