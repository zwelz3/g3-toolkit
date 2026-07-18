/**
 * Structural SVG view (G3L:RND-001 continuation; F1 structural
 * slice).
 *
 * Renders the renderer-neutral structural geometry document
 * (StructuralGeometry: absolute top-left boxes for containers, rows,
 * plain nodes, ports, plus routed edge polylines) through pure SVG.
 * This is the alternative renderer path for structural diagrams:
 * where the Cytoscape path converts geometry to cy elements and
 * fights compound semantics (the expand/collapse postmortem's
 * "geometry-right is not picture-right"), this view draws the
 * document VERBATIM: what the layout computed is what appears, and
 * jsdom can verify all of it headlessly.
 *
 * Interaction: transform-only wheel-zoom and drag-pan on the scene
 * group (the MR-2-validated pattern; no per-element work in the hot
 * path). UML edge symbols reuse the overlay's arrow geometry
 * (arrowShapes / shortenPolyline / isDashedKind), so the two paths
 * cannot drift apart on relationship semantics.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { hitTestStructural } from "@g3t/core";
import type {
  StructuralGeometry,
  StructuralGraphInput,
  StructuralHit,
} from "@g3t/core";
import {
  useElementPointerEvents,
  type ElementPointerHandlers,
} from "../../interaction/element-pointer-events";
import {
  arrowShapes,
  isDashedKind,
  shortenPolyline,
  type UmlEdgeKind,
} from "../canvas/structural-edge-overlay";

export interface StructuralSvgTheme {
  background: string;
  containerFill: string;
  containerStroke: string;
  headerFill: string;
  headerText: string;
  rowText: string;
  dividerText: string;
  nodeFill: string;
  nodeText: string;
  edgeStroke: string;
  edgeLabel: string;
  portFill: string;
}

/** Defaults tuned for the demo's dark shell. */
export const STRUCTURAL_SVG_DARK: StructuralSvgTheme = {
  background: "transparent",
  containerFill: "rgba(30, 41, 59, 0.85)",
  containerStroke: "#64748b",
  headerFill: "rgba(51, 65, 85, 0.95)",
  headerText: "#e2e8f0",
  rowText: "#cbd5e1",
  dividerText: "#94a3b8",
  nodeFill: "rgba(30, 41, 59, 0.85)",
  nodeText: "#e2e8f0",
  edgeStroke: "#94a3b8",
  edgeLabel: "#cbd5e1",
  portFill: "#e2e8f0",
};

export interface StructuralSvgViewProps extends ElementPointerHandlers<StructuralHit> {
  input: StructuralGraphInput;
  geometry: StructuralGeometry;
  width: number;
  height: number;
  theme?: StructuralSvgTheme;
  "data-testid"?: string;
}

const FIT_PADDING = 32;

