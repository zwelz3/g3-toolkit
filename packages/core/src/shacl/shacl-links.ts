/**
 * SHACL linked shape-and-data views (slice B4, completing R1.17). The
 * acceptance bar that makes the shape view and the report view a
 * genuinely useful PAIR rather than two disconnected pictures: when
 * both are open, selecting a validation result highlights the focus
 * node in the data canvas AND the source shape's container (down to
 * the offending property-shape row) in the shape canvas; selecting a
 * shape filters the report to its results.
 *
 * Pure functions over the report document and the shaclRowId naming
 * convention; the host wires the returned ids into the selection
 * store and the report-list filter (no new rendering machinery).
 *
 * @see roadmap/design/shacl-views.md (B4, "linked views")
 * @see specs/01-functional-views.md R1.17
 */

import type { ShaclReportResult } from "./shacl-report";
import { shaclRowId } from "./shacl-to-structural";

/**
 * The set of element ids to highlight across BOTH canvases for a
 * selected validation result:
 * - dataNodeId: the focus node in the data canvas.
 * - shapeContainerId: the source shape's container in the shape canvas
 *   (undefined when the result names no source shape).
 * - shapeRowId: the specific property-shape row, when the result is
 *   property-scoped (has both a source shape and a path); undefined
 *   for node-level results, where the container is the finest target.
 */
export interface ShaclResultTargets {
  dataNodeId: string;
  shapeContainerId?: string;
  shapeRowId?: string;
}

/** Resolve the cross-canvas highlight targets for one result. */
export function resultTargets(result: ShaclReportResult): ShaclResultTargets {
  const targets: ShaclResultTargets = { dataNodeId: result.focusNode };
  if (result.sourceShape !== undefined) {
    targets.shapeContainerId = result.sourceShape;
    if (result.path !== undefined) {
      targets.shapeRowId = shaclRowId(result.sourceShape, result.path);
    }
  }
  return targets;
}

/**
 * The flat set of element ids a result should select, for one-shot
 * application to the selection store (the host clears, then selects
 * these). Order is stable: data node, shape container, shape row.
 */
export function resultSelectionIds(result: ShaclReportResult): string[] {
  const t = resultTargets(result);
  const ids = [t.dataNodeId];
  if (t.shapeContainerId) ids.push(t.shapeContainerId);
  if (t.shapeRowId) ids.push(t.shapeRowId);
  return ids;
}

/**
 * Inspector-facing detail for one result: the fields a Detail
 * Inspector lists when a result (or its focus node) is selected.
 * Pure passthrough/shaping so the inspector needs no SHACL knowledge.
 */
export interface ShaclResultDetail {
  focusNode: string;
  sourceShape?: string;
  path?: string;
  severity: ShaclResultResultSeverity;
  message?: string;
  value?: string;
}

type ShaclResultResultSeverity = ShaclReportResult["severity"];

/** Shape a result for inspector display. */
export function resultDetail(result: ShaclReportResult): ShaclResultDetail {
  return {
    focusNode: result.focusNode,
    sourceShape: result.sourceShape,
    path: result.path,
    severity: result.severity,
    message: result.message,
    value: result.value,
  };
}

/**
 * All results whose focus node is the given data node (selecting a
 * node in the data canvas surfaces its results in the inspector).
 */
export function resultsForFocusNode(
  results: ShaclReportResult[],
  focusNode: string,
): ShaclReportResult[] {
  return results.filter((r) => r.focusNode === focusNode);
}
