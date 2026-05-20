/**
 * Okabe-Ito colorblind-safe palette and node shape mapping.
 *
 * No information is encoded solely by color; shape serves as a
 * redundant channel (R7.8, C38).
 *
 * Palette source: Okabe & Ito (2008), "Color Universal Design."
 * 8 colors optimized for all forms of color vision deficiency.
 */

/** Okabe-Ito palette (hex). */
export const OKABE_ITO_COLORS = [
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#009E73", // bluish green
  "#F0E442", // yellow
  "#0072B2", // blue
  "#D55E00", // vermilion
  "#CC79A7", // reddish purple
  "#999999", // grey
] as const;

/**
 * Cytoscape node shapes, one per palette color.
 * Shape provides a redundant encoding channel alongside color.
 */
export const NODE_SHAPES = [
  "ellipse",
  "rectangle",
  "diamond",
  "triangle",
  "hexagon",
  "round-rectangle",
  "star",
  "barrel",
] as const;

export type NodeShapeName = (typeof NODE_SHAPES)[number];

/**
 * Get the color for a node type index (wraps around).
 */
export function colorForIndex(index: number): string {
  return OKABE_ITO_COLORS[index % OKABE_ITO_COLORS.length] ?? "#999999";
}

/**
 * Get the shape for a node type index (wraps around).
 */
export function shapeForIndex(index: number): NodeShapeName {
  return NODE_SHAPES[index % NODE_SHAPES.length] ?? "ellipse";
}

/**
 * Build a type-to-visual mapping from a set of observed node types.
 * Returns a stable mapping: same type always gets the same color/shape
 * (sorted alphabetically, then indexed).
 */
export function buildTypeVisualMap(
  nodeTypes: ReadonlySet<string>,
): Map<string, { color: string; shape: NodeShapeName }> {
  const sorted = [...nodeTypes].sort();
  const map = new Map<string, { color: string; shape: NodeShapeName }>();
  for (let i = 0; i < sorted.length; i++) {
    const typeName = sorted[i];
    if (typeName !== undefined) {
      map.set(typeName, {
        color: colorForIndex(i),
        shape: shapeForIndex(i),
      });
    }
  }
  return map;
}
