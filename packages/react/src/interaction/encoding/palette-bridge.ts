/**
 * Single import point for palette/scale primitives used by the
 * encoding spec, so encoding-spec.ts has no opinion about where they
 * live (the canvas palette and theme utilities have moved before).
 */
// Aliased as OKABE_ITO until 2026-08. That made `OKABE_ITO` mean the
// canvas palette here and core's unmodified one everywhere else, and
// the two differ in their last entry (grey versus black), so the name
// hid a value difference rather than a spelling one.
export { OKABE_ITO_COLORS as CANVAS_CATEGORICAL } from "../../views/canvas/palette";
export { SEQUENTIAL_SCALE, DIVERGING_SCALE, scaleColor } from "@g3t/core";
// NOT core's. This alias said "Core" while re-exporting the REACT
// implementation, which is the null-returning one. Exported under its
// real name now; the encoding warning wants the null-tolerant behavior
// because a custom palette entry may not be plain hex.
export { contrastRatioOrNull } from "../../theme/ThemeManager";
export { NODE_SHAPES } from "../../views/canvas/palette";
