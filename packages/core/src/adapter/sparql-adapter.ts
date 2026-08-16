/**
 * SPARQL adapter (M3.E2.T1).
 *
 * Connects to a SPARQL endpoint via HTTP. Sends SELECT/CONSTRUCT
 * queries and parses results into UGM nodes and edges.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/03-technical-data-layer.md R3.4(a)
 */

import { UGM } from "../ugm";
import type { PropertyMap } from "../ugm";
import type { GraphAdapter, SchemaModel } from "./types";
import {
  composeMiddleware,
  createDefaultFetch,
  type Middleware,
  type AdapterRequest,
} from "../middleware/middleware";
import { assertSafeIri, coerceDepth } from "./query-safety";
import { assertOk } from "./adapter-error";

/**
 * A single RDF term as it appears in a SPARQL 1.2 JSON results binding.
 *
 * `uri | literal | bnode` are the classic RDF 1.1 shapes with a string
 * `value`. `triple` is an RDF 1.2 triple term (quoted triple): `value` is a
 * nested subject/predicate/object triple whose components are themselves
 * `RdfTerm`s (a triple may recursively contain further triples).
 */
export type RdfTerm =
  | { type: "uri"; value: string }
  | {
      type: "literal";
      value: string;
      datatype?: string;
      "xml:lang"?: string;
    }
  | { type: "bnode"; value: string }
  | { type: "triple"; value: TripleTerm };

/** RDF 1.2 triple term (quoted triple), nested SPARQL-JSON shape. */
export interface TripleTerm {
  subject: RdfTerm;
  predicate: RdfTerm;
  object: RdfTerm;
}

/** A single binding row from a SPARQL SELECT result. */
interface SparqlBinding {
  [variable: string]: RdfTerm;
}

/**
 * Convert a triple term to a plain, JSON-serializable value suitable for
 * storage as a UGM property. Nested triple terms recurse without loss —
 * subject/predicate/object are preserved with their `type` tag.
 */
export function tripleTermToValue(t: TripleTerm): {
  subject: unknown;
  predicate: unknown;
  object: unknown;
} {
  return {
    subject: termToValue(t.subject),
    predicate: termToValue(t.predicate),
    object: termToValue(t.object),
  };
}

function termToValue(term: RdfTerm): unknown {
  if (term.type === "triple") {
    return { type: "triple", value: tripleTermToValue(term.value) };
  }
  const out: Record<string, unknown> = { type: term.type, value: term.value };
  if (term.type === "literal") {
    if (term.datatype !== undefined) out.datatype = term.datatype;
    if (term["xml:lang"] !== undefined) out["xml:lang"] = term["xml:lang"];
  }
  return out;
}

/** SPARQL JSON result format. */
interface SparqlResult {
  results: {
    bindings: SparqlBinding[];
  };
}

export class SparqlAdapter implements GraphAdapter {
  readonly name = "SPARQL Endpoint";
  readonly id = "sparql";
  private readonly endpointUrl: string;
  private readonly fetchImpl: (req: AdapterRequest) => Promise<{
    status: number;
    body: string;
    ok: boolean;
    headers: Record<string, string>;
  }>;

