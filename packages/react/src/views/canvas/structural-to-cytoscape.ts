/**
 * Structural scene -> Cytoscape elements (Group A slice A2, round 32).
 *
 * Consumes the renderer-neutral StructuralGeometry document from
 * @g3t/core and produces preset-positioned Cytoscape elements:
 *
 * - CONTAINERS become compound parents with NO position (Cytoscape
 *   derives parent bounds from children) and NO label of their own:
 *   the header strip is a synthetic child occupying the reserved
 *   top padding, so the parent's bounding box equals the container
 *   box from the geometry.
 * - ROWS become real child nodes: selectable (selection store,
 *   overlays, badges, and the inspector see them like any node; use
 *   the source element's id as the row id and the existing
 *   machinery lights up unmodified), but NOT grabbable: rows never
 *   move independently; dragging the container moves the scene as
 *   a compound unit.
 * - Compartment-title DIVIDER rows and the synthetic HEADER are
 *   non-selectable furniture.
 * - PORTS render as boundary decorations positioned by ELK flush
 *   OUTSIDE the container on their declared side, as TOP-LEVEL
 *   siblings (NOT children: a compound parent always grows to
 *   enclose its children, so a child port cannot live outside the
 *   container). Non-selectable and non-grabbable; real elements with
 *   stable ids and a `_portHost` back-reference, so a later slice can
 *   promote them to selectable inspectables by flipping one flag.
 *   Port-attached edges target the port element. Because ports are
 *   siblings, wireStructuralPortDrag reattaches the drag-along that
 *   compound children get for free.
 *
 * Positions are CENTER-based (Cytoscape convention) converted from
 * the document's absolute top-left boxes. Apply with layout
 * "preset"; never run a force layout over a structural scene.
 *
 * @see specs/01-functional-views.md R1.18
 */

import type { Core, ElementDefinition } from "cytoscape";
import { edgePortId, isEdgePortId } from "@g3t/core";
import { polylineIntersectsBoxes, routeOrthogonal } from "@g3t/core";
import type { RouteBox } from "@g3t/core";
import type { StructuralGraphInput, StructuralGeometry } from "@g3t/core";

type CyStylesheet = {
  selector: string;
  style: Record<string, unknown>;
};

/** Center of an absolute top-left box. */
function center(b: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
} {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Convert a structural scene (input + laid-out geometry) into
 * Cytoscape element definitions with preset positions.
 */
/**
 * Optional render-time decorations layered onto a structural scene.
 * Used by SHACL shape views (slice B3): closed-shape borders and
 * per-row validation severity. Generic and SHACL-agnostic: any
 * client can mark containers or rows.
 */
export interface StructuralDecorations {
  /** Container ids to render with a SOLID border (sh:closed). Others
   *  keep the default; pair with a dashed default if open shapes
   *  should read as dashed. */
  closedContainers?: ReadonlySet<string>;
  /** Row id -> severity badge class driver (worst severity per row). */
  rowSeverities?: ReadonlyMap<string, "violation" | "warning" | "info">;
}

/**
 * Project an absolute ELK route polyline onto Cytoscape `segments`
 * control values (segment-distances, segment-weights), expressed
 * relative to the source->target endpoints the renderer actually draws
 * between. Those endpoints are the converter's resolved port/node
 * centers passed as `source`/`target`, NOT the ELK anchors in
 * `points[0]`/`points[last]`: the converter nudges ports by
 * PORT_BORDER_OFFSET, so the drawn endpoint differs from the ELK anchor.
 * segment-distances/weights are translation-invariant (relative to the
 * source->target line), so computing them in ELK coordinate space
 * against same-space endpoints reconstructs each bend exactly.
 *
 * Returns null when there is no interior bend to express (a straight
 * 2-point route) or the axis is degenerate; the caller then keeps taxi.
 *
 * - segment-weights: fractional position of each interior bend along the
 *   source->target line. May fall outside [0,1] for a route that doubles
 *   back; reconstruction stays exact because Cytoscape positions the
 *   control point on the (infinite) source->target line.
 * - segment-distances: signed perpendicular offset of each bend, using
 *   the right-hand normal of the source->target direction in screen
 *   coordinates (y down). Which screen side a positive distance bows
 *   toward is a Cytoscape rendering convention confirmed in the browser;
 *   if mirrored, negate the normal (one line). The numbers are exact and
 *   unit-tested; the rendered side is not headlessly verifiable.
 */
/**
 * Live CENTER positions of a structural scene's top-level nodes, read
 * from the canvas at interaction time (MR-1 third-review finding: the
 * sketch anchored to the last LAYOUT output, so user drags were
 * invisible to it and every collapse re-layout snapped moved
 * containers back). The hook converts centers to top-left using the
 * prior geometry's sizes and anchors the sketch there instead, so a
 * re-layout preserves what the user actually arranged.
 */
export function captureStructuralTopLevelPositions(
  cy: {
    $id: (id: string) => {
      length: number;
      position: () => { x: number; y: number };
    };
  },
  input: { nodes: readonly { id: string }[] },
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const n of input.nodes) {
    const ele = cy.$id(n.id);
    if (ele.length === 0) continue;
    const p = ele.position();
    out.set(n.id, { x: p.x, y: p.y });
  }
  return out;
}

export function routeToSegments(
  points: ReadonlyArray<{ x: number; y: number }>,
  source: { x: number; y: number },
  target: { x: number; y: number },
): { distances: number[]; weights: number[] } | null {
  if (points.length < 3) return null; // no interior bend: straight, keep taxi
  const ax = target.x - source.x;
  const ay = target.y - source.y;
  const len2 = ax * ax + ay * ay;
  if (len2 < 1e-9) return null; // degenerate axis: keep taxi
  const len = Math.sqrt(len2);
  const ux = ax / len;
  const uy = ay / len;
  // Right-hand normal of (ux,uy) in screen space (y down): 90deg CW.
  const nx = -uy;
  const ny = ux;
  const distances: number[] = [];
  const weights: number[] = [];
  // Interior bends only; the route endpoints are replaced by source/target.
  for (const pt of points.slice(1, -1)) {
    const vx = pt.x - source.x;
    const vy = pt.y - source.y;
    weights.push((vx * ux + vy * uy) / len);
    distances.push(vx * nx + vy * ny);
  }
  return { distances, weights };
}

/**
 * Mirror a routed edge's data-carried bends (`_segDist`/`_segWeight`)
 * into a per-element style bypass.
 *
 * Data remains the single truth (the drag re-anchor reconstructs
 * bends from it); the bypass exists because rendering previously
 * depended on data() MAPPING of segment-distances/segment-weights, a
 * mechanism the routed rule itself flagged as browser-unverified for
 * multi-value properties. The review (item 3.4) reported odd edge
 * routing in the browser; the per-element bypass is the
 * documented-reliable channel, so applying it at every data write
 * point (scene mount and drag write-back) makes routed rendering
 * independent of mapping semantics either way. Bypass precedence
 * beats the mapped rule, so where the mapping did work this is a
 * no-op visually.
 */
export function applyRoutedSegmentBypass(edge: {
  data(key: string): unknown;
  style(style: Record<string, string>): unknown;
}): void {
  const dist: unknown = edge.data("_segDist");
  const weight: unknown = edge.data("_segWeight");
  if (
    typeof dist === "string" &&
    typeof weight === "string" &&
    dist !== "" &&
    weight !== ""
  ) {
    edge.style({
      "segment-distances": dist,
      "segment-weights": weight,
    });
  }
}

/** Apply the routed-segment bypass to every routed edge in a scene. */
export function applyRoutedSegmentBypasses(cy: Core): void {
  cy.edges(".g3t-structural-edge-routed").forEach((e) => {
    applyRoutedSegmentBypass(e);
  });
}

/**
 * The taxi-direction class for an edge whose source attaches on the given
 * ELK side. taxi-direction is an enum (not data()-mappable), so the exit
 * direction rides a class. Empty string when the side is unknown (the edge
 * then uses the base rule's taxi-direction: auto).
 */
