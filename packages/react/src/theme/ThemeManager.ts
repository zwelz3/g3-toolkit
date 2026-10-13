/**
 * ThemeManager: centralized theming via CSS custom properties (M8.5.E1.T1).
 *
 * All g3t DOM chrome (panels, search, legend, context menu) reads
 * colors from CSS variables (--g3t-*). The ThemeManager injects these
 * variables into :root by default, or into a host-chosen element (the
 * theme TARGET, issue #33), and provides derived objects for Cytoscape
 * stylesheets and ECharts themes.
 *
 * Two surfaces do NOT read the variables: CytoscapeCanvas composes its
 * stylesheet from the theme OBJECT (themeColorRules, because Cytoscape
 * cannot read CSS custom properties) and Minimap paints with the theme
 * object on a canvas 2D context. Both follow the store's `theme` field
 * wherever the target is, so a scoped target changes only the DOM
 * chrome and `color-scheme`; the graph canvas is themed either way.
 *
 * @see specs/07-ux-defaults-accessibility.md R7.12
 */

import { create } from "zustand";
import { prefersReducedMotion, DESIGN_TOKENS } from "@g3-toolkit/core";

// ── Theme Definition ────────────────────────────────────────────────

export interface G3tTheme {
  /** Native-control rendering scheme ("light" | "dark"): without it,
   *  checkboxes, selects, and scrollbars keep the UA's light styling
   *  under a dark theme (visual-acceptance finding, 2026-06-11). */
  colorScheme: "light" | "dark";
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
  /** Muted (ghost) companions to the semantic trio, mirroring
   *  accentMuted. Used for track/ghost fills that sit behind a solid
   *  semantic bar (CoverageMeter). OPTIONAL rather than required:
   *  G3tTheme is public API at 1.0.0, and a consumer-authored theme
   *  literal must keep compiling. When absent the emitter skips them
   *  and the component's own fallback applies. */
  successMuted?: string;
  warningMuted?: string;
  errorMuted?: string;

  // Graph canvas
  canvasBg: string;
  nodeStroke: string;
  nodeLabelColor: string;
  edgeColor: string;
  edgeSelectedColor: string;
  selectionHighlight: string;
  /** Neutral emphasis color for algorithm-overlay members (the
   *  g3t-ov-member border and line color; toned members take the
   *  semantic trio instead). OPTIONAL for the muted trio's reason: a
   *  consumer-authored theme literal must keep compiling. When absent
   *  the canvas keeps its historical green (DEFAULT_OVERLAY_COLOR in
   *  CytoscapeCanvas) and the token is not emitted, so a var() reader
   *  needs a fallback. */
  overlayColor?: string;

  // Node type palette (Okabe-Ito based, adjusted per theme)
  typePalette: string[];
}

// ── Presets ──────────────────────────────────────────────────────────

