/**
 * CytoscapeCanvas: React wrapper around Cytoscape.js.
 *
 * Accepts a UGM instance, maps it to Cytoscape elements, and renders
 * with the Okabe-Ito colorblind-safe palette (R7.8).
 *
 * @see specs/01-functional-views.md R1.1
 * @see specs/02-functional-interaction.md R2.1, R2.2
 * @see specs/09-design-decisions.md D2, D3, D9, D13
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import cytoscape, { type Core } from "cytoscape";
import { registerBoxSelectionSync } from "./box-selection-sync";
import fcose from "cytoscape-fcose";
import type { UGM } from "@g3t/core";
import { applyEncodingSpec } from "../../interaction/encoding/spec-apply";
import { useStyleOverrideStore } from "../../state/style-override-store";
import {
  usePositionPinStore,
  computeLockedIds,
} from "../../state/position-pin-store";
import {
  useOverlayStore,
  computeOverlayMembership,
} from "../../state/overlay-store";
/** Filled pin badge (round 26, finding 1a). The glyph is the
 *  registry pin SHAPE, but rendered filled in the theme's warning
 *  accent with a canvas-colored halo stroke underneath, so the badge
 *  separates cleanly from whatever node or container color it
 *  overlaps (the same punch-out trick map pins use). Theme-resolved:
 *  the pin effect re-composes on theme change. */
/** Compose the pinned-node background stack: the encoding icon (when
 *  the node carries one) centered at 60%, the pin badge top-right at
 *  a FIXED 16px (percentages distorted on compound parents; finding
 *  1b). Review 4.7: this must run at EVERY _icon write, not just at
 *  pin time; a spec application after pinning previously left the
 *  stack stale (badge-only), which read as "pin and custom icon
 *  cannot coexist". Single truth: both the pin effect and the
 *  spec-patch path call this.
 */
/** Style props the pin indicator bypasses; removed as one set on
 *  unpin so the node's rule-driven appearance returns intact. */
export const PIN_BYPASS_PROPS = [
  "background-image",
  "background-position-x",
  "background-position-y",
  "background-width",
  "background-height",
  "background-fit",
  "background-clip",
  "background-image-containment",
] as const;

/** LR-37: icon overrides must travel as _icon DATA (the single truth
 *  shared by the node[_icon] class rule and composePinStack), never
 *  as a flat background-image bypass that clobbers a pinned node's
 *  composed stack. Pure split, unit-tested. */
export function splitIconFromOverrideStyle(style: Record<string, unknown>): {
  style: Record<string, unknown>;
  iconUri: string | undefined;
} {
  const out = { ...style };
  const iconUri = out["background-image"] as string | undefined;
  delete out["background-image"];
  delete out["background-fit"];
  delete out["background-clip"];
  return { style: out, iconUri };
}

export function composePinStack(
  n: {
    data: (k: string) => unknown;
    style: (props: Record<string, unknown>) => void;
  },
  badge: string,
): void {
  // 12.1 (two browser failures against the previous approach): the
  // pinned CLASS RULE mapped multi-image background properties via
  // data() with ARRAY values, and the badge never rendered. Literal
  // arrays as per-element style BYPASSES are Cytoscape's documented
  // multi-background usage; mappings are the unreliable corner.
  // Bypass precedence over class rules is safe here: emphasis dims
  // via opacity and hidden toggles display, so nothing legitimate
  // needs to override a pinned node's background.
  const icon = n.data("_icon") as string | undefined;
  n.style({
    "background-image": icon ? [icon, badge] : [badge],
    "background-position-x": icon ? ["50%", "100%"] : ["100%"],
    "background-position-y": icon ? ["50%", "0%"] : ["0%"],
    "background-width": icon ? ["60%", "16px"] : ["16px"],
    "background-height": icon ? ["60%", "16px"] : ["16px"],
    "background-fit": icon ? ["none", "none"] : ["none"],
    "background-clip": "none",
    "background-image-containment": "over",
  });
}

