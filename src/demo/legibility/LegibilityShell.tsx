/**
 * Legibility Lab (A105 pedagogy surface): the SMALLEST graphs that make
 * each spreading device readable at a glance.
 *
 * Three panels, one device per panel:
 *  - Hub burst: a 14-degree hub where `hubBurst(k=6)` groups incident
 *    edges by (type, direction) and fans each group through one satellite
 *    pseudo node. Toggling shows the port-storm collapsing to a small
 *    ring of grouped connectors.
 *  - Bus collapse: six like edges converging on one sink collapse to a
 *    trunk via `busCollapse(kBus=3)`; a 2-edge calibration group visibly
 *    stays direct (the control case — below threshold).
 *  - Holon boundary: the two-holon dataset projected via
 *    `HolonicAdapter.projectHolonBoundary`, showing the ring, the ONE
 *    exposed boundary node inside it, and the portal transiting out
 *    through it to a stubbed neighbor. Drill to interior available.
 *
 * Pseudo-node styling is scoped to `node[?pseudo]` (per the CLAUDE.md
 * data-mapper doctrine: never a bare `node` rule with a `data()` mapper),
 * so real nodes are unaffected.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { Core } from "cytoscape";
import { busCollapse, HolonicAdapter, hubBurst, UGM } from "@g3t/core";
import { CytoscapeCanvas } from "@g3t/react";
import type { CyStylesheet } from "@g3t/react";
import { CapabilityBubble } from "../components/CapabilityCallout";
import {
  useRoutingControls,
  RoutingControlStrip,
} from "../components/routing-controls";
import {
  buildBusFixture,
  buildHubFixture,
  LEGIBILITY_HOLONS,
} from "./fixtures";

type PanelId = "hub" | "bus" | "holon";
type HolonView = "boundary" | "interior";

const ACCENT = "#22d3ee";

/** Style scoped to `node[?pseudo]` + the two connector/trunk edge types.
 *  Never a bare `node` rule (canvas doctrine: `[field]`-scoped selectors
 *  keep data mappers from warning on every real element). */
const PSEUDO_STYLESHEET: CyStylesheet[] = [
  {
    selector: "node[?pseudo]",
    style: {
      "background-color": "#0f172a",
      "border-color": ACCENT,
      "border-width": 2,
      "border-style": "dashed",
      shape: "round-diamond",
      width: 22,
      height: 22,
      "font-size": 10,
      color: "#cbd5e1",
      "text-outline-color": "#0b1120",
      "text-outline-width": 2,
    },
  },
  {
    selector: 'edge[type = "pseudoConnector"]',
    style: {
      "line-color": ACCENT,
      "target-arrow-color": ACCENT,
      "line-style": "dashed",
      width: 1.5,
      opacity: 0.85,
    },
  },
  {
    selector: 'edge[type = "pseudoTrunk"]',
    style: {
      "line-color": ACCENT,
      "target-arrow-color": ACCENT,
      width: 3,
      opacity: 0.95,
    },
  },
];

