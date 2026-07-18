/**
 * Design tokens (G3L:STY-006): the theme layer's INPUT vocabulary.
 * Tokens (color roles, stroke scale, radius scale, type scale,
 * spacing) resolve into a StyleTheme BEFORE rule evaluation, so one
 * rule set drives light/dark/brand themes unchanged; a notation
 * preset is then a token set plus a rule set, not code.
 *
 * Defaults ship color-vision-deficiency-safe: the categorical palette
 * is Okabe-Ito (the eight-color set designed for CVD legibility), and
 * the light/dark label/canvas pairs are WCAG-checked in tests via
 * `contrastRatio` (G3L:ACC-001's computational check for shipped
 * defaults).
 */

import type { StyleTheme } from "./style-engine";

export interface DesignTokens {
  /** Color roles. */
  color: {
    canvas: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    warning: string;
    danger: string;
    /** Categorical palette for data-driven hue encodings (CVD-safe). */
    categorical: readonly string[];
  };
  /** Stroke widths in model units, thin -> emphatic. */
  stroke: { hairline: number; regular: number; bold: number };
  /** Corner radii in model units. */
  radius: { none: number; small: number; large: number };
  /** Type scale in model units. */
  type: { label: number; caption: number; header: number };
  /** Spacing quanta in model units (also the LAY-018 grid unit). */
  spacing: { unit: number; padding: number };
}

/** Okabe-Ito categorical palette (CVD-safe by design). */
export const OKABE_ITO: readonly string[] = [
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#009E73", // bluish green
  "#F0E442", // yellow
  "#0072B2", // blue
  "#D55E00", // vermillion
  "#CC79A7", // reddish purple
  "#000000", // black
];

export const LIGHT_TOKENS: DesignTokens = {
  color: {
    canvas: "#ffffff",
    surface: "#f1f3f5",
    border: "#495057",
    textPrimary: "#212529",
    textSecondary: "#495057",
    accent: "#0072B2",
    warning: "#E69F00",
    danger: "#D55E00",
    categorical: OKABE_ITO,
  },
  stroke: { hairline: 1, regular: 1.5, bold: 3 },
  radius: { none: 0, small: 4, large: 10 },
  type: { label: 11, caption: 9, header: 13 },
  spacing: { unit: 16, padding: 8 },
};

export const DARK_TOKENS: DesignTokens = {
  color: {
    canvas: "#1a1b1e",
    surface: "#2c2e33",
    border: "#909296",
    textPrimary: "#e9ecef",
    textSecondary: "#adb5bd",
    accent: "#56B4E9",
    warning: "#E69F00",
    danger: "#D55E00",
    // Black is illegible on the dark canvas; the eighth slot flips to
    // white (the standard dark-mode Okabe-Ito adjustment).
    categorical: [...OKABE_ITO.slice(0, 7), "#ffffff"],
  },
  stroke: { hairline: 1, regular: 1.5, bold: 3 },
  radius: { none: 0, small: 4, large: 10 },
  type: { label: 11, caption: 9, header: 13 },
  spacing: { unit: 16, padding: 8 },
};

/** Resolve tokens into the engine's theme layer (per-kind bundles). */
export function themeFromTokens(tokens: DesignTokens): StyleTheme {
  return {
    node: {
      fill: tokens.color.surface,
      stroke: tokens.color.border,
      strokeWidth: tokens.stroke.hairline,
      labelColor: tokens.color.textPrimary,
      labelSize: tokens.type.label,
    },
    edge: {
      stroke: tokens.color.textSecondary,
      strokeWidth: tokens.stroke.regular,
      labelColor: tokens.color.textSecondary,
      labelSize: tokens.type.caption,
    },
  };
}

/** WCAG relative luminance of a #rrggbb color. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m || !m[1]) return 0;
  const int = parseInt(m[1], 16);
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel((int >> 16) & 0xff);
  const g = channel((int >> 8) & 0xff);
  const b = channel(int & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
