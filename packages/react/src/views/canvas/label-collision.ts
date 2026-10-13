/**
 * Label collision resolution (issue #40): a pure, renderer-agnostic
 * greedy placement over label boxes.
 *
 * Cytoscape draws every label at its element and never moves one out
 * of another's way, so a dense graph (the reporter's 59-publication,
 * 223-relation citation network in layered rows) overprints labels in
 * the same layer until the user zooms in. The host's previous SVG
 * renderer placed labels greedily by priority and hid or shortened the
 * losers; this module restores that decision rule as a function of
 * boxes, so the canvas (or a host's own renderer) can measure, decide,
 * and apply without the rule knowing anything about Cytoscape.
 *
 * Contract:
 * - Candidates are visited in DESCENDING priority; ties break node
 *   before edge, then by id, so the output is a pure function of the
 *   input (no Map-iteration or insertion-order dependence).
 * - A candidate whose box overlaps no already-placed box is shown and
 *   its box is placed.
 * - Otherwise, in "shorten" mode, the text is truncated to `maxLength`
 *   characters (ellipsis included) and the box shrunk proportionally
 *   about its center (both canvas label anchors, a node's bottom-center
 *   label and an edge's midpoint label, are centered on the text); if
 *   the shortened box fits, the decision is "shorten" and the shrunk
 *   box is placed. A text already within `maxLength` cannot shorten.
 * - Anything that still overlaps is hidden. Hidden labels place no box,
 *   so the next candidate down is judged against what is actually
 *   drawn, never against an invisible label.
 *
 * Complexity is O(n * placed) with a plain scan; at the sizes the
 * canvas labels (hundreds to low thousands) that is well under a
 * frame. A spatial index can replace the scan without changing the
 * contract if a host measures tens of thousands of labels.
 */

export type LabelKind = "node" | "edge";

/** An axis-aligned box in whatever coordinate space the caller
 *  measured in (the canvas passes rendered pixels). */
export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelCandidate {
  id: string;
  kind: LabelKind;
  box: LabelBox;
  /** Higher wins. See composeLabelPriority for the canvas's rule. */
  priority: number;
  text: string;
}

export type LabelDecision = "show" | "hide" | "shorten";

export interface LabelCollisionOptions {
  /** "hide": losers are hidden. "shorten": losers are truncated when
   *  the truncated box fits, hidden otherwise. */
  mode: "hide" | "shorten";
  /** Maximum character count of a shortened label, ellipsis included.
   *  Default DEFAULT_LABEL_MAX_LENGTH. */
  maxLength?: number;
  /** Extra clearance (same units as the boxes) required between two
   *  placed labels. Default 0: boxes that touch do not collide. */
  padding?: number;
}

export interface LabelCollisionResult {
  /** One decision per candidate id. */
  decisions: Map<string, LabelDecision>;
  /** The truncated text for every "shorten" decision. */
  shortened: Map<string, string>;
}

export const DEFAULT_LABEL_MAX_LENGTH = 16;
export const LABEL_ELLIPSIS = "…";

/** Truncate to `maxLength` characters including the ellipsis. Returns
 *  the text unchanged when it already fits (so a caller can tell "no
 *  shortening possible" by identity). Code points, not UTF-16 units,
 *  so an astral character is never split. */
export function shortenLabel(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  const keep = Math.max(0, maxLength - 1);
  return chars.slice(0, keep).join("").trimEnd() + LABEL_ELLIPSIS;
}

/** Strict overlap with optional clearance: two boxes that merely
 *  touch (or sit `padding` apart) are not a collision. */
export function boxesOverlap(a: LabelBox, b: LabelBox, padding = 0): boolean {
  return (
    a.x < b.x + b.w + padding &&
    b.x < a.x + a.w + padding &&
    a.y < b.y + b.h + padding &&
    b.y < a.y + a.h + padding
  );
}

/** The box a shortened label occupies: width scaled by the character
 *  ratio, re-centered on the original box. Height is unchanged. */
export function shortenedBox(
  box: LabelBox,
  fullText: string,
  shortText: string,
): LabelBox {
  const fullLen = Array.from(fullText).length;
  if (fullLen === 0) return box;
  const ratio = Math.min(1, Array.from(shortText).length / fullLen);
  const w = box.w * ratio;
  return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h };
}

/** Deterministic visit order: priority desc, node before edge, id asc. */
export function orderLabelCandidates<T extends LabelCandidate>(
  candidates: readonly T[],
): T[] {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.kind !== b.kind) return a.kind === "node" ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function resolveLabelCollisions(
  candidates: readonly LabelCandidate[],
  options: LabelCollisionOptions,
): LabelCollisionResult {
  const maxLength = options.maxLength ?? DEFAULT_LABEL_MAX_LENGTH;
  const padding = options.padding ?? 0;
  const decisions = new Map<string, LabelDecision>();
  const shortened = new Map<string, string>();
  const placed: LabelBox[] = [];
  const collides = (box: LabelBox): boolean => {
    for (const p of placed) {
      if (boxesOverlap(box, p, padding)) return true;
    }
    return false;
  };
  for (const c of orderLabelCandidates(candidates)) {
    // An empty or degenerate box (no text, or a renderer that could
    // not measure) never collides and never occupies space.
    const measurable = c.text !== "" && c.box.w > 0 && c.box.h > 0;
    if (!measurable) {
      decisions.set(c.id, "show");
      continue;
    }
    if (!collides(c.box)) {
      decisions.set(c.id, "show");
      placed.push(c.box);
      continue;
    }
    if (options.mode === "shorten") {
      const short = shortenLabel(c.text, maxLength);
      if (short !== c.text) {
        const box = shortenedBox(c.box, c.text, short);
        if (!collides(box)) {
          decisions.set(c.id, "shorten");
          shortened.set(c.id, short);
          placed.push(box);
          continue;
        }
      }
    }
    decisions.set(c.id, "hide");
  }
  return { decisions, shortened };
}

export interface LabelPriorityInput {
  kind: LabelKind;
  /** The element is in the selection store (or is incident to a
   *  selected element, by the caller's choice). */
  selected?: boolean;
  /** The element is the hovered node (or incident to it). */
  hovered?: boolean;
  /** Host-supplied rank: the `_labelPriority` data field or the
   *  `labelPriority` prop's return. Clamped to +/- 99,999. */
  explicit?: number;
  /** Final tiebreak: node degree or edge weight. Clamped to 0..999. */
  weight?: number;
}

/** The canvas's priority rule as one number, lexicographic by
 *  construction: selected > hovered > explicit rank > node before
 *  edge > degree/weight. Each tier's range is strictly narrower than
 *  the step above it, so a lower tier can never outvote a higher one.
 *  Exposed so a host measuring its own labels gets the same ordering
 *  the canvas uses. */
export function composeLabelPriority(input: LabelPriorityInput): number {
  const clamp = (v: number, lo: number, hi: number): number =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;
  const tier = input.selected ? 2 : input.hovered ? 1 : 0;
  const explicit = clamp(input.explicit ?? 0, -99_999, 99_999);
  const kind = input.kind === "node" ? 1_000 : 0;
  const weight = clamp(input.weight ?? 0, 0, 999);
  return tier * 1e12 + explicit * 1e6 + kind + weight;
}
