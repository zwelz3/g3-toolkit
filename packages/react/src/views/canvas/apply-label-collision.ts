/**
 * The Cytoscape side of label collision (issue #40): measure every
 * visible element's rendered label box, run the pure resolver, and
 * apply the decisions as a restyle. The decision rule lives in
 * label-collision.ts; this file only knows how to read boxes from a
 * live instance and how to write the outcome back.
 *
 * Application is by MECHANISM, matching the canvas doctrine:
 * - hide: the `g3t-label-hidden` class, whose rule sets `label: ""`.
 * - shorten: a `_labelShort` data field read by a `[_labelShort]`-
 *   scoped rule (`label: data(_labelShort)`), so elements without it
 *   never trigger a per-frame mapping warning.
 * Neither touches `label` itself: applyEncodingPatch owns that field
 * (it restores the converter's value when a spec drops the channel),
 * and writing a truncated string there would be mistaken for host
 * intent. Both the class and the field are stripped before every
 * measure, so a pass starts from the full labels and never judges a
 * label against its own previous truncation.
 *
 * Restyle only, by construction: no layout call, no camera call, no
 * position write. Headless-safe: a minimal mock or a jsdom instance
 * without a renderer yields no measurable boxes, and the pass is a
 * no-op (every label stays shown).
 */
import type { Core, SingularElementArgument } from "cytoscape";
import {
  composeLabelPriority,
  resolveLabelCollisions,
  type LabelCandidate,
} from "./label-collision";

export const LABEL_HIDDEN_CLASS = "g3t-label-hidden";
export const LABEL_SHORT_FIELD = "_labelShort";
/** The element data field a host stamps to rank labels without a
 *  `labelPriority` accessor. */
export const LABEL_PRIORITY_FIELD = "_labelPriority";

export interface LabelCollisionPassOptions {
  mode: "hide" | "shorten";
  maxLength?: number;
  /** Host-supplied rank; falls back to the `_labelPriority` field. */
  priority?: (ele: SingularElementArgument) => number;
  /** From the selection store: these outrank everything else. */
  selectedIds: ReadonlySet<string>;
  hoveredNodeId: string | null;
}

/** Labels only: no body, no overlay, no edge endpoint labels (the
 *  canvas renders none), and the ROTATED main-label box for edges. */
const LABEL_BOX_OPTS = {
  includeNodes: false,
  includeEdges: false,
  includeLabels: true,
  includeMainLabels: true,
  includeSourceLabels: false,
  includeTargetLabels: false,
  includeOverlays: false,
  includeUnderlays: false,
} as const;

type MeasurableElement = SingularElementArgument & {
  renderedBoundingBox?: (opts: typeof LABEL_BOX_OPTS) => {
    x1: number;
    y1: number;
    w: number;
    h: number;
  };
  visible?: () => boolean;
  degree?: (includeLoops: boolean) => number;
};

function readLabelBox(
  ele: MeasurableElement,
): { x: number; y: number; w: number; h: number } | null {
  if (typeof ele.renderedBoundingBox !== "function") return null;
  try {
    const bb = ele.renderedBoundingBox(LABEL_BOX_OPTS);
    if (
      !bb ||
      !Number.isFinite(bb.x1) ||
      !Number.isFinite(bb.y1) ||
      !Number.isFinite(bb.w) ||
      !Number.isFinite(bb.h)
    )
      return null;
    return { x: bb.x1, y: bb.y1, w: bb.w, h: bb.h };
  } catch {
    return null;
  }
}

/** Reset every element to its full label (class and field off). Called
 *  by the pass before measuring and by the canvas when the mode flips
 *  back to "none", so switching the feature off restores exactly. */
export function clearLabelCollision(cy: Core): void {
  cy.batch(() => {
    cy.elements().forEach((ele) => {
      if (ele.hasClass(LABEL_HIDDEN_CLASS)) ele.removeClass(LABEL_HIDDEN_CLASS);
      if (ele.data(LABEL_SHORT_FIELD) !== undefined)
        ele.removeData(LABEL_SHORT_FIELD);
    });
  });
}

export function applyLabelCollisionPass(
  cy: Core,
  options: LabelCollisionPassOptions,
): void {
  // Two batches with the measure in between: the reset must have
  // taken effect (batch end flushes style) before boxes are read, or
  // a label hidden by the previous pass measures as an empty box and
  // is "shown" over whatever has since moved under it.
  clearLabelCollision(cy);
  const candidates: LabelCandidate[] = [];
  const { selectedIds, hoveredNodeId } = options;
  cy.elements().forEach((raw) => {
    const ele = raw as MeasurableElement;
    if (typeof ele.visible === "function" && !ele.visible()) return;
    // Only the converter's `label` field is a candidate: structural
    // sub-elements render `_label` through class rules and a bare
    // element without a label has nothing to collide.
    const text = ele.data("label");
    if (typeof text !== "string" || text === "") return;
    const box = readLabelBox(ele);
    if (!box) return;
    const isNode = ele.isNode();
    const id = ele.id();
    let explicit: number | undefined;
    if (options.priority) {
      explicit = options.priority(ele);
    } else {
      const field = ele.data(LABEL_PRIORITY_FIELD);
      explicit = typeof field === "number" ? field : undefined;
    }
    let weight: number | undefined;
    if (isNode) {
      weight = typeof ele.degree === "function" ? ele.degree(false) : 0;
    } else {
      const w = ele.data("weight");
      weight = typeof w === "number" ? w : 0;
    }
    // An edge touching the hovered node reads as hovered too: the
    // host's old renderer placed "the hovered node, then the selected
    // node's edges" first, and an edge label is what a hover is
    // usually asking about.
    const hovered =
      hoveredNodeId !== null &&
      (isNode
        ? id === hoveredNodeId
        : ele.data("source") === hoveredNodeId ||
          ele.data("target") === hoveredNodeId);
    const selected =
      selectedIds.has(id) ||
      (!isNode &&
        (selectedIds.has(String(ele.data("source"))) ||
          selectedIds.has(String(ele.data("target")))));
    candidates.push({
      id,
      kind: isNode ? "node" : "edge",
      box,
      text,
      priority: composeLabelPriority({
        kind: isNode ? "node" : "edge",
        selected,
        hovered,
        explicit,
        weight,
      }),
    });
  });
  if (candidates.length === 0) return;
  const { decisions, shortened } = resolveLabelCollisions(candidates, {
    mode: options.mode,
    maxLength: options.maxLength,
  });
  cy.batch(() => {
    decisions.forEach((decision, id) => {
      if (decision === "show") return;
      const ele = cy.getElementById(id);
      if (ele.empty()) return;
      if (decision === "hide") ele.addClass(LABEL_HIDDEN_CLASS);
      else ele.data(LABEL_SHORT_FIELD, shortened.get(id));
    });
  });
}
