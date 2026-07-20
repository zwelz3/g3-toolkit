/**
 * VisualAttributes (G3L:ARC-002): the renderer-neutral, flat visual
 * description of one element, the OUTPUT contract of style
 * resolution. Renderer adapters consume this and own only drawing and
 * hit testing; nothing here names SVG, Canvas, Cytoscape, or the DOM.
 *
 * Field groups:
 * - box/shaft basics (fill, stroke, width, dash, opacity, shape, icon)
 * - labels (text, color, size, visibility: the LOD hook, G3L:LBL-003)
 * - decoration primitives (glyphs, halo, donut, pulse: G3L:NOD-007,
 *   compositional attributes, never custom node types)
 * - edge direction encodings (arrowheads INCLUDING the UML set,
 *   tapered width, source-to-target gradient: G3L:STY-008)
 * - lodTier (which detail tier an adapter should draw, G3L:STY-010/011)
 *
 * Invalidation granularity (G3L:STY-004) is per TOP-LEVEL key of this
 * interface: rule `outputs` declare these keys. Nested-path outputs
 * (e.g. one glyph slot) are a documented later refinement; v1 treats
 * each decoration list as one key.
 */

export type NodeShape =
  | "rectangle"
  | "round-rectangle"
  | "ellipse"
  | "diamond"
  | "hexagon"
  | "triangle"
  | "pill";

export type ArrowKind =
  | "none"
  | "triangle"
  | "triangle-hollow"
  | "diamond"
  | "diamond-hollow"
  | "vee";

export interface Glyph {
  /** Boundary slot, KeyLines/Ogma vocabulary. */
  slot:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "top"
    | "bottom";
  /** Text content (short: counts, status letters); truncation is the
   *  adapter's job with ellipsis. */
  text?: string;
  /** Icon reference into the registered icon set. */
  icon?: string;
  fill?: string;
  color?: string;
}

export interface Halo {
  color: string;
  /** Ring width in model units. */
  width: number;
  opacity?: number;
}

export interface DonutSegment {
  /** Fraction of the border, 0..1; segments drawn in order. */
  fraction: number;
  color: string;
}

export interface EdgeGradient {
  from: string;
  to: string;
}

export interface VisualAttributes {
  // Box / shaft
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Dash pattern in model units; undefined = solid. */
  strokeDash?: readonly number[];
  opacity?: number;
  shape?: NodeShape;
  /** Icon reference into the registered icon set (G3L:NOD-003). */
  icon?: string;

  // Label
  labelText?: string;
  labelColor?: string;
  labelSize?: number;
  labelVisible?: boolean;
  /** Halo/outline behind label text (G3L:LBL-002); renderers express
   *  it natively (SVG paint-order stroke, Cytoscape text-outline,
   *  SDF distance band). */
  labelHalo?: { color: string; width: number };

  // Decorations (G3L:NOD-007)
  glyphs?: readonly Glyph[];
  halo?: Halo;
  donut?: readonly DonutSegment[];
  pulse?: boolean;

  // Edge direction encodings (G3L:STY-008)
  arrowSource?: ArrowKind;
  arrowTarget?: ArrowKind;
  /** Tapered width: wide at source, narrow at target (the
   *  Holten/van Wijk-preferred direction encoding). */
  taper?: boolean;
  gradient?: EdgeGradient;

  // LOD
  lodTier?: number;
}

/** The top-level attribute keys, the invalidation vocabulary. */
export type VisualAttributeKey = keyof VisualAttributes;

/** Merge b over a (top-level keys; later wins). Pure. */
export function mergeAttributes(
  a: Readonly<Partial<VisualAttributes>>,
  b: Readonly<Partial<VisualAttributes>>,
): Partial<VisualAttributes> {
  const out: Partial<VisualAttributes> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
