/**
 * Uniform element-level pointer events (G3L:INT-001).
 *
 * "Element-level pointer events (enter/leave/down/up/click/context)
 * with zone info (RND-006), uniform across adapters." One hook; the
 * adapters differ only in their hit function and their client-to-
 * model transform. Handlers receive the SAME shape everywhere, so a
 * consumer can swap renderers without touching interaction code:
 * exactly the ARC-008 promise extended to input.
 */
import { useCallback, useRef } from "react";
import type React from "react";

export interface ElementPointerInfo<H> {
  hit: H;
  /** Model-space point of the event. */
  point: { x: number; y: number };
  originalEvent: React.SyntheticEvent;
}

export interface ElementPointerHandlers<H> {
  onElementClick?: (info: ElementPointerInfo<H>) => void;
  onElementPointerDown?: (info: ElementPointerInfo<H>) => void;
  onElementPointerUp?: (info: ElementPointerInfo<H>) => void;
  onElementContextMenu?: (info: ElementPointerInfo<H>) => void;
  onElementEnter?: (info: ElementPointerInfo<H>) => void;
  /** Leave carries the LAST hit (the element being left). */
  onElementLeave?: (info: ElementPointerInfo<H>) => void;
}

/** Identity function for elements whose hits share the id field;
 *  enter/leave fire when this key changes. */
function hitKey(h: unknown): string {
  const o = h as { elementId?: string; zone?: string } | null;
  return o ? `${o.elementId ?? ""}#${o.zone ?? ""}` : "";
}

export interface ElementPointerOptions {
  /** Upstream R-1 (round 17, 2026-07-28): a click that ENDS A PAN
   *  must not fire onElementClick. The pointer-down point is
   *  recorded and a click is suppressed when the pointer travelled
   *  further than this threshold. 0 restores fire-always.
   *
   *  R-10 (register, 2026-08-05): the threshold is measured in
   *  SCREEN pixels, not model units. Model units were chosen for
   *  zoom-invariance and got it backwards: at k = 0.5 a 5px finger
   *  wobble became 10 model units and suppressed the tap entirely.
   *  Tap slop is a property of the input device, so screen space is
   *  the invariant that matters. Default: 4px for a fine pointer,
   *  12px for a coarse one (a finger's slop is not a mouse's),
   *  resolved per gesture so a hybrid device behaves correctly with
   *  whichever pointer is in use. */
  clickDragThreshold?: number;
}

/** R-10: the default tap slop for the pointer that produced this
 *  event. Exported for consumers computing their own thresholds. */
export function defaultClickDragThreshold(pointerType?: string): number {
  if (pointerType === "touch" || pointerType === "pen") return 12;
  if (pointerType === "mouse") return 4;
  return typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches
    ? 12
    : 4;
}

export function useElementPointerEvents<H, E extends Element>(
  hit: (p: { x: number; y: number }) => H | null,
  toModel: (
    client: { x: number; y: number },
    currentTarget: E,
  ) => { x: number; y: number },
  handlers: ElementPointerHandlers<H>,
  options?: ElementPointerOptions,
): {
  onClick: (e: React.MouseEvent<E>) => void;
  onPointerDown: (e: React.PointerEvent<E>) => void;
  onPointerUp: (e: React.PointerEvent<E>) => void;
  onContextMenu: (e: React.MouseEvent<E>) => void;
  onPointerMove: (e: React.PointerEvent<E>) => void;
  onPointerLeave: (e: React.PointerEvent<E>) => void;
} {
  const last = useRef<{
    key: string;
    hit: H;
    point: { x: number; y: number };
  } | null>(null);
  // R-1: the pointer-down model point, for the drag-suppression test.
  // R-10: recorded in SCREEN space, with the slop resolved from the
  // pointer that started the gesture.
  const downPoint = useRef<{
    x: number;
    y: number;
    threshold: number;
  } | null>(null);

  const resolve = useCallback(
    (e: React.MouseEvent<E> | React.PointerEvent<E>) => {
      const point = toModel(
        { x: e.clientX, y: e.clientY },
        e.currentTarget as E,
      );
      const h = hit(point);
      return h === null ? null : { hit: h, point };
    },
    [hit, toModel],
  );

  const dispatch = useCallback(
    (
      handler: ((info: ElementPointerInfo<H>) => void) | undefined,
      e: React.MouseEvent<E> | React.PointerEvent<E>,
    ) => {
      if (!handler) return;
      const r = resolve(e);
      if (r) handler({ ...r, originalEvent: e });
    },
    [resolve],
  );

  return {
    onClick: (e) => {
      // R-1: suppress the click that ends a pan. R-10: compared in
      // SCREEN pixels, because tap slop belongs to the device.
      const start = downPoint.current;
      downPoint.current = null;
      if (start !== null && start.threshold > 0) {
        const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (dist > start.threshold) return;
      }
      dispatch(handlers.onElementClick, e);
    },
    onPointerDown: (e) => {
      downPoint.current = {
        x: e.clientX,
        y: e.clientY,
        threshold:
          options?.clickDragThreshold ??
          defaultClickDragThreshold(e.pointerType),
      };
      dispatch(handlers.onElementPointerDown, e);
    },
    onPointerUp: (e) => dispatch(handlers.onElementPointerUp, e),
    onContextMenu: (e) => dispatch(handlers.onElementContextMenu, e),
    onPointerMove: (e) => {
      const r = resolve(e);
      const key = r ? hitKey(r.hit) : "";
      const prev = last.current;
      if (prev && prev.key !== key) {
        handlers.onElementLeave?.({
          hit: prev.hit,
          point: prev.point,
          originalEvent: e,
        });
        last.current = null;
      }
      if (r && (!prev || prev.key !== key)) {
        handlers.onElementEnter?.({ ...r, originalEvent: e });
      }
      last.current = r ? { key, ...r } : null;
    },
    onPointerLeave: (e) => {
      const prev = last.current;
      if (prev) {
        handlers.onElementLeave?.({
          hit: prev.hit,
          point: prev.point,
          originalEvent: e,
        });
        last.current = null;
      }
    },
  };
}
