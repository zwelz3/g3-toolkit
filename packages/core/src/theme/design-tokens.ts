/**
 * Design tokens: spacing, typography, shadows, radii, transitions.
 *
 * These extend the color-only G3tTheme with the spatial and
 * typographic constants needed for a polished UI. Injected as
 * CSS custom properties alongside the color tokens.
 */

export const DESIGN_TOKENS = {
  // Typography
  fontFamily:
    "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono: "'IBM Plex Mono', 'Fira Code', 'Consolas', monospace",
  // Type scale in rem (A6, design-system roadmap): px sizes defeat
  // browser-zoom text scaling. Floor raised: the old 10px xs was
  // below comfortable density even for data UI; 11px-equivalent is
  // the minimum. At the default 16px root these resolve to
  // 11 / 12 / 13 / 15 / 18 px.
  fontSizeXs: "0.6875rem",
  fontSizeSm: "0.75rem",
  fontSizeMd: "0.8125rem",
  fontSizeLg: "0.9375rem",
  fontSizeXl: "1.125rem",
  fontWeight: "400",
  fontWeightMedium: "500",
  fontWeightSemibold: "600",
  lineHeight: "1.5",

  // Spacing (4px grid)
  space1: "4px",
  space2: "8px",
  space3: "12px",
  space4: "16px",
  space5: "20px",
  space6: "24px",
  space8: "32px",

  // Radii
  radiusSm: "4px",
  radiusMd: "6px",
  radiusLg: "8px",
  radiusFull: "9999px",

  // Shadows
  shadowSm: "0 1px 2px rgba(0,0,0,0.06)",
  shadowMd: "0 2px 8px rgba(0,0,0,0.08)",
  shadowLg: "0 4px 16px rgba(0,0,0,0.12)",
  shadowInset: "inset 0 1px 2px rgba(0,0,0,0.06)",

  // Transitions
  transitionFast: "120ms ease",
  transitionBase: "200ms ease",
  transitionSlow: "300ms ease",

  // Motion easing (semantic curves; durations above)
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",

  // Focus ring (single treatment for every interactive element; the
  // keyboard counterpart of the cross-view selection halo)
  focusRingWidth: "2px",
  focusRingOffset: "2px",

  // Selection signature (C1, design-system roadmap): one treatment
  // for the toolkit's core verb, applied identically across canvas,
  // table, timeline, map, and charts. Color comes from the theme's
  // accent/selectionHighlight; these tokens fix the geometry and the
  // de-emphasis level so views cannot drift apart.
  selectionBarWidth: "3px",
  selectionHaloWidth: "3px",
  // Contrast gap between element and halo (the "gasket"): the halo is
  // separated from ANY fill by the canvas itself, so selection reads
  // on black high-contrast nodes and near-accent fills alike. The
  // retired double-ring approach failed review in all three themes:
  // CSS double at small widths blurs to a single ring, and adjacency
  // to dark fills remained (visual round 4).
  selectionGapWidth: "2px",
  deemphasizedOpacity: "0.25",
  selectionFillAlpha: "0.10",

  // Z-index scale (replaces ad hoc literals)
  zSticky: "100",
  zDropdown: "400",
  zOverlay: "800",
  zModal: "1000",
  zTooltip: "1200",
} as const;

/**
 * Sequential data scale (9 steps, viridis): the only sanctioned ramp
 * for continuous magnitude encodings (matrix heatmap intensity,
 * continuous node-color encodings). Viridis is perceptually uniform
 * and colorblind-safe, extending the R7.8 commitment from the
 * categorical palette to continuous scales. Index 0 = low.
 */
export const SEQUENTIAL_SCALE = [
  "#440154",
  "#46327e",
  "#365c8d",
  "#277f8e",
  "#1fa187",
  "#4ac16d",
  "#a0da39",
  "#fde725",
  "#fffbcd",
] as const;

/**
 * Diverging data scale (9 steps, purple-orange): for signed
 * encodings around a neutral midpoint (diff magnitudes, residuals,
 * z-scores). PuOr remains legible under all common color-vision
 * deficiencies, unlike red-green diverging ramps. Index 4 = neutral.
 */
export const DIVERGING_SCALE = [
  "#7f3b08",
  "#b35806",
  "#e08214",
  "#fdb863",
  "#f7f7f7",
  "#b2abd2",
  "#8073ac",
  "#542788",
  "#2d004b",
] as const;

/**
 * Interpolate a 0..1 value onto a scale (nearest-step; perceptual
 * uniformity of viridis makes stepwise selection adequate for cell
 * and node fills without a color-space interpolation dependency).
 */
export function scaleColor(
  value: number,
  scale: readonly string[] = SEQUENTIAL_SCALE,
): string {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const fallback = scale[0] ?? "#000000";
  return scale[Math.round(v * (scale.length - 1))] ?? fallback;
}

// Dark-mode shadow overrides (stronger shadows on dark backgrounds)
export const DARK_SHADOWS = {
  shadowSm: "0 1px 3px rgba(0,0,0,0.3)",
  shadowMd: "0 2px 8px rgba(0,0,0,0.4)",
  shadowLg: "0 4px 16px rgba(0,0,0,0.5)",
  shadowInset: "inset 0 1px 2px rgba(0,0,0,0.3)",
};

