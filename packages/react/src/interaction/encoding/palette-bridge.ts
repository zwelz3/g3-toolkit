/**
 * Single import point for palette/scale primitives used by the
 * encoding spec, so encoding-spec.ts has no opinion about where they
 * live (the canvas palette and theme utilities have moved before).
 */
export { OKABE_ITO_COLORS as OKABE_ITO } from "../../views/canvas/palette";
export { SEQUENTIAL_SCALE, DIVERGING_SCALE, scaleColor } from "@g3t/core";
export { contrastRatio as contrastRatioCore } from "../../theme/ThemeManager";
export { NODE_SHAPES } from "../../views/canvas/palette";