export function StructuralSvgView({
  input,
  geometry,
  width,
  height,
  theme = STRUCTURAL_SVG_DARK,
  "data-testid": testId,
  ...pointerHandlers
}: StructuralSvgViewProps): React.JSX.Element {
  // Fit-to-content initial viewport.
  const fit = useMemo(() => {
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const g of Object.values(geometry.nodes)) {
      if (g.parent !== undefined) continue;
      x1 = Math.min(x1, g.x);
      y1 = Math.min(y1, g.y);
      x2 = Math.max(x2, g.x + g.width);
      y2 = Math.max(y2, g.y + g.height);
    }
    if (!Number.isFinite(x1)) return { k: 1, tx: 0, ty: 0 };
    const k = Math.min(
      (width - 2 * FIT_PADDING) / Math.max(1, x2 - x1),
      (height - 2 * FIT_PADDING) / Math.max(1, y2 - y1),
      1.5,
    );
    return {
      k,
      tx: (width - k * (x2 - x1)) / 2 - k * x1,
      ty: (height - k * (y2 - y1)) / 2 - k * y1,
    };
  }, [geometry, width, height]);

  const [view, setView] = useState<{ k: number; tx: number; ty: number }>(fit);
  const [lastFit, setLastFit] = useState(fit);
  if (lastFit !== fit) {
    // New geometry/viewport: reset to the fresh fit (the documented
    // adjust-state-during-render pattern; no refs in render).
    setLastFit(fit);
    setView(fit);
  }
  const drag = useRef<{ x: number; y: number } | null>(null);
  // MR-11 round-3 (owner: "click-drag only works for the entire
  // canvas"): pointer-down now resolves through the hit test. A
  // node body/header grab drags THAT node (rendered through an
  // offset map; its edges' routed polylines are stale during the
  // drag, so they fall back to straight lines, honestly, until
  // RTE-011 wires live rerouting here). Anything else pans.
  const nodeDrag = useRef<{ id: string; lastX: number; lastY: number } | null>(
    null,
  );
  const [dragOffsets, setDragOffsets] = useState<
    Record<string, { dx: number; dy: number }>
  >({});
  const offsetOf = (ownerId: string): { dx: number; dy: number } =>
    dragOffsets[ownerId] ?? { dx: 0, dy: 0 };
  const draggedEdgeFallback = useMemo(() => {
    const moved = new Set(Object.keys(dragOffsets));
    if (moved.size === 0) return new Set<string>();
    const out = new Set<string>();
    for (const e of input.edges) {
      if (moved.has(e.source) || moved.has(e.target)) out.add(e.id);
    }
    return out;
  }, [dragOffsets, input.edges]);

  // INT-001: model point = inverse of the view transform.
  const hit = useCallback(
    (p: { x: number; y: number }) => hitTestStructural(input, geometry, p),
    [input, geometry],
  );
  const toModel = useCallback(
    (client: { x: number; y: number }, el: SVGSVGElement) => {
      const r = el.getBoundingClientRect();
      return {
        x: (client.x - r.left - view.tx) / view.k,
        y: (client.y - r.top - view.ty) / view.k,
      };
    },
    [view],
  );
  const pointerProps = useElementPointerEvents<StructuralHit, SVGSVGElement>(
    hit,
    toModel,
    pointerHandlers,
  );

  // MR-11 round-4 (owner: wheel "zooms the overall application
  // shell and the graph view unreliably"): React attaches wheel
  // listeners PASSIVELY at the root, so a React onWheel cannot
  // preventDefault and the page scrolls the shell while the graph
  // zooms (the "linked" feel). The zoom therefore binds as a NATIVE
  // non-passive listener that preventDefaults. Round-3's lesson
  // stands inside it: event-derived values are captured before the
  // deferred state updater runs.
  const svgRef = useRef<SVGSVGElement | null>(null);
  React.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(4, Math.max(0.05, v.k * factor));
        // Zoom about the pointer: keep the model point under it
        // fixed.
        return {
          k,
          tx: px - ((px - v.tx) / v.k) * k,
          ty: py - ((py - v.ty) / v.k) * k,
        };
      });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const model = {
      x: (e.clientX - rect.left - view.tx) / view.k,
      y: (e.clientY - rect.top - view.ty) / view.k,
    };
    const h = hitTestStructural(input, geometry, model);
    if (
      h !== null &&
      h.kind === "node" &&
      (h.zone === "body" || h.zone === "header")
    ) {
      nodeDrag.current = {
        id: h.elementId,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    } else {
      drag.current = { x: e.clientX, y: e.clientY };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const nd = nodeDrag.current;
    if (nd) {
      const dx = (e.clientX - nd.lastX) / view.k;
      const dy = (e.clientY - nd.lastY) / view.k;
      nd.lastX = e.clientX;
      nd.lastY = e.clientY;
      setDragOffsets((m) => {
        const cur = m[nd.id] ?? { dx: 0, dy: 0 };
        return { ...m, [nd.id]: { dx: cur.dx + dx, dy: cur.dy + dy } };
      });
      return;
    }
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
    nodeDrag.current = null;
  };

  const edgeKind = useMemo(() => {
    const m = new Map<string, { kind: UmlEdgeKind; label?: string }>();
    for (const e of input.edges) {
      m.set(e.id, {
        kind: (e.kind ?? "association") as UmlEdgeKind,
        label: e.label,
      });
    }
    return m;
  }, [input.edges]);

  const nodes = Object.entries(geometry.nodes);
  const containers = nodes.filter(([, g]) => g.kind === "container");
  const rows = nodes.filter(([, g]) => g.kind === "row");
  const plain = nodes.filter(([, g]) => g.kind === "node");
  const headerH = geometry.headerHeight;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-testid={testId}
      role="img"
      style={{
        background: theme.background,
        cursor: "grab",
        touchAction: "none",
      }}
      ref={svgRef}
      onClick={pointerProps.onClick}
      onContextMenu={pointerProps.onContextMenu}
      onPointerLeave={pointerProps.onPointerLeave}
      onPointerDown={(e) => {
        pointerProps.onPointerDown(e);
        onPointerDown(e);
      }}
      onPointerMove={(e) => {
        pointerProps.onPointerMove(e);
        onPointerMove(e);
      }}
      onPointerUp={(e) => {
        pointerProps.onPointerUp(e);
        onPointerUp();
      }}
    >
      <g
        data-ssv-scene=""
        transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}
      >
        {/* Containers: body, header strip, header text. */}
        {containers.map(([id, gRaw]) => {
          const off = offsetOf(id);
          const g = { ...gRaw, x: gRaw.x + off.dx, y: gRaw.y + off.dy };
          const header = input.nodes.find((n) => n.id === id)?.header;
          const title = header
            ? `${header.stereotype ? `\u00ab${header.stereotype}\u00bb ` : ""}${header.name}`
            : (g.text ?? id);
          return (
            <g key={id} data-ssv-node={id} data-ssv-kind="container">
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                rx={4}
                fill={theme.containerFill}
                stroke={theme.containerStroke}
                strokeWidth={1.2}
              />
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={headerH}
                rx={4}
                fill={theme.headerFill}
              />
              <text
                x={g.x + g.width / 2}
                y={g.y + headerH / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={theme.headerText}
                data-ssv-header={id}
              >
                {title}
              </text>
            </g>
          );
        })}

        {/* Compartment rows (divider titles styled separately). */}
        {rows.map(([id, gRaw]) => {
          const off = offsetOf(gRaw.parent ?? id);
          const g = { ...gRaw, x: gRaw.x + off.dx, y: gRaw.y + off.dy };
          return (
            <text
              key={id}
              x={g.x + 8}
              y={g.y + g.height / 2 + 3.5}
              fontSize={g.divider ? 9.5 : 10.5}
              fontStyle={g.divider ? "italic" : undefined}
              fill={g.divider ? theme.dividerText : theme.rowText}
              data-ssv-row={id}
            >
              {g.text ?? ""}
            </text>
          );
        })}

        {/* Plain nodes. */}
        {plain.map(([id, gRaw]) => {
          const off = offsetOf(id);
          const g = { ...gRaw, x: gRaw.x + off.dx, y: gRaw.y + off.dy };
          return (
            <g key={id} data-ssv-node={id} data-ssv-kind="node">
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                rx={6}
                fill={theme.nodeFill}
                stroke={theme.containerStroke}
                strokeWidth={1.2}
              />
              <text
                x={g.x + g.width / 2}
                y={g.y + g.height / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill={theme.nodeText}
                data-ssv-label={id}
              >
                {g.text ?? input.nodes.find((n) => n.id === id)?.header?.name}
              </text>
            </g>
          );
        })}

        {/* Edges: routed polylines, arrow-trimmed shafts, UML
            symbols, mid labels. */}
        {Object.entries(geometry.edges ?? {}).map(([id, egRaw]) => {
          const meta = edgeKind.get(id);
          if (!meta) return null;
          // Dragged endpoints make the routed polyline stale: fall
          // back to a straight offset-aware center line (data-ssv-
          // edge-fallback marks it for tests and for the eye).
          let eg = egRaw;
          let fallback = false;
          if (draggedEdgeFallback.has(id)) {
            const edge = input.edges.find((x) => x.id === id);
            const sG = edge ? geometry.nodes[edge.source] : undefined;
            const tG = edge ? geometry.nodes[edge.target] : undefined;
            if (edge && sG && tG) {
              const so = offsetOf(edge.source);
              const to = offsetOf(edge.target);
              eg = {
                points: [
                  {
                    x: sG.x + sG.width / 2 + so.dx,
                    y: sG.y + sG.height / 2 + so.dy,
                  },
                  {
                    x: tG.x + tG.width / 2 + to.dx,
                    y: tG.y + tG.height / 2 + to.dy,
                  },
                ],
              };
              fallback = true;
            }
          }
          const shapes = arrowShapes(meta.kind, eg.points);
          let pts = eg.points;
          for (const s of shapes) {
            pts = shortenPolyline(pts, s.end, s.trim);
          }
          const d = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
            .join(" ");
          const mid = eg.points[Math.floor(eg.points.length / 2)];
          return (
            <g key={id} data-ssv-edge={id}>
              <path
                d={d}
                fill="none"
                stroke={theme.edgeStroke}
                strokeWidth={1.5}
                strokeDasharray={isDashedKind(meta.kind) ? "6 4" : undefined}
                data-ssv-edge-path={id}
                {...(fallback ? { "data-ssv-edge-fallback": id } : {})}
              />
              {shapes.map((s, i) => (
                <path
                  key={i}
                  d={s.d}
                  stroke={theme.edgeStroke}
                  strokeWidth={1.5}
                  fill={s.fill === "stroke" ? theme.edgeStroke : "none"}
                  data-ssv-arrow={`${id}:${s.end}`}
                />
              ))}
              {meta.label !== undefined && mid !== undefined && (
                <text
                  x={mid.x}
                  y={mid.y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={theme.edgeLabel}
                  data-ssv-edge-label={id}
                >
                  {meta.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Boundary ports above everything. */}
        {Object.entries(geometry.ports).map(([id, pRaw]) => {
          const off = offsetOf(pRaw.node);
          const p = { ...pRaw, x: pRaw.x + off.dx, y: pRaw.y + off.dy };
          return (
            <rect
              key={id}
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.height}
              fill={theme.portFill}
              stroke={theme.containerStroke}
              strokeWidth={0.8}
              data-ssv-port={id}
            />
          );
        })}
      </g>
    </svg>
  );
}
