/**
 * Screen-reader wording for the auditor shell (issue #16). A graph canvas
 * is opaque to assistive technology, so the shell narrates, through the
 * toolkit's AriaCompanion live region, exactly what a user following a
 * chain needs and cannot get from the canvas: the selected node with its
 * PROV-O edge counts and SHACL standing, the lineage step when a trace
 * advances, and the time window when the filter moves. Pure functions;
 * the shell test asserts what reaches the region.
 */
import type { UGM } from "@g3-toolkit/core";
import type { ProvenanceChain } from "@g3-toolkit/react";
import type { ProvenanceEvent, ProvenanceReport } from "./timeline";

function nameOf(ugm: UGM, id: string): string {
  const n = ugm.getNode(id)?.properties.name;
  return typeof n === "string" ? n : id;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * "Release 1.2, Entity, 2 incoming and 1 outgoing provenance edges,
 * 1 SHACL finding, worst severity warning". Edge counts are directed
 * (the thing R7.10's undirected "connections" cannot say about a
 * provenance record); the SHACL clause reads "no SHACL findings" when
 * the node is clean.
 */
export function describeSelection(
  ugm: UGM,
  id: string,
  report: ProvenanceReport,
): string {
  const attrs = ugm.getNode(id);
  if (!attrs) return id;
  let incoming = 0;
  let outgoing = 0;
  for (const edgeId of ugm.getNodeEdges(id)) {
    const ends = ugm.getEdgeEndpoints(edgeId);
    if (!ends) continue;
    if (ends.source === id) outgoing += 1;
    if (ends.target === id) incoming += 1;
  }
  const violations = report.violations.filter((f) => f.nodeId === id).length;
  const warnings = report.warnings.filter((f) => f.nodeId === id).length;
  const findings = violations + warnings;
  const shacl =
    findings === 0
      ? "no SHACL findings"
      : `${plural(findings, "SHACL finding")}, worst severity ${
          violations > 0 ? "violation" : "warning"
        }`;
  return `${nameOf(ugm, id)}, ${attrs.types.join(", ")}, ${incoming} incoming and ${outgoing} outgoing provenance edges, ${shacl}`;
}

/**
 * "Lineage step 2 of 4: CI build, via wasGeneratedBy", or null when the
 * id is not a hop of the open chain. Absence hops are not selectable
 * and so never a step; they count toward the total so the user hears
 * that the chain ends in a gap.
 */
export function describeStep(chain: ProvenanceChain, id: string): string | null {
  const idx = chain.findIndex((h) => h.id === id);
  if (idx < 0) return null;
  const hop = chain[idx];
  if (!hop) return null;
  const via = hop.detail !== undefined ? `, via ${hop.detail}` : "";
  const gap = chain.some((h) => h.absence === true)
    ? "; this lineage ends in a gap"
    : "";
  return `Lineage step ${idx + 1} of ${chain.length}: ${hop.label}${via}${gap}`;
}

/**
 * "Time window 2025-01-10 to 2025-03-12, 7 of 9 events in window,
 * 3 nodes hidden".
 */
export function describeWindow(
  start: number,
  end: number,
  events: readonly ProvenanceEvent[],
  hiddenCount: number,
  fmt: (t: number) => string,
): string {
  const inWindow = events.filter((e) => e.time >= start && e.time <= end)
    .length;
  return `Time window ${fmt(start)} to ${fmt(end)}, ${inWindow} of ${events.length} events in window, ${plural(hiddenCount, "node")} hidden`;
}