export function taxiDirectionClass(side: string | undefined): string {
  switch (side) {
    case "SOUTH":
      return "g3t-structural-edge-downward";
    case "NORTH":
      return "g3t-structural-edge-upward";
    case "EAST":
      return "g3t-structural-edge-rightward";
    case "WEST":
      return "g3t-structural-edge-leftward";
    default:
      return "";
  }
}

/**
 * Inverse of routeToSegments: reconstruct the absolute interior bend points
 * from the segment control values and the current endpoints. A routed edge's
 * `_segDist`/`_segWeight` plus its live source/target positions pin down where
 * ELK placed each bend in canvas space.
 */
export function segmentsToPoints(
  distances: readonly number[],
  weights: readonly number[],
  source: { x: number; y: number },
  target: { x: number; y: number },
): { x: number; y: number }[] {
  const ax = target.x - source.x;
  const ay = target.y - source.y;
  const len = Math.hypot(ax, ay);
  if (len < 1e-9) return [];
  const ux = ax / len;
  const uy = ay / len;
  const nx = -uy;
  const ny = ux;
  return weights.map((w, i) => ({
    x: source.x + w * len * ux + (distances[i] ?? 0) * nx,
    y: source.y + w * len * uy + (distances[i] ?? 0) * ny,
  }));
}

/** A node side an edge attaches to (ELK vocabulary). */
export type AttachmentSide = "NORTH" | "SOUTH" | "EAST" | "WEST";

/**
 * Reposition interior bends proportionally within the source->target
 * bounding box as the endpoints move. x and y are scaled INDEPENDENTLY
 * (separable bilinear), so any segment that shared an x (vertical) or a y
 * (horizontal) still shares it: orthogonality is preserved, but every bend
 * slides with the drag instead of staying pinned in place. This is what
 * keeps a bend from looking "locked" along the edge when a node is moved a
 * long way. A degenerate (zero-extent) source axis falls back to a fixed
 * offset from the source so the bend does not blow up. Returns a fresh
 * array.
 */
export function rescaleBends(
  bends: ReadonlyArray<{ x: number; y: number }>,
  oldSource: { x: number; y: number },
  oldTarget: { x: number; y: number },
  newSource: { x: number; y: number },
  newTarget: { x: number; y: number },
): { x: number; y: number }[] {
  const EPS = 1e-6;
  const dx0 = oldTarget.x - oldSource.x;
  const dy0 = oldTarget.y - oldSource.y;
  const dx1 = newTarget.x - newSource.x;
  const dy1 = newTarget.y - newSource.y;
  return bends.map((b) => ({
    x:
      Math.abs(dx0) > EPS
        ? newSource.x + ((b.x - oldSource.x) / dx0) * dx1
        : newSource.x + (b.x - oldSource.x),
    y:
      Math.abs(dy0) > EPS
        ? newSource.y + ((b.y - oldSource.y) / dy0) * dy1
        : newSource.y + (b.y - oldSource.y),
  }));
}

/**
 * The side an edge attachment should migrate to as a node is dragged. The
 * route's ORIGINAL axis is preserved (a NORTH/SOUTH attachment stays
 * vertical, an EAST/WEST one stays horizontal): an up-and-over route
 * legitimately exits NORTH even when its target is due east, so "face the
 * other endpoint" would wrongly flip it on the first drag tick and discard
 * the obstacle-aware route. The sign flips to the opposite face only once
 * the other endpoint has crossed the node's FAR edge on that axis; the
 * node's own half-extent is the hysteresis band, so a small drag keeps the
 * original face (and its rescaled ELK bends). This is what lets a target
 * attachment migrate (e.g. top -> bottom) when a node is dragged clear
 * across the edge.
 */
export function migratedSide(
  original: AttachmentSide,
  center: { x: number; y: number },
  half: { w: number; h: number },
  other: { x: number; y: number },
): AttachmentSide {
  // FOUR-WAY selection (MR-8 refinement, 2026-07-11): the original
  // logic only flipped within the original axis, so a container
  // dragged above its peers kept an EAST/WEST attachment even though
  // everything it connects to sits BELOW it (the owner's remaining
  // observation). The attach face now rotates to the perpendicular
  // axis when the other endpoint is DECISIVELY beyond that extent
  // (beyond-band advantage over the current axis plus hysteresis, so
  // the face never flaps during a drag along a diagonal).
  const dx = other.x - center.x;
  const dy = other.y - center.y;
  const beyondX = Math.abs(dx) - half.w;
  const beyondY = Math.abs(dy) - half.h;
  const HYST = 12;
  const hFace: AttachmentSide = dx >= 0 ? "EAST" : "WEST";
  const vFace: AttachmentSide = dy >= 0 ? "SOUTH" : "NORTH";
  if (original === "EAST" || original === "WEST") {
    if (beyondY > 0 && beyondY > beyondX + HYST) return vFace;
    if (beyondX > 0) return hFace;
    return original;
  }
  if (beyondX > 0 && beyondX > beyondY + HYST) return hFace;
  if (beyondY > 0) return vFace;
  return original;
}

/**
 * Canonical attach side: a PURE function of relative geometry (no
 * hysteresis, no original-side bias). The settled-state counterpart
 * of migratedSide (MR-9): during a drag, hysteresis prevents face
 * flapping and is deliberately history-dependent; at drag END the
 * side is recomputed canonically so settled routes are a pure
 * function of settled positions. Ties break deterministically toward
 * the horizontal axis.
 */
export function canonicalSide(
  center: { x: number; y: number },
  half: { w: number; h: number },
  other: { x: number; y: number },
): AttachmentSide {
  const dx = other.x - center.x;
  const dy = other.y - center.y;
  const beyondX = Math.abs(dx) - half.w;
  const beyondY = Math.abs(dy) - half.h;
  const hFace: AttachmentSide = dx >= 0 ? "EAST" : "WEST";
  const vFace: AttachmentSide = dy >= 0 ? "SOUTH" : "NORTH";
  if (beyondX > beyondY) return hFace;
  if (beyondY > beyondX) return vFace;
  return Math.abs(dx) >= Math.abs(dy) ? hFace : vFace;
}

/** The boundary point at the center of a node box side. */
export function sidePoint(
  center: { x: number; y: number },
  half: { w: number; h: number },
  side: AttachmentSide,
): { x: number; y: number } {
  switch (side) {
    case "EAST":
      return { x: center.x + half.w, y: center.y };
    case "WEST":
      return { x: center.x - half.w, y: center.y };
    case "SOUTH":
      return { x: center.x, y: center.y + half.h };
    case "NORTH":
    default:
      return { x: center.x, y: center.y - half.h };
  }
}

/** Outward unit normal of a node side. */
function sideNormal(side: AttachmentSide): { x: number; y: number } {
  switch (side) {
    case "EAST":
      return { x: 1, y: 0 };
    case "WEST":
      return { x: -1, y: 0 };
    case "SOUTH":
      return { x: 0, y: 1 };
    case "NORTH":
    default:
      return { x: 0, y: -1 };
  }
}

/**
 * An orthogonal route between two box-side attachment points: stub out
 * perpendicular from each side, then connect the stubs with an axis-aligned
 * path (a single corner when the two exits are on perpendicular axes, a Z
 * when they share an axis and are offset, a straight line when aligned).
 * Used to re-route an edge when a drag has moved a node far enough that the
 * attachment should migrate to a different side, so the edge leaves and
 * enters perpendicular to the chosen faces instead of cutting across the
 * node. Returns the interior bends (between s and t, exclusive).
 */
