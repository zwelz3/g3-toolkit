/**
 * VisualAttributes -> Cytoscape projection (the first CONSUMER of the
 * style engine's output, and the Style Lab's engine-pane mechanism).
 *
 * Projects the renderer-neutral contract onto per-element Cytoscape
 * STYLE BYPASSES (element.style(...)), which outrank every stylesheet
 * rule: when the engine drives a pane, the engine's values are what
 * renders, with no selector arbitration underneath (G3L:ARC-008's
 * adapter posture, scoped to what Cytoscape can express).
 *
 * Honesty contract: Cytoscape cannot express every VisualAttribute.
 * The projection returns, alongside the bypass, the keys it could NOT
 * express (`unsupported`: halo, glyphs, donut, pulse, taper,
 * gradient) and the keys it approximated (`approximated`: pill as
 * round-rectangle). The Style Lab surfaces both lists instead of
 * silently dropping them; rendering those primitives is the F1 SVG
 * adapter's job (G3L:RND-001), not this bridge's.
 */
import type { Core } from "cytoscape";
import type {
  ArrowKind,
  NodeShape,
  VisualAttributeKey,
  VisualAttributes,
} from "@g3t/core";

export interface CyProjection {
  /** Cytoscape style bypass object for element.style(...). */
  style: Record<string, string | number>;
  /** Attribute keys present on the input that Cytoscape cannot express. */
  unsupported: VisualAttributeKey[];
  /** Attribute keys expressed with a documented approximation. */
  approximated: VisualAttributeKey[];
}

const NODE_SHAPE_MAP: Record<NodeShape, { shape: string; approx: boolean }> = {
  rectangle: { shape: "rectangle", approx: false },
  "round-rectangle": { shape: "round-rectangle", approx: false },
  ellipse: { shape: "ellipse", approx: false },
  diamond: { shape: "diamond", approx: false },
  hexagon: { shape: "hexagon", approx: false },
  triangle: { shape: "triangle", approx: false },
  // Cytoscape has no capsule shape; round-rectangle is the standing
  // approximation until the F1 SVG adapter renders true pills.
  pill: { shape: "round-rectangle", approx: true },
};

function arrowTo(kind: ArrowKind): {
  shape: string;
  fill: "filled" | "hollow";
} {
  switch (kind) {
    case "triangle":
      return { shape: "triangle", fill: "filled" };
    case "triangle-hollow":
      return { shape: "triangle", fill: "hollow" };
    case "diamond":
      return { shape: "diamond", fill: "filled" };
    case "diamond-hollow":
      return { shape: "diamond", fill: "hollow" };
    case "vee":
      return { shape: "vee", fill: "filled" };
    case "none":
    default:
      return { shape: "none", fill: "filled" };
  }
}

const NODE_UNSUPPORTED: readonly VisualAttributeKey[] = [
  "halo",
  "glyphs",
  "donut",
  "pulse",
];
const EDGE_UNSUPPORTED: readonly VisualAttributeKey[] = ["taper", "gradient"];

/** Project node attributes to a Cytoscape bypass. */
export function nodeAttributesToCy(attrs: VisualAttributes): CyProjection {
  const style: Record<string, string | number> = {};
  const unsupported: VisualAttributeKey[] = [];
  const approximated: VisualAttributeKey[] = [];

  if (attrs.fill !== undefined) style["background-color"] = attrs.fill;
  if (attrs.stroke !== undefined) style["border-color"] = attrs.stroke;
  if (attrs.strokeWidth !== undefined)
    style["border-width"] = attrs.strokeWidth;
  if (attrs.opacity !== undefined) style["opacity"] = attrs.opacity;
  if (attrs.shape !== undefined) {
    const mapped = NODE_SHAPE_MAP[attrs.shape];
    style["shape"] = mapped.shape;
    if (mapped.approx) approximated.push("shape");
  }
  if (attrs.labelText !== undefined) style["label"] = attrs.labelText;
  if (attrs.labelColor !== undefined) style["color"] = attrs.labelColor;
  if (attrs.labelSize !== undefined) style["font-size"] = attrs.labelSize;
  if (attrs.labelVisible === false) style["text-opacity"] = 0;
  if (attrs.labelHalo !== undefined) {
    style["text-outline-color"] = attrs.labelHalo.color;
    style["text-outline-width"] = attrs.labelHalo.width;
  }

  for (const key of NODE_UNSUPPORTED) {
    if (attrs[key] !== undefined) unsupported.push(key);
  }
  return { style, unsupported, approximated };
}

