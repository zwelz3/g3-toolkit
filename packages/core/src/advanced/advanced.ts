/**
 * M13 Advanced Features (toolkit layer).
 *
 * E13.2.T1: PROV-O temporal property extraction.
 * E13.3.T1: DerivedPropertyEngine (numeric expression evaluation).
 * E13.4.T3: Subgraph pinning (ViewFilter extension).
 *
 * Framework-agnostic (D6).
 */

import type { DerivationRecord, UGM } from "../ugm";
import {
  evaluateExpression,
  parseExpression,
  type Expression,
} from "./expression";

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
  /** Numeric expression over existing property keys (see `expression.ts`
   *  for the language). An expression outside the language is skipped. */
  expression: string;
  /** Recompute when UGM changes. */
  reactive: boolean;
}

/**
 * Computes derived numeric properties from expressions over each node's
 * numeric properties. Expressions are parsed by the toolkit's own numeric
 * language (`./expression`), which has no member access, assignment,
 * function definition, or strings; it replaced expr-eval, whose 2.0.2
 * release has unpatched code-execution and prototype-pollution advisories
 * (GHSA-mpfx-v932-r2fv). Treat an expression as code all the same: a host
 * that stores expressions and shows them to other users should validate
 * who may write them.
 *
 * Provenance (issue #17): every value the engine writes is stamped in
 * the UGM's derivation registry (`ugm.getDerivation(nodeId, name)`)
 * with the definition's name as `definitionId`, the definition's
 * current version, the write time and the expression text. The value
 * itself stays a plain property, so nothing downstream changes shape;
 * the stamp is what lets the table, the inspector and the JSON export
 * tell a computed value from a measured one.
 *
 * Versions are per definition name and monotonic for the engine's
 * lifetime: a new name starts at 1, `define` with a different
 * expression for an existing name increments it, and a re-definition
 * with the same expression keeps it (the rule did not change, so the
 * values are not stale). `remove` keeps the counter, so a name defined
 * again later continues from where it left off and the old stamps read
 * as stale rather than current.
 */
export class DerivedPropertyEngine {
  private readonly definitions: DerivedProperty[] = [];
  /** Per-name version counter; survives `remove` (see the class doc). */
  private readonly versions = new Map<string, number>();

  define(prop: DerivedProperty): void {
    const existing = this.definitions.findIndex((d) => d.name === prop.name);
    const previous = existing >= 0 ? this.definitions[existing] : undefined;
    if (existing >= 0) {
      this.definitions[existing] = prop;
    } else {
      this.definitions.push(prop);
    }
    const current = this.versions.get(prop.name);
    if (current === undefined) {
      this.versions.set(prop.name, 1);
    } else if (
      previous === undefined ||
      previous.expression !== prop.expression
    ) {
      this.versions.set(prop.name, current + 1);
    }
  }

  remove(name: string): void {
    const idx = this.definitions.findIndex((d) => d.name === name);
    if (idx >= 0) this.definitions.splice(idx, 1);
  }

  getDefinitions(): ReadonlyArray<DerivedProperty> {
    return this.definitions;
  }

  /** The current version of a definition, or undefined for a name
   *  this engine has never defined. */
  getVersion(name: string): number | undefined {
    const defined = this.definitions.some((d) => d.name === name);
    return defined ? this.versions.get(name) : undefined;
  }

  /**
   * Compute all derived properties and add them to UGM nodes, stamping
   * each written value (see the class doc).
   */
  compute(ugm: UGM): void {
    for (const def of this.definitions) this.computeOne(ugm, def);
  }

  /**
   * Recompute ONE definition, by name, over every node. The way to
   * refresh the values `listStale` reports after a `define` changed the
   * rule. A name this engine does not define is a no-op.
   */
  recompute(ugm: UGM, name: string): void {
    const def = this.definitions.find((d) => d.name === name);
    if (def) this.computeOne(ugm, def);
  }

  /**
   * Stamps in `ugm` that are STALE: written by a definition this engine
   * currently holds, at a version older than that definition's current
   * one. A stamp from a name the engine no longer defines is not stale
   * (there is no current rule to be behind), only orphaned; it stays in
   * `ugm.listDerivations()` until a source write or `clearDerivation`
   * removes it.
   */
  listStale(ugm: UGM): DerivationRecord[] {
    return ugm.listDerivations().filter((record) => {
      const current = this.getVersion(record.stamp.definitionId);
      return (
        current !== undefined &&
        record.stamp.version !== undefined &&
        record.stamp.version < current
      );
    });
  }

  private computeOne(ugm: UGM, def: DerivedProperty): void {
    let parsed: Expression;
    try {
      parsed = parseExpression(def.expression);
    } catch {
      return; // Outside the expression language; skip
    }
    const version = this.versions.get(def.name);

    ugm.forEachNode((id, attrs) => {
      // Own numeric properties only, in a Map: a name such as
      // "constructor" or "__proto__" never reaches an object prototype.
      const scope = new Map<string, number>();
      for (const [key, value] of Object.entries(attrs.properties)) {
        if (typeof value === "number") scope.set(key, value);
      }
      try {
        const result = evaluateExpression(parsed, scope);
        if (typeof result === "number" && isFinite(result)) {
          // The write clears any stamp on the key (it is a plain write
          // as far as the UGM knows); the stamp follows immediately.
          ugm.updateNodeProperties(id, { [def.name]: result });
          ugm.setDerivation(id, def.name, {
            definitionId: def.name,
            version,
            computedAt: new Date().toISOString(),
            expression: def.expression,
          });
        }
      } catch {
        // A missing variable or a non-numeric operand; no value for this
        // node, and any earlier stamp stays (the old value is still there).
      }
    });
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
