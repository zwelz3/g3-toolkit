/**
 * Pure geometry for the minimap's world -> canvas transform, kept apart
 * from the canvas side effects so it is unit-testable (jsdom cannot
 * rasterize a canvas, so the drawing path is inert under test).
 */

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MinimapFrame {
  /** Model-space origin of the framed area (graph ∪ viewport). */
  frameX1: number;
  frameY1: number;
  /** Model px -> canvas px. */
  scale: number;
  /** Canvas-px offset that centers the framed area within the canvas. */
  offsetX: number;
  offsetY: number;
}

/**
 * Frame the minimap to the UNION of the graph bounding box and the current
 * viewport. Zoomed in (viewport inside the graph) the union is just the
 * graph box, so the overview is unchanged; zoomed or panned out, the frame
 * grows to include the viewed area (the white space around the graph) so
 * the viewport rectangle stays within the minimap instead of clipping at
 * its edge.
 */
export function computeMinimapFrame(
  graph: Box,
  view: Box,
  width: number,
  height: number,
  padding: number,
): MinimapFrame {
  const frameX1 = Math.min(graph.x1, view.x1);
  const frameY1 = Math.min(graph.y1, view.y1);
  const frameW = Math.max(graph.x2, view.x2) - frameX1;
  const frameH = Math.max(graph.y2, view.y2) - frameY1;
  const availW = Math.max(1, width - 2 * padding);
  const availH = Math.max(1, height - 2 * padding);
  const scale = Math.min(availW / (frameW || 1), availH / (frameH || 1));
  const offsetX = padding + (availW - frameW * scale) / 2;
  const offsetY = padding + (availH - frameH * scale) / 2;
  return { frameX1, frameY1, scale, offsetX, offsetY };
}

/** Project a model-space point to minimap canvas px within `frame`. */
export function projectToMinimap(
  frame: MinimapFrame,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: frame.offsetX + (x - frame.frameX1) * frame.scale,
    y: frame.offsetY + (y - frame.frameY1) * frame.scale,
  };
}
