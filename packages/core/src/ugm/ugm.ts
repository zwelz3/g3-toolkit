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
import {
  MalformedDocumentError,
  UnsupportedVersionError,
} from "../model/document-errors";
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
  DerivationStamp,
  DerivationRecord,
} from "./types";

type EventHandler<T> = (payload: T) => void;

/** Snapshot versions `fromJSON` reads; an absent `version` is 1. */
const SNAPSHOT_VERSIONS: readonly number[] = [1, 2];

export class UGM {
  /** The underlying Graphology MultiGraph. */
  private readonly graph: MultiGraph<NodeAttributes, EdgeAttributes>;

  /** Mutable registry sets; exposed as readonly via getRegistry(). */
  private readonly _nodeTypes = new Set<string>();
  private readonly _edgeTypes = new Set<string>();
  private readonly _nodePropertyKeys = new Set<string>();
  private readonly _edgePropertyKeys = new Set<string>();

  /**
   * Derivation registry (issue #17): node id -> property -> stamp. A
   * sidecar, not node attributes, so a stamp never becomes a property
   * (see `DerivationStamp`). Kept in step with the graph by the
   * mutators below: a removed node drops its stamps, `clear` drops
   * them all, and a plain write to a stamped property clears that one
   * stamp, because after a non-derived write the value is no longer
   * derived.
   */
  private readonly _derivations = new Map<
    string,
    Map<string, DerivationStamp>
  >();

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
    this._derivations.delete(id);
    this.emit("nodeRemoved", { nodeId: id, attributes });
  }

  /**
   * Update properties on an existing node. Merges with existing.
   *
   * This is a SOURCE write as far as the derivation registry is
   * concerned: every key written here loses its stamp, since whatever
   * value is there afterwards was not produced by the stamped
   * definition. `DerivedPropertyEngine` writes through this method too
   * and re-stamps immediately after, which is the only ordering that
   * keeps the registry honest without a second, privileged write path.
   */
  updateNodeProperties(id: string, properties: Record<string, unknown>): void {
    const attrs = this.graph.getNodeAttributes(id);
    const updatedKeys = Object.keys(properties);
    Object.assign(attrs.properties, properties);
    this.graph.setNodeAttribute(id, "properties", attrs.properties);

    for (const key of updatedKeys) this._nodePropertyKeys.add(key);
    const stamps = this._derivations.get(id);
    if (stamps) {
      for (const key of updatedKeys) stamps.delete(key);
      if (stamps.size === 0) this._derivations.delete(id);
    }

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
   * Uses `input.key` as the edge ID when given (a stable id the host
   * owns, which snapshots and exports then carry unchanged); otherwise
   * auto-generates one for multi-edge support. Graphology's generator
   * skips ids already present, so a restored keyed id can never
   * collide with a later generated one.
   * @returns the edge ID
   * @throws when `input.key` names an edge that already exists
   */
  addEdge(source: string, target: string, input: EdgeInput): string {
    if (input.key !== undefined && this.graph.hasEdge(input.key)) {
      throw new Error(
        `UGM.addEdge: edge key "${input.key}" already exists in the graph`,
      );
    }
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

    const edgeId =
      input.key !== undefined
        ? this.graph.addEdgeWithKey(input.key, source, target, attributes)
        : this.graph.addEdge(source, target, attributes);

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

  // ── Derivation registry (issue #17) ──────────────────────────────

  /**
   * Record that `property` on `nodeId` currently holds a DERIVED value
   * written by `stamp.definitionId`. Replaces any earlier stamp for the
   * pair. The value itself is written through `updateNodeProperties`
   * first (which clears the old stamp), then stamped.
   * @throws when the node does not exist
   */
  setDerivation(
    nodeId: string,
    property: string,
    stamp: DerivationStamp,
  ): void {
    if (!this.graph.hasNode(nodeId)) {
      throw new Error(
        `UGM.setDerivation: node "${nodeId}" does not exist in the graph`,
      );
    }
    let stamps = this._derivations.get(nodeId);
    if (!stamps) {
      stamps = new Map();
      this._derivations.set(nodeId, stamps);
    }
    stamps.set(property, { ...stamp });
  }

  /** The stamp for a derived property, or undefined when the value is
   *  a source value (never derived, or overwritten since). */
  getDerivation(nodeId: string, property: string): DerivationStamp | undefined {
    return this._derivations.get(nodeId)?.get(property);
  }

  /** Every stamp, or the stamps of one node. Insertion order. */
  listDerivations(nodeId?: string): DerivationRecord[] {
    const out: DerivationRecord[] = [];
    const push = (id: string, stamps: Map<string, DerivationStamp>) => {
      for (const [property, stamp] of stamps) {
        out.push({ nodeId: id, property, stamp: { ...stamp } });
      }
    };
    if (nodeId !== undefined) {
      const stamps = this._derivations.get(nodeId);
      if (stamps) push(nodeId, stamps);
    } else {
      for (const [id, stamps] of this._derivations) push(id, stamps);
    }
    return out;
  }

  /** Drop the stamp for one property. The value stays; it is now a
   *  source value as far as every reader is concerned. */
  clearDerivation(nodeId: string, property: string): void {
    const stamps = this._derivations.get(nodeId);
    if (!stamps) return;
    stamps.delete(property);
    if (stamps.size === 0) this._derivations.delete(nodeId);
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

    const derivations = this.listDerivations();
    return derivations.length > 0
      ? { version: 2, nodes, edges, derivations }
      : { version: 2, nodes, edges };
  }

  /**
   * Deserialize from a JSON object produced by toJSON(). Edge ids are
   * restored as keys, so a snapshot round-trip keeps every edge id
   * (host-supplied or generated); before issue #31 the restore
   * regenerated them, and an undo step silently renamed every edge.
   *
   * Reads versions 1 (no `version` field, or `version: 1`) and 2
   * (`derivations`); any other version throws `UnsupportedVersionError`
   * and a stamp naming a node the document does not contain throws
   * `MalformedDocumentError`, the throwing convention of
   * `model/document-errors.ts` (a snapshot has no useful partial
   * reading).
   */
  static fromJSON(data: SerializedUGM): UGM {
    const version: unknown = data.version;
    if (
      version !== undefined &&
      !SNAPSHOT_VERSIONS.includes(version as number)
    ) {
      throw new UnsupportedVersionError("ugm", version, SNAPSHOT_VERSIONS);
    }
    const ugm = new UGM();
    for (const node of data.nodes) {
      ugm.addNode(node.id, {
        types: node.attributes.types,
        properties: node.attributes.properties,
      });
    }
    for (const edge of data.edges) {
      ugm.addEdge(edge.source, edge.target, {
        key: edge.id,
        type: edge.attributes.type,
        properties: edge.attributes.properties,
        ...edge.attributes.meta,
      });
    }
    (data.derivations ?? []).forEach((record, i) => {
      if (!ugm.hasNode(record.nodeId)) {
        throw new MalformedDocumentError({
          documentKind: "ugm",
          message: `derivation ${i} names node "${record.nodeId}", which the document does not contain`,
          path: `/derivations/${i}/nodeId`,
        });
      }
      ugm.setDerivation(record.nodeId, record.property, record.stamp);
    });
    return ugm;
  }

  // ── Utility ──────────────────────────────────────────────────────

  /** Remove all nodes, edges and derivation stamps. */
  clear(): void {
    this.graph.clear();
    this._derivations.clear();
    this.emit("cleared", null);
  }
}
