/**
 * SVG renderer adapter (G3L:RND-001, workstream F1).
 *
 * Renders resolved VisualAttributes natively: everything the
 * Cytoscape projection reports as unsupported or approximated
 * (halo, glyphs, donut, pulse, taper, gradient, label halos) becomes
 * pixels here. The architectural premise, SVG at scene scale with
 * transform-only viewport ops, is the one MR-2 validated live at 4k
 * on the structural edge overlay.
 *
 * Contract notes, per attribute:
 * - halo: a ring OUTSIDE the node silhouette (Ogma vocabulary),
 *   drawn as a stroked outline offset by half the ring width.
 * - donut: border-fraction arc segments (0..1, drawn in order)
 *   around the node's bounding circle; a ring regardless of node
 *   shape, the standard KeyLines/Ogma presentation.
 * - pulse: a CSS animation on the halo ring (opacity + radius),
 *   disabled under prefers-reduced-motion.
 * - taper: the Holten/van Wijk direction encoding: a filled
 *   quadrilateral wide at the source, narrow at the target; when a
 *   gradient is also set, the taper fill uses it.
 * - labelHalo: paint-order stroke (the native SVG mechanism the
 *   contract names).
 * - LOD: applied UPSTREAM (applyLod); this adapter renders exactly
 *   what the attributes say (labelVisible false = no label node).
 *
 * Pure presentational component: a function of (scene, resolved
 * attributes); defs are content-keyed so identical gradients share
 * one definition.
 */
import React, { useCallback, useMemo } from "react";
import { hitTestScene } from "@g3t/core";
import type { SceneHit, VisualAttributes } from "@g3t/core";
import {
  useElementPointerEvents,
  type ElementPointerHandlers,
} from "../../interaction/element-pointer-events";

export interface SvgSceneNode {
  id: string;
  /** CENTER, model units (Cytoscape position parity). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgSceneEdge {
  id: string;
  source: string;
  target: string;
}

export interface SvgAdapterProps extends ElementPointerHandlers<SceneHit> {
  nodes: readonly SvgSceneNode[];
  edges: readonly SvgSceneEdge[];
  resolved: ReadonlyMap<string, VisualAttributes>;
  width: number;
  height: number;
  /** Canvas background; defaults to transparent. */
  background?: string;
  "data-testid"?: string;
}

/** Trim a straight segment's endpoint back to an elliptical node
 *  boundary (plus margin), so edges meet silhouettes, not centers. */
export function trimToEllipse(
  from: { x: number; y: number },
  center: { x: number; y: number },
  rx: number,
  ry: number,
  margin = 0,
): { x: number; y: number } {
  const dx = from.x - center.x;
  const dy = from.y - center.y;
  const len = Math.hypot(dx / (rx + margin), dy / (ry + margin));
  if (len < 1e-9) return { x: center.x + rx + margin, y: center.y };
  return { x: center.x + dx / len, y: center.y + dy / len };
}

/** Donut segments as SVG arc dash specs over a circle of radius r:
 *  circumference-fraction dasharray with per-segment rotation. */
export function donutArcs(
  segments: readonly { fraction: number; color: string }[],
  r: number,
): { color: string; dasharray: string; rotate: number }[] {
  const c = 2 * Math.PI * r;
  const out: { color: string; dasharray: string; rotate: number }[] = [];
  let acc = 0;
  for (const seg of segments) {
    const frac = Math.max(0, Math.min(1, seg.fraction));
    if (frac <= 0) continue;
    out.push({
      color: seg.color,
      dasharray: `${frac * c} ${c}`,
      rotate: acc * 360 - 90, // segments start at 12 o'clock
    });
    acc += frac;
  }
  return out;
}

/** Tapered edge quadrilateral: wide at the source, narrow at the
 *  target (direction encoding). Returns polygon points. */
