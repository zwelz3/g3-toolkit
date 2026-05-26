/**
 * F3: Node group collapsing (combos).
 *
 * ComboManager (D6): tracks group membership.
 * Context menu actions (D13): group, ungroup, expand, collapse.
 * Maps to Cytoscape compound nodes (parent field).
 */

import { UGM } from "../ugm";

// ── D6: ComboManager Model ─────────────────────────────────────

export interface Combo {
  id: string;
  label: string;
  memberIds: Set<string>;
  collapsed: boolean;
  parentComboId?: string; // nesting support
}

export class ComboManager {
  private combos = new Map<string, Combo>();
  private nextId = 1;

  /** Create a combo from selected node IDs. */
  createCombo(memberIds: string[], label?: string): string {
    const id = `combo_${this.nextId++}`;
    this.combos.set(id, {
      id,
      label: label ?? `Group ${this.nextId - 1}`,
      memberIds: new Set(memberIds),
      collapsed: false,
    });
    return id;
  }

  /** Dissolve a combo, releasing its members. */
  dissolve(comboId: string): void {
    this.combos.delete(comboId);
  }

  /** Toggle collapsed state. */
  toggleCollapse(comboId: string): void {
    const combo = this.combos.get(comboId);
    if (combo) combo.collapsed = !combo.collapsed;
  }

  /** Collapse a combo. */
  collapse(comboId: string): void {
    const combo = this.combos.get(comboId);
    if (combo) combo.collapsed = true;
  }

  /** Expand a combo. */
  expand(comboId: string): void {
    const combo = this.combos.get(comboId);
    if (combo) combo.collapsed = false;
  }

  /** Nest a combo inside another. */
  nestInto(childComboId: string, parentComboId: string): void {
    const child = this.combos.get(childComboId);
    if (child) child.parentComboId = parentComboId;
  }

  /** Get all combos. */
  getAll(): Combo[] {
    return [...this.combos.values()];
  }

  /** Get combo by ID. */
  get(comboId: string): Combo | undefined {
    return this.combos.get(comboId);
  }

  /** Find which combo (if any) a node belongs to. */
  findComboForNode(nodeId: string): string | undefined {
    for (const [comboId, combo] of this.combos) {
      if (combo.memberIds.has(nodeId)) return comboId;
    }
    return undefined;
  }

  /**
   * Apply combos to a UGM for Cytoscape rendering.
   *
   * Collapsed combos: members hidden, replaced with a summary node.
   * Expanded combos: members get a `parent` field (compound node).
   */
  applyToUGM(ugm: UGM): UGM {
    const result = new UGM();

    // Track which nodes are hidden (inside collapsed combos)
    const hiddenNodes = new Set<string>();
    for (const combo of this.combos.values()) {
      if (combo.collapsed) {
        for (const id of combo.memberIds) hiddenNodes.add(id);
      }
    }

    // Add combo summary nodes for collapsed combos
    for (const combo of this.combos.values()) {
      if (combo.collapsed) {
        // Count types of members
        const typeCounts: Record<string, number> = {};
        for (const memberId of combo.memberIds) {
          const node = ugm.getNode(memberId);
          if (node) {
            const type = node.types[0] ?? "Unknown";
            typeCounts[type] = (typeCounts[type] ?? 0) + 1;
          }
        }
        const summary = Object.entries(typeCounts)
          .map(([t, c]) => `${t} (${c})`)
          .join(", ");

        result.addNode(combo.id, {
          types: ["Combo"],
          properties: {
            name: combo.label,
            memberCount: combo.memberIds.size,
            summary,
            _isCombo: true,
          },
        });
      } else {
        // Expanded: add a parent node
        result.addNode(combo.id, {
          types: ["ComboParent"],
          properties: {
            name: combo.label,
            _isComboParent: true,
          },
        });
      }
    }

    // Add regular nodes (skip hidden)
    ugm.forEachNode((id, attrs) => {
      if (hiddenNodes.has(id)) return;
      const parentCombo = this.findComboForNode(id);
      const expanded = parentCombo && !this.combos.get(parentCombo)?.collapsed;
      result.addNode(id, {
        types: attrs.types,
        properties: {
          ...attrs.properties,
          ...(expanded ? { parent: parentCombo } : {}),
        },
      });
    });

    // Add edges (skip edges to/from hidden nodes; redirect to combo node)
    ugm.forEachEdge((_eid, attrs, source, target) => {
      const srcHidden = hiddenNodes.has(source);
      const tgtHidden = hiddenNodes.has(target);
      const srcCombo = srcHidden ? this.findComboForNode(source) : undefined;
      const tgtCombo = tgtHidden ? this.findComboForNode(target) : undefined;

      const effectiveSource = srcCombo ?? source;
      const effectiveTarget = tgtCombo ?? target;

      if (
        effectiveSource === effectiveTarget ||
        !result.hasNode(effectiveSource) ||
        !result.hasNode(effectiveTarget)
      ) {
        return;
      }

      result.addEdge(effectiveSource, effectiveTarget, attrs);
    });

    return result;
  }

  /** Serialize for workspace persistence. */
  serialize(): string {
    const data = [...this.combos.values()].map((c) => ({
      ...c,
      memberIds: [...c.memberIds],
    }));
    return JSON.stringify(data);
  }

  /** Deserialize from workspace. */
  static deserialize(json: string): ComboManager {
    const mgr = new ComboManager();
    const data = JSON.parse(json);
    for (const entry of data) {
      mgr.combos.set(entry.id, {
        ...entry,
        memberIds: new Set(entry.memberIds),
      });
      mgr.nextId = Math.max(
        mgr.nextId,
        parseInt(entry.id.replace("combo_", ""), 10) + 1,
      );
    }
    return mgr;
  }
}
