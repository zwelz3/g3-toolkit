/**
 * Pure adapters from analytics results to the toolkit's viz primitives, kept
 * separate from the shell so they can be unit-tested. Gap findings become
 * severity-tiered overlays (the canvas renders active overlays as emphasized
 * borders); a traced path becomes one overlay over its nodes and the edges
 * between them; provenance and clusters become small summaries the sidebar
 * lists.
 */
import { UGM } from "@g3t/core";
import type { StructuralOverlay } from "@g3t/core";
import type { GapFinding } from "./analytics";

export const OVERLAY_VIOLATION = "gap.violations";
export const OVERLAY_WARNING = "gap.warnings";
export const OVERLAY_PATH = "trace.path";

/**
 * Two overlays, one per severity tier. A node showing a violation is not also
 * listed as a warning, so its worst tier wins visually.
 */
export function gapOverlays(findings: GapFinding[]): StructuralOverlay[] {
  const violation = new Set<string>();
  const warning = new Set<string>();
  for (const f of findings) {
    if (f.severity === "violation") violation.add(f.nodeId);
  }
  for (const f of findings) {
    if (f.severity === "warning" && !violation.has(f.nodeId))
      warning.add(f.nodeId);
  }
  return [
    {
      id: OVERLAY_VIOLATION,
      label: "Violations",
      nodeIds: [...violation],
      edgeIds: [],
      algorithm: "gap-analysis",
    },
    {
      id: OVERLAY_WARNING,
      label: "Warnings",
      nodeIds: [...warning],
      edgeIds: [],
      algorithm: "gap-analysis",
    },
  ];
}

/** Provenance summary: how many nodes each source system contributed. */
export function sourceCounts(
  ugm: UGM,
): Array<{ source: string; count: number }> {
  const counts = new Map<string, number>();
  ugm.forEachNode((_id, attrs) => {
    const src = attrs.properties.source;
    if (typeof src === "string") counts.set(src, (counts.get(src) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/** Invert a node -> cluster-label map into label -> members, sorted by size. */
export function clusterMembers(
  clusters: Map<string, string>,
): Array<{ label: string; members: string[] }> {
  const byLabel = new Map<string, string[]>();
  for (const [id, label] of clusters) {
    const list = byLabel.get(label) ?? [];
    list.push(id);
    byLabel.set(label, list);
  }
  return [...byLabel.entries()]
    .map(([label, members]) => ({ label, members }))
    .sort(
      (a, b) =>
        b.members.length - a.members.length || a.label.localeCompare(b.label),
    );
}

/**
 * One overlay covering every node on the traced paths plus the edges between
 * consecutive nodes, so the route reads as a connected highlight.
 */
export function tracePathOverlay(
  ugm: UGM,
  paths: string[][],
): StructuralOverlay {
  const nodeIds = new Set<string>();
  const pairs = new Set<string>();
  for (const path of paths) {
    for (let i = 0; i < path.length; i += 1) {
      const cur = path[i];
      if (cur) nodeIds.add(cur);
      const next = path[i + 1];
      if (cur && next) pairs.add(`${cur}\u0000${next}`);
    }
  }
  const edgeIds: string[] = [];
  ugm.forEachEdge((edgeId, _attrs, source, target) => {
    if (pairs.has(`${source}\u0000${target}`)) edgeIds.push(edgeId);
  });
  return {
    id: OVERLAY_PATH,
    label: "Traced supply path",
    nodeIds: [...nodeIds],
    edgeIds,
    algorithm: "path-trace",
  };
}
