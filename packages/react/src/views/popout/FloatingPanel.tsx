/**
 * FloatingPanel: a draggable, closeable panel frame that floats over
 * a graph view (or the viewport). Extracted from NeighborhoodPopout's
 * inline implementation once the pattern reached three consumers
 * (the popout, and the auditor's lineage and inspector panels per
 * review 9.23); the demo-era FloatingInspector had independently
 * hand-rolled the same behavior before being retired, which was the
 * signal this belonged in the toolkit rather than being rebuilt per
 * shell.
 *
 * The frame owns: corner anchoring (four corners), fixed-vs-absolute
 * positioning (absolute anchors inside a positioned ancestor, i.e.
 * the graph view), pointer-capture header drag with no dependencies,
 * and the close button. The consumer owns the header CONTENT and the
 * body. Test ids are explicit props so existing consumers keep their
 * established ids with zero test churn.
 */
import { useRef, useState, type ReactNode } from "react";

export interface FloatingPanelProps {
  header: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  corner?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** "absolute" anchors inside a positioned ancestor (the graph
   *  view); "fixed" (default) anchors to the viewport. */
  positioning?: "fixed" | "absolute";
  /** Lift above bottom chrome (e.g. a timeline strip). */
  bottomOffset?: number;
  width?: number;
  testId?: string;
  closeTestId?: string;
  dragHandleTestId?: string;
  className?: string;
}

export function FloatingPanel({
  header,
  children,
  onClose,
  corner = "bottom-left",
  positioning = "fixed",
  bottomOffset = 16,
  width = 340,
  testId,
  closeTestId,
  dragHandleTestId,
  className,
}: FloatingPanelProps) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);

  // All four offsets are set explicitly (auto for the unused two):
  // host containers sometimes stretch children (e.g. an inset: 0
  // rule on a canvas wrapper), and only an explicit inline value on
  // every side defeats that reliably.
  const vertical = corner.startsWith("top")
    ? { top: 16, bottom: "auto" as const }
    : { bottom: bottomOffset, top: "auto" as const };
  const horizontal = corner.endsWith("left")
    ? { left: 16, right: "auto" as const }
    : { right: 16, left: "auto" as const };

  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        position: positioning,
        ...vertical,
        ...horizontal,
        transform: `translate(${drag.x}px, ${drag.y}px)`,
        zIndex: 35,
        width,
        maxWidth: "calc(100vw - 48px)",
        background: "var(--g3t-bg-primary, #fff)",
        border: "1px solid var(--g3t-border, #dee2e6)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        data-testid={dragHandleTestId}
        onPointerDown={(e) => {
          dragStart.current = {
            px: e.clientX,
            py: e.clientY,
            ox: drag.x,
            oy: drag.y,
          };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const st = dragStart.current;
          if (!st) return;
          setDrag({
            x: st.ox + (e.clientX - st.px),
            y: st.oy + (e.clientY - st.py),
          });
        }}
        onPointerUp={() => {
          dragStart.current = null;
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderBottom: "1px solid var(--g3t-border, #eee)",
          fontSize: 11,
          cursor: "move",
          touchAction: "none",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6 }}>
          {header}
        </div>
        {onClose && (
          <button
            type="button"
            data-testid={closeTestId}
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              lineHeight: 1,
              padding: "2px 4px",
              color: "inherit",
            }}
          >
            ✕
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
