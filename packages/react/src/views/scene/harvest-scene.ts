/**
 * Harvest a rendered Cytoscape instance into the headless adapters'
 * scene contract (G3L Round 46, owner request: demo a REAL node/edge
 * graph through the SVG/Canvas renderers).
 *
 * The Style Lab resolves attributes through StyleEngine because it
 * TESTS the engine; the demos style through cy stylesheets, so a
 * renderer toggle on a demo reads the COMPUTED styles instead: what
 * cytoscape actually drew is the parity baseline. Positions, sizes,
 * label text, and the visual channels the adapters support are
 * lifted per element; channels cy renders that the adapters do not
 * are the adapters' documented honesty gap, not this harvester's.
 */
import type { Core, EdgeSingular, NodeSingular } from "cytoscape";
import type { VisualAttributes } from "@g3t/core";
import type { SvgSceneEdge, SvgSceneNode } from "../svg/svg-adapter";

export interface HarvestedScene {
  nodes: SvgSceneNode[];
  edges: SvgSceneEdge[];
  resolved: Map<string, VisualAttributes>;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nodeAttributes(n: NodeSingular): VisualAttributes {
  const a: VisualAttributes = {};
  const fill = n.style("background-color");
  if (typeof fill === "string" && fill !== "") a.fill = fill;
  const stroke = n.style("border-color");
  const strokeWidth = num(n.style("border-width"), 0);
  if (typeof stroke === "string" && stroke !== "" && strokeWidth > 0) {
    a.stroke = stroke;
    a.strokeWidth = strokeWidth;
  }
  const opacity = num(n.style("opacity"), 1);
  if (opacity < 1) a.opacity = opacity;
  const label = n.style("label");
  a.labelText =
    typeof label === "string" && label !== ""
      ? label
      : String(n.data("label") ?? n.id());
  const labelColor = n.style("color");
  if (typeof labelColor === "string" && labelColor !== "") {
    a.labelColor = labelColor;
  }
  // The MR-11 lab lesson, applied at the source: adapters halo only
  // when told to; a dark shell needs it for readable labels.
  a.labelHalo = { color: "#0b1120", width: 2.5 };
  return a;
}

function edgeAttributes(e: EdgeSingular): VisualAttributes {
  const a: VisualAttributes = {};
  const line = e.style("line-color");
  if (typeof line === "string" && line !== "") a.stroke = line;
  a.strokeWidth = num(e.style("width"), 1);
  const opacity = num(e.style("opacity"), 1);
  if (opacity < 1) a.opacity = opacity;
  const style = e.style("line-style");
  if (style === "dashed") a.strokeDash = [8, 4];
  if (style === "dotted") a.strokeDash = [2, 3];
  return a;
}

/** Read positions, sizes, and computed visual channels from a live
 *  cy instance into the adapters' scene shape. Call after layout has
 *  settled (positions are read as-is). */
export function harvestSceneFromCy(cy: Core): HarvestedScene {
  const nodes: SvgSceneNode[] = [];
  const resolved = new Map<string, VisualAttributes>();
  cy.nodes().forEach((n) => {
    if (n.style("display") === "none") return;
    const p = n.position();
    nodes.push({
      id: n.id(),
      x: p.x,
      y: p.y,
      width: n.width(),
      height: n.height(),
    });
    resolved.set(n.id(), nodeAttributes(n));
  });
  const shown = new Set(nodes.map((n) => n.id));
  const edges: SvgSceneEdge[] = [];
  cy.edges().forEach((e) => {
    if (e.style("display") === "none") return;
    const s = e.source().id();
    const t = e.target().id();
    if (!shown.has(s) || !shown.has(t)) return;
    edges.push({ id: e.id(), source: s, target: t });
    resolved.set(e.id(), edgeAttributes(e));
  });
  return { nodes, edges, resolved };
}
