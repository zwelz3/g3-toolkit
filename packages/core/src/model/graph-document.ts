/**
 * Versioned graph document format (G3L:IOP-001, workstream E2).
 *
 * The library's interchange document: topology (WITH hierarchy),
 * ports, domain data, style refs, layout-option passthrough, and an
 * optional geometry snapshot. This is the LOSSLESS import target
 * (the ELK importer, IOP-002, lands here) and the shared-fixture
 * format; the structural pipeline consumes it through
 * `toStructuralInput`, a PROJECTION that is honest about loss
 * (arbitrary hierarchy flattens with per-node diagnostics, because
 * the structural model expresses containment as compartments, not
 * nesting).
 *
 * Round-trip guarantee (oracle-pinned): parseGraphDocument of
 * serializeGraphDocument is deep-equal for every valid document.
 * The JSON Schema is published as GRAPH_DOCUMENT_SCHEMA.
 */
import type { StructuralGeometry } from "../layout/structural";
import type {
  StructuralEdge,
  StructuralGraphInput,
  StructuralNode,
} from "../layout/structural";

export interface DocPort {
  id: string;
  /** Optional fixed side hint (ELK port side passthrough). */
  side?: "NORTH" | "SOUTH" | "EAST" | "WEST";
}

export interface DocNode {
  id: string;
  /** Containment: parent node id. Absent = root. */
  parent?: string;
  label?: string;
  width?: number;
  height?: number;
  ports?: readonly DocPort[];
  /** Domain data (opaque to the format). */
  data?: Readonly<Record<string, unknown>>;
  /** Layout-option passthrough (opaque; ELK option ids preserved). */
  layoutOptions?: Readonly<Record<string, string>>;
}

export interface DocEdge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  label?: string;
  /** UML relationship kind passthrough for structural consumers. */
  kind?: string;
  data?: Readonly<Record<string, unknown>>;
}

export interface GraphDocument {
  version: 1;
  nodes: readonly DocNode[];
  edges: readonly DocEdge[];
  /** Style refs: element id -> classes/states (style system input). */
  styleRefs?: Readonly<
    Record<string, { classes?: readonly string[]; states?: readonly string[] }>
  >;
  /** Optional geometry snapshot (the structural geometry document). */
  geometry?: StructuralGeometry;
}

export interface DocumentDiagnostic {
  code:
    | "BAD_VERSION"
    | "BAD_SHAPE"
    | "DUPLICATE_ID"
    | "UNKNOWN_PARENT"
    | "PARENT_CYCLE"
    | "UNKNOWN_ENDPOINT"
    | "UNKNOWN_PORT"
    | "HIERARCHY_FLATTENED";
  subject: string;
  message: string;
}

/** Published JSON Schema (draft 2020-12) for the document. */
export const GRAPH_DOCUMENT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://g3t.dev/schemas/graph-document.v1.json",
  type: "object",
  required: ["version", "nodes", "edges"],
  properties: {
    version: { const: 1 },
    nodes: {
      type: "array",
      items: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          parent: { type: "string" },
          label: { type: "string" },
          width: { type: "number" },
          height: { type: "number" },
          ports: {
            type: "array",
            items: {
              type: "object",
              required: ["id"],
              properties: {
                id: { type: "string" },
                side: { enum: ["NORTH", "SOUTH", "EAST", "WEST"] },
              },
            },
          },
          data: { type: "object" },
          layoutOptions: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "source", "target"],
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          target: { type: "string" },
          sourcePort: { type: "string" },
          targetPort: { type: "string" },
          label: { type: "string" },
          kind: { type: "string" },
          data: { type: "object" },
        },
      },
    },
    styleRefs: { type: "object" },
    geometry: { type: "object" },
  },
} as const;

