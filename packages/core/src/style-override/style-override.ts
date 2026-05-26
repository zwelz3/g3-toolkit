/**
 * NodeStyleOverride: per-node/per-type visual customization (M12.E1).
 *
 * T1: Override model + Cytoscape stylesheet merge.
 * T2: Built-in SVG icon library (20 icons).
 * T3: JSON serialization for workspace persistence.
 *
 * Framework-agnostic (D6).
 */

// ── Override Model (M12.E1.T1) ──────────────────────────────────────

export type CytoscapeShape =
  | "ellipse"
  | "rectangle"
  | "roundrectangle"
  | "diamond"
  | "hexagon"
  | "octagon"
  | "triangle"
  | "star";

export interface NodeStyleOverride {
  scope: { nodeId: string } | { type: string };
  color?: string;
  shape?: CytoscapeShape;
  size?: number;
  icon?: { svg: string; color?: string; scale?: number };
  labelField?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}

// ── Cytoscape Stylesheet Merge (M12.E1.T1) ─────────────────────────

/**
 * Generate Cytoscape stylesheet entries from overrides.
 * Node-scoped selectors (#id) are more specific than type-scoped
 * selectors ([_type="X"]), so node overrides take precedence.
 */
export function overridesToCytoscapeStyles(
  overrides: NodeStyleOverride[],
): Record<string, unknown>[] {
  const styles: Record<string, unknown>[] = [];

  for (const override of overrides) {
    const selector =
      "nodeId" in override.scope
        ? `node#${override.scope.nodeId}`
        : `node[_type = "${override.scope.type}"]`;

    const style: Record<string, unknown> = {};
    if (override.color) style["background-color"] = override.color;
    if (override.shape) style.shape = override.shape;
    if (override.size) {
      style.width = override.size;
      style.height = override.size;
    }
    if (override.borderColor) style["border-color"] = override.borderColor;
    if (override.borderWidth) style["border-width"] = override.borderWidth;
    if (override.opacity !== undefined) style.opacity = override.opacity;
    if (override.labelField) style.label = `data(${override.labelField})`;
    if (override.icon) {
      style["background-image"] = svgToDataUri(
        override.icon.svg,
        override.icon.color,
      );
      style["background-fit"] = "contain";
      style["background-clip"] = "none";
    }

    if (Object.keys(style).length > 0) {
      styles.push({ selector, style });
    }
  }

  return styles;
}

// ── SVG Icon Library (M12.E1.T2) ────────────────────────────────────

/**
 * 20 built-in SVG icons as path data strings.
 * Each icon is a 24x24 viewBox single-path SVG.
 */
export const ICONS: Record<string, string> = {
  person:
    "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  people:
    "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z",
  building:
    "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z",
  factory: "M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4l4 4v6h12v-6l4-4z",
  globe:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  pin: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  calendar:
    "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z",
  clock:
    "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z",
  document:
    "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  folder:
    "M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
  shield: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
  server:
    "M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm13-6H4c-.55 0-1 .45-1 1v0c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v0c0-.55-.45-1-1-1zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
  database:
    "M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  flag: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z",
  star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  cross:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
};

export const ICON_NAMES = Object.keys(ICONS);

/**
 * Convert an SVG path to a data URI for Cytoscape background-image.
 */
export function svgToDataUri(pathData: string, color = "#000000"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="${pathData}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ── Serialization (M12.E1.T3) ───────────────────────────────────────

// @see R2.11: export and reporting
export function serializeOverrides(overrides: NodeStyleOverride[]): string {
  return JSON.stringify(overrides);
}

export function deserializeOverrides(json: string): NodeStyleOverride[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) return [];
  return parsed as NodeStyleOverride[];
}
