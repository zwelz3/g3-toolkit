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
 *
 * Failure contract: `parseGraphDocument` returns `{ error }` or
 * `{ document, diagnostics }` and NEVER throws. It used to guard only
 * the top-level shape and then cast, so a null array member reached
 * library internals as a raw TypeError while a numeric id passed as
 * valid and corrupted the layout stages downstream. Element shapes are
 * now checked against the published schema before the cast;
 * unusable elements are DROPPED with a BAD_SHAPE diagnostic naming
 * their array index, the same degrade-and-report convention
 * `elk-import.ts` uses.
 */
import type { StructuralGeometry } from "../layout/structural";
import {
  InvalidJsonError,
  MalformedDocumentError,
  UnsupportedVersionError,
  type DocumentParseError,
} from "./document-errors";
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

/**
 * An element-level problem that did NOT stop the parse.
 *
 * `BAD_SHAPE` is the shared code from `./document-errors.ts`; the rest
 * are graph-specific and have no counterpart in the common vocabulary.
 * `BAD_VERSION` predates that vocabulary, where the same condition is
 * called `UNSUPPORTED_VERSION`; it keeps its name because renaming a
 * published diagnostic code would break any host matching on it, and
 * the two never appear in the same place.
 */
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

// ── Element-shape checking ──────────────────────────────────────────
//
// The hand-written counterpart of GRAPH_DOCUMENT_SCHEMA. The schema is
// the PUBLISHED contract; these predicates are what actually runs, and
// `graph-document.test.ts` pins the two together so the schema cannot
// drift into decoration. Validating the schema directly would mean
// shipping a JSON Schema engine inside core, which the architecture
// doctrine (heavy machinery stays external) and the bundle budget both
// argue against.

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/** Type of an optional field, or `undefined` if absent. Missing is OK. */
function optionalTypeError(
  value: unknown,
  expected: "string" | "number" | "object" | "array",
): string | undefined {
  if (value === undefined) return undefined;
  switch (expected) {
    case "array":
      return Array.isArray(value) ? undefined : "must be an array";
    case "object":
      return isObject(value) ? undefined : "must be an object";
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? undefined
        : "must be a finite number";
    case "string":
      return typeof value === "string" ? undefined : "must be a string";
  }
}

const PORT_SIDES = new Set(["NORTH", "SOUTH", "EAST", "WEST"]);

/**
 * Check one array element against the schema's item shape.
 *
 * Returns the accepted element, or `undefined` to DROP it. Dropping
 * rather than failing the whole parse matches `elk-import.ts`: the
 * document channel degrades with diagnostics instead of refusing, and
 * the caller sees exactly which index was unusable. A document with no
 * salvageable elements still parses, to a document with empty arrays
 * and one diagnostic per casualty.
 */
function checkNode(
  raw: unknown,
  index: number,
  out: DocumentDiagnostic[],
): DocNode | undefined {
  const subject = `nodes[${index}]`;
  if (!isObject(raw)) {
    out.push({
      code: "BAD_SHAPE",
      subject,
      message: `${subject} is not an object; dropped`,
    });
    return undefined;
  }
  if (!isNonEmptyString(raw.id)) {
    out.push({
      code: "BAD_SHAPE",
      subject,
      message: `${subject} has no usable "id" (must be a non-empty string); dropped`,
    });
    return undefined;
  }
  const fields: Array<[string, "string" | "number" | "object" | "array"]> = [
    ["parent", "string"],
    ["label", "string"],
    ["width", "number"],
    ["height", "number"],
    ["ports", "array"],
    ["data", "object"],
    ["layoutOptions", "object"],
  ];
  for (const [key, expected] of fields) {
    const err = optionalTypeError(raw[key], expected);
    if (err) {
      out.push({
        code: "BAD_SHAPE",
        subject: `${subject}.${key}`,
        message: `node "${raw.id}" field "${key}" ${err}; dropped`,
      });
      return undefined;
    }
  }
  if (Array.isArray(raw.ports)) {
    for (const [i, p] of raw.ports.entries()) {
      if (!isObject(p) || !isNonEmptyString(p.id)) {
        out.push({
          code: "BAD_SHAPE",
          subject: `${subject}.ports[${i}]`,
          message: `node "${raw.id}" port ${i} has no usable "id"; node dropped`,
        });
        return undefined;
      }
      if (p.side !== undefined && !PORT_SIDES.has(p.side as string)) {
        out.push({
          code: "BAD_SHAPE",
          subject: `${subject}.ports[${i}]`,
          message: `node "${raw.id}" port "${String(p.id)}" has side "${String(p.side)}", not one of NORTH/SOUTH/EAST/WEST; node dropped`,
        });
        return undefined;
      }
    }
  }
  return raw as unknown as DocNode;
}

