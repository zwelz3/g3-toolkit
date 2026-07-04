/**
 * SHACL shape graph -> structural view input (slice B3, the
 * appropriate-reuse milestone). Maps ShaclShape[] onto the SAME
 * StructuralGraphInput the UML custom views use, so the shape view
 * renders through layoutStructural + the canvas converter with zero
 * parallel machinery: NodeShapes become containers, property
 * constraints become compartment ROWS, closed/open and severity
 * become shape-level signals, and sh:class/sh:node/target references
 * become edges.
 *
 * @see roadmap/design/shacl-views.md (B2/B3)
 * @see roadmap/design/structural-rendering.md (the compartment API)
 * @see specs/01-functional-views.md R1.16
 */

import type {
  ShaclShape,
  ShaclPropertyConstraint,
  ShaclValidationResult,
} from "./shacl-validator";
import type {
  StructuralGraphInput,
  StructuralNode,
  StructuralRow,
  StructuralEdge,
} from "../layout/structural";

/** datatype keyword -> the xsd: suffix the UML-attribute look uses. */
const DATATYPE_SUFFIX: Record<
  NonNullable<ShaclPropertyConstraint["datatype"]>,
  string
> = {
  string: "xsd:string",
  number: "xsd:decimal",
  boolean: "xsd:boolean",
  date: "xsd:date",
  uri: "IRI",
};

/** UML-style [min..max] from sh:minCount/sh:maxCount; absent = [0..*]. */
export function cardinalitySuffix(c: ShaclPropertyConstraint): string {
  const min = c.minCount ?? 0;
  const max = c.maxCount === undefined ? "*" : String(c.maxCount);
  return `[${min}..${max}]`;
}

/**
 * Count the "value constraints" on a property (sh:pattern, sh:in,
 * sh:minInclusive, sh:maxInclusive): the chip count shown on the row;
 * full detail is an inspector concern.
 */
export function valueConstraintCount(c: ShaclPropertyConstraint): number {
  let n = 0;
  if (c.pattern !== undefined) n++;
  if (c.in !== undefined) n++;
  if (c.minInclusive !== undefined) n++;
  if (c.maxInclusive !== undefined) n++;
  return n;
}

/** The inline row text for one property constraint:
 *  `path : type [min..max]` with a trailing constraint chip. */
export function propertyRowText(c: ShaclPropertyConstraint): string {
  const label = c.name ?? c.path;
  const type = c.datatype ? ` : ${DATATYPE_SUFFIX[c.datatype]}` : "";
  const card = ` ${cardinalitySuffix(c)}`;
  const chips = valueConstraintCount(c);
  const chip = chips > 0 ? ` (+${chips})` : "";
  return `${label}${type}${card}${chip}`;
}

export interface ShaclToStructuralOptions {
  /**
   * Property paths (sh:class / sh:node targets are not in the
   * lightweight model, so callers may pass a map from a richer parse:
   * `${shapeId}::${path}` -> target shape id) to draw reference edges
   * for. Optional; omitted means no reference edges.
   */
  references?: Record<string, string>;
}

/** A stable row id for a property constraint within a shape. */
export function shaclRowId(shapeId: string, path: string): string {
  return `${shapeId}::prop::${path}`;
}

/**
 * Map SHACL shapes to a structural input. Each shape is a container
 * with a «NodeShape» header over its name/IRI and one "constraints"
 * compartment whose rows are the property constraints. Closed shapes
 * are flagged for the solid-border variant via a `_shaclClosed`
 * marker the canvas converter can read; reference edges are emitted
 * when a references map is supplied.
 */
export function shaclShapesToStructural(
  shapes: ShaclShape[],
  options?: ShaclToStructuralOptions,
): StructuralGraphInput {
  const nodes: StructuralNode[] = shapes.map((shape) => {
    const rows: StructuralRow[] = shape.properties.map((c) => ({
      id: shaclRowId(shape.id, c.path),
      text: propertyRowText(c),
    }));
    return {
      id: shape.id,
      header: { stereotype: "NodeShape", name: shape.name ?? shape.id },
      compartments: [{ id: "properties", title: "properties", rows }],
    };
  });

  const edges: StructuralEdge[] = [];
  const refs = options?.references ?? {};
  for (const [key, targetShapeId] of Object.entries(refs)) {
    const sep = key.indexOf("::");
    if (sep < 0) continue;
    const sourceShapeId = key.slice(0, sep);
    const path = key.slice(sep + 2);
    edges.push({
      id: `shref:${key}`,
      source: sourceShapeId,
      target: targetShapeId,
      // The reference edge is the sh:node on this property; label it
      // with the path so the shape graph reads as "Person.worksFor
      // -> OrgShape" rather than an unlabeled line.
      label: path,
    });
  }

  return { nodes, edges };
}

/**
 * The set of shape ids that are closed (sh:closed), for the canvas to
 * apply the solid-border variant. Kept separate from the structural
 * input because closed/open is a SHACL-specific styling signal, not a
 * structural-layout concern.
 */
export function closedShapeIds(shapes: ShaclShape[]): Set<string> {
  return new Set(shapes.filter((s) => s.closed).map((s) => s.id));
}

/** Severity ordering for "worst wins" when a row has several. */
const SEVERITY_RANK: Record<string, number> = {
  info: 1,
  warning: 2,
  violation: 3,
};

/**
 * Map validation results onto property-shape ROWS: returns
 * `rowId -> worst severity` so the shape view can badge the exact
 * row whose constraint failed (rows are real elements, so this is
 * the per-row badge the B3 design calls for). Row ids match
 * shaclShapesToStructural's via shaclRowId(shapeId, path).
 *
 * Results whose violation path does not correspond to a property
 * row (e.g. sh:closed extra-property violations keyed by the
 * offending property, node-level violations) are skipped here; the
 * focus-node-level report overlays over the data graph carry those.
 */
export function shaclRowSeverities(
  results: ShaclValidationResult[],
): Map<string, "violation" | "warning" | "info"> {
  const worst = new Map<string, "violation" | "warning" | "info">();
  const rank = (s: "violation" | "warning" | "info"): number =>
    SEVERITY_RANK[s] ?? 0;
  for (const result of results) {
    for (const v of result.violations) {
      const rowId = shaclRowId(result.shapeId, v.path);
      const current = worst.get(rowId);
      if (!current || rank(v.severity) > rank(current)) {
        worst.set(rowId, v.severity);
      }
    }
  }
  return worst;
}
