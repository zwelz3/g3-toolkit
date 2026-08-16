/**
 * Cypher adapter (M3.E2.T2).
 *
 * Connects to a Neo4j-compatible endpoint via the HTTP transaction
 * API. Parses graph results into UGM.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/03-technical-data-layer.md R3.4(b)
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
import { assertPlainIdentifier, coerceDepth } from "./query-safety";
import { assertOk } from "./adapter-error";

/** Neo4j HTTP API response format. */
interface Neo4jResult {
  results: Array<{
    columns: string[];
    data: Array<{
      row: unknown[];
      graph?: {
        nodes: Array<{
          id: string;
          labels: string[];
          properties: Record<string, unknown>;
        }>;
        relationships: Array<{
          id: string;
          type: string;
          startNode: string;
          endNode: string;
          properties: Record<string, unknown>;
        }>;
      };
    }>;
  }>;
  errors: Array<{ code: string; message: string }>;
}

export class CypherAdapter implements GraphAdapter {
  readonly name = "Cypher (Neo4j)";
  readonly id = "cypher";
  private readonly endpointUrl: string;
  private readonly auth?: { username: string; password: string };
  private readonly fetchImpl: (req: AdapterRequest) => Promise<{
    status: number;
    body: string;
    ok: boolean;
    headers: Record<string, string>;
  }>;

  constructor(
    endpointUrl: string,
    fetchFn?: typeof fetch,
    auth?: { username: string; password: string },
    options?: { middleware?: Middleware[]; timeoutMs?: number },
  ) {
    this.endpointUrl = endpointUrl;
    this.auth = auth;
    const base = createDefaultFetch({ timeoutMs: options?.timeoutMs });
    if (options?.middleware) {
      this.fetchImpl = composeMiddleware(options.middleware, base);
    } else if (fetchFn) {
      // `timeoutMs` does NOT apply on this path: the caller supplied
      // the transport, so the timeout is theirs. The signal is
      // forwarded so cancellation still works if their fetch honors it.
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
    const result = await this.executeCypher(q);
    return this.resultToUGM(result);
  }

  async expandNeighborhood(
    nodeId: string,
    depth: number,
    edgeTypes?: string[],
  ): Promise<UGM> {
    // Relationship types and the depth bound are Cypher SYNTAX, not
    // terms, so neither can be parameterized. Both are validated
    // before interpolation; only `nodeId` is bound.
    const typeFilter =
      edgeTypes && edgeTypes.length > 0
        ? `:${edgeTypes.map((t) => assertPlainIdentifier(t, "edgeTypes")).join("|")}`
        : "";
    const cypher = `
      MATCH path = (n)-[r${typeFilter}*1..${coerceDepth(depth)}]-(m)
      WHERE n.id = $nodeId OR id(n) = toInteger($nodeId)
      RETURN path
    `;
    const result = await this.executeCypher(cypher, { nodeId });
    return this.resultToUGM(result);
  }

  async getSchema(): Promise<SchemaModel> {
    const cypher = "CALL db.labels() YIELD label RETURN label";
    const result = await this.executeCypher(cypher);

    const nodeTypes: string[] = [];
    for (const res of result.results) {
      for (const d of res.data) {
        if (d.row[0] && typeof d.row[0] === "string") {
          nodeTypes.push(d.row[0]);
        }
      }
    }

    return {
      nodeTypes,
      edgeTypes: [],
      nodeProperties: {},
      edgeProperties: {},
    };
  }

  async getNodeProperties(nodeId: string): Promise<PropertyMap> {
    const cypher = `
      MATCH (n) WHERE n.id = $nodeId OR id(n) = toInteger($nodeId)
      RETURN properties(n) AS props
    `;
    const result = await this.executeCypher(cypher, { nodeId });
    const row = result.results[0]?.data[0]?.row[0];
    if (row && typeof row === "object") {
      return row as PropertyMap;
    }
    return {};
  }

  /**
   * POST one statement to the transaction endpoint.
   *
   * `parameters` is sent whenever the statement declares any, which is
   * what makes the `$nodeId` placeholders real: without it Neo4j
   * answers `Expected parameter(s): nodeId` and the query never runs.
   */
  private async executeCypher(
    cypher: string,
    parameters?: Record<string, unknown>,
  ): Promise<Neo4jResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.auth) {
      const creds = btoa(`${this.auth.username}:${this.auth.password}`);
      headers.Authorization = `Basic ${creds}`;
    }

    const response = await this.fetchImpl({
      url: this.endpointUrl,
      method: "POST",
      headers,
      body: JSON.stringify({
        statements: [
          {
            statement: cypher,
            ...(parameters ? { parameters } : {}),
            resultDataContents: ["row", "graph"],
          },
        ],
      }),
    });

    assertOk("Cypher", this.endpointUrl, response);

    const data = JSON.parse(response.body) as Neo4jResult;
    if (data.errors.length > 0) {
      // Neo4j answers a rejected statement with HTTP 200 and an errors
      // array, so this is not an `assertOk` case. Report every error
      // with its code: the code is the machine-readable half
      // (`Neo.ClientError.Statement.SyntaxError` distinguishes a bad
      // query from `Neo.ClientError.Security.Unauthorized`), and only
      // the first message was surfaced before.
      const detail = data.errors
        .map((e) => `${e.code}: ${e.message}`)
        .join("; ");
      throw new Error(`Cypher error: ${detail}`);
    }

    return data;
  }

  private resultToUGM(result: Neo4jResult): UGM {
    const ugm = new UGM();
    const addedNodes = new Set<string>();

    for (const res of result.results) {
      for (const d of res.data) {
        if (!d.graph) continue;

        for (const node of d.graph.nodes) {
          if (!addedNodes.has(node.id)) {
            ugm.addNode(node.id, {
              types: node.labels,
              properties: node.properties,
            });
            addedNodes.add(node.id);
          }
        }

        for (const rel of d.graph.relationships) {
          if (addedNodes.has(rel.startNode) && addedNodes.has(rel.endNode)) {
            ugm.addEdge(rel.startNode, rel.endNode, {
              type: rel.type,
              properties: rel.properties,
            });
          }
        }
      }
    }

    return ugm;
  }
}