export const LIGHT_THEME: G3tTheme = {
  colorScheme: "light",
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
  successMuted: "#dcfce7",
  warningMuted: "#fef3c7",
  errorMuted: "#fee2e2",
  canvasBg: "#ffffff",
  nodeStroke: "#495057",
  nodeLabelColor: "#212529",
  edgeColor: "#868e96",
  edgeSelectedColor: "#2563eb",
  selectionHighlight: "rgba(37, 99, 235, 0.15)",
  overlayColor: "#2f9e44",
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
  colorScheme: "dark",
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
  successMuted: "#134e4a",
  warningMuted: "#452c0a",
  errorMuted: "#4c1d1d",
  canvasBg: "#1a1b1e",
  nodeStroke: "#adb5bd",
  nodeLabelColor: "#e9ecef",
  edgeColor: "#555b63",
  edgeSelectedColor: "#4c8bf5",
  selectionHighlight: "rgba(76, 139, 245, 0.2)",
  overlayColor: "#2f9e44",
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
  // White background: native controls must render light (the "dark"
  // value set in visual round 1 was wrong and produced the odd
  // control coloring reported in round 3).
  colorScheme: "light",
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
  successMuted: "#ccffcc",
  warningMuted: "#ffe0cc",
  errorMuted: "#ffcccc",
  canvasBg: "#ffffff",
  nodeStroke: "#000000",
  nodeLabelColor: "#000000",
  edgeColor: "#000000",
  edgeSelectedColor: "#0000cc",
  selectionHighlight: "rgba(0, 0, 204, 0.2)",
  overlayColor: "#2f9e44",
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

/** Where the theme's inline writes land. "root" is `<html>`, the
 *  default and the only behavior before issue #33. An element scopes
 *  the --g3t-* tokens and `color-scheme` to that subtree, so a host
 *  with its own light/dark/automatic scheme keeps it for the rest of
 *  the page (scrollbars, form controls) when a graph view mounts. */
export type ThemeTarget = HTMLElement | "root";

export interface ApplyThemeOptions {
  /** Defaults to "root". */
  target?: ThemeTarget;
}

export interface ThemeState {
  theme: G3tTheme;
  /** Where setTheme / setCustomTheme write the tokens. */
  target: ThemeTarget;
  setTheme: (themeId: string) => void;
  setCustomTheme: (theme: G3tTheme) => void;
  /** Move the store's inline writes to `target`: the previous target
   *  is put back the way the host left it and the current theme is
   *  written to the new one, so the DOM and the store agree. */
  setThemeTarget: (target: ThemeTarget) => void;
  /** Remove the inline properties the store wrote to its target
   *  (restoring any the host had set), for a host that unmounts its
   *  last graph view. The store's `theme` and `target` are kept. */
  clearTheme: () => void;
}

/** Dispose for the store's most recent write. Module-level like the
 *  store singleton: each write first undoes the previous one, so the
 *  values the dispose restores are always the host's own, never a
 *  stale g3t theme. */
let disposeStoreWrite: (() => void) | null = null;

function writeStoreTheme(theme: G3tTheme, target: ThemeTarget): void {
  disposeStoreWrite?.();
  disposeStoreWrite = null;
  const el = resolveTarget(target);
  if (el) disposeStoreWrite = injectCssVariables(theme, el);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: LIGHT_THEME,
  target: "root",
  setTheme: (themeId: string) => {
    const preset = THEME_PRESETS[themeId];
    if (!preset) {
      // Silently doing nothing was the previous behavior, and it is the
      // worst answer available: the caller sees the theme not change
      // with no error, no warning and nothing in the console, which
      // reads as a rendering bug rather than a bad id. Warn rather than
      // throw, matching createTheme's posture: a bad theme id should
      // not take down a host's render.
      console.warn(
        `[g3t] setTheme("${themeId}"): unknown theme id, keeping the ` +
          `current theme. Known ids: ${Object.keys(THEME_PRESETS).join(", ")}. ` +
          `For a theme of your own, build it with createTheme and pass it ` +
          `to setCustomTheme.`,
      );
      return;
    }
    set({ theme: preset });
    writeStoreTheme(preset, get().target);
  },
  setCustomTheme: (theme: G3tTheme) => {
    set({ theme });
    writeStoreTheme(theme, get().target);
  },
  setThemeTarget: (target: ThemeTarget) => {
    set({ target });
    writeStoreTheme(get().theme, target);
  },
  clearTheme: () => {
    disposeStoreWrite?.();
    disposeStoreWrite = null;
  },
}));

// ── CSS Variable Injection ──────────────────────────────────────────

function resolveTarget(target: ThemeTarget | undefined): HTMLElement | null {
  if (target && target !== "root") return target;
  if (typeof document === "undefined") return null;
  return document.documentElement;
}

/**
 * Write a theme's `color-scheme` and --g3t-* tokens inline, to `<html>`
 * by default or to `options.target`. Returns a dispose that puts the
 * element back the way it was: every property this call set is removed,
 * or restored to the inline value the host had there before.
 *
 * This is the store-free door for a host that owns the lifecycle
 * itself (apply on mount, dispose on unmount). The store's
 * setTheme / setCustomTheme go through the same writer against the
 * store's `target`, so a host that wants ThemeSwitcher and workspace
 * snapshots to keep working sets `setThemeTarget` instead and calls
 * `clearTheme` on unmount.
 */
export function applyTheme(
  theme: G3tTheme,
  options: ApplyThemeOptions = {},
): () => void {
  const el = resolveTarget(options.target);
  if (!el) return () => {};
  return injectCssVariables(theme, el);
}

