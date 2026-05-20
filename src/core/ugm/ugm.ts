/**
 * Unified Graph Model (UGM).
 *
 * Wraps Graphology's MultiGraph with typed node/edge operations,
 * a property-key registry, a typed event bus, and serialization.
 *
 * This module is framework-agnostic (D6): no React, no Cytoscape.
 *
 * @see specs/03-technical-data-layer.md R3.1, R3.2
 * @see specs/09-design-decisions.md D1 (Qualified Edge), D6 (module boundary)
 */

import { MultiGraph } from "graphology";
import type {
  NodeAttributes,
  EdgeAttributes,
  NodeInput,
  EdgeInput,
  QualifiedEdgeMeta,
  PropertyKeyRegistry,
  UGMEventType,
  NodeEventPayload,
  EdgeEventPayload,
  AttributeUpdatePayload,
  SerializedUGM,
} from "./types";

type EventHandler<T> = (payload: T) => void;

export class UGM {
  /** The underlying Graphology MultiGraph. */
  private readonly graph: MultiGraph<NodeAttributes, EdgeAttributes>;

  /** Mutable registry sets; exposed as readonly via getRegistry(). */
  private readonly _nodeTypes = new Set<string>();
  private readonly _edgeTypes = new Set<string>();
  private readonly _nodePropertyKeys = new Set<string>();
  private readonly _edgePropertyKeys = new Set<string>();

  /** Typed event listeners. */
  private readonly listeners = new Map<
    UGMEventType,
    Set<EventHandler<unknown>>
  >();

  constructor() {
    this.graph = new MultiGraph<NodeAttributes, EdgeAttributes>();
  }

  // ── Node operations (T1) ─────────────────────────────────────────

  /**
   * Add a node with typed attributes.
   * @returns the node ID
   */
  addNode(id: string, input: NodeInput): string {
    const attributes: NodeAttributes = {
      types: input.types,
      properties: input.properties ?? {},
    };

    this.graph.addNode(id, attributes);

    // Update registry
    for (const t of attributes.types) this._nodeTypes.add(t);
    for (const key of Object.keys(attributes.properties)) {
      this._nodePropertyKeys.add(key);
    }

    this.emit("nodeAdded", { nodeId: id, attributes });
    return id;
  }

  /** Retrieve node attributes by ID. Returns undefined if not found. */
  getNode(id: string): NodeAttributes | undefined {
    if (!this.graph.hasNode(id)) return undefined;
    return this.graph.getNodeAttributes(id);
  }

  /** Check whether a node exists. */
  hasNode(id: string): boolean {
    return this.graph.hasNode(id);
  }

  /** Remove a node and all its incident edges. */
  removeNode(id: string): void {
    const attributes = this.graph.getNodeAttributes(id);
    this.graph.dropNode(id);
    this.emit("nodeRemoved", { nodeId: id, attributes });
  }

  /** Update properties on an existing node. Merges with existing. */
  updateNodeProperties(id: string, properties: Record<string, unknown>): void {
    const attrs = this.graph.getNodeAttributes(id);
    const updatedKeys = Object.keys(properties);
    Object.assign(attrs.properties, properties);
    this.graph.setNodeAttribute(id, "properties", attrs.properties);

    for (const key of updatedKeys) this._nodePropertyKeys.add(key);

    this.emit("nodeAttributesUpdated", {
      elementId: id,
      elementType: "node" as const,
      updatedKeys,
    });
  }

  /** Number of nodes. */
  get nodeCount(): number {
    return this.graph.order;
  }

  /** Iterate all node IDs. */
  forEachNode(
    callback: (id: string, attributes: NodeAttributes) => void,
  ): void {
    this.graph.forEachNode((id, attrs) => callback(id, attrs));
  }

  /** Get all node IDs as an array. */
  getNodeIds(): string[] {
    return this.graph.nodes();
  }

  // ── Edge operations (T2) ─────────────────────────────────────────

  /**
   * Add an edge with Qualified Edge metadata (D1).
   * Auto-generates an edge key for multi-edge support.
   * @returns the generated edge ID
   */
  addEdge(source: string, target: string, input: EdgeInput): string {
    const meta: QualifiedEdgeMeta = {};
    if (input.confidence !== undefined) meta.confidence = input.confidence;
    if (input.provenance_iri !== undefined)
      meta.provenance_iri = input.provenance_iri;
    if (input.temporal_start !== undefined)
      meta.temporal_start = input.temporal_start;
    if (input.temporal_end !== undefined)
      meta.temporal_end = input.temporal_end;
    if (input.asserted !== undefined) meta.asserted = input.asserted;

    const attributes: EdgeAttributes = {
      type: input.type,
      properties: input.properties ?? {},
      meta,
    };

    const edgeId = this.graph.addEdge(source, target, attributes);

    // Update registry
    this._edgeTypes.add(attributes.type);
    for (const key of Object.keys(attributes.properties)) {
      this._edgePropertyKeys.add(key);
    }

    this.emit("edgeAdded", {
      edgeId,
      source,
      target,
      attributes,
    });

    return edgeId;
  }

  /** Retrieve edge attributes by edge ID. */
  getEdge(edgeId: string): EdgeAttributes | undefined {
    if (!this.graph.hasEdge(edgeId)) return undefined;
    return this.graph.getEdgeAttributes(edgeId);
  }

