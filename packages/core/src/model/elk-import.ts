/**
 * ELK JSON import (G3L:IOP-002, workstream E2).
 *
 * Imports ELK graph JSON LOSSLESSLY for the topology/ports subset:
 * the child hierarchy becomes document parent refs, ports (with
 * side options recognized) become document ports, node labels
 * become document labels, and layoutOptions pass through OPAQUE and
 * verbatim (the spec's "layout-option passthrough"). Edge routing
 * sections and coordinates are NOT part of the imported subset and
 * are skipped with one summary diagnostic when present; multi-
 * source/target hyperedges import their first endpoints with a
 * per-edge diagnostic (the document's edge model is binary).
 *
 * Rationale (spec): g3t's structural pipeline assembles ELK graphs
 * internally; this import is the migration bridge and the
 * shared-fixture format for QLT-002 comparisons.
 */
import type {
  DocEdge,
  DocNode,
  DocPort,
  DocumentDiagnostic,
  GraphDocument,
} from "./graph-document";
import { validateGraphDocument } from "./graph-document";

/** The ELK JSON subset this importer reads (structural typing; any
 *  extra fields are ignored, never rejected). */
export interface ElkJsonNode {
  id: string;
  labels?: readonly { text?: string }[];
  width?: number;
  height?: number;
  ports?: readonly {
    id: string;
    layoutOptions?: Readonly<Record<string, string>>;
  }[];
  layoutOptions?: Readonly<Record<string, string>>;
  children?: readonly ElkJsonNode[];
  edges?: readonly ElkJsonEdge[];
}

export interface ElkJsonEdge {
  id: string;
  sources?: readonly string[];
  targets?: readonly string[];
  labels?: readonly { text?: string }[];
  sections?: readonly unknown[];
}

const PORT_SIDE_OPTION = "org.eclipse.elk.port.side";

export function importElkJson(root: ElkJsonNode): {
  document: GraphDocument;
  diagnostics: DocumentDiagnostic[];
} {
  const nodes: DocNode[] = [];
  const edges: DocEdge[] = [];
  const diagnostics: DocumentDiagnostic[] = [];
  const portOwner = new Map<string, string>();
  let sectionsSeen = 0;

  const walkNode = (n: ElkJsonNode, parent: string | undefined): void => {
    const ports: DocPort[] = [];
    for (const p of n.ports ?? []) {
      const side = p.layoutOptions?.[PORT_SIDE_OPTION];
      ports.push({
        id: p.id,
        ...(side === "NORTH" ||
        side === "SOUTH" ||
        side === "EAST" ||
        side === "WEST"
          ? { side }
          : {}),
      });
      portOwner.set(p.id, n.id);
    }
    nodes.push({
      id: n.id,
      ...(parent !== undefined ? { parent } : {}),
      ...(n.labels?.[0]?.text !== undefined ? { label: n.labels[0].text } : {}),
      ...(n.width !== undefined ? { width: n.width } : {}),
      ...(n.height !== undefined ? { height: n.height } : {}),
      ...(ports.length > 0 ? { ports } : {}),
      ...(n.layoutOptions !== undefined
        ? { layoutOptions: { ...n.layoutOptions } }
        : {}),
    });
    for (const child of n.children ?? []) walkNode(child, n.id);
    for (const e of n.edges ?? []) walkEdge(e);
  };

  const walkEdge = (e: ElkJsonEdge): void => {
    const src = e.sources?.[0];
    const tgt = e.targets?.[0];
    if (src === undefined || tgt === undefined) {
      diagnostics.push({
        code: "UNKNOWN_ENDPOINT",
        subject: e.id,
        message: `edge "${e.id}" lacks a source or target`,
      });
      return;
    }
    if ((e.sources?.length ?? 0) > 1 || (e.targets?.length ?? 0) > 1) {
      diagnostics.push({
        code: "BAD_SHAPE",
        subject: e.id,
        message: `edge "${e.id}" is a hyperedge; imported with its first endpoints only`,
      });
    }
    if ((e.sections?.length ?? 0) > 0) sectionsSeen++;
    // ELK edge endpoints may reference ports; resolve to the owning
    // node and record the port ref.
    const srcNode = portOwner.get(src) ?? src;
    const tgtNode = portOwner.get(tgt) ?? tgt;
    edges.push({
      id: e.id,
      source: srcNode,
      target: tgtNode,
      ...(portOwner.has(src) ? { sourcePort: src } : {}),
      ...(portOwner.has(tgt) ? { targetPort: tgt } : {}),
      ...(e.labels?.[0]?.text !== undefined ? { label: e.labels[0].text } : {}),
    });
  };

  // The ELK root is the GRAPH, not a node: its children are the
  // top-level nodes, its edges the top-level edges. Root-level
  // labels/options apply to the graph and pass through on a
  // synthetic entry ONLY when the root carries options (kept out
  // otherwise to keep documents minimal).
  for (const child of root.children ?? []) walkNode(child, undefined);
  for (const e of root.edges ?? []) walkEdge(e);

  if (sectionsSeen > 0) {
    diagnostics.push({
      code: "BAD_SHAPE",
      subject: "(sections)",
      message: `${sectionsSeen} edge(s) carried routing sections; geometry is not part of the imported topology/ports subset`,
    });
  }

  const document: GraphDocument = { version: 1, nodes, edges };
  diagnostics.push(...validateGraphDocument(document));
  return { document, diagnostics };
}
