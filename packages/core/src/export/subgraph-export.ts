/**
 * Subgraph export (the export-and-reporting requirement, slice 1).
 *
 * Exports the induced subgraph of a node-id set: the nodes, their
 * properties, and the inter-edges (edges whose BOTH endpoints are in
 * the set: the acceptance shape). An empty selection means the whole
 * graph. Three formats this slice:
 *
 * - Turtle: a deliberately small vocabulary (g3t: terms under a
 *   stable base IRI, rdfs:label from the name property, rdf:type per
 *   UGM type). Provenance IRIs pass through when present, so
 *   round-tripping into a triple store keeps lineage.
 * - JSON: { nodes, edges } with full attributes (the lossless form;
 *   workspace snapshots cover view state separately).
 * - CSV: two tables in one file (nodes, blank line, edges) for the
 *   spreadsheet path.
 *
 * PNG/SVG screenshots are view concerns and live with the canvas
 * (cy.png through the toolbar's export control).
 *
 * @see specs/02-functional-interaction.md R2.11
 */

import type { UGM } from "../ugm";

export interface SubgraphSelection {
  /** Node ids to export; empty or omitted exports every node. */
  nodeIds?: string[];
}

interface ExportNode {
  id: string;
  types: string[];
  properties: Record<string, unknown>;
}
interface ExportEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

function collect(ugm: UGM, selection?: SubgraphSelection) {
  const wanted =
    selection?.nodeIds && selection.nodeIds.length > 0
      ? new Set(selection.nodeIds)
      : null;
  const nodes: ExportNode[] = [];
  ugm.forEachNode((id, attrs) => {
    if (wanted && !wanted.has(id)) return;
    nodes.push({
      id,
      types: [...(attrs.types ?? [])],
      properties: { ...attrs.properties },
    });
  });
  const present = new Set(nodes.map((n) => n.id));
  const edges: ExportEdge[] = [];
  ugm.forEachEdge((id, attrs, source, target) => {
    if (!present.has(source) || !present.has(target)) return;
    edges.push({
      id,
      source,
      target,
      type: attrs.type,
      properties: { ...attrs.properties },
    });
  });
  return { nodes, edges };
}

// ── Turtle ───────────────────────────────────────────────────────────

const BASE = "urn:g3t:";

function iriSafe(local: string): string {
  return encodeURIComponent(local);
}

function turtleLiteral(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? `${value}` : `${value}`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  const s = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
  return `"${s}"`;
}

export function exportSubgraphTurtle(
  ugm: UGM,
  selection?: SubgraphSelection,
): string {
  const { nodes, edges } = collect(ugm, selection);
  const lines: string[] = [
    `@prefix g3t: <${BASE}> .`,
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
    "@prefix prov: <http://www.w3.org/ns/prov#> .",
    "",
  ];
  for (const n of nodes) {
    const subject = `g3t:node-${iriSafe(n.id)}`;
    for (const type of n.types) {
      lines.push(`${subject} rdf:type g3t:type-${iriSafe(type)} .`);
    }
    const name = n.properties["name"];
    if (name !== undefined) {
      lines.push(`${subject} rdfs:label ${turtleLiteral(name)} .`);
    }
    for (const [key, value] of Object.entries(n.properties)) {
      if (key === "name" || value === undefined || value === null) continue;
      if (key === "provenance_iri") {
        lines.push(`${subject} prov:wasDerivedFrom <${String(value)}> .`);
        continue;
      }
      lines.push(
        `${subject} g3t:prop-${iriSafe(key)} ${turtleLiteral(value)} .`,
      );
    }
  }
  lines.push("");
  for (const e of edges) {
    lines.push(
      `g3t:node-${iriSafe(e.source)} g3t:rel-${iriSafe(e.type)} g3t:node-${iriSafe(e.target)} .`,
    );
  }
  return lines.join("\n") + "\n";
}

// ── JSON ─────────────────────────────────────────────────────────────

export function exportSubgraphJson(
  ugm: UGM,
  selection?: SubgraphSelection,
): string {
  const { nodes, edges } = collect(ugm, selection);
  return JSON.stringify({ version: 1, nodes, edges }, null, 2);
}

// ── CSV ──────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportSubgraphCsv(
  ugm: UGM,
  selection?: SubgraphSelection,
): string {
  const { nodes, edges } = collect(ugm, selection);
  const nodeKeys = [
    ...new Set(nodes.flatMap((n) => Object.keys(n.properties))),
  ].sort();
  const out: string[] = [];
  out.push(["id", "types", ...nodeKeys].map(csvCell).join(","));
  for (const n of nodes) {
    out.push(
      [n.id, n.types.join(";"), ...nodeKeys.map((k) => n.properties[k])]
        .map(csvCell)
        .join(","),
    );
  }
  out.push("");
  const edgeKeys = [
    ...new Set(edges.flatMap((e) => Object.keys(e.properties))),
  ].sort();
  out.push(
    ["id", "source", "target", "type", ...edgeKeys].map(csvCell).join(","),
  );
  for (const e of edges) {
    out.push(
      [
        e.id,
        e.source,
        e.target,
        e.type,
        ...edgeKeys.map((k) => e.properties[k]),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return out.join("\n") + "\n";
}