/** Structural validation shared by parse and import paths. */
export function validateGraphDocument(
  doc: GraphDocument,
): DocumentDiagnostic[] {
  const out: DocumentDiagnostic[] = [];
  const nodeIds = new Set<string>();
  const portOwner = new Map<string, string>();
  for (const n of doc.nodes) {
    if (nodeIds.has(n.id)) {
      out.push({
        code: "DUPLICATE_ID",
        subject: n.id,
        message: `duplicate node id "${n.id}"`,
      });
    }
    nodeIds.add(n.id);
    for (const p of n.ports ?? []) {
      if (portOwner.has(p.id)) {
        out.push({
          code: "DUPLICATE_ID",
          subject: p.id,
          message: `duplicate port id "${p.id}"`,
        });
      }
      portOwner.set(p.id, n.id);
    }
  }
  const byId = new Map(doc.nodes.map((n) => [n.id, n] as const));
  for (const n of doc.nodes) {
    if (n.parent !== undefined && !nodeIds.has(n.parent)) {
      out.push({
        code: "UNKNOWN_PARENT",
        subject: n.id,
        message: `node "${n.id}" parent "${n.parent}" does not exist`,
      });
    }
  }
  // Parent-cycle detection.
  for (const n of doc.nodes) {
    const seen = new Set<string>();
    let cur: DocNode | undefined = n;
    while (cur?.parent !== undefined) {
      if (seen.has(cur.id)) {
        out.push({
          code: "PARENT_CYCLE",
          subject: n.id,
          message: `parent chain of "${n.id}" cycles`,
        });
        break;
      }
      seen.add(cur.id);
      cur = byId.get(cur.parent);
    }
  }
  const edgeIds = new Set<string>();
  for (const e of doc.edges) {
    if (edgeIds.has(e.id)) {
      out.push({
        code: "DUPLICATE_ID",
        subject: e.id,
        message: `duplicate edge id "${e.id}"`,
      });
    }
    edgeIds.add(e.id);
    for (const end of [e.source, e.target]) {
      if (!nodeIds.has(end)) {
        out.push({
          code: "UNKNOWN_ENDPOINT",
          subject: e.id,
          message: `edge "${e.id}" endpoint "${end}" does not exist`,
        });
      }
    }
    for (const [port, expectNode] of [
      [e.sourcePort, e.source],
      [e.targetPort, e.target],
    ] as const) {
      if (port !== undefined && portOwner.get(port) !== expectNode) {
        out.push({
          code: "UNKNOWN_PORT",
          subject: e.id,
          message: `edge "${e.id}" port "${port}" is not a port of "${expectNode}"`,
        });
      }
    }
  }
  return out;
}

export function serializeGraphDocument(doc: GraphDocument): string {
  return JSON.stringify(doc);
}

export function parseGraphDocument(
  text: string,
):
  | { document: GraphDocument; diagnostics: DocumentDiagnostic[] }
  | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { error: `invalid JSON: ${String(e)}` };
  }
  if (typeof raw !== "object" || raw === null) {
    return { error: "not an object" };
  }
  const doc = raw as Partial<GraphDocument>;
  if (doc.version !== 1) {
    return { error: "not a version-1 graph document" };
  }
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    return { error: "nodes/edges arrays missing" };
  }
  const document = doc as GraphDocument;
  return { document, diagnostics: validateGraphDocument(document) };
}

/**
 * Project a document onto the structural pipeline's input. LOSSY and
 * says so: nested hierarchy flattens to root level with a
 * HIERARCHY_FLATTENED diagnostic per nested node (the structural
 * model's containment is compartments, not node nesting); style
 * refs and geometry snapshots are not part of the structural input
 * and are simply not carried.
 */
export function toStructuralInput(doc: GraphDocument): {
  input: StructuralGraphInput;
  diagnostics: DocumentDiagnostic[];
} {
  const diagnostics: DocumentDiagnostic[] = [];
  const nodes: StructuralNode[] = [];
  for (const n of doc.nodes) {
    if (n.parent !== undefined) {
      diagnostics.push({
        code: "HIERARCHY_FLATTENED",
        subject: n.id,
        message: `node "${n.id}" was nested under "${n.parent}"; the structural projection flattens hierarchy`,
      });
    }
    nodes.push({
      id: n.id,
      header: { name: n.label ?? n.id },
      ...(n.width !== undefined && n.height !== undefined
        ? { width: n.width, height: n.height }
        : {}),
      ...(n.ports && n.ports.length > 0
        ? {
            ports: n.ports.map((p) => ({
              id: p.id,
              ...(p.side !== undefined ? { side: p.side } : {}),
            })),
          }
        : {}),
    });
  }
  const edges: StructuralEdge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourcePort !== undefined ? { sourcePort: e.sourcePort } : {}),
    ...(e.targetPort !== undefined ? { targetPort: e.targetPort } : {}),
    ...(e.label !== undefined ? { label: e.label } : {}),
    ...(e.kind !== undefined ? { kind: e.kind as StructuralEdge["kind"] } : {}),
  }));
  return { input: { nodes, edges }, diagnostics };
}