/**
 * Inject design tokens as CSS custom properties.
 * Call once at app initialization (alongside theme color injection).
 */
export function injectDesignTokens(isDark = false): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const shadows = isDark ? DARK_SHADOWS : DESIGN_TOKENS;

  root.style.setProperty("--g3t-font", DESIGN_TOKENS.fontFamily);
  root.style.setProperty("--g3t-font-mono", DESIGN_TOKENS.fontMono);
  root.style.setProperty("--g3t-font-xs", DESIGN_TOKENS.fontSizeXs);
  root.style.setProperty("--g3t-font-sm", DESIGN_TOKENS.fontSizeSm);
  root.style.setProperty("--g3t-font-md", DESIGN_TOKENS.fontSizeMd);
  root.style.setProperty("--g3t-font-lg", DESIGN_TOKENS.fontSizeLg);
  root.style.setProperty("--g3t-font-xl", DESIGN_TOKENS.fontSizeXl);
  root.style.setProperty("--g3t-font-weight", DESIGN_TOKENS.fontWeight);
  root.style.setProperty(
    "--g3t-font-weight-medium",
    DESIGN_TOKENS.fontWeightMedium,
  );
  root.style.setProperty(
    "--g3t-font-weight-semibold",
    DESIGN_TOKENS.fontWeightSemibold,
  );
  root.style.setProperty("--g3t-line-height", DESIGN_TOKENS.lineHeight);

  root.style.setProperty("--g3t-space-1", DESIGN_TOKENS.space1);
  root.style.setProperty("--g3t-space-2", DESIGN_TOKENS.space2);
  root.style.setProperty("--g3t-space-3", DESIGN_TOKENS.space3);
  root.style.setProperty("--g3t-space-4", DESIGN_TOKENS.space4);
  root.style.setProperty("--g3t-space-5", DESIGN_TOKENS.space5);
  root.style.setProperty("--g3t-space-6", DESIGN_TOKENS.space6);
  root.style.setProperty("--g3t-space-8", DESIGN_TOKENS.space8);

  root.style.setProperty("--g3t-radius-sm", DESIGN_TOKENS.radiusSm);
  root.style.setProperty("--g3t-radius-md", DESIGN_TOKENS.radiusMd);
  root.style.setProperty("--g3t-radius-lg", DESIGN_TOKENS.radiusLg);
  root.style.setProperty("--g3t-radius-full", DESIGN_TOKENS.radiusFull);

  root.style.setProperty("--g3t-shadow-sm", shadows.shadowSm);
  root.style.setProperty("--g3t-shadow-md", shadows.shadowMd);
  root.style.setProperty("--g3t-shadow-lg", shadows.shadowLg);
  root.style.setProperty("--g3t-shadow-inset", shadows.shadowInset);

  root.style.setProperty("--g3t-transition-fast", DESIGN_TOKENS.transitionFast);
  root.style.setProperty("--g3t-ease-out", DESIGN_TOKENS.easeOut);
  root.style.setProperty("--g3t-ease-in-out", DESIGN_TOKENS.easeInOut);
  root.style.setProperty(
    "--g3t-focus-ring-width",
    DESIGN_TOKENS.focusRingWidth,
  );
  root.style.setProperty(
    "--g3t-focus-ring-offset",
    DESIGN_TOKENS.focusRingOffset,
  );
  root.style.setProperty(
    "--g3t-selection-bar-width",
    DESIGN_TOKENS.selectionBarWidth,
  );
  root.style.setProperty(
    "--g3t-selection-halo-width",
    DESIGN_TOKENS.selectionHaloWidth,
  );
  root.style.setProperty(
    "--g3t-selection-gap-width",
    DESIGN_TOKENS.selectionGapWidth,
  );
  root.style.setProperty(
    "--g3t-deemphasized-opacity",
    DESIGN_TOKENS.deemphasizedOpacity,
  );
  root.style.setProperty("--g3t-z-sticky", DESIGN_TOKENS.zSticky);
  root.style.setProperty("--g3t-z-dropdown", DESIGN_TOKENS.zDropdown);
  root.style.setProperty("--g3t-z-overlay", DESIGN_TOKENS.zOverlay);
  root.style.setProperty("--g3t-z-modal", DESIGN_TOKENS.zModal);
  root.style.setProperty("--g3t-z-tooltip", DESIGN_TOKENS.zTooltip);
  SEQUENTIAL_SCALE.forEach((c, i) =>
    root.style.setProperty(`--g3t-seq-${i}`, c),
  );
  DIVERGING_SCALE.forEach((c, i) =>
    root.style.setProperty(`--g3t-div-${i}`, c),
  );
  root.style.setProperty("--g3t-transition-base", DESIGN_TOKENS.transitionBase);
  root.style.setProperty("--g3t-transition-slow", DESIGN_TOKENS.transitionSlow);
}

/**
 * Whether the user has requested reduced motion (A2, design-system
 * roadmap). The CSS layer already zeroes the duration tokens under
 * prefers-reduced-motion; this helper exists for JS-driven animation
 * that never touches CSS (Cytoscape layout transitions, ECharts
 * animation config), which must consult it at their defaults.
 * SSR-safe: returns false when no matchMedia is available, so server
 * renders assume motion and the client corrects on hydration.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