export function routeBetweenSides(
  s: { x: number; y: number },
  sSide: AttachmentSide,
  t: { x: number; y: number },
  tSide: AttachmentSide,
  stub: number,
): { x: number; y: number }[] {
  const sn = sideNormal(sSide);
  const tn = sideNormal(tSide);
  const a = { x: s.x + sn.x * stub, y: s.y + sn.y * stub };
  const b = { x: t.x + tn.x * stub, y: t.y + tn.y * stub };
  const sVert = sn.x === 0;
  const tVert = tn.x === 0;
  const EPS = 1e-6;
  const bends: { x: number; y: number }[] = [a];
  if (sVert && tVert) {
    // Both exits vertical: each stub turns horizontal; join with a vertical
    // mid-channel (Z) unless already x-aligned.
    if (Math.abs(a.x - b.x) > EPS) {
      const midX = (a.x + b.x) / 2;
      bends.push({ x: midX, y: a.y }, { x: midX, y: b.y });
    }
  } else if (!sVert && !tVert) {
    // Both exits horizontal: join with a horizontal mid-channel.
    if (Math.abs(a.y - b.y) > EPS) {
      const midY = (a.y + b.y) / 2;
      bends.push({ x: a.x, y: midY }, { x: b.x, y: midY });
    }
  } else if (sVert) {
    // Source vertical, target horizontal: single corner.
    bends.push({ x: b.x, y: a.y });
  } else {
    // Source horizontal, target vertical: single corner.
    bends.push({ x: a.x, y: b.y });
  }
  bends.push(b);
  return bends;
}

/**
 * The point where the straight source->target edge line meets a
 * box-shaped endpoint: the box-outline intersection of the ray from
 * `center` toward `toward` (the OTHER endpoint's center). Cytoscape
 * resolves a segment edge's endpoints this way (center-to-center,
 * clipped to the node/port outline), so this is the reference the
 * segment weights/distances are measured against; the bare center
 * leaves a visible kink at a sized port (its 6px half-extent for the
 * 12px default). Rounded container corners are approximated by the
 * bounding box (the small radius is within tolerance).
 */
function clipToBox(
  center: { x: number; y: number },
  box: { width: number; height: number },
  toward: { x: number; y: number },
): { x: number; y: number } {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const tx = dx !== 0 ? box.width / 2 / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? box.height / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty); // ray to the box edge (other center is outside)
  return { x: center.x + dx * t, y: center.y + dy * t };
}

export function structuralToCytoscapeElements(
  input: StructuralGraphInput,
  geometry: StructuralGeometry,
  decorations?: StructuralDecorations,
): ElementDefinition[] {
  const elements: ElementDefinition[] = [];
  const closed = decorations?.closedContainers;
  const rowSeverities = decorations?.rowSeverities;

  // Bottom row of each container gets a corner-rounding class so the
  // rounded container outline (VA-27 review) has matching corners.
  const lastRowByParent = new Map<string, { id: string; y: number }>();
  for (const [id, g] of Object.entries(geometry.nodes)) {
    if (g.kind !== "row" || !g.parent) continue;
    const cur = lastRowByParent.get(g.parent);
    if (!cur || g.y > cur.y) lastRowByParent.set(g.parent, { id, y: g.y });
  }

  for (const [id, g] of Object.entries(geometry.nodes)) {
    if (g.kind === "container") {
      // Parent node: no position (derived from children), no label
      // (the header child carries it).
      elements.push({
        group: "nodes",
        data: {
          id,
          _structuralContainer: true,
        },
        classes: closed?.has(id)
          ? "g3t-structural-container g3t-structural-closed"
          : closed
            ? "g3t-structural-container g3t-structural-open"
            : "g3t-structural-container",
        selectable: true,
        grabbable: true,
      });
      // Synthetic header strip child spanning the reserved padding.
      elements.push({
        group: "nodes",
        data: {
          id: `${id}::header`,
          parent: id,
          _label: g.text ?? "",
          _w: g.width,
          _h: geometry.headerHeight,
        },
        position: center({
          x: g.x,
          y: g.y,
          width: g.width,
          height: geometry.headerHeight,
        }),
        classes: "g3t-structural-header",
        selectable: false,
        grabbable: false,
      });
      // Bounds pin (MR-1 fourth review): a 1x1 invisible child at the
      // geometry box's bottom-right interior. Cytoscape derives a
      // compound parent's DRAWN bounds from its children; when a
      // collapse removes the rows, the drawn box collapsed to the
      // header strip while the ELK geometry box (which the sketch
      // floor holds, and on whose border the ports sit) stayed
      // full-size, so the container read as mispositioned and its
      // edges attached into empty space. The pin makes the drawn
      // bounds equal the geometry box REGARDLESS of which rows exist.
      elements.push({
        group: "nodes",
        data: {
          id: `${id}::extent`,
          parent: id,
          _w: 1,
          _h: 1,
        },
        position: {
          x: g.x + g.width - 0.5,
          y: g.y + g.height - 0.5,
        },
        classes: "g3t-structural-extent",
        selectable: false,
        grabbable: false,
      });
    } else if (g.kind === "row") {
      const severity = rowSeverities?.get(id);
      elements.push({
        group: "nodes",
        data: {
          id,
          parent: g.parent,
          _label: g.text ?? "",
          _w: g.width,
          _h: g.height,
          _compartment: g.compartment,
          ...(severity ? { _severity: severity } : {}),
        },
        position: center(g),
        classes: [
          "g3t-structural-row",
          ...(g.divider ? ["g3t-structural-divider"] : []),
          ...(g.parent && lastRowByParent.get(g.parent)?.id === id
            ? ["g3t-structural-row-last"]
            : []),
          ...(severity ? [`g3t-structural-sev-${severity}`] : []),
        ].join(" "),
        selectable: !g.divider,
        grabbable: false,
      });
    } else {
      // Plain node: positioned box, ordinary selection semantics.
      elements.push({
        group: "nodes",
        data: { id, _label: g.text ?? "", _w: g.width, _h: g.height },
        position: center(g),
        classes: "g3t-structural-node",
        selectable: true,
        grabbable: true,
      });
    }
  }

  // Push ports outward by the container's border so the two strokes
  // don't collide (VA-27 review round 42). ELK places the port's
  // inner edge ON the boundary line, but Cytoscape strokes the
  // container border CENTERED on the bbox edge, so its outer half
  // crosses into the port; the port's own border adds to the visual
  // encroachment. An outward shift of the (closed-shape) border
  // width clears both half-strokes with a small clean gap.
  const PORT_BORDER_OFFSET = 2;
  for (const [id, p] of Object.entries(geometry.ports)) {
    // Ports are TOP-LEVEL siblings, NOT children of the container.
    // A child cannot sit outside its compound parent: Cytoscape
    // grows the parent to enclose every child, so a port parented to
    // the container always gets swallowed (VA-27 review rounds
    // 32-35: flush-inside read as floating-inside, straddle still
    // half-inside). ELK already places the port flush OUTSIDE the
    // box on its side (EAST left-edge at x=width, WEST at x=-w,
    // SOUTH/NORTH likewise), so the geometry's absolute port box is
    // used verbatim with NO parent. wireStructuralPortDrag moves
    // these siblings with their host, since they no longer travel as
    // compound children.
    const pos = center(p);
    if (p.side === "EAST") pos.x += PORT_BORDER_OFFSET;
    else if (p.side === "WEST") pos.x -= PORT_BORDER_OFFSET;
    else if (p.side === "SOUTH") pos.y += PORT_BORDER_OFFSET;
    else if (p.side === "NORTH") pos.y -= PORT_BORDER_OFFSET;
    elements.push({
      group: "nodes",
      data: {
        id,
        _w: p.width,
        _h: p.height,
        _side: p.side,
        _portHost: p.node,
      },
      position: pos,
      // Synthetic body-edge ports are positioned attachment points only and
      // render invisibly; declared ports render as boundary squares.
      classes: isEdgePortId(id)
        ? "g3t-structural-edge-port"
        : "g3t-structural-port",
      // Decorations in this slice; designed to be promoted to
      // selectable inspectables later (stable ids, _portHost back-ref).
      selectable: false,
      grabbable: false,
    });
  }

  // The renderer draws each edge between the resolved endpoint positions
  // captured here (port/node centers, including the PORT_BORDER_OFFSET
  // nudge applied above); those, not the raw ELK anchors, are the basis
  // for projecting a routed polyline. Edges are pushed after every node
  // and port, so at this point `elements` holds only positioned nodes.
  const positionById = new Map<string, { x: number; y: number }>();
  for (const el of elements) {
    if (el.position && el.data?.id != null) {
      positionById.set(String(el.data.id), el.position);
    }
  }

  for (const e of input.edges) {
    const kind = e.kind ?? "association";
    // Body ends (no declared port) attach to the synth port ELK distributed
    // on the node side; fall back to the node body if none was produced.
    const sourceId =
      e.sourcePort ??
      (geometry.ports[edgePortId(e.id, "s")]
        ? edgePortId(e.id, "s")
        : e.source);
    const targetId =
      e.targetPort ??
      (geometry.ports[edgePortId(e.id, "t")]
        ? edgePortId(e.id, "t")
        : e.target);
    const baseClasses =
      kind === "association"
        ? "g3t-structural-edge"
        : `g3t-structural-edge g3t-uml-${kind}`;
    const baseData = {
      id: e.id,
      source: sourceId,
      target: targetId,
      ...(e.label ? { _label: e.label } : {}),
      _kind: kind,
    };

    // Obstacle-aware routing: when the layout emitted a node-avoiding
    // polyline (routeEdges on) and both endpoints resolve to a drawn
    // position, follow it via `curve-style: segments` so the edge does
    // not pass behind a block. Each edge independently keeps taxi when
    // there is no route, an endpoint has no drawn position (rare body
    // fallback), or the route is a straight 2-point line.
    // Obstacle-aware routing is applied to BODY-attached edges only:
    // ends that are synthetic point ports (1x1) or node bodies, where
    // the projected basis matches what Cytoscape draws. Declared-port
    // edges keep the taxi exit instead: the port fixes a perpendicular
    // attachment direction taxi renders exactly, and reproducing
    // Cytoscape's outline clipping for a sized port proved too fragile
    // (a residual kink at the port). For the routed set, Cytoscape
    // measures segment points against the straight source->target line
    // whose endpoints are the node/port outline clipped along the
    // center-to-center direction, so the basis clips toward the OTHER
    // endpoint's center.
    const portAttached = e.sourcePort != null || e.targetPort != null;
    const pts = portAttached ? undefined : geometry.edges?.[e.id]?.points;
    let seg: { distances: number[]; weights: number[] } | null = null;
    if (pts && pts.length >= 2) {
      const sCenter = positionById.get(sourceId);
      const tCenter = positionById.get(targetId);
      const sBox = geometry.ports[sourceId] ?? geometry.nodes[sourceId];
      const tBox = geometry.ports[targetId] ?? geometry.nodes[targetId];
      if (sCenter && tCenter && sBox && tBox) {
        if (pts.length === 2) {
          // A 2-point route is a REAL route under the g3t engine
          // (Brandes-Koepf straightens chains, so cross-aligned
          // anchors dedupe the jog away; elk never emitted these,
          // which is why the old gate was >= 3). Without this,
          // better placement produced FEWER drawn edges: the MR-11
          // flip finding (zero overlay paths on the MBSE shell). A
          // degenerate on-baseline control point renders it
          // straight through the same routed rule.
          seg = { distances: [0], weights: [0.5] };
        } else {
          seg = routeToSegments(
            pts,
            clipToBox(sCenter, sBox, tCenter),
            clipToBox(tCenter, tBox, sCenter),
          );
        }
      }
    }

    if (seg) {
      // Dormant taxi-direction from the source attachment side. It is
      // ignored while curve-style is segments (the routed default), and
      // drag keeps the segments route (re-anchored, not released), so it
      // stays dormant in the normal path. It is retained only as a
      // perpendicular-exit fallback should a routed edge ever revert to
      // taxi, so the edge would not lie flat against the node face.
      const routedDir = taxiDirectionClass(geometry.ports[sourceId]?.side);
      elements.push({
        group: "edges",
        // curve-style: segments is an enum, so it rides the routed class
        // (like taxi-direction below). The bend arrays vary per edge, so
        // they ride data() as space-separated strings, mapped by the
        // routed rule in STRUCTURAL_RULES. (Whether Cytoscape honors
        // data() mapping for these multi-value props is a browser-check
        // item; the fallback is a per-element style bypass.)
        data: {
          ...baseData,
          _segDist: seg.distances.join(" "),
          _segWeight: seg.weights.join(" "),
        },
        classes:
          baseClasses +
          " g3t-structural-edge-routed" +
          (routedDir ? ` ${routedDir}` : ""),
      });
      continue;
    }

    // Taxi fallback: leave the source attachment perpendicular to its
    // side so the edge heads away from the node rather than doubling back
    // across it. taxi-direction is an enum (not data()-mappable), so it
    // rides a class.
    const dir = taxiDirectionClass(geometry.ports[sourceId]?.side);
    elements.push({
      group: "edges",
      data: baseData,
      classes: dir ? `${baseClasses} ${dir}` : baseClasses,
    });
  }

  return elements;
}

