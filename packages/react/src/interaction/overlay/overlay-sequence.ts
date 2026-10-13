/**
 * Overlay sequencing rules (issue #20): the pure half of walking a
 * list of overlays in order. The overlay store has no notion of order;
 * a sequence is a layer OVER it, and these two functions are the whole
 * of that layer's arithmetic, kept pure in the style of
 * `computeLockedIds` and `computeOverlayMembership` so a host can unit
 * test its own narrative without mounting anything.
 *
 * A sequence owns exactly the ids it was given. Nothing here reads the
 * store or knows about overlays it does not own; `useOverlaySequence`
 * is where the result is merged into the store without disturbing
 * foreign ids.
 */

/** Which overlays step N shows: only its own ("single"), or its own
 *  plus every earlier step's ("cumulative", the build-up narrative). */
export type OverlaySequenceMode = "single" | "cumulative";

export type OverlaySequenceDirection = "next" | "prev";

/**
 * The overlay ids that should be active at `index`. Pure: the index is
 * NOT clamped here, since an out-of-range index is a caller mistake
 * worth seeing as "nothing active" rather than silently showing the
 * nearest step. An empty sequence is always empty.
 */
export function computeSequenceActiveIds(
  sequenceIds: readonly string[],
  index: number,
  mode: OverlaySequenceMode,
): string[] {
  if (!Number.isInteger(index) || index < 0 || index >= sequenceIds.length) {
    return [];
  }
  return mode === "cumulative"
    ? sequenceIds.slice(0, index + 1)
    : [sequenceIds[index] as string];
}

/**
 * The index after one step. Without `loop` the sequence clamps at both
 * ends (stepping past the last returns the last, so a caller can detect
 * "did not move" by comparing to the input); with it the ends wrap. An
 * empty sequence has no index to step and returns 0.
 */
export function stepSequence(
  index: number,
  direction: OverlaySequenceDirection,
  length: number,
  loop: boolean,
): number {
  if (length <= 0) return 0;
  const delta = direction === "next" ? 1 : -1;
  const raw = index + delta;
  if (loop) {
    // ((x % n) + n) % n: JS `%` keeps the sign of the dividend, so a
    // plain modulo of -1 is -1, not length - 1.
    return ((raw % length) + length) % length;
  }
  return Math.min(Math.max(raw, 0), length - 1);
}

/**
 * Merge the sequence's computed set into the store's active list,
 * touching ONLY the ids the sequence owns: every foreign active id keeps
 * its place, every owned id is dropped and then re-added exactly as
 * `target` says. Exported for tests and for hosts that drive the store
 * from a non-React loop; the hook applies this on each index change.
 */
export function mergeSequenceActiveIds(
  currentActiveIds: readonly string[],
  ownedIds: readonly string[],
  targetActiveIds: readonly string[],
): string[] {
  const owned = new Set(ownedIds);
  const foreign = currentActiveIds.filter((id) => !owned.has(id));
  // A target id outside the owned set is a programming error upstream;
  // dropping it keeps the "only what it owns" guarantee unconditional.
  const target = targetActiveIds.filter((id) => owned.has(id));
  return [...foreign, ...target];
}
