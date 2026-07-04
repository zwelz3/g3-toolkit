/**
 * Spec -> canvas application (the milestone named in
 * roadmap/design/encoding-controls.md): compute per-element visual
 * data patches from an EncodingSpec using the SAME resolvers the
 * panel preview renders through, for the canvas's data-mapped
 * stylesheet (nodes: _color/_size/label; edges: _ecolor/_ewidth/label
 * via attribute-presence rules).
 *
 * Precedence honored by construction: a channel ABSENT from the spec
 * produces no field, so the legacy defaults (type palette, fixed edge
 * style) keep owning anything the spec does not claim. Reserved
 * channels never appear here at all: selection, inference dash, and
 * overlay emphasis are applied by their owners downstream of this
 * patch.
 *
 * node.icon travels as an SVG data URI (string-markup registry icons
 * only; component icons degrade to panel/legend surfaces). node.shape
 * is the paired-redundancy channel: see the pairing warning in the
 * panel and the rule in the design doc.
 */

import type { UGM } from "@g3t/core";
import { getIcon } from "../../icons";
import {
  makeColorResolver,
  makeIconResolver,
  makeShapeResolver,
  makeSizeResolver,
  type ElementAttrs,
  type EncodingSpec,
} from "./encoding-spec";

/** Build a Cytoscape-consumable data URI for a registered icon. Only
 *  string-markup icons can travel as background-image; component
 *  icons (an allowed registry form) stay panel/legend-only and return
 *  undefined here so the channel degrades, never breaks. Stroke is
 *  white to match the preview's glyph treatment on colored fills. */
/**
 * Is this icon-channel value already a usable image reference (a data:
 * URI, an http(s) URL, or a path/file ending in a known image
 * extension) rather than a registry icon name? Such values are stamped
 * onto the node background-image as-is.
 */
export function isImageRef(value: string): boolean {
  return (
    /^data:image\//i.test(value) ||
    /^https?:\/\//i.test(value) ||
    /^\/?\S+\.(png|jpe?g|webp|gif|svg)(\?\S*)?$/i.test(value)
  );
}

