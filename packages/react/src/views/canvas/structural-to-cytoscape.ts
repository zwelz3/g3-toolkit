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
  /** Containers whose compartments are ALL currently collapsed, so the
   *  on-container collapse toggle renders its "collapsed" glyph. This is
   *  distinct from `closedContainers`, which drives sh:closed border
   *  styling, not collapse state. */
  collapsedContainers?: ReadonlySet<string>;
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
  if (original === "NORTH" || original === "SOUTH") {
    if (other.y > center.y + half.h) return "SOUTH";
    if (other.y < center.y - half.h) return "NORTH";
    return original;
  }
  if (other.x > center.x + half.w) return "EAST";
  if (other.x < center.x - half.w) return "WEST";
  return original;
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

  // Compartment ids per container, so the collapse context-menu
  // action can find what to toggle from target.data alone.
  const compartmentIdsByContainer = new Map<string, string[]>();
  for (const node of input.nodes) {
    if (node.compartments?.length) {
      compartmentIdsByContainer.set(
        node.id,
        node.compartments.map((c) => c.id),
      );
    }
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
          _compartmentIds: compartmentIdsByContainer.get(id) ?? [],
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
      // On-container collapse toggle: a small tappable chip in the
      // header's right corner that toggles ALL of this container's
      // compartments at once (the same effect as the container
      // context-menu action). Emitted only when the container has
      // compartments to collapse. The chip is store-agnostic; the host
      // wires the tap through CytoscapeCanvas's onCompartmentToggle. The
      // glyph lives in data so a rebuild after a collapse change flips it.
      const toggleCompartmentIds = compartmentIdsByContainer.get(id) ?? [];
      if (toggleCompartmentIds.length > 0) {
        const toggleSize = Math.min(
          16,
          Math.max(10, geometry.headerHeight - 6),
        );
        const isCollapsed = decorations?.collapsedContainers?.has(id) ?? false;
        elements.push({
          group: "nodes",
          data: {
            id: `${id}::toggle`,
            parent: id,
            _toggleFor: id,
            _compartmentIds: toggleCompartmentIds,
            // "+" when collapsed (click to expand), "\u2212" (minus) when
            // expanded (click to collapse). Both glyphs sit centered in the
            // chip, unlike the chevrons which rendered low.
            _glyph: isCollapsed ? "+" : "\u2212",
            _w: toggleSize,
            _h: toggleSize,
          },
          position: {
            x: g.x + g.width - 4 - toggleSize / 2,
            y: g.y + geometry.headerHeight / 2,
          },
          classes: isCollapsed
            ? "g3t-structural-toggle g3t-structural-toggle-collapsed"
            : "g3t-structural-toggle",
          selectable: false,
          grabbable: false,
        });
      }
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
    if (pts && pts.length >= 3) {
      const sCenter = positionById.get(sourceId);
      const tCenter = positionById.get(targetId);
      const sBox = geometry.ports[sourceId] ?? geometry.nodes[sourceId];
      const tBox = geometry.ports[targetId] ?? geometry.nodes[targetId];
      if (sCenter && tCenter && sBox && tBox) {
        seg = routeToSegments(
          pts,
          clipToBox(sCenter, sBox, tCenter),
          clipToBox(tCenter, tBox, sCenter),
        );
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
    // On-container collapse toggle chip (header right corner). Unlike the
    // header (events:"no"), this is a real tappable node; it is pushed
    // after the header so it sits above it in z-order. The glyph comes
    // from data(_glyph) so a post-collapse rebuild flips +/\u2212. COLORS
    // live in structuralThemeRules.
    selector: "node.g3t-structural-toggle",
    style: {
      shape: "round-rectangle",
      "corner-radius": 3,
      width: "data(_w)",
      height: "data(_h)",
      label: "data(_glyph)",
      "font-size": 12,
      "font-weight": "bold",
      "text-valign": "center",
      "text-halign": "center",
      // Centered glyph: no vertical nudge, and wrap off so the box is the
      // glyph's own metrics rather than a multi-line line box.
      "text-margin-y": 0,
      "text-wrap": "none",
      "border-width": 1,
      "background-opacity": 1,
      events: "yes",
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
      // Toggle chip: header-tinted fill with an accent border and glyph so
      // it reads as an interactive control rather than a label.
      selector: "node.g3t-structural-toggle",
      style: {
        "background-color": theme.bgTertiary,
        "border-color": theme.accentPrimary,
        color: theme.accentPrimary,
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
    session = {
      host,
      from: { ...evt.target.position() },
      half,
      ports: ports
        .filter((p) => !routedEportIds.has(p.id()))
        .map((node) => ({ node, from: { ...node.position() } })),
      routed,
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
    for (const r of session.routed) {
      // Which face of the dragged node should the edge attach to now? Keep
      // the original axis; flip to the opposite face only once the fixed
      // endpoint has crossed clear past the node on that axis.
      const desiredSide = migratedSide(r.movedSide, pos, half, r.otherEport);
      const sameSide = desiredSide === r.movedSide;
      // Same face: the eport rides the node (offset preserved) and the
      // obstacle-aware ELK bends slide proportionally (no "locked" bend).
      // Different face: the attachment migrates, and the edge is re-routed so
      // it leaves/enters perpendicular to the new face instead of cutting
      // across the node.
      const movedEport: PointLike = sameSide
        ? { x: r.movedEportOld.x + dx, y: r.movedEportOld.y + dy }
        : sidePoint(pos, half, desiredSide);
      const newSource = r.srcMoved ? movedEport : r.oldSource;
      const newTarget = r.tgtMoved ? movedEport : r.oldTarget;
      let bends: PointLike[];
      if (sameSide) {
        bends = rescaleBends(
          r.bends,
          r.oldSource,
          r.oldTarget,
          newSource,
          newTarget,
        );
      } else {
        const dist = Math.hypot(
          newTarget.x - newSource.x,
          newTarget.y - newSource.y,
        );
        const stub = Math.max(12, Math.min(40, dist * 0.2));
        bends = routeBetweenSides(
          newSource,
          r.srcMoved ? desiredSide : r.otherSide,
          newTarget,
          r.tgtMoved ? desiredSide : r.otherSide,
          stub,
        );
      }
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
      }
    }
  };

  const onFree = () => {
    session = null;
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

/**
 * Wire the on-container collapse toggle chips (the `g3t-structural-toggle`
 * nodes emitted by structuralToCytoscapeElements) to a host callback. A
 * left tap on a chip calls `onToggle(containerId, compartmentIds)` with the
 * ids the chip carries, then stops propagation so the canvas's generic
 * node-tap (selection) does not also fire on the chip. The host forwards
 * this to the compartment-collapse store's `toggleAll`, exactly as the
 * container context-menu action does. Store-agnostic by design: the
 * converter and this wiring stay free of the collapse store, mirroring how
 * the context menu is host-registered. Returns a disposer.
 */
export function wireStructuralCompartmentToggle(
  cy: Core,
  onToggle: (containerId: string, compartmentIds: string[]) => void,
): () => void {
  const onTap = (evt: {
    target: { data: (k: string) => unknown };
    stopPropagation?: () => void;
  }) => {
    const containerId = evt.target.data("_toggleFor");
    const ids = evt.target.data("_compartmentIds");
    if (typeof containerId !== "string" || !Array.isArray(ids)) return;
    evt.stopPropagation?.();
    onToggle(containerId, ids as string[]);
  };
  cy.on("tap", "node.g3t-structural-toggle", onTap);
  return () => {
    cy.removeListener("tap", "node.g3t-structural-toggle", onTap);
  };
}
