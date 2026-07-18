/**
 * Change-set-driven layout (G3L:LAY-020).
 *
 * Spec: "Layout shall consume the model change-set (MOD-010) and
 * re-lay out only the affected region when the change is local,
 * falling back to global sketch mode otherwise, and shall report
 * which mode ran."
 *
 * LOCAL mode: the affected region (MOD-010's affectedRegion seed) is
 * laid out AS A SUBGRAPH and translated so its bounding-box anchor
 * matches the region's previous footprint; every non-region node's
 * geometry is carried over VERBATIM (byte-identical, oracle-pinned).
 * Edges touching the region lose their stale routes and are listed
 * in `rerouteEdges` for the routing layer (RTE-011's interactive
 * router at scene-local obstacle counts, exactly its fast class).
 *
 * GLOBAL-SKETCH fallback: a full layout seeded with every surviving
 * node's prior position (the sketch option), which runs the layered
 * strategies in their INTERACTIVE class: per the PRF-001 sharpened
 * measurement, that class is ~3.5x cheaper than a from-scratch
 * default layout because it skips LAYER_SWEEP crossing
 * minimization, the dominant cost.
 */
import {
  applyChangeSet,
  affectedRegion,
  type StructuralChangeSet,
  type ChangeSetDiagnostic,
} from "../model/change-set";
import {
  layoutStructural,
  type StructuralGeometry,
  type StructuralGraphInput,
  type StructuralLayoutOptions,
} from "./structural";

export interface ChangeDrivenLayoutResult {
  input: StructuralGraphInput;
  geometry: StructuralGeometry;
  /** Which LAY-020 mode ran (the spec's reporting requirement). */
  mode: "local" | "global-sketch";
  /** Edges whose routes were invalidated (local mode: everything
   *  touching the region); the routing layer re-routes these. */
  rerouteEdges: string[];
  diagnostics: ChangeSetDiagnostic[];
}

export interface ChangeDrivenLayoutOptions {
  /** Touched-population ceiling for local mode (default 24). */
  localThreshold?: number;
  /** Options forwarded to the underlying layouts. */
  layout?: Omit<StructuralLayoutOptions, "sketch">;
}

export async function layoutStructuralWithChangeSet(
  prev: { input: StructuralGraphInput; geometry: StructuralGeometry },
  cs: StructuralChangeSet,
  options?: ChangeDrivenLayoutOptions,
): Promise<ChangeDrivenLayoutResult> {
  const applied = applyChangeSet(prev.input, cs);
  const { input, diff } = applied;
  const locality = affectedRegion(prev.input, diff, {
    localThreshold: options?.localThreshold,
  });
  // New nodes are always part of the working region.
  const region = new Set<string>([...locality.region, ...diff.addedNodes]);

  if (!locality.local) {
    // GLOBAL-SKETCH: seed every surviving node's prior top-level
    // geometry so ELK's interactive strategies preserve structure.
    const sketch: Record<
      string,
      { x: number; y: number; width?: number; height?: number }
    > = {};
    for (const [id, g] of Object.entries(prev.geometry.nodes)) {
      if (g.parent !== undefined) continue; // top-level only
      if (!input.nodes.some((n) => n.id === id)) continue; // removed
      sketch[id] = { x: g.x, y: g.y, width: g.width, height: g.height };
    }
    const geometry = await layoutStructural(input, {
      ...options?.layout,
      sketch,
    });
    return {
      input,
      geometry,
      mode: "global-sketch",
      rerouteEdges: [],
      diagnostics: applied.diagnostics,
    };
  }

  // LOCAL: lay out the region subgraph, translate to the previous
  // regional footprint, and splice.
  const regionNodes = input.nodes.filter((n) => region.has(n.id));
  const regionEdges = input.edges.filter(
    (e) => region.has(e.source) && region.has(e.target),
  );
  const sub = await layoutStructural(
    { nodes: regionNodes, edges: regionEdges },
    options?.layout,
  );

  // Anchor: previous top-left of the region's SURVIVING prior
  // members; a region of only-new nodes anchors at the previous
  // scene's bottom-right (appended, not overlapped).
  let ax = Infinity;
  let ay = Infinity;
  let sceneMaxX = 0;
  let sceneMaxY = 0;
  for (const [id, g] of Object.entries(prev.geometry.nodes)) {
    if (g.parent !== undefined) continue;
    sceneMaxX = Math.max(sceneMaxX, g.x + g.width);
    sceneMaxY = Math.max(sceneMaxY, g.y + g.height);
    if (region.has(id)) {
      ax = Math.min(ax, g.x);
      ay = Math.min(ay, g.y);
    }
  }
  if (!Number.isFinite(ax)) {
    ax = sceneMaxX + 60;
    ay = 0;
  }
  let sx = Infinity;
  let sy = Infinity;
  for (const g of Object.values(sub.nodes)) {
    if (g.parent !== undefined) continue;
    sx = Math.min(sx, g.x);
    sy = Math.min(sy, g.y);
  }
  const dx = Number.isFinite(sx) ? ax - sx : 0;
  const dy = Number.isFinite(sy) ? ay - sy : 0;

  // Splice: carry non-region entries VERBATIM (minus removals),
  // replace region entries with the translated subgraph geometry.
  const nodes: StructuralGeometry["nodes"] = {};
  const removed = new Set(diff.removedNodes);
  for (const [id, g] of Object.entries(prev.geometry.nodes)) {
    const owner = g.parent ?? id;
    if (region.has(owner) || removed.has(owner) || removed.has(id)) continue;
    nodes[id] = g;
  }
  for (const [id, g] of Object.entries(sub.nodes)) {
    nodes[id] = { ...g, x: g.x + dx, y: g.y + dy };
  }
  const ports: StructuralGeometry["ports"] = {};
  for (const [id, p] of Object.entries(prev.geometry.ports)) {
    if (region.has(p.node) || removed.has(p.node)) continue;
    ports[id] = p;
  }
  for (const [id, p] of Object.entries(sub.ports)) {
    ports[id] = { ...p, x: p.x + dx, y: p.y + dy };
  }

  // Edge routes: keep prior routes only for edges FULLY OUTSIDE the
  // region; region-internal edges take the subgraph's translated
  // routes; boundary-crossing edges lose their routes and are
  // reported for rerouting.
  const edges: NonNullable<StructuralGeometry["edges"]> = {};
  const rerouteEdges: string[] = [];
  for (const e of input.edges) {
    const srcIn = region.has(e.source);
    const tgtIn = region.has(e.target);
    if (!srcIn && !tgtIn) {
      const priorRoute = prev.geometry.edges?.[e.id];
      if (priorRoute) edges[e.id] = priorRoute;
      continue;
    }
    const subRoute = sub.edges?.[e.id];
    if (srcIn && tgtIn && subRoute) {
      edges[e.id] = {
        points: subRoute.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
      continue;
    }
    rerouteEdges.push(e.id);
  }

  return {
    input,
    geometry: {
      version: 1,
      nodes,
      ports,
      edges,
      headerHeight: prev.geometry.headerHeight,
    },
    mode: "local",
    rerouteEdges: rerouteEdges.sort(),
    diagnostics: applied.diagnostics,
  };
}
