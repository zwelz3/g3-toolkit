/**
 * g3t engine, stage D2a: structural inputs (WS-D).
 *
 * The containment pre-pass deliberately REUSES buildStructuralElkGraph
 * for measurement and sizing: the same text measurement, the same
 * row plans, the same header height, the same port-side policy. One
 * sizing implementation means the two engines cannot drift on what a
 * container IS; they differ only in where boxes land. Containers
 * reduce to their derived boxes (shared row width; header + stacked
 * rows), the flat layered pass places the boxes, and emission stacks
 * rows exactly as the elk container layout does (DOWN, zero gaps,
 * top padding = header strip).
 *
 * Sketch warm-start (INTERACTIVE semantics): a sketch initializes
 * each layer's order by prior x and caps ordering at ONE refinement
 * sweep, and seeds placement from prior positions: warm-start plus
 * one sweep, by construction the fast class.
 *
 * No edge routing (the router boundary stays); declared ports emit
 * evenly spaced along their declared side.
 */
import type {
  StructuralGeometry,
  StructuralGraphInput,
  StructuralLayoutOptions,
} from "../structural";
import { buildStructuralElkGraph } from "../structural";
import { routeStructuralEdges } from "./g3t-routing";
import {
  layersFor,
  orderLayers,
  placeBrandesKoepf,
  placeNodes,
  removeCycles,
  type G3tLayoutOptions,
} from "./g3t-layered";

function at<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`g3t structural invariant: ${what}`);
  return v;
}

function headerLine(h: { stereotype?: string; name: string }): string {
  return h.stereotype ? `\u00AB${h.stereotype}\u00BB ${h.name}` : h.name;
}

