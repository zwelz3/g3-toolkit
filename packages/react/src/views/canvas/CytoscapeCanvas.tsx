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
import { prefersReducedMotion } from "@g3t/core";

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
    // Bugfix 21: bezier override for edges that need the curve.
    // ugmToCytoscapeElements sets _curveStyle = "bezier" for self-loops,
    // parallel multi-edges, and bidirectional pairs.
    selector: 'edge[_curveStyle = "bezier"]',
    style: {
      "curve-style": "bezier",
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
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface CytoscapeCanvasProps {
  /** The UGM instance to render. MUST be referentially stable across
   *  renders: a new identity means "different graph" and triggers a
   *  full re-init INCLUDING layout. Memoize in the parent; do not
   *  rebuild per render. */
  ugm: UGM;
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
  containment?: ContainmentOptions;
  /** Structural scene (Group A slice A2, R1.18): when present, the
   *  canvas renders the laid-out structural geometry INSTEAD of the
   *  UGM projection, with layout "preset" (positions come from the
   *  document; force layouts never run over a structural scene).
   *  Rows are selectable elements; give rows the source element's
   *  id and selection/inspector machinery applies unmodified. Must
   *  be referentially stable, like ugm. */
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
  const stylesheetRef = useRef(stylesheet);
  // eslint-disable-next-line react-hooks/refs
  stylesheetRef.current = stylesheet;
  const hiddenRef = useRef(hidden);
  // eslint-disable-next-line react-hooks/refs
  hiddenRef.current = hidden;

  /** One stylesheet assembly for init AND live theme restyles.
   *  Order is the precedence story: structural defaults (fallback
   *  literals) -> spec-channel rules -> theme-resolved colors ->
   *  user stylesheet. */
  const composeMergedStylesheet = useCallback(
    (theme: G3tTheme): CyStylesheet[] => {
      const merged: CyStylesheet[] = [...DEFAULT_STYLESHEET];
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        });
      }
      merged.push(
        ...ENCODING_EDGE_RULES,
        ...ENCODING_NODE_RULES,
        PIN_INDICATOR_RULE,
        COMPOUND_CONTAINER_RULE,
        // Structural-scene rules (slice A2): class-scoped, inert
        // without structural elements; AFTER the compound rule so
        // the structural container override (zero padding, no
        // compound label) wins over the generic :parent styling.
        ...(STRUCTURAL_RULES as CyStylesheet[]),
        ...OVERLAY_RULES,
        ...themeColorRules(theme),
        // Structural COLORS (round 41 dark-mode fix): theme-reactive,
        // recomposed on theme change. AFTER themeColorRules so the
        // structural selectors (container/header/row/divider/port/
        // severity) win their colors over the generic node/:parent
        // rules; structural rows render light in dark mode without
        // this because STRUCTURAL_RULES now carries structure only.
        ...(structuralThemeRules(theme) as CyStylesheet[]),
      );
      // Bugfix 3: read from ref (see comment near onReadyRef above)
      if (stylesheetRef.current) {
        merged.push(...stylesheetRef.current);
      }
      // SVG overlay mode (G3L:RND-002): routed structural edges go
      // fully transparent in Cytoscape (line, arrows, label) while
      // STAYING mounted and hit-testable, so hover and context-menu
      // events keep firing on them; the overlay draws the visuals.
      // opacity (not display:none) is load-bearing: display:none
      // would remove the elements from hit testing.
      if (structuralEdgeLayer === "svg-overlay") {
        merged.push({
          selector: "edge.g3t-structural-edge-routed",
          style: { opacity: 0 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      // Visibility filter (hidden prop): last so it wins over every
      // mapper. display:none drops the node from layout and Cytoscape
      // auto-hides its incident edges.
      merged.push({
        selector: ".g3t-hidden",
        style: { display: "none" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return merged;
    },
    [edgeStyle, structuralEdgeLayer],
  );
  const themeAppliedRef = useRef<G3tTheme | null>(null);

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
      : "";
    const sameGraphRebuild =
      structural &&
      wasStructuralRef.current &&
      inputKey === prevInputKeyRef.current;

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

    const layoutName = structural
      ? "preset"
      : (layout ?? (fcoseRegistered ? "fcose" : "cose"));

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: mergedStylesheet,
      // Bugfix 14: enable scroll-wheel zoom + drag-pan explicitly.
      // These are Cytoscape defaults but stating them defensively
      // here makes the behavior intentional in case someone sets
      // these elsewhere via cy.userZoomingEnabled() / etc.
      userZoomingEnabled: true,
      userPanningEnabled: true,
      // wheelSensitivity intentionally LEFT at cytoscape's default to
      // avoid the "wheelSensitivity not recommended" warning. Override
      // via cy.wheelSensitivity() after onReady if needed for trackpads.
      // Lasso (box) multi-select, M1.E3.T3. GESTURE: with panning also
      // enabled (the default here), cytoscape enters box mode only while
      // a multi-select modifier is held (shift, ctrl, or meta); a plain
      // background drag pans. Disable userPanningEnabled if you want
      // plain-drag box selection. box-selection-sync.ts syncs the store.
      boxSelectionEnabled: true,
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
      selectEdges([evt.target.id()]);
    });

    // Background tap clears selection
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
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
    setOverlayCy(cy);
    // Re-apply the visibility filter to this (possibly rebuilt) instance.
    applyHiddenClasses(cy, hiddenRef.current);
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
    containment,
    layout,
    layoutOptionsKey,
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
    cy.batch(() => {
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
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    // Nothing applied and nothing to apply: skip the batch entirely
    // (also keeps minimal test mocks honest about what mount needs).
    if (overriddenIdsRef.current.size === 0 && styleOverrides.length === 0)
      return;
    cy.batch(() => {
      // Restore everything previously bypassed, then apply current.
      for (const id of overriddenIdsRef.current) {
        const ele = cy.getElementById(id);
        if (ele.nonempty()) ele.removeStyle();
      }
      overriddenIdsRef.current.clear();
      for (const override of styleOverrides) {
        const entry = overridesToCytoscapeStyles([override])[0];
        if (!entry) continue;
        const style = entry.style as Record<string, unknown>;
        const targets =
          "nodeId" in override.scope
            ? cy.getElementById(override.scope.nodeId)
            : cy
                .nodes()
                .filter(
                  (n) =>
                    (n.data("types") as string[] | undefined)?.[0] ===
                    (override.scope as { type: string }).type,
                );
        targets.forEach((ele) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ele.style(style as any);
          overriddenIdsRef.current.add(ele.id());
        });
      }
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
