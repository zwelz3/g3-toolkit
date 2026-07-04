/**
 * SHACL validation REPORT visualization (slice B1, R1.17). Doctrine:
 * REPORTS, NOT VALIDATION. Conformance runs wherever it runs best
 * (pyshacl, Jena, a CI gate, or the in-core validator); the toolkit
 * consumes a versioned report document, the same pattern as
 * algorithm results, and renders it by reusing shipped machinery:
 * severity-tier structural overlays, count/severity encoding
 * drivers, and result-path edge emphasis.
 *
 * @see roadmap/design/shacl-views.md (B1)
 * @see specs/01-functional-views.md R1.17
 */

import type { ShaclValidationResult } from "./shacl-validator";
import type { StructuralOverlay } from "../algorithm-adapter/algorithm-results";

export type ShaclSeverity = "violation" | "warning" | "info";

/** One result in a versioned SHACL report document. */
export interface ShaclReportResult {
  /** Focus node id (must match the data-graph node id to render). */
  focusNode: string;
  /** Result path string (sh:resultPath), when the violation is
   *  property-scoped; used for path-edge emphasis. */
  path?: string;
  severity: ShaclSeverity;
  /** Source shape id/IRI (sh:sourceShape), for cross-linking. */
  sourceShape?: string;
  message?: string;
  /** Offending value (sh:value), optional. */
  value?: string;
}

/** Versioned SHACL validation report (the interchange document). */
export interface ShaclReportDocument {
  version: 1;
  conforms: boolean;
  /** Provenance, e.g. "pyshacl 0.30" or "g3t in-core". Optional. */
  source?: string;
  results: ShaclReportResult[];
}

/** Parse/validate an unknown value as a report document. */
export function parseShaclReport(raw: unknown): ShaclReportDocument {
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { version?: unknown }).version !== 1 ||
    !Array.isArray((raw as { results?: unknown }).results)
  ) {
    throw new Error("not a version-1 SHACL report document");
  }
  return raw as ShaclReportDocument;
}

/**
 * Adapt the in-core validator's ShaclValidationResult[] into a report
 * document. External RDF reports (sh:ValidationReport) convert via a
 * host-side script for now; a JSON-LD parser is a later slice.
 */
export function reportFromValidationResults(
  results: ShaclValidationResult[],
  source = "g3t in-core",
): ShaclReportDocument {
  const flat: ShaclReportResult[] = [];
  for (const r of results) {
    for (const v of r.violations) {
      flat.push({
        focusNode: r.nodeId,
        path: v.path,
        severity: v.severity,
        sourceShape: r.shapeId,
        message: v.message,
      });
    }
  }
  return {
    version: 1,
    conforms: flat.length === 0,
    source,
    results: flat,
  };
}

const SEVERITY_ORDER: ShaclSeverity[] = ["violation", "warning", "info"];
const SEVERITY_RANK: Record<ShaclSeverity, number> = {
  info: 1,
  warning: 2,
  violation: 3,
};

/** Stable overlay id for a severity tier. */
export function severityOverlayId(severity: ShaclSeverity): string {
  return `shacl-${severity}`;
}

const SEVERITY_LABEL: Record<ShaclSeverity, string> = {
  violation: "Violations",
  warning: "Warnings",
  info: "Info",
};

/**
 * Derive up to three severity-tier overlays from a report, over the
 * FOCUS NODES (and, where a result path names a direct property, the
 * focus node's edges of that type, supplied via pathEdgeResolver).
 * Each tier is independently toggleable through the overlay store;
 * deactivating all restores exactly. Empty tiers are omitted.
 *
 * pathEdgeResolver maps (focusNode, path) -> edge ids to emphasize;
 * callers wire it to their UGM (edges from the focus node whose
 * predicate matches the path). Omitted means node-only emphasis.
 */
export function severityOverlays(
  report: ShaclReportDocument,
  pathEdgeResolver?: (focusNode: string, path: string) => string[],
): StructuralOverlay[] {
  const byTier = new Map<
    ShaclSeverity,
    { nodes: Set<string>; edges: Set<string> }
  >();
  for (const r of report.results) {
    let tier = byTier.get(r.severity);
    if (!tier) {
      tier = { nodes: new Set(), edges: new Set() };
      byTier.set(r.severity, tier);
    }
    tier.nodes.add(r.focusNode);
    if (r.path && pathEdgeResolver) {
      for (const e of pathEdgeResolver(r.focusNode, r.path)) tier.edges.add(e);
    }
  }
  const overlays: StructuralOverlay[] = [];
  for (const severity of SEVERITY_ORDER) {
    const tier = byTier.get(severity);
    if (!tier || tier.nodes.size === 0) continue;
    overlays.push({
      id: severityOverlayId(severity),
      label: SEVERITY_LABEL[severity],
      nodeIds: [...tier.nodes],
      edgeIds: [...tier.edges],
    });
  }
  return overlays;
}

/**
 * Per-focus-node encoding-driver properties: result count and worst
 * severity, for ingestion into the UGM so the encoding grammar can
 * drive size from the count or color from the severity (the
 * clustering-is-a-driver doctrine applied to conformance). Returns a
 * map ready for ingestAlgorithmResults.
 */
export function shaclResultDrivers(
  report: ShaclReportDocument,
): Map<string, Record<string, unknown>> {
  const counts = new Map<string, number>();
  const worst = new Map<string, ShaclSeverity>();
  for (const r of report.results) {
    counts.set(r.focusNode, (counts.get(r.focusNode) ?? 0) + 1);
    const cur = worst.get(r.focusNode);
    if (!cur || SEVERITY_RANK[r.severity] > SEVERITY_RANK[cur]) {
      worst.set(r.focusNode, r.severity);
    }
  }
  const drivers = new Map<string, Record<string, unknown>>();
  for (const [node, count] of counts) {
    drivers.set(node, {
      _shacl_resultCount: count,
      _shacl_maxSeverity: worst.get(node),
    });
  }
  return drivers;
}

/** All focus nodes in a report (for cross-linking and filtering). */
export function reportFocusNodes(report: ShaclReportDocument): Set<string> {
  return new Set(report.results.map((r) => r.focusNode));
}

/** Results for one source shape (shape-selection filters the report). */
export function resultsForShape(
  report: ShaclReportDocument,
  shapeId: string,
): ShaclReportResult[] {
  return report.results.filter((r) => r.sourceShape === shapeId);
}
