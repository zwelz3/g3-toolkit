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

export function useElementPointerEvents<H, E extends Element>(
  hit: (p: { x: number; y: number }) => H | null,
  toModel: (
    client: { x: number; y: number },
    currentTarget: E,
  ) => { x: number; y: number },
  handlers: ElementPointerHandlers<H>,
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
    onClick: (e) => dispatch(handlers.onElementClick, e),
    onPointerDown: (e) => dispatch(handlers.onElementPointerDown, e),
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
