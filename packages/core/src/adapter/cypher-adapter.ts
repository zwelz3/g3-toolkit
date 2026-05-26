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
  defaultFetch,
  type Middleware,
  type AdapterRequest,
} from "../middleware/middleware";

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
    options?: { middleware?: Middleware[] },
  ) {
    this.endpointUrl = endpointUrl;
    this.auth = auth;
    if (options?.middleware) {
      this.fetchImpl = composeMiddleware(options.middleware, defaultFetch);
    } else if (fetchFn) {
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
    const result = await this.executeCypher(q);
    return this.resultToUGM(result);
  }

  async expandNeighborhood(
    nodeId: string,
    depth: number,
    edgeTypes?: string[],
  ): Promise<UGM> {
    const typeFilter = edgeTypes ? `:${edgeTypes.join("|")}` : "";
    const cypher = `
      MATCH path = (n)-[r${typeFilter}*1..${depth}]-(m)
      WHERE n.id = $nodeId OR id(n) = toInteger($nodeId)
      RETURN path
    `;
    return this.query(cypher);
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
      MATCH (n) WHERE n.id = "${nodeId}" OR id(n) = toInteger("${nodeId}")
      RETURN properties(n) AS props
    `;
    const result = await this.executeCypher(cypher);
    const row = result.results[0]?.data[0]?.row[0];
    if (row && typeof row === "object") {
      return row as PropertyMap;
    }
    return {};
  }

  private async executeCypher(cypher: string): Promise<Neo4jResult> {
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
            resultDataContents: ["row", "graph"],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Cypher query failed: ${response.status}`);
    }

    const data = JSON.parse(response.body) as Neo4jResult;
    if (data.errors.length > 0) {
      throw new Error(`Cypher error: ${data.errors[0]?.message}`);
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
