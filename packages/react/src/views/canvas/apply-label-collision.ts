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
 * Candidacy follows the RENDERED label, not the data field (issues
 * #60 and #68): an element is a candidate only when it carries the
 * converter's `label` data field AND the stylesheet actually draws
 * something for it. A rendered label that is empty or whitespace only
 * (`label: ""` by rule), or a rendered `text-opacity` of 0 (how
 * `labelVisible: false` and the structural converter blank a label),
 * draws nothing, so such an element is not measured, not ranked,
 * never given the hide class, and never given `_labelShort`. Shorten
 * mode truncates the rendered label too, so a host rule mapping
 * `label: data(name)` is shortened from `name`. When the instance
 * cannot report its parsed style (headless, or a minimal mock without
 * `pstyle`) the data `label` is the only evidence and both rules fall
 * back to it.
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
  /** Cytoscape's parsed-style read; undefined on a style-disabled
   *  (headless) instance, and absent from a minimal mock. */
  pstyle?: (
    name: string,
  ) => { strValue?: unknown; pfValue?: unknown; value?: unknown } | undefined;
};

/** The label as the stylesheet renders it, or undefined when the
 *  instance cannot say (headless, or a mock without `pstyle`), in which
 *  case the data field is the only evidence and candidacy falls back to
 *  it. A host that blanks labels by rule (`label: ""` on edges until
 *  hovered, say) leaves the data label intact, so the data field alone
 *  cannot tell a shown label from a blanked one (issue #60). */
function readRenderedLabel(ele: MeasurableElement): string | undefined {
  if (typeof ele.pstyle !== "function") return undefined;
  try {
    const prop = ele.pstyle("label");
    if (!prop) return undefined;
    return typeof prop.strValue === "string" ? prop.strValue : undefined;
  } catch {
    return undefined;
  }
}

/** The rendered `text-opacity`, or undefined when the instance cannot
 *  say (same fallback as readRenderedLabel). Cytoscape's renderer reads
 *  the parsed number as `pfValue`; `value` is the belt for a mock that
 *  reports only the raw one. A label drawn at opacity 0 keeps its full
 *  box, so the box alone cannot tell it from a shown label (issue #68),
 *  and the toolkit itself blanks labels this way (`labelVisible:
 *  false`, structural port labels). */
function readRenderedTextOpacity(ele: MeasurableElement): number | undefined {
  if (typeof ele.pstyle !== "function") return undefined;
  try {
    const prop = ele.pstyle("text-opacity");
    if (!prop) return undefined;
    if (typeof prop.pfValue === "number") return prop.pfValue;
    return typeof prop.value === "number" ? prop.value : undefined;
  } catch {
    return undefined;
  }
}

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
    const dataLabel = ele.data("label");
    if (typeof dataLabel !== "string" || dataLabel.trim() === "") return;
    // Candidacy follows the RENDERED label, not the data field: a
    // label the stylesheet blanks measures as a zero box at the pan
    // point, which would rank against (and could hide) a real label
    // covering that point, and could itself take the hide class, which
    // then suppresses the label when a hover rule later shows it. Such
    // an element is not measured at all. Whitespace draws nothing
    // either, and a label at `text-opacity: 0` keeps its full box while
    // drawing nothing (issue #68), so both are out on the same grounds.
    // The zero-size guard below is the belt for an instance that
    // cannot report its parsed style.
    const rendered = readRenderedLabel(ele);
    if (rendered !== undefined && rendered.trim() === "") return;
    if (readRenderedTextOpacity(ele) === 0) return;
    // Shorten truncates what is drawn: under a host rule such as
    // `label: data(name)` the data `label` is the wrong field. The
    // previous pass's `_labelShort` was stripped above (and the batch
    // end flushed the style), so this is the full label, never the
    // already-shortened one.
    const text = rendered ?? dataLabel;
    const box = readLabelBox(ele);
    if (!box || box.w <= 0 || box.h <= 0) return;
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
