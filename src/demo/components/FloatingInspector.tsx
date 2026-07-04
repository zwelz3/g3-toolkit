/**
 * FloatingInspector: a draggable, closeable inspector that floats over
 * the canvas instead of occupying a fixed sidebar column. Demonstrates
 * the "inspector as a movable HUD panel" pattern, which frees the
 * vertical space a docked sidebar would take.
 *
 * Wraps the library DetailInspector; appears when a node/edge is
 * selected and the panel is open. Demo harness furniture.
 */

import { useCallback, useRef, useState } from "react";
import { DetailInspector } from "@g3t/react";
import type { UGM } from "@g3t/core";

export interface FloatingInspectorProps {
  ugm: UGM;
  selection: { type: "node" | "edge"; id: string } | null;
  /** Accent for the title bar. */
  accent: string;
  /** Initial top-right offset within the canvas, in px. */
  initialTop?: number;
  initialRight?: number;
  onClose?: () => void;
}

export function FloatingInspector({
  ugm,
  selection,
  accent,
  initialTop = 12,
  initialRight = 12,
  onClose,
}: FloatingInspectorProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(true);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const parent = (e.currentTarget as HTMLElement)
      .offsetParent as HTMLElement | null;
    const panel = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const prect = parent?.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    // Switch to left/top positioning on first drag so right-anchoring
    // doesn't fight the pointer.
    const left = rect.left - (prect?.left ?? 0);
    const top = rect.top - (prect?.top ?? 0);
    setPos({ top, left });
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const panel = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const parent = panel.offsetParent as HTMLElement | null;
    const prect = parent?.getBoundingClientRect();
    const left = e.clientX - (prect?.left ?? 0) - dragRef.current.dx;
    const top = e.clientY - (prect?.top ?? 0) - dragRef.current.dy;
    setPos({
      top: Math.max(0, top),
      left: Math.max(0, left),
    });
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    document.body.style.userSelect = "";
  }, []);

  if (!selection || !open) return null;

  const placement = pos
    ? { top: pos.top, left: pos.left }
    : { top: initialTop, right: initialRight };

  return (
    <div
      data-testid="floating-inspector"
      style={{
        position: "absolute",
        ...placement,
        width: 300,
        maxHeight: "70%",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        background: "var(--g3t-bg-primary)",
        border: "1px solid var(--g3t-border)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "var(--g3t-shadow-lg, 0 8px 24px rgba(0,0,0,0.3))",
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          cursor: "move",
          touchAction: "none",
          background: "var(--g3t-bg-secondary)",
          borderBottom: `2px solid ${accent}`,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span>Inspector · drag to move</span>
        <button
          className="g3t-btn g3t-btn-ghost"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
          style={{ fontSize: 14, padding: "0 4px", lineHeight: 1 }}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>
      <div style={{ overflow: "auto" }}>
        <DetailInspector ugm={ugm} selection={selection} />
      </div>
    </div>
  );
}
