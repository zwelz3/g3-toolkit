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

import { UGM } from "@core/ugm";
import type { PropertyMap } from "@core/ugm";
import type { GraphAdapter, SchemaModel } from "./types";
import {
  composeMiddleware,
  defaultFetch,
  type Middleware,
  type AdapterRequest,
} from "@core/middleware/middleware";

/** A single binding row from a SPARQL SELECT result. */
interface SparqlBinding {
  [variable: string]: {
    type: "uri" | "literal" | "bnode";
    value: string;
    datatype?: string;
    "xml:lang"?: string;
  };
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
    options?: { middleware?: Middleware[] },
  ) {
    this.endpointUrl = endpointUrl;
    if (options?.middleware) {
      this.fetchImpl = composeMiddleware(options.middleware, defaultFetch);
    } else if (fetchFn) {
      // Legacy: wrap the custom fetchFn in our AdapterRequest interface
      this.fetchImpl = async (req) => {
        const res = await fetchFn(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
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
      this.fetchImpl = defaultFetch;
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
    const typeFilter = edgeTypes
      ? `FILTER(?p IN (${edgeTypes.map((t) => `<${t}>`).join(", ")}))`
      : "";

    // Build a property path for N-hop traversal
    const pathExpr = depth === 1 ? "?p" : `?p{1,${depth}}`;
    const sparql = `
      SELECT ?s ?p ?o WHERE {
        <${nodeId}> (${pathExpr}) ?neighbor .
        ?s ?p ?o .
        FILTER(?s = <${nodeId}> || ?s = ?neighbor)
        FILTER(?o = <${nodeId}> || ?o = ?neighbor)
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
    const nodeTypes = result.results.bindings.map((b) => b.type?.value ?? "");

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
        <${nodeId}> ?p ?o .
      }
    `;
    const result = await this.executeSparql(sparql);
    const props: PropertyMap = {};
    for (const binding of result.results.bindings) {
      const key = binding.p?.value ?? "";
      const val = binding.o?.value ?? "";
      // Use the local name as the property key
      const localName = key.split(/[#/]/).pop() ?? key;
      props[localName] = val;
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

    if (!response.ok) {
      throw new Error(`SPARQL query failed: ${response.status}`);
    }

    return JSON.parse(response.body) as SparqlResult;
  }

  private bindingsToUGM(bindings: SparqlBinding[]): UGM {
    const ugm = new UGM();
    const addedNodes = new Set<string>();

    for (const binding of bindings) {
      const s = binding.s?.value;
      const p = binding.p?.value;
      const o = binding.o?.value;
      if (!s || !p || !o) continue;

      // Add subject as node if not already added
      if (!addedNodes.has(s)) {
        ugm.addNode(s, { types: ["Resource"], properties: {} });
        addedNodes.add(s);
      }

      // If object is a URI, add as node + edge
      if (binding.o?.type === "uri") {
        if (!addedNodes.has(o)) {
          ugm.addNode(o, { types: ["Resource"], properties: {} });
          addedNodes.add(o);
        }
        const predLocal = p.split(/[#/]/).pop() ?? p;
        ugm.addEdge(s, o, { type: predLocal });
      } else {
        // Literal: add as property on subject
        const predLocal = p.split(/[#/]/).pop() ?? p;
        ugm.updateNodeProperties(s, { [predLocal]: o });
      }
    }

    return ugm;
  }
}
