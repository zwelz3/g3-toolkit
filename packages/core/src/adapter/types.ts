/**
 * GraphAdapter interface (M3.E1.T1).
 *
 * Defines the contract for connecting to external graph data sources.
 * Each adapter translates a source-specific protocol (SPARQL, Cypher,
 * Holonic) into UGM operations.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/03-technical-data-layer.md R3.3, R3.4
 */

// R3.6: StreamAdapter interface (planned, not yet implemented).
// R6.2: Multi-source federation (planned).
// R6.3: Document linkage extension (planned).
// R6.4: API integration via RestAdapter.

import type { UGM, PropertyMap } from "../ugm";

/**
 * Schema model describing the types, properties, and relationships
 * available in the data source.
 */
export interface SchemaModel {
  /** Node type labels available (e.g., ["Person", "Organization"]). */
  nodeTypes: string[];
  /** Edge type labels available (e.g., ["knows", "worksFor"]). */
  edgeTypes: string[];
  /** Property keys per node type. */
  nodeProperties: Record<string, string[]>;
  /** Property keys per edge type. */
  edgeProperties: Record<string, string[]>;
}

/**
 * Interface that all data source adapters implement.
 *
 * ARGUMENT SAFETY. `nodeId`, `depth` and `edgeTypes` typically come
 * from host state (a node click, a search result, a server payload),
 * so the remote adapters treat them as untrusted: values are bound
 * through the protocol's own mechanism where one exists, and
 * validated by `./query-safety` where it does not. A value that
 * cannot be placed safely raises `AdapterArgumentError` before any
 * request is sent. `query(q)` is the exception and is NOT sanitized:
 * its argument is query text by definition, so hosts must not build
 * it from untrusted input.
 */
export interface GraphAdapter {
  /** Human-readable name (e.g., "SPARQL Endpoint"). */
  readonly name: string;
  /** Short identifier (e.g., "sparql", "cypher", "holonic"). */
  readonly id: string;

  /**
   * Execute a query and return results as a new UGM.
   * The query language depends on the adapter (SPARQL, Cypher, etc.).
   */
  query(q: string): Promise<UGM>;

  /**
   * Expand the neighborhood of a node at the given depth.
   * Returns a UGM containing the discovered subgraph.
   *
   * DEPTH IS HONORED OR REJECTED, never ignored. An implementation
   * that cannot express the requested hop count throws
   * `AdapterArgumentError` with `argument: "depth"` before issuing a
   * request, so a host learns at the call site instead of receiving a
   * shallower subgraph that looks complete. Of the shipped adapters,
   * `SparqlAdapter`, `CypherAdapter` and `GremlinAdapter` honor any
   * depth in [1, MAX_TRAVERSAL_DEPTH]; `HolonicAdapter` and
   * `RestAdapter` honor 1 and reject the rest, each for a reason
   * recorded on the method.
   *
   * @param edgeTypes Optional filter to specific edge types.
   * @throws AdapterArgumentError when `depth` is not a finite number,
   *   or when the implementation cannot honor the value.
   */
  expandNeighborhood(
    nodeId: string,
    depth: number,
    edgeTypes?: string[],
  ): Promise<UGM>;

  /**
   * Get the schema of the data source.
   */
  getSchema(): Promise<SchemaModel>;

  /**
   * Get full properties for a specific node.
   * Used for lazy-loading detailed properties.
   */
  getNodeProperties(nodeId: string): Promise<PropertyMap>;
}
