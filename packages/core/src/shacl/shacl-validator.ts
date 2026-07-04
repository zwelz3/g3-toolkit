/**
 * ShaclValidator: validate UGM nodes against SHACL shapes (DE.1).
 *
 * Lightweight validator that checks property constraints (minCount,
 * maxCount, datatype, pattern, minInclusive, maxInclusive) against
 * a target class. Does not implement the full SHACL specification;
 * covers the constraints most useful for ontology authoring.
 *
 * Framework-agnostic (D6).
 */

import type { UGM } from "../ugm";

// ── Shape Types ─────────────────────────────────────────────────────

export interface ShaclPropertyConstraint {
  path: string;
  name?: string;
  datatype?: "string" | "number" | "boolean" | "date" | "uri";
  minCount?: number;
  maxCount?: number;
  pattern?: string;
  minInclusive?: number;
  maxInclusive?: number;
  in?: unknown[];
  /** sh:severity for this constraint's results. When set, it
   *  OVERRIDES the per-check default (e.g. a missing required value
   *  defaults to violation, but sh:severity sh:Info downgrades it).
   *  Absent means the per-check default applies. */
  severity?: "violation" | "warning" | "info";
}

export interface ShaclShape {
  id: string;
  targetClass: string;
  name?: string;
  description?: string;
  properties: ShaclPropertyConstraint[];
  /** sh:closed - when true, the shape is closed-world: node properties
   *  beyond the declared constraint paths (and ignoredProperties) are
   *  violations. Absent/false = open (SHACL's default). */
  closed?: boolean;
  /** sh:ignoredProperties - paths exempt from the closed-world check
   *  (only meaningful when closed is true). */
  ignoredProperties?: string[];
}

export interface ShaclViolation {
  path: string;
  message: string;
  severity: "violation" | "warning" | "info";
}

export interface ShaclValidationResult {
  nodeId: string;
  shapeId: string;
  shapeName: string;
  targetClass: string;
  valid: boolean;
  violations: ShaclViolation[];
}

// ── Validator (function form) ───────────────────────────────────────

