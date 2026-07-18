/**
 * Canvas 2D display list (G3L:RND-004 stage 1; ARC-008).
 *
 * The Canvas adapter's core is PURE: `buildDisplayList` consumes the
 * IDENTICAL scene contract the SVG adapter consumes (SvgSceneNode[]
 * + SvgSceneEdge[] + resolved VisualAttributes) and emits an ordered
 * list of draw operations. The React component merely replays ops
 * onto a 2D context. Purity is what makes the ARC-008 conformance
 * suite headless for canvas: the suite asserts the SAME semantic
 * facts against the SVG adapter's DOM and this adapter's ops.
 *
 * Capability honesty (the multi-renderer doctrine): this adapter
 * declares pulse as "static" (the halo draws, nothing animates in
 * stage 1) and the conformance suite VERIFIES the declaration
 * instead of letting the claim drift from behavior. Stage 2 (bitmap
 * caching, snapshot transforms, interaction simplification, full
 * HiDPI story per RND-004) builds on this op stream.
 */
import type { VisualAttributes } from "@g3t/core";
import {
  donutArcs,
  taperPolygon,
  trimToEllipse,
  type SvgSceneEdge,
  type SvgSceneNode,
} from "../svg/svg-adapter";

export type DrawOp =
  | {
      kind: "halo";
      id: string;
      x: number;
      y: number;
      rx: number;
      ry: number;
      color: string;
      width: number;
      /** Stage 1 renders pulse halos statically; recorded per op so
       *  the conformance suite can verify the capability claim. */
      pulseStatic: boolean;
    }
  | {
      kind: "shape";
      id: string;
      shape: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
      dash?: readonly number[];
      gradient?: { from: string; to: string };
      opacity?: number;
    }
  | {
      kind: "donut-arc";
      id: string;
      cx: number;
      cy: number;
      r: number;
      startAngle: number;
      endAngle: number;
      color: string;
    }
  | {
      kind: "glyph";
      id: string;
      x: number;
      y: number;
      text: string;
      size: number;
    }
  | {
      kind: "edge";
      id: string;
      points: readonly { x: number; y: number }[];
      stroke: string;
      width: number;
      dash?: readonly number[];
      gradient?: { from: string; to: string };
    }
  | {
      kind: "taper";
      id: string;
      points: readonly { x: number; y: number }[];
      fill: string;
      /** Gradient along the edge direction; outranks fill when set
       *  (SVG parity: the taper polygon takes the stroke paint,
       *  which is the gradient for gradient edges). */
      gradient?: { from: string; to: string };
      p1: { x: number; y: number };
      p2: { x: number; y: number };
    }
  | {
      kind: "label";
      id: string;
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      halo?: { color: string; width: number };
    };

export interface CanvasScene {
  nodes: readonly SvgSceneNode[];
  edges: readonly SvgSceneEdge[];
  resolved: ReadonlyMap<string, VisualAttributes>;
}