/**
 * Stylesheet rules for structural scenes. Class-scoped: inert when
 * no structural elements exist, so they merge unconditionally.
 * Literal colors for the same reason COMPOUND_CONTAINER_RULE uses
 * them (Cytoscape cannot read CSS variables; theme-resolved values
 * ride through ThemeManager for hosts that merge the derivation).
 */
export const STRUCTURAL_RULES: CyStylesheet[] = [
  {
    // Override the generic :parent rule for structural containers:
    // zero padding so the parent's bbox equals the geometry box (the
    // header child occupies the reserved strip), and no compound
    // label (the header carries the text). Rounded per VA-27 review;
    // the header and bottom row round their corners to match (the
    // small interior-seam artifacts of a per-corner-radius-less
    // renderer are accepted; radius kept small for that reason).
    // COLORS live in structuralThemeRules (round 41): these static
    // rules carry structure only, so dark mode is honored.
    selector: "node.g3t-structural-container",
    style: {
      shape: "round-rectangle",
      "corner-radius": 6,
      padding: 0,
      label: "",
      "background-opacity": 0.6,
      "border-width": 1.5,
    },
  },
  {
    // The bounds pin: invisible, inert, never hit-tested.
    selector: "node.g3t-structural-extent",
    style: {
      width: "data(_w)",
      height: "data(_h)",
      opacity: 0,
      events: "no",
      label: "",
    },
  },
  {
    selector: "node.g3t-structural-header",
    style: {
      shape: "round-rectangle",
      "corner-radius": 6,
      width: "data(_w)",
      height: "data(_h)",
      label: "data(_label)",
      "font-size": 11,
      "font-weight": "bold",
      "text-valign": "center",
      "text-halign": "center",
      "background-opacity": 0.9,
      "border-width": 0.5,
      events: "no",
    },
  },
  {
    selector: "node.g3t-structural-row",
    style: {
      shape: "rectangle",
      width: "data(_w)",
      height: "data(_h)",
      label: "data(_label)",
      "font-size": 10,
      "text-valign": "center",
      "text-halign": "center",
      "text-wrap": "ellipsis",
      "text-max-width": "data(_w)",
      "background-opacity": 0.9,
      "border-width": 0.5,
    },
  },
  {
    selector: "node.g3t-structural-row-last",
    style: {
      shape: "round-rectangle",
      "corner-radius": 6,
    },
  },
  {
    // Selection accent fix (VA-27 review): the gasket outline of a
    // selected row was overpainted top/bottom by its zero-gap
    // siblings (later in z-order). Lift the selected row above them
    // so the full ring shows.
    //
    // Round 43: the row is a CHILD of the container, and Cytoscape
    // grows a compound parent's bbox to enclose a child's OUTLINE.
    // The global selection ring (outline-width 2, outline-offset 2)
    // therefore expanded the container by ~4px on the selected side,
    // pushing its border out into the ports. Override the offset to
    // be INSET (negative) for structural rows so the ring renders
    // within the row's own bounds: the container bbox is unchanged on
    // selection, the ports stay clear, and the ring is still fully
    // visible (the z-lift handles sibling overpaint). outline-offset
    // was overridden here, BUT Cytoscape rejects negative outline-offset
    // (it is discarded at parse time with a warning), so the inset never
    // rendered. Removed to stop the per-construction warning; the row
    // inherits the global outward ring. A true inset needs a theme-driven
    // border (outline-width 0 + border in the selection color, kept out of
    // these color-free static rules), tracked as a follow-up.
    selector: "node.g3t-structural-row.g3t-selected",
    style: {
      "z-index": 9999,
    },
  },
  {
    selector: "node.g3t-structural-divider",
    style: {
      "font-style": "italic",
      events: "no",
    },
  },
  {
    selector: "node.g3t-structural-node",
    style: {
      shape: "rectangle",
      width: "data(_w)",
      height: "data(_h)",
      label: "data(_label)",
      "font-size": 11,
      "text-valign": "center",
      "text-halign": "center",
      "border-width": 1.5,
    },
  },
  {
    // Ports (VA-27 review): bigger, border-only, no fill: the open
    // square is the canvas for a future direction glyph (in/out
    // arrows) when ports learn flow direction.
    selector: "node.g3t-structural-port",
    style: {
      shape: "rectangle",
      width: "data(_w)",
      height: "data(_h)",
      label: "",
      "background-opacity": 0,
      "border-width": 1.5,
      events: "no",
    },
  },
  {
    // Synthetic body-edge attachment ports: positioned by ELK, attached to
    // by their edge, but never drawn.
    selector: "node.g3t-structural-edge-port",
    style: {
      width: 1,
      height: 1,
      label: "",
      "background-opacity": 0,
      "border-width": 0,
      "text-opacity": 0,
      events: "no",
    },
  },
  {
    selector: "edge.g3t-structural-edge",
    style: {
      "curve-style": "taxi",
      "taxi-direction": "auto",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      width: 1.5,
    },
  },
  {
    // Label channels scoped to edges that HAVE a label: the converter
    // sets _label conditionally on edges, and an unscoped data
    // mapping makes Cytoscape warn once per unlabeled edge per style
    // recalc (the mapping-warning flood class; caught by the
    // console-hygiene browser spec on 2026-07-11).
    selector: "edge.g3t-structural-edge[_label]",
    style: {
      label: "data(_label)",
      "font-size": 9,
      "text-rotation": "autorotate",
      "text-background-opacity": 0.85,
      "text-background-padding": 2,
    },
  },
  {
    // Perpendicular port exit (static enum values via a class, since
    // taxi-direction is not data()-mappable): the edge leaves its source
    // port on the side it sits, heading away from the node.
    selector: "edge.g3t-structural-edge-leftward",
    style: { "taxi-direction": "leftward" },
  },
  {
    selector: "edge.g3t-structural-edge-rightward",
    style: { "taxi-direction": "rightward" },
  },
  {
    selector: "edge.g3t-structural-edge-upward",
    style: { "taxi-direction": "upward" },
  },
  {
    selector: "edge.g3t-structural-edge-downward",
    style: { "taxi-direction": "downward" },
  },
  {
    // Obstacle-aware routing: follow the layout's node-avoiding polyline.
    // curve-style: segments overrides the base edge's taxi (equal
    // specificity, defined later, so it wins); the per-edge bend arrays
    // arrive via data() as space-separated strings. Inert unless an edge
    // carries the routed class, so taxi edges are unaffected.
    selector: "edge.g3t-structural-edge-routed",
    style: {
      "curve-style": "segments",
      "segment-distances": "data(_segDist)",
      "segment-weights": "data(_segWeight)",
    },
  },
  {
    // SHACL closed shape (sh:closed): solid, heavier border.
    selector: "node.g3t-structural-closed",
    style: {
      "border-style": "solid",
      "border-width": 2,
    },
  },
  {
    // UML composition (A3): filled diamond at the SOURCE (whole) end.
    // The plain target triangle from the base edge rule is kept (the
    // composition arrowhead convention varies; a target arrow plus a
    // source diamond reads unambiguously as "X is composed of Y").
    selector: "edge.g3t-uml-composition",
    style: {
      "source-arrow-shape": "diamond",
      "source-arrow-fill": "filled",
      "target-arrow-shape": "none",
    },
  },
  {
    // UML aggregation (A3): hollow diamond at the source.
    selector: "edge.g3t-uml-aggregation",
    style: {
      "source-arrow-shape": "diamond",
      "source-arrow-fill": "hollow",
      "target-arrow-shape": "none",
    },
  },
  {
    // UML generalization (A3): hollow triangle at the TARGET (parent)
    // end (the "is-a" arrow points to the supertype).
    selector: "edge.g3t-uml-generalization",
    style: {
      "target-arrow-shape": "triangle",
      "target-arrow-fill": "hollow",
    },
  },
  {
    // UML dependency (A3): dashed line, open (vee) arrow at the target.
    selector: "edge.g3t-uml-dependency",
    style: {
      "line-style": "dashed",
      "target-arrow-shape": "vee",
    },
  },
  {
    // SHACL open shape: dashed border (the default when a closed set
    // is supplied; see the converter).
    selector: "node.g3t-structural-open",
    style: {
      "border-style": "dashed",
    },
  },
  {
    // Per-row validation severity (worst-wins): structure only; the
    // semantic colors are in structuralThemeRules.
    selector: "node.g3t-structural-sev-violation",
    style: {
      "border-width": 2,
    },
  },
  {
    selector: "node.g3t-structural-sev-warning",
    style: {
      "border-width": 2,
    },
  },
  {
    selector: "node.g3t-structural-sev-info",
    style: {
      "border-width": 2,
    },
  },
].map((r) => ({ ...r, style: r.style as Record<string, unknown> }));

