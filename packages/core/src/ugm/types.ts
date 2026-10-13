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
  /**
   * A stable edge id supplied by the host (issue #31). Omitted, the
   * graph generates one, and a host that rebuilds its UGM from its
   * own data gets a different id for the same edge on every rebuild,
   * which breaks anything keyed by edge id (selection, overlays, a
   * selected edge in the URL) across rebuilds. The key must be
   * unique across ALL edges of the graph, not just between one pair
   * of nodes; `addEdge` throws on a duplicate.
   */
  key?: string;
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

/**
 * Provenance stamp for a DERIVED node property value (issue #17).
 *
 * Held in a sidecar registry on the UGM, keyed by node id and property
 * name, never on the node's attributes: a stamp inside `properties`
 * would itself be a property (a column, an export field, an encoding
 * driver), which is the laundering the stamp exists to stop. The stamp
 * names the definition that wrote the value; the value stays a plain
 * property so every existing reader keeps working.
 */
export interface DerivationStamp {
  /** The definition that produced the value (for
   *  `DerivedPropertyEngine`, the definition's `name`). */
  definitionId: string;
  /** The definition's version when the value was written. A stamp
   *  whose version is older than the definition's current version is
   *  STALE: the rule changed and the value has not been recomputed. */
  version?: number;
  /** ISO-8601 timestamp of the write. */
  computedAt: string;
  /** The expression text at write time, so a reader can see the rule
   *  even after the definition changed or went away. */
  expression?: string;
}

/** One registry entry: which node, which property, which stamp. */
export interface DerivationRecord {
  nodeId: string;
  property: string;
  stamp: DerivationStamp;
}

/**
 * Serialized UGM format for save/restore (T4).
 *
 * Version 2 (issue #17) adds the optional `derivations` sidecar. The
 * field was added under a version bump rather than silently because
 * this document is read back by `UGM.fromJSON`, and a reader must be
 * able to tell "no derivations" from "written by a build that did not
 * know about them". A document with no `version` is the form every
 * build before 2 wrote; `fromJSON` reads it as 1 and still loads it.
 */
export interface SerializedUGM {
  /** Absent on documents written before the field existed (read as
   *  1). `toJSON` writes 2. */
  version?: 1 | 2;
  nodes: Array<{ id: string; attributes: NodeAttributes }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    attributes: EdgeAttributes;
  }>;
  /** Derivation stamps (version 2). Omitted when the registry is
   *  empty, so a graph with no derived values serializes as before
   *  apart from `version`. */
  derivations?: DerivationRecord[];
}
