/**
 * Holonic adapter (M3.E2.T3, M3.E2.T4).
 *
 * Wraps a HolonicDataset (P6 four-graph model) and maps it to UGM.
 * Holons become nodes; portals become edges. Interior graphs are
 * projected via project_to_lpg().
 *
 * Framework-agnostic (D6).
 *
 * @see specs/05-integration-holonic.md R5.1, R5.2, R5.3, R5.4
 */

// Implements: R4.4 (Holonic projection pipeline), R5.5 (SHACL membrane),
// R5.6 (per-holon view config), R5.7 (holonic layer in inspector),
// R5.8 (multi-interior rendering).

import { UGM } from "../ugm";
import type { PropertyMap } from "../ugm";
import type { GraphAdapter, SchemaModel } from "./types";

/** A portal connecting two holons. */
export interface Portal {
  id: string;
  label: string;
  sourceHolonId: string;
  targetHolonId: string;
  /** CONSTRUCT query that produces the portal's subgraph. */
  constructQuery?: string;
}

/** A holon in the four-graph model (Interior, Boundary, Projection, Context). */
export interface Holon {
  id: string;
  label: string;
  types: string[];
  properties: PropertyMap;
  /** Interior graph nodes (simplified flat representation). */
  interiorNodes?: Array<{
    id: string;
    types: string[];
    properties: PropertyMap;
  }>;
  /** Interior graph edges. */
  interiorEdges?: Array<{
    source: string;
    target: string;
    type: string;
    properties?: PropertyMap;
  }>;
  /** Portals connecting this holon to others. */
  portals: Portal[];
}

/** In-memory representation of a Holonic dataset. */
export interface HolonicDataset {
  holons: Holon[];
}

// @see R4.4, R5.6, R5.8: holonic projection
export class HolonicAdapter implements GraphAdapter {
  readonly name = "Holonic Dataset";
  readonly id = "holonic";

  constructor(public readonly dataset: HolonicDataset) {}

  async query(_q: string): Promise<UGM> {
    // For Holonic datasets, query returns the top-level holon graph
    return this.projectToLPG();
  }

  async expandNeighborhood(holonId: string, _depth: number): Promise<UGM> {
    // Expand by projecting the holon's interior
    const holon = this.dataset.holons.find((h) => h.id === holonId);
    if (!holon) return new UGM();
    return this.projectHolonInterior(holon);
  }

  async getSchema(): Promise<SchemaModel> {
    const types = new Set<string>();
    for (const holon of this.dataset.holons) {
      for (const t of holon.types) types.add(t);
    }
    return {
      nodeTypes: [...types],
      edgeTypes: this.dataset.holons
        .flatMap((h) => h.portals.map((p) => p.label))
        .filter((v, i, a) => a.indexOf(v) === i),
      nodeProperties: {},
      edgeProperties: {},
    };
  }

  async getNodeProperties(holonId: string): Promise<PropertyMap> {
    const holon = this.dataset.holons.find((h) => h.id === holonId);
    return holon?.properties ?? {};
  }

  /**
   * Project the top-level holarchy to a flat LPG (R5.3).
   * Each holon becomes a node; each portal becomes an edge.
   */
  projectToLPG(): UGM {
    const ugm = new UGM();

    for (const holon of this.dataset.holons) {
      ugm.addNode(holon.id, {
        types: [...holon.types, "_Holon"],
        properties: {
          ...holon.properties,
          name: holon.label,
          _isHolon: true,
          _portalCount: holon.portals.length,
        },
      });
    }

    for (const holon of this.dataset.holons) {
      for (const portal of holon.portals) {
        if (ugm.hasNode(portal.targetHolonId)) {
          ugm.addEdge(holon.id, portal.targetHolonId, {
            type: portal.label,
            properties: {
              _portalId: portal.id,
              _hasConstruct: !!portal.constructQuery,
            },
          });
        }
      }
    }

    return ugm;
  }

  /** Project a single holon's interior graph to UGM. */
  projectHolonInterior(holon: Holon): UGM {
    const ugm = new UGM();

    for (const node of holon.interiorNodes ?? []) {
      ugm.addNode(node.id, {
        types: node.types,
        properties: {
          ...node.properties,
          _holonId: holon.id,
        },
      });
    }

    for (const edge of holon.interiorEdges ?? []) {
      if (ugm.hasNode(edge.source) && ugm.hasNode(edge.target)) {
        ugm.addEdge(edge.source, edge.target, {
          type: edge.type,
          properties: edge.properties ?? {},
        });
      }
    }

    return ugm;
  }
}