export function pinBadgeUri(theme: G3tTheme): string {
  const paths =
    '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 15v6"/>';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">' +
    `<g fill="${theme.canvasBg}" stroke="${theme.canvasBg}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">${paths}</g>` +
    `<g fill="${theme.warning}" stroke="${theme.warning}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${paths}</g>` +
    "</svg>";
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
import { useThemeStore, type G3tTheme } from "../../theme/ThemeManager";
import { StructuralEdgeOverlay } from "./structural-edge-overlay";
import { overridesToCytoscapeStyles } from "@g3t/core";
import type { EncodingSpec } from "../../interaction/encoding/encoding-spec";
import {
  ContextMenuManager,
  createDefaultMenuManager,
} from "../../interaction/context-menu";
import type { MenuTarget } from "../../interaction/context-menu";
import { ContextMenu } from "../../interaction/context-menu";
import { useSelectionStore } from "../../state/selection-store";
import {
  applyEmphasisClasses,
  useEmphasisStore,
} from "../../state/emphasis-store";
import {
  ugmToCytoscapeElements,
  type ContainmentOptions,
} from "./ugm-to-cytoscape";
import {
  structuralToCytoscapeElements,
  applyRoutedSegmentBypasses,
  STRUCTURAL_RULES,
  structuralThemeRules,
  wireStructuralPortDrag,
} from "./structural-to-cytoscape";
import type { StructuralDecorations } from "./structural-to-cytoscape";
import type { StructuralGraphInput, StructuralGeometry } from "@g3t/core";
import {
  prefersReducedMotion,
  routeSceneEdges,
  polylineToCytoscapeSegments,
  optimizePlacement,
  type SceneEdgeEndpoints,
  type SceneNodeBox,
  type PlacementNode,
  type PlacementEdge,
} from "@g3t/core";

export type CyStylesheet = cytoscape.StylesheetCSS | cytoscape.StylesheetStyle;

// Register fcose layout extension (once, at module load)
let fcoseRegistered = false;

function ensureFcose(): void {
  if (fcoseRegistered) return;
  try {
    cytoscape.use(fcose);
    fcoseRegistered = true;
  } catch {
    // fcose registration failed; fall back to built-in layouts
  }
}

/**
 * Default Cytoscape stylesheet.
 *
 * Visual encoding rules:
 * - Node shape and color from palette (types[0] index)
 * - Node label from properties.name or id
 * - Node size from properties.size or default 30
 * - Edge opacity from confidence (D1)
 * - Edge style: solid if asserted (_asserted=1), dashed if inferred (_asserted=0) (D9)
 * - Directed edges get arrowheads
 */
/* eslint-disable @typescript-eslint/no-explicit-any --
   Cytoscape's TS types don't accept "data(x)" strings for shape/opacity
   even though they work at runtime. We cast style objects to any. */
/** Data-driven edge rules for spec-applied channels. Attribute-
 *  presence selectors keep them inert for edges the spec leaves
 *  unpatched (legacy fixed style owns those). Exported for tests. */
export const ENCODING_EDGE_RULES: CyStylesheet[] = [
  {
    selector: "edge[_ewidth]",

    style: { width: "data(_ewidth)" } as any,
  },
  {
    selector: "edge[_ecolor]",

    style: {
      "line-color": "data(_ecolor)",
      "target-arrow-color": "data(_ecolor)",
    } as any,
  },
];

/** Spec-applied node glyphs: background-image only for nodes the
 *  patch stamped (_icon is an SVG data URI; see iconDataUri). */
export const ENCODING_NODE_RULES: CyStylesheet[] = [
  {
    selector: "node[_icon]",

    style: {
      "background-image": "data(_icon)",
      "background-fit": "none",
      "background-width": "60%",
      "background-height": "60%",
      "background-clip": "none",
    } as any,
  },
];

/** Algorithm overlay rendering (round 21): the reserved borderWeight
 *  owner, realized. Members of active overlays carry emphasized
 *  borders/lines via the g3t-ov-member class; with any overlay
 *  active, non-members dim via g3t-ov-dim. Classes only: deactivation
 *  strips them and the prior styling returns by construction.
 *  Documented precedence note: instance pins (bypass styles) shadow
 *  overlay borders on the pinned element, deliberately: an explicit
 *  per-node act outranks a computed emphasis. */
export const OVERLAY_RULES: CyStylesheet[] = [
  {
    selector: "node.g3t-ov-member",

    style: { "border-width": 3, "border-color": "#2f9e44" } as any,
  },
  {
    selector: "edge.g3t-ov-member",

    style: {
      width: 3.5,
      "line-color": "#2f9e44",
      "target-arrow-color": "#2f9e44",
    } as any,
  },
  {
    selector: ".g3t-ov-dim",

    style: { opacity: 0.2 } as any,
  },
];

/** Theme-resolved canvas colors (round 20: the theme->canvas wiring,
 *  closing the gap behind two shipped regressions). Generic selectors
 *  only: the spec's attribute-selector mappers (node[_icon],
 *  edge[_ecolor], ...) are more specific and win by construction, so
 *  theming never fights the encoding. Merged after the structural
 *  defaults (theme beats fallback literals) and before the user
 *  stylesheet (adopter overrides beat theme). */
export function themeColorRules(theme: G3tTheme): CyStylesheet[] {
  return [
    {
      selector: "node",

      style: {
        color: theme.nodeLabelColor,
        "text-outline-color": theme.canvasBg,
      } as any,
    },
    {
      selector: "edge",

      style: {
        "line-color": theme.edgeColor,
        "target-arrow-color": theme.edgeColor,
        "text-background-color": theme.canvasBg,
        "text-border-color": theme.border,
        color: theme.nodeLabelColor,
      } as any,
    },
    {
      selector: "node.g3t-selected",

      style: { "outline-color": theme.selectionHighlight } as any,
    },
    {
      selector: "edge.g3t-selected",

      style: {
        "line-color": theme.edgeSelectedColor,
        "target-arrow-color": theme.edgeSelectedColor,
      } as any,
    },
    {
      // Emphasis layer (review 4.6): effect edges are visually
      // DISTINCT from selection (amber, heavier), and dimmed elements
      // fade rather than hide. Nodes in an effect carry no class at
      // all: a route member is not a selection.
      selector: "edge.g3t-effect-edge",

      style: {
        "line-color": "#f08c00",
        "target-arrow-color": "#f08c00",
        width: 4,
      } as any,
    },
    {
      selector: ".g3t-effect-dim",

      style: { opacity: 0.15 } as any,
    },
    {
      selector: ":parent",

      style: {
        "background-color": theme.bgSecondary,
        "border-color": theme.border,
        color: theme.textPrimary,
      } as any,
    },
    {
      selector: "node.g3t-ov-member",

      style: { "border-color": theme.success } as any,
    },
    {
      selector: "edge.g3t-ov-member",

      style: {
        "line-color": theme.success,
        "target-arrow-color": theme.success,
      } as any,
    },
  ];
}

/** Compound containers (slice 1): the UML element look. Containers
 *  render as light-filled, bordered rectangles with the
 *  «Stereotype» + name label pinned to the top; children lay out
 *  inside (fcose is compound-aware). */
export const COMPOUND_CONTAINER_RULE: CyStylesheet = {
  selector: ":parent",

  style: {
    shape: "round-rectangle",
    // Neutral mid-tone literals: Cytoscape cannot read CSS variables,
    // and the canvas does not yet merge deriveCytoscapeStyle (a
    // pre-existing gap, recorded round 17 in
    // roadmap/design/toolbar-and-layouts.md: theme->canvas wiring).
    // 35% opacity over the canvas bg keeps containers subtle in both
    // light and dark themes; ThemeManager's :parent rule carries the
    // theme-resolved colors for hosts that do merge the derivation.
    "background-color": "#f1f3f5",
    "background-opacity": 0.35,
    "border-width": 1.5,
    "border-color": "#adb5bd",
    label: "data(_compoundLabel)",
    "text-valign": "top",
    "text-halign": "center",
    "text-wrap": "wrap",
    "text-margin-y": 4,
    "font-size": 11,
    padding: 14,
  } as any,
};

/** Subtle position-pin indicator: a soft underlay hugging the node
 *  (the selection gasket is an OFFSET outline; the two compose
 *  without collision). */
/** Position-pin badge (round 25, replacing the round-18 amber
 *  underlay after review: a halo is hard to read under multiselect
 *  and other overlapping emphasis). Pinned nodes show the registry's
 *  PIN GLYPH as a badge at the node's top-right, composed through
 *  stacked background images. The pin effect writes the parallel
 *  arrays into element data (_bgStack and friends) so glyph-bearing
 *  nodes keep their encoding icon centered with the badge beside it,
 *  and plain nodes get the badge alone; unlocking removes the data
 *  and the rule stops matching. Amber stroke keeps the established
 *  pin hue (CVD-safe against the blue selection gasket). */
export const PIN_INDICATOR_RULE: CyStylesheet = {
  // 12.1: the visual now rides per-element bypasses (composePinStack);
  // this rule keeps the class in the stylesheet vocabulary but maps
  // NOTHING (data()-mapped array values for background-* were the
  // two-browser-failure root cause and are gone for good).
  selector: "node.g3t-pinned",
  style: {},
};

export const DEFAULT_STYLESHEET: CyStylesheet[] = [
  {
    selector: "node",
    style: {
      // label/background-color/shape moved to [field]-scoped rules below:
      // applying data(label|_color|_shape) to nodes that lack those fields
      // (structural block sub-elements carry _label/_w/_h and are colored by
      // their class rules) makes Cytoscape log a mapping warning for each
      // such element on every render frame; in the block view that console
      // flood (hundreds of structural sub-nodes) blocks the main thread.
      // Same failure and fix as the _size/_confidence scoping.
      "text-valign": "bottom",
      "text-halign": "center",
      "font-size": "10px",
      "text-margin-y": 4,
      "min-zoomed-font-size": 8,
      // Long labels (biomedical names, raw-triple literals) rendered on
      // one unwrapped line collide with neighboring nodes' labels; wrap
      // at a width close to the default node footprint instead.
      "text-wrap": "wrap",
      "text-max-width": "110px",
      // Bugfix 6: cartographic halo style - readable on light AND dark
      // backgrounds without per-theme branching
      color: "#e0e0e0",
      "text-outline-color": "#1a1a1a",
      "text-outline-width": 2,
      "text-outline-opacity": 0.8,
    } as any,
  },
  {
    // Data-driven label/color/shape only where the field exists (UGM force
    // and encoded nodes set all three together in ugm-to-cytoscape); this
    // spares structural block sub-elements the per-frame mapping warning.
    // Each property is guarded by its own field so a node carrying one but
    // not another still never warns.
    selector: "node[label]",
    style: { label: "data(label)" } as any,
  },
  {
    selector: "node[_color]",
    style: { "background-color": "data(_color)" } as any,
  },
  {
    selector: "node[_shape]",
    style: { shape: "data(_shape)" } as any,
  },
  {
    // Only nodes that actually carry _size get data-driven sizing; this
    // keeps force/encoded nodes sized while sparing structural nodes the
    // per-frame mapping warning (see the node rule above).
    selector: "node[_size]",
    style: {
      width: "data(_size)",
      height: "data(_size)",
    } as any,
  },
  {
    // Holon boundary ring (specs/05 boundary view): the annulus between
    // the holon's interior and the outside is node STYLING, not extra
    // graph elements. Double border reads as a ring on both plain and
    // compound (containment-parent) holon nodes.
    selector: "node[_boundaryRing]",
    style: {
      "border-width": 6,
      "border-style": "double",
      "border-color": "#c9a227",
      "border-opacity": 0.9,
    } as any,
  },
  {
    // External holon stubs in the boundary view: de-emphasized so the
    // published subgraph inside the ring carries the visual weight.
    selector: "node[_portalStub]",
    style: {
      "background-opacity": 0.35,
      "border-width": 1,
      "border-style": "dashed",
      "border-color": "#888",
    } as any,
  },
  {
    selector: "edge",
    style: {
      // label moved to the edge[label] rule below (same per-frame mapping
      // warning story: structural connectors carry _label, not label).
      width: 2,
      "line-color": "#888",
      "target-arrow-color": "#888",
      "target-arrow-shape": "triangle",
      // F8: curve-style set dynamically via buildEdgeStyle()
      // Bugfix 21: default to straight - cleaner for the common case of
      // a single edge between two distinct nodes. The selector rule
      // immediately below this one overrides to bezier when the edge
      // is part of a parallel set, a bidirectional pair, or a loop;
      // see ugmToCytoscapeElements which marks _curveStyle per edge.
      "curve-style": "straight",
      "font-size": "8px",
      "text-rotation": "autorotate",
      // opacity moved to the `edge[_confidence]` rule below: data(_confidence)
      // on edges without _confidence (structural connectors) makes Cytoscape
      // warn per edge per render frame, flooding the console.
      // F7: Link label styling (Bugfix 6: dark bg readable on dark canvas)
      "text-background-color": "#222",
      "text-background-opacity": 0.7,
      "text-background-padding": "3px",
      "text-border-color": "#555",
      "text-border-width": 1,
      "text-border-opacity": 0.6,
      color: "#ddd",
    } as any,
  },
  {
    // Only edges that carry _confidence get the opacity mapping; this
    // spares structural connectors the per-frame mapping warning (see the
    // edge rule above).
    selector: "edge[_confidence]",
    style: {
      opacity: "data(_confidence)",
    } as any,
  },
  {
    // Data-driven label only where present; structural connectors carry
    // _label (rendered by their class rule), not label.
    selector: "edge[label]",
    style: {
      label: "data(label)",
    } as any,
  },
  {
    // Portal transit glyph (specs/05 boundary view): a mid-edge marker
    // makes the point where a portal edge crosses the boundary ring
    // legible. Position is wherever the router puts the edge; no anchor
    // constraint solving. CONSTRUCT-backed portals get a distinct
    // diamond via the [_hasConstruct] override below.
    selector: "edge[_portalTransit]",
    style: {
      "mid-target-arrow-shape": "circle",
      "mid-target-arrow-color": "#c9a227",
      "arrow-scale": 1.2,
      "line-style": "dashed",
    } as any,
  },
  {
    selector: "edge[_portalTransit][?_hasConstruct]",
    style: {
      "mid-target-arrow-shape": "diamond",
    } as any,
  },
  {
    // Bugfix 21: bezier override for edges that need the curve.
    // ugmToCytoscapeElements sets _curveStyle = "bezier" for self-loops,
    // parallel multi-edges, and bidirectional pairs.
    selector: 'edge[_curveStyle = "bezier"]',
    style: {
      "curve-style": "bezier",
    } as any,
  },
  {
    // Post-layout obstacle-aware routing (routeEdges prop, non-structural
    // scenes). Distinct class from the structural router's routed edges:
    // structural rules carry SVG-overlay opacity:0 in overlay mode and
    // per-edge listeners that must not touch force-layout edges. Inert
    // unless the routing pass stamps _segDist/_segWeight and the class.
    selector: "edge.g3t-canvas-edge-routed",
    style: {
      "curve-style": "segments",
      // Route terminals are box CENTERS (routeSceneEdges boxCenter), so the
      // segment baseline must be center-to-center. Cytoscape defaults
      // edge-distances to `intersection` (border-to-border), which shifts
      // every bend off the routed geometry by the node half-extent.
      "edge-distances": "node-position",
      "segment-distances": "data(_segDist)",
      "segment-weights": "data(_segWeight)",
    } as any,
  },
  {
    selector: "edge[_asserted = 0]",
    style: {
      "line-style": "dashed",
      "line-dash-pattern": [6, 3],
    } as any,
  },
  {
    selector: "node.g3t-selected",
    style: {
      // Round-18 finding 7: the runtime canvas still wore the old
      // chunky 3px border (the round-5 gasket lived only in the
      // unmerged deriveCytoscapeStyle). The gasket, here for real:
      // node keeps its own border; a slim accent ring sits OFFSET
      // from it, separated by a canvas-colored gap.
      "outline-color": "#2563eb",
      "outline-width": 2,
      "outline-offset": 2,
      "outline-opacity": 1,
    } as any,
  },
  {
    // Cytoscape's default click-hold overlay is a fat gray blob
    // (radius ~10 at 0.25): slim it to a whisper.
    selector: ":active",
    style: {
      "overlay-opacity": 0.08,
      "overlay-padding": 4,
    } as any,
  },
  {
    selector: "edge.g3t-selected",
    style: {
      "line-color": "#2563eb",
      "target-arrow-color": "#2563eb",
      width: 2.5,
    } as any,
  },
  {
    // Emphasis layer (review 4.6): distinct from selection by design
    // (amber vs the selection blue; nodes in an effect carry NO
    // class, so a route member never reads as selected).
    selector: "edge.g3t-effect-edge",
    style: {
      "line-color": "#f08c00",
      "target-arrow-color": "#f08c00",
      width: 4,
    } as any,
  },
  {
    selector: ".g3t-effect-dim",
    style: { opacity: 0.15 } as any,
  },
];

/** The canvas's full stylesheet merge, extracted PURE so tests can
 *  assert computed styles through the REAL rule order (the VR-2
 *  burn: a repro composing only DEFAULT+ENCODING passed while the
 *  real merge failed).
 *
 *  ORDER CONTRACT (cytoscape: later rules win the property):
 *  defaults -> curve style -> pin/compound/structural chrome ->
 *  THEME color rules -> structural theme colors -> ENCODING rules
 *  (VR-2 root cause: these previously sat BEFORE the theme block,
 *  so the theme's plain `edge { line-color }` clobbered
 *  `edge[_ecolor]` in every theme and color-by-confidence never
 *  painted) -> OVERLAY rules (emphasis dim must beat encoding) ->
 *  user stylesheet (user wins ties) -> svg-overlay transparency ->
 *  hidden filter last. */
/** Upstream P1 (prm-analyzer, 2026-07-28) + the 64b regression it
 *  shipped with: the first guard classified elements by the
 *  PRESENCE of data.source, but ugmToCytoscapeElements spreads
 *  node PROPERTIES into data, so a node with a provenance
 *  property named "source" (the supply facilities) was
 *  misclassified as an edge, excluded from the node-id set,
 *  dropped as "dangling", and took its real edges with it. The
 *  discriminator is cytoscape's canonical `group` field (the
 *  converter stamps it); the source+target fallback only applies
 *  to group-less inputs, whose data is view-built rather than
 *  property-spread. Exported for direct testing. */
export function validateAssembledElements<
  T extends {
    group?: string;
    data?: { id?: string; source?: unknown; target?: unknown };
  },
>(elements: readonly T[]): T[] {
  const isEdge = (el: T): boolean =>
    el.group === "edges" ||
    (el.group === undefined &&
      el.data?.source !== undefined &&
      el.data?.target !== undefined);
  const nodeIds = new Set<string>();
  for (const el of elements) {
    if (!isEdge(el) && el.data?.id !== undefined) nodeIds.add(el.data.id);
  }
  return elements.filter((el) => {
    if (!isEdge(el)) return true;
    const d = el.data;
    const ok = nodeIds.has(String(d?.source)) && nodeIds.has(String(d?.target));
    if (!ok) {
      console.warn(
        `[g3t] dropping edge ${String(d?.id)}: endpoint missing from the assembled element set (source=${String(d?.source)}, target=${String(d?.target)})`,
      );
    }
    return ok;
  });
}

export function composeCanvasStylesheet(
  theme: G3tTheme,
  opts?: {
    edgeStyle?: "taxi" | "straight" | "bezier";
    structuralEdgeLayer?: string;
    userStylesheet?: readonly CyStylesheet[];
  },
): CyStylesheet[] {
  const merged: CyStylesheet[] = [...DEFAULT_STYLESHEET];
  const edgeStyle = opts?.edgeStyle;
  if (edgeStyle !== undefined) {
    const curveStyle =
      edgeStyle === "taxi"
        ? "taxi"
        : edgeStyle === "straight"
          ? "straight-triangle"
          : "unbundled-bezier";
    merged.push({
      selector: "edge",
      style: {
        "curve-style": curveStyle,
        ...(edgeStyle === "taxi"
          ? { "taxi-direction": "auto", "taxi-turn": "50px" }
          : {}),
      } as never,
    });
  }
  merged.push(
    PIN_INDICATOR_RULE,
    COMPOUND_CONTAINER_RULE,
    // Structural-scene rules (slice A2): class-scoped, inert
    // without structural elements; AFTER the compound rule so the
    // structural container override (zero padding, no compound
    // label) wins over the generic :parent styling.
    ...(STRUCTURAL_RULES as CyStylesheet[]),
    ...themeColorRules(theme),
    // Structural COLORS (round 41 dark-mode fix): AFTER
    // themeColorRules so the structural selectors win their colors
    // over the generic node/:parent rules.
    ...(structuralThemeRules(theme) as CyStylesheet[]),
    // VR-2: encoding AFTER every theme rule: data-driven encodings
    // are user intent and beat default chrome.
    ...ENCODING_EDGE_RULES,
    ...ENCODING_NODE_RULES,
    // Emphasis/overlay dim still beats encoding (the 9.10
    // contract: a trace-route dim must fade encoded elements too).
    ...OVERLAY_RULES,
  );
  if (opts?.userStylesheet) {
    merged.push(...opts.userStylesheet);
  }
  // SVG overlay mode (G3L:RND-002): routed structural edges go
  // fully transparent in Cytoscape while STAYING mounted and
  // hit-testable; the overlay draws the visuals. opacity (not
  // display:none) is load-bearing for hit testing.
  if (opts?.structuralEdgeLayer === "svg-overlay") {
    merged.push({
      selector: "edge.g3t-structural-edge-routed",
      style: { opacity: 0 },
    } as never);
  }
  // Visibility filter (hidden prop): last so it wins over every
  // mapper.
  merged.push({
    selector: ".g3t-hidden",
    style: { display: "none" },
  } as any);
  return merged;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Label word-wrap override. The base node rule wraps labels by
 *  DEFAULT (110px, the bio-shell overlap fix); this is the single
 *  knob over that default: a number re-widths the wrap, `false`
 *  disables it (text-wrap: none). Append the returned rule via the
 *  `stylesheet` prop; toggling is a STYLE REFRESH by the relayout
 *  contract, so positions and the camera hold. Scoped to
 *  `node[label]` (the mapping-warning doctrine: never a bare `node`
 *  rule for data-carried fields). */
export function labelWrapRule(maxWidthPx: number | false = 120): CyStylesheet {
  return {
    selector: "node[label]",
    style:
      maxWidthPx === false
        ? ({ "text-wrap": "none" } as never)
        : ({
            "text-wrap": "wrap",
            "text-max-width": `${maxWidthPx}px`,
          } as never),
  };
}

/** Upstream P2 (prm-analyzer, 2026-07-28): interaction knobs that
 *  are init-time-only in cytoscape (wheelSensitivity in
 *  particular), exposed as a prop instead of forcing consumers to
 *  disable native zoom and reimplement it. */
export interface CanvasInteractionOptions {
  wheelSensitivity?: number;
  minZoom?: number;
  maxZoom?: number;
  userPanningEnabled?: boolean;
  boxSelectionEnabled?: boolean;
}

export interface CytoscapeCanvasProps {
  /** The UGM instance to render. MUST be referentially stable across
   *  renders: a new identity means "different graph" and triggers a
   *  full re-init INCLUDING layout. Memoize in the parent; do not
   *  rebuild per render. */
  ugm: UGM;
  /** Interaction knobs forwarded into the cytoscape constructor.
   *  Content-keyed: changing values re-initializes the instance
   *  (they are init-time-only in cytoscape). */
  interactionOptions?: CanvasInteractionOptions;
  /** Optional layout name (default: "fcose" if available, else "cose"). */
  layout?: string;
  /** Extra options merged into the layout object AFTER the built-in
   *  tuning, so callers can adjust spacing and fit (review 5.11:
   *  idealEdgeLength, nodeRepulsion, padding, ...) without forking
   *  the canvas. Keyed by CONTENT (like structuralDecorations), so an
   *  inline literal does not re-init the instance every render; a
   *  content change re-runs layout. Structural (preset) scenes ignore
   *  the fit-related keys: the camera policy there is explicit. */
  layoutOptions?: Record<string, unknown>;
  /** Optional additional stylesheet rules to merge. */
  stylesheet?: CyStylesheet[];
  /** Optional ContextMenuManager. If omitted, a default is created
   *  whose base menu is FUNCTIONAL with zero config: one copy item
   *  wired to the clipboard, labeled "Copy IRI" or "Copy ID" from the
   *  element's id shape. "Inspect properties" appears only when a
   *  manager built with createDefaultMenuManager({ onInspect }) is
   *  passed (an unwired Inspect is omitted, never rendered dead);
   *  app-specific items go through manager.register(). */
  menuManager?: ContextMenuManager;
  /** Callback when the Cytoscape core is ready. */
  onReady?: (cy: Core) => void;
  /** CSS class for the container div. */
  className?: string;
  /** Optional encoding spec; when present, element visual data is
   *  patched through applyEncodingSpec on mount and on every spec
   *  change (roadmap/design/encoding-controls.md application
   *  milestone). Spec changes RESTYLE ONLY: element data patches do
   *  not re-run layout, so visual edits never move nodes (given a
   *  stable ugm reference, above). */
  encodingSpec?: EncodingSpec;
  /** Compound containers (slice 1, round 17): edges of the named
   *  type become parent assignments rendered as UML-style labeled
   *  containers; fcose is compound-aware, so force layout respects
   *  containment. Must be referentially stable, like ugm. */
  /** RELAYOUT CONTRACT (upstream round-6, 2026-07-28): a full
   *  re-init (layout re-run, positions discarded unless the
   *  same-graph preset replay applies) is triggered ONLY by
   *  CONTENT changes to: ugm identity, containment, layout,
   *  layoutOptions, interactionOptions, edgeStyle, animate.
   *  stylesheet and encodingSpec changes are STYLE REFRESHES and
   *  preserve positions. */
  containment?: ContainmentOptions;
  /** Structural scene (Group A slice A2, R1.18): when present, the
   *  canvas renders the laid-out structural geometry INSTEAD of the
   *  UGM projection, with layout "preset" (positions come from the
   *  document; force layouts never run over a structural scene).
   *  Rows are selectable elements; give rows the source element's
   *  id and selection/inspector machinery applies unmodified. Must
   *  be referentially stable, like ugm. */
  /** @deprecated Owner ruling 2026-07-28: use StructuralSvgView for
   *  structural scenes. The cytoscape structural path (compound
   *  containers + eports + drag attachment) is behind the SVG view
   *  and will be removed once remaining consumers migrate. A
   *  dev-only warning fires on first use. */
  structural?: { input: StructuralGraphInput; geometry: StructuralGeometry };
  /** Optional render-time decorations for a structural scene
   *  (SHACL B3: closed-shape borders, per-row validation severity).
   *  Ignored unless `structural` is set. */
  structuralDecorations?: StructuralDecorations;
  /** Which layer draws ROUTED structural edges (G3L:RND-002, the
   *  ruled per-surface opt-in). "cytoscape" (default): the shipped
   *  segments projection. "svg-overlay": an SVG layer above the
   *  canvas draws the true absolute polylines (arrowheads, dashes,
   *  labels included); the underlying Cytoscape edges stay mounted
   *  but fully transparent so hover/context-menu interaction is
   *  UNCHANGED (parity by construction). Declared-port edges keep
   *  their Cytoscape taxi rendering in both modes (the ruled
   *  perpendicular-exit behavior). Ignored unless `structural` is
   *  set. */
  structuralEdgeLayer?: "cytoscape" | "svg-overlay";
  /** Structural scenes only: invoked when the user taps the on-container
   *  collapse toggle chip, with the container id and its compartment ids.
   *  The host forwards this to the compartment-collapse store's toggleAll
   *  (and re-runs layoutStructural with the new collapsed set). When
   *  omitted, the chip still renders but tapping it is a no-op. */
  /** F1: Animate layout transitions. Default true. */
  animate?: boolean;
  /** F1: Animation duration in ms. Default 400. */
  animationDuration?: number;
  /**
   * F8: Edge curve style override. When set, applies the given style
   * to ALL edges regardless of their topology. When NOT set (default),
   * edges auto-select straight vs bezier based on whether the curve
   * is actually needed (see bugfix 21 in ugmToCytoscapeElements):
   * straight for the common single-edge case, bezier for self-loops,
   * parallel multi-edges, and bidirectional pairs.
   */
  edgeStyle?: "bezier" | "straight" | "taxi";
  /**
   * Node ids to hide on the canvas (a visibility filter). Hidden nodes
   * get a `g3t-hidden` class (display: none), so Cytoscape drops them
   * from layout and auto-hides their incident edges, WITHOUT a re-init:
   * applied as a batched class toggle, so positions and the instance
   * survive. Use this for type/facet filtering instead of feeding a
   * pre-filtered UGM (which would re-create the instance and re-run
   * layout on every toggle). Must be referentially stable across renders
   * where it has not changed; rebuild it only when the hidden set does.
   */
  hidden?: ReadonlySet<string>;
  /**
   * Post-layout obstacle-aware edge routing for NON-structural scenes.
   * Structural scenes already carry routed edges from `layoutStructural`;
   * this prop is a no-op there (detected by the presence of any edge
   * bearing the `g3t-structural-edge-routed` class).
   *
   * `true` enables the pass with defaults; a config object sets
   * `maxEdges` (default 600 — above this, the pass skips and warns
   * once) plus optional router tuning (`clearance`, `bendPenalty`,
   * `minStub`; the router's own defaults are 12, 30, 28). Applied on
   * every `layoutstop` and on drag-free of incident edges; runs inside
   * `cy.batch()` so the write is a single restyle, never a re-init.
   */
  routeEdges?:
    | boolean
    | {
        maxEdges?: number;
        clearance?: number;
        bendPenalty?: number;
        minStub?: number;
        /**
         * Grazing tolerance (px) for "direct" mode. An edge whose straight
         * shot only clips the outer `grazeTolerance` shell of a node stays
         * bezier; only a shot that cuts deeper into a node body Z-routes.
         * Higher = fewer routed/cornered edges. Default 8. Ignored in
         * "orthogonal" mode.
         */
        grazeTolerance?: number;
        /**
         * Routing mode. Default "direct" (route only edges whose straight
         * segment crosses a node box). "orthogonal" routes every edge
         * axis-aligned regardless of obstacles; "direct" (the default) leaves
         * clear edges as bezier and only detours around actual crossings.
         */
        mode?: "direct" | "orthogonal";
      };
  /**
   * Refresh-routes signal (brief 23, A54). Bump this counter to re-run the
   * obstacle-aware routing pass over ALL visible edges on the CURRENT node
   * positions, without moving any node. Explicit user op (a "Refresh routes"
   * button). No-op when `routeEdges` is off/undefined or the scene is
   * structural. Uses signal-counter semantics for multi-instance safety: no
   * global command store, each canvas responds only to its own prop bump.
   */
  routeRefreshSignal?: number;
  /**
   * Re-layout (untangle) signal (brief 23, A54). Bump this counter to run
   * the crossing-aware placement optimizer on the current visible scene,
   * apply the returned positions, then re-run the routing pass. Explicit
   * user op — the camera/position-hold rule does NOT apply here (same
   * class as reheat/fit/zoom). Non-structural scenes only.
   */
  relayoutSignal?: number;
  /**
   * When true, an edge tap isolates that edge via the emphasis layer
   * (`useEmphasisStore.setPathEffect`) instead of firing a plain
   * selection. Tapping the currently-isolated edge again, or the
   * background, clears the isolate. Opt-in; default false so existing
   * canvases keep click-to-select. Brief 23 (A54).
   */
  edgeClickIsolate?: boolean;
}

/** Resolve the public `routeEdges` prop shape into the concrete options
 *  `runCanvasEdgeRouting` takes. Shared by the init-effect handlers and
 *  the prop-change / refresh / relayout effects so every pass resolves
 *  the SAME way from the LIVE prop value (the handlers previously
 *  captured a snapshot at cy init, so a Routes-mode change never reached
 *  drag-free or layoutstop reroutes). */
function resolveRouteCfg(
  routeConfig: NonNullable<Exclude<CytoscapeCanvasProps["routeEdges"], false>>,
): {
  maxEdges: number;
  clearance?: number;
  bendPenalty?: number;
  minStub?: number;
  grazeTolerance?: number;
  mode: "direct-unless-crossing" | "always";
} {
  return routeConfig === true
    ? { maxEdges: 600, grazeTolerance: 8, mode: "direct-unless-crossing" }
    : {
        maxEdges: routeConfig.maxEdges ?? 600,
        clearance: routeConfig.clearance,
        bendPenalty: routeConfig.bendPenalty,
        minStub: routeConfig.minStub,
        grazeTolerance: routeConfig.grazeTolerance ?? 8,
        mode:
          routeConfig.mode === "orthogonal"
            ? "always"
            : "direct-unless-crossing",
      };
}

/** ROUTE_EDGES pass (routeEdges prop). Reads current node bounding boxes
 *  from the live Cytoscape instance, runs the pure `routeSceneEdges`
 *  routing pass, and writes `_segDist`/`_segWeight` + the
 *  `g3t-canvas-edge-routed` class to each edge that routed successfully.
 *  Edges whose router result is null get any prior routing data CLEARED
 *  (per-edge graceful degradation, no phantom polylines). The write
 *  happens inside `cy.batch()` so it is a single restyle, never a re-init.
 *
 *  No-op when the scene is structural (any edge carries the
 *  `g3t-structural-edge-routed` class) — structural scenes already carry
 *  routes from `layoutStructural`. Skips (and warns once) when the visible
 *  edge count exceeds `maxEdges`. Filter for edges provided by the caller;
 *  when omitted, ALL visible edges are routed. */
export function runCanvasEdgeRouting(
  cy: Core,
  opts: {
    maxEdges: number;
    clearance?: number;
    bendPenalty?: number;
    minStub?: number;
    grazeTolerance?: number;
    mode?: "direct-unless-crossing" | "always";
  },
  incidentTo?: string,
): { skipped: boolean; routedCount: number } {
  // No-op on structural scenes: the structural router already owns them
  // and shipped opacity:0 rules would apply to shared classes.
  if (cy.edges(".g3t-structural-edge-routed").length > 0) {
    return { skipped: true, routedCount: 0 };
  }
  const visibleEdges = cy.edges(":visible");
  if (visibleEdges.length > opts.maxEdges) {
    return { skipped: true, routedCount: 0 };
  }
  const nodeBoxes: SceneNodeBox[] = [];
  cy.nodes(":visible").forEach((n) => {
    // Compound parents have no drawn body of their own; their children's
    // boxes already cover the interior, so excluding them keeps edges
    // from bending around empty container geometry.
    if (n.isParent()) return;
    // Labels MUST be excluded: cytoscape renders `curve-style: segments`
    // relative to the node POSITIONS (body centers), so route terminals
    // must be body-box centers. A label-inclusive box (labels sit below
    // the node) shifts the center off the position and shears every bend
    // point when the polyline is projected onto segment weights.
    const bb = n.boundingBox({ includeLabels: false, includeOverlays: false });
    nodeBoxes.push({
      id: n.id(),
      x: bb.x1,
      y: bb.y1,
      width: bb.w,
      height: bb.h,
    });
  });
  const edgePairs: SceneEdgeEndpoints[] = [];
  const scope = incidentTo
    ? visibleEdges.filter((e) => {
        const d = e.data() as { source?: string; target?: string };
        return d.source === incidentTo || d.target === incidentTo;
      })
    : visibleEdges;
  scope.forEach((e) => {
    const d = e.data() as { id?: string; source?: string; target?: string };
    if (d.id && d.source && d.target) {
      edgePairs.push({ id: d.id, source: d.source, target: d.target });
    }
  });
  const { routed } = routeSceneEdges(nodeBoxes, edgePairs, {
    clearance: opts.clearance,
    bendPenalty: opts.bendPenalty,
    minStub: opts.minStub,
    grazeTolerance: opts.grazeTolerance,
    mode: opts.mode,
  });
  let routedCount = 0;
  cy.batch(() => {
    scope.forEach((e) => {
      const id = e.id();
      const pts = routed.get(id);
      const seg = pts ? polylineToCytoscapeSegments(pts) : null;
      if (seg) {
        e.data("_segDist", seg.distances.join(" "));
        e.data("_segWeight", seg.weights.join(" "));
        e.addClass("g3t-canvas-edge-routed");
        routedCount++;
      } else {
        // Null result OR straight polyline: clear any prior routing data
        // so the edge reverts to bezier with no phantom polyline.
        if (e.data("_segDist") !== undefined) e.removeData("_segDist");
        if (e.data("_segWeight") !== undefined) e.removeData("_segWeight");
        if (e.hasClass("g3t-canvas-edge-routed")) {
          e.removeClass("g3t-canvas-edge-routed");
        }
      }
    });
  });
  return { skipped: false, routedCount };
}

/** Re-layout (untangle) pass (relayoutSignal prop, brief 23). Reads current
 *  visible node boxes + visible edge endpoint pairs from the live cy, runs
 *  the pure `optimizePlacement` optimizer, and applies the returned
 *  positions inside `cy.batch()`. Skipped on structural scenes (they carry
 *  their own placement pipeline). The optimizer returns box TOP-LEFT
 *  coordinates (same convention as MetricsNode); Cytoscape's node.position()
 *  is CENTER, so we translate by half-extent on write. Pure with respect to
 *  the graph: node id set is preserved (reposition only). Exported for
 *  direct unit-testing against a fake cy. */
export function runCanvasRelayout(
  cy: Core,
  opts?: { budgetMs?: number; seed?: number },
): {
  skipped: boolean;
  moved: number;
  crossingsBefore: number;
  crossingsAfter: number;
} {
  if (cy.edges(".g3t-structural-edge-routed").length > 0) {
    return { skipped: true, moved: 0, crossingsBefore: 0, crossingsAfter: 0 };
  }
  const nodes: PlacementNode[] = [];
  cy.nodes(":visible").forEach((n) => {
    if (n.isParent()) return;
    // Body box only: the write-back below maps box center -> position(),
    // so a label-inclusive box would drift every node downward by half
    // the label height on each relayout press.
    const bb = n.boundingBox({ includeLabels: false, includeOverlays: false });
    nodes.push({
      id: n.id(),
      x: bb.x1,
      y: bb.y1,
      width: bb.w,
      height: bb.h,
    });
  });
  const edges: PlacementEdge[] = [];
  cy.edges(":visible").forEach((e) => {
    const d = e.data() as { id?: string; source?: string; target?: string };
    if (d.id && d.source && d.target) {
      edges.push({ id: d.id, source: d.source, target: d.target });
    }
  });
  const result = optimizePlacement(nodes, edges, {
    budgetMs: opts?.budgetMs ?? 350,
    ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
  });
  let moved = 0;
  cy.batch(() => {
    for (const n of nodes) {
      const p = result.positions.get(n.id);
      if (!p) continue;
      if (p.x !== n.x || p.y !== n.y) moved++;
      cy.getElementById(n.id).position({
        x: p.x + n.width / 2,
        y: p.y + n.height / 2,
      });
    }
  });
  return {
    skipped: false,
    moved,
    crossingsBefore: result.crossingsBefore,
    crossingsAfter: result.crossingsAfter,
  };
}

/** Apply the visibility filter as a batched class toggle: hidden nodes
 *  get `g3t-hidden` (display:none), so Cytoscape drops them from layout
 *  and auto-hides their incident edges. A restyle, not a re-init, so the
 *  instance and node positions survive. */
function applyHiddenClasses(
  cy: Core,
  hidden: ReadonlySet<string> | undefined,
): void {
  cy.batch(() => {
    cy.nodes().forEach((n) => {
      if (hidden && hidden.has(n.id())) n.addClass("g3t-hidden");
      else n.removeClass("g3t-hidden");
    });
  });
}

/**
 * Same-graph scene patch (MR-1 flash fix, G3L:CNT-003). A same-graph
 * structural rebuild (collapse/expand, re-layout) previously destroyed
 * and recreated the Cytoscape instance: geometry could be pixel-stable
 * (the sketch path) and the surface still FLASHED, because the flash
 * IS the teardown. Instead: diff the next element definitions against
 * the live instance and apply adds/removals/updates in one batch. No
 * destroy, no remount, camera untouched by construction (D15 becomes
 * a non-event on this path), and the SVG edge overlay follows via the
 * add/remove/data/position events it already listens to.
 */
export function planScenePatch(
  existingIds: ReadonlySet<string>,
  next: readonly { data: { id?: string } }[],
): { addIdx: number[]; removeIds: string[]; updateIdx: number[] } {
  const nextIds = new Set<string>();
  const addIdx: number[] = [];
  const updateIdx: number[] = [];
  next.forEach((def, i) => {
    const id = def.data.id;
    if (!id) return;
    nextIds.add(id);
    if (existingIds.has(id)) updateIdx.push(i);
    else addIdx.push(i);
  });
  const removeIds: string[] = [];
  for (const id of existingIds) {
    if (!nextIds.has(id)) removeIds.push(id);
  }
  return { addIdx, removeIds, updateIdx };
}

function applyScenePatch(cy: Core, next: cytoscape.ElementDefinition[]): void {
  const existing = new Set<string>();
  cy.elements().forEach((ele) => {
    existing.add(ele.id());
  });
  const plan = planScenePatch(existing, next as never);
  cy.batch(() => {
    if (plan.removeIds.length > 0) {
      cy.remove(
        cy.collection(plan.removeIds.map((id) => cy.$id(id)).flat() as never),
      );
    }
    for (const i of plan.updateIdx) {
      const def = next[i];
      if (!def?.data.id) continue;
      const ele = cy.$id(def.data.id);
      if (ele.empty()) continue;
      // json() replaces the given fields wholesale: data, classes,
      // and (for nodes) position, which is exactly the scene's new
      // truth. Removal-then-add would drop selection and handlers;
      // json() preserves element identity.
      ele.json({
        data: def.data,
        ...(def.classes !== undefined ? { classes: def.classes } : {}),
        ...("position" in def && def.position !== undefined
          ? { position: def.position }
          : {}),
      } as never);
    }
    const adds = plan.addIdx
      .map((i) => next[i])
      .filter((d): d is cytoscape.ElementDefinition => d !== undefined);
    if (adds.length > 0) cy.add(adds);
  });
}

export function CytoscapeCanvas({
  ugm,
  interactionOptions,
  layout,
  layoutOptions,
  stylesheet,
  menuManager,
  onReady,
  className,
  // Default consults the OS preference (A2); an explicit prop wins.
  animate = !prefersReducedMotion(),
  animationDuration = 400,
  edgeStyle,
  encodingSpec,
  containment,
  structural,
  structuralDecorations,
  structuralEdgeLayer = "cytoscape",
  hidden,
  routeEdges,
  routeRefreshSignal,
  relayoutSignal,
  edgeClickIsolate = false,
}: CytoscapeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  // The live cy instance as STATE, for children that mount against it
  // (the SVG edge overlay). Set when a scene finishes mounting, nulled
  // on teardown; a state flip per rebuild, never per frame.
  const [overlayCy, setOverlayCy] = useState<Core | null>(null);
  // Same-graph patch path (MR-1 flash fix): the creation effect keys
  // on graph IDENTITY (epoch), not on every scene object; a scene
  // change over the same graph patches the live instance in place.
  const [graphEpoch, setGraphEpoch] = useState(0);
  const structuralRef = useRef(structural);
  // eslint-disable-next-line react-hooks/refs
  structuralRef.current = structural;
  const sceneKeyRef = useRef<string>("");

  // Context menu state
  const [menuState, setMenuState] = useState<{
    target: MenuTarget;
    items: ReturnType<ContextMenuManager["resolve"]>;
  } | null>(null);

  // Create menu manager once (stable across renders).
  // Parent can provide a custom manager via menuManager prop to
  // add inspect/copy callbacks; the default has no-op actions.
  const [manager] = useState(() => menuManager ?? createDefaultMenuManager());

  // Bugfix 3: stash callbacks/objects in refs so the initCytoscape
  // identity stays stable across renders. Without these, every parent
  // render produces new `onReady` and `stylesheet` props, which would
  // re-create initCytoscape, which would re-fire the useEffect, which
  // would destroy + rebuild the Cytoscape instance — a jitter loop.
  const onReadyRef = useRef(onReady);
  // eslint-disable-next-line react-hooks/refs
  onReadyRef.current = onReady;
  // Camera preservation across structural rebuilds: a compartment collapse
  // recreates the cy instance, and the fresh preset layout would otherwise
  // refit. Geometry is often produced asynchronously, so one collapse can
  // arrive as two renders (decorations first, then the new geometry); keying
  // off the collapsed set is therefore unreliable (the second render would
  // refit). Instead we preserve pan/zoom whenever the INPUT GRAPH is unchanged
  // (collapse, expand, and re-layout all keep the same nodes) and fit only on
  // first mount or a genuinely different graph. wasStructuralRef gates
  // capturing from a prior structural instance; prevInputKeyRef holds the
  // previous graph identity.
  const wasStructuralRef = useRef(false);
  const prevInputKeyRef = useRef("");
  // The camera (pan/zoom) captured by the effect cleanup right before the
  // instance is destroyed, so a same-graph rebuild can restore it. cyRef is
  // already null by the time the next init runs, so this ref is the only
  // place the prior camera survives.
  const lastCameraRef = useRef<{
    pan: cytoscape.Position;
    zoom: number;
  } | null>(null);
  // LR-45 (owner review 2026-07-22): node positions captured at
  // teardown, so a SAME-GRAPH ugm rebuild (e.g. the ontology
  // inferred toggle: identical node/edge ids, changed data) can run
  // PRESET from them instead of a full animated fcose. That
  // teardown+relayout was the toggle lag.
  const lastPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(
    null,
  );
  const stylesheetRef = useRef(stylesheet);
  // eslint-disable-next-line react-hooks/refs
  stylesheetRef.current = stylesheet;
  const hiddenRef = useRef(hidden);
  // eslint-disable-next-line react-hooks/refs
  hiddenRef.current = hidden;
  const routeEdgesRef = useRef(routeEdges);
  // eslint-disable-next-line react-hooks/refs
  routeEdgesRef.current = routeEdges;
  // Live prop reads from within listeners attached once at init (edge/bg
  // tap handlers). Prop changes must not require a canvas re-init.
  const edgeClickIsolateRef = useRef(edgeClickIsolate);
  // eslint-disable-next-line react-hooks/refs
  edgeClickIsolateRef.current = edgeClickIsolate;
  // True once layoutstop has fired on the current cy instance; guards
  // the prop-change effect from routing against pre-layout positions
  // during a graph rebuild (init effect and the change effect both
  // fire on ugm change, and the change effect used to run its pass
  // synchronously against wherever the just-started layout had put
  // nodes at that microtask - the initial fcose flash on the Scale
  // demo's first-visit path).
  const layoutSettledRef = useRef(false);

  /** One stylesheet assembly for init AND live theme restyles.
   *  Order is the precedence story: structural defaults (fallback
   *  literals) -> spec-channel rules -> theme-resolved colors ->
   *  user stylesheet. */
  const composeMergedStylesheet = useCallback(
    (theme: G3tTheme): CyStylesheet[] =>
      composeCanvasStylesheet(theme, {
        edgeStyle,
        structuralEdgeLayer,
        userStylesheet: stylesheetRef.current ?? undefined,
      }),
    [edgeStyle, structuralEdgeLayer],
  );
  const themeAppliedRef = useRef<G3tTheme | null>(null);
  const stylesheetWarnedRef = useRef(false);
  const structuralDeprecationWarnedRef = useRef(false);

  // A decoration change must not tear down the instance on every parent
  // render. structuralDecorations is typically a fresh object literal each
  // render (e.g. an inline literal), so keying the rebuild on its
  // identity would recreate (and refit/reset positions) on unrelated
  // re-renders such as selection or hover. Key the rebuild on decoration
  // CONTENT instead, and read the live object through a ref.
  const structuralDecorationsKey = structuralDecorations
    ? [
        "closed:" +
          [...(structuralDecorations.closedContainers ?? [])].sort().join(","),
        "sev:" +
          [...(structuralDecorations.rowSeverities ?? [])]
            .map(([k, v]) => `${k}=${v}`)
            .sort()
            .join(","),
      ].join("|")
    : "";
  const structuralDecorationsRef = useRef(structuralDecorations);
  // eslint-disable-next-line react-hooks/refs
  structuralDecorationsRef.current = structuralDecorations;

  // Same content-key treatment for layoutOptions: identity churns per
  // render for inline literals; only a content change should re-init.
  const layoutOptionsKey = layoutOptions ? JSON.stringify(layoutOptions) : "";
  const interactionKey = interactionOptions
    ? JSON.stringify(interactionOptions)
    : "";
  // Upstream round-6 P2 (prm-analyzer, 2026-07-28): a host that
  // rebuilds the containment object per render re-initialized the
  // canvas every render, re-running layout and discarding
  // user-arranged positions (the "positions snap back" report).
  // Same content-key treatment as layoutOptions: only a CONTENT
  // change re-inits.
  const containmentKey = containment ? JSON.stringify(containment) : "";
  const layoutOptionsRef = useRef(layoutOptions);
  // eslint-disable-next-line react-hooks/refs
  layoutOptionsRef.current = layoutOptions;

  const initCytoscape = useCallback((): (() => void) | undefined => {
    // MR-1 flash fix: the scene is read from the ref (the callback's
    // deps carry graph IDENTITY via graphEpoch, not the scene object).
    const structural = structuralRef.current;
    if (!containerRef.current) return undefined;

    // Graph identity: the sorted top-level node ids. Stable across a collapse
    // or expand (compartments hide but the nodes don't change) and across a
    // re-layout; it changes only when a different graph loads.
    const inputKey = structural
      ? structural.input.nodes
          .map((n) => n.id)
          .sort()
          .join("|")
      : // LR-45: ugm graphs get an identity too (node + edge ids),
        // so data-only rebuilds (the inferred toggle) are
        // recognizable as the same graph.
        ((): string => {
          const eids: string[] = [];
          ugm.forEachEdge((eid) => eids.push(eid));
          return (
            [...ugm.getNodeIds()].sort().join("|") + "#" + eids.sort().join("|")
          );
        })();
    const sameGraphRebuild =
      (structural &&
        wasStructuralRef.current &&
        inputKey === prevInputKeyRef.current) ||
      (!structural &&
        !wasStructuralRef.current &&
        prevInputKeyRef.current !== "" &&
        inputKey === prevInputKeyRef.current);

    // On a same-graph rebuild, restore the camera the effect cleanup captured
    // just before tearing down the prior instance (cyRef is already null by
    // the time this init runs, so the live camera cannot be read here).
    const priorCamera = sameGraphRebuild ? lastCameraRef.current : null;

    // Defensive: the effect cleanup normally destroys the prior instance and
    // nulls cyRef; guard in case a stale handle remains.
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    ensureFcose();

    const elements = structural
      ? structuralToCytoscapeElements(
          structural.input,
          structural.geometry,
          structuralDecorationsRef.current,
        )
      : ugmToCytoscapeElements(ugm, { containment });
    // LR-45: a same-graph ugm rebuild replays the captured positions
    // as PRESET input, so the toggle is visually data-only (no fcose
    // pass, no node motion).
    if (!structural && sameGraphRebuild && lastPositionsRef.current) {
      const prior = lastPositionsRef.current;
      for (const el of elements) {
        const id = (el.data as { id?: string }).id;
        const pos = id !== undefined ? prior.get(id) : undefined;
        if (pos)
          (el as { position?: { x: number; y: number } }).position = { ...pos };
      }
    }
    // Bugfix 2: scatter initial positions so Cytoscape doesn't briefly
    // see every node at (0, 0) before layout runs. The "invalid endpoints"
    // warning fires when edges connect nodes occupying the same point.
    // Structural scenes skip this: every element is preset-positioned
    // (parents derive bounds from children and need no position).
    if (!structural) {
      for (const el of elements) {
        if (el.group === "nodes" && !el.position) {
          el.position = {
            x: Math.random() * 600 - 300,
            y: Math.random() * 400 - 200,
          };
        }
      }
    }

    // F8: Map edgeStyle prop to Cytoscape curve-style.
    // Bugfix 21: when edgeStyle is undefined (the new default), DON'T
    // emit a global override - the per-edge _curveStyle in the data
    // does the right thing via the selector rules in DEFAULT_STYLESHEET.
    // The override only kicks in when the consumer explicitly forces
    // a style for all edges.
    const mergedStylesheet = composeMergedStylesheet(
      useThemeStore.getState().theme,
    );
    themeAppliedRef.current = useThemeStore.getState().theme;

    const sameUgmRebuild =
      !structural &&
      sameGraphRebuild &&
      lastPositionsRef.current !== null &&
      lastPositionsRef.current.size > 0;
    const layoutName = structural
      ? "preset"
      : sameUgmRebuild
        ? "preset" // LR-45: identical graph, keep positions; no fcose
        : (layout ?? (fcoseRegistered ? "fcose" : "cose"));

    // Deprecation (owner ruling 2026-07-28): the structural path.
    if (
      structural !== undefined &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production" &&
      !structuralDeprecationWarnedRef.current
    ) {
      structuralDeprecationWarnedRef.current = true;
      console.warn(
        "[g3t] CytoscapeCanvas's structural prop is deprecated: use StructuralSvgView for structural scenes (better routing, drag, and labels).",
      );
    }
    const safeElements = validateAssembledElements(elements);

    // Upstream P1 (prm-analyzer, 2026-07-28): the packed bundle does
    // not auto-load style.css, and unstyled rendering is silent.
    // Dev-only discovery aid: warn ONCE when the design tokens are
    // absent from the document.
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production" &&
      typeof getComputedStyle === "function" &&
      !stylesheetWarnedRef.current
    ) {
      const probe = getComputedStyle(document.documentElement)
        .getPropertyValue("--g3t-bg-primary")
        .trim();
      if (probe === "") {
        stylesheetWarnedRef.current = true;
        console.warn(
          '[g3t] design tokens not found on :root. Did you forget `import "@g3t/react/style.css"`? Components will render unstyled without it.',
        );
      }
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: safeElements,
      style: mergedStylesheet,
      // Bugfix 14: enable scroll-wheel zoom + drag-pan explicitly.
      // These are Cytoscape defaults but stating them defensively
      // here makes the behavior intentional in case someone sets
      // these elsewhere via cy.userZoomingEnabled() / etc.
      userZoomingEnabled: true,
      userPanningEnabled: interactionOptions?.userPanningEnabled ?? true,
      ...(interactionOptions?.wheelSensitivity !== undefined
        ? { wheelSensitivity: interactionOptions.wheelSensitivity }
        : {}),
      ...(interactionOptions?.minZoom !== undefined
        ? { minZoom: interactionOptions.minZoom }
        : {}),
      ...(interactionOptions?.maxZoom !== undefined
        ? { maxZoom: interactionOptions.maxZoom }
        : {}),
      // wheelSensitivity intentionally LEFT at cytoscape's default to
      // avoid the "wheelSensitivity not recommended" warning. Override
      // via cy.wheelSensitivity() after onReady if needed for trackpads.
      // Lasso (box) multi-select, M1.E3.T3. GESTURE: with panning also
      // enabled (the default here), cytoscape enters box mode only while
      // a multi-select modifier is held (shift, ctrl, or meta); a plain
      // background drag pans. Disable userPanningEnabled if you want
      // plain-drag box selection. box-selection-sync.ts syncs the store.
      boxSelectionEnabled: interactionOptions?.boxSelectionEnabled ?? true,
      layout: {
        name: layoutName,
        animate,
        animationDuration,
        // Layout tuning for better spread
        ...(layoutName === "cose"
          ? {
              idealEdgeLength: 80,
              nodeRepulsion: 8000,
              gravity: 0.25,
              edgeElasticity: 100,
            }
          : {}),
        ...(layoutName === "fcose"
          ? {
              idealEdgeLength: 100,
              nodeRepulsion: 10000,
              gravity: 0.2,
              gravityRange: 1.5,
            }
          : {}),
        // Caller spacing/fit tuning (review 5.11): wins over the
        // built-in fcose/cose numbers above.
        ...(layoutOptionsRef.current ?? {}),
        // Structural (preset) scenes manage the camera explicitly after
        // construction so a collapse rebuild can preserve pan/zoom; the
        // preset layout must not fit on its own. LAST: no caller
        // option may re-enable preset fit.
        ...(layoutName === "preset" ? { fit: false } : {}),
      } as cytoscape.LayoutOptions,
    });

    // Structural camera policy: restore the preserved camera on a collapse
    // rebuild, otherwise fit the fresh scene. The preset layout ran with
    // fit:false, so the two never fight.
    if (structural) {
      if (priorCamera) {
        cy.viewport({ zoom: priorCamera.zoom, pan: priorCamera.pan });
      } else {
        cy.fit(cy.elements(), 30);
      }
    } else if (sameUgmRebuild && priorCamera) {
      // LR-45: the preset layout ran with fit:false; put the camera
      // back where the user left it.
      cy.viewport({ zoom: priorCamera.zoom, pan: priorCamera.pan });
    }
    prevInputKeyRef.current = inputKey;
    wasStructuralRef.current = Boolean(structural);

    // Wire right-click context menu (R2.1, R2.2, D3)
    // Bugfix 8: suppress the browser's native contextmenu so it doesn't
    // appear alongside our custom menu. Cytoscape's `cxttap` fires on
    // right-mouse-up but does NOT preventDefault — without this listener
    // both menus show.
    const suppressNativeContextMenu = (e: MouseEvent) => e.preventDefault();
    containerRef.current.addEventListener(
      "contextmenu",
      suppressNativeContextMenu,
    );

    cy.on("cxttap", "node", (evt) => {
      const node = evt.target;
      const pos = evt.renderedPosition ?? evt.position;
      const rect = containerRef.current?.getBoundingClientRect();
      // In a structural (block) scene, the right-clicked element may be
      // a header strip, a compartment, or a property row whose id is a
      // synthetic compound id (e.g. "blk:x::values::title"), not a UGM
      // node id. Resolve to the owning container so context actions
      // (view neighbors, pin, etc.) receive the real node id. A plain
      // container click already has _structuralContainer set.
      let resolved = node;
      if (structural && !node.data("_structuralContainer")) {
        const container = node
          .ancestors()
          .filter((a: { data: (k: string) => unknown }) =>
            Boolean(a.data("_structuralContainer")),
          );
        if (container.nonempty()) resolved = container[0];
      }
      const target: MenuTarget = {
        type: "node",
        id: resolved.id(),
        position: {
          x: (rect?.left ?? 0) + pos.x,
          y: (rect?.top ?? 0) + pos.y,
        },
        data: resolved.data(),
      };
      const items = manager.resolve(target);
      if (items.length > 0) {
        setMenuState({ target, items });
      }
    });

    cy.on("cxttap", "edge", (evt) => {
      const edge = evt.target;
      const pos = evt.renderedPosition ?? evt.position;
      const rect = containerRef.current?.getBoundingClientRect();
      const target: MenuTarget = {
        type: "edge",
        id: edge.id(),
        position: {
          x: (rect?.left ?? 0) + pos.x,
          y: (rect?.top ?? 0) + pos.y,
        },
        data: edge.data(),
      };
      const items = manager.resolve(target);
      if (items.length > 0) {
        setMenuState({ target, items });
      }
    });

    // Background right-click
    cy.on("cxttap", (evt) => {
      if (evt.target === cy) {
        const pos = evt.renderedPosition ?? evt.position;
        const rect = containerRef.current?.getBoundingClientRect();
        const target: MenuTarget = {
          type: "background",
          position: {
            x: (rect?.left ?? 0) + pos.x,
            y: (rect?.top ?? 0) + pos.y,
          },
        };
        const items = manager.resolve(target);
        if (items.length > 0) {
          setMenuState({ target, items });
        }
      }
    });

    // Close menu on left-click anywhere
    cy.on("tap", () => {
      setMenuState(null);
    });

    // Wire selection store to canvas (M1.E1.T2)
    //
    // Architecture: ONE-WAY data flow, no feedback loops.
    // - User actions (tap, box-select) → write to Zustand store
    // - Store changes → apply CSS class "g3t-selected" (NOT cy.select())
    // - cy.select()/unselect() are NEVER called, so no Cytoscape
    //   selection events fire, eliminating bidirectional sync races.
    const {
      selectNodes,
      selectEdges,
      clearSelection,
      addNodesToSelection,
      toggleNodeSelection,
    } = useSelectionStore.getState();

    // Node tap: single-select, ctrl-toggle, shift-add
    cy.on("tap", "node", (evt) => {
      const nodeId = evt.target.id();
      if (evt.originalEvent.ctrlKey || evt.originalEvent.metaKey) {
        toggleNodeSelection(nodeId);
      } else if (evt.originalEvent.shiftKey) {
        addNodesToSelection([nodeId]);
      } else {
        selectNodes([nodeId]);
      }
    });

    cy.on("tap", "edge", (evt) => {
      const id = evt.target.id();
      // Brief 23 (A54): edgeClickIsolate lights the tapped edge via the
      // emphasis layer; tapping the currently-isolated edge again clears.
      // Single-edge check because the isolate contract is one-edge-at-a-time
      // (setPathEffect over a multi-edge set is a different affordance).
      if (edgeClickIsolateRef.current) {
        const st = useEmphasisStore.getState();
        const emph = st.emphasizedEdgeIds;
        if (emph.size === 1 && emph.has(id)) {
          st.clear();
        } else {
          st.setPathEffect([], [id], id);
        }
        return;
      }
      selectEdges([id]);
    });

    // Background tap clears selection AND any active isolate (brief 23).
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        if (edgeClickIsolateRef.current) {
          const st = useEmphasisStore.getState();
          if (st.active) st.clear();
        }
        clearSelection();
      }
    });

    // Multi-select drag (review 4.8): the toolkit's selection is CSS
    // classes, never cy.select(), so cytoscape's native
    // drag-selected-together never engages. Reconstruct it: grabbing
    // a store-selected node anchors a group drag; the anchor's delta
    // applies to every other selected, unlocked node (locked = pinned
    // stays put, honoring the pin contract). Structural scenes are
    // excluded: port/compartment drags have their own wiring.
    if (!structural) {
      let groupDrag: {
        anchorId: string;
        anchorStart: { x: number; y: number };
        starts: Map<string, { x: number; y: number }>;
      } | null = null;
      cy.on("grab", "node", (evt) => {
        const anchor = evt.target;
        const sel = useSelectionStore.getState().selectedNodeIds;
        if (!sel.has(anchor.id()) || sel.size < 2) return;
        const starts = new Map<string, { x: number; y: number }>();
        for (const id of sel) {
          if (id === anchor.id()) continue;
          const el = cy.getElementById(id);
          if (el.nonempty() && !el.locked()) {
            const p = el.position();
            starts.set(id, { x: p.x, y: p.y });
          }
        }
        const ap = anchor.position();
        groupDrag = {
          anchorId: anchor.id(),
          anchorStart: { x: ap.x, y: ap.y },
          starts,
        };
      });
      cy.on("drag", "node", (evt) => {
        if (!groupDrag || evt.target.id() !== groupDrag.anchorId) return;
        const p = evt.target.position();
        const dx = p.x - groupDrag.anchorStart.x;
        const dy = p.y - groupDrag.anchorStart.y;
        for (const [id, s0] of groupDrag.starts) {
          cy.getElementById(id).position({ x: s0.x + dx, y: s0.y + dy });
        }
      });
      cy.on("free", "node", () => {
        groupDrag = null;
      });
    }

    // Lasso (box) selection -> store. Extracted and headless-tested in
    // box-selection-sync.ts; NOT a boxend + :selected read, because
    // cytoscape emits boxend BEFORE applying the box's selection (see
    // the helper's docstring for the 3.33.4 emit order).
    registerBoxSelectionSync(cy, selectNodes);

    // Subscribe to selection store; sync visual state via CSS classes.
    // addClass/removeClass do NOT fire selection events, so no loop.
    const unsub = useSelectionStore.subscribe((state) => {
      cy.batch(() => {
        cy.elements().removeClass("g3t-selected");
        for (const id of state.selectedNodeIds) {
          const el = cy.getElementById(id);
          if (el.length > 0) el.addClass("g3t-selected");
        }
        for (const id of state.selectedEdgeIds) {
          const el = cy.getElementById(id);
          if (el.length > 0) el.addClass("g3t-selected");
        }
      });
    });

    // Emphasis/effects layer (review 4.6): same store-to-classes
    // pattern as selection above, but a DISTINCT visual state (path
    // results must not read as selection). Initial apply covers
    // instances (re)built while an effect is active.
    applyEmphasisClasses(cy, useEmphasisStore.getState());
    const unsubEmphasis = useEmphasisStore.subscribe((state) => {
      applyEmphasisClasses(cy, state);
    });

    // Routed structural edges: mirror the data-carried bends into
    // per-element style bypasses (review 3.4; see the helper's doc).
    if (structural) applyRoutedSegmentBypasses(cy);

    cyRef.current = cy;
    layoutSettledRef.current = false;
    setOverlayCy(cy);
    // Re-apply the visibility filter to this (possibly rebuilt) instance.
    applyHiddenClasses(cy, hiddenRef.current);

    // Post-layout obstacle-aware edge routing (routeEdges prop). Skipped
    // for structural scenes (the structural router already owns them).
    // Generation counter guards against layoutstop double-fire (some
    // layout plugins emit twice) and against a deferred callback firing
    // after a fresher layoutstop has superseded it (rapid successive
    // relayouts): only the callback whose captured generation matches
    // the live counter runs.
    if (!structural) {
      let routingGeneration = 0;
      let warnedScale = false;
      // Resolve the config INSIDE the pass, from the live ref: these
      // handlers outlive prop changes (they are torn down only on cy
      // re-init), so a captured snapshot would pin the Routes mode from
      // mount time — a drag after switching Direct -> Orthogonal used to
      // reroute incident edges in the OLD mode (observed live: dragging
      // in Orthogonal un-routed the dragged node's edges). Wiring is also
      // unconditional for non-structural scenes so enabling routing after
      // mount still gets layoutstop/drag reroutes.
      const runPass = (incidentTo?: string): void => {
        const live = routeEdgesRef.current;
        if (!live) return;
        const cfg = resolveRouteCfg(live);
        const r = runCanvasEdgeRouting(cy, cfg, incidentTo);
        if (
          r.skipped &&
          !warnedScale &&
          cy.edges(".g3t-structural-edge-routed").length === 0 &&
          typeof process !== "undefined" &&
          process.env?.NODE_ENV !== "production"
        ) {
          warnedScale = true;
          console.warn(
            `[g3t] routeEdges skipped: visible edge count exceeds maxEdges=${cfg.maxEdges}. Raise maxEdges to route dense scenes, or leave routing off above the threshold.`,
          );
        }
      };
      cy.on("layoutstop", () => {
        layoutSettledRef.current = true;
        routingGeneration++;
        const gen = routingGeneration;
        // Only animate:true (per-tick animation) leaves positions
        // interpolating at layoutstop and needs the deferred read.
        // animate:false and animate:"end" both mean positions are
        // SETTLED at layoutstop; deferring there paints straight
        // beziers for animationDuration+16ms before edges snap to
        // routed polylines (visible flash on the Scale demo's return
        // paths where layoutOptions.animate is false but the canvas
        // prop is true). The layout-config `animate` overrides the
        // canvas prop by way of layoutOptionsRef spread order.
        const effectiveAnimate = layoutOptionsRef.current?.animate ?? animate;
        if (
          effectiveAnimate === false ||
          effectiveAnimate === "end" ||
          animationDuration === 0
        ) {
          runPass();
        } else {
          const delay = (animationDuration ?? 400) + 16;
          setTimeout(() => {
            // Stale callback (a newer layoutstop superseded): drop.
            if (gen !== routingGeneration) return;
            if (cyRef.current !== cy) return;
            runPass();
          }, delay);
        }
      });
      // Drag-free incident-edge reroute (subject to the same gate).
      cy.on("free", "node", (evt) => {
        runPass(evt.target.id());
      });
    }
    // Bugfix 3: read from ref (see comment near onReadyRef above)
    onReadyRef.current?.(cy);

    // Structural scenes: ports are top-level siblings (so they sit
    // outside their container), so reattach the drag-along that
    // compound children get for free.
    const disposePortDrag = structural ? wireStructuralPortDrag(cy) : undefined;

    // Return cleanup: unsubscribe store + remove the native-contextmenu
    // listener (Bugfix 8). The container survives across cy rebuilds, so
    // we'd accumulate listeners without explicit removal.
    const container = containerRef.current;
    return () => {
      unsub();
      unsubEmphasis();
      disposePortDrag?.();
      container.removeEventListener("contextmenu", suppressNativeContextMenu);
    };
    // Bugfix 3: dep array is data + config only. `stylesheet`, `onReady`,
    // and `manager` previously appeared here, but their identity changes
    // every parent render — those are now read from refs or treated as
    // stable. eslint correctly notices the missing deps; we suppress
    // because we know they are stable-by-ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ugm,
    containmentKey,
    layout,
    layoutOptionsKey,
    interactionKey,
    edgeStyle,
    composeMergedStylesheet,
    animate,
    animationDuration,
    // MR-1 flash fix: graph IDENTITY drives recreation; scene objects
    // over the same graph go through the patch effect above.
    graphEpoch,
  ]);

  // Scene routing (MR-1 flash fix): decide per structural change
  // whether the live instance can be PATCHED (same graph: collapse,
  // expand, re-layout) or the graph identity changed (recreate via
  // epoch). The creation effect below no longer depends on the scene
  // object itself.
  useEffect(() => {
    const key = structural
      ? structural.input.nodes
          .map((n) => n.id)
          .sort()
          .join("|")
      : "";
    const sameGraph = key !== "" && key === sceneKeyRef.current;
    sceneKeyRef.current = key;
    if (!structural) return;
    const cy = cyRef.current;
    if (sameGraph && cy) {
      const elements = structuralToCytoscapeElements(
        structural.input,
        structural.geometry,
        structuralDecorationsRef.current,
      );
      applyScenePatch(cy, elements);
      applyRoutedSegmentBypasses(cy);
      return;
    }
    if (!sameGraph && cyRef.current) setGraphEpoch((e) => e + 1);
  }, [structural, structuralDecorationsKey]);

  useEffect(() => {
    const unsub = initCytoscape();
    return () => {
      unsub?.();
      setOverlayCy(null);
      // Capture the live camera before teardown so the next same-graph
      // rebuild (e.g. a compartment collapse) restores it instead of fitting.
      if (cyRef.current) {
        lastCameraRef.current = {
          pan: { ...cyRef.current.pan() },
          zoom: cyRef.current.zoom(),
        };
        // Best-effort: minimal test mocks may not implement
        // position(); teardown must never throw.
        try {
          const pos = new Map<string, { x: number; y: number }>();
          cyRef.current.nodes().forEach((n) => {
            if (typeof n.position === "function") {
              pos.set(n.id(), { ...n.position() });
            }
          });
          lastPositionsRef.current = pos;
        } catch {
          lastPositionsRef.current = null;
        }
      }
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [initCytoscape]);

  // Spec application: batch element-data updates; Cytoscape restyles
  // from its data mappers. MUST follow the init effect in source
  // order: effects run top-down on mount, and this one needs
  // cyRef populated to apply the INITIAL spec.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !encodingSpec || structural) return;
    const patch = applyEncodingSpec(encodingSpec, ugm);
    // VR-2 follow-up (owner verification 2026-07-28): a spec change
    // that DROPS a channel must also CLEAR that channel's stale data,
    // or the old attribute-selector rule keeps matching forever
    // (leaving color-by-confidence left every edge amber: the new
    // spec wrote no _ecolor, and nothing removed the old one).
    const NODE_KEYS = ["_color", "_icon", "_size"] as const;
    const EDGE_KEYS = ["_ecolor", "_ewidth"] as const;
    cy.batch(() => {
      cy.nodes().forEach((ele) => {
        const data = patch.nodes.get(ele.id());
        for (const k of NODE_KEYS) {
          if (
            (data === undefined || !(k in data)) &&
            ele.data(k) !== undefined
          ) {
            ele.removeData(k);
          }
        }
      });
      cy.edges().forEach((ele) => {
        const data = patch.edges.get(ele.id());
        for (const k of EDGE_KEYS) {
          if (
            (data === undefined || !(k in data)) &&
            ele.data(k) !== undefined
          ) {
            ele.removeData(k);
          }
        }
      });
      patch.nodes.forEach((data, id) => {
        const ele = cy.getElementById(id);
        if (ele.nonempty()) ele.data(data);
      });
      patch.edges.forEach((data, id) => {
        const ele = cy.getElementById(id);
        if (ele.nonempty()) ele.data(data);
      });
      // Review 4.7: the spec may have (re)stamped _icon; pinned nodes
      // render background-image from _bgStack, so their stacks must
      // re-compose here or the new icon never shows under the badge.
      const badge = pinBadgeUri(useThemeStore.getState().theme);
      cy.nodes().forEach((n) => {
        if (n.hasClass("g3t-pinned")) composePinStack(n, badge);
      });
    });
  }, [encodingSpec, ugm, structural]);

  // routeEdges prop CHANGE handler: when the config flips or is enabled
  // after mount, run the pass immediately against the current positions.
  // The init effect wires listeners for FUTURE layoutstops and drag-frees;
  // this covers "turn routing on for the already-mounted scene". When
  // routing is disabled (prop is false/undefined) after being on, we
  // clear the routed data so edges revert to bezier without waiting for
  // a re-layout.
  const routeEdgesKey = routeEdges
    ? typeof routeEdges === "object"
      ? JSON.stringify(routeEdges)
      : "true"
    : "";
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (routeEdges) {
      // Skip if the current cy has not settled a layout yet: the init
      // effect's layoutstop handler will route with correct positions.
      // Routing here against a still-animating fcose paints edges to
      // the initial (random) positions until layoutstop fires - the
      // Scale demo's first-visit flash. Prop flips AFTER settle still
      // route immediately (the intended change-handler behavior).
      if (!layoutSettledRef.current) return;
      runCanvasEdgeRouting(cy, resolveRouteCfg(routeEdges));
    } else {
      // Clear any previously stamped routing data so edges revert.
      cy.batch(() => {
        cy.edges(".g3t-canvas-edge-routed").forEach((e) => {
          if (e.data("_segDist") !== undefined) e.removeData("_segDist");
          if (e.data("_segWeight") !== undefined) e.removeData("_segWeight");
          e.removeClass("g3t-canvas-edge-routed");
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeEdgesKey, ugm]);

  // Refresh routes (brief 23, A54): explicit re-run of the routing pass
  // on CURRENT node boxes. Signal-counter API: host bumps the number, we
  // fire on real change. No-op when routing is off or the scene is
  // structural (runCanvasEdgeRouting itself guards structural). We skip
  // the initial mount (lastSignalRef seeded to the first value) so mount
  // does not double-fire against the init effect's layoutstop handler.
  const lastRouteRefreshSignalRef = useRef(routeRefreshSignal);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (routeRefreshSignal === lastRouteRefreshSignalRef.current) return;
    lastRouteRefreshSignalRef.current = routeRefreshSignal;
    const cfg = routeEdgesRef.current;
    if (!cfg) return;
    runCanvasEdgeRouting(cy, resolveRouteCfg(cfg));
  }, [routeRefreshSignal]);

  // Re-layout / untangle (brief 23, A54): explicit user op — reads current
  // boxes, runs the crossing-aware placement optimizer, applies the new
  // positions, then re-runs the routing pass. Non-structural only. This
  // moves nodes deliberately (not a same-graph camera hold — same class as
  // reheat/fit/zoom, per the camera-stability doctrine).
  const lastRelayoutSignalRef = useRef(relayoutSignal);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (relayoutSignal === lastRelayoutSignalRef.current) return;
    lastRelayoutSignalRef.current = relayoutSignal;
    if (structuralRef.current) return;
    const r = runCanvasRelayout(cy);
    if (r.skipped) return;
    const cfg = routeEdgesRef.current;
    if (!cfg) return;
    runCanvasEdgeRouting(cy, resolveRouteCfg(cfg));
  }, [relayoutSignal]);

  // Visibility filter (hidden prop): a batched class toggle, applied on
  // every hidden-set change. NOT in the init dep array, so toggling the
  // filter never re-creates the instance or re-runs layout; node
  // positions survive. The init path applies the initial/rebuilt set via
  // applyHiddenClasses(cy, hiddenRef.current).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyHiddenClasses(cy, hidden);
  }, [hidden]);

  // Per-instance style overrides (M12): the precedence layer ABOVE
  // the spec. Applied as Cytoscape BYPASS styles, which win over
  // every stylesheet mapper (so a pinned node survives spec
  // re-application) and restore lower layers cleanly on removal.
  // The store previously had no canvas consumer at all (round-14
  // finding): NodeStyleEditor and the context-menu actions wrote
  // overrides nothing read. Reserved channels stay safe: overrides
  // never touch outline-* (the selection gasket).
  const styleOverrides = useStyleOverrideStore((s) => s.overrides);
  const overriddenIdsRef = useRef<Set<string>>(new Set());
  // LR-37 (owner review 2026-07-22): id -> the _icon uri THIS effect
  // stamped, so restore can tell its own stamps from the spec's.
  const overrideIconRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    // Nothing applied and nothing to apply: skip the batch entirely
    // (also keeps minimal test mocks honest about what mount needs).
    if (overriddenIdsRef.current.size === 0 && styleOverrides.length === 0)
      return;
    const badge = pinBadgeUri(useThemeStore.getState().theme);
    cy.batch(() => {
      // Restore everything previously bypassed, then apply current.
      for (const id of overriddenIdsRef.current) {
        const ele = cy.getElementById(id);
        if (ele.nonempty()) {
          ele.removeStyle();
          // Clear only OUR icon stamp (a spec re-stamp wins and
          // stays). Nodes whose SPEC icon was shadowed by an
          // override get it back on the spec effect's next run;
          // immediate restoration would mean re-running the spec
          // patch here, deliberately out of this effect's scope.
          const stamped = overrideIconRef.current.get(id);
          if (stamped !== undefined && ele.data("_icon") === stamped) {
            ele.removeData("_icon");
          }
        }
      }
      overriddenIdsRef.current.clear();
      overrideIconRef.current.clear();
      for (const override of styleOverrides) {
        const entry = overridesToCytoscapeStyles([override])[0];
        if (!entry) continue;
        // LR-37 ROOT CAUSE: icon overrides used to ship as a FLAT
        // background-image style bypass: invisible to
        // composePinStack (which reads _icon data) and clobbering
        // its multi-image array on pinned nodes. Hence "icon
        // replaces pin" and, on unpin/pin, "pin change removes the
        // icon until other changes re-apply it". splitIcon... moves
        // the icon to _icon DATA; background-* leaves the bypass.
        const { style, iconUri } = splitIconFromOverrideStyle(
          entry.style as Record<string, unknown>,
        );
        const targets =
          "nodeId" in override.scope
            ? cy.getElementById(override.scope.nodeId)
            : cy.nodes().filter(
                // LR-47 (owner review 2026-07-22): a type-scoped
                // override applies to ANY membership, not just the
                // primary type: multi-type nodes (most of the
                // ontology) previously ignored "Any {Type}" unless
                // the type happened to be first.
                (n) =>
                  ((n.data("types") as string[] | undefined) ?? []).includes(
                    (override.scope as { type: string }).type,
                  ),
              );
        targets.forEach((ele) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ele.style(style as any);
          if (iconUri !== undefined) {
            ele.data("_icon", iconUri);
            overrideIconRef.current.set(ele.id(), iconUri);
          }
          overriddenIdsRef.current.add(ele.id());
        });
      }
      // Pinned nodes render from the composed stack: re-compose so
      // badge AND (any) icon coexist after every override pass.
      cy.nodes().forEach((n) => {
        if (n.hasClass("g3t-pinned")) composePinStack(n, badge);
      });
    });
  }, [styleOverrides, encodingSpec, ugm]);

  // Position pins (round 17): lock exactly the derived set, unlock
  // the rest, and carry the subtle indicator class. Pin-all composes
  // as the union; releasing it returns to the per-node set
  // (computeLockedIds is the pure, tested rule).
  const pinnedIds = usePositionPinStore((s) => s.pinnedIds);
  const allPinned = usePositionPinStore((s) => s.allPinned);
  const lockedIdsRef = useRef<Set<string>>(new Set());
  // Declared here (above the pin effect) because the badge color is
  // theme-resolved; the round-20 theme restyle effect below shares
  // this subscription.
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    // Nothing locked and nothing to lock: skip entirely (also keeps
    // minimal test mocks honest about what a bare mount needs).
    if (!allPinned && pinnedIds.length === 0 && lockedIdsRef.current.size === 0)
      return;
    const allIds: string[] = [];
    cy.nodes().forEach((n) => {
      allIds.push(n.id());
    });
    const locked = computeLockedIds(allPinned, pinnedIds, allIds);
    const badge = pinBadgeUri(useThemeStore.getState().theme);
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        if (locked.has(n.id())) {
          n.lock();
          composePinStack(n, badge);
          n.addClass("g3t-pinned");
        } else {
          n.unlock();
          n.removeClass("g3t-pinned");
          n.removeStyle(PIN_BYPASS_PROPS.join(" "));
        }
      });
    });
    lockedIdsRef.current = locked;
  }, [pinnedIds, allPinned, ugm, theme]);

  // Theme -> canvas (round 20): restyle-only, like the spec effect.
  // The theme is NOT an init dependency (re-init would destroy
  // positions on every switch); a theme change rebuilds the same
  // merged stylesheet and applies it in place. Bypass styles
  // (instance overrides) and classes survive fromJson by Cytoscape's
  // contract; element data is untouched.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || themeAppliedRef.current === theme) return;
    themeAppliedRef.current = theme;
    cy.style()
      .fromJson(composeMergedStylesheet(theme) as never)
      .update();
  }, [theme, composeMergedStylesheet]);

  // Algorithm overlays (round 21): classes only, computed from the
  // pure union rule; deactivating every overlay strips both classes,
  // restoring the prior styling exactly (the acceptance criterion).
  const overlays = useOverlayStore((s) => s.overlays);
  const overlayActiveIds = useOverlayStore((s) => s.activeIds);
  const overlayTouchedRef = useRef(false);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const { anyActive, memberNodes, memberEdges } = computeOverlayMembership(
      overlays,
      overlayActiveIds,
    );
    // Scope to THIS canvas (round 40): the overlay store is a global
    // singleton, so on a page with several canvases an overlay
    // registered for one canvas's nodes would otherwise fire every
    // canvas's effect and dim the others wholesale (none of their
    // nodes are members). Only react when an active overlay actually
    // references an element present here; otherwise this canvas is
    // not a participant and must be left untouched. A single-canvas
    // app is unaffected: its overlays always reference its own nodes.
    let touchesThisCanvas = false;
    if (anyActive) {
      const present = (id: string): boolean => cy.getElementById(id).nonempty();
      for (const id of memberNodes) {
        if (present(id)) {
          touchesThisCanvas = true;
          break;
        }
      }
      if (!touchesThisCanvas) {
        for (const id of memberEdges) {
          if (present(id)) {
            touchesThisCanvas = true;
            break;
          }
        }
      }
    }
    const effectiveActive = anyActive && touchesThisCanvas;
    if (!effectiveActive && !overlayTouchedRef.current) return;
    overlayTouchedRef.current = effectiveActive;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        n.removeClass("g3t-ov-member g3t-ov-dim");
        if (!effectiveActive) return;
        if (memberNodes.has(n.id())) n.addClass("g3t-ov-member");
        else n.addClass("g3t-ov-dim");
      });
      cy.edges().forEach((e) => {
        e.removeClass("g3t-ov-member g3t-ov-dim");
        if (!effectiveActive) return;
        if (memberEdges.has(e.id())) e.addClass("g3t-ov-member");
        else e.addClass("g3t-ov-dim");
      });
    });
  }, [overlays, overlayActiveIds, ugm]);

  // Bugfix 16: belt-and-suspenders contextmenu suppression. We already
  // attach a native contextmenu listener inside initCytoscape (bugfix
  // 8), but a user reported the OS menu STILL appearing behind ours -
  // probably because the native listener was being cleaned up around
  // re-renders, or because the event was firing on an element that
  // didn't propagate to the container ref for whatever reason. React's
  // synthetic onContextMenu runs at the document level and is
  // guaranteed to fire as long as the div is mounted; it's also
  // simpler than managing native listener lifecycle. We keep BOTH
  // because:
  //   - Native listener catches contextmenu events fired on
  //     descendants that React's synthetic system might miss (e.g.
  //     events on dynamically inserted canvases inside cytoscape).
  //   - React handler covers anything the native handler doesn't.
  const suppressContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onContextMenu={suppressContextMenu}
    >
      <div
        ref={containerRef}
        className={className}
        style={{ width: "100%", height: "100%", minHeight: 400 }}
        data-testid="cytoscape-canvas"
        onContextMenu={suppressContextMenu}
      />
      {structural && structuralEdgeLayer === "svg-overlay" && overlayCy && (
        <StructuralEdgeOverlay
          cy={overlayCy}
          theme={{
            stroke: theme.textSecondary,
            labelColor: theme.textPrimary,
            labelHalo: theme.canvasBg,
          }}
        />
      )}
      {menuState && (
        <ContextMenu
          items={menuState.items}
          target={menuState.target}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  );
}