  /** Check whether an edge exists. */
  hasEdge(edgeId: string): boolean {
    return this.graph.hasEdge(edgeId);
  }

  /** Get the source and target of an edge. */
  getEdgeEndpoints(
    edgeId: string,
  ): { source: string; target: string } | undefined {
    if (!this.graph.hasEdge(edgeId)) return undefined;
    return {
      source: this.graph.source(edgeId),
      target: this.graph.target(edgeId),
    };
  }

  /** Remove an edge by ID. */
  removeEdge(edgeId: string): void {
    const attributes = this.graph.getEdgeAttributes(edgeId);
    const source = this.graph.source(edgeId);
    const target = this.graph.target(edgeId);
    this.graph.dropEdge(edgeId);
    this.emit("edgeRemoved", { edgeId, source, target, attributes });
  }

  /** Update properties on an existing edge. Merges with existing. */
  updateEdgeProperties(
    edgeId: string,
    properties: Record<string, unknown>,
  ): void {
    const attrs = this.graph.getEdgeAttributes(edgeId);
    const updatedKeys = Object.keys(properties);
    Object.assign(attrs.properties, properties);
    this.graph.setEdgeAttribute(edgeId, "properties", attrs.properties);

    for (const key of updatedKeys) this._edgePropertyKeys.add(key);

    this.emit("edgeAttributesUpdated", {
      elementId: edgeId,
      elementType: "edge" as const,
      updatedKeys,
    });
  }

  /** Update Qualified Edge metadata. Merges with existing. */
  updateEdgeMeta(edgeId: string, meta: Partial<QualifiedEdgeMeta>): void {
    const attrs = this.graph.getEdgeAttributes(edgeId);
    Object.assign(attrs.meta, meta);
    this.graph.setEdgeAttribute(edgeId, "meta", attrs.meta);

    this.emit("edgeAttributesUpdated", {
      elementId: edgeId,
      elementType: "edge" as const,
      updatedKeys: Object.keys(meta),
    });
  }

  /** Number of edges. */
  get edgeCount(): number {
    return this.graph.size;
  }

  /** Iterate all edges. */
  forEachEdge(
    callback: (
      edgeId: string,
      attributes: EdgeAttributes,
      source: string,
      target: string,
    ) => void,
  ): void {
    this.graph.forEachEdge((edgeId, attrs, source, target) =>
      callback(edgeId, attrs, source, target),
    );
  }

  /** Get edges between two specific nodes (multi-edge support). */
  getEdgesBetween(source: string, target: string): string[] {
    return this.graph.edges(source, target);
  }

  /** Get all edges incident to a node. */
  getNodeEdges(nodeId: string): string[] {
    return this.graph.edges(nodeId);
  }

  /** Get neighbor node IDs at depth 1. */
  getNeighbors(nodeId: string): string[] {
    return this.graph.neighbors(nodeId);
  }

  // ── Property-key registry (R3.1) ─────────────────────────────────

  /** Get the current property-key registry (readonly snapshot). */
  getRegistry(): PropertyKeyRegistry {
    return {
      nodeTypes: this._nodeTypes,
      edgeTypes: this._edgeTypes,
      nodePropertyKeys: this._nodePropertyKeys,
      edgePropertyKeys: this._edgePropertyKeys,
    };
  }

  // ── Event bus (T3) ───────────────────────────────────────────────

  /** Subscribe to a UGM event. Returns an unsubscribe function. */
  on<T extends UGMEventType>(
    event: T,
    handler: EventHandler<
      T extends "nodeAdded" | "nodeRemoved"
        ? NodeEventPayload
        : T extends "edgeAdded" | "edgeRemoved"
          ? EdgeEventPayload
          : T extends "nodeAttributesUpdated" | "edgeAttributesUpdated"
            ? AttributeUpdatePayload
            : null
    >,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    // Safe: we just ensured the key exists above
    const handlers = this.listeners.get(event) ?? new Set();
    handlers.add(handler as EventHandler<unknown>);

    return () => {
      handlers.delete(handler as EventHandler<unknown>);
    };
  }

  private emit(event: UGMEventType, payload: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(payload);
      }
    }
  }

  // ── Serialization (T4) ───────────────────────────────────────────

  /** Serialize to a JSON-compatible object. */
  toJSON(): SerializedUGM {
    const nodes: SerializedUGM["nodes"] = [];
    this.graph.forEachNode((id, attrs) => {
      nodes.push({ id, attributes: structuredClone(attrs) });
    });

    const edges: SerializedUGM["edges"] = [];
    this.graph.forEachEdge((edgeId, attrs, source, target) => {
      edges.push({
        id: edgeId,
        source,
        target,
        attributes: structuredClone(attrs),
      });
    });

    return { nodes, edges };
  }

  /** Deserialize from a JSON object produced by toJSON(). */
  static fromJSON(data: SerializedUGM): UGM {
    const ugm = new UGM();
    for (const node of data.nodes) {
      ugm.addNode(node.id, {
        types: node.attributes.types,
        properties: node.attributes.properties,
      });
    }
    for (const edge of data.edges) {
      ugm.addEdge(edge.source, edge.target, {
        type: edge.attributes.type,
        properties: edge.attributes.properties,
        ...edge.attributes.meta,
      });
    }
    return ugm;
  }

  // ── Utility ──────────────────────────────────────────────────────

  /** Remove all nodes and edges. */
  clear(): void {
    this.graph.clear();
    this.emit("cleared", null);
  }
}
