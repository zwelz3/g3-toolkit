/**
 * TagManager: persists user-defined labels on UGM nodes (M1.E3.T6).
 *
 * Tags are stored in the UGM's node properties as a `_tags` array.
 * They survive serialization (toJSON/fromJSON) because they're
 * regular properties.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/02-functional-interaction.md R2.8
 */

import type { UGM } from "@core/ugm";

export class TagManager {
  constructor(private readonly ugm: UGM) {}

  /**
   * Add a tag to the specified nodes.
   * If a node already has the tag, it's a no-op for that node.
   */
  addTag(nodeIds: string[], tag: string): void {
    for (const id of nodeIds) {
      const node = this.ugm.getNode(id);
      if (!node) continue;

      const existing = this.getTags(id);
      if (!existing.includes(tag)) {
        this.ugm.updateNodeProperties(id, {
          _tags: [...existing, tag],
        });
      }
    }
  }

  /** Remove a tag from the specified nodes. */
  removeTag(nodeIds: string[], tag: string): void {
    for (const id of nodeIds) {
      const existing = this.getTags(id);
      const filtered = existing.filter((t) => t !== tag);
      this.ugm.updateNodeProperties(id, { _tags: filtered });
    }
  }

  /** Get all tags on a specific node. */
  getTags(nodeId: string): string[] {
    const node = this.ugm.getNode(nodeId);
    if (!node) return [];
    const tags = node.properties._tags;
    return Array.isArray(tags) ? (tags as string[]) : [];
  }

  /** Get all unique tags across the entire graph. */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    this.ugm.forEachNode((_id, attrs) => {
      const tags = attrs.properties._tags;
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          if (typeof tag === "string") tagSet.add(tag);
        }
      }
    });
    return [...tagSet].sort();
  }

  /** Get all node IDs that have a specific tag. */
  getNodesWithTag(tag: string): string[] {
    const result: string[] = [];
    this.ugm.forEachNode((id, attrs) => {
      const tags = attrs.properties._tags;
      if (Array.isArray(tags) && tags.includes(tag)) {
        result.push(id);
      }
    });
    return result;
  }
}
