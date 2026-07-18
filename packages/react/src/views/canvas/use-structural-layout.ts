/**
 * useStructuralLayout: host-side structural layout wiring, the
 * collapse-free successor to the removed useStructuralCollapse (the
 * expand/collapse feature was removed by ruling on 2026-07-10; see
 * planning/expand-collapse-postmortem.md for why, and read it BEFORE
 * attempting to reintroduce anything like it).
 *
 * What deliberately SURVIVES from that saga, because it is general
 * layout-stability infrastructure (G3L:LAY-017/018), not collapse
 * machinery:
 * - Stale-while-revalidate: a SAME-INPUT re-layout (options change)
 *   keeps returning the prior scene until the new geometry lands, so
 *   the canvas stays mounted and gets PATCHED in place (no
 *   unmount/remount flash); only an input change shows loading.
 * - The sketch: a same-input re-layout feeds each top-level node's
 *   prior position and extents back into layoutStructural, so the
 *   scene re-lays-out without moving untouched containers.
 *
 * Pass `input: null` to idle (nothing laid out).
 *
 * ```tsx
 * const { structural } = useStructuralLayout(input, { direction: "DOWN" });
 * <CytoscapeCanvas structural={structural ?? undefined} />
 * ```
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  layoutStructural,
  type StructuralGeometry,
  type StructuralGraphInput,
  type StructuralLayoutOptions,
} from "@g3t/core";

export interface StructuralLayoutResult {
  /** Laid-out scene for the CURRENT input, or null while the FIRST
   *  layout of this input is in flight (or while input is null).
   *  Same-input re-layouts return the prior scene until the new
   *  geometry lands (stale-while-revalidate); a stale scene from a
   *  PREVIOUS input is never returned. */
  structural: {
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null;
}

export function useStructuralLayout(
  input: StructuralGraphInput | null,
  options?: Omit<StructuralLayoutOptions, "sketch">,
): StructuralLayoutResult {
  const [laidOut, setLaidOut] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);

  // Content-keyed options so hosts can pass inline literals without
  // looping the layout effect (same treatment the canvas gives its
  // layoutOptions).
  const optionsKey = options ? JSON.stringify(options) : "";
  const optionsRef = useRef(options);
  // eslint-disable-next-line react-hooks/refs
  optionsRef.current = options;

  // Prior scene for the SKETCH (G3L:LAY-017/018): a same-input
  // re-layout feeds each top-level node's prior position AND extents
  // back into layoutStructural, so untouched containers hold their
  // place. A ref, not state: the effect reads it without re-running
  // on it.
  const lastSceneRef = useRef<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);

  useEffect(() => {
    if (input === null) return;
    let cancelled = false;
    const prev = lastSceneRef.current;
    const sketch: Record<
      string,
      { x: number; y: number; width: number; height: number }
    > = {};
    if (prev !== null && prev.input === input) {
      for (const n of input.nodes) {
        const g = prev.geometry.nodes[n.id];
        if (!g) continue;
        sketch[n.id] = { x: g.x, y: g.y, width: g.width, height: g.height };
      }
    }
    const opts: StructuralLayoutOptions = {
      ...(optionsRef.current ?? {}),
      ...(Object.keys(sketch).length > 0 ? { sketch } : {}),
    };
    void layoutStructural(input, opts).then((geometry) => {
      if (!cancelled) {
        lastSceneRef.current = { input, geometry };
        setLaidOut({ input, geometry });
      }
    });
    return () => {
      cancelled = true;
    };
    // optionsKey stands in for the options object (content-keyed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, optionsKey]);

  // Stale-while-revalidate: only an INPUT change shows loading.
  const structural = useMemo(
    () =>
      laidOut !== null && laidOut.input === input
        ? { input: laidOut.input, geometry: laidOut.geometry }
        : null,
    [laidOut, input],
  );

  return { structural };
}