function checkEdge(
  raw: unknown,
  index: number,
  out: DocumentDiagnostic[],
): DocEdge | undefined {
  const subject = `edges[${index}]`;
  if (!isObject(raw)) {
    out.push({
      code: "BAD_SHAPE",
      subject,
      message: `${subject} is not an object; dropped`,
    });
    return undefined;
  }
  for (const key of ["id", "source", "target"] as const) {
    if (!isNonEmptyString(raw[key])) {
      out.push({
        code: "BAD_SHAPE",
        subject,
        message: `${subject} has no usable "${key}" (must be a non-empty string); dropped`,
      });
      return undefined;
    }
  }
  const fields: Array<[string, "string" | "object"]> = [
    ["sourcePort", "string"],
    ["targetPort", "string"],
    ["label", "string"],
    ["kind", "string"],
    ["data", "object"],
  ];
  for (const [key, expected] of fields) {
    const err = optionalTypeError(raw[key], expected);
    if (err) {
      out.push({
        code: "BAD_SHAPE",
        subject: `${subject}.${key}`,
        message: `edge "${String(raw.id)}" field "${key}" ${err}; dropped`,
      });
      return undefined;
    }
  }
  return raw as unknown as DocEdge;
}

/**
 * Parse a graph document.
 *
 * RETURNS its failure rather than throwing, which is the deliberate
 * half of the versioned-JSON convention documented in
 * `./document-errors.ts`: a graph document describes independent
 * elements, so one malformed edge must not cost the caller the other
 * nine hundred. Element-level problems become diagnostics and the good
 * elements come back; only a document that cannot be read at all
 * produces the `error` branch.
 *
 * The `error` branch carries `detail`, the same typed error the
 * throwing parsers raise, so a host can branch on `code` and
 * `documentKind` uniformly across the whole channel without
 * string-matching a message.
 */
export function parseGraphDocument(
  text: string,
):
  | { document: GraphDocument; diagnostics: DocumentDiagnostic[] }
  | { error: string; detail: DocumentParseError } {
  const fail = (detail: DocumentParseError) => ({
    error: detail.message,
    detail,
  });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return fail(new InvalidJsonError("graph", cause));
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail(
      new MalformedDocumentError({
        documentKind: "graph",
        code: "NOT_OBJECT",
        message: `root is ${Array.isArray(raw) ? "an array" : String(raw)}, expected an object`,
      }),
    );
  }
  const doc = raw as Partial<GraphDocument>;
  if (doc.version !== 1) {
    return fail(new UnsupportedVersionError("graph", doc.version));
  }
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    return fail(
      new MalformedDocumentError({
        documentKind: "graph",
        code: "MISSING_FIELD",
        message: "nodes and edges must both be arrays",
        path: !Array.isArray(doc.nodes) ? "/nodes" : "/edges",
      }),
    );
  }
  const rawNodes: unknown[] = doc.nodes;
  const rawEdges: unknown[] = doc.edges;

  // Everything past the top-level guards runs inside the declared
  // failure union. The contract says a caller who checks `"error" in
  // result` has handled failure, so a throw out of here would be a
  // contract violation, not merely a bug.
  try {
    const diagnostics: DocumentDiagnostic[] = [];
    const nodes: DocNode[] = [];
    for (const [i, n] of rawNodes.entries()) {
      const checked = checkNode(n, i, diagnostics);
      if (checked) nodes.push(checked);
    }
    const edges: DocEdge[] = [];
    for (const [i, e] of rawEdges.entries()) {
      const checked = checkEdge(e, i, diagnostics);
      if (checked) edges.push(checked);
    }

    // Rebuild only when something was dropped, so the round-trip
    // guarantee stays literal for valid documents: the returned
    // object is the parsed one, carrying any fields a future version
    // adds.
    const document: GraphDocument =
      nodes.length === rawNodes.length && edges.length === rawEdges.length
        ? (doc as GraphDocument)
        : { ...(doc as GraphDocument), nodes, edges };

    diagnostics.push(...validateGraphDocument(document));
    return { document, diagnostics };
  } catch (cause) {
    // The last-resort net. Everything past the top-level guards runs
    // inside the declared failure union, so a throw escaping here would
    // be a contract violation rather than merely a bug; it is reported
    // through the same typed error as every other failure, with the
    // original as `cause`.
    return fail(
      new MalformedDocumentError({
        documentKind: "graph",
        message: `could not validate document: ${String(cause)}`,
      }),
    );
  }
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
