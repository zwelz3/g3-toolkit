/**
 * ThemeManager: centralized theming via CSS custom properties (M8.5.E1.T1).
 *
 * All g3t components read colors from CSS variables (--g3t-*).
 * The ThemeManager injects these variables into :root and provides
 * derived objects for Cytoscape stylesheets and ECharts themes.
 *
 * @see specs/07-ux-defaults-accessibility.md R7.12
 */

import { create } from "zustand";

// ── Theme Definition ────────────────────────────────────────────────

export interface G3tTheme {
  id: string;
  name: string;

  // Surface
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  border: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Accent
  accentPrimary: string;
  accentHover: string;
  accentMuted: string;

  // Semantic
  success: string;
  warning: string;
  error: string;

  // Graph canvas
  canvasBg: string;
  nodeStroke: string;
  nodeLabelColor: string;
  edgeColor: string;
  edgeSelectedColor: string;
  selectionHighlight: string;

  // Node type palette (Okabe-Ito based, adjusted per theme)
  typePalette: string[];
}

// ── Presets ──────────────────────────────────────────────────────────

export const LIGHT_THEME: G3tTheme = {
  id: "light",
  name: "Light",
  bgPrimary: "#ffffff",
  bgSecondary: "#f8f9fa",
  bgTertiary: "#e9ecef",
  border: "#dee2e6",
  textPrimary: "#212529",
  textSecondary: "#495057",
  textMuted: "#868e96",
  accentPrimary: "#2563eb",
  accentHover: "#1d4ed8",
  accentMuted: "#dbeafe",
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
  canvasBg: "#ffffff",
  nodeStroke: "#495057",
  nodeLabelColor: "#212529",
  edgeColor: "#868e96",
  edgeSelectedColor: "#2563eb",
  selectionHighlight: "rgba(37, 99, 235, 0.15)",
  typePalette: [
    "#E69F00",
    "#56B4E9",
    "#009E73",
    "#F0E442",
    "#0072B2",
    "#D55E00",
    "#CC79A7",
    "#999999",
  ],
};

export const DARK_THEME: G3tTheme = {
  id: "dark",
  name: "Dark",
  bgPrimary: "#1a1b1e",
  bgSecondary: "#25262b",
  bgTertiary: "#2c2e33",
  border: "#373a40",
  textPrimary: "#e9ecef",
  textSecondary: "#adb5bd",
  textMuted: "#868e96",
  accentPrimary: "#4c8bf5",
  accentHover: "#6ea1f7",
  accentMuted: "#1e3a5f",
  success: "#2dd4bf",
  warning: "#fbbf24",
  error: "#f87171",
  canvasBg: "#1a1b1e",
  nodeStroke: "#adb5bd",
  nodeLabelColor: "#e9ecef",
  edgeColor: "#555b63",
  edgeSelectedColor: "#4c8bf5",
  selectionHighlight: "rgba(76, 139, 245, 0.2)",
  typePalette: [
    "#FFB74D",
    "#64B5F6",
    "#4DB6AC",
    "#FFF176",
    "#42A5F5",
    "#FF8A65",
    "#CE93D8",
    "#BDBDBD",
  ],
};

export const HIGH_CONTRAST_THEME: G3tTheme = {
  id: "high-contrast",
  name: "High Contrast",
  bgPrimary: "#ffffff",
  bgSecondary: "#f5f5f5",
  bgTertiary: "#eeeeee",
  border: "#000000",
  textPrimary: "#000000",
  textSecondary: "#000000",
  textMuted: "#333333",
  accentPrimary: "#0000cc",
  accentHover: "#0000ff",
  accentMuted: "#ccccff",
  success: "#006600",
  warning: "#cc6600",
  error: "#cc0000",
  canvasBg: "#ffffff",
  nodeStroke: "#000000",
  nodeLabelColor: "#000000",
  edgeColor: "#000000",
  edgeSelectedColor: "#0000cc",
  selectionHighlight: "rgba(0, 0, 204, 0.2)",
  typePalette: [
    "#000000",
    "#0000CC",
    "#006600",
    "#CC6600",
    "#CC0000",
    "#660066",
    "#006666",
    "#666666",
  ],
};

