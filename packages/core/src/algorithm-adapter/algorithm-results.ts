/**
 * Algorithm result interchange + structural overlays.
 *
 * The toolkit consumes results, not computation: heavy algorithms
 * run wherever they run best (networkx, GraphBLAS, igraph, a
 * service, a worker), and their outputs arrive here through one
 * versioned JSON document. Two result modes, matching the two ways
 * results shape a graph:
 *
 * 1. PROPERTY-shaped (centrality scores, community ids, anomaly
 *    scores, embeddings): ingested as node/edge properties in the
 *    UGM, where the encoding grammar can drive ANY channel from
 *    them (color by community, size by pagerank): the whole
 *    spec/panel/legend machinery applies for free.
 * 2. STRUCTURE-shaped (paths, spanning trees, ego nets, k-cores,
 *    components-as-subgraphs): named overlays of node/edge id sets,
 *    rendered as emphasized members over de-emphasized non-members
 *    WITHOUT mutating the UGM, independently toggleable, fully
 *    restoring on deactivation.
 *
 * A networkx export is a few lines (see
 * roadmap/design/algorithm-overlays.md for the worked examples):
 *
 *   json.dumps({"version": 1, "kind": "nodeProperties",
 *               "algorithm": "networkx.pagerank",
 *               "properties": {n: {"pagerank": s}
 *                              for n, s in nx.pagerank(G).items()}})
 */

import type { UGM } from "../ugm";
import type { AlgorithmIngestReport } from "./algorithm-adapter";
import {
  MalformedDocumentError,
  parseJsonObject,
  requireVersion,
} from "../model/document-errors";

// ── Interchange contract (version 1) ─────────────────────────────────

export interface AlgorithmResultDocument {
  version: 1;
  /** Provenance label, e.g. "networkx.pagerank", "graphblas.bfs". */
  algorithm?: string;
  kind: "nodeProperties" | "edgeProperties" | "overlay";
  /** For property kinds: elementId -> properties to merge. */
  properties?: Record<string, Record<string, unknown>>;
  /** For overlay kind: the structural result. */
  overlay?: {
    id: string;
    label?: string;
    nodeIds?: string[];
    edgeIds?: string[];
  };
}

const KINDS = new Set(["nodeProperties", "edgeProperties", "overlay"]);

const KIND = "algorithm-result" as const;

/**
 * Parse an algorithm-result document.
 *
 * Throws rather than degrading: a result document is a single object
 * with no partial reading worth having. See `model/document-errors.ts`
 * for the rule and for the error hierarchy every failure here uses.
 */
export function parseAlgorithmResult(json: string): AlgorithmResultDocument {
  const raw = parseJsonObject(KIND, json);
  requireVersion(KIND, raw);
  const kind = raw["kind"];
  if (typeof kind !== "string" || !KINDS.has(kind)) {
    throw new MalformedDocumentError({
      documentKind: KIND,
      message: `unknown result kind ${JSON.stringify(kind)}; expected nodeProperties, edgeProperties, or overlay`,
      path: "/kind",
    });
  }
  if (kind === "overlay") {
    const overlay = raw["overlay"] as Record<string, unknown> | undefined;
    if (!overlay || typeof overlay["id"] !== "string") {
      throw new MalformedDocumentError({
        documentKind: KIND,
        code: "MISSING_FIELD",
        message: "overlay results require overlay.id",
        path: "/overlay/id",
      });
    }
  } else if (
    typeof raw["properties"] !== "object" ||
    raw["properties"] === null
  ) {
    throw new MalformedDocumentError({
      documentKind: KIND,
      code: "MISSING_FIELD",
      message: `${kind} results require a properties object`,
      path: "/properties",
    });
  }
  return raw as unknown as AlgorithmResultDocument;
}

// ── Structural overlays (the structure-shaped half) ──────────────────

export interface StructuralOverlay {
  id: string;
  label: string;
  nodeIds: string[];
  edgeIds: string[];
  algorithm?: string;
}

export function overlayFromDocument(
  doc: AlgorithmResultDocument,
): StructuralOverlay {
  if (doc.kind !== "overlay" || !doc.overlay) {
    throw new MalformedDocumentError({
      documentKind: KIND,
      message: "not an overlay-kind result document",
      path: "/kind",
    });
  }
  return {
    id: doc.overlay.id,
    label: doc.overlay.label ?? doc.overlay.id,
    nodeIds: doc.overlay.nodeIds ?? [],
    edgeIds: doc.overlay.edgeIds ?? [],
    algorithm: doc.algorithm,
  };
}