interface LegendItem {
  swatch: React.CSSProperties;
  label: string;
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul
      data-testid="legibility-legend"
      style={{
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        margin: "6px 0 10px",
        padding: 0,
        listStyle: "none",
        fontSize: 12,
        color: "#cbd5e1",
      }}
    >
      {items.map((it) => (
        <li
          key={it.label}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ display: "inline-block", ...it.swatch }} />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

const HUB_LEGEND: LegendItem[] = [
  {
    swatch: {
      width: 12,
      height: 12,
      background: "#334155",
      border: "1px solid #64748b",
      borderRadius: 2,
    },
    label: "real node",
  },
  {
    swatch: {
      width: 12,
      height: 12,
      background: "#0f172a",
      border: `2px dashed ${ACCENT}`,
      transform: "rotate(45deg)",
    },
    label: "satellite (pseudo)",
  },
  {
    swatch: {
      width: 22,
      height: 0,
      borderTop: `2px dashed ${ACCENT}`,
    },
    label: "hub↔satellite connector",
  },
];

const BUS_LEGEND: LegendItem[] = [
  {
    swatch: {
      width: 12,
      height: 12,
      background: "#334155",
      border: "1px solid #64748b",
      borderRadius: 2,
    },
    label: "real node",
  },
  {
    swatch: {
      width: 12,
      height: 12,
      background: "#0f172a",
      border: `2px dashed ${ACCENT}`,
      transform: "rotate(45deg)",
    },
    label: "junction (pseudo)",
  },
  {
    swatch: { width: 22, height: 0, borderTop: `3px solid ${ACCENT}` },
    label: "trunk edge",
  },
];

const HOLON_LEGEND: LegendItem[] = [
  {
    swatch: {
      width: 14,
      height: 14,
      borderRadius: "50%",
      border: `2px double ${ACCENT}`,
    },
    label: "holon boundary ring",
  },
  {
    swatch: {
      width: 12,
      height: 12,
      background: "#334155",
      borderRadius: 2,
    },
    label: "exposed boundary node",
  },
  {
    swatch: { width: 22, height: 0, borderTop: `2px dashed ${ACCENT}` },
    label: "portal transit",
  },
];

/** Boundary-ring styling scoped to `node[?_boundaryRing]` and the
 *  synthesized portal/containment edge types (the same scoping rule
 *  the OntologyShell Holons tab relies on from the theme layer). */
const HOLON_STYLESHEET: CyStylesheet[] = [
  {
    selector: "node[?_boundaryRing]",
    style: {
      "background-opacity": 0.05,
      "border-color": ACCENT,
      "border-width": 3,
      "border-style": "double",
      shape: "round-rectangle",
      "font-size": 12,
      color: "#e2e8f0",
      "text-valign": "top",
      "text-halign": "center",
      padding: "24px",
    },
  },
  {
    selector: "node[?_portalStub]",
    style: {
      "background-color": "#0f172a",
      "border-color": "#64748b",
      "border-width": 1,
      "border-style": "dashed",
      opacity: 0.6,
      color: "#94a3b8",
      "font-size": 11,
    },
  },
  {
    selector: "node[?_exposed]",
    style: {
      "background-color": "#334155",
      "border-color": ACCENT,
      "border-width": 2,
      color: "#e2e8f0",
      "font-size": 11,
    },
  },
  {
    selector: "edge[?_portalTransit]",
    style: {
      "line-color": ACCENT,
      "target-arrow-color": ACCENT,
      "line-style": "dashed",
      width: 2,
    },
  },
];

interface OpSignals {
  routeRefreshSignal?: number;
  relayoutSignal?: number;
}

function HubPanel({
  spread,
  routeEdges,
  routeRefreshSignal,
  relayoutSignal,
}: {
  spread: boolean;
  routeEdges?: boolean | { mode?: "direct" | "orthogonal" };
} & OpSignals) {
  const raw = useMemo(() => buildHubFixture(), []);
  const ugm = useMemo(
    () => (spread ? hubBurst(raw, { k: 6 }).ugm : raw),
    [raw, spread],
  );
  return (
    <PanelCanvas
      testId="legibility-hub-canvas"
      ugm={ugm}
      stylesheet={PSEUDO_STYLESHEET}
      routeEdges={routeEdges}
      routeRefreshSignal={routeRefreshSignal}
      relayoutSignal={relayoutSignal}
    />
  );
}

function BusPanel({
  spread,
  routeEdges,
  routeRefreshSignal,
  relayoutSignal,
}: {
  spread: boolean;
  routeEdges?: boolean | { mode?: "direct" | "orthogonal" };
} & OpSignals) {
  const raw = useMemo(() => buildBusFixture(), []);
  const ugm = useMemo(
    () => (spread ? busCollapse(raw, { kBus: 3 }).ugm : raw),
    [raw, spread],
  );
  return (
    <PanelCanvas
      testId="legibility-bus-canvas"
      ugm={ugm}
      stylesheet={PSEUDO_STYLESHEET}
      routeEdges={routeEdges}
      routeRefreshSignal={routeRefreshSignal}
      relayoutSignal={relayoutSignal}
    />
  );
}

function HolonPanel({
  view,
  routeEdges,
  routeRefreshSignal,
  relayoutSignal,
}: {
  view: HolonView;
  routeEdges?: boolean | { mode?: "direct" | "orthogonal" };
} & OpSignals) {
  const adapter = useMemo(() => new HolonicAdapter(LEGIBILITY_HOLONS), []);
  const ugm = useMemo(() => {
    const holon = adapter.dataset.holons[0];
    if (!holon) return new UGM();
    return view === "boundary"
      ? adapter.projectHolonBoundary(holon)
      : adapter.projectHolonInterior(holon);
  }, [adapter, view]);
  const containment = useMemo(
    () =>
      view === "boundary"
        ? {
            edgeType: HolonicAdapter.BOUNDARY_CONTAINMENT_EDGE,
            direction: "parentToChild" as const,
          }
        : undefined,
    [view],
  );
  return (
    <PanelCanvas
      testId="legibility-holon-canvas"
      ugm={ugm}
      stylesheet={HOLON_STYLESHEET}
      containment={containment}
      routeEdges={routeEdges}
      routeRefreshSignal={routeRefreshSignal}
      relayoutSignal={relayoutSignal}
    />
  );
}

function PanelCanvas({
  ugm,
  stylesheet,
  containment,
  testId,
  routeEdges,
  routeRefreshSignal,
  relayoutSignal,
}: {
  ugm: UGM;
  stylesheet: CyStylesheet[];
  containment?: { edgeType: string; direction: "parentToChild" };
  testId: string;
  routeEdges?: boolean | { mode?: "direct" | "orthogonal" };
} & OpSignals) {
  // Capture the live cy so a projection change (raw ↔ spread) can
  // restore pan/zoom across the required re-init: hubBurst/busCollapse
  // change the node-id set, which is a "different graph" by the canvas
  // contract, but the REAL nodes have not moved and the viewport
  // should hold.
  const cameraRef = useRef<{
    pan: { x: number; y: number };
    zoom: number;
  } | null>(null);
  const onReady = useCallback((cy: Core) => {
    const cam = cameraRef.current;
    if (cam) cy.viewport({ zoom: cam.zoom, pan: cam.pan });
    cy.on("viewport", () => {
      cameraRef.current = { pan: { ...cy.pan() }, zoom: cy.zoom() };
    });
  }, []);
  return (
    <div
      data-testid={testId}
      style={{ flex: 1, minHeight: 320, position: "relative" }}
    >
      <CytoscapeCanvas
        ugm={ugm}
        layout="fcose"
        stylesheet={stylesheet}
        containment={containment}
        onReady={onReady}
        animate={false}
        routeEdges={routeEdges ?? true}
        routeRefreshSignal={routeRefreshSignal}
        relayoutSignal={relayoutSignal}
        edgeClickIsolate
      />
    </div>
  );
}

const PANELS: { id: PanelId; label: string; blurb: string }[] = [
  {
    id: "hub",
    label: "Hub burst",
    blurb:
      "14 edges around one hub, grouped by (edge type, direction) into two satellite pseudo nodes.",
  },
  {
    id: "bus",
    label: "Bus collapse",
    blurb:
      "Six like edges collapse to one trunk through a junction; the 2-edge calibration group stays direct (below threshold).",
  },
  {
    id: "holon",
    label: "Holon boundary",
    blurb:
      "The flight-deck holon exposes ONE boundary node (the radio); the portal to ground control transits through it.",
  },
];

export function LegibilityShell({ onBack }: { onBack?: () => void } = {}) {
  const [panel, setPanel] = useState<PanelId>("hub");
  const [hubSpread, setHubSpread] = useState(true);
  const [busSpread, setBusSpread] = useState(true);
  const [holonView, setHolonView] = useState<HolonView>("boundary");
  const {
    routeMode,
    setRouteMode,
    routeEdgesConfig,
    routeRefreshSignal,
    refreshRoutes,
    relayoutSignal,
    relayout,
  } = useRoutingControls();
  const active = PANELS.find((p) => p.id === panel) ?? PANELS[0];

  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        color: "#e2e8f0",
        background: "#0b1120",
        minHeight: "100vh",
        fontFamily: "var(--g3t-font, 'IBM Plex Sans', sans-serif)",
      }}
    >
      <header>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            data-testid="legibility-back"
            style={{ marginBottom: 8 }}
          >
            {"←"} All demos
          </button>
        )}
        <h2 style={{ margin: 0 }}>Legibility Lab</h2>
        <p style={{ maxWidth: 720, color: "#94a3b8" }}>
          Hub burst, bus collapse, and holon boundary — the smallest graphs that
          make each device readable.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          role="tablist"
          data-testid="legibility-tabs"
          style={{ display: "flex", gap: 6 }}
        >
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={panel === p.id}
              data-testid={`legibility-tab-${p.id}`}
              onClick={() => setPanel(p.id)}
              style={{
                padding: "6px 12px",
                background: panel === p.id ? ACCENT : "transparent",
                color: panel === p.id ? "#0b1120" : "#cbd5e1",
                border: `1px solid ${panel === p.id ? ACCENT : "#334155"}`,
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto" }}>
          <RoutingControlStrip
            idPrefix="legibility"
            routeMode={routeMode}
            setRouteMode={setRouteMode}
            refreshRoutes={refreshRoutes}
            relayout={relayout}
          />
        </span>
      </div>

      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#cbd5e1" }}>
        {active?.blurb}
      </p>

      {panel === "hub" && (
        <>
          <ToggleRow
            testId="legibility-hub-toggle"
            label="Spread (hubBurst k=6)"
            checked={hubSpread}
            onChange={setHubSpread}
          />
          <Legend items={HUB_LEGEND} />
          <HubPanel
            spread={hubSpread}
            routeEdges={routeEdgesConfig}
            routeRefreshSignal={routeRefreshSignal}
            relayoutSignal={relayoutSignal}
          />
        </>
      )}
      {panel === "bus" && (
        <>
          <ToggleRow
            testId="legibility-bus-toggle"
            label="Spread (busCollapse kBus=3)"
            checked={busSpread}
            onChange={setBusSpread}
          />
          <Legend items={BUS_LEGEND} />
          <BusPanel
            spread={busSpread}
            routeEdges={routeEdgesConfig}
            routeRefreshSignal={routeRefreshSignal}
            relayoutSignal={relayoutSignal}
          />
        </>
      )}
      {panel === "holon" && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {(["boundary", "interior"] as HolonView[]).map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`legibility-holon-view-${v}`}
                aria-pressed={holonView === v}
                onClick={() => setHolonView(v)}
                style={{
                  padding: "4px 10px",
                  background: holonView === v ? "#1e293b" : "transparent",
                  color: "#e2e8f0",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <Legend items={HOLON_LEGEND} />
          <HolonPanel
            view={holonView}
            routeEdges={routeEdgesConfig}
            routeRefreshSignal={routeRefreshSignal}
            relayoutSignal={relayoutSignal}
          />
        </>
      )}

      <CapabilityBubble
        accent={ACCENT}
        items={[
          {
            mechanism: "hubBurst",
            how: "groups a high-degree node's incident edges by (type, direction) and fans each group through one satellite pseudo node.",
            anchor: "pseudo-node-spreading",
          },
          {
            mechanism: "busCollapse",
            how: "collapses a many-to-one fan-in of >= kBus like edges into one trunk through a pseudo junction.",
            anchor: "pseudo-node-spreading",
          },
          {
            mechanism: "HolonicAdapter.projectHolonBoundary",
            how: "renders a holon's boundary ring with exposed boundary nodes inside and portal edges transiting out to stub neighbors.",
          },
          {
            mechanism: "CytoscapeCanvas.stylesheet",
            how: "adds field-scoped rules (node[?pseudo], edge[type = ...]) so pseudo nodes read unmistakably without touching real elements.",
          },
        ]}
      />
    </div>
  );
}

function ToggleRow({
  testId,
  label,
  checked,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
    >
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
