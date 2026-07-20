/**
 * Confidence-driven edge dimming as an EXPLICIT narrative control
 * (review 5.7). The fixture's `supplies` edges carry confidence 0.9
 * (they are consolidated from procurement records; ownership and
 * operation links are authoritative at 1.0), and the canvas's D1
 * channel maps edge opacity from `_confidence`. Left alone, that
 * rendered most edges faint by default with no stated reason: the
 * review's "unexplained muting". The rule now: the DEFAULT state
 * shows everything at full strength; the data-driven dimming only
 * appears when the user flips the labeled control.
 *
 * Mechanism: a DATA patch on `_confidence`, not a style bypass. A
 * bypass would outrank every class rule, so the emphasis layer's dim
 * (trace-route, review 4.6) could no longer fade these edges; the
 * data patch keeps the stylesheet's precedence intact. First-seen
 * values are recorded so re-enabling restores the fixture's true
 * confidences exactly.
 */

export interface ConfidenceEdgeLike {
  data(key: string): unknown;
  data(patch: Record<string, unknown>): void;
}

export interface ConfidenceCoreLike {
  batch(fn: () => void): void;
  edges(): { forEach(cb: (e: ConfidenceEdgeLike) => void): void };
}

export function applyConfidenceDim(
  core: ConfidenceCoreLike,
  dim: boolean,
  originals: Map<string, number>,
): void {
  core.batch(() => {
    core.edges().forEach((e) => {
      const current = e.data("_confidence");
      if (typeof current !== "number") return;
      const id = String(e.data("id"));
      if (!originals.has(id)) originals.set(id, current);
      // 12.12: the raw fixture value (0.9) is visually
      // indistinguishable from 1.0, which made the toggle read as
      // inert. When dimming, AMPLIFY the deficit so lower-confidence
      // edges are unmistakably faded (0.9 -> 0.4, floor 0.15); the
      // originals map still restores exact fixture values on
      // re-enable, so the data stays honest and only the PRESENTATION
      // exaggerates.
      const original = originals.get(id) ?? 1;
      const amplified =
        original >= 1 ? 1 : Math.max(0.15, 1 - (1 - original) * 6);
      const target = dim ? amplified : 1;
      if (current !== target) e.data({ _confidence: target });
    });
  });
}
