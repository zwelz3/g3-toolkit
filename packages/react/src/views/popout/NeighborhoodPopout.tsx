/**
 * NeighborhoodPopout (review 4.10 / CM-D): "View Neighbors" opens a
 * small floating second graph view instead of mutating the main
 * canvas's selection (the old behavior selected the whole
 * neighborhood, which conflated a VIEW request with a selection).
 *
 * Per the review's design: hierarchical layout (breadthfirst rooted
 * at the focus), default 1 hop, a +/- stepper to widen or narrow,
 * and a close affordance. The sub-UGM comes from core's
 * khopNeighborhood, so the working-set cap and truncation flag match
 * the scale drill-in's semantics; when truncated, the header says so
 * rather than silently dropping nodes.
 */
import { useMemo, useState } from "react";
import { FloatingPanel } from "./FloatingPanel";
import { khopNeighborhood, type UGM } from "@g3t/core";
import { CytoscapeCanvas } from "../canvas/CytoscapeCanvas";
import type { CyStylesheet } from "../canvas/CytoscapeCanvas";
import type { EncodingSpec } from "../../interaction/encoding/encoding-spec";

export interface NeighborhoodPopoutProps {
  /** The full graph the neighborhood is cut from. */
  ugm: UGM;
  focusId: string;
  /** Display label for the focus (defaults to the id). */
  focusLabel?: string;
  defaultHops?: number;
  maxHops?: number;
  onClose: () => void;
  /** Corner the popout docks to (default bottom-left). */
  corner?: "bottom-left" | "bottom-right";
  /** Upstream P2 + owner VR-24 (both 2026-07-28, found
   *  independently): the preview inherits the PARENT canvas's
   *  encoding so shapes/colors match the main graph. */
  encodingSpec?: EncodingSpec;
  /** Extra stylesheet rules, same contract as CytoscapeCanvas. */
  stylesheet?: CyStylesheet[];
  /** Camera behavior: "fit" (default: the whole cut in frame) or
   *  "center" (close-up on the focus). */
  camera?: "fit" | "center";
  /** 9.20: "absolute" anchors the popout inside a positioned
   *  ancestor (the graph view), instead of the viewport, so it sits
   *  over the canvas corner rather than whatever chrome happens to
   *  occupy the viewport corner. Default stays "fixed" for existing
   *  consumers. */
  positioning?: "fixed" | "absolute";
  className?: string;
}

export function NeighborhoodPopout({
  encodingSpec,
  stylesheet,
  camera = "fit",
  ugm,
  focusId,
  focusLabel,
  defaultHops = 1,
  maxHops = 4,
  onClose,
  corner = "bottom-left",
  positioning = "fixed",
  className,
}: NeighborhoodPopoutProps) {
  const [hops, setHops] = useState(defaultHops);
  const result = useMemo(
    () => khopNeighborhood(ugm, focusId, hops),
    [ugm, focusId, hops],
  );

  const stepBtn: React.CSSProperties = {
    font: "inherit",
    fontSize: 12,
    width: 20,
    height: 20,
    lineHeight: 1,
    border: "1px solid var(--g3t-border, #ced4da)",
    borderRadius: 4,
    background: "var(--g3t-bg-primary, #fff)",
    color: "inherit",
    cursor: "pointer",
  };

  return (
    <FloatingPanel
      testId="g3t-neighborhood-popout"
      className={className}
      corner={corner}
      positioning={positioning}
      onClose={onClose}
      closeTestId="popout-close"
      dragHandleTestId="popout-drag-handle"
      header={
        <>
          <strong
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
            title={focusId}
          >
            Neighbors of {focusLabel ?? focusId}
          </strong>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            data-testid="popout-hops-down"
            style={stepBtn}
            disabled={hops <= 1}
            onClick={() => setHops((h) => Math.max(1, h - 1))}
            title="Fewer hops"
          >
            {"\u2212"}
          </button>
          <span data-testid="popout-hops">{hops}-hop</span>
          <button
            type="button"
            data-testid="popout-hops-up"
            style={stepBtn}
            disabled={hops >= maxHops}
            onClick={() => setHops((h) => Math.min(maxHops, h + 1))}
            title="More hops"
          >
            +
          </button>
        </>
      }
    >
      <div
        style={{
          padding: "2px 8px",
          fontSize: 10,
          color: "var(--g3t-text-muted, #868e96)",
        }}
      >
        {result.ugm.getNodeIds().length} nodes
        {result.truncated ? " (truncated to the working-set cap)" : ""}
      </div>
      <div style={{ height: 220 }}>
        <CytoscapeCanvas
          ugm={result.ugm}
          layout="breadthfirst"
          encodingSpec={encodingSpec}
          stylesheet={stylesheet}
          // 12.10 default: the WHOLE neighborhood in frame; "center"
          // opts into a focus close-up (upstream P2 made both
          // explicit). Applied now and again when the layout
          // settles (whichever ordering occurs).
          onReady={(c) => {
            const applyCamera = () => {
              if (typeof c.destroyed === "function" && c.destroyed()) return;
              if (camera === "center") {
                const ele = c.getElementById(focusId);
                if (ele.nonempty()) {
                  c.center(ele);
                  c.zoom(Math.max(c.zoom(), 1.1));
                  return;
                }
              }
              c.fit(undefined, 16);
            };
            c.one("layoutstop", applyCamera);
            applyCamera();
          }}
        />
      </div>
    </FloatingPanel>
  );
}
