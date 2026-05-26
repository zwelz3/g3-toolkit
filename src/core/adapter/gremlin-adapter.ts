/**
 * Gremlin adapter (M10.5.E2.T3).
 *
 * Connects to Gremlin-compatible graph databases via their HTTP
 * endpoint. Covers Amazon Neptune, Azure Cosmos DB (Gremlin API),
 * and JanusGraph with Gremlin Server.
 *
 * Uses the standard Gremlin Server HTTP POST format:
 *   POST /gremlin
 *   { "gremlin": "g.V().limit(10)", "bindings": {} }
 *
 * Framework-agnostic (D6).
 */

import { UGM } from "@core/ugm";
import type { GraphAdapter, SchemaModel } from "./types";
import type { PropertyMap } from "@core/ugm";
import {
  composeMiddleware,
  defaultFetch,
  type Middleware,
  type AdapterRequest,
  type AdapterResponse,
} from "@core/middleware/middleware";

// ── Gremlin Response Types ──────────────────────────────────────────

interface GremlinVertex {
  id: string | number;
  label: string;
  properties?: Record<string, Array<{ id?: string | number; value: unknown }>>;
}

interface GremlinEdge {
  id: string | number;
  label: string;
  inV: string | number;
  outV: string | number;
  inVLabel?: string;
  outVLabel?: string;
  properties?: Record<string, unknown>;
}

interface GremlinResponse {
  result: {
    data: unknown;
  };
  status: {
    code: number;
    message: string;
  };
}

// ── Config ──────────────────────────────────────────────────────────

export interface GremlinAdapterConfig {
  /** Gremlin Server HTTP endpoint (e.g., "http://localhost:8182/gremlin"). */
  endpoint: string;
  /** Request middleware (auth, retry, logging). */
  middleware?: Middleware[];
  /** Optional: source graph name for Neptune/Cosmos. */
  source?: string;
}

// ── Adapter ─────────────────────────────────────────────────────────

export class GremlinAdapter implements GraphAdapter {
  readonly id = "gremlin";
  readonly name: string;
  private readonly config: GremlinAdapterConfig;
  private readonly fetcher: (req: AdapterRequest) => Promise<AdapterResponse>;

  constructor(config: GremlinAdapterConfig) {
    this.config = config;
    this.name = `Gremlin (${config.endpoint})`;
    this.fetcher = config.middleware
      ? composeMiddleware(config.middleware, defaultFetch)
      : defaultFetch;
  }

  async query(q: string): Promise<UGM> {
    const response = await this.executeGremlin(q);
    return this.responseToUGM(response);
  }

  async expandNeighborhood(
    nodeId: string,
    depth = 1,
    edgeTypes?: string[],
  ): Promise<UGM> {
    const typeFilter = edgeTypes
      ? `.hasLabel(${edgeTypes.map((t) => `'${t}'`).join(",")})`
      : "";

    const gremlin =
      `g.V('${nodeId}')` +
      `.repeat(bothE()${typeFilter}.otherV().simplePath())` +
      `.times(${depth}).path().by(elementMap())`;

    return this.query(gremlin);
  }

  async getSchema(): Promise<SchemaModel> {
    const labelResult = await this.executeGremlin("g.V().label().dedup()");
    const nodeTypes = Array.isArray(labelResult.result.data)
      ? (labelResult.result.data as string[])
      : [];

    const edgeLabelResult = await this.executeGremlin("g.E().label().dedup()");
    const edgeTypes = Array.isArray(edgeLabelResult.result.data)
      ? (edgeLabelResult.result.data as string[])
      : [];

    return {
      nodeTypes,
      edgeTypes,
      nodeProperties: {},
      edgeProperties: {},
    };
  }

  async getNodeProperties(nodeId: string): Promise<PropertyMap> {
    const result = await this.executeGremlin(`g.V('${nodeId}').elementMap()`);
    const data = result.result.data;
    if (Array.isArray(data) && data.length > 0) {
      return this.flattenVertexProperties(data[0] as Record<string, unknown>);
    }
    return {};
  }