/**
 * Theme-reactive colors for structural scenes (round 41 dark-mode
 * fix). Cytoscape cannot read CSS variables, so structural colors
 * were hardcoded light values in STRUCTURAL_RULES and never responded
 * to the theme; the rows rendered light even in dark mode. These
 * rules are recomposed on theme change exactly like themeColorRules,
 * and must be merged AFTER STRUCTURAL_RULES (which now carries
 * structure only) and after the generic themeColorRules so the
 * structural selectors win their colors.
 *
 * Mirrors the G3tTheme token vocabulary: containers/headers sit on
 * the secondary/tertiary surfaces, rows on the canvas surface, labels
 * in the primary text color, severities in the semantic tokens.
 */
export function structuralThemeRules(theme: {
  bgSecondary: string;
  bgTertiary: string;
  canvasBg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  error: string;
  warning: string;
  accentPrimary: string;
}): CyStylesheet[] {
  return [
    {
      selector: "node.g3t-structural-container",
      style: {
        "background-color": theme.bgSecondary,
        "border-color": theme.textSecondary,
      } as Record<string, unknown>,
    },
    {
      selector: "node.g3t-structural-header",
      style: {
        "background-color": theme.bgTertiary,
        "border-color": theme.border,
        color: theme.textPrimary,
      } as Record<string, unknown>,
    },
    {
      selector: "node.g3t-structural-row",
      style: {
        "background-color": theme.canvasBg,
        "border-color": theme.border,
        color: theme.textPrimary,
      } as Record<string, unknown>,
    },
    {
      selector: "node.g3t-structural-divider",
      style: {
        "background-color": theme.bgTertiary,
        color: theme.textSecondary,
      } as Record<string, unknown>,
    },
    {
      selector: "node.g3t-structural-node",
      style: {
        "background-color": theme.bgSecondary,
        "border-color": theme.textSecondary,
        color: theme.textPrimary,
      } as Record<string, unknown>,
    },
    {
      selector: "node.g3t-structural-port",
      style: {
        "border-color": theme.textSecondary,
      } as Record<string, unknown>,
    },
    {
      selector: "edge.g3t-structural-edge",
      style: {
        "line-color": theme.textSecondary,
        "target-arrow-color": theme.textSecondary,
        "source-arrow-color": theme.textSecondary,
        color: theme.textPrimary,
        "text-background-color": theme.canvasBg,
      } as Record<string, unknown>,
    },
    {
      // Severity borders from the semantic tokens (dark-reactive).
      // Fill stays the row surface so contrast holds in both themes;
      // the colored border is the tier signal (matches the design's
      // "border accent keeps the row text legible").
      selector: "node.g3t-structural-sev-violation",
      style: { "border-color": theme.error } as Record<string, unknown>,
    },
    {
      selector: "node.g3t-structural-sev-warning",
      style: { "border-color": theme.warning } as Record<string, unknown>,
    },
    {
      selector: "node.g3t-structural-sev-info",
      style: { "border-color": theme.accentPrimary } as Record<string, unknown>,
    },
  ];
}