function injectCssVariables(theme: G3tTheme, el: HTMLElement): () => void {
  // Every write records the inline value it replaces (empty when the
  // host had none), so the dispose restores exactly that and nothing
  // else. The recorder keeps the literal `setProperty("--g3t-...")`
  // calls below because scripts/check-design-tokens.mjs derives the
  // token vocabulary by parsing them; route writes through a helper
  // with another name and that gate empties and refuses to run.
  const previous = new Map<string, string>();
  const style = {
    setProperty(name: string, value: string): void {
      if (!previous.has(name))
        previous.set(name, el.style.getPropertyValue(name));
      el.style.setProperty(name, value);
    },
  };

  style.setProperty("color-scheme", theme.colorScheme);
  // Also exposed as a token: a component rendering into a portal or a
  // detached subtree sets its own `color-scheme` and cannot read the
  // target's inline style property. ContextMenu does exactly this.
  style.setProperty("--g3t-color-scheme", theme.colorScheme);
  style.setProperty("--g3t-accent-color-controls", theme.accentPrimary);
  style.setProperty("--g3t-bg-primary", theme.bgPrimary);
  style.setProperty("--g3t-bg-secondary", theme.bgSecondary);
  style.setProperty("--g3t-bg-tertiary", theme.bgTertiary);
  style.setProperty("--g3t-border", theme.border);
  style.setProperty("--g3t-text-primary", theme.textPrimary);
  style.setProperty("--g3t-text-secondary", theme.textSecondary);
  style.setProperty("--g3t-text-muted", theme.textMuted);
  style.setProperty("--g3t-accent-primary", theme.accentPrimary);
  style.setProperty("--g3t-accent-hover", theme.accentHover);
  style.setProperty("--g3t-accent-muted", theme.accentMuted);
  style.setProperty("--g3t-success", theme.success);
  style.setProperty("--g3t-warning", theme.warning);
  style.setProperty("--g3t-error", theme.error);
  // Optional on G3tTheme (see the interface): skip rather than emit
  // "undefined", so a consumer theme that omits them leaves the
  // component fallback in force instead of blanking the ghost fill.
  if (theme.successMuted)
    style.setProperty("--g3t-success-muted", theme.successMuted);
  if (theme.warningMuted)
    style.setProperty("--g3t-warning-muted", theme.warningMuted);
  if (theme.errorMuted)
    style.setProperty("--g3t-error-muted", theme.errorMuted);
  style.setProperty("--g3t-canvas-bg", theme.canvasBg);
  style.setProperty("--g3t-node-stroke", theme.nodeStroke);
  style.setProperty("--g3t-node-label-color", theme.nodeLabelColor);
  style.setProperty("--g3t-edge-color", theme.edgeColor);
  style.setProperty("--g3t-edge-selected", theme.edgeSelectedColor);
  style.setProperty("--g3t-selection-highlight", theme.selectionHighlight);
  // Optional like the muted trio: skip rather than emit "undefined".
  if (theme.overlayColor)
    style.setProperty("--g3t-overlay-color", theme.overlayColor);

  // Type palette as indexed vars
  theme.typePalette.forEach((color, i) => {
    style.setProperty(`--g3t-type-${i}`, color);
  });

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const [name, prior] of previous) {
      if (prior) el.style.setProperty(name, prior);
      else el.style.removeProperty(name);
    }
  };
}

// ── Cytoscape Stylesheet Derivation ─────────────────────────────────

// ── Theme creation (customization layer 1, design-system roadmap E) ──

