/**
 * RightPanel: the demo shells' right rail, with an Inspector tab and a
 * docked Neighborhood tab.
 *
 * Replaces the former floating neighborhood overlay (which was locked
 * onto the graph with no layout option). The Neighborhood tab builds an
 * N-hop subgraph around the selected node and renders it on its own
 * CytoscapeCanvas with a layout selector and a hops (1-4) control.
 *
 * Demo harness furniture, not a toolkit capability.
 */

import { useMemo, useState } from "react";
import {
  CytoscapeCanvas,
  DetailInspector,
  buildNeighborhoodUGM,
} from "@g3t/react";
import { UGM } from "@g3t/core";

type RightTab = "inspector" | "neighborhood";

const LAYOUTS = ["force", "hierarchy", "circle", "grid", "concentric"] as const;
type NeighborhoodLayout = (typeof LAYOUTS)[number];

// CytoscapeCanvas accepts a layout name string; map our selector values
// to the canvas's force/preset names (force -> the canvas default).
function canvasLayout(l: NeighborhoodLayout): string {
  switch (l) {
    case "force":
      return "fcose";
    case "hierarchy":
      return "breadthfirst";
    default:
      return l;
  }
}

export interface RightPanelProps {
  /** The full graph; the neighborhood is computed from it. */
  ugm: UGM;
  /** The currently selected node id (single selection drives both tabs). */
  selectedId: string | null;
  /** Accent color for the active-tab underline. */
  accent: string;
  /** Whether the Neighborhood tab should be auto-shown when a request
   *  arrives (e.g. via the context menu "View Neighbors"). Bumping this
   *  number switches to the neighborhood tab. */
  showNeighborhoodSignal?: number;
}

export function RightPanel({
  ugm,
  selectedId,
  accent,
  showNeighborhoodSignal,
}: RightPanelProps) {
  const [tab, setTab] = useState<RightTab>("inspector");
  const [hops, setHops] = useState(2);
  const [layout, setLayout] = useState<NeighborhoodLayout>("force");

  // When a "View Neighbors" request arrives (the signal increments),
  // surface the Neighborhood tab. Done with the render-time
  // previous-value comparison pattern rather than an effect, so it does
  // not trigger a cascading effect re-render.
  const [seenSignal, setSeenSignal] = useState(showNeighborhoodSignal ?? 0);
  if ((showNeighborhoodSignal ?? 0) !== seenSignal) {
    setSeenSignal(showNeighborhoodSignal ?? 0);
    if ((showNeighborhoodSignal ?? 0) > 0) setTab("neighborhood");
  }

  const neighborhood = useMemo(() => {
    if (!selectedId || !ugm.hasNode(selectedId)) return null;
    return buildNeighborhoodUGM(ugm, selectedId, hops);
  }, [ugm, selectedId, hops]);

  return (
    <div
      style={{
        borderLeft: "1px solid var(--g3t-border)",
        background: "var(--g3t-bg-secondary)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: 0,
      }}
    >
      <div
        style={{ display: "flex", borderBottom: "1px solid var(--g3t-border)" }}
      >
        {(["inspector", "neighborhood"] as RightTab[]).map((t) => (
          <button
            key={t}
            className={`g3t-btn ${tab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              borderRadius: 0,
              fontSize: 11,
              textTransform: "capitalize",
              borderBottom:
                tab === t ? `2px solid ${accent}` : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "inspector" && (
        <div style={{ overflow: "auto", padding: 12, flex: 1 }}>
          <div className="g3t-panel-title">Inspector</div>
          <DetailInspector
            ugm={ugm}
            selection={selectedId ? { type: "node", id: selectedId } : null}
          />
        </div>
      )}

      {tab === "neighborhood" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 8,
              borderBottom: "1px solid var(--g3t-border)",
              fontSize: 11,
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Hops
              <input
                type="number"
                min={1}
                max={4}
                value={hops}
                onChange={(e) =>
                  setHops(Math.max(1, Math.min(4, Number(e.target.value) || 1)))
                }
                style={{ width: 44 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Layout
              <select
                className="g3t-select"
                value={layout}
                onChange={(e) =>
                  setLayout(e.target.value as NeighborhoodLayout)
                }
                style={{ fontSize: 11 }}
              >
                {LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {neighborhood && (
              <span style={{ opacity: 0.7 }}>
                {neighborhood.getNodeIds().length} nodes
              </span>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {neighborhood ? (
              <CytoscapeCanvas
                // Re-mount on layout/hops change so the layout re-runs.
                key={`${selectedId}:${hops}:${layout}`}
                ugm={neighborhood}
                layout={canvasLayout(layout)}
              />
            ) : (
              <div style={{ padding: 12, fontSize: 12, opacity: 0.7 }}>
                Select a node to see its neighborhood.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
