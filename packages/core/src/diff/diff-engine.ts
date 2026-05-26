/**
 * Graph diff engine (M6.E2.T3).
 *
 * Compares two UGM instances and returns the structural difference:
 * added nodes/edges, removed nodes/edges, changed properties.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/01-functional-views.md R1.10
 */

import type { UGM } from "../ugm";

export interface PropertyChange {
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface NodeDiff {
  id: string;
  status: "added" | "removed" | "changed";
  propertyChanges?: PropertyChange[];
}

export interface EdgeDiff {
  id: string;
  source: string;
  target: string;
  type: string;
  status: "added" | "removed" | "changed";
  propertyChanges?: PropertyChange[];
}

export interface DiffResult {
  addedNodes: NodeDiff[];
  removedNodes: NodeDiff[];
  changedNodes: NodeDiff[];
  addedEdges: EdgeDiff[];
  removedEdges: EdgeDiff[];
  changedEdges: EdgeDiff[];
}

/**
 * Compare two UGM instances and return the difference.
 * @param before The "old" graph
 * @param after The "new" graph
 */
export function diffGraphs(before: UGM, after: UGM): DiffResult {
  const result: DiffResult = {
    addedNodes: [],
    removedNodes: [],
    changedNodes: [],
    addedEdges: [],
    removedEdges: [],
    changedEdges: [],
  };

  // Node diff
  const beforeNodeIds = new Set(before.getNodeIds());
  const afterNodeIds = new Set(after.getNodeIds());

  for (const id of afterNodeIds) {
    if (!beforeNodeIds.has(id)) {
      result.addedNodes.push({ id, status: "added" });
    }
  }

  for (const id of beforeNodeIds) {
    if (!afterNodeIds.has(id)) {
      result.removedNodes.push({ id, status: "removed" });
    } else {
      // Check for property changes
      const oldNode = before.getNode(id);
      const newNode = after.getNode(id);
      if (oldNode && newNode) {
        const changes = diffProperties(oldNode.properties, newNode.properties);
        if (changes.length > 0) {
          result.changedNodes.push({
            id,
            status: "changed",
            propertyChanges: changes,
          });
        }
      }
    }
  }

  // Edge diff
  const beforeEdges = new Map<
    string,
    {
      source: string;
      target: string;
      type: string;
      props: Record<string, unknown>;
    }
  >();
  before.forEachEdge((id, attrs, source, target) => {
    beforeEdges.set(id, {
      source,
      target,
      type: attrs.type,
      props: attrs.properties,
    });
  });

  const afterEdges = new Map<
    string,
    {
      source: string;
      target: string;
      type: string;
      props: Record<string, unknown>;
    }
  >();
  after.forEachEdge((id, attrs, source, target) => {
    afterEdges.set(id, {
      source,
      target,
      type: attrs.type,
      props: attrs.properties,
    });
  });

  for (const [id, edge] of afterEdges) {
    if (!beforeEdges.has(id)) {
      result.addedEdges.push({
        id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        status: "added",
      });
    }
  }

  for (const [id, edge] of beforeEdges) {
    if (!afterEdges.has(id)) {
      result.removedEdges.push({
        id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        status: "removed",
      });
    } else {
      const afterEdge = afterEdges.get(id);
      if (afterEdge) {
        const changes = diffProperties(edge.props, afterEdge.props);
        if (changes.length > 0) {
          result.changedEdges.push({
            id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            status: "changed",
            propertyChanges: changes,
          });
        }
      }
    }
  }

  return result;
}

function diffProperties(
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): PropertyChange[] {
  const changes: PropertyChange[] = [];
  const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  for (const key of allKeys) {
    const oldVal = oldProps[key];
    const newVal = newProps[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ key, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

/** Compute a simple hash of a UGM's schema (types and property keys). */
export function computeSchemaHash(ugm: UGM): string {
  const registry = ugm.getRegistry();
  const parts = [
    [...registry.nodeTypes].sort().join(","),
    [...registry.edgeTypes].sort().join(","),
    [...registry.nodePropertyKeys].sort().join(","),
  ];
  // Simple string hash (not cryptographic; for change detection only)
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}
