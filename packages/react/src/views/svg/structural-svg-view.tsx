/**
 * Structural SVG view (G3L:RND-001 continuation; F1 structural
 * slice).
 *
 * Renders the renderer-neutral structural geometry document
 * (StructuralGeometry: absolute top-left boxes for containers, rows,
 * plain nodes, ports, plus routed edge polylines) through pure SVG.
 * This is the alternative renderer path for structural diagrams:
 * where the Cytoscape path converts geometry to cy elements and
 * fights compound semantics (the expand/collapse postmortem's
 * "geometry-right is not picture-right"), this view draws the
 * document VERBATIM: what the layout computed is what appears, and
 * jsdom can verify all of it headlessly.
 *
 * Interaction: transform-only wheel-zoom and drag-pan on the scene
 * group (the MR-2-validated pattern; no per-element work in the hot
 * path). UML edge symbols reuse the overlay's arrow geometry
 * (arrowShapes / shortenPolyline / isDashedKind), so the two paths
 * cannot drift apart on relationship semantics.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { routeStructuralEdges, hitTestStructural } from "@g3t/core";
import type {
  StructuralGeometry,
  StructuralGraphInput,
  StructuralHit,
  GlyphSlot,
  StructuralNodeStyle,
} from "@g3t/core";
import {
  useElementPointerEvents,
  type ElementPointerHandlers,
} from "../../interaction/element-pointer-events";
import {
  arrowShapes,
  isDashedKind,
  shortenPolyline,
  type UmlEdgeKind,
} from "../canvas/structural-edge-overlay";

export interface StructuralSvgTheme {
  background: string;
  containerFill: string;
  containerStroke: string;
  headerFill: string;
  headerText: string;
  rowText: string;
  dividerText: string;
  nodeFill: string;
  nodeText: string;
  edgeStroke: string;
  edgeLabel: string;
  portFill: string;
}

/** Defaults tuned for the demo's dark shell. */
export const STRUCTURAL_SVG_DARK: StructuralSvgTheme = {
  background: "transparent",
  containerFill: "rgba(30, 41, 59, 0.85)",
  containerStroke: "#64748b",
  headerFill: "rgba(51, 65, 85, 0.95)",
  headerText: "#e2e8f0",
  rowText: "#cbd5e1",
  dividerText: "#94a3b8",
  nodeFill: "rgba(30, 41, 59, 0.85)",
  nodeText: "#e2e8f0",
  edgeStroke: "#94a3b8",
  edgeLabel: "#cbd5e1",
  portFill: "#e2e8f0",
};

/** R-2 (round 17, 2026-07-28): the glyph affordance's box. Drawn in
 *  the header strip so it reads as a button rather than as part of
 *  the container's body. */
const GLYPH_W = 16;
const GLYPH_H = 14;
const GLYPH_PAD = 4;
/** R-5: a plain node has no header strip, so the glyph rides a
 *  synthetic band that lands it inside the box's own corner.
 *  Render and hit test MUST use the same value. */
const PLAIN_GLYPH_BAND = GLYPH_H + 2 * GLYPH_PAD;

/** R-10: zones that are AFFORDANCES rather than scene surface. A
 *  press on one is an intent to act on that element, so it starts
 *  neither a node drag nor a canvas pan. Future affordance zones
 *  belong here rather than in the pointer handler. */
/** Pointer capture is optional API: jsdom omits it entirely and
 *  some engines omit it on SVG elements, where an unguarded call
 *  throws mid-gesture and leaves the interaction half-started. */
function capturePointer(e: React.PointerEvent<SVGSVGElement>): void {
  const el = e.currentTarget;
  if (typeof el.setPointerCapture === "function") {
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // A capture refused (pointer already released) is not fatal.
    }
  }
}

/** R-9 (register, 2026-08-05): the view transform, exported so a
 *  consumer can control it, persist it, or restore a saved
 *  viewport. */
export interface SvgViewTransform {
  k: number;
  tx: number;
  ty: number;
}

/** R-9: the one zoom transform, shared by wheel and pinch. Scales
 *  about a client-relative point, keeping the model point under it
 *  fixed. */
function zoomAbout(
  v: SvgViewTransform,
  factor: number,
  px: number,
  py: number,
): SvgViewTransform {
  const k = Math.min(4, Math.max(0.05, v.k * factor));
  return {
    k,
    tx: px - ((px - v.tx) / v.k) * k,
    ty: py - ((py - v.ty) / v.k) * k,
  };
}

function isAffordanceZone(hit: StructuralHit | null): boolean {
  return hit !== null && hit.zone === "glyph";
}

function glyphBox(
  g: { x: number; y: number; width: number; height: number },
  headerH: number,
  slot: GlyphSlot,
): { x: number; y: number } {
  const left = g.x + GLYPH_PAD;
  const right = g.x + g.width - GLYPH_W - GLYPH_PAD;
  const centerX = g.x + g.width / 2 - GLYPH_W / 2;
  const topY = g.y + (headerH - GLYPH_H) / 2;
  const bottomY = g.y + g.height - GLYPH_H - GLYPH_PAD;
  switch (slot) {
    case "top-left":
      return { x: left, y: topY };
    case "bottom-left":
      return { x: left, y: bottomY };
    case "bottom-right":
      return { x: right, y: bottomY };
    case "top":
      return { x: centerX, y: topY };
    case "bottom":
      return { x: centerX, y: bottomY };
    case "top-right":
    default:
      return { x: right, y: topY };
  }
}

