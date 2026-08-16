/**
 * R-12a (round 21, 2026-08-05): the structural counterpart of
 * overridesToCytoscapeStyles. The override MODEL is
 * renderer-neutral; only its appliers are not, and until now
 * cytoscape had the only one, so the same reader could recolour an
 * element on the canvas and not on the structural surfaces showing
 * the model's own diagrams.
 *
 * PRECEDENCE, stated because the request asked for it explicitly:
 *
 *   rowSeverities  >  override  >  theme
 *
 * A violation tint is a CORRECTNESS signal and outranks a
 * preference; a preference outranks the default. The view applies
 * severity after these values for exactly that reason.
 *
 * Geometry is deliberately NOT resolved here: `size` is layout
 * input, not presentation, and is handled by the view's
 * geometry-change channel (12c).
 */
import type { NodeStyleOverride } from "./style-override";

/** Every channel the override model can express. */
export type StyleChannel =
  | "color"
  | "shape"
  | "size"
  | "icon"
  | "labelField"
  | "borderColor"
  | "borderWidth"
  | "opacity";

/**
 * R-16 (register, 2026-08-06): what each renderer can actually
 * APPLY. Editors gate their controls on this rather than one
 * channel at a time as each inapplicable one is reported, and the
 * applier emits nothing outside it.
 *
 * The structural list is short and honest: the SVG view paints
 * fill, stroke, stroke width and opacity from these. It has no
 * shape (boxes are geometry), no size (geometry is layout input,
 * R-12c), and it draws neither icons nor redirected labels. An
 * earlier revision of StructuralNodeStyle carried icon and
 * labelField, which nothing applied: the same over-promise as an
 * inert control, one layer down.
 */
export const STRUCTURAL_STYLE_CHANNELS: readonly StyleChannel[] = [
  "color",
  "borderColor",
  "borderWidth",
  "opacity",
];

export const CANVAS_STYLE_CHANNELS: readonly StyleChannel[] = [
  "color",
  "shape",
  "size",
  "icon",
  "labelField",
  "borderColor",
  "borderWidth",
  "opacity",
];

/** The presentational attributes a structural element can take.
 *  One field per channel in STRUCTURAL_STYLE_CHANNELS. */
export interface StructuralNodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

/**
 * Resolves the overrides that apply to each element id. Node-scoped
 * overrides beat type-scoped ones for the same element, matching
 * the cytoscape applier's specificity.
 */
export function overridesToStructuralStyles(
  overrides: readonly NodeStyleOverride[],
  typesOf?: (id: string) => readonly string[] | undefined,
  ids?: readonly string[],
): Map<string, StructuralNodeStyle> {
  const out = new Map<string, StructuralNodeStyle>();
  const toStyle = (o: NodeStyleOverride): StructuralNodeStyle => ({
    ...(o.color !== undefined ? { fill: o.color } : {}),
    ...(o.borderColor !== undefined ? { stroke: o.borderColor } : {}),
    ...(o.borderWidth !== undefined ? { strokeWidth: o.borderWidth } : {}),
    ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
    // icon and labelField are deliberately NOT emitted: the
    // structural view applies neither, and a field nothing reads is
    // an over-promise (R-16).
  });

  // Type scopes first, so a node scope for the same id overwrites.
  if (ids !== undefined && typesOf !== undefined) {
    const byType = new Map<string, NodeStyleOverride>();
    for (const o of overrides) {
      if ("type" in o.scope) byType.set(o.scope.type, o);
    }
    if (byType.size > 0) {
      for (const id of ids) {
        for (const t of typesOf(id) ?? []) {
          const o = byType.get(t);
          if (o !== undefined) {
            out.set(id, { ...(out.get(id) ?? {}), ...toStyle(o) });
          }
        }
      }
    }
  }
  for (const o of overrides) {
    if ("nodeId" in o.scope) {
      out.set(o.scope.nodeId, {
        ...(out.get(o.scope.nodeId) ?? {}),
        ...toStyle(o),
      });
    }
  }
  return out;
}