  constructor(
    endpointUrl: string,
    fetchFn?: typeof fetch,
    options?: { middleware?: Middleware[]; timeoutMs?: number },
  ) {
    this.endpointUrl = endpointUrl;
    const base = createDefaultFetch({ timeoutMs: options?.timeoutMs });
    if (options?.middleware) {
      this.fetchImpl = composeMiddleware(options.middleware, base);
    } else if (fetchFn) {
      // Legacy: wrap the custom fetchFn in our AdapterRequest
      // interface. `timeoutMs` does NOT apply on this path: the caller
      // supplied the transport, so the timeout is theirs to impose.
      // The request's `signal` is forwarded so cancellation still
      // works if their fetch honors it.
      this.fetchImpl = async (req) => {
        const res = await fetchFn(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          signal: req.signal,
        });
        let body = "";
        if (typeof res.text === "function") {
          body = await res.text();
        } else if (typeof res.json === "function") {
          body = JSON.stringify(await res.json());
        }
        return {
          status: res.status,
          body,
          ok: res.ok,
          headers: {},
        };
      };
    } else {
      this.fetchImpl = base;
    }
  }

  async query(q: string): Promise<UGM> {
    const result = await this.executeSparql(q);
    return this.bindingsToUGM(result.results.bindings);
  }

  async expandNeighborhood(
    nodeId: string,
    depth: number,
    edgeTypes?: string[],
  ): Promise<UGM> {
    // SPARQL has no binding mechanism for a query sent as
    // application/sparql-query, and these positions are syntax in any
    // case: an IRI inside angle brackets and a property-path
    // quantifier. Both are validated instead.
    const safeId = assertSafeIri(nodeId, "nodeId");
    const typeFilter =
      edgeTypes && edgeTypes.length > 0
        ? `FILTER(?p IN (${edgeTypes
            .map((t) => `<${assertSafeIri(t, "edgeTypes")}>`)
            .join(", ")}))`
        : "";

    // Build a property path for N-hop traversal
    const safeDepth = coerceDepth(depth);
    const pathExpr = safeDepth === 1 ? "?p" : `?p{1,${safeDepth}}`;
    const sparql = `
      SELECT ?s ?p ?o WHERE {
        <${safeId}> (${pathExpr}) ?neighbor .
        ?s ?p ?o .
        FILTER(?s = <${safeId}> || ?s = ?neighbor)
        FILTER(?o = <${safeId}> || ?o = ?neighbor)
        ${typeFilter}
      }
    `;

    return this.query(sparql);
  }

  async getSchema(): Promise<SchemaModel> {
    const sparql = `
      SELECT DISTINCT ?type WHERE {
        ?s a ?type .
      } LIMIT 1000
    `;
    const result = await this.executeSparql(sparql);
    const nodeTypes = result.results.bindings.map((b) => {
      const v = b.type?.value;
      return typeof v === "string" ? v : "";
    });

    return {
      nodeTypes,
      edgeTypes: [],
      nodeProperties: {},
      edgeProperties: {},
    };
  }

  async getNodeProperties(nodeId: string): Promise<PropertyMap> {
    const sparql = `
      SELECT ?p ?o WHERE {
        <${assertSafeIri(nodeId, "nodeId")}> ?p ?o .
      }
    `;
    const result = await this.executeSparql(sparql);
    const props: PropertyMap = {};
    for (const binding of result.results.bindings) {
      const pTerm = binding.p;
      const oTerm = binding.o;
      if (!pTerm || pTerm.type === "triple") continue;
      const key = pTerm.value;
      const localName = key.split(/[#/]/).pop() ?? key;
      if (oTerm?.type === "triple") {
        props[localName] = tripleTermToValue(oTerm.value);
      } else {
        props[localName] = oTerm?.value ?? "";
      }
    }
    return props;
  }

  private async executeSparql(sparql: string): Promise<SparqlResult> {
    const response = await this.fetchImpl({
      url: this.endpointUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        Accept: "application/sparql-results+json",
      },
      body: sparql,
    });

    assertOk("SPARQL", this.endpointUrl, response);

    return JSON.parse(response.body) as SparqlResult;
  }

  private bindingsToUGM(bindings: SparqlBinding[]): UGM {
    const ugm = new UGM();
    const addedNodes = new Set<string>();

    for (const binding of bindings) {
      const sTerm = binding.s;
      const pTerm = binding.p;
      const oTerm = binding.o;
      if (!sTerm || !pTerm || !oTerm) continue;
      // Subject and predicate must be atomic (uri/bnode); a triple-typed
      // subject would need its own reification handling — out of scope here.
      if (sTerm.type === "triple" || pTerm.type === "triple") continue;
      const s = sTerm.value;
      const p = pTerm.value;
      if (!s || !p) continue;

      // Add subject as node if not already added
      if (!addedNodes.has(s)) {
        ugm.addNode(s, { types: ["Resource"], properties: {} });
        addedNodes.add(s);
      }

      const predLocal = p.split(/[#/]/).pop() ?? p;

      if (oTerm.type === "uri") {
        const o = oTerm.value;
        if (!o) continue;
        if (!addedNodes.has(o)) {
          ugm.addNode(o, { types: ["Resource"], properties: {} });
          addedNodes.add(o);
        }
        ugm.addEdge(s, o, { type: predLocal });
      } else if (oTerm.type === "triple") {
        // RDF 1.2 triple term (PROV-O fold on rdf:type, quoted triples in
        // general). Preserve subject/predicate/object structure recursively
        // rather than flattening to "[object Object]".
        ugm.updateNodeProperties(s, {
          [predLocal]: tripleTermToValue(oTerm.value),
        });
      } else {
        // Literal or bnode: add as property on subject
        const o = oTerm.value;
        if (!o) continue;
        ugm.updateNodeProperties(s, { [predLocal]: o });
      }
    }

    return ugm;
  }
}
