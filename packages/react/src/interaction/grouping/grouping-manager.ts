/**
 * GroupingManager: user-defined node grouping (M1.E3.T7, T2).
 *
 * Creates compound (parent) nodes in the UGM. Child nodes get a
 * `_parent` property pointing to the group node ID. Cytoscape
 * renders these as compound nodes with expand/collapse support.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/02-functional-interaction.md R2.6, R2.8
 */

import type { UGM } from "@g3t/core";

export interface GroupInfo {
  groupId: string;
  label: string;
  childIds: string[];
  collapsed: boolean;
}

export class GroupingManager {
  /** Tracks collapsed state (not stored in UGM to keep it presentation-only). */
  private readonly collapsedGroups = new Set<string>();
  private nextGroupIndex = 1;

  constructor(private readonly ugm: UGM) {}

  /**
   * Create a group from selected nodes.
   * Adds a new compound node to the UGM; sets `_parent` on children.
   * @returns the new group node ID
   */
  createGroup(childIds: string[], label: string): string {
    const groupId = `_group_${this.nextGroupIndex++}`;

    // Add the compound node
    this.ugm.addNode(groupId, {
      types: ["_Group"],
      properties: { name: label, _isGroup: true },
    });

    // Set parent on children
    for (const childId of childIds) {
      if (this.ugm.hasNode(childId)) {
        this.ugm.updateNodeProperties(childId, { _parent: groupId });
      }
    }

    return groupId;
  }

  /** Remove a group; children become ungrouped. */
  removeGroup(groupId: string): void {
    // Clear _parent on children
    this.ugm.forEachNode((id, attrs) => {
      if (attrs.properties._parent === groupId) {
        this.ugm.updateNodeProperties(id, { _parent: undefined });
      }
    });

    // Remove the group node
    if (this.ugm.hasNode(groupId)) {
      this.ugm.removeNode(groupId);
    }

    this.collapsedGroups.delete(groupId);
  }

  /** Get all children of a group. */
  getChildren(groupId: string): string[] {
    const children: string[] = [];
    this.ugm.forEachNode((id, attrs) => {
      if (attrs.properties._parent === groupId) {
        children.push(id);
      }
    });
    return children;
  }

  /** Toggle collapsed state. */
  toggleCollapse(groupId: string): boolean {
    if (this.collapsedGroups.has(groupId)) {
      this.collapsedGroups.delete(groupId);
      return false; // now expanded
    } else {
      this.collapsedGroups.add(groupId);
      return true; // now collapsed
    }
  }

  /** Check if a group is collapsed. */
  isCollapsed(groupId: string): boolean {
    return this.collapsedGroups.has(groupId);
  }

  /** Get info about all groups. */
  getAllGroups(): GroupInfo[] {
    const groups: GroupInfo[] = [];
    this.ugm.forEachNode((id, attrs) => {
      if (attrs.properties._isGroup === true) {
        groups.push({
          groupId: id,
          label:
            typeof attrs.properties.name === "string"
              ? attrs.properties.name
              : id,
          childIds: this.getChildren(id),
          collapsed: this.isCollapsed(id),
        });
      }
    });
    return groups;
  }
}
