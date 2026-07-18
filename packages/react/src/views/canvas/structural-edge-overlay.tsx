/**
 * StructuralEdgeOverlay (G3L:RND-002): the SVG overlay edge layer.
 *
 * The ruled B2 architecture: routed structural edges render as TRUE
 * absolute polylines in an SVG layer above the Cytoscape canvas,
 * retiring the relative `curve-style: segments` squeeze as the VISUAL
 * channel (the squeeze remains underneath as the hit-testing path, so
 * hover and context-menu interaction stay with Cytoscape untouched:
 * interaction parity by construction, the DoD ruled into B2).
 *
 * Division of labor per the ruled per-edge split:
 * - Edges the converter routed (class `g3t-structural-edge-routed`,
 *   body/synthetic-point-port attached) draw here from live data:
 *   `_segDist`/`_segWeight` reconstructed against Cytoscape's own
 *   current endpoints via `segmentsToPoints`. Data stays the single
 *   truth; the existing drag re-anchor keeps that data live, so the
 *   overlay redraws correctly during drag with no second geometry
 *   owner (G3L:RTE-005's verbatim-draw half for this set).
 * - Declared-port edges KEEP their Cytoscape taxi rendering (the
 *   ruled perpendicular-exit behavior, G3L:RTE-008); the overlay does
 *   not touch them.
 *
 * The SVG is pointer-events:none: every pointer event lands on the
 * (visually suppressed, still hit-testable) Cytoscape edges beneath.
 *
 * Rendered-behavior claims for this layer are UNVERIFIED until live
 * review (manual-review-log MR-2/MR-3): headless tests pin geometry
 * and DOM structure, not what a browser paints.
 */
import { useEffect, useRef } from "react";
import type { Core, EdgeSingular } from "cytoscape";
import { segmentsToPoints } from "./structural-to-cytoscape";

export type UmlEdgeKind =
  | "association"
  | "composition"
  | "aggregation"
  | "generalization"
  | "dependency";

export interface OverlayTheme {
  /** Line + arrow color (parity: theme.textSecondary). */
  stroke: string;
  /** Label text color. */
  labelColor: string;
  /** Label halo color (parity: the canvas background behind text). */
  labelHalo: string;
}

const EDGE_WIDTH = 1.5; // parity: base routed-edge rule width
const FONT_SIZE = 9; // parity: base routed-edge rule font-size
/** Arrow extents in model units, sized to read like Cytoscape's
 *  triangle at arrow-scale 0.8 on a 1.5-width edge. */
const ARROW_LEN = 8;
const ARROW_HALF = 3.2;
const DIAMOND_LEN = 10;
const DIAMOND_HALF = 3.5;

/** SVG path `d` for an absolute polyline. */
export function overlayPathD(
  points: readonly { x: number; y: number }[],
): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  if (!first) return "";
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) d += ` L ${p.x} ${p.y}`;
  return d;
}

