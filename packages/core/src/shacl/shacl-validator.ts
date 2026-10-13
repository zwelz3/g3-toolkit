/**
 * ShaclValidator: validate UGM nodes against SHACL shapes (DE.1).
 *
 * Lightweight validator that checks property constraints (minCount,
 * maxCount, datatype, pattern, minInclusive, maxInclusive) against
 * the focus nodes a shape's targets select. Does not implement the
 * full SHACL specification; covers the constraints most useful for
 * ontology authoring.
 *
 * Framework-agnostic (D6).
 */

import type { UGM } from "../ugm";

// ── Shape Types ─────────────────────────────────────────────────────

export interface ShaclPropertyConstraint {
  /** The property shape's own identifier (its IRI when parsed from a
   *  shapes graph). Optional and informational for the validator; the
   *  shape browser keys constraint rows by it, because one shape may
   *  constrain the same path twice (two property shapes on one
   *  predicate) and `path` alone is not unique. */
  id?: string;
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

/** One SHACL target declaration (sh:targetClass, sh:targetSubjectsOf,
 *  sh:targetObjectsOf, sh:targetNode, sh:target with a SPARQL body).
 *  `value` is the class, predicate, or node IRI, or the SPARQL text.
 *  The validator selects focus nodes by kind: `class` matches nodes
 *  typed with the class (as `targetClass` does), `subjectsOf` the
 *  source of every edge of that type, `objectsOf` the target of every
 *  edge of that type, `node` the node with that id. `sparql` selects
 *  NOTHING: the toolkit runs no SPARQL, so a SPARQL target is display
 *  metadata only and an external engine must evaluate it. */
export interface ShaclShapeTarget {
  kind: "class" | "subjectsOf" | "objectsOf" | "node" | "sparql";
  value: string;
}

export interface ShaclShape {
  id: string;
  /** The primary class target (sh:targetClass). Optional since 1.2.0
   *  shipped `targets` (issue #67): a shape targeted only by
   *  subjects-of, objects-of, a node, or SPARQL has no class to name
   *  here. Absent and `""` mean the same thing, no class target; the
   *  `""` form stays accepted because hosts on the required type
   *  passed it as the placeholder. */
  targetClass?: string;
  /** Every target the shape declares (several classes, subjects-of,
   *  objects-of, a node, a SPARQL target). The validator selects focus
   *  nodes from the union of `targetClass` and these entries, deduped,
   *  so a class listed both ways validates once; see
   *  `ShaclShapeTarget` for what each kind selects. A shape with no
   *  target at all selects nothing. The shape browser renders all of
   *  them alongside `targetClass`. */
  targets?: ShaclShapeTarget[];
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
  /** Echo of the shape's `targetClass`; absent when the shape has
   *  none (its focus nodes came from `targets`). */
  targetClass?: string;
  valid: boolean;
  violations: ShaclViolation[];
}

/**
 * The focus nodes one shape's targets select, in the union of
 * `targetClass` and every `targets` entry, deduplicated by node id.
 * Resolved once per shape rather than per node because subjects-of
 * and objects-of are edge-side selections: answering "is this node a
 * focus node" from the node alone would need an edge scan per node.
 */
function focusNodesOf(ugm: UGM, shape: ShaclShape): Set<string> {
  const classes = new Set<string>();
  const subjectsOf = new Set<string>();
  const objectsOf = new Set<string>();
  const nodeIds = new Set<string>();
  // "" is the pre-1.2 placeholder for "no class target"; it names no
  // class, so it must not match a node typed "" by accident either.
  if (shape.targetClass) classes.add(shape.targetClass);
  for (const t of shape.targets ?? []) {
    if (t.value === "") continue;
    switch (t.kind) {
      case "class":
        classes.add(t.value);
        break;
      case "subjectsOf":
        subjectsOf.add(t.value);
        break;
      case "objectsOf":
        objectsOf.add(t.value);
        break;
      case "node":
        nodeIds.add(t.value);
        break;
      case "sparql":
        // Not evaluated: no SPARQL engine in the toolkit.
        break;
    }
  }

  const focus = new Set<string>();
  if (classes.size > 0) {
    ugm.forEachNode((id, attrs) => {
      if (attrs.types.some((type) => classes.has(type))) focus.add(id);
    });
  }
  if (subjectsOf.size > 0 || objectsOf.size > 0) {
    ugm.forEachEdge((_edgeId, attrs, source, target) => {
      if (subjectsOf.has(attrs.type)) focus.add(source);
      if (objectsOf.has(attrs.type)) focus.add(target);
    });
  }
  for (const id of nodeIds) {
    // A node target naming an id the graph lacks selects nothing; a
    // result for a node that is not there would have no attributes to
    // validate against.
    if (ugm.hasNode(id)) focus.add(id);
  }
  return focus;
}

// ── Validator (function form) ───────────────────────────────────────

// @see R5.5: SHACL validation results
export function validateShacl(
  ugm: UGM,
  shapes: ShaclShape[],
): ShaclValidationResult[] {
  const results: ShaclValidationResult[] = [];
  // Node-major, shape-minor iteration, as before `targets` was read:
  // the result order a class-only host saw is unchanged.
  const shapeFocus = shapes.map(
    (shape) => [shape, focusNodesOf(ugm, shape)] as const,
  );

  ugm.forEachNode((nodeId, attrs) => {
    for (const [shape, focus] of shapeFocus) {
      if (!focus.has(nodeId)) continue;

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

      const result: ShaclValidationResult = {
        nodeId,
        shapeId: shape.id,
        shapeName: shape.name ?? shape.id,
        valid: violations.length === 0,
        violations,
      };
      // Echo the class only when the shape names one, so a result
      // from a targets-only shape carries no `targetClass: undefined`
      // key (toMatchObject and JSON round-trips see the same record).
      if (shape.targetClass !== undefined) {
        result.targetClass = shape.targetClass;
      }
      results.push(result);
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