export function buildDisplayList(scene: CanvasScene): DrawOp[] {
  const ops: DrawOp[] = [];
  const byId = new Map(scene.nodes.map((n) => [n.id, n] as const));

  // Halos first (under everything), matching the SVG adapter's
  // paint order.
  for (const n of scene.nodes) {
    const a = scene.resolved.get(n.id);
    if (!a?.halo) continue;
    ops.push({
      kind: "halo",
      id: n.id,
      x: n.x,
      y: n.y,
      rx: n.width / 2 + (a.halo.width ?? 6),
      ry: n.height / 2 + (a.halo.width ?? 6),
      color: a.halo.color,
      width: a.halo.width ?? 6,
      pulseStatic: a.pulse === true,
    });
  }

  // Edges beneath nodes: straight center-to-center segments trimmed
  // to elliptical silhouettes (SVG adapter parity), tapered edges as
  // filled polygons.
  for (const e of scene.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    const a = scene.resolved.get(e.id) ?? {};
    // Trim each endpoint back to the OTHER node's silhouette
    // (SVG adapter parity: segment from source silhouette to target
    // silhouette).
    const p1 = trimToEllipse(t, s, s.width / 2, s.height / 2, 2);
    const p2 = trimToEllipse(s, t, t.width / 2, t.height / 2, 2);
    if (a.taper) {
      const poly = taperPolygon(p1, p2, (a.strokeWidth ?? 2) * 3, 1);
      ops.push({
        kind: "taper",
        id: e.id,
        points: poly.split(" ").map((pair) => {
          const [x, y] = pair.split(",");
          return { x: Number(x), y: Number(y) };
        }),
        fill: a.stroke ?? "#94a3b8",
        ...(a.gradient
          ? { gradient: { from: a.gradient.from, to: a.gradient.to } }
          : {}),
        p1,
        p2,
      });
      continue;
    }
    ops.push({
      kind: "edge",
      id: e.id,
      points: [p1, p2],
      stroke: a.stroke ?? "#94a3b8",
      width: a.strokeWidth ?? 1.5,
      ...(a.strokeDash ? { dash: a.strokeDash } : {}),
      ...(a.gradient
        ? { gradient: { from: a.gradient.from, to: a.gradient.to } }
        : {}),
    });
  }

  // Node bodies.
  for (const n of scene.nodes) {
    const a = scene.resolved.get(n.id) ?? {};
    ops.push({
      kind: "shape",
      id: n.id,
      shape: a.shape ?? "ellipse",
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      fill: a.fill ?? "#ffffff",
      stroke: a.stroke ?? "#333333",
      strokeWidth: a.strokeWidth ?? 1,
      ...(a.strokeDash ? { dash: a.strokeDash } : {}),
      ...(a.gradient
        ? { gradient: { from: a.gradient.from, to: a.gradient.to } }
        : {}),
      ...(a.opacity !== undefined ? { opacity: a.opacity } : {}),
    });
    // Donut arcs ride the node's outer radius (SVG parity: rMax+4).
    if (a.donut && a.donut.length > 0) {
      // SVG parity: arcs on radius rMax+4, segments from 12 o'clock.
      // The dash-spec form converts to angles for canvas arc().
      const r = Math.max(n.width, n.height) / 2 + 4;
      const c = 2 * Math.PI * r;
      for (const arc of donutArcs(a.donut, r)) {
        const sweepLen = Number(arc.dasharray.split(" ")[0] ?? 0);
        const start = ((arc.rotate + 90) * Math.PI) / 180 - Math.PI / 2;
        ops.push({
          kind: "donut-arc",
          id: n.id,
          cx: n.x,
          cy: n.y,
          r,
          startAngle: start,
          endAngle: start + (sweepLen / c) * 2 * Math.PI,
          color: arc.color,
        });
      }
    }
    for (const g of a.glyphs ?? []) {
      const slot = GLYPH_SLOT[g.slot ?? "top-right"] ?? GLYPH_SLOT["top-right"];
      if (!slot) continue;
      ops.push({
        kind: "glyph",
        id: n.id,
        x: n.x + slot.ux * (n.width / 2),
        y: n.y + slot.uy * (n.height / 2),
        text: (g.text ?? "").slice(0, 3),
        size: 9,
      });
    }
  }

  // Labels last (over everything), honoring visibility.
  for (const n of scene.nodes) {
    const a = scene.resolved.get(n.id);
    if (!a?.labelText || a.labelVisible === false) continue;
    ops.push({
      kind: "label",
      id: n.id,
      x: n.x,
      y: n.y + n.height / 2 + 12,
      text: a.labelText,
      size: a.labelSize ?? 11,
      color: a.labelColor ?? "#212529",
      ...(a.labelHalo ? { halo: a.labelHalo } : {}),
    });
  }

  return ops;
}

const GLYPH_SLOT: Record<string, { ux: number; uy: number }> = {
  "top-left": { ux: -0.7, uy: -0.7 },
  "top-right": { ux: 0.7, uy: -0.7 },
  "bottom-left": { ux: -0.7, uy: 0.7 },
  "bottom-right": { ux: 0.7, uy: 0.7 },
  top: { ux: 0, uy: -1 },
  bottom: { ux: 0, uy: 1 },
};

/** ARC-008 capability declaration (verified by the conformance
 *  suite, not merely asserted). */
export const CANVAS_ADAPTER_CAPABILITIES = {
  pulseAnimation: "static" as const,
  gradients: true,
  glyphs: true,
  donut: true,
  taper: true,
  labelHalo: true,
};