  // ── Internals ───────────────────────────────────────────────────

  private async executeGremlin(gremlin: string): Promise<GremlinResponse> {
    const body: Record<string, unknown> = {
      gremlin,
      bindings: {},
      language: "gremlin-groovy",
    };
    if (this.config.source) {
      body.aliases = { g: this.config.source };
    }

    const response = await this.fetcher({
      url: this.config.endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Gremlin query failed: ${response.status} from ${this.config.endpoint}`,
      );
    }

    return JSON.parse(response.body) as GremlinResponse;
  }

  private responseToUGM(response: GremlinResponse): UGM {
    const ugm = new UGM();
    const data = response.result.data;

    if (!Array.isArray(data)) return ugm;

    const addedNodes = new Set<string>();

    for (const item of data) {
      if (this.isVertex(item)) {
        const id = String(item.id);
        if (!addedNodes.has(id)) {
          ugm.addNode(id, {
            types: [item.label],
            properties: this.extractVertexProperties(item),
          });
          addedNodes.add(id);
        }
      } else if (this.isEdge(item)) {
        const src = String(item.outV);
        const tgt = String(item.inV);
        // Ensure endpoints exist
        if (!addedNodes.has(src)) {
          ugm.addNode(src, {
            types: [item.outVLabel ?? "Vertex"],
            properties: {},
          });
          addedNodes.add(src);
        }
        if (!addedNodes.has(tgt)) {
          ugm.addNode(tgt, {
            types: [item.inVLabel ?? "Vertex"],
            properties: {},
          });
          addedNodes.add(tgt);
        }
        ugm.addEdge(src, tgt, {
          type: item.label,
          properties: (item.properties ?? {}) as Record<string, unknown>,
        });
      } else if (typeof item === "object" && item !== null) {
        // ElementMap or valueMap result
        this.handleElementMap(ugm, addedNodes, item as Record<string, unknown>);
      }
    }

    return ugm;
  }

  private isVertex(item: unknown): item is GremlinVertex {
    if (typeof item !== "object" || item === null) return false;
    const obj = item as Record<string, unknown>;
    // Vertex format has nested properties: { id, label, properties: { key: [{value}] } }
    // ElementMap format has flat properties: { id, label, name, age, ... }
    // Distinguish by checking if "properties" is an object with arrays
    return (
      "id" in obj &&
      "label" in obj &&
      !("inV" in obj) &&
      typeof obj.properties === "object" &&
      obj.properties !== null
    );
  }

  private isEdge(item: unknown): item is GremlinEdge {
    if (typeof item !== "object" || item === null) return false;
    const obj = item as Record<string, unknown>;
    return "inV" in obj && "outV" in obj && "label" in obj;
  }

  private extractVertexProperties(vertex: GremlinVertex): PropertyMap {
    const props: PropertyMap = { name: String(vertex.id) };
    if (!vertex.properties) return props;

    for (const [key, values] of Object.entries(vertex.properties)) {
      if (Array.isArray(values) && values.length > 0) {
        props[key] = values[0]?.value ?? "";
      }
    }
    return props;
  }

  private flattenVertexProperties(map: Record<string, unknown>): PropertyMap {
    const props: PropertyMap = {};
    for (const [key, value] of Object.entries(map)) {
      if (key !== "id" && key !== "label") {
        props[key] = value;
      }
    }
    return props;
  }

  private handleElementMap(
    ugm: UGM,
    addedNodes: Set<string>,
    map: Record<string, unknown>,
  ): void {
    const id = String(map.id ?? "");
    if (!id) return;

    if (!addedNodes.has(id)) {
      const label = String(map.label ?? "Vertex");
      const props: PropertyMap = {};
      for (const [key, value] of Object.entries(map)) {
        if (key !== "id" && key !== "label") {
          props[key] = value;
        }
      }
      ugm.addNode(id, { types: [label], properties: props });
      addedNodes.add(id);
    }
  }
}
