/**
 * Graph analytics over the digital thread. Three families, matching item 1:
 *
 *  - Gap analysis: sole-source parts and single-point-of-failure suppliers
 *    (structural, computed from the sourcing edges) merged with the SHACL
 *    findings (missing certification, incomplete provenance) into one gap
 *    report the shell can drive overlays from.
 *  - Clustering: group nodes by region, tier, or connected component; the
 *    result is a node -> cluster-label map that drives categorical color.
 *  - Path tracing: follow the directed thread downstream from a node to the
 *    assemblies it ultimately feeds, so a supplier's blast radius is visible.
 *
 * All functions are pure over a UGM and return plain data, so they are
 * unit-testable without a browser.
 */
import { UGM, validateShacl, connectedComponents } from "@g3t/core";
import type { ShaclShape } from "@g3t/core";
import { SHAPE_CERT, SHAPE_PROVENANCE } from "./shapes";

interface NodeView {
  id: string;
  types: string[];
  props: Record<string, unknown>;
}

function readNodes(ugm: UGM): Map<string, NodeView> {
  const map = new Map<string, NodeView>();
  ugm.forEachNode((id, attrs) => {
    map.set(id, { id, types: attrs.types, props: attrs.properties });
  });
  return map;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** part id -> supplier ids, from "supplies" edges (supplier -> part). */
function suppliersByPart(ugm: UGM): Map<string, string[]> {
  const byPart = new Map<string, string[]>();
  ugm.forEachEdge((_e, attrs, source, target) => {
    if (attrs.type !== "supplies") return;
    const list = byPart.get(target) ?? [];
    list.push(source);
    byPart.set(target, list);
  });
  return byPart;
}

/** Parts sourced by exactly one supplier. */
export function soleSourceParts(ugm: UGM): string[] {
  const byPart = suppliersByPart(ugm);
  const out: string[] = [];
  for (const [part, sups] of byPart) {
    if (sups.length === 1) out.push(part);
  }
  return out;
}

/** Suppliers that are the sole source of at least one part. */
export function singlePointsOfFailure(ugm: UGM): string[] {
  const byPart = suppliersByPart(ugm);
  const spof = new Set<string>();
  for (const sups of byPart.values()) {
    if (sups.length === 1 && sups[0]) spof.add(sups[0]);
  }
  return [...spof];
}

export type ClusterMode = "region" | "tier" | "component";

/** node id -> cluster label, for nodes that participate in the chosen mode. */
export function clusterBy(ugm: UGM, mode: ClusterMode): Map<string, string> {
  const out = new Map<string, string>();
  if (mode === "component") {
    const comp = connectedComponents(ugm);
    // Semantic labels (review 5.8): "Component 1" told the consumer
    // nothing. Each component is named by its dominant node type and
    // its highest-degree member, e.g. "Mostly Part: around Control
    // PCB (14)", so the cluster rows read as descriptions instead of
    // enumeration.
    const nodes = readNodes(ugm);
    const degree = new Map<string, number>();
    ugm.forEachEdge((_e, _a, source, target) => {
      degree.set(source, (degree.get(source) ?? 0) + 1);
      degree.set(target, (degree.get(target) ?? 0) + 1);
    });
    const membersOf = new Map<number, string[]>();
    for (const [id, n] of comp) {
      const arr = membersOf.get(n) ?? [];
      arr.push(id);
      membersOf.set(n, arr);
    }
    const labelOf = new Map<number, string>();
    for (const [n, ids] of membersOf) {
      const typeCount = new Map<string, number>();
      let top: string | undefined;
      let topDeg = -1;
      for (const id of ids) {
        const t = nodes.get(id)?.types[0] ?? "Unknown";
        typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
        const d = degree.get(id) ?? 0;
        if (d > topDeg) {
          topDeg = d;
          top = id;
        }
      }
      const dominant =
        [...typeCount.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0]?.[0] ?? "Mixed";
      const topName = str(nodes.get(top ?? "")?.props.name) ?? top;
      labelOf.set(
        n,
        topName
          ? `Mostly ${dominant}: around ${topName}`
          : `Mostly ${dominant} (${ids.length})`,
      );
    }
    for (const [id, n] of comp)
      out.set(id, labelOf.get(n) ?? `Component ${n + 1}`);
    return out;
  }
  const nodes = readNodes(ugm);
  for (const node of nodes.values()) {
    if (mode === "region") {
      const region = str(node.props.region);
      if (region) out.set(node.id, region);
    } else {
      // tier applies to suppliers
      const tier = node.props.tier;
      if (typeof tier === "number") out.set(node.id, `Tier ${tier}`);
    }
  }
  return out;
}

/**
 * All downstream paths from a node to Assembly nodes, following directed
 * edges. Cycle-guarded by the visited-on-path set; returns node-id paths.
 */
export function tracePaths(
  ugm: UGM,
  fromId: string,
  targetType = "Assembly",
): string[][] {
  const adjacency = new Map<string, string[]>();
  ugm.forEachEdge((_e, _attrs, source, target) => {
    const list = adjacency.get(source) ?? [];
    list.push(target);
    adjacency.set(source, list);
  });
  const nodes = readNodes(ugm);
  const paths: string[][] = [];
  const walk = (current: string, trail: string[]): void => {
    const node = nodes.get(current);
    if (node && node.types.includes(targetType) && trail.length > 1) {
      // Record AND continue (review 5.10): with nested assemblies, a
      // trace yields both the sub-assembly hit and the full path to
      // the enclosing assembly. Graphs without nesting are unchanged
      // (an assembly with no outgoing edges terminates naturally).
      paths.push([...trail]);
    }
    for (const next of adjacency.get(current) ?? []) {
      if (trail.includes(next)) continue; // cycle guard
      walk(next, [...trail, next]);
    }
  };
  walk(fromId, [fromId]);
  return paths;
}

export type GapKind =
  | "sole-source"
  | "single-point-of-failure"
  | "missing-certification"
  | "incomplete-provenance";

export interface GapFinding {
  nodeId: string;
  kind: GapKind;
  severity: "violation" | "warning";
  detail: string;
}

/**
 * The unified gap report: structural analytics (sole-source, SPOF) merged
 * with the SHACL findings (missing cert, incomplete provenance). A sole-
 * sourced CRITICAL part is escalated to a violation; a sole-sourced standard
 * part is a warning.
 */
export function analyzeGaps(ugm: UGM, shapes: ShaclShape[]): GapFinding[] {
  const nodes = readNodes(ugm);
  const findings: GapFinding[] = [];

  const byPart = suppliersByPart(ugm);
  for (const [part, sups] of byPart) {
    if (sups.length !== 1) continue;
    const node = nodes.get(part);
    const critical = str(node?.props.criticality) === "critical";
    const name = str(node?.props.name) ?? part;
    findings.push({
      nodeId: part,
      kind: "sole-source",
      severity: critical ? "violation" : "warning",
      detail: `${name} is sourced by a single supplier${critical ? " and is flight-critical" : ""}`,
    });
  }

  for (const sid of singlePointsOfFailure(ugm)) {
    const soleCount = [...byPart.values()].filter(
      (s) => s.length === 1 && s[0] === sid,
    ).length;
    const name = str(nodes.get(sid)?.props.name) ?? sid;
    findings.push({
      nodeId: sid,
      kind: "single-point-of-failure",
      severity: "warning",
      detail: `${name} is the sole source for ${soleCount} part${soleCount === 1 ? "" : "s"}`,
    });
  }

  for (const result of validateShacl(ugm, shapes)) {
    if (result.valid) continue;
    for (const v of result.violations) {
      const name = str(nodes.get(result.nodeId)?.props.name) ?? result.nodeId;
      if (result.shapeId === SHAPE_CERT) {
        findings.push({
          nodeId: result.nodeId,
          kind: "missing-certification",
          severity: v.severity === "info" ? "warning" : v.severity,
          detail: `${name} has no supplier holding its required certification`,
        });
      } else if (result.shapeId === SHAPE_PROVENANCE) {
        findings.push({
          nodeId: result.nodeId,
          kind: "incomplete-provenance",
          severity: "warning",
          detail: `${name} is missing ${v.path} in the consolidated record`,
        });
      }
    }
  }

  return findings;
}