export function overlayFromPath(
  id: string,
  label: string,
  path: { nodeIds: string[]; edgeIds: string[] },
): StructuralOverlay {
  return { id, label, nodeIds: [...path.nodeIds], edgeIds: [...path.edgeIds] };
}

// ── Property ingestion (edges join nodes) ────────────────────────────

/** Edge twin of ingestAlgorithmResults: merges per-edge properties
 *  (edge betweenness, flow, predicted-link scores). Reports the same
 *  matched-versus-supplied counts, for the same reason: an id
 *  convention mismatch is invisible from the call alone. */
export function ingestEdgeAlgorithmResults(
  ugm: UGM,
  results: Map<string, Record<string, unknown>>,
): AlgorithmIngestReport {
  const known = new Set<string>();
  ugm.forEachEdge((edgeId) => {
    known.add(edgeId);
  });
  let matched = 0;
  for (const [edgeId, properties] of results) {
    if (known.has(edgeId)) {
      ugm.updateEdgeProperties(edgeId, properties);
      matched++;
    }
  }
  return {
    supplied: results.size,
    matched,
    unmatched: results.size - matched,
  };
}

/** Apply a parsed document to a UGM (property kinds) or convert it
 *  (overlay kind belongs to the overlay registry, not the UGM:
 *  structure-shaped results never mutate the graph). Returns the
 *  overlay when the document is structural, undefined otherwise.
 *
 *  The return type is the overlay, so the ingest report reaches the
 *  caller through the optional `onIngest` callback instead. It fires
 *  once for a property-shaped document and not at all for an overlay
 *  one. A host that ignores it is where the gap was: this
 *  is the documented door for the result-document channel, and a
 *  document whose ids match nothing looked identical to one that
 *  matched everything.
 *
 *  `ingestNodeResults` is declared as returning `void` so any
 *  existing implementation stays assignable; the report is read from
 *  the return value when there is one. */
export function applyAlgorithmResult(
  ugm: UGM,
  doc: AlgorithmResultDocument,
  ingestNodeResults: (
    ugm: UGM,
    results: Map<string, Record<string, unknown>>,
  ) => void,
  onIngest?: (report: AlgorithmIngestReport) => void,
): StructuralOverlay | undefined {
  if (doc.kind === "overlay") return overlayFromDocument(doc);
  const entries = new Map(Object.entries(doc.properties ?? {}));
  // The callback is DECLARED `=> void` so that any existing
  // implementation stays assignable, which means TypeScript types the
  // call as `void` even when the function returns a report. The cast
  // reads what is actually there; the `if (report)` below is what
  // makes it safe when there is nothing.
  const report =
    doc.kind === "nodeProperties"
      ? (ingestNodeResults(ugm, entries) as unknown as
          | AlgorithmIngestReport
          | undefined)
      : ingestEdgeAlgorithmResults(ugm, entries);
  // A caller-supplied ingest that returns nothing yields no report,
  // and onIngest stays silent. Synthesizing one from `entries.size`
  // would report a full match for a call whose outcome is unknown,
  // which is the failure this parameter exists to end.
  if (onIngest && report) onIngest(report);
  return undefined;
}

// ── Reference built-ins ──────────────────────────────────────────────
// Deliberately trivial implementations so the controls have something
// to run WITHOUT a backend; real workloads belong in networkx,
// GraphBLAS, igraph, or a service, arriving through the contract
// above.

/** Connected components (undirected sense): nodeId -> component
 *  index, property-shaped (drive color from it via the spec). */
export function connectedComponents(ugm: UGM): Map<string, number> {
  const component = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  ugm.forEachNode((id) => {
    adjacency.set(id, []);
  });
  ugm.forEachEdge((_e, _attrs, source, target) => {
    adjacency.get(source)?.push(target);
    adjacency.get(target)?.push(source);
  });
  let next = 0;
  ugm.forEachNode((id) => {
    if (component.has(id)) return;
    const queue = [id];
    component.set(id, next);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!component.has(neighbor)) {
          component.set(neighbor, next);
          queue.push(neighbor);
        }
      }
    }
    next += 1;
  });
  return component;
}

/** Degree centrality: nodeId -> degree, property-shaped. */
export function degreeCentrality(ugm: UGM): Map<string, number> {
  const degree = new Map<string, number>();
  ugm.forEachNode((id) => {
    degree.set(id, 0);
  });
  ugm.forEachEdge((_e, _attrs, source, target) => {
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  });
  return degree;
}
