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

import { UGM } from "../ugm";
import type { GraphAdapter, SchemaModel } from "./types";
import type { PropertyMap } from "../ugm";
import { coerceDepth } from "./query-safety";
import { assertOk } from "./adapter-error";
import {
  composeMiddleware,
  createDefaultFetch,
  type Middleware,
  type AdapterRequest,
  type AdapterResponse,
} from "../middleware/middleware";

// ── Gremlin Response Types ──────────────────────────────────────────

/**
 * An element id as a Gremlin Server may serialize it. Plain strings
 * and numbers are the untyped GraphSON shape (Cosmos, Neptune); a
 * GraphSON 2/3 typed value is `{ "@type": "g:Int64", "@value": 5 }`;
 * JanusGraph wraps its relation ids as `{ "relationId": "4rv-39s-9hx" }`.
 */
type GremlinId = string | number | Record<string, unknown>;

interface GremlinVertex {
  id: GremlinId;
  label: string;
  properties?: Record<string, Array<{ id?: GremlinId; value: unknown }>>;
}

interface GremlinEdge {
  id: GremlinId;
  label: string;
  inV: GremlinId;
  outV: GremlinId;
  inVLabel?: string;
  outVLabel?: string;
  properties?: Record<string, unknown>;
}

/**
 * Stable string form of a Gremlin element id.
 *
 * `String(id)` was the previous rule, and for an object id it yields
 * "[object Object]" for every element, which collapses a whole typed
 * GraphSON result into one node. The typed wrapper is serialization,
 * not identity, so it is unwrapped; a JanusGraph relation id is the
 * string it carries; any other object id (a Cosmos composite, a custom
 * id type) becomes JSON with its keys sorted, so the order a server
 * happens to emit the keys in cannot change the id between loads. The
 * same function names vertices, edges and edge endpoints, which keeps
 * an edge's `outV` in the same id space as the vertex it refers to.
 */
function gremlinIdToString(id: unknown): string {
  if (typeof id === "string") return id;
  if (id === null || id === undefined) return "";
  if (typeof id !== "object") return String(id);
  const obj = id as Record<string, unknown>;
  if ("@value" in obj) return gremlinIdToString(obj["@value"]);
  if (typeof obj.relationId === "string") return obj.relationId;
  return canonicalJson(obj);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const entries = Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
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
  /**
   * Request timeout in milliseconds. Defaults to
   * `DEFAULT_TIMEOUT_MS` (30 s); pass 0 to disable it.
   */
  timeoutMs?: number;
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
    const base = createDefaultFetch({ timeoutMs: config.timeoutMs });
    this.fetcher = config.middleware
      ? composeMiddleware(config.middleware, base)
      : base;
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
    // Every caller-supplied value goes through `bindings`; the script
    // text below is a constant apart from the generated binding names.
    const bindings: Record<string, unknown> = {
      nodeId,
      depth: coerceDepth(depth),
    };

    let typeFilter = "";
    if (edgeTypes && edgeTypes.length > 0) {
      const names = edgeTypes.map((t, i) => {
        const key = `edgeType${i}`;
        bindings[key] = t;
        return key;
      });
      typeFilter = `.hasLabel(${names.join(",")})`;
    }

    const gremlin =
      `g.V(nodeId)` +
      `.repeat(bothE()${typeFilter}.otherV().simplePath())` +
      `.times(depth).path().by(elementMap())`;

    const response = await this.executeGremlin(gremlin, bindings);
    return this.responseToUGM(response);
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
    const result = await this.executeGremlin("g.V(nodeId).elementMap()", {
      nodeId,
    });
    const data = result.result.data;
    if (Array.isArray(data) && data.length > 0) {
      return this.flattenVertexProperties(data[0] as Record<string, unknown>);
    }
    return {};
  }

  // ── Internals ───────────────────────────────────────────────────

  /**
   * POST a Gremlin script with its bindings.
   *
   * `language` stays `gremlin-groovy` because this is the HTTP
   * endpoint, which evaluates scripts; bytecode submission is a
   * different protocol and a different client. That makes the
   * bindings map the security boundary rather than a convenience:
   * callers must not interpolate untrusted values into `gremlin`.
   */
  private async executeGremlin(
    gremlin: string,
    bindings: Record<string, unknown> = {},
  ): Promise<GremlinResponse> {
    const body: Record<string, unknown> = {
      gremlin,
      bindings,
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

    assertOk("Gremlin", this.config.endpoint, response);

    return JSON.parse(response.body) as GremlinResponse;
  }

  private responseToUGM(response: GremlinResponse): UGM {
    const ugm = new UGM();
    const data = response.result.data;

    if (!Array.isArray(data)) return ugm;

    const addedNodes = new Set<string>();

    for (const item of data) {
      if (this.isVertex(item)) {
        const id = gremlinIdToString(item.id);
        if (!addedNodes.has(id)) {
          ugm.addNode(id, {
            types: [item.label],
            properties: this.extractVertexProperties(item),
          });
          addedNodes.add(id);
        }
      } else if (this.isEdge(item)) {
        // The edge id is the edge key (issue #48), so a host that
        // reloads through this adapter sees the same edge ids per
        // load. A path or repeat traversal returns the same edge once
        // per path that crosses it; first occurrence wins and later
        // ones are skipped, the same treatment a repeated vertex gets.
        const key = gremlinIdToString(item.id);
        if (ugm.hasEdge(key)) continue;
        const src = gremlinIdToString(item.outV);
        const tgt = gremlinIdToString(item.inV);
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
          key,
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
    const props: PropertyMap = { name: gremlinIdToString(vertex.id) };
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
    const id = gremlinIdToString(map.id);
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
