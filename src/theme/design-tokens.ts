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
  fontSizeXs: "10px",
  fontSizeSm: "12px",
  fontSizeMd: "13px",
  fontSizeLg: "15px",
  fontSizeXl: "18px",
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
} as const;

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
  root.style.setProperty("--g3t-transition-base", DESIGN_TOKENS.transitionBase);
  root.style.setProperty("--g3t-transition-slow", DESIGN_TOKENS.transitionSlow);
}