export const THEME_PRESETS: Record<string, G3tTheme> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  "high-contrast": HIGH_CONTRAST_THEME,
};

// ── Zustand Store ───────────────────────────────────────────────────

interface ThemeState {
  theme: G3tTheme;
  setTheme: (themeId: string) => void;
  setCustomTheme: (theme: G3tTheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: LIGHT_THEME,
  setTheme: (themeId: string) => {
    const preset = THEME_PRESETS[themeId];
    if (preset) {
      set({ theme: preset });
      injectCssVariables(preset);
    }
  },
  setCustomTheme: (theme: G3tTheme) => {
    set({ theme });
    injectCssVariables(theme);
  },
}));

// ── CSS Variable Injection ──────────────────────────────────────────

function injectCssVariables(theme: G3tTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty("--g3t-bg-primary", theme.bgPrimary);
  root.style.setProperty("--g3t-bg-secondary", theme.bgSecondary);
  root.style.setProperty("--g3t-bg-tertiary", theme.bgTertiary);
  root.style.setProperty("--g3t-border", theme.border);
  root.style.setProperty("--g3t-text-primary", theme.textPrimary);
  root.style.setProperty("--g3t-text-secondary", theme.textSecondary);
  root.style.setProperty("--g3t-text-muted", theme.textMuted);
  root.style.setProperty("--g3t-accent-primary", theme.accentPrimary);
  root.style.setProperty("--g3t-accent-hover", theme.accentHover);
  root.style.setProperty("--g3t-accent-muted", theme.accentMuted);
  root.style.setProperty("--g3t-success", theme.success);
  root.style.setProperty("--g3t-warning", theme.warning);
  root.style.setProperty("--g3t-error", theme.error);
  root.style.setProperty("--g3t-canvas-bg", theme.canvasBg);
  root.style.setProperty("--g3t-node-stroke", theme.nodeStroke);
  root.style.setProperty("--g3t-node-label-color", theme.nodeLabelColor);
  root.style.setProperty("--g3t-edge-color", theme.edgeColor);
  root.style.setProperty("--g3t-edge-selected", theme.edgeSelectedColor);
  root.style.setProperty("--g3t-selection-highlight", theme.selectionHighlight);

  // Type palette as indexed vars
  theme.typePalette.forEach((color, i) => {
    root.style.setProperty(`--g3t-type-${i}`, color);
  });
}

// ── Cytoscape Stylesheet Derivation ─────────────────────────────────

export function deriveCytoscapeStyle(
  theme: G3tTheme,
): Record<string, unknown>[] {
  return [
    {
      selector: "node",
      style: {
        "background-color": theme.typePalette[0],
        "border-color": theme.nodeStroke,
        "border-width": 2,
        label: "data(label)",
        color: theme.nodeLabelColor,
        "font-size": 11,
        "text-valign": "bottom",
        "text-margin-y": 4,
      },
    },
    {
      selector: "node.g3t-selected",
      style: {
        "border-color": theme.accentPrimary,
        "border-width": 3,
      },
    },
    {
      selector: "edge",
      style: {
        "line-color": theme.edgeColor,
        "target-arrow-color": theme.edgeColor,
        width: 1.5,
      },
    },
    {
      selector: "edge.g3t-selected",
      style: {
        "line-color": theme.edgeSelectedColor,
        width: 3,
      },
    },
  ];
}

// ── ECharts Theme Derivation ────────────────────────────────────────

export function deriveEChartsTheme(theme: G3tTheme): Record<string, unknown> {
  return {
    backgroundColor: "transparent",
    textStyle: { color: theme.textPrimary },
    title: { textStyle: { color: theme.textPrimary } },
    legend: { textStyle: { color: theme.textSecondary } },
    categoryAxis: {
      axisLine: { lineStyle: { color: theme.border } },
      axisLabel: { color: theme.textSecondary },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: theme.border } },
      axisLabel: { color: theme.textSecondary },
      splitLine: { lineStyle: { color: theme.bgTertiary } },
    },
    color: theme.typePalette,
  };
}
