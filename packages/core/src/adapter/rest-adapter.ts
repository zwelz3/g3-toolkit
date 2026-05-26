/**
 * RestAdapter: generic REST/GraphQL adapter with response mapping (M10.5.E2.T1).
 *
 * Covers the most common enterprise integration: a backend API that
 * returns graph data as JSON. The adopter provides a `mapResponse`
 * function that transforms their API response into UGM nodes/edges.
 *
 * Framework-agnostic (D6).
 */

import { UGM } from "../ugm";
import type { GraphAdapter, SchemaModel } from "../adapter";
import {
  composeMiddleware,
  defaultFetch,
  type Middleware,
  type AdapterRequest,
} from "../middleware/middleware";

// ── Types ───────────────────────────────────────────────────────────

export interface RestNodeMapping {
  id: string;
  types: string[];
  properties: Record<string, unknown>;
}

export interface RestEdgeMapping {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface RestResponseMapping {
  nodes: RestNodeMapping[];
  edges: RestEdgeMapping[];
}

export interface RestAdapterConfig {
  /** Base URL for the API endpoint. */
  url: string;
  /** HTTP method (default: POST). */
  method?: "GET" | "POST";
  /** Static headers (auth headers should use middleware). */
  headers?: Record<string, string>;
  /** Transform the JSON response into node/edge arrays. */
  mapResponse: (json: unknown) => RestResponseMapping;
  /** Middleware chain (auth, retry, logging). */
  middleware?: Middleware[];
}

// ── Adapter ─────────────────────────────────────────────────────────

// @see R6.4: API integration
export class RestAdapter implements GraphAdapter {
  readonly id = "rest";
  readonly name: string;
  private readonly config: RestAdapterConfig;
  private readonly fetcher: (req: AdapterRequest) => Promise<{
    status: number;
    body: string;
    ok: boolean;
    headers: Record<string, string>;
  }>;

  constructor(config: RestAdapterConfig) {
    this.config = config;
    this.name = `REST (${config.url})`;
    this.fetcher = config.middleware
      ? composeMiddleware(config.middleware, defaultFetch)
      : defaultFetch;
  }

  async query(queryString: string): Promise<UGM> {
    const request: AdapterRequest = {
      url: this.config.url,
      method: this.config.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
      body: JSON.stringify({ query: queryString }),
    };

    const response = await this.fetcher(request);

    if (!response.ok) {
      throw new Error(
        `REST adapter: ${response.status} from ${this.config.url}`,
      );
    }

    const json = JSON.parse(response.body);
    const mapped = this.config.mapResponse(json);
    return this.buildUGM(mapped);
  }

  async expandNeighborhood(nodeId: string, _hops?: number): Promise<UGM> {
    // Default: re-query with the node ID as a filter
    return this.query(nodeId);
  }

  async getSchema(): Promise<SchemaModel> {
    // Not all REST APIs support schema introspection
    return {
      nodeTypes: [],
      edgeTypes: [],
      nodeProperties: {},
      edgeProperties: {},
    };
  }

  async getNodeProperties(nodeId: string): Promise<Record<string, unknown>> {
    const ugm = await this.query(nodeId);
    return ugm.getNode(nodeId)?.properties ?? {};
  }

  private buildUGM(mapped: RestResponseMapping): UGM {
    const ugm = new UGM();

    for (const node of mapped.nodes) {
      ugm.addNode(node.id, {
        types: node.types,
        properties: node.properties,
      });
    }

    for (const edge of mapped.edges) {
      if (ugm.hasNode(edge.source) && ugm.hasNode(edge.target)) {
        ugm.addEdge(edge.source, edge.target, {
          type: edge.type,
          properties: edge.properties,
        });
      }
    }

    return ugm;
  }
}
