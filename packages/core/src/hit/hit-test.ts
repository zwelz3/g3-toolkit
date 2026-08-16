/**
 * Hit testing (G3L:RND-006), renderer-neutral and pure.
 *
 * "Resolve the topmost element with zone detail (node body vs port
 * vs glyph; container header vs body vs border; edge segment),
 * geometric in SVG/Canvas." Both headless adapters and the
 * structural SVG view delegate here; a hit is derived from the SAME
 * scene data the adapters draw from, so hit truth cannot drift from
 * paint truth. Lives in core deliberately (ARC-009: geometry is
 * consumable with no rendering package).
 *
 * Topmost-ness follows paint order: adapters draw nodes in scene
 * order with labels/glyphs above bodies and edges beneath nodes, so
 * the resolver checks nodes last-to-first (glyph zone before body),
 * then edges last-to-first.
 */
import type { VisualAttributes } from "../style/visual-attributes";
import type {
  StructuralGeometry,
  StructuralGraphInput,
} from "../layout/structural";

export interface HitPoint {
  x: number;
  y: number;
}

/** Minimal scene contracts, structurally compatible with the react
 *  adapters' SvgSceneNode/SvgSceneEdge. */
export interface HitSceneNode {
  id: string;
  /** CENTER coordinates (adapter parity). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HitSceneEdge {
  id: string;
  source: string;
  target: string;
}

export interface SceneHit {
  elementId: string;
  kind: "node" | "edge";
  zone: "body" | "glyph" | "segment";
  /** For glyph hits: the slot that was hit. */
  glyphSlot?: string;
}

/** Upstream R-2 (round 17, 2026-07-28): the slots a per-node glyph
 *  can occupy. Shared by the scene hit tester and the structural
 *  SVG view's glyph rendering. */
export type GlyphSlot =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top"
  | "bottom"
  /** R-11: a compartment row's own affordance, right-aligned in the
   *  row band. Rows have no corners to choose between. */
  | "row";

export interface StructuralHit {
  elementId: string;
  kind: "node" | "edge" | "port" | "row";
  /** R-2: "glyph" is an affordance drawn in the header strip; a
   *  consumer can act on it alone rather than on the whole box. */
  zone: "header" | "body" | "border" | "segment" | "port" | "row" | "glyph";
  /** For glyph hits: which slot was hit. */
  glyphSlot?: GlyphSlot;
}

const GLYPH_SLOT: Record<string, { ux: number; uy: number }> = {
  "top-left": { ux: -0.7, uy: -0.7 },
  "top-right": { ux: 0.7, uy: -0.7 },
  "bottom-left": { ux: -0.7, uy: 0.7 },
  "bottom-right": { ux: 0.7, uy: 0.7 },
  top: { ux: 0, uy: -1 },
  bottom: { ux: 0, uy: 1 },
};
const GLYPH_RADIUS = 8;
const EDGE_TOLERANCE = 5;
const BORDER_BAND = 4;

function inShape(
  p: HitPoint,
  n: HitSceneNode,
  shape: string | undefined,
): boolean {
  const rx = n.width / 2;
  const ry = n.height / 2;
  const dx = p.x - n.x;
  const dy = p.y - n.y;
  switch (shape ?? "ellipse") {
    case "rectangle":
    case "round-rectangle":
    case "pill":
      return Math.abs(dx) <= rx && Math.abs(dy) <= ry;
    case "diamond":
      return Math.abs(dx) / rx + Math.abs(dy) / ry <= 1;
    case "triangle": {
      // Vertices: (0,-ry), (rx,ry), (-rx,ry) about the center.
      if (dy < -ry || dy > ry) return false;
      const t = (dy + ry) / (2 * ry); // 0 at apex row, 1 at base
      return Math.abs(dx) <= rx * t;
    }
    case "hexagon": {
      if (Math.abs(dy) > ry || Math.abs(dx) > rx) return false;
      const half = rx / 2;
      if (Math.abs(dx) <= half) return true;
      // Sloped side: from (half, -ry)/(rx, 0)/(half, ry).
      const over = Math.abs(dx) - half;
      return Math.abs(dy) <= ry * (1 - over / (rx - half));
    }
    default: {
      const ex = dx / rx;
      const ey = dy / ry;
      return ex * ex + ey * ey <= 1;
    }
  }
}

