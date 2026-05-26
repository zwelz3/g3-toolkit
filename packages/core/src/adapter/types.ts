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
   * @param edgeTypes Optional filter to specific edge types.
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
