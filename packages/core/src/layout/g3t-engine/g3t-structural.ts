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
import {
  CORRIDOR_DRIFT_TOLERANCE,
  computeCorridorGap,
  estimateCorridorDemand,
  harvestBendHints,
  splitLongSpanEdges,
} from "./g3t-dummy-chain";
import { nudgeRoutes, type CorridorDemand } from "./g3t-nudging";
import type { Pt } from "./g3t-polyline-utils";

/**
 * Dev-mode drift assertion (brief 04): the router's measured
 * per-corridor track demand must not exceed the layout's structural
 * estimate by more than CORRIDOR_DRIFT_TOLERANCE. Warnings name the
 * corridor so the calibration test can widen the tolerance per
 * diagram class (never silently: a failing assertion is a signal, not
 * a runtime re-layout trigger).
 */
function checkCorridorDrift(
  estimated: ReadonlyMap<number, number>,
  midlines: readonly number[],
  measured: readonly CorridorDemand[],
  horizontal: boolean,
): void {
  const isDev =
    typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
  if (!isDev) return;
  const expectedAxis: "v" | "h" = horizontal ? "v" : "h";
  for (const m of measured) {
    if (m.axis !== expectedAxis) continue;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < midlines.length; i++) {
      const mid = midlines[i];
      if (mid === undefined) continue;
      const d = Math.abs(mid - m.midline);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) continue;
    const est = estimated.get(bestIdx) ?? 0;
    if (m.tracksRequired > est + CORRIDOR_DRIFT_TOLERANCE) {
      console.warn(
        `[g3t/layout] corridor supply underestimated: boundary ${bestIdx} at ${m.midline.toFixed(1)} estimated ${est} tracks, router measured ${m.tracksRequired}`,
      );
    }
  }
}

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
  // Owner directive 2026-07-28 (#2, part a): sides must be LONG
  // ENOUGH for their attachments. Ports are declared, so per-side
  // port demand is exact: E/W ports need HEIGHT, N/S ports need
  // WIDTH (port 12 + gap 8, with 12 margin at both ends). Box-edge
  // fans get a degree floor on the cross extent (the side split is
  // decided at routing time; the floor covers the common case of
  // attachments concentrating on the flow-facing sides).
  const PORT_PITCH = 20;
  const EDGE_PITCH = 20;
  const SIDE_MARGIN = 24;
  const degree = new Map<string, number>();
  for (const e of input.edges) {
    if (e.source === e.target) continue;
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const sideDemand = (id: string): { minWidth: number; minHeight: number } => {
    const ports = inputById.get(id)?.ports ?? [];
    const count = (pred: (side: string | undefined) => boolean): number =>
      ports.filter((pt) => pred(pt.side)).length;
    const ew = Math.max(
      count((sd) => sd === "EAST"),
      count((sd) => sd === "WEST"),
    );
    const ns = Math.max(
      count((sd) => sd === "NORTH"),
      count((sd) => sd === "SOUTH"),
    );
    // Box edges: assume up to ceil(degree/2) can land on one side.
    const fan = Math.ceil((degree.get(id) ?? 0) / 2);
    return {
      minWidth: ns > 0 ? ns * PORT_PITCH + SIDE_MARGIN : 0,
      minHeight:
        Math.max(ew, fan) > 0
          ? Math.max(ew * PORT_PITCH, fan * EDGE_PITCH) + SIDE_MARGIN
          : 0,
    };
  };
  const boxes = (graph.children ?? []).map((child) => {
    const demand = sideDemand(child.id);
    const rows = child.children ?? [];
    if (rows.length === 0) {
      return {
        id: child.id,
        width: Math.max(child.width ?? 100, demand.minWidth),
        height: Math.max(child.height ?? 44, demand.minHeight),
      };
    }
    const width = Math.max(
      Math.max(...rows.map((r) => r.width ?? 0)),
      demand.minWidth,
    );
    const height = Math.max(
      headerHeight + rows.reduce((sum, r) => sum + (r.height ?? 0), 0),
      demand.minHeight,
    );
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
  // LAY-005: split long-span edges into dummy chains so ordering and
  // placement see intermediate positions. Dummies are appended to
  // their layers (BK's type-1 scan is index-keyed; appending keeps
  // the block structure stable).
  const { augmentedLayerOf, dummyIdsByEdge } = splitLongSpanEdges(
    crossBoxes,
    edges,
    layerOf,
    reversed,
  );
  // LAY-005: pass the augmented graph to orderLayers so dummies drag
  // real-node positions via barycenter to reduce crossings against
  // the chain. Real-node ORDER within each layer is what carries
  // over to placement (see realLayers below); the dummies then leave
  // the pipeline until interpolation.
  //
  // Prune-wall (16 columns, 5 K-column-span skips) reproducibly
  // regresses when the augmented graph feeds orderLayers: the
  // ordering shuffle moves obstacles enough that the perimeter router
  // can no longer reach a clean route. Ordering on the real graph
  // keeps those routes intact; the dummies still shape the router's
  // seed via interpolation below, which is the load-bearing product
  // for the router. Revisit when the channel router (PRF-003) lands.
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
  const realLayers = ordering.layers;
  const x =
    (options?.placement ?? "brandes-koepf") === "brandes-koepf"
      ? placeBrandesKoepf(crossBoxes, edges, reversed, realLayers, nodeSpacing)
      : placeNodes(crossBoxes, edges, reversed, realLayers, nodeSpacing);

  const widthOf = new Map(boxes.map((b) => [b.id, b.width] as const));
  const heightOf = new Map(boxes.map((b) => [b.id, b.height] as const));
  // LAY-005: collect dummy centers in the FINAL absolute frame so
  // harvested hints hand the router the exact points to bend at.
  // Positions come from LAYER-INDEX interpolation across the placed
  // real endpoints (see the interpolation pass below the emission
  // loop), not from BK's compaction: dummies do not participate in
  // placement (see the realLayers/realEdges pass above), keeping
  // real-node coords stable for the router's obstacle assumptions.
  const dummyPositions = new Map<string, Pt>();
  // Track each layer's flow-axis center as it emits, keyed by layer
  // INDEX (the same index augmentedLayerOf uses for dummies).
  const layerFlowCenter: number[] = [];
  // Brief 04: per-boundary corridor-supply sizing. Demand is a chain-
  // segment count computed from structure (before placement); gaps
  // widen where the estimate exceeds baseGap and are capped by
  // maxGapFactor. Midlines are captured for the drift assertion.
  const corridorDemandEst = estimateCorridorDemand(edges, layerOf);
  const corridorMidlines: number[] = [];
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
  for (let li = 0; li < realLayers.length; li++) {
    const layer = realLayers[li] ?? [];
    const layerF = Math.max(0, ...layer.map((id) => flowExtent(id)));
    layerFlowCenter.push(flow + layerF / 2);
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
          // LR-19 (owner review 2026-07-22): ports MOUNT on the
          // border and sit FULLY OUTSIDE the container (the old
          // center-on-border placement straddled it half-in).
          const px = horizontal
            ? side === "EAST"
              ? ox + w
              : ox - size
            : ox + frac * w - size / 2;
          const py = horizontal
            ? oy + frac * h - size / 2
            : side === "SOUTH"
              ? oy + h
              : oy - size;
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
    if (li < realLayers.length - 1) {
      const demand = corridorDemandEst.get(li) ?? 0;
      const { gap } = computeCorridorGap(
        demand,
        layerSpacing,
        options?.trackGap,
        undefined,
        options?.corridorMaxGapFactor,
      );
      corridorMidlines.push(flow + layerF + gap / 2);
      flow += layerF + gap;
    } else {
      flow += layerF + layerSpacing;
    }
  }
  // LAY-005: interpolate dummy positions from the placed real
  // endpoints. Along the FLOW axis the dummy takes its layer's
  // center (the same slot BK would land it in with zero size and
  // zero spacing); along the CROSS axis it interpolates linearly by
  // layer-index fraction between source and target centers. Straight
  // by construction: the router uses these as bend hints and may
  // choose a different corridor, but the seed is always inside the
  // between-endpoints envelope so it can never introduce a violation
  // the router wouldn't produce anyway (the escalation ladder still
  // runs when the seed doesn't clear).
  for (const [edgeId, dummyIds] of dummyIdsByEdge) {
    const origEdge = input.edges.find((e) => e.id === edgeId);
    if (origEdge === undefined) continue;
    const sGeo = nodes[origEdge.source];
    const tGeo = nodes[origEdge.target];
    if (sGeo === undefined || tGeo === undefined) continue;
    const sc = { x: sGeo.x + sGeo.width / 2, y: sGeo.y + sGeo.height / 2 };
    const tc = { x: tGeo.x + tGeo.width / 2, y: tGeo.y + tGeo.height / 2 };
    const sl = augmentedLayerOf.get(origEdge.source) ?? 0;
    const tl = augmentedLayerOf.get(origEdge.target) ?? 0;
    for (const did of dummyIds) {
      const l = augmentedLayerOf.get(did);
      if (l === undefined) continue;
      const f = tl === sl ? 0.5 : (l - sl) / (tl - sl);
      const crossCoord = horizontal
        ? sc.y + f * (tc.y - sc.y)
        : sc.x + f * (tc.x - sc.x);
      const flowCoord = layerFlowCenter[l] ?? 0;
      dummyPositions.set(
        did,
        horizontal
          ? { x: flowCoord, y: crossCoord }
          : { x: crossCoord, y: flowCoord },
      );
    }
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
    // LAY-005: dummy centers ride the same mirror so hints stay in
    // the emitted geometry frame the router consumes.
    for (const [id, p] of dummyPositions) {
      if (horizontal) dummyPositions.set(id, { x: maxEdge - p.x, y: p.y });
      else dummyPositions.set(id, { x: p.x, y: maxEdge - p.y });
    }
  }
  const bendHints = harvestBendHints(dummyIdsByEdge, dummyPositions);
  at(nodes, "geometry");
  const geometry: StructuralGeometry = {
    version: 1,
    nodes,
    ports,
    headerHeight,
  };
  if (options?.routeEdges ?? true) {
    // Brief 04: route WITHOUT the router's built-in nudge fold, then
    // run nudgeRoutes here so we can capture corridorDemand for the
    // drift assertion. When the caller did not ask for nudging we
    // skip the measurement pass entirely (byte-identical to before).
    const rawRoutes = routeStructuralEdges(input, geometry, {
      routingBudgetMs: options?.routingBudgetMs,
      direction: options?.direction,
      // R-6 (upstream register, 2026-08-03): anchor was added for
      // R-4 but never forwarded here, so the option was unreachable
      // from the single call most consumers make and they had to
      // re-route over geometry the layout had just produced.
      anchor: options?.anchor,
      // LAY-005: preserve the historical default so a direct raw
      // routeStructuralEdges call (which now defaults longEdgeNear
      // to Infinity, disabling perimeter) does not silently change
      // behavior when invoked through the layout pipeline.
      longEdgeNear: options?.longEdgeNear ?? 12,
      // Opt-in; undefined leaves the fan exactly as it was.
      anchorPitch: options?.anchorPitch,
      bendHints,
    });
    if (options?.nudge) {
      const topBoxes = Object.entries(geometry.nodes).filter(
        ([, g]) => g.kind !== "row",
      );
      const obstacles = topBoxes.map(([id, g]) => ({
        id,
        x: g.x,
        y: g.y,
        width: g.width,
        height: g.height,
      }));
      // Same trackGap the corridor-supply estimate above was sized
      // with, or the drift assertion compares two different geometries.
      const { routes, corridorDemand } = nudgeRoutes(rawRoutes, obstacles, {
        trackGap: options?.trackGap,
      });
      // Preserve the intermediate hints the router attaches; nudge
      // rewrites points only.
      const merged: Record<string, { points: Pt[]; intermediate?: Pt[] }> = {};
      for (const [id, r] of Object.entries(routes)) {
        const orig = rawRoutes[id];
        merged[id] =
          orig?.intermediate !== undefined
            ? { points: r.points, intermediate: orig.intermediate }
            : { points: r.points };
      }
      geometry.edges = merged;
      checkCorridorDrift(
        corridorDemandEst,
        corridorMidlines,
        corridorDemand,
        horizontal,
      );
    } else {
      geometry.edges = rawRoutes;
    }
  }
  return geometry;
}