/** Project edge attributes to a Cytoscape bypass. */
export function edgeAttributesToCy(attrs: VisualAttributes): CyProjection {
  const style: Record<string, string | number> = {};
  const unsupported: VisualAttributeKey[] = [];
  const approximated: VisualAttributeKey[] = [];

  if (attrs.stroke !== undefined) {
    style["line-color"] = attrs.stroke;
    style["target-arrow-color"] = attrs.stroke;
    style["source-arrow-color"] = attrs.stroke;
  }
  if (attrs.strokeWidth !== undefined) style["width"] = attrs.strokeWidth;
  if (attrs.opacity !== undefined) style["opacity"] = attrs.opacity;
  if (attrs.strokeDash !== undefined) {
    style["line-style"] = "dashed";
    style["line-dash-pattern"] = attrs.strokeDash.join(" ");
  }
  if (attrs.arrowTarget !== undefined) {
    const a = arrowTo(attrs.arrowTarget);
    style["target-arrow-shape"] = a.shape;
    style["target-arrow-fill"] = a.fill;
  }
  if (attrs.arrowSource !== undefined) {
    const a = arrowTo(attrs.arrowSource);
    style["source-arrow-shape"] = a.shape;
    style["source-arrow-fill"] = a.fill;
  }
  if (attrs.labelText !== undefined) style["label"] = attrs.labelText;
  if (attrs.labelColor !== undefined) style["color"] = attrs.labelColor;
  if (attrs.labelSize !== undefined) style["font-size"] = attrs.labelSize;
  if (attrs.labelVisible === false) style["text-opacity"] = 0;
  if (attrs.labelHalo !== undefined) {
    style["text-outline-color"] = attrs.labelHalo.color;
    style["text-outline-width"] = attrs.labelHalo.width;
  }

  for (const key of EDGE_UNSUPPORTED) {
    if (attrs[key] !== undefined) unsupported.push(key);
  }
  return { style, unsupported, approximated };
}

/**
 * Apply engine-resolved attributes to a live Cytoscape instance as
 * per-element bypasses. Returns the honesty report per element id so
 * a surface can show what Cytoscape could not express.
 */
export function applyVisualAttributes(
  cy: Core,
  resolved: ReadonlyMap<string, VisualAttributes>,
  options?: {
    /** Clear each element's existing bypasses before applying. A
     *  re-application whose attribute set SHRANK (e.g. an LOD tier
     *  transition back toward full detail) must reset, or channels
     *  the coarser tier set (text-opacity, opacity) persist as stale
     *  bypasses: the projection only writes keys that are present.
     *  Callers sharing bypass ownership with other writers (the
     *  routed-segment bypass on structural edges) should NOT reset
     *  blindly; the Style Lab's engine pane owns all its bypasses. */
    resetFirst?: boolean;
  },
): Map<string, Pick<CyProjection, "unsupported" | "approximated">> {
  const report = new Map<
    string,
    Pick<CyProjection, "unsupported" | "approximated">
  >();
  for (const [id, attrs] of resolved) {
    const ele = cy.$id(id);
    if (ele.length === 0) continue;
    const projection = ele.isNode()
      ? nodeAttributesToCy(attrs)
      : edgeAttributesToCy(attrs);
    if (options?.resetFirst) ele.removeStyle();
    ele.style(projection.style);
    if (
      projection.unsupported.length > 0 ||
      projection.approximated.length > 0
    ) {
      report.set(id, {
        unsupported: projection.unsupported,
        approximated: projection.approximated,
      });
    }
  }
  return report;
}
