/**
 * M13 Advanced Features (toolkit layer).
 *
 * E13.2.T1: PROV-O temporal property extraction.
 * E13.3.T1: DerivedPropertyEngine (safe expression evaluation).
 * E13.4.T3: Subgraph pinning (ViewFilter extension).
 *
 * Framework-agnostic (D6).
 */

import type { UGM } from "../ugm";
import { Parser } from "expr-eval";

// ── PROV-O Property Extraction (M13.E2.T1) ──────────────────────────

/**
 * PROV-O IRI mappings. These standard predicates are recognized
 * during projection and mapped to toolkit temporal properties.
 */
export const PROVO_MAPPINGS: Record<string, string> = {
  "http://www.w3.org/ns/prov#startedAtTime": "temporal_start",
  "http://www.w3.org/ns/prov#endedAtTime": "temporal_end",
  "http://www.w3.org/ns/prov#generatedAtTime": "temporal_generated",
  "http://www.w3.org/ns/prov#wasGeneratedBy": "generatedBy",
  "http://www.w3.org/ns/prov#wasAttributedTo": "attributedTo",
  "http://www.w3.org/ns/prov#wasDerivedFrom": "derivedFrom",
  "http://www.w3.org/ns/prov#used": "used",
  "http://www.w3.org/ns/prov#wasAssociatedWith": "associatedWith",
  // Common shorthand (without full IRI)
  "prov:startedAtTime": "temporal_start",
  "prov:endedAtTime": "temporal_end",
  "prov:generatedAtTime": "temporal_generated",
  startedAtTime: "temporal_start",
  endedAtTime: "temporal_end",
};

/**
 * Extract PROV-O temporal properties from a UGM.
 * Maps PROV-O IRIs to toolkit temporal property names.
 * Mutates the UGM in place (adds/renames properties).
 */
export function extractProvOProperties(ugm: UGM): void {
  ugm.forEachNode((id, attrs) => {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(attrs.properties)) {
      const mapped = PROVO_MAPPINGS[key];
      if (mapped && !(mapped in attrs.properties)) {
        updates[mapped] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      ugm.updateNodeProperties(id, updates);
    }
  });
}

// ── DerivedPropertyEngine (M13.E3.T1) ───────────────────────────────

export interface DerivedProperty {
  /** Property name (added to each node). */
  name: string;
  /** Expression referencing existing property keys. */
  expression: string;
  /** Recompute when UGM changes. */
  reactive: boolean;
}

/**
 * Safe expression evaluator for derived properties.
 * Uses expr-eval for safe expression evaluation (no eval, no require).
 */
export class DerivedPropertyEngine {
  private readonly definitions: DerivedProperty[] = [];

  define(prop: DerivedProperty): void {
    const existing = this.definitions.findIndex((d) => d.name === prop.name);
    if (existing >= 0) {
      this.definitions[existing] = prop;
    } else {
      this.definitions.push(prop);
    }
  }

  remove(name: string): void {
    const idx = this.definitions.findIndex((d) => d.name === name);
    if (idx >= 0) this.definitions.splice(idx, 1);
  }

  getDefinitions(): ReadonlyArray<DerivedProperty> {
    return this.definitions;
  }

  /**
   * Compute all derived properties and add them to UGM nodes.
   */
  compute(ugm: UGM): void {
    const parser = new Parser();

    for (const def of this.definitions) {
      let parsed: ReturnType<typeof parser.parse>;
      try {
        parsed = parser.parse(def.expression);
      } catch {
        continue; // Invalid expression; skip
      }

      ugm.forEachNode((id, attrs) => {
        try {
          const scope: Record<string, number> = {};
          for (const [key, value] of Object.entries(attrs.properties)) {
            if (typeof value === "number") {
              scope[key] = value;
            }
          }
          const result = parsed.evaluate(scope);
          if (typeof result === "number" && isFinite(result)) {
            ugm.updateNodeProperties(id, { [def.name]: result });
          }
        } catch {
          // Expression evaluation failed for this node
        }
      });
    }
  }
}

// ── Subgraph Pinning (M13.E4.T3) ────────────────────────────────────
// Already implemented in ViewFilter (src/core/filter/filter.ts).
// pinnedNodeIds are always visible despite filters.
// This module re-exports the pinning helpers for convenience.

export { type ViewFilter } from "../filter";

/**
 * Pin a set of nodes (they remain visible regardless of filters).
 */
export function pinNodes(
  existing: import("../filter").ViewFilter,
  nodeIds: string[],
): import("../filter").ViewFilter {
  const pinned = new Set(existing.pinnedNodeIds);
  for (const id of nodeIds) pinned.add(id);
  return { ...existing, pinnedNodeIds: pinned };
}

/**
 * Unpin all nodes.
 */
export function unpinAll(
  existing: import("../filter").ViewFilter,
): import("../filter").ViewFilter {
  return { ...existing, pinnedNodeIds: new Set() };
}