// @see R5.5: SHACL validation results
export function validateShacl(
  ugm: UGM,
  shapes: ShaclShape[],
): ShaclValidationResult[] {
  const results: ShaclValidationResult[] = [];

  ugm.forEachNode((nodeId, attrs) => {
    const nodeTypes = attrs.types;

    for (const shape of shapes) {
      if (!nodeTypes.includes(shape.targetClass)) continue;

      const violations: ShaclViolation[] = [];

      for (const constraint of shape.properties) {
        const value = attrs.properties[constraint.path];
        const exists = value !== undefined && value !== null && value !== "";
        // sh:severity override: a constraint may declare its result
        // severity; absent, the per-check default applies.
        const sev = (
          dflt: "violation" | "warning" | "info",
        ): "violation" | "warning" | "info" => constraint.severity ?? dflt;

        // minCount
        if (constraint.minCount !== undefined && constraint.minCount > 0) {
          if (!exists) {
            violations.push({
              path: constraint.path,
              message: `Required property "${constraint.name ?? constraint.path}" is missing`,
              severity: sev("violation"),
            });
            continue;
          }
        }

        if (!exists) continue;

        // datatype
        if (constraint.datatype) {
          const actualType = typeof value;
          let valid = false;
          switch (constraint.datatype) {
            case "string":
              valid = actualType === "string";
              break;
            case "number":
              valid = actualType === "number" && isFinite(value as number);
              break;
            case "boolean":
              valid = actualType === "boolean";
              break;
            case "date":
              valid =
                actualType === "string" && !isNaN(Date.parse(value as string));
              break;
            case "uri":
              valid =
                actualType === "string" && (value as string).startsWith("http");
              break;
          }
          if (!valid) {
            violations.push({
              path: constraint.path,
              message: `"${constraint.path}" should be ${constraint.datatype}, got ${actualType}`,
              severity: sev("violation"),
            });
          }
        }

        // pattern
        if (constraint.pattern && typeof value === "string") {
          if (!new RegExp(constraint.pattern).test(value)) {
            violations.push({
              path: constraint.path,
              message: `"${constraint.path}" does not match pattern ${constraint.pattern}`,
              severity: sev("warning"),
            });
          }
        }

        // minInclusive / maxInclusive
        if (typeof value === "number") {
          if (
            constraint.minInclusive !== undefined &&
            value < constraint.minInclusive
          ) {
            violations.push({
              path: constraint.path,
              message: `"${constraint.path}" (${value}) is below minimum ${constraint.minInclusive}`,
              severity: sev("violation"),
            });
          }
          if (
            constraint.maxInclusive !== undefined &&
            value > constraint.maxInclusive
          ) {
            violations.push({
              path: constraint.path,
              message: `"${constraint.path}" (${value}) exceeds maximum ${constraint.maxInclusive}`,
              severity: sev("violation"),
            });
          }
        }

        // in (allowed values)
        if (constraint.in && !constraint.in.includes(value)) {
          violations.push({
            path: constraint.path,
            message: `"${constraint.path}" value "${value}" not in allowed set`,
            severity: sev("violation"),
          });
        }
      }

      // sh:closed (closed-world): values are allowed only for the
      // declared constraint paths plus sh:ignoredProperties. SHACL's
      // default is open-world, so absent/false changes nothing.
      if (shape.closed) {
        const allowed = new Set<string>([
          ...shape.properties.map((c) => c.path),
          ...(shape.ignoredProperties ?? []),
        ]);
        for (const key of Object.keys(attrs.properties)) {
          if (!allowed.has(key)) {
            violations.push({
              path: key,
              message: `Property "${key}" is not declared on closed shape "${shape.name ?? shape.id}" (sh:closed)`,
              severity: "violation",
            });
          }
        }
      }

      results.push({
        nodeId,
        shapeId: shape.id,
        shapeName: shape.name ?? shape.id,
        targetClass: shape.targetClass,
        valid: violations.length === 0,
        violations,
      });
    }
  });

  return results;
}

/**
 * Summarize validation results per shape.
 */
export function summarizeValidation(results: ShaclValidationResult[]): Array<{
  shapeId: string;
  shapeName: string;
  totalNodes: number;
  passing: number;
  failing: number;
  violationCount: number;
}> {
  const byShape = new Map<
    string,
    {
      shapeName: string;
      total: number;
      pass: number;
      fail: number;
      violations: number;
    }
  >();

  for (const r of results) {
    const entry = byShape.get(r.shapeId) ?? {
      shapeName: r.shapeName,
      total: 0,
      pass: 0,
      fail: 0,
      violations: 0,
    };
    entry.total++;
    if (r.valid) {
      entry.pass++;
    } else {
      entry.fail++;
      entry.violations += r.violations.length;
    }
    byShape.set(r.shapeId, entry);
  }

  return [...byShape.entries()].map(([shapeId, e]) => ({
    shapeId,
    shapeName: e.shapeName,
    totalNodes: e.total,
    passing: e.pass,
    failing: e.fail,
    violationCount: e.violations,
  }));
}

// ── Validator (class form) ──────────────────────────────────────────

/**
 * Stateful SHACL validator (P3.1).
 *
 * Holds a fixed set of shapes so callers can `validate()` repeatedly
 * against different UGMs without re-passing the shape list each time.
 * Internally delegates to `validateShacl()` and `summarizeValidation()`.
 *
 * @example
 *   const v = new ShaclValidator(shapes);
 *   const results = v.validate(ugm);
 *   const summary = v.summarize(results);
 */
export class ShaclValidator {
  constructor(public shapes: ShaclShape[]) {}

  validate(ugm: UGM): ShaclValidationResult[] {
    return validateShacl(ugm, this.shapes);
  }

  summarize(results: ShaclValidationResult[]) {
    return summarizeValidation(results);
  }
}