export function distToSegment(p: HitPoint, a: HitPoint, b: HitPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** Flat-scene hit test (SvgAdapter / CanvasAdapter). */
export function hitTestScene(
  scene: {
    nodes: readonly HitSceneNode[];
    edges: readonly HitSceneEdge[];
    resolved: ReadonlyMap<string, VisualAttributes>;
  },
  p: HitPoint,
): SceneHit | null {
  // Nodes: last drawn is topmost; glyph zone outranks body.
  for (let i = scene.nodes.length - 1; i >= 0; i--) {
    const n = scene.nodes[i];
    if (n === undefined) continue;
    const a = scene.resolved.get(n.id);
    for (const g of a?.glyphs ?? []) {
      const slot = GLYPH_SLOT[g.slot ?? "top-right"];
      if (!slot) continue;
      const gx = n.x + slot.ux * (n.width / 2);
      const gy = n.y + slot.uy * (n.height / 2);
      if (Math.hypot(p.x - gx, p.y - gy) <= GLYPH_RADIUS) {
        return {
          elementId: n.id,
          kind: "node",
          zone: "glyph",
          glyphSlot: g.slot ?? "top-right",
        };
      }
    }
    if (inShape(p, n, a?.shape)) {
      return { elementId: n.id, kind: "node", zone: "body" };
    }
  }
  // Edges: straight center-to-center segments (adapter parity).
  const byId = new Map(scene.nodes.map((n) => [n.id, n] as const));
  for (let i = scene.edges.length - 1; i >= 0; i--) {
    const e = scene.edges[i];
    if (e === undefined) continue;
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    const a = scene.resolved.get(e.id);
    const tol = Math.max(EDGE_TOLERANCE, (a?.strokeWidth ?? 1.5) / 2 + 2);
    if (distToSegment(p, s, t) <= tol) {
      return { elementId: e.id, kind: "edge", zone: "segment" };
    }
  }
  return null;
}

/** Structural-document hit test (StructuralSvgView): container
 *  header vs body vs border, rows, ports, routed edge segments. */
export function hitTestStructural(
  input: StructuralGraphInput,
  geometry: StructuralGeometry,
  p: HitPoint,
  options?: {
    /** R-2 (round 17, 2026-07-28): the VIEW owns glyph geometry
     *  (it draws them), so it supplies a probe rather than core
     *  duplicating the layout math. Returning a slot for a point
     *  makes that point a "glyph" hit, tested ABOVE the header so
     *  the affordance is reachable. */
    glyphAt?: (
      elementId: string,
      point: HitPoint,
    ) => GlyphSlot | null | undefined;
  },
): StructuralHit | null {
  // Ports paint above everything.
  for (const [id, port] of Object.entries(geometry.ports)) {
    if (
      p.x >= port.x - 2 &&
      p.x <= port.x + port.width + 2 &&
      p.y >= port.y - 2 &&
      p.y <= port.y + port.height + 2
    ) {
      return { elementId: id, kind: "port", zone: "port" };
    }
  }
  // Routed edges (above container bodies visually for hit purposes;
  // tolerance keeps thin polylines clickable).
  for (const [id, eg] of Object.entries(geometry.edges ?? {})) {
    for (let i = 0; i + 1 < eg.points.length; i++) {
      const a = eg.points[i];
      const b = eg.points[i + 1];
      if (!a || !b) continue;
      if (distToSegment(p, a, b) <= EDGE_TOLERANCE) {
        return { elementId: id, kind: "edge", zone: "segment" };
      }
    }
  }
  // Rows before their containers (rows draw above container fills).
  const entries = Object.entries(geometry.nodes);
  for (const [id, g] of entries) {
    if (g.kind !== "row") continue;
    if (
      p.x >= g.x &&
      p.x <= g.x + g.width &&
      p.y >= g.y &&
      p.y <= g.y + g.height
    ) {
      // R-11 (register, 2026-08-05): a row can carry an affordance
      // too; probe it BEFORE falling through to the row zone, so a
      // single zone: "glyph" navigation rule reaches container
      // contents as well as nodes.
      const rowSlot = options?.glyphAt?.(id, p);
      if (rowSlot !== null && rowSlot !== undefined) {
        return {
          elementId: id,
          kind: "row",
          zone: "glyph",
          glyphSlot: rowSlot,
        };
      }
      return { elementId: id, kind: "row", zone: "row" };
    }
  }
  // Containers and plain nodes: border band, then header, then body.
  const containers = input.nodes.filter(
    (n) => (n.compartments?.length ?? 0) > 0,
  );
  const containerIds = new Set(containers.map((n) => n.id));
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry === undefined) continue;
    const [id, g] = entry;
    if (g.kind === "row" || g.parent !== undefined) continue;
    const inside =
      p.x >= g.x && p.x <= g.x + g.width && p.y >= g.y && p.y <= g.y + g.height;
    if (!inside) continue;
    // R-2: the glyph is an affordance ABOVE every other zone,
    // including the border band it may overlap; otherwise a glyph
    // drawn near the header's edge would be unreachable.
    const slot = options?.glyphAt?.(id, p);
    if (slot !== null && slot !== undefined) {
      return { elementId: id, kind: "node", zone: "glyph", glyphSlot: slot };
    }
    const nearBorder =
      p.x <= g.x + BORDER_BAND ||
      p.x >= g.x + g.width - BORDER_BAND ||
      p.y <= g.y + BORDER_BAND ||
      p.y >= g.y + g.height - BORDER_BAND;
    if (nearBorder) return { elementId: id, kind: "node", zone: "border" };
    if (containerIds.has(id) && p.y <= g.y + geometry.headerHeight) {
      return { elementId: id, kind: "node", zone: "header" };
    }
    return { elementId: id, kind: "node", zone: "body" };
  }
  return null;
}