export function iconDataUri(
  name: string,
  stroke = "#ffffff",
): string | undefined {
  const renderer = getIcon(name);
  if (!renderer || renderer.kind !== "paths") return undefined;
  const markup = renderer.markup;
  // Explicit width/height matter (round-19 finding): an SVG data URI
  // with only a viewBox has no intrinsic size, and browsers rasterize
  // it unpredictably (tiny, blurry, or absent). 64px intrinsic keeps
  // glyphs crisp through canvas zoom.
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" ' +
    'viewBox="0 0 24 24" ' +
    `fill="none" stroke="${stroke}" stroke-width="1.75" ` +
    'stroke-linecap="round" stroke-linejoin="round">' +
    markup +
    "</svg>";
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Relative luminance of a #rrggbb color (WCAG formula, linearized).
 *  Used to pick a glyph color that survives its node fill: white
 *  vanished on the light half of okabe-ito (round-19 finding). */
export function glyphStrokeFor(fill: string | undefined): string {
  if (!fill || !/^#[0-9a-fA-F]{6}$/.test(fill)) return "#ffffff";
  const channel = (i: number) => {
    const c = parseInt(fill.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Pick whichever candidate wins on WCAG contrast ratio against the
  // fill (no arbitrary threshold): white = (1.05)/(L+0.05), dark
  // #1a1a1a (L~0.0117) = (L+0.05)/0.0617. Crossover sits near
  // L=0.205, which correctly sends okabe's light blue and orange to
  // the dark glyph.
  const contrastWhite = 1.05 / (luminance + 0.05);
  const contrastDark = (luminance + 0.05) / 0.0617;
  return contrastDark >= contrastWhite ? "#1a1a1a" : "#ffffff";
}

export interface NodeVisualPatch {
  _color?: string;
  _size?: number;
  _icon?: string;
  _shape?: string;
  label?: string;
}

export interface EdgeVisualPatch {
  _ecolor?: string;
  _ewidth?: number;
  label?: string;
}

export interface EncodingPatch {
  nodes: Map<string, NodeVisualPatch>;
  edges: Map<string, EdgeVisualPatch>;
}

function labelFor(
  driver: string | undefined,
  attrs: ElementAttrs,
): string | undefined {
  if (!driver) return undefined;
  const v =
    driver === "types"
      ? attrs.types?.[0]
      : driver === "type" && attrs.type !== undefined
        ? attrs.type
        : attrs.properties[driver];
  return v === undefined || v === null ? "" : String(v);
}

/** Compute the element-data patch for the whole graph. Pure: no
 *  Cytoscape types, no DOM; thoroughly unit-testable. */
export function applyEncodingSpec(spec: EncodingSpec, ugm: UGM): EncodingPatch {
  const ctx = { ugm };
  const nodeColor = spec.node.color
    ? makeColorResolver(spec.node.color, ctx, "node")
    : null;
  const nodeSize = spec.node.size
    ? makeSizeResolver(spec.node.size, ctx, "node")
    : null;
  const nodeIcon = spec.node.icon ? makeIconResolver(spec.node.icon) : null;
  const nodeShape = spec.node.shape ? makeShapeResolver(spec.node.shape) : null;
  const nodeLabelDriver = (spec.node.label as { driver?: string } | undefined)
    ?.driver;
  const edgeColor = spec.edge.color
    ? makeColorResolver(spec.edge.color, ctx, "edge")
    : null;
  const edgeWidth = spec.edge.width
    ? makeSizeResolver(spec.edge.width, ctx, "edge")
    : null;
  const edgeLabelDriver = (spec.edge.label as { driver?: string } | undefined)
    ?.driver;

  const nodes = new Map<string, NodeVisualPatch>();
  ugm.forEachNode((id, attrs) => {
    const patch: NodeVisualPatch = {};
    if (nodeColor) {
      const c = nodeColor(attrs);
      if (c !== undefined) patch._color = c;
    }
    if (nodeSize) {
      const s = nodeSize(attrs);
      if (s !== undefined) patch._size = Math.round(s);
    }
    if (nodeIcon) {
      const name = nodeIcon(attrs);
      // The icon channel value may be EITHER a registry icon name (an
      // SVG "paths" glyph, recolored to follow the node fill) OR a
      // ready-to-use image reference: a data: URI or an http(s)/relative
      // URL pointing at a raster logo (PNG/JPG/WebP) or a pre-built SVG.
      // Raster logos cannot be recolored, so pass image references
      // through untouched; only registry names go through iconDataUri.
      const uri = name
        ? isImageRef(name)
          ? name
          : iconDataUri(name, glyphStrokeFor(patch._color))
        : undefined;
      if (uri !== undefined) patch._icon = uri;
    }
    if (nodeShape) {
      const s = nodeShape(attrs);
      if (s !== undefined) patch._shape = s;
    }
    if (nodeLabelDriver !== undefined) {
      const l = labelFor(nodeLabelDriver, attrs);
      if (l !== undefined) patch.label = l;
    }
    if (Object.keys(patch).length > 0) nodes.set(id, patch);
  });

  const edges = new Map<string, EdgeVisualPatch>();
  ugm.forEachEdge((id, attrs) => {
    const a = attrs as ElementAttrs;
    const patch: EdgeVisualPatch = {};
    if (edgeColor) {
      const c = edgeColor(a);
      if (c !== undefined) patch._ecolor = c;
    }
    if (edgeWidth) {
      const w = edgeWidth(a);
      if (w !== undefined) patch._ewidth = Math.round(w * 10) / 10;
    }
    if (edgeLabelDriver !== undefined) {
      const l = labelFor(edgeLabelDriver, a);
      if (l !== undefined) patch.label = l;
    }
    if (Object.keys(patch).length > 0) edges.set(id, patch);
  });

  return { nodes, edges };
}
