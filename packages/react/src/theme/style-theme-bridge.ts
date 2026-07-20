/**
 * ThemeManager bridge (G3L:STY-006 interop): map a live G3tTheme into
 * the style engine's token vocabulary, so a host on ThemeManager
 * drives the engine without a second theme source. The mapping is a
 * pure projection; ThemeManager stays the UI-side authority, tokens
 * stay the engine-side vocabulary, and G3tTheme's typePalette (already
 * Okabe-Ito based) carries through as the categorical palette.
 */
import type { G3tTheme } from "./ThemeManager";
import { themeFromTokens, type DesignTokens, type StyleTheme } from "@g3t/core";

/** Project a G3tTheme into design tokens (pure). */
export function tokensFromG3tTheme(theme: G3tTheme): DesignTokens {
  return {
    color: {
      canvas: theme.canvasBg,
      surface: theme.bgSecondary,
      border: theme.nodeStroke,
      textPrimary: theme.textPrimary,
      textSecondary: theme.textSecondary,
      accent: theme.accentPrimary,
      warning: theme.warning,
      danger: theme.error,
      categorical: theme.typePalette,
    },
    stroke: { hairline: 1, regular: 1.5, bold: 3 },
    radius: { none: 0, small: 4, large: 10 },
    type: { label: 11, caption: 9, header: 13 },
    spacing: { unit: 16, padding: 8 },
  };
}

/** Straight to the engine's theme layer. */
export function styleThemeFromG3tTheme(theme: G3tTheme): StyleTheme {
  return themeFromTokens(tokensFromG3tTheme(theme));
}