/**
 * Reattach port drag-along for a structural scene, and keep edges routed
 * correctly while a box is dragged.
 *
 * Ports are top-level siblings (so they can sit outside their container),
 * so they do NOT travel with a dragged box the way compound children do.
 * This wires every structural box (compartmented containers AND plain
 * `g3t-structural-node` boxes) to translate its ports by the drag delta.
 *
 * For obstacle-aware (`g3t-structural-edge-routed`, curve-style: segments)
 * edges incident to the box, it re-anchors the route live: the interior
 * bends stay pinned in canvas space (so ELK's obstacle avoidance and edge
 * separation survive the move) and only the segment at the moved endpoint
 * is shifted to stay axis-aligned. This avoids the failure modes of simply
 * dropping the route (edges cutting through nodes or collapsing onto each
 * other) and of leaving the static control values untouched (bends skew off
 * the orthogonal grid, since they are relative to the source->target line).
 * Straight taxi-fallback edges have no bends and just follow their port.
 * A re-layout restores a fully obstacle-aware route for large moves.
 *
 * Ports are filtered once per drag (on grab) and cached, and routed bends
 * are reconstructed once on grab, so each drag step is O(incident edges).
 * Returns a disposer.
 *
 * Call after the canvas is ready, or let the CytoscapeCanvas `structural`
 * path wire it automatically.
 */
/**
 * Distribute attach anchors for edges sharing a face (owner finding,
 * 2026-07-11: with every migrated edge anchored at the face CENTER,
 * bundles collapsed onto one departure point, visually "grouping"
 * and then "breaking back out" mid-drag). Entries are sorted by the
 * other endpoint's cross-axis coordinate (deterministic, no lane
 * swapping while dragging) and spread across the middle 70% of the
 * face; a single edge keeps the face center.
 */
export function distributeFaceAnchors(
  center: { x: number; y: number },
  half: { w: number; h: number },
  side: AttachmentSide,
  entries: readonly { key: string; cross: number }[],
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const sorted = [...entries].sort(
    (a, b) => a.cross - b.cross || (a.key < b.key ? -1 : 1),
  );
  const n = sorted.length;
  const horizontalFace = side === "NORTH" || side === "SOUTH";
  const extent = (horizontalFace ? half.w : half.h) * 2 * 0.7;
  for (let i = 0; i < n; i++) {
    const entry = sorted[i];
    if (!entry) continue;
    const frac = n === 1 ? 0 : i / (n - 1) - 0.5;
    const offset = frac * extent;
    const base = sidePoint(center, half, side);
    out.set(
      entry.key,
      horizontalFace
        ? { x: base.x + offset, y: base.y }
        : { x: base.x, y: base.y + offset },
    );
  }
  return out;
}

const ALL_SIDES: readonly AttachmentSide[] = ["NORTH", "SOUTH", "EAST", "WEST"];

/**
 * Attachment-level drag policy (supersedes resolveDragRoute inside
 * onDrag; resolveDragRoute remains the bends-only surface the
 * flipped round-1 oracles pin). Adds two behaviors the second e2e
 * run demanded: (1) when the desired face cannot route (its stub
 * sealed in by a neighbor: the "c.adcs crosses imager" failure came
 * from an UNCHECKED fallback after a router null), CANDIDATE FACES
 * are tried in order (desired, original, remaining two) before any
 * unchecked fallback; (2) the anchor on the desired face can be a
 * distributed bundle position rather than the face center.
 */