export interface StructuralSvgViewProps extends ElementPointerHandlers<StructuralHit> {
  /** R-2 (round 17): per-node affordance drawn as a bordered box in
   *  the header strip, with its own hit zone ("glyph") so consumers
   *  can act on the glyph alone. Class g3t-ssv-glyph for hover
   *  styling. */
  glyphs?: ReadonlyMap<
    string,
    { slot: GlyphSlot; text: string; title?: string }
  >;
  /** R-3 (round 17): 2 renders the stereotype on its own centred
   *  line above the name (UML convention). Default 1 leaves
   *  existing scenes unchanged. */
  headerLines?: 1 | 2;
  /** R-10 (register, 2026-08-05): screen-pixel tap slop before a
   *  click is treated as the end of a pan and suppressed. Defaults
   *  to the pointer's own slop (4px fine, 12px coarse); 0 disables
   *  suppression. */
  clickDragThreshold?: number;
  /** R-9 (register, 2026-08-05): the view transform, CONTROLLED.
   *  Pass it with onViewChange to drive zoom and pan from the host
   *  (custom gestures, a restored viewport, a minimap). Omit both
   *  and the view manages its own transform as before. */
  view?: SvgViewTransform;
  /** Fires on every internal transform change (wheel, pinch, pan,
   *  initial fit), whether or not `view` is controlled. */
  onViewChange?: (view: SvgViewTransform) => void;
  /** R-9: two-pointer pinch zoom. Default true; the gesture scales
   *  about its own midpoint using the same transform as the wheel. */
  pinchZoom?: boolean;
  /** R-12d (round 21): node drag offsets, CONTROLLED. Pass with
   *  onDragOffsetsChange to persist and restore a reader's
   *  arrangement. Omit both and the view keeps them internally as
   *  before. */
  dragOffsets?: Record<string, { dx: number; dy: number }>;
  /** Fires with the complete offset map after every drag step. */
  onDragOffsetsChange?: (
    offsets: Record<string, { dx: number; dy: number }>,
  ) => void;
  /** R-12d: the per-move delta in MODEL units, for hosts that
   *  mutate their own geometry document instead of storing
   *  offsets. */
  onNodeMove?: (nodeId: string, dx: number, dy: number) => void;
  /** R-12a (round 21): per-element presentational overrides, as a
   *  PROP rather than a store subscription, so the view stays pure
   *  and a consumer can scope overrides per surface (the same
   *  element often appears in several views). Build it with
   *  overridesToStructuralStyles.
   *
   *  PRECEDENCE: rowSeverities beats these, and these beat the
   *  theme. A violation tint is a correctness signal; an override
   *  is a preference; the theme is the default. */
  nodeStyles?: ReadonlyMap<string, StructuralNodeStyle>;
  /** R-12c (round 21): a size override is LAYOUT INPUT, not
   *  presentation, so the view reports the request instead of
   *  silently overlapping neighbours and invalidating the routes
   *  computed around the old box. Wire this to mutate the geometry
   *  document and re-run the layout. Unwired, the editor suppresses
   *  the size control rather than offering an inert one. */
  onNodeStyleGeometryChange?: (nodeId: string, size: number) => void;
  input: StructuralGraphInput;
  geometry: StructuralGeometry;
  width: number;
  height: number;
  theme?: StructuralSvgTheme;
  /** Flow direction of the layout that produced `geometry`; the
   *  live drag re-router anchors against it (RTE-011). */
  direction?: "RIGHT" | "LEFT" | "DOWN" | "UP";
  /** LR-46 (owner review 2026-07-22): SHACL-style decorations so
   *  the shapes surface can ride this view. Row ids map to their
   *  worst validation severity (text tint); closed containers get
   *  a heavier border. */
  rowSeverities?: ReadonlyMap<string, "violation" | "warning" | "info">;
  closedContainers?: ReadonlySet<string>;
  "data-testid"?: string;
}

const SEVERITY_TINT: Record<"violation" | "warning" | "info", string> = {
  violation: "#ef4444",
  warning: "#eab308",
  info: "#38bdf8",
};

const FIT_PADDING = 32;

