/**
 * Type definitions for the Unified Graph Model (UGM).
 *
 * These types define the contract between the data layer and all
 * consumers (views, adapters, plugins). They MUST NOT import React
 * or any view library (D6).
 *
 * @see specs/03-technical-data-layer.md R3.1, R3.2
 */

/** Properties stored on a node, keyed by property name. */
export type PropertyMap = Record<string, unknown>;

/** Attributes stored on a UGM node. */
export interface NodeAttributes {
  /** One or more type labels (e.g., ["Person", "Customer"]). */
  types: string[];
  /** Arbitrary key-value properties. */
  properties: PropertyMap;
}

/**
 * Qualified Edge metadata (R3.2, D1).
 *
 * Unifies RDF named-graph/RDF* provenance and LPG edge-properties
 * into a single metadata bag. All fields are optional; adapters
 * populate what the source provides.
 */
export interface QualifiedEdgeMeta {
  /** Confidence score, 0..1. */
  confidence?: number;
  /** IRI of the provenance source. */
  provenance_iri?: string;
  /** Temporal validity start. */
  temporal_start?: string;
  /** Temporal validity end. */
  temporal_end?: string;
  /** Whether this edge is asserted (true) or inferred (false). */
  asserted?: boolean;
}

/** Attributes stored on a UGM edge. */
export interface EdgeAttributes {
  /** Edge type label (e.g., "knows", "worksFor"). */
  type: string;
  /** Arbitrary key-value properties. */
  properties: PropertyMap;
  /** Qualified Edge metadata (provenance, confidence, temporal). */
  meta: QualifiedEdgeMeta;
}

/** Input for adding a node (id provided separately). */
export interface NodeInput {
  types: string[];
  properties?: PropertyMap;
}

/** Input for adding an edge. */
export interface EdgeInput {
  type: string;
  properties?: PropertyMap;
  confidence?: number;
  provenance_iri?: string;
  temporal_start?: string;
  temporal_end?: string;
  asserted?: boolean;
}

/**
 * Property-key registry (R3.1).
 *
 * Tracks all observed node types, edge types, and property keys
 * across the graph. Used by faceted filters (R2.7), schema discovery
 * (R3.3), and visual encoding auto-mapping.
 */
export interface PropertyKeyRegistry {
  /** All observed node type labels. */
  nodeTypes: ReadonlySet<string>;
  /** All observed edge type labels. */
  edgeTypes: ReadonlySet<string>;
  /** All observed property keys on nodes. */
  nodePropertyKeys: ReadonlySet<string>;
  /** All observed property keys on edges. */
  edgePropertyKeys: ReadonlySet<string>;
}

/** UGM event types for the typed event bus (T3). */
export type UGMEventType =
  | "nodeAdded"
  | "nodeRemoved"
  | "edgeAdded"
  | "edgeRemoved"
  | "nodeAttributesUpdated"
  | "edgeAttributesUpdated"
  | "cleared";

/** Payload for node events. */
export interface NodeEventPayload {
  nodeId: string;
  attributes: NodeAttributes;
}

/** Payload for edge events. */
export interface EdgeEventPayload {
  edgeId: string;
  source: string;
  target: string;
  attributes: EdgeAttributes;
}

/** Payload for attribute-update events. */
export interface AttributeUpdatePayload {
  elementId: string;
  elementType: "node" | "edge";
  updatedKeys: string[];
}

/** Discriminated union of all UGM event payloads. */
export type UGMEventPayload =
  | { type: "nodeAdded"; payload: NodeEventPayload }
  | { type: "nodeRemoved"; payload: NodeEventPayload }
  | { type: "edgeAdded"; payload: EdgeEventPayload }
  | { type: "edgeRemoved"; payload: EdgeEventPayload }
  | { type: "nodeAttributesUpdated"; payload: AttributeUpdatePayload }
  | { type: "edgeAttributesUpdated"; payload: AttributeUpdatePayload }
  | { type: "cleared"; payload: null };

/** Serialized UGM format for save/restore (T4). */
export interface SerializedUGM {
  nodes: Array<{ id: string; attributes: NodeAttributes }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    attributes: EdgeAttributes;
  }>;
}
