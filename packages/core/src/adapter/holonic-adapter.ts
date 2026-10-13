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
 *        menu wiring in @g3-toolkit/react holonic-portal-menu
 *   R5.1 (backend transparency) — NOT met; in-memory only
 */

import { UGM } from "../ugm";
import type { PropertyMap } from "../ugm";
import { AdapterArgumentError, coerceDepth } from "./query-safety";
import type { GraphAdapter, SchemaModel } from "./types";

/** A portal connecting two holons. */
export interface Portal {
  /**
   * Portal id. It is also the UGM edge id of the holarchy edge this
   * portal projects to (issue #48), so it must be unique across every
   * portal of the dataset; a repeated id keeps the first portal's edge
   * and skips the later one, the way a portal to an unknown holon is
   * already skipped. It should not reuse a holon id, because the
   * canvas hands Cytoscape one id space for nodes and edges.
   */
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
    /**
     * Stable edge id, used as the UGM edge id of the interior
     * projection (issue #48). Omitted, the graph generates one and the
     * same interior edge gets a different id on every projection. Must
     * be unique across the holon's interior edges and should not reuse
     * an interior node id (one Cytoscape id space, as for `Portal.id`);
     * on a duplicate the first edge wins and the later one is skipped,
     * the way an edge with a missing endpoint is already skipped.
     */
    id?: string;
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

  /**
   * Project the holon's interior. DEPTH IS REJECTED ABOVE 1 rather
   * than ignored.
   *
   * This adapter's expansion is a drill-down into one holon, so there
   * is no hop count to honor. A multi-hop holarchy neighborhood would
   * have to traverse portals and then link the interiors it collected,
   * and the linkage lives in the boundary and projection graphs that
   * the simplified `HolonicDataset` above deliberately does not carry
   * (see the SCOPE note in this file's header, and R5.1). Unioning
   * interiors without it would return disconnected components and call
   * them a neighborhood.
   *
   * Silently discarding the argument was the prior behavior: a host
   * wiring a "expand 2 hops" action got one hop and no signal. A throw
   * puts the failure at the call site that supplied the value.
   *
   * @throws AdapterArgumentError when `depth` resolves above 1.
   */
  async expandNeighborhood(holonId: string, depth = 1): Promise<UGM> {
    if (coerceDepth(depth) > 1) {
      throw new AdapterArgumentError(
        "depth",
        `HolonicAdapter expands one holon's interior and cannot honor depth ${depth}; ` +
          `pass 1, or traverse the holarchy with projectToLPG() and expand each holon`,
      );
    }
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
        if (!ugm.hasNode(portal.targetHolonId)) continue;
        // First portal wins on a repeated id; see `Portal.id`.
        if (ugm.hasEdge(portal.id)) continue;
        ugm.addEdge(holon.id, portal.targetHolonId, {
          key: portal.id,
          type: portal.label,
          properties: {
            _portalId: portal.id,
            _hasConstruct: !!portal.constructQuery,
          },
        });
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
      if (!ugm.hasNode(edge.source) || !ugm.hasNode(edge.target)) continue;
      // First edge wins on a duplicate id; see `Holon.interiorEdges`.
      if (edge.id !== undefined && ugm.hasEdge(edge.id)) continue;
      ugm.addEdge(edge.source, edge.target, {
        key: edge.id,
        type: edge.type,
        properties: edge.properties ?? {},
      });
    }

    return ugm;
  }
}