export function resolveDragAttachment(args: {
  bends: readonly { x: number; y: number }[];
  oldSource: { x: number; y: number };
  oldTarget: { x: number; y: number };
  movedEnd: "source" | "target";
  fixedPoint: { x: number; y: number };
  fixedSide: AttachmentSide;
  movedCenter: { x: number; y: number };
  movedHalf: { w: number; h: number };
  desiredSide: AttachmentSide;
  originalSide: AttachmentSide;
  /** Anchor to use on the DESIRED face (bundle distribution or the
   *  ridden eport offset); other candidate faces use their centers. */
  desiredAnchor?: { x: number; y: number };
  sameSide: boolean;
  obstacles: readonly {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}): {
  bends: { x: number; y: number }[];
  source: { x: number; y: number };
  target: { x: number; y: number };
  movedSide: AttachmentSide;
} {
  const anchorFor = (side: AttachmentSide): { x: number; y: number } =>
    side === args.desiredSide && args.desiredAnchor
      ? args.desiredAnchor
      : sidePoint(args.movedCenter, args.movedHalf, side);
  const endpoints = (moved: {
    x: number;
    y: number;
  }): {
    source: { x: number; y: number };
    target: { x: number; y: number };
  } =>
    args.movedEnd === "source"
      ? { source: moved, target: args.fixedPoint }
      : { source: args.fixedPoint, target: moved };

  // 1. Same-side, same-face: the cheap rescale, collision-checked.
  if (args.sameSide) {
    const moved = anchorFor(args.desiredSide);
    const { source, target } = endpoints(moved);
    const rescaled = rescaleBends(
      [...args.bends],
      args.oldSource,
      args.oldTarget,
      source,
      target,
    );
    if (
      !polylineIntersectsBoxes([source, ...rescaled, target], args.obstacles)
    ) {
      return { bends: rescaled, source, target, movedSide: args.desiredSide };
    }
  }

  // 2. Candidate faces through the router (first clear route wins).
  const candidates: AttachmentSide[] = [];
  for (const side of [
    args.desiredSide,
    args.originalSide,
    ...ALL_SIDES,
  ] as const) {
    if (!candidates.includes(side)) candidates.push(side);
  }
  for (const side of candidates) {
    const moved = anchorFor(side);
    const { source, target } = endpoints(moved);
    const rerouted = routeOrthogonal({
      source: {
        point: source,
        side: args.movedEnd === "source" ? side : args.fixedSide,
      },
      target: {
        point: target,
        side: args.movedEnd === "target" ? side : args.fixedSide,
      },
      obstacles: args.obstacles,
    });
    if (rerouted) {
      return {
        bends: rerouted.points.slice(1, -1),
        source,
        target,
        movedSide: side,
      };
    }
  }

  // 3. Last resort: previous behavior at the desired face.
  const moved = anchorFor(args.desiredSide);
  const { source, target } = endpoints(moved);
  const bends = resolveDragRoute({
    bends: args.bends,
    oldSource: args.oldSource,
    oldTarget: args.oldTarget,
    newSource: source,
    newTarget: target,
    srcSide: args.movedEnd === "source" ? args.desiredSide : args.fixedSide,
    tgtSide: args.movedEnd === "target" ? args.desiredSide : args.fixedSide,
    sameSide: args.sameSide,
    obstacles: args.obstacles,
  });
  return { bends, source, target, movedSide: args.desiredSide };
}

/**
 * Drag-route policy (G3L:RTE-011 / MR-8), pure and oracle-testable:
 * a SAME-SIDE drag first tries the cheap rescale (preserving ELK's
 * route shape, the user's mental map of the wire); if the rescaled
 * polyline crosses any obstacle, or the attachment migrated sides,
 * the in-house obstacle-aware router produces fresh bends anchored
 * perpendicular at both terminals. A sealed-off router failure keeps
 * the best non-router result (a crossing beats a vanished wire).
 */
export function resolveDragRoute(args: {
  bends: readonly { x: number; y: number }[];
  oldSource: { x: number; y: number };
  oldTarget: { x: number; y: number };
  newSource: { x: number; y: number };
  newTarget: { x: number; y: number };
  srcSide: AttachmentSide;
  tgtSide: AttachmentSide;
  sameSide: boolean;
  obstacles: readonly {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}): { x: number; y: number }[] {
  const fallback = (): { x: number; y: number }[] => {
    if (args.sameSide) {
      return rescaleBends(
        [...args.bends],
        args.oldSource,
        args.oldTarget,
        args.newSource,
        args.newTarget,
      );
    }
    const dist = Math.hypot(
      args.newTarget.x - args.newSource.x,
      args.newTarget.y - args.newSource.y,
    );
    const stub = Math.max(12, Math.min(40, dist * 0.2));
    return routeBetweenSides(
      args.newSource,
      args.srcSide,
      args.newTarget,
      args.tgtSide,
      stub,
    );
  };
  if (args.sameSide) {
    const rescaled = rescaleBends(
      [...args.bends],
      args.oldSource,
      args.oldTarget,
      args.newSource,
      args.newTarget,
    );
    const full = [args.newSource, ...rescaled, args.newTarget];
    if (!polylineIntersectsBoxes(full, args.obstacles)) return rescaled;
  }
  const rerouted = routeOrthogonal({
    source: { point: args.newSource, side: args.srcSide },
    target: { point: args.newTarget, side: args.tgtSide },
    obstacles: args.obstacles,
  });
  if (rerouted) return rerouted.points.slice(1, -1);
  return fallback();
}

export function wireStructuralPortDrag(cy: Core): () => void {
  interface PointLike {
    x: number;
    y: number;
  }
  interface NodeRef {
    id: () => string;
    data: (k: string) => unknown;
    position: (p?: PointLike) => PointLike;
    width: () => number;
    height: () => number;
  }
  interface EdgeLike {
    id: () => string;
    data: ((k: string) => unknown) & ((patch: Record<string, string>) => void);
    hasClass: (c: string) => boolean;
    source: () => NodeRef;
    target: () => NodeRef;
    /** Style bypass; the runtime object is a cytoscape edge (used by
     *  the routed-segment bypass after the drag data write-back). */
    style: (style: Record<string, string>) => unknown;
  }
  interface PortLike {
    id: () => string;
    data: (k: string) => unknown;
    position: (p?: PointLike) => PointLike;
    connectedEdges: () => Iterable<EdgeLike>;
  }
  interface RoutedCapture {
    edge: EdgeLike;
    bends: PointLike[];
    oldSource: PointLike;
    oldTarget: PointLike;
    srcMoved: boolean;
    tgtMoved: boolean;
    // The eport on the dragged node (to reposition), its original side, and
    // the fixed endpoint's eport + side (to face / route against).
    movedEport: NodeRef;
    movedEportOld: PointLike;
    movedSide: AttachmentSide;
    otherEport: PointLike;
    otherSide: AttachmentSide;
    /** RAW grab-time seg strings (MR-9): return-to-grab restores
     *  these VERBATIM. Reconstructing via
     *  routeToSegments(segmentsToPoints(...)) is exact only when the
     *  parameterization endpoints match the original writer's, and
     *  the browser pin caught a 76px mismatch on exactly that. */
    rawDist: string;
    rawWeight: string;
  }
  const parseNums = (v: unknown): number[] =>
    typeof v === "string" && v.trim() !== ""
      ? v
          .trim()
          .split(/\s+/)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
      : [];
  const toSide = (v: unknown): AttachmentSide =>
    v === "SOUTH" || v === "EAST" || v === "WEST" ? v : "NORTH";

  let session: {
    host: string;
    from: PointLike;
    half: { w: number; h: number };
    ports: { node: PortLike; from: PointLike }[];
    routed: RoutedCapture[];
    /** Top-level structural boxes at grab time (G3L:RTE-011). */
    obstacles: { id: string; box: RouteBox }[];
  } | null = null;

  const onGrab = (evt: { target: NodeRef }) => {
    const host = evt.target.id();
    const half = { w: evt.target.width() / 2, h: evt.target.height() / 2 };
    const ports = cy
      .nodes(".g3t-structural-port, .g3t-structural-edge-port")
      .filter(
        (n: { data: (k: string) => unknown }) => n.data("_portHost") === host,
      ) as unknown as PortLike[];
    const portIds = new Set(ports.map((p) => p.id()));
    // Capture each routed incident edge's absolute bends + endpoints once,
    // so the per-drag step is a cheap recompute, not a re-query. The moved
    // eport is repositioned per-edge (its face can migrate), so it is pulled
    // OUT of the uniform delta-translate set below.
    const routed: RoutedCapture[] = [];
    const routedEportIds = new Set<string>();
    const seen = new Set<string>();
    for (const port of ports) {
      for (const edge of port.connectedEdges()) {
        if (!edge.hasClass("g3t-structural-edge-routed")) continue;
        const id = edge.id();
        if (seen.has(id)) continue;
        seen.add(id);
        const distances = parseNums(edge.data("_segDist"));
        const weights = parseNums(edge.data("_segWeight"));
        if (distances.length === 0 || distances.length !== weights.length) {
          continue;
        }
        const s = edge.source();
        const t = edge.target();
        const oldSource = { ...s.position() };
        const oldTarget = { ...t.position() };
        const srcMoved = portIds.has(s.id());
        const tgtMoved = portIds.has(t.id());
        const movedEport = srcMoved ? s : t;
        routedEportIds.add(movedEport.id());
        routed.push({
          edge,
          bends: segmentsToPoints(distances, weights, oldSource, oldTarget),
          rawDist: String(edge.data("_segDist") ?? ""),
          rawWeight: String(edge.data("_segWeight") ?? ""),
          oldSource,
          oldTarget,
          srcMoved,
          tgtMoved,
          movedEport,
          movedEportOld: srcMoved ? oldSource : oldTarget,
          movedSide: toSide(movedEport.data("_side")),
          otherEport: srcMoved ? oldTarget : oldSource,
          otherSide: toSide((srcMoved ? t : s).data("_side")),
        });
      }
    }
    // Obstacle capture (G3L:RTE-011 / MR-8): every top-level
    // structural node's box, by id, so per-edge rerouting can exclude
    // that edge's own endpoints. Captured ONCE per drag session: only
    // the host moves during the drag, and the host is always an
    // endpoint of its own routed edges, so static boxes stay valid.
    const obstacles: { id: string; box: RouteBox }[] = [];
    const cyNodes = (
      cy as unknown as {
        nodes?: () => Iterable<{
          id: () => string;
          isChild?: () => boolean;
          hasClass: (c: string) => boolean;
          position: () => { x: number; y: number };
          width: () => number;
          height: () => number;
        }>;
      }
    ).nodes?.();
    const iterable =
      cyNodes !== undefined &&
      typeof (cyNodes as { [Symbol.iterator]?: unknown })[Symbol.iterator] ===
        "function"
        ? cyNodes
        : [];
    {
      for (const n of iterable) {
        if (n.isChild?.()) continue;
        if (
          n.hasClass("g3t-structural-edge-port") ||
          n.hasClass("g3t-structural-port")
        ) {
          continue;
        }
        const p = n.position();
        const w = n.width();
        const hgt = n.height();
        if (!(w > 0) || !(hgt > 0)) continue;
        obstacles.push({
          id: n.id(),
          box: { x: p.x - w / 2, y: p.y - hgt / 2, width: w, height: hgt },
        });
      }
    }
    session = {
      host,
      from: { ...evt.target.position() },
      half,
      ports: ports
        .filter((p) => !routedEportIds.has(p.id()))
        .map((node) => ({ node, from: { ...node.position() } })),
      routed,
      obstacles,
    };
  };

  const onDrag = (evt: { target: NodeRef }) => {
    if (session === null || session.host !== evt.target.id()) return;
    const pos = evt.target.position();
    const dx = pos.x - session.from.x;
    const dy = pos.y - session.from.y;
    // Declared ports + taxi-fallback eports translate rigidly with the node.
    for (const p of session.ports) {
      p.node.position({ x: p.from.x + dx, y: p.from.y + dy });
    }
    const half = session.half;
    const hostId = session.host;
    const obstacles = session.obstacles.map((o) =>
      o.id === hostId
        ? {
            x: pos.x - half.w,
            y: pos.y - half.h,
            width: half.w * 2,
            height: half.h * 2,
          }
        : o.box,
    );
    // PRE-PASS (owner finding: bundle-aware anchors). Migrated edges
    // sharing a face are distributed along it instead of collapsing
    // onto the face center, sorted by the other endpoint's cross-axis
    // coordinate so lanes never swap mid-drag.
    const perEdge = session.routed.map((r) => {
      const desiredSide = migratedSide(r.movedSide, pos, half, r.otherEport);
      return { r, desiredSide, sameSide: desiredSide === r.movedSide };
    });
    const faceGroups = new Map<
      AttachmentSide,
      { key: string; cross: number }[]
    >();
    for (const e of perEdge) {
      if (e.sameSide) continue; // riding edges keep ELK's port spread
      const horizontalFace =
        e.desiredSide === "NORTH" || e.desiredSide === "SOUTH";
      const cross = horizontalFace ? e.r.otherEport.x : e.r.otherEport.y;
      const list = faceGroups.get(e.desiredSide) ?? [];
      list.push({ key: e.r.edge.id(), cross });
      faceGroups.set(e.desiredSide, list);
    }
    const anchors = new Map<string, PointLike>();
    for (const [side, entries] of faceGroups) {
      for (const [key, pt] of distributeFaceAnchors(
        pos,
        { w: half.w, h: half.h },
        side,
        entries,
      )) {
        anchors.set(key, pt);
      }
    }
    for (const { r, desiredSide, sameSide } of perEdge) {
      // Attachment-level policy (G3L:RTE-011 / MR-8): rescale when
      // clear; otherwise the router over CANDIDATE FACES (desired,
      // original, remaining two) before any unchecked fallback (the
      // second e2e run's "c.adcs crosses imager" came from a router
      // null degrading into an unchecked side-stub route). Endpoint
      // boxes stay IN the obstacle set deliberately; the host's box
      // is refreshed to its CURRENT dragged position above.
      const riddenAnchor: PointLike = {
        x: r.movedEportOld.x + dx,
        y: r.movedEportOld.y + dy,
      };
      const resolved = resolveDragAttachment({
        bends: r.bends,
        oldSource: r.oldSource,
        oldTarget: r.oldTarget,
        movedEnd: r.srcMoved ? "source" : "target",
        fixedPoint: r.srcMoved ? r.oldTarget : r.oldSource,
        fixedSide: r.otherSide,
        movedCenter: pos,
        movedHalf: { w: half.w, h: half.h },
        desiredSide,
        originalSide: r.movedSide,
        desiredAnchor: sameSide
          ? riddenAnchor
          : (anchors.get(r.edge.id()) ?? undefined),
        sameSide,
        obstacles,
      });
      const bends: PointLike[] = resolved.bends;
      const newSource = resolved.source;
      const newTarget = resolved.target;
      const movedEport: PointLike = r.srcMoved ? newSource : newTarget;
      r.movedEport.position(movedEport);
      const seg = routeToSegments(
        [newSource, ...bends, newTarget],
        newSource,
        newTarget,
      );
      if (seg) {
        // Write control values to data, not a style bypass: the routed rule
        // maps segment-distances/weights FROM data(_segDist/_segWeight), so
        // this renders live AND keeps the data truthful, so a subsequent grab
        // reconstructs the bends from values consistent with the moved
        // endpoints (a style bypass would leave data stale relative to the
        // original endpoint line, skewing the next drag's reconstruction).
        r.edge.data({
          _segDist: seg.distances.join(" "),
          _segWeight: seg.weights.join(" "),
        });
        // Keep the style bypass in lockstep with the data truth.
        applyRoutedSegmentBypass(r.edge);
      }
    }
  };

  const onFree = (evt: { target: NodeRef }) => {
    const sess = session;
    session = null;
    if (sess === null) return;
    // Geometry comes from the SESSION HOST, not from evt.target: on
    // compound scenes the free event can surface on a different
    // element than the grab did, and the previous host-mismatch
    // early-return silently left LAST-FRAME drag history in the seg
    // data, which is precisely the settle-contract violation MR-9
    // exists to prevent (suspected mechanism of the browser pin's
    // restore-never-fired failure).
    const hostEle =
      sess.host === evt.target.id()
        ? evt.target
        : (
            cy as unknown as {
              $id: (id: string) => NodeRef & { length: number };
            }
          ).$id(sess.host);
    if ((hostEle as { length?: number }).length === 0) return;
    const pos = hostEle.position();
    const half = sess.half;

    // MR-9 (round-trip idempotence). Two settled-state rules:
    // 1. RETURN-TO-GRAB (single-session wiggle back): restore the
    //    grab-time baseline EXACTLY: the settled state at the grab
    //    position is whatever it was before the grab (including
    //    ELK's original routes on the first ever drag).
    // 2. Otherwise CANONICALIZE: recompute every routed edge from
    //    final geometry alone (canonical side from pure relative
    //    position, canonical bundle anchors, router bends; the
    //    rescale path and its captured-bend history are NOT used at
    //    settle time), so the settled state is a pure function of
    //    settled positions regardless of the path dragged.
    const returned = Math.hypot(pos.x - sess.from.x, pos.y - sess.from.y) < 8;
    if (returned) {
      hostEle.position({ ...sess.from });
      for (const p of sess.ports) p.node.position({ ...p.from });
      for (const r of sess.routed) {
        r.movedEport.position({ ...r.movedEportOld });
        // VERBATIM restore of the grab-time data: reconstruction via
        // the parameterization helpers is exact only when the
        // endpoint conventions match the original writer's, and the
        // MR-9 browser pin caught a real mismatch there. The raw
        // strings ARE the pre-drag truth; write them back untouched.
        r.edge.data({ _segDist: r.rawDist, _segWeight: r.rawWeight });
        applyRoutedSegmentBypass(r.edge);
      }
      return;
    }

    const obstacles = sess.obstacles.map((o) =>
      o.id === sess.host
        ? {
            x: pos.x - half.w,
            y: pos.y - half.h,
            width: half.w * 2,
            height: half.h * 2,
          }
        : o.box,
    );
    const perEdge = sess.routed.map((r) => ({
      r,
      side: canonicalSide(pos, half, r.otherEport),
    }));
    const faceGroups = new Map<
      AttachmentSide,
      { key: string; cross: number }[]
    >();
    for (const e of perEdge) {
      const horizontalFace = e.side === "NORTH" || e.side === "SOUTH";
      const cross = horizontalFace ? e.r.otherEport.x : e.r.otherEport.y;
      const list = faceGroups.get(e.side) ?? [];
      list.push({ key: e.r.edge.id(), cross });
      faceGroups.set(e.side, list);
    }
    const anchors = new Map<string, PointLike>();
    for (const [side, entries] of faceGroups) {
      for (const [key, pt] of distributeFaceAnchors(
        pos,
        { w: half.w, h: half.h },
        side,
        entries,
      )) {
        anchors.set(key, pt);
      }
    }
    for (const { r, side } of perEdge) {
      const resolved = resolveDragAttachment({
        bends: r.bends,
        oldSource: r.oldSource,
        oldTarget: r.oldTarget,
        movedEnd: r.srcMoved ? "source" : "target",
        fixedPoint: r.srcMoved ? r.oldTarget : r.oldSource,
        fixedSide: r.otherSide,
        movedCenter: pos,
        movedHalf: { w: half.w, h: half.h },
        desiredSide: side,
        originalSide: side,
        desiredAnchor: anchors.get(r.edge.id()) ?? undefined,
        sameSide: false,
        obstacles,
      });
      r.movedEport.position(r.srcMoved ? resolved.source : resolved.target);
      const seg = routeToSegments(
        [resolved.source, ...resolved.bends, resolved.target],
        resolved.source,
        resolved.target,
      );
      if (seg) {
        r.edge.data({
          _segDist: seg.distances.join(" "),
          _segWeight: seg.weights.join(" "),
        });
        applyRoutedSegmentBypass(r.edge);
      }
    }
  };

  const sel = "node.g3t-structural-container, node.g3t-structural-node";
  cy.on("grab", sel, onGrab);
  cy.on("drag", sel, onDrag);
  cy.on("free", sel, onFree);
  return () => {
    cy.removeListener("grab", sel, onGrab);
    cy.removeListener("drag", sel, onDrag);
    cy.removeListener("free", sel, onFree);
  };
}
