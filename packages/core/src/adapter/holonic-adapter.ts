/**
 * Holonic adapter (M3.E2.T3, M3.E2.T4).
 *
 * Maps an in-memory Holonic dataset shape (holons, portals, interior
 * graphs) to UGM: holons become nodes, portals become edges, and
 * interior graphs are projected to a flat LPG.
 *
 * SCOPE (honest accounting after the v1.0.0-rc audit): this adapter
 * consumes the simplified `HolonicDataset` interface defined below,
 * not the `holonic` Python library's four-graph model. It has no
 * SPARQL transport and therefore does NOT satisfy R5.1's acceptance
 * criteria (RdflibBackend / FusekiBackend over HTTP); R5.1 is tracked
 * as in-progress in specs/05. A backend-connected adapter would
 * compose this mapping with the SPARQL middleware stack.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/05-integration-holonic.md
 *   R5.2 (holarchy topology rendering) — implemented here
 *   R5.3 (project_to_lpg as default rendering path) — implemented here
 *   R5.4 (portal context-menu surfacing) — data side implemented here;
 *        menu wiring in @g3t/react holonic-portal-menu
 *   R5.1 (backend transparency) — NOT met; in-memory only
 */

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

// @see R5.2, R5.3: holarchy topology and interior projection
export class HolonicAdapter implements GraphAdapter {
  readonly name = "Holonic Dataset";
  readonly id = "holonic";

  constructor(public readonly dataset: HolonicDataset) {}

  /**
   * NOTE: the in-memory dataset has no query engine; the query string
   * is currently ignored and the top-level holarchy projection is
   * returned. Callers that need real query semantics should use a
   * backend-connected adapter. Logged (not thrown) so existing view
   * wiring keeps working while making the limitation observable.
   */
  async query(q: string): Promise<UGM> {
    if (q && q.trim().length > 0) {
      console.warn(
        "HolonicAdapter.query: in-memory adapter ignores query strings; returning holarchy projection",
      );
    }
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
