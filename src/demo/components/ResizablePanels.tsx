/**
 * ResizablePanels: a tiny, dependency-free splitter so demo users can
 * drag panel boundaries and experiment with component layouts. Pointer-
 * based, supports a horizontal (side-by-side) or vertical (stacked)
 * split of exactly two children, with per-side minimum sizes.
 *
 * This lives in the demo (not @g3t/react) on purpose: it is harness
 * furniture, not a toolkit capability. Nest two of them for a
 * three-pane layout (left | (center / bottom) | right).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ResizablePanelsProps {
  /** "horizontal" = side by side (drag left/right); "vertical" =
   *  stacked (drag up/down). */
  direction?: "horizontal" | "vertical";
  /** The two panels. Exactly two children are expected (index 0 and
   *  1 are read). Typed loosely to avoid brittle JSX tuple inference;
   *  pass exactly two elements. */
  children: ReactNode;
  /** Which panel holds the fixed (draggable) size; the other flexes to
   *  fill. Default "first". Use "second" for a fixed-width right rail
   *  with a flexing center, which keeps the center dominant on wide
   *  screens. */
  anchor?: "first" | "second";
  /** Initial size of the ANCHORED panel, in pixels. */
  initialFirstSize?: number;
  /** Minimum px size for the first and second panels. */
  minFirst?: number;
  minSecond?: number;
  className?: string;
}

export function ResizablePanels({
  direction = "horizontal",
  children,
  anchor = "first",
  initialFirstSize = 260,
  minFirst = 140,
  minSecond = 200,
  className,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [anchorSize, setAnchorSize] = useState(initialFirstSize);
  const draggingRef = useRef(false);
  const horizontal = direction === "horizontal";
  const anchorSecond = anchor === "second";
  const kids = Array.isArray(children) ? children : [children];
  const firstChild = kids[0] ?? null;
  const secondChild = kids[1] ?? null;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
      document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
    },
    [horizontal],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = horizontal ? rect.width : rect.height;
      const pos = horizontal ? e.clientX - rect.left : e.clientY - rect.top;
      // When the SECOND panel is anchored, its size grows as the
      // pointer moves toward the start, so measure from the end.
      const raw = anchorSecond ? total - pos : pos;
      const minAnchor = anchorSecond ? minSecond : minFirst;
      const minOther = anchorSecond ? minFirst : minSecond;
      const clamped = Math.max(minAnchor, Math.min(raw, total - minOther));
      setAnchorSize(clamped);
    },
    [horizontal, anchorSecond, minFirst, minSecond],
  );

  // Keep the anchored panel within bounds if the container shrinks.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const total = horizontal ? el.clientWidth : el.clientHeight;
      const minAnchor = anchorSecond ? minSecond : minFirst;
      const minOther = anchorSecond ? minFirst : minSecond;
      setAnchorSize((s) => Math.min(s, Math.max(minAnchor, total - minOther)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [horizontal, anchorSecond, minFirst, minSecond]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          ...(anchorSecond
            ? { flex: 1 }
            : { [horizontal ? "width" : "height"]: anchorSize, flexShrink: 0 }),
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {firstChild}
      </div>

      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
        role="separator"
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        title="Drag to resize"
        style={{
          flexShrink: 0,
          [horizontal ? "width" : "height"]: 6,
          cursor: horizontal ? "col-resize" : "row-resize",
          background: "var(--g3t-border, #2a3060)",
          position: "relative",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: horizontal ? "0 -3px" : "-3px 0",
          }}
        />
      </div>

      <div
        style={{
          ...(anchorSecond
            ? { [horizontal ? "width" : "height"]: anchorSize, flexShrink: 0 }
            : { flex: 1 }),
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {secondChild}
      </div>
    </div>
  );
}
