/**
 * useOverlaySequence (issue #20): walk an ordered list of overlays
 * through the existing overlay store. The store registers, toggles and
 * clears; it has no order. This hook holds the index and the transport
 * (prev / play / next / goTo), and on every index change sets active
 * exactly the ids `computeSequenceActiveIds` names, by merging into
 * `activeIds` rather than replacing it, so an overlay registered by
 * another part of the host (a SHACL tier, a path overlay) keeps its
 * state before, during and after the sequence. That composition is the
 * reason this is library surface rather than a host recipe: it is easy
 * to get wrong, and getting it wrong looks like the store "taking over".
 *
 * Ownership and hand-back. The sequence owns exactly `ids`. On mount
 * (and whenever `ids` changes by content) it records which of those ids
 * were already active; on unmount (and on that same ids change) it puts
 * them back the way it found them, filtered to ids still registered.
 * RESTORE rather than DEACTIVATE was chosen because the common host
 * shape is a reviewer who had toggled a tier on by hand, then opened a
 * walkthrough: closing the walkthrough should return the canvas to what
 * the reviewer had, not to blank. A host that wants a clean exit clears
 * those ids itself before unmounting. Ids are compared by CONTENT, so
 * an inline `ids={[...]}` literal does not restart the sequence each
 * render (the same doctrine the canvas decorations follow).
 *
 * Registration stays the host's job: the hook never registers or
 * unregisters an overlay, and an id with no registered overlay is
 * harmless (membership ignores it). Register BEFORE the sequence
 * mounts: `register(overlay, false)` removes the id from `activeIds`,
 * so registering inactive after the sequence has activated a step
 * hides that step until the next index change.
 *
 * Playback runs on `setInterval`, cleared on pause, on a speed change
 * and on unmount. Reaching the end without `loop` holds the last step
 * for one interval and then pauses; `play()` from the last step without
 * `loop` restarts from the first.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlayStore } from "../../state/overlay-store";
import {
  computeSequenceActiveIds,
  mergeSequenceActiveIds,
  stepSequence,
  type OverlaySequenceMode,
} from "./overlay-sequence";

export interface UseOverlaySequenceOptions {
  /** Overlay ids in step order. The sequence owns these and nothing
   *  else. Compared by content, so a fresh array literal is fine. */
  ids: readonly string[];
  /** "single" shows only step N's overlay; "cumulative" shows steps
   *  0..N together. Default "single". */
  mode?: OverlaySequenceMode;
  /** Interval between steps while playing, in ms. Default 1000. */
  speedMs?: number;
  /** Wrap at both ends (and keep playing past the last step). Default
   *  false: the sequence clamps, and playback pauses on the last step. */
  loop?: boolean;
  /** Start playing on mount. Default false. */
  autoplay?: boolean;
}

export interface OverlaySequence {
  /** Current step, 0-based; always within [0, length - 1] (0 when empty). */
  index: number;
  /** Number of steps (`ids.length`). */
  length: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  /** Jump to a step; out-of-range values clamp. Does not change playback. */
  goTo: (index: number) => void;
}

const clampIndex = (index: number, length: number): number =>
  length <= 0 ? 0 : Math.min(Math.max(Math.trunc(index), 0), length - 1);

export function useOverlaySequence({
  ids,
  mode = "single",
  speedMs = 1000,
  loop = false,
  autoplay = false,
}: UseOverlaySequenceOptions): OverlaySequence {
  // Content key: the owned set is what matters, not the array identity.
  const idsKey = ids.join("\u0000");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `ids` is deliberately keyed by content (idsKey) so an inline literal does not re-own and restart the sequence every render.
  const ownedIds = useMemo(() => Array.from(ids), [idsKey]);
  const length = ownedIds.length;

  const [rawIndex, setRawIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  // Clamped in render rather than reset in an effect, so a host that
  // shortens the list mid-walk lands on the nearest surviving step
  // without an intermediate frame at a stale index.
  const index = clampIndex(rawIndex, length);

  // Ownership lifecycle: snapshot the owned ids' prior state when the
  // owned set is taken, hand it back when it is released. Declared
  // before the apply effect so the snapshot precedes the first write.
  useEffect(() => {
    const before = useOverlayStore.getState().activeIds;
    const priorActive = ownedIds.filter((id) => before.includes(id));
    return () => {
      useOverlayStore.setState((s) => {
        const registered = new Set(s.overlays.map((o) => o.id));
        return {
          activeIds: mergeSequenceActiveIds(
            s.activeIds,
            ownedIds,
            priorActive.filter((id) => registered.has(id)),
          ),
        };
      });
    };
  }, [ownedIds]);

  // Apply: on every index / mode / ownership change, the owned ids are
  // set to exactly the computed step; foreign ids are carried across.
  useEffect(() => {
    const target = computeSequenceActiveIds(ownedIds, index, mode);
    useOverlayStore.setState((s) => ({
      activeIds: mergeSequenceActiveIds(s.activeIds, ownedIds, target),
    }));
  }, [ownedIds, index, mode]);

  // The interval reads the live index through a ref so a single timer
  // survives every tick instead of being re-armed on each index change
  // (which would also reset the cadence on a manual next/prev).
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (!isPlaying || length === 0) return undefined;
    const timer = setInterval(() => {
      const current = indexRef.current;
      const following = stepSequence(current, "next", length, loop);
      if (following === current) {
        // Clamped at the end without loop: the last step has now been
        // held for a full interval, so playback is over.
        setIsPlaying(false);
        return;
      }
      // Advance the ref here as well as through the commit: two ticks
      // that land before React commits between them (a very short
      // interval, or timers flushed in one batch) would otherwise both
      // step from the same stale index and collapse into one.
      indexRef.current = following;
      setRawIndex(following);
    }, speedMs);
    return () => clearInterval(timer);
  }, [isPlaying, speedMs, length, loop]);

  const play = useCallback(() => {
    if (length === 0) return;
    // Play from the final step of a non-looping sequence means "again".
    if (!loop && indexRef.current === length - 1) setRawIndex(0);
    setIsPlaying(true);
  }, [length, loop]);
  const pause = useCallback(() => setIsPlaying(false), []);
  const next = useCallback(
    () =>
      setRawIndex((i) =>
        stepSequence(clampIndex(i, length), "next", length, loop),
      ),
    [length, loop],
  );
  const prev = useCallback(
    () =>
      setRawIndex((i) =>
        stepSequence(clampIndex(i, length), "prev", length, loop),
      ),
    [length, loop],
  );
  const goTo = useCallback(
    (target: number) => setRawIndex(clampIndex(target, length)),
    [length],
  );

  return { index, length, isPlaying, play, pause, next, prev, goTo };
}