/** Relative luminance per WCAG 2.x. Hex #rgb/#rrggbb only. */
function relativeLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1] ?? "";
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const channel = (i: number) => {
    const c = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/**
 * WCAG contrast ratio between two hex colors (1..21); null if either
 * color is not plain hex (e.g. rgba() strings are skipped, not failed).
 *
 * Named for the null, because `@g3-toolkit/core` exports a `contrastRatio`
 * that returns a plain `number` and the two used to share that name
 * across the two packages. They are not interchangeable: this one is
 * what `createTheme` needs, since a theme may legitimately carry an
 * rgba() value that has to be SKIPPED rather than scored. Swapping in
 * core's would silently score such a pair instead of skipping it, so
 * the difference is behavioral and the names say so.
 */
export function contrastRatioOrNull(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Build a theme from a partial over a base preset (default: light).
 * Validates key WCAG pairs and WARNS (never blocks) when a pair falls
 * below its threshold: brand themes start from a checked baseline
 * instead of a copied preset. Thresholds: body text 4.5:1 (AA),
 * secondary text 4.5:1, muted text and accent-as-UI 3:1 (AA
 * non-text/large).
 */
export function createTheme(
  overrides: Partial<G3tTheme> & { id: string; name: string },
  base: G3tTheme = LIGHT_THEME,
): G3tTheme {
  const theme: G3tTheme = { ...base, ...overrides };
  const checks: Array<[string, string, string, number]> = [
    ["textPrimary/bgPrimary", theme.textPrimary, theme.bgPrimary, 4.5],
    ["textSecondary/bgPrimary", theme.textSecondary, theme.bgPrimary, 4.5],
    ["textMuted/bgPrimary", theme.textMuted, theme.bgPrimary, 3],
    ["accentPrimary/bgPrimary", theme.accentPrimary, theme.bgPrimary, 3],
  ];
  const failures = checks
    .map(([label, fg, bg, min]) => {
      const ratio = contrastRatioOrNull(fg, bg);
      return ratio !== null && ratio < min
        ? `${label} ${ratio.toFixed(2)}:1 (needs ${min}:1)`
        : null;
    })
    .filter((f): f is string => f !== null);
  if (failures.length > 0) {
    console.warn(
      `createTheme("${theme.id}"): WCAG contrast below threshold: ${failures.join("; ")}`,
    );
  }
  return theme;
}

/** The G3tTheme fields a host CSS variable can supply: every color
 *  string. `typePalette` is a list and `colorScheme` an enum, so they
 *  come from the options, not the mapping. */
export type ThemeColorField = Exclude<
  keyof G3tTheme,
  "id" | "name" | "colorScheme" | "typePalette"
>;

export interface ThemeFromCssVariablesOptions {
  id: string;
  name: string;
  /** Native-control scheme for the derived theme; also picks the
   *  default base (DARK_THEME for "dark", LIGHT_THEME otherwise). */
  colorScheme?: "light" | "dark";
  /** Preset to fill the fields the mapping does not cover. */
  base?: G3tTheme;
}

/**
 * Derive a theme from a host's own CSS custom properties, read through
 * getComputedStyle on `element` (so a variable declared on :root or any
 * ancestor resolves, with var() chains and fallbacks already applied).
 * `mapping` names the host variable per theme field; a variable that
 * resolves to nothing leaves the base value in place rather than
 * writing an empty color.
 *
 * The result is a SNAPSHOT: computed values do not update when the
 * host switches its theme, so re-derive and re-apply on the host's
 * theme change (the same effect that flips it, or a MutationObserver
 * on the attribute it toggles). The contrast warnings come from
 * createTheme and apply only to plain hex values; rgb() strings, which
 * getComputedStyle may return, are skipped, not failed.
 */
export function themeFromCssVariables(
  element: Element,
  mapping: Partial<Record<ThemeColorField, string>>,
  options: ThemeFromCssVariablesOptions,
): G3tTheme {
  const overrides: Partial<G3tTheme> & { id: string; name: string } = {
    id: options.id,
    name: options.name,
  };
  if (options.colorScheme) overrides.colorScheme = options.colorScheme;
  if (typeof window !== "undefined") {
    const computed = window.getComputedStyle(element);
    for (const [field, variable] of Object.entries(mapping)) {
      if (!variable) continue;
      const value = computed.getPropertyValue(variable).trim();
      if (value) overrides[field as ThemeColorField] = value;
    }
  }
  const base =
    options.base ?? (options.colorScheme === "dark" ? DARK_THEME : LIGHT_THEME);
  return createTheme(overrides, base);
}

/** Standalone theme derivation for hosts composing their own
 *  Cytoscape stylesheets. CytoscapeCanvas itself themes through
 *  themeColorRules + its shared stylesheet assembly (round 20), not
 *  through this export. */
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
      // C1 selection signature: halo geometry from the shared token so
      // canvas and table selection agree by construction (Cytoscape
      // cannot read CSS variables; the token constant is the bridge).
      selector: "node.g3t-selected",
      style: {
        // Gasket halo (round-4 finding; replaces the double ring,
        // which blurred at small widths and stayed adjacent to dark
        // fills): the node keeps its own border, and the accent ring
        // sits OFFSET from it, separated by a canvas-colored gap.
        // The ring therefore contrasts with the canvas, and the gap
        // separates it from any node fill, black included.
        "outline-color": theme.accentPrimary,
        "outline-width": parseInt(DESIGN_TOKENS.selectionHaloWidth, 10),
        "outline-offset": parseInt(DESIGN_TOKENS.selectionGapWidth, 10),
        "outline-opacity": 1,
      },
    },
    {
      // Compound containers (slice 1, round 17): theme-resolved
      // colors for the UML element look. Geometry/label structure
      // lives in COMPOUND_CONTAINER_RULE (CytoscapeCanvas); this rule
      // re-states only the COLORS because Cytoscape cannot read CSS
      // variables and the theme object is the bridge.
      selector: ":parent",
      style: {
        "background-color": theme.bgSecondary,
        "background-opacity": 0.35,
        "border-color": theme.border,
        color: theme.textPrimary,
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
    // A2: charts honor the OS motion preference at the theme level.
    animation: !prefersReducedMotion(),
    // C1 selection signature: selected elements take the accent;
    // non-selected de-emphasize to the shared opacity token, so a
    // brushed chart reads exactly like a selected canvas.
    blendMode: undefined,
    select: {
      itemStyle: { borderColor: theme.accentPrimary, borderWidth: 2 },
    },
    emphasis: {
      itemStyle: { borderColor: theme.accentPrimary },
    },
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