export function taperPolygon(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  wSource: number,
  wTarget: number,
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const h1 = wSource / 2;
  const h2 = wTarget / 2;
  const pts = [
    { x: p1.x + nx * h1, y: p1.y + ny * h1 },
    { x: p2.x + nx * h2, y: p2.y + ny * h2 },
    { x: p2.x - nx * h2, y: p2.y - ny * h2 },
    { x: p1.x - nx * h1, y: p1.y - ny * h1 },
  ];
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Node silhouette path/element parameters per shape. */
function shapeElement(
  n: SvgSceneNode,
  attrs: VisualAttributes,
  extraProps: Record<string, unknown>,
): React.ReactElement {
  const rx = n.width / 2;
  const ry = n.height / 2;
  const common = {
    fill: attrs.fill ?? "#ffffff",
    stroke: attrs.stroke ?? "#333333",
    strokeWidth: attrs.strokeWidth ?? 1,
    ...(attrs.strokeDash
      ? { strokeDasharray: attrs.strokeDash.join(" ") }
      : {}),
    ...extraProps,
  };
  switch (attrs.shape ?? "ellipse") {
    case "rectangle":
      return (
        <rect
          x={n.x - rx}
          y={n.y - ry}
          width={n.width}
          height={n.height}
          {...common}
        />
      );
    case "round-rectangle":
    case "pill": {
      const r = attrs.shape === "pill" ? ry : Math.min(6, rx, ry);
      return (
        <rect
          x={n.x - rx}
          y={n.y - ry}
          width={n.width}
          height={n.height}
          rx={r}
          ry={r}
          {...common}
        />
      );
    }
    case "diamond":
      return (
        <polygon
          points={`${n.x},${n.y - ry} ${n.x + rx},${n.y} ${n.x},${n.y + ry} ${n.x - rx},${n.y}`}
          {...common}
        />
      );
    case "triangle":
      return (
        <polygon
          points={`${n.x},${n.y - ry} ${n.x + rx},${n.y + ry} ${n.x - rx},${n.y + ry}`}
          {...common}
        />
      );
    case "hexagon": {
      const half = rx / 2;
      return (
        <polygon
          points={
            `${n.x - half},${n.y - ry} ${n.x + half},${n.y - ry} ` +
            `${n.x + rx},${n.y} ${n.x + half},${n.y + ry} ` +
            `${n.x - half},${n.y + ry} ${n.x - rx},${n.y}`
          }
          {...common}
        />
      );
    }
    case "ellipse":
    default:
      return <ellipse cx={n.x} cy={n.y} rx={rx} ry={ry} {...common} />;
  }
}

const GLYPH_SLOT: Record<string, { ux: number; uy: number }> = {
  "top-left": { ux: -0.7, uy: -0.7 },
  "top-right": { ux: 0.7, uy: -0.7 },
  "bottom-left": { ux: -0.7, uy: 0.7 },
  "bottom-right": { ux: 0.7, uy: 0.7 },
  top: { ux: 0, uy: -1 },
  bottom: { ux: 0, uy: 1 },
};

export function SvgAdapter({
  nodes,
  edges,
  resolved,
  width,
  height,
  background,
  "data-testid": testId,
  ...pointerHandlers
}: SvgAdapterProps): React.JSX.Element {
  const byId = useMemo(
    () => new Map(nodes.map((n) => [n.id, n] as const)),
    [nodes],
  );
  // INT-001: uniform element pointer events; no pan/zoom here, so
  // model space is element-local space.
  const hit = useCallback(
    (p: { x: number; y: number }) =>
      hitTestScene({ nodes, edges, resolved }, p),
    [nodes, edges, resolved],
  );
  const toModel = useCallback(
    (client: { x: number; y: number }, el: SVGSVGElement) => {
      const r = el.getBoundingClientRect();
      return { x: client.x - r.left, y: client.y - r.top };
    },
    [],
  );
  const pointerProps = useElementPointerEvents<SceneHit, SVGSVGElement>(
    hit,
    toModel,
    pointerHandlers,
  );

  // Content-keyed gradient defs: identical gradients share one def.
  const gradients = useMemo(() => {
    const defs = new Map<string, { from: string; to: string }>();
    for (const e of edges) {
      const g = resolved.get(e.id)?.gradient;
      if (g) defs.set(`g3t-grad-${g.from}-${g.to}`.replace(/[^\w-]/g, ""), g);
    }
    return defs;
  }, [edges, resolved]);

  return (
    <svg
      {...pointerProps}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-testid={testId}
      role="img"
      style={background ? { background } : undefined}
    >
      <style>{`
        .g3t-svg-pulse { animation: g3t-svg-pulse 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes g3t-svg-pulse { 0%,100% { opacity: 0.9; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.12); } }
        @media (prefers-reduced-motion: reduce) { .g3t-svg-pulse { animation: none; } }
      `}</style>
      <defs>
        {[...gradients.entries()].map(([id, g]) => (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={g.from} />
            <stop offset="1" stopColor={g.to} />
          </linearGradient>
        ))}
      </defs>

      {/* Edges under nodes. */}
      {edges.map((e) => {
        const a = resolved.get(e.id) ?? {};
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        if (!s || !t) return null;
        const p1 = trimToEllipse(
          { x: t.x, y: t.y },
          s,
          s.width / 2,
          s.height / 2,
        );
        const p2 = trimToEllipse(
          { x: s.x, y: s.y },
          t,
          t.width / 2,
          t.height / 2,
        );
        const gid = a.gradient
          ? `g3t-grad-${a.gradient.from}-${a.gradient.to}`.replace(
              /[^\w-]/g,
              "",
            )
          : null;
        const strokePaint = gid ? `url(#${gid})` : (a.stroke ?? "#666666");
        const w = a.strokeWidth ?? 1.5;
        const label =
          a.labelText !== undefined && a.labelVisible !== false ? (
            <text
              x={(p1.x + p2.x) / 2}
              y={(p1.y + p2.y) / 2 - 4}
              textAnchor="middle"
              fontSize={a.labelSize ?? 9}
              fill={a.labelColor ?? "#333333"}
              {...(a.labelHalo
                ? {
                    stroke: a.labelHalo.color,
                    strokeWidth: a.labelHalo.width,
                    paintOrder: "stroke" as const,
                  }
                : {})}
              data-svg-edge-label={e.id}
            >
              {a.labelText}
            </text>
          ) : null;
        if (a.taper) {
          return (
            <g key={e.id} data-svg-edge={e.id} opacity={a.opacity ?? 1}>
              <polygon
                points={taperPolygon(p1, p2, Math.max(w * 3, 6), 1)}
                fill={strokePaint}
                data-svg-taper={e.id}
              />
              {label}
            </g>
          );
        }
        return (
          <g key={e.id} data-svg-edge={e.id} opacity={a.opacity ?? 1}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={strokePaint}
              strokeWidth={w}
              {...(a.strokeDash
                ? { strokeDasharray: a.strokeDash.join(" ") }
                : {})}
            />
            {label}
          </g>
        );
      })}

      {/* Nodes. */}
      {nodes.map((n) => {
        const a = resolved.get(n.id) ?? {};
        const rx = n.width / 2;
        const ry = n.height / 2;
        const rMax = Math.max(rx, ry);
        return (
          <g key={n.id} data-svg-node={n.id} opacity={a.opacity ?? 1}>
            {a.halo && (
              <ellipse
                cx={n.x}
                cy={n.y}
                rx={rx + a.halo.width / 2 + 2}
                ry={ry + a.halo.width / 2 + 2}
                fill="none"
                stroke={a.halo.color}
                strokeWidth={a.halo.width}
                opacity={a.halo.opacity ?? 0.55}
                className={a.pulse ? "g3t-svg-pulse" : undefined}
                data-svg-halo={n.id}
              />
            )}
            {shapeElement(n, a, {})}
            {a.donut && a.donut.length > 0 && (
              <g data-svg-donut={n.id}>
                {donutArcs(a.donut, rMax + 4).map((arc, i) => (
                  <circle
                    key={i}
                    data-svg-donut-arc={`${n.id}:${i}`}
                    cx={n.x}
                    cy={n.y}
                    r={rMax + 4}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={3}
                    strokeDasharray={arc.dasharray}
                    transform={`rotate(${arc.rotate} ${n.x} ${n.y})`}
                  />
                ))}
              </g>
            )}
            {a.labelText !== undefined && a.labelVisible !== false && (
              <text
                x={n.x}
                y={n.y + ry + (a.labelSize ?? 12)}
                textAnchor="middle"
                fontSize={a.labelSize ?? 12}
                fill={a.labelColor ?? "#212529"}
                {...(a.labelHalo
                  ? {
                      stroke: a.labelHalo.color,
                      strokeWidth: a.labelHalo.width,
                      paintOrder: "stroke" as const,
                    }
                  : {})}
                data-svg-label={n.id}
              >
                {a.labelText}
              </text>
            )}
            {(a.glyphs ?? []).map((gl, i) => {
              const slot = GLYPH_SLOT[gl.slot] ?? { ux: 0.7, uy: -0.7 };
              const gx = n.x + slot.ux * rx;
              const gy = n.y + slot.uy * ry;
              const text = (gl.text ?? "").slice(0, 3);
              return (
                <g key={i} data-svg-glyph={`${n.id}:${gl.slot}`}>
                  <circle
                    cx={gx}
                    cy={gy}
                    r={7}
                    fill={gl.fill ?? "#e03131"}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <text
                    x={gx}
                    y={gy + 3}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill={gl.color ?? "#ffffff"}
                  >
                    {text}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