export function g3tLayoutStructural(
  input: StructuralGraphInput,
  options?: StructuralLayoutOptions & G3tLayoutOptions,
): StructuralGeometry {
  const { graph, rowPlans, headerHeight } = buildStructuralElkGraph(
    input,
    options,
  );
  const inputById = new Map(input.nodes.map((n) => [n.id, n] as const));

  // Top-level boxes: plain children carry explicit sizes; containers
  // derive theirs from the shared row width and the stacked heights.
  const boxes = (graph.children ?? []).map((child) => {
    const rows = child.children ?? [];
    if (rows.length === 0) {
      return {
        id: child.id,
        width: child.width ?? 100,
        height: child.height ?? 44,
      };
    }
    const width = Math.max(...rows.map((r) => r.width ?? 0));
    const height =
      headerHeight + rows.reduce((sum, r) => sum + (r.height ?? 0), 0);
    return { id: child.id, width, height };
  });
  const edges = input.edges
    .filter((e) => e.source !== e.target)
    .map((e) => ({ id: e.id, source: e.source, target: e.target }));

  const layerSpacing = options?.layerSpacing ?? 64;
  const nodeSpacing = options?.spacing ?? 24;
  const sketch = options?.sketch;
  // Cross-axis separation must use the CROSS extent: horizontal
  // flow (RIGHT/LEFT, the default) separates siblings vertically,
  // so the flat pass sees transposed boxes there.
  const dirEarly = options?.direction ?? "RIGHT";
  const horizontalEarly = dirEarly === "RIGHT" || dirEarly === "LEFT";
  const crossBoxes = horizontalEarly
    ? boxes.map((b) => ({ id: b.id, width: b.height, height: b.width }))
    : boxes;

  const reversed = removeCycles(crossBoxes, edges);
  const layerOf = layersFor(crossBoxes, edges, reversed, options);
  const ordering = orderLayers(crossBoxes, edges, reversed, layerOf, {
    orderingBudgetMs: options?.orderingBudgetMs,
    // INTERACTIVE semantics: warm-start + one refinement sweep.
    maxSweeps: sketch ? 1 : options?.maxSweeps,
    ...(sketch
      ? {
          // The warm-start key is the CROSS coordinate: y under
          // horizontal flow (RIGHT/LEFT), x under vertical.
          initialOrder: (ids: readonly string[]): string[] =>
            [...ids].sort((a, b) => {
              const ax = horizontalEarly ? sketch[a]?.y : sketch[a]?.x;
              const bx = horizontalEarly ? sketch[b]?.y : sketch[b]?.x;
              if (ax !== undefined && bx !== undefined) return ax - bx;
              if (ax !== undefined) return -1;
              if (bx !== undefined) return 1;
              return a < b ? -1 : 1;
            }),
        }
      : {}),
  });
  const x =
    (options?.placement ?? "brandes-koepf") === "brandes-koepf"
      ? placeBrandesKoepf(
          crossBoxes,
          edges,
          reversed,
          ordering.layers,
          nodeSpacing,
        )
      : placeNodes(crossBoxes, edges, reversed, ordering.layers, nodeSpacing);

  const widthOf = new Map(boxes.map((b) => [b.id, b.width] as const));
  const heightOf = new Map(boxes.map((b) => [b.id, b.height] as const));
  const nodes: StructuralGeometry["nodes"] = {};
  const ports: StructuralGeometry["ports"] = {};
  // Direction (WS-D D3a): layers stack along the FLOW axis. RIGHT
  // (the default) and LEFT flow horizontally: layer index advances
  // in x and the cross-axis placement value lands in y. DOWN/UP
  // flow vertically. LEFT/UP reverse the flow coordinate at the end.
  const direction = options?.direction ?? "RIGHT";
  const horizontal = direction === "RIGHT" || direction === "LEFT";
  const flowExtent = (id: string): number =>
    horizontal ? (widthOf.get(id) ?? 100) : (heightOf.get(id) ?? 44);
  let flow = 0;
  for (const layer of ordering.layers) {
    const layerF = Math.max(0, ...layer.map((id) => flowExtent(id)));
    for (const id of layer) {
      const w = widthOf.get(id) ?? 100;
      const h = heightOf.get(id) ?? 44;
      const cross = (x.get(id) ?? 0) - (horizontal ? h : w) / 2;
      const along = flow + (layerF - (horizontal ? w : h)) / 2;
      const ox = horizontal ? along : cross;
      const oy = horizontal ? cross : along;
      const source = inputById.get(id);
      const child = (graph.children ?? []).find((c) => c.id === id);
      const rows = child?.children ?? [];
      const plans = rowPlans.get(id);
      nodes[id] = {
        x: ox,
        y: oy,
        width: w,
        height: h,
        kind: plans ? "container" : "node",
        text: source?.header
          ? headerLine(source.header)
          : plans
            ? undefined
            : id,
      };
      if (plans) {
        // Row stacking mirrors the elk container layout: DOWN, zero
        // gaps, header-strip top padding, shared width.
        const planById = new Map(plans.map((p) => [p.id, p]));
        let ry = headerHeight;
        for (const row of rows) {
          const plan = planById.get(row.id);
          const rh = row.height ?? 0;
          if (plan) {
            nodes[row.id] = {
              x: ox,
              y: oy + ry,
              width: row.width ?? w,
              height: rh,
              kind: "row",
              parent: id,
              compartment: plan.compartment,
              text: plan.text,
              divider: plan.divider || undefined,
            };
          }
          ry += rh;
        }
      }
      // Declared ports: evenly spaced along their declared side.
      const declared = inputById.get(id)?.ports ?? [];
      const bySide = new Map<string, typeof declared>();
      for (const p of declared) {
        const side =
          (child?.ports ?? []).find((cp) => cp.id === p.id)?.layoutOptions?.[
            "elk.port.side"
          ] ??
          p.side ??
          "EAST";
        const list = bySide.get(side) ?? [];
        bySide.set(side, [...list, p]);
      }
      for (const [side, list] of bySide) {
        list.forEach((p, i) => {
          const size = p.size ?? 12;
          const frac = (i + 1) / (list.length + 1);
          const horizontal = side === "EAST" || side === "WEST";
          const px = horizontal
            ? side === "EAST"
              ? ox + w - size / 2
              : ox - size / 2
            : ox + frac * w - size / 2;
          const py = horizontal
            ? oy + frac * h - size / 2
            : side === "SOUTH"
              ? oy + h - size / 2
              : oy - size / 2;
          ports[p.id] = {
            node: id,
            side: side as "NORTH" | "SOUTH" | "EAST" | "WEST",
            x: px,
            y: py,
            width: size,
            height: size,
          };
        });
      }
    }
    flow += layerF + layerSpacing;
  }
  // LEFT/UP: mirror the flow axis so layer 0 sits at the far edge.
  if (direction === "LEFT" || direction === "UP") {
    let maxEdge = -Infinity;
    for (const g of Object.values(nodes)) {
      maxEdge = Math.max(maxEdge, horizontal ? g.x + g.width : g.y + g.height);
    }
    for (const g of Object.values(nodes)) {
      if (horizontal) g.x = maxEdge - g.x - g.width;
      else g.y = maxEdge - g.y - g.height;
    }
    for (const pg of Object.values(ports)) {
      if (horizontal) pg.x = maxEdge - pg.x - pg.width;
      else pg.y = maxEdge - pg.y - pg.height;
    }
  }
  at(nodes, "geometry");
  const geometry: StructuralGeometry = {
    version: 1,
    nodes,
    ports,
    headerHeight,
  };
  if (options?.routeEdges ?? true) {
    geometry.edges = routeStructuralEdges(input, geometry, {
      routingBudgetMs: options?.routingBudgetMs,
      direction: options?.direction,
    });
  }
  return geometry;
}
