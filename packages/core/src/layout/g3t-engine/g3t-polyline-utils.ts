/**
 * Shared polyline utilities for the g3t routing engine. Engine-internal:
 * exports here are consumed by g3t-routing.ts and g3t-nudging.ts and
 * are NOT re-exported from the package index.
 */
export interface Pt {
  x: number;
  y: number;
}

/**
 * Remove collinear intermediate points from an axis-aligned polyline.
 * Pure: builds and returns a new array; never mutates its argument.
 * Does NOT remove consecutive identical (zero-length-segment) points;
 * callers that need that must filter after this call.
 */
export function dedupeCollinear(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    if (
      a !== undefined &&
      b !== undefined &&
      ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))
    ) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}