export function StructuralSvgView({
  nodeStyles,
  dragOffsets: dragOffsetsProp,
  onDragOffsetsChange,
  onNodeMove,
  view: viewProp,
  onViewChange,
  pinchZoom = true,
  clickDragThreshold,
  glyphs,
  headerLines = 1,
  input,
  geometry,
  direction = "RIGHT",
  rowSeverities,
  closedContainers,
  width,
  height,
  theme = STRUCTURAL_SVG_DARK,
  "data-testid": testId,
  ...pointerHandlers
}: StructuralSvgViewProps): React.JSX.Element {
  // Fit-to-content initial viewport.
  const fit = useMemo(() => {
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const g of Object.values(geometry.nodes)) {
      if (g.parent !== undefined) continue;
      x1 = Math.min(x1, g.x);
      y1 = Math.min(y1, g.y);
      x2 = Math.max(x2, g.x + g.width);
      y2 = Math.max(y2, g.y + g.height);
    }
    if (!Number.isFinite(x1)) return { k: 1, tx: 0, ty: 0 };
    const k = Math.min(
      (width - 2 * FIT_PADDING) / Math.max(1, x2 - x1),
      (height - 2 * FIT_PADDING) / Math.max(1, y2 - y1),
      1.5,
    );
    return {
      k,
      tx: (width - k * (x2 - x1)) / 2 - k * x1,
      ty: (height - k * (y2 - y1)) / 2 - k * y1,
    };
  }, [geometry, width, height]);

  const [internalView, setInternalView] = useState<SvgViewTransform>(fit);
  // R-9: controlled when `view` is supplied; otherwise internal.
  const view = viewProp ?? internalView;
  // Resolved through the functional updater so no ref is read
  // during render; the controlled prop wins as the base when the
  // host supplies one.
  const setView = useCallback(
    (next: SvgViewTransform | ((v: SvgViewTransform) => SvgViewTransform)) => {
      setInternalView((prev) => {
        const base = viewProp ?? prev;
        return typeof next === "function" ? next(base) : next;
      });
    },
    [viewProp],
  );
  // One notification path for every transform change, internal or
  // from the initial fit.
  React.useEffect(() => {
    onViewChange?.(view);
    // Fires on transform identity, not on handler identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.k, view.tx, view.ty]);
  const [lastFit, setLastFit] = useState(fit);
  if (lastFit !== fit) {
    // New geometry/viewport: reset to the fresh fit (the documented
    // adjust-state-during-render pattern; no refs in render).
    setLastFit(fit);
    setView(fit);
  }
  const drag = useRef<{ x: number; y: number } | null>(null);
  // MR-11 round-3 (owner: "click-drag only works for the entire
  // canvas"): pointer-down now resolves through the hit test. A
  // node body/header grab drags THAT node (rendered through an
  // offset map; its edges' routed polylines are stale during the
  // drag, so they fall back to straight lines, honestly, until
  // RTE-011 wires live rerouting here). Anything else pans.
  const nodeDrag = useRef<{ id: string; lastX: number; lastY: number } | null>(
    null,
  );
  // R-12d (round 21, 2026-08-05): a reader's arrangement was
  // trapped in internal state, so styling could persist while the
  // layout reset on every reload, which reads as the feature being
  // half-broken. Offsets follow the R-9 view precedent exactly:
  // controlled when supplied, internal otherwise, and always
  // reported.
  const [internalOffsets, setInternalOffsets] = useState<
    Record<string, { dx: number; dy: number }>
  >({});
  const dragOffsets = dragOffsetsProp ?? internalOffsets;
  const setDragOffsets = useCallback(
    (
      next: (
        m: Record<string, { dx: number; dy: number }>,
      ) => Record<string, { dx: number; dy: number }>,
    ) => {
      setInternalOffsets((prev) => next(dragOffsetsProp ?? prev));
    },
    [dragOffsetsProp],
  );
  const offsetOf = (ownerId: string): { dx: number; dy: number } =>
    dragOffsets[ownerId] ?? { dx: 0, dy: 0 };
  // RTE-011 (LR-15/22, owner review 2026-07-22): live re-routing.
  // The offsets are applied to a CLONED geometry (moved tops, their
  // rows/child entries by the `id::` convention, and their declared
  // ports), and the pure router runs over it, so dragged elements
  // keep ORTHOGONAL edges and route-anchored labels instead of
  // collapsing to center-to-center lines. The straight fallback
  // below survives only for edges the router skips.
  const portOwner = useMemo(() => {
    const own = new Map<string, string>();
    for (const n of input.nodes) {
      for (const p of n.ports ?? []) own.set(p.id, n.id);
    }
    return own;
  }, [input.nodes]);
  // LR-18: port multiplicities from the INPUT (geometry carries
  // only placement).
  const portMultiplicity = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of input.nodes) {
      for (const p of n.ports ?? []) {
        if (p.multiplicity !== undefined) m.set(p.id, p.multiplicity);
      }
    }
    return m;
  }, [input.nodes]);
  const effectiveGeometry = useMemo(() => {
    const moved = Object.keys(dragOffsets);
    if (moved.length === 0) return geometry;
    const shifted = (
      ownerOf: (id: string) => string | undefined,
      entries: Record<string, { x: number; y: number }>,
    ) => {
      const out: Record<string, { x: number; y: number }> = {};
      for (const [id, g] of Object.entries(entries)) {
        const owner = ownerOf(id);
        const off = owner !== undefined ? dragOffsets[owner] : undefined;
        out[id] = off ? { ...g, x: g.x + off.dx, y: g.y + off.dy } : g;
      }
      return out;
    };
    const topOwner = (id: string) => {
      const head = id.split("::")[0] ?? id;
      return dragOffsets[head] ? head : undefined;
    };
    return {
      ...geometry,
      nodes: shifted(topOwner, geometry.nodes) as typeof geometry.nodes,
      ports: shifted((id) => {
        const declared = portOwner.get(id);
        if (declared !== undefined && dragOffsets[declared]) return declared;
        return topOwner(id);
      }, geometry.ports ?? {}) as typeof geometry.ports,
    };
  }, [geometry, dragOffsets, portOwner]);
  const liveRoutes = useMemo(() => {
    if (Object.keys(dragOffsets).length === 0) return null;
    try {
      return routeStructuralEdges(input, effectiveGeometry, { direction });
    } catch {
      return null; // last-resort fallback below stays honest
    }
  }, [dragOffsets, input, effectiveGeometry, direction]);

  const draggedEdgeFallback = useMemo(() => {
    const moved = new Set(Object.keys(dragOffsets));
    if (moved.size === 0) return new Set<string>();
    const out = new Set<string>();
    for (const e of input.edges) {
      if (moved.has(e.source) || moved.has(e.target)) out.add(e.id);
    }
    return out;
  }, [dragOffsets, input.edges]);

  // INT-001: model point = inverse of the view transform.
  // R-2: the view owns glyph geometry, so it probes for core.
  const glyphAt = useCallback(
    (elementId: string, point: { x: number; y: number }) => {
      const gl = glyphs?.get(elementId);
      if (gl === undefined) return null;
      const gRaw = effectiveGeometry.nodes[elementId];
      if (gRaw === undefined) return null;
      // R-11: a row's glyph is right-aligned in the row band, so it
      // is probed against the row's own geometry rather than a
      // header strip.
      const box =
        gRaw.kind === "row"
          ? {
              x: gRaw.x + gRaw.width - GLYPH_W - GLYPH_PAD,
              y: gRaw.y + (gRaw.height - GLYPH_H) / 2,
            }
          : glyphBox(
              gRaw,
              gRaw.kind === "container"
                ? effectiveGeometry.headerHeight
                : PLAIN_GLYPH_BAND,
              gl.slot,
            );
      return point.x >= box.x &&
        point.x <= box.x + GLYPH_W &&
        point.y >= box.y &&
        point.y <= box.y + GLYPH_H
        ? gl.slot
        : null;
    },
    [glyphs, effectiveGeometry],
  );

  const hit = useCallback(
    (p: { x: number; y: number }) =>
      // VR-1: hit against the OFFSET geometry, matching the render.
      hitTestStructural(input, effectiveGeometry, p, { glyphAt }),
    [input, effectiveGeometry, glyphAt],
  );
  const toModel = useCallback(
    (client: { x: number; y: number }, el: SVGSVGElement) => {
      const r = el.getBoundingClientRect();
      return {
        x: (client.x - r.left - view.tx) / view.k,
        y: (client.y - r.top - view.ty) / view.k,
      };
    },
    [view],
  );
  const pointerProps = useElementPointerEvents<StructuralHit, SVGSVGElement>(
    hit,
    toModel,
    pointerHandlers,
    // R-10 (register, 2026-08-05): forwarded so a consumer can tune
    // tap slop per surface. Undefined keeps the device-derived
    // default (4px fine, 12px coarse).
    { clickDragThreshold },
  );

  // MR-11 round-4 (owner: wheel "zooms the overall application
  // shell and the graph view unreliably"): React attaches wheel
  // listeners PASSIVELY at the root, so a React onWheel cannot
  // preventDefault and the page scrolls the shell while the graph
  // zooms (the "linked" feel). The zoom therefore binds as a NATIVE
  // non-passive listener that preventDefaults. Round-3's lesson
  // stands inside it: event-derived values are captured before the
  // deferred state updater runs.
  const svgRef = useRef<SVGSVGElement | null>(null);
  React.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      // R-9 (register, 2026-08-05): read deltaY's MAGNITUDE instead
      // of stepping by a fixed 1.1. A trackpad pinch and a synthetic
      // wheel are both continuous inputs; quantising them made zoom
      // feel notched and forced consumers to express a smooth pinch
      // as a whole number of steps. Clamped so one chunky mouse
      // notch still lands near the old factor.
      const magnitude = Math.min(Math.abs(e.deltaY) || 100, 400) / 100;
      const factor =
        e.deltaY < 0 ? Math.pow(1.1, magnitude) : Math.pow(1 / 1.1, magnitude);
      const rect = el.getBoundingClientRect();
      setView((v) =>
        zoomAbout(v, factor, e.clientX - rect.left, e.clientY - rect.top),
      );
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);
  // R-9 (register, 2026-08-05): pointers tracked BY ID so a second
  // finger can start a pinch. Previously only one pointer was
  // tracked and touchAction:none suppressed the browser's own
  // pinch, so a touch device could pan but never scale: on a dense
  // diagram most of the scene was unreachable.
  const onDragOffsetsChangeRef = useRef(onDragOffsetsChange);
  const onNodeMoveRef = useRef(onNodeMove);
  React.useEffect(() => {
    onDragOffsetsChangeRef.current = onDragOffsetsChange;
    onNodeMoveRef.current = onNodeMove;
  }, [onDragOffsetsChange, onNodeMove]);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchZoom && pointers.current.size === 2) {
      // The second finger cancels any pan or node drag the first
      // started, so the scene does not slide underneath the scale.
      drag.current = null;
      nodeDrag.current = null;
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinch.current = { dist: Math.hypot(b.x - a.x, b.y - a.y) };
      capturePointer(e);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const model = {
      x: (e.clientX - rect.left - view.tx) / view.k,
      y: (e.clientY - rect.top - view.ty) / view.k,
    };
    // VR-1: offset geometry here too, or a dragged container can
    // never be grabbed again (its region stays at the old spot).
    const h = hitTestStructural(input, effectiveGeometry, model, {
      glyphAt,
    });
    // LR-13 (owner review 2026-07-22): container interiors are
    // covered by ROW hits, which used to fall through to canvas pan,
    // leaving only the thin header and the 4px border as container
    // grab targets ("very difficult to trigger a container move").
    // A row grab now drags its CONTAINER (the row's geometry parent),
    // and the border band counts as a grab too.
    const dragId =
      h === null
        ? undefined
        : h.kind === "node" &&
            (h.zone === "body" || h.zone === "header" || h.zone === "border")
          ? h.elementId
          : h.kind === "row"
            ? geometry.nodes[h.elementId]?.parent
            : undefined;
    if (dragId !== undefined) {
      nodeDrag.current = {
        id: dragId,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    } else if (!isAffordanceZone(h)) {
      // R-10 (upstream register, 2026-08-05): a press on an
      // AFFORDANCE must not start a canvas pan. Pressing a glyph is
      // an intent to act on that element; with a mouse the pan was
      // invisible because a click does not wobble, but a finger
      // dragged the whole scene out from under every tap. Affordance
      // zones neither drag their node nor pan the canvas.
      drag.current = { x: e.clientX, y: e.clientY };
    }
    capturePointer(e);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinch.current !== null && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const prev = pinch.current.dist;
      if (prev > 0 && dist > 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        // Scale about the gesture MIDPOINT, the same transform the
        // wheel applies about the cursor.
        setView((v) =>
          zoomAbout(
            v,
            dist / prev,
            (a.x + b.x) / 2 - rect.left,
            (a.y + b.y) / 2 - rect.top,
          ),
        );
        pinch.current = { dist };
      }
      return;
    }
    const nd = nodeDrag.current;
    if (nd) {
      const dx = (e.clientX - nd.lastX) / view.k;
      const dy = (e.clientY - nd.lastY) / view.k;
      nd.lastX = e.clientX;
      nd.lastY = e.clientY;
      setDragOffsets((m) => {
        const cur = m[nd.id] ?? { dx: 0, dy: 0 };
        const nextOffsets = {
          ...m,
          [nd.id]: { dx: cur.dx + dx, dy: cur.dy + dy },
        };
        onDragOffsetsChangeRef.current?.(nextOffsets);
        return nextOffsets;
      });
      // R-12d: the per-move delta, for hosts that mutate their own
      // geometry document rather than storing offsets.
      onNodeMoveRef.current?.(nd.id, dx, dy);
      return;
    }
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };
  const onPointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (e !== undefined) pointers.current.delete(e.pointerId);
    else pointers.current.clear();
    // R-9: lifting one finger ends the pinch; the remaining finger
    // does NOT silently become a pan, or the scene lurches from the
    // stale down-point.
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
    nodeDrag.current = null;
  };

  const edgeKind = useMemo(() => {
    const m = new Map<string, { kind: UmlEdgeKind; label?: string }>();
    for (const e of input.edges) {
      m.set(e.id, {
        kind: (e.kind ?? "association") as UmlEdgeKind,
        label: e.label,
      });
    }
    return m;
  }, [input.edges]);

  const nodes = Object.entries(geometry.nodes);
  const containers = nodes.filter(([, g]) => g.kind === "container");
  const rows = nodes.filter(([, g]) => g.kind === "row");
  const plain = nodes.filter(([, g]) => g.kind === "node");
  const headerH = geometry.headerHeight;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-testid={testId}
      role="img"
      style={{
        // G2 (owner 2026-07-28): dragging swept text into the
        // browser selection across containers; labels are not
        // user-selectable content in a diagram.
        userSelect: "none",
        background: theme.background,
        cursor: "grab",
        touchAction: "none",
      }}
      ref={svgRef}
      onClick={pointerProps.onClick}
      onContextMenu={pointerProps.onContextMenu}
      onPointerLeave={pointerProps.onPointerLeave}
      onPointerDown={(e) => {
        pointerProps.onPointerDown(e);
        onPointerDown(e);
      }}
      onPointerMove={(e) => {
        pointerProps.onPointerMove(e);
        onPointerMove(e);
      }}
      onPointerUp={(e) => {
        pointerProps.onPointerUp(e);
        onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        // R-9: a cancelled touch (scroll takeover, call, palm) must
        // release its slot or the registry keeps a phantom finger
        // and the next tap looks like a pinch.
        onPointerUp(e);
      }}
    >
      <g
        data-ssv-scene=""
        transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}
      >
        {/* Containers: body, header strip, header text. */}
        {containers.map(([id, gRaw]) => {
          const off = offsetOf(id);
          const g = { ...gRaw, x: gRaw.x + off.dx, y: gRaw.y + off.dy };
          const header = input.nodes.find((n) => n.id === id)?.header;
          const closed = closedContainers?.has(id) === true;
          // VR-27 v2 (owner 2026-07-28): no keyword; OPEN shapes
          // draw a DASHED border instead (closed stays solid and
          // heavier). Only where the scene distinguishes at all
          // (closedContainers provided): MBSE containers unaffected.
          const distinguishClosed = closedContainers !== undefined;
          // R-3 (round 17, 2026-07-28): UML convention puts the
          // stereotype on its OWN line above the name; on one line
          // it competes with long names for the same horizontal
          // budget. headerLines=2 opts in; 1 (default) is unchanged.
          const twoLine =
            headerLines === 2 &&
            header?.stereotype !== undefined &&
            header.name !== undefined;
          const title = header
            ? `${header.stereotype ? `\u00ab${header.stereotype}\u00bb ` : ""}${header.name}`
            : (g.text ?? id);
          const glyph = glyphs?.get(id);
          return (
            <g key={id} data-ssv-node={id} data-ssv-kind="container">
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                rx={4}
                fill={nodeStyles?.get(id)?.fill ?? theme.containerFill}
                stroke={nodeStyles?.get(id)?.stroke ?? theme.containerStroke}
                opacity={nodeStyles?.get(id)?.opacity}
                strokeWidth={
                  nodeStyles?.get(id)?.strokeWidth ?? (closed ? 2.4 : 1.2)
                }
                strokeDasharray={
                  distinguishClosed && !closed ? "6 3" : undefined
                }
                data-ssv-closed={closed ? "" : undefined}
                data-ssv-open={distinguishClosed && !closed ? "" : undefined}
              />
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={headerH}
                rx={4}
                fill={theme.headerFill}
              />
              {twoLine && header ? (
                <>
                  <text
                    x={g.x + g.width / 2}
                    y={g.y + headerH / 2 - 3}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={500}
                    fill={theme.headerText}
                    data-ssv-header-stereotype={id}
                  >
                    {`\u00ab${header.stereotype ?? ""}\u00bb`}
                  </text>
                  <text
                    x={g.x + g.width / 2}
                    y={g.y + headerH / 2 + 11}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill={theme.headerText}
                    data-ssv-header={id}
                  >
                    {header.name}
                  </text>
                </>
              ) : (
                <text
                  x={g.x + g.width / 2}
                  y={g.y + headerH / 2 + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={700}
                  fill={theme.headerText}
                  data-ssv-header={id}
                >
                  {title}
                </text>
              )}
              {glyph !== undefined && (
                <g
                  className="g3t-ssv-glyph"
                  data-ssv-glyph={id}
                  data-ssv-glyph-slot={glyph.slot}
                  style={{ cursor: "pointer" }}
                >
                  <title>{glyph.title ?? glyph.text}</title>
                  <rect
                    x={glyphBox(g, headerH, glyph.slot).x}
                    y={glyphBox(g, headerH, glyph.slot).y}
                    width={GLYPH_W}
                    height={GLYPH_H}
                    rx={3}
                    fill={theme.headerFill}
                    stroke={theme.containerStroke}
                    strokeWidth={1}
                  />
                  <text
                    x={glyphBox(g, headerH, glyph.slot).x + GLYPH_W / 2}
                    y={glyphBox(g, headerH, glyph.slot).y + GLYPH_H / 2 + 3.5}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill={theme.headerText}
                  >
                    {glyph.text}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Compartment rows (divider titles styled separately). */}
        {rows.map(([id, gRaw]) => {
          const off = offsetOf(gRaw.parent ?? id);
          const g = { ...gRaw, x: gRaw.x + off.dx, y: gRaw.y + off.dy };
          const severity = rowSeverities?.get(id);
          return (
            <g key={id}>
              {/* LR-23 (owner review 2026-07-22): a simple horizontal
                  separator above each section divider (id vs text,
                  attribute compartments), the classic UML
                  compartment line. */}
              {g.divider === true ? (
                <line
                  x1={g.x}
                  y1={g.y}
                  x2={g.x + g.width}
                  y2={g.y}
                  stroke={theme.containerStroke}
                  strokeWidth={0.8}
                  data-ssv-row-divider={id}
                />
              ) : null}
              <text
                /* LR-14 (owner review 2026-07-22): sections and
                 attributes CENTER, matching the cytoscape
                 compartment presentation. */
                x={g.x + g.width / 2}
                y={g.y + g.height / 2 + 3.5}
                textAnchor="middle"
                fontSize={g.divider ? 9.5 : 10.5}
                fontStyle={g.divider ? "italic" : undefined}
                fill={
                  severity !== undefined
                    ? SEVERITY_TINT[severity]
                    : g.divider
                      ? theme.dividerText
                      : theme.rowText
                }
                data-ssv-row={id}
                data-ssv-row-severity={severity}
              >
                {g.text ?? ""}
              </text>
              {/* R-11 (register, 2026-08-05): a row can carry the
                  same affordance as a node. Without it a reader
                  learns that the icon is the button and then meets
                  rows where the whole line is the button instead;
                  with navigation bound to zone "glyph" as the
                  interaction contract advises, a container's
                  contents were readable and unreachable. The row
                  glyph is right-aligned inside the row band. */}
              {(() => {
                const rg = glyphs?.get(id);
                if (rg === undefined) return null;
                const bx = g.x + g.width - GLYPH_W - GLYPH_PAD;
                const by = g.y + (g.height - GLYPH_H) / 2;
                return (
                  <g
                    className="g3t-ssv-glyph"
                    data-ssv-glyph={id}
                    data-ssv-glyph-slot="row"
                    style={{ cursor: "pointer" }}
                  >
                    <title>{rg.title ?? rg.text}</title>
                    <rect
                      x={bx}
                      y={by}
                      width={GLYPH_W}
                      height={GLYPH_H}
                      rx={3}
                      fill={theme.headerFill}
                      stroke={theme.containerStroke}
                      strokeWidth={1}
                    />
                    <text
                      x={bx + GLYPH_W / 2}
                      y={by + GLYPH_H / 2 + 3.5}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={600}
                      fill={theme.headerText}
                    >
                      {rg.text}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Plain nodes. */}
        {plain.map(([id, gRaw]) => {
          const off = offsetOf(id);
          const g = { ...gRaw, x: gRaw.x + off.dx, y: gRaw.y + off.dy };
          // R-5 (upstream register, 2026-08-03): glyphs and
          // headerLines were CONTAINER-ONLY, so a scene rendered
          // inconsistently by node shape rather than by anything the
          // consumer asked for, and a consumer following our own
          // guidance to navigate from zone "glyph" silently lost
          // navigation on every node without compartments. Both
          // features apply here too; a plain node has no header
          // strip, so the glyph sits inside the box's own corner and
          // the two-line form splits the label.
          const header = input.nodes.find((n) => n.id === id)?.header;
          const twoLine =
            headerLines === 2 &&
            header?.stereotype !== undefined &&
            header.name !== undefined;
          const glyph = glyphs?.get(id);
          const label = g.text ?? header?.name ?? id;
          return (
            <g key={id} data-ssv-node={id} data-ssv-kind="node">
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                rx={6}
                fill={nodeStyles?.get(id)?.fill ?? theme.nodeFill}
                stroke={nodeStyles?.get(id)?.stroke ?? theme.containerStroke}
                opacity={nodeStyles?.get(id)?.opacity}
                strokeWidth={nodeStyles?.get(id)?.strokeWidth ?? 1.2}
              />
              {twoLine && header ? (
                <>
                  <text
                    x={g.x + g.width / 2}
                    y={g.y + g.height / 2 - 3}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={500}
                    fill={theme.nodeText}
                    data-ssv-label-stereotype={id}
                  >
                    {`\u00ab${header.stereotype ?? ""}\u00bb`}
                  </text>
                  <text
                    x={g.x + g.width / 2}
                    y={g.y + g.height / 2 + 10}
                    textAnchor="middle"
                    fontSize={11}
                    fill={theme.nodeText}
                    data-ssv-label={id}
                  >
                    {header.name}
                  </text>
                </>
              ) : (
                <text
                  x={g.x + g.width / 2}
                  y={g.y + g.height / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill={theme.nodeText}
                  data-ssv-label={id}
                >
                  {label}
                </text>
              )}
              {glyph !== undefined && (
                <g
                  className="g3t-ssv-glyph"
                  data-ssv-glyph={id}
                  data-ssv-glyph-slot={glyph.slot}
                  style={{ cursor: "pointer" }}
                >
                  <title>{glyph.title ?? glyph.text}</title>
                  <rect
                    x={glyphBox(g, PLAIN_GLYPH_BAND, glyph.slot).x}
                    y={glyphBox(g, PLAIN_GLYPH_BAND, glyph.slot).y}
                    width={GLYPH_W}
                    height={GLYPH_H}
                    rx={3}
                    fill={theme.headerFill}
                    stroke={theme.containerStroke}
                    strokeWidth={1}
                  />
                  <text
                    x={
                      glyphBox(g, PLAIN_GLYPH_BAND, glyph.slot).x + GLYPH_W / 2
                    }
                    y={
                      glyphBox(g, PLAIN_GLYPH_BAND, glyph.slot).y +
                      GLYPH_H / 2 +
                      3.5
                    }
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill={theme.headerText}
                  >
                    {glyph.text}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Edges: routed polylines, arrow-trimmed shafts, UML
            symbols, mid labels. */}
        {Object.entries(geometry.edges ?? {}).map(([id, egRaw]) => {
          const meta = edgeKind.get(id);
          if (!meta) return null;
          // Dragged endpoints make the routed polyline stale: fall
          // back to a straight offset-aware center line (data-ssv-
          // edge-fallback marks it for tests and for the eye).
          let eg = egRaw;
          let fallback = false;
          const live = liveRoutes?.[id];
          if (draggedEdgeFallback.has(id) && live) {
            eg = live; // RTE-011: routed against the offset geometry
          } else if (draggedEdgeFallback.has(id)) {
            const edge = input.edges.find((x) => x.id === id);
            const sG = edge ? geometry.nodes[edge.source] : undefined;
            const tG = edge ? geometry.nodes[edge.target] : undefined;
            if (edge && sG && tG) {
              const so = offsetOf(edge.source);
              const to = offsetOf(edge.target);
              eg = {
                points: [
                  {
                    x: sG.x + sG.width / 2 + so.dx,
                    y: sG.y + sG.height / 2 + so.dy,
                  },
                  {
                    x: tG.x + tG.width / 2 + to.dx,
                    y: tG.y + tG.height / 2 + to.dy,
                  },
                ],
              };
              fallback = true;
            }
          }
          const shapes = arrowShapes(meta.kind, eg.points);
          let pts = eg.points;
          for (const s of shapes) {
            pts = shortenPolyline(pts, s.end, s.trim);
          }
          const d = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
            .join(" ");
          // Owner 2026-07-28 (shapes note + the IBD Imagery/Cmd
          // collision): labels anchor at the TARGET end, backed off
          // along the final segment and offset perpendicular, not at
          // the route's middle vertex (which is a bend on most
          // orthogonal routes and collides where fans converge).
          const labelAt = (():
            | { x: number; y: number; anchor: "start" | "middle" | "end" }
            | undefined => {
            const pts = eg.points;
            const b = pts[pts.length - 1];
            const a = pts[pts.length - 2] ?? b;
            if (b === undefined || a === undefined) return undefined;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            // Owner 2026-07-28 v2: port labels own the quadrant
            // ABOVE E/W ports and RIGHT of N/S ports, so edge
            // labels take the OPPOSITE quadrant: below the line on
            // horizontal approaches, left of the line on vertical
            // ones. Disjoint by construction.
            if (Math.abs(dx) >= Math.abs(dy)) {
              const back = Math.min(12, Math.abs(dx) / 2);
              return {
                x: b.x - Math.sign(dx || 1) * back,
                y: b.y + 12,
                anchor: dx >= 0 ? "end" : "start",
              };
            }
            const back = Math.min(12, Math.abs(dy) / 2);
            return {
              x: b.x - 8,
              y: b.y - Math.sign(dy || 1) * back + 3,
              anchor: "end",
            };
          })();
          return (
            <g key={id} data-ssv-edge={id}>
              <path
                d={d}
                fill="none"
                stroke={theme.edgeStroke}
                strokeWidth={1.5}
                strokeDasharray={isDashedKind(meta.kind) ? "6 4" : undefined}
                data-ssv-edge-path={id}
                {...(fallback ? { "data-ssv-edge-fallback": id } : {})}
              />
              {shapes.map((s, i) => (
                <path
                  key={i}
                  d={s.d}
                  stroke={theme.edgeStroke}
                  strokeWidth={1.5}
                  fill={s.fill === "stroke" ? theme.edgeStroke : "none"}
                  data-ssv-arrow={`${id}:${s.end}`}
                />
              ))}
              {meta.label !== undefined && labelAt !== undefined && (
                <text
                  x={labelAt.x}
                  y={labelAt.y}
                  textAnchor={labelAt.anchor}
                  fontSize={9}
                  fill={theme.edgeLabel}
                  data-ssv-edge-label={id}
                >
                  {meta.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Boundary ports above everything. */}
        {Object.entries(geometry.ports).map(([id, pRaw]) => {
          const off = offsetOf(pRaw.node);
          const p = { ...pRaw, x: pRaw.x + off.dx, y: pRaw.y + off.dy };
          // LR-18 (owner review 2026-07-22): ports carry their OWN
          // name labels (the local part of the port id), side-aware
          // anchored beside the port: what read as mis-anchored
          // "edge labels" in the IBD were edge labels doing double
          // duty for unlabeled ports. Case passes through as
          // authored.
          // VR-26 (owner re-verify 2026-07-28): shapes-scene port
          // ids are URIs; a "."-split pops the URI tail, not a
          // name. Cut at the LAST of #, /, or "." instead.
          const cut = Math.max(
            id.lastIndexOf("#"),
            id.lastIndexOf("/"),
            id.lastIndexOf("."),
          );
          const localName = cut >= 0 ? id.slice(cut + 1) : id;
          const mult = portMultiplicity.get(id);
          // LR-18: SysML-style multiplicity beside the port name.
          const name =
            mult !== undefined ? `${localName} [${mult}]` : localName;
          // G1 (owner 2026-07-28, v3 of this placement): OUTSIDE
          // the container beside the port (inside placement sat on
          // top of container rows), offset PERPENDICULAR to the
          // port axis so the label clears the wire, which exits at
          // the port's center line (the VR-10 ask).
          const labelPos =
            p.side === "EAST"
              ? {
                  x: p.x + p.width + 3,
                  y: p.y - 3,
                  anchor: "start" as const,
                }
              : p.side === "WEST"
                ? {
                    x: p.x - 3,
                    y: p.y - 3,
                    anchor: "end" as const,
                  }
                : p.side === "SOUTH"
                  ? {
                      x: p.x + p.width + 4,
                      y: p.y + p.height + 10,
                      anchor: "start" as const,
                    }
                  : {
                      x: p.x + p.width + 4,
                      y: p.y - 4,
                      anchor: "start" as const,
                    };
          return (
            <g key={id}>
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill={theme.portFill}
                stroke={theme.containerStroke}
                strokeWidth={0.8}
                data-ssv-port={id}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor={labelPos.anchor}
                fontSize={8.5}
                fill={theme.rowText}
                data-ssv-port-label={id}
              >
                {name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