/** Arc-length midpoint of a polyline (edge-label anchor). */
export function polylineMidpoint(points: readonly { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  if (points.length === 0) return { x: 0, y: 0 };
  const only = points[0];
  if (points.length === 1 && only) return { x: only.x, y: only.y };
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  let remaining = total / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  const last = points[points.length - 1];
  return last ? { x: last.x, y: last.y } : { x: 0, y: 0 };
}

/** Unit direction of the polyline's terminal segment, pointing OUT of
 *  the given end (away from the polyline body). Zero-length guards to
 *  +x. */
export function terminalDirection(
  points: readonly { x: number; y: number }[],
  end: "source" | "target",
): { x: number; y: number } {
  if (points.length < 2) return { x: 1, y: 0 };
  const tip = end === "source" ? points[0] : points[points.length - 1];
  const inner = end === "source" ? points[1] : points[points.length - 2];
  if (!tip || !inner) return { x: 1, y: 0 };
  const dx = tip.x - inner.x;
  const dy = tip.y - inner.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** Trim `dist` off the given end of a polyline (so a hollow arrowhead
 *  is not crossed by the shaft). Degenerates gracefully on short
 *  routes by clamping to the segment. */
export function shortenPolyline(
  points: readonly { x: number; y: number }[],
  end: "source" | "target",
  dist: number,
): { x: number; y: number }[] {
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  if (pts.length < 2 || dist <= 0) return pts;
  const tipIdx = end === "source" ? 0 : pts.length - 1;
  const innerIdx = end === "source" ? 1 : pts.length - 2;
  const tip = pts[tipIdx];
  const inner = pts[innerIdx];
  if (!tip || !inner) return pts;
  const dx = inner.x - tip.x;
  const dy = inner.y - tip.y;
  const len = Math.hypot(dx, dy);
  const t = len > 1e-9 ? Math.min(dist / len, 1) : 0;
  pts[tipIdx] = { x: tip.x + dx * t, y: tip.y + dy * t };
  return pts;
}

export interface ArrowShape {
  /** SVG path data, closed for triangle/diamond, open for vee. */
  d: string;
  /** Painted interior: stroke color (filled) or none (hollow/open). */
  fill: "stroke" | "none";
  /** How much shaft to trim at this end so it meets the arrow base. */
  trim: number;
  end: "source" | "target";
}

/**
 * Explicit arrowhead geometry per UML relationship kind (G3L:STY-009:
 * arrows as geometry aligned to the route's terminal tangent, not SVG
 * markers). Matches the Cytoscape rules the converter assigns:
 * association: filled target triangle; generalization: hollow target
 * triangle; composition/aggregation: filled/hollow SOURCE diamond;
 * dependency: open target vee (with a dashed shaft, see isDashedKind).
 */
export function arrowShapes(
  kind: UmlEdgeKind,
  points: readonly { x: number; y: number }[],
): ArrowShape[] {
  if (points.length < 2) return [];
  const shapes: ArrowShape[] = [];
  const at = (end: "source" | "target") => {
    const tip =
      end === "source"
        ? points[0]
        : (points[points.length - 1] as { x: number; y: number } | undefined);
    const dir = terminalDirection(points, end);
    return { tip, dir };
  };
  const tri = (end: "source" | "target", fill: "stroke" | "none") => {
    const { tip, dir } = at(end);
    if (!tip) return;
    const bx = tip.x - dir.x * ARROW_LEN;
    const by = tip.y - dir.y * ARROW_LEN;
    const nx = -dir.y;
    const ny = dir.x;
    shapes.push({
      d:
        `M ${tip.x} ${tip.y}` +
        ` L ${bx + nx * ARROW_HALF} ${by + ny * ARROW_HALF}` +
        ` L ${bx - nx * ARROW_HALF} ${by - ny * ARROW_HALF} Z`,
      fill,
      trim: fill === "none" ? ARROW_LEN : 0,
      end,
    });
  };
  const diamond = (end: "source" | "target", fill: "stroke" | "none") => {
    const { tip, dir } = at(end);
    if (!tip) return;
    const mx = tip.x - dir.x * (DIAMOND_LEN / 2);
    const my = tip.y - dir.y * (DIAMOND_LEN / 2);
    const bx = tip.x - dir.x * DIAMOND_LEN;
    const by = tip.y - dir.y * DIAMOND_LEN;
    const nx = -dir.y;
    const ny = dir.x;
    shapes.push({
      d:
        `M ${tip.x} ${tip.y}` +
        ` L ${mx + nx * DIAMOND_HALF} ${my + ny * DIAMOND_HALF}` +
        ` L ${bx} ${by}` +
        ` L ${mx - nx * DIAMOND_HALF} ${my - ny * DIAMOND_HALF} Z`,
      fill,
      trim: DIAMOND_LEN,
      end,
    });
  };
  const vee = (end: "source" | "target") => {
    const { tip, dir } = at(end);
    if (!tip) return;
    const bx = tip.x - dir.x * ARROW_LEN;
    const by = tip.y - dir.y * ARROW_LEN;
    const nx = -dir.y;
    const ny = dir.x;
    shapes.push({
      d:
        `M ${bx + nx * ARROW_HALF} ${by + ny * ARROW_HALF}` +
        ` L ${tip.x} ${tip.y}` +
        ` L ${bx - nx * ARROW_HALF} ${by - ny * ARROW_HALF}`,
      fill: "none",
      trim: 0,
      end,
    });
  };
  switch (kind) {
    case "composition":
      diamond("source", "stroke");
      break;
    case "aggregation":
      diamond("source", "none");
      break;
    case "generalization":
      tri("target", "none");
      break;
    case "dependency":
      vee("target");
      break;
    case "association":
    default:
      tri("target", "stroke");
      break;
  }
  return shapes;
}

/** Dashed shaft for dependency edges (parity with the class rule). */
export function isDashedKind(kind: UmlEdgeKind): boolean {
  return kind === "dependency";
}

/**
 * Live absolute polyline of a routed Cytoscape edge: the data-carried
 * bends reconstructed against Cytoscape's OWN current endpoints
 * (edge.sourceEndpoint()/targetEndpoint(): the exact basis the
 * renderer draws segments against, so the overlay and the hit path
 * agree by construction). Null when the edge carries no route data.
 *
 * Renderer-less environments (headless Cytoscape in tests) have no
 * endpoint API; the fallback basis is the node centers. The browser
 * path always has a renderer, so the fallback never runs there; the
 * endpoint-basis visual agreement is a live-review item (MR-3), not a
 * headless claim.
 */
export function liveRoutedPoints(
  edge: EdgeSingular,
): { x: number; y: number }[] | null {
  const dist = edge.data("_segDist") as unknown;
  const weight = edge.data("_segWeight") as unknown;
  if (typeof dist !== "string" || typeof weight !== "string") return null;
  if (dist === "" || weight === "") return null;
  const distances = dist.split(" ").map(Number);
  const weights = weight.split(" ").map(Number);
  if (distances.some(Number.isNaN) || weights.some(Number.isNaN)) return null;
  let s: { x: number; y: number };
  let t: { x: number; y: number };
  try {
    s = edge.sourceEndpoint();
    t = edge.targetEndpoint();
  } catch {
    s = edge.source().position();
    t = edge.target().position();
  }
  const bends = segmentsToPoints(distances, weights, s, t);
  return [{ x: s.x, y: s.y }, ...bends, { x: t.x, y: t.y }];
}

const SVG_NS = "http://www.w3.org/2000/svg";

export interface StructuralEdgeOverlayProps {
  cy: Core;
  theme: OverlayTheme;
}

/**
 * The overlay component. React owns only the <svg> skeleton; per-edge
 * elements are managed imperatively inside rAF-batched redraws so a
 * drag never re-renders the React tree (G3L:PRF-005: zero per-frame
 * React or console work on hot paths).
 */
export function StructuralEdgeOverlay({
  cy,
  theme,
}: StructuralEdgeOverlayProps): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group) return;
    let frame: number | null = null;
    let disposed = false;

    const applyTransform = () => {
      const pan = cy.pan();
      const zoom = cy.zoom();
      group.setAttribute(
        "transform",
        `translate(${pan.x} ${pan.y}) scale(${zoom})`,
      );
    };

    const redraw = () => {
      frame = null;
      if (disposed) return;
      applyTransform();
      // Rebuild edge visuals. Element-recycling is deliberately simple
      // (clear + rebuild): routed-edge counts are structural-scene
      // scale (tens), and building detached nodes then appending once
      // keeps layout thrash out of the loop. Revisit only if MR-2
      // (4k lag review) implicates this loop.
      const frag = document.createDocumentFragment();
      cy.edges(".g3t-structural-edge-routed").forEach((edge) => {
        const pts = liveRoutedPoints(edge);
        if (!pts || pts.length < 2) return;
        const kind = ((edge.data("_kind") as string | undefined) ??
          "association") as UmlEdgeKind;
        const shapes = arrowShapes(kind, pts);
        let shaft = pts;
        for (const s of shapes) {
          if (s.trim > 0) shaft = shortenPolyline(shaft, s.end, s.trim);
        }
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", overlayPathD(shaft));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", theme.stroke);
        path.setAttribute("stroke-width", String(EDGE_WIDTH));
        if (isDashedKind(kind)) path.setAttribute("stroke-dasharray", "6 3");
        path.setAttribute("data-overlay-edge", edge.id());
        // TRUE route anchors (untrimmed): the drawn d is the
        // arrow-trimmed shaft, so its terminal coordinates sit an
        // arrow-length short of the real endpoints. Browser
        // acceptance (drawn-border attachment) reads these instead of
        // parsing d; the first CI run failed on exactly that gap.
        const p0 = pts[0];
        const pn = pts[pts.length - 1];
        if (p0 && pn) {
          path.setAttribute("data-route-start", `${p0.x} ${p0.y}`);
          path.setAttribute("data-route-end", `${pn.x} ${pn.y}`);
        }
        frag.appendChild(path);
        for (const s of shapes) {
          const arrow = document.createElementNS(SVG_NS, "path");
          arrow.setAttribute("d", s.d);
          arrow.setAttribute("stroke", theme.stroke);
          arrow.setAttribute("stroke-width", String(EDGE_WIDTH));
          arrow.setAttribute(
            "fill",
            s.fill === "stroke" ? theme.stroke : "none",
          );
          arrow.setAttribute("data-overlay-arrow", edge.id());
          frag.appendChild(arrow);
        }
        const label = edge.data("_label") as string | undefined;
        if (label) {
          const mid = polylineMidpoint(pts);
          const text = document.createElementNS(SVG_NS, "text");
          text.setAttribute("x", String(mid.x));
          text.setAttribute("y", String(mid.y - 3));
          text.setAttribute("text-anchor", "middle");
          text.setAttribute("font-size", String(FONT_SIZE));
          text.setAttribute("fill", theme.labelColor);
          // Halo text (G3L:LBL-002): paint-order stroke in the canvas
          // background color stands in for Cytoscape's
          // text-background-opacity plate.
          text.setAttribute("stroke", theme.labelHalo);
          text.setAttribute("stroke-width", "3");
          text.setAttribute("paint-order", "stroke");
          text.setAttribute("data-overlay-label", edge.id());
          text.textContent = label;
          frag.appendChild(text);
        }
      });
      group.replaceChildren(frag);
    };

    const schedule = () => {
      if (frame !== null || disposed) return;
      frame = requestAnimationFrame(redraw);
    };
    const transformOnly = () => {
      // Pan/zoom moves the WORLD, not the routes: transform the group,
      // no per-edge work (G3L:RND-003's lag budget rides on this).
      if (disposed) return;
      applyTransform();
    };

    cy.on("pan zoom resize", transformOnly);
    cy.on("position", "node", schedule);
    cy.on("add remove data", "edge.g3t-structural-edge-routed", schedule);
    schedule();

    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      cy.off("pan zoom resize", transformOnly);
      cy.off("position", "node", schedule);
      cy.off("add remove data", "edge.g3t-structural-edge-routed", schedule);
    };
  }, [cy, theme.stroke, theme.labelColor, theme.labelHalo]);

  return (
    <svg
      ref={svgRef}
      data-testid="structural-edge-overlay"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <g ref={groupRef} />
    </svg>
  );
}
