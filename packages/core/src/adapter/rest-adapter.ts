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
  createDefaultFetch,
  type Middleware,
  type AdapterRequest,
} from "../middleware/middleware";
import { assertOk } from "./adapter-error";
import { AdapterArgumentError, coerceDepth } from "./query-safety";

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
  /**
   * Request timeout in milliseconds. Defaults to
   * `DEFAULT_TIMEOUT_MS` (30 s); pass 0 to disable it.
   */
  timeoutMs?: number;
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
    const base = createDefaultFetch({ timeoutMs: config.timeoutMs });
    this.fetcher = config.middleware
      ? composeMiddleware(config.middleware, base)
      : base;
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

    assertOk("REST", this.config.url, response);

    const json = JSON.parse(response.body);
    const mapped = this.config.mapResponse(json);
    return this.buildUGM(mapped);
  }

  /**
   * Re-query the configured endpoint with the node id as the filter.
   * DEPTH IS REJECTED ABOVE 1 rather than ignored.
   *
   * How many hops a REST response covers is decided by the endpoint
   * and by the adopter's `mapResponse`, neither of which this adapter
   * can see or parameterize. There is no traversal contract to bind a
   * hop count to, so a supplied depth cannot be honored, and returning
   * whatever the endpoint happens to send while accepting `depth: 3`
   * misreports the result. An adopter whose API does take a depth
   * should encode it in `url` or `mapResponse` and call with 1.
   *
   * @throws AdapterArgumentError when `depth` resolves above 1.
   */
  async expandNeighborhood(nodeId: string, depth = 1): Promise<UGM> {
    if (coerceDepth(depth) > 1) {
      throw new AdapterArgumentError(
        "depth",
        `RestAdapter has no traversal contract and cannot honor depth ${depth}; ` +
          `encode the hop count in the configured url or mapResponse and pass 1`,
      );
    }
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
