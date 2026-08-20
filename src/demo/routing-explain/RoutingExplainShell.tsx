/**
 * Routing Explained: DEV-only didactic surface showing how the scene
 * router decides between a straight bezier and an orthogonal detour,
 * and where the structural/MBSE engine fits separately.
 *
 * Three panels:
 *  1. Decision-flow diagram -- a StructuralGraphInput of the routing
 *     decision rendered with StructuralSvgView + useStructuralLayout.
 *     This literally draws the orthogonal explainer WITH the orthogonal
 *     structural engine -- the meta-point is intentional.
 *  2. Live rule demo -- a CytoscapeCanvas scene with the 3-state mode
 *     control (Direct / Orthogonal / Off) so a reader can watch the
 *     same edges change as they flip the mode.
 *  3. Prose panel -- plain-language explanation of the direct-unless-
 *     crossing rule, when each mode is appropriate, and the one-sentence
 *     structural-engine distinction.
 *
 * All three dogfood the toolkit's own renderers. No mermaid or third-
 * party diagram dependency.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Core } from "cytoscape";
import {
  CytoscapeCanvas,
  StructuralSvgView,
  useStructuralLayout,
} from "@g3t/react";
import type { CyStylesheet } from "@g3t/react";
import { UGM } from "@g3t/core";
import type { StructuralGraphInput, StructuralLayoutOptions } from "@g3t/core";
import {
  useRoutingControls,
  RoutingControlStrip,
} from "../components/routing-controls";

// ── Flow-diagram input ──────────────────────────────────────────────

/**
 * Build the routing decision flow as a StructuralGraphInput.
 * All routing-logic field names are sourced from the live code:
 *   packages/core/src/route/route-scene-edges.ts (lines 105-129)
 *   packages/react/src/views/canvas/CytoscapeCanvas.tsx (lines 886-900)
 */
function buildFlowInput(): StructuralGraphInput {
  return {
    nodes: [
      {
        id: "n-start",
        header: { name: "Each visible edge" },
        compartments: [
          {
            id: "c-start",
            rows: [
              { id: "r-s1", text: "source, target endpoints resolved" },
              { id: "r-s2", text: "self-loops excluded" },
            ],
          },
        ],
      },
      {
        id: "n-mode",
        header: { name: "routeEdges mode?" },
        compartments: [
          {
            id: "c-mode",
            rows: [{ id: "r-m1", text: "Off  |  Direct  |  Orthogonal" }],
          },
        ],
      },
      {
        id: "n-off",
        header: { stereotype: "Off", name: "BEZIER" },
        compartments: [
          {
            id: "c-off",
            rows: [
              { id: "r-o1", text: "routeEdges={false}" },
              { id: "r-o2", text: "no routing pass" },
            ],
          },
        ],
      },
      {
        id: "n-gate",
        header: { name: "Straight [sc, tc] crosses a node box?" },
        compartments: [
          {
            id: "c-gate",
            rows: [
              {
                id: "r-g1",
                text: "segmentIntersectsBoxes(sc, tc, obstacles)",
              },
              {
                id: "r-g2",
                text: "sc = boxCenter(source), tc = boxCenter(target)",
              },
            ],
          },
        ],
      },
      {
        id: "n-direct",
        header: { stereotype: "Direct mode, clear path", name: "BEZIER" },
        compartments: [
          {
            id: "c-direct",
            rows: [
              { id: "r-d1", text: "edge left unrouted" },
              { id: "r-d2", text: "Cytoscape default curve style" },
            ],
          },
        ],
      },
      {
        id: "n-route",
        header: { stereotype: "routeOrthogonal", name: "A* orthogonal detour" },
        compartments: [
          {
            id: "c-route",
            rows: [
              { id: "r-r1", text: "axis-aligned path around obstacle boxes" },
              { id: "r-r2", text: "clearance, bendPenalty, minStub" },
              {
                id: "r-r3",
                text: "inferTerminalSides: EAST/WEST or NORTH/SOUTH",
              },
            ],
          },
        ],
      },
      {
        id: "n-project",
        header: {
          stereotype: "polylineToCytoscapeSegments",
          name: "Project polyline",
        },
        compartments: [
          {
            id: "c-project",
            rows: [
              { id: "r-p1", text: "curve-style: segments" },
              { id: "r-p2", text: "segment-distances + segment-weights" },
              { id: "r-p3", text: "written in cy.batch() -- one restyle" },
            ],
          },
        ],
      },
      {
        id: "n-structural",
        header: { stereotype: "separate system", name: "layoutStructural" },
        compartments: [
          {
            id: "c-structural",
            rows: [
              { id: "r-st1", text: "block / MBSE views only" },
              { id: "r-st2", text: "always orthogonal: ELK + nudge pass" },
              { id: "r-st3", text: "not governed by routeEdges mode" },
              { id: "r-st4", text: "CytoscapeCanvas skips scene routing on" },
              { id: "r-st5", text: "structural scenes automatically" },
            ],
          },
        ],
      },
    ],
    edges: [
      { id: "e-start-mode", source: "n-start", target: "n-mode" },
      { id: "e-mode-off", source: "n-mode", target: "n-off", label: "Off" },
      {
        id: "e-mode-gate",
        source: "n-mode",
        target: "n-gate",
        label: "Direct",
      },
      {
        id: "e-mode-route",
        source: "n-mode",
        target: "n-route",
        label: "Orthogonal",
      },
      {
        id: "e-gate-direct",
        source: "n-gate",
        target: "n-direct",
        label: "no",
      },
      { id: "e-gate-route", source: "n-gate", target: "n-route", label: "yes" },
      { id: "e-route-project", source: "n-route", target: "n-project" },
    ],
  };
}

const FLOW_INPUT: StructuralGraphInput = buildFlowInput();

const FLOW_OPTIONS: Omit<StructuralLayoutOptions, "sketch"> = {
  direction: "DOWN",
  routeEdges: true,
  nudge: true,
  layerSpacing: 60,
};

// ── Live demo UGM ───────────────────────────────────────────────────

/**
 * A small UGM with 6 nodes and 6 edges designed so that with a
 * force layout at least some edges pass through other nodes (making
 * the direct-vs-orthogonal mode switch visible at a glance).
 *
 * "source" and "target" are positioned far apart in most force-layout
 * runs; the three intermediate nodes (mid-a, mid-b, mid-c) cluster
 * in the middle. The long edge source->target has a high probability
 * of crossing those nodes, making it a candidate for orthogonal routing
 * in Direct mode and a guaranteed route in Orthogonal mode.
 */
function buildDemoUgm(): UGM {
  const ugm = new UGM();
  ugm.addNode("src", {
    types: ["outer"],
    properties: { label: "Source", group: "outer" },
  });
  ugm.addNode("mid-a", {
    types: ["inner"],
    properties: { label: "Mid A", group: "inner" },
  });
  ugm.addNode("mid-b", {
    types: ["inner"],
    properties: { label: "Mid B", group: "inner" },
  });
  ugm.addNode("mid-c", {
    types: ["inner"],
    properties: { label: "Mid C", group: "inner" },
  });
  ugm.addNode("tgt", {
    types: ["outer"],
    properties: { label: "Target", group: "outer" },
  });
  ugm.addNode("side", {
    types: ["outer"],
    properties: { label: "Side", group: "outer" },
  });
  // Long-range edge: src->tgt crosses mid nodes in most force layouts
  ugm.addEdge("src", "tgt", {
    type: "long",
    properties: { label: "long range" },
  });
  ugm.addEdge("mid-a", "mid-b", { type: "hop" });
  ugm.addEdge("mid-b", "mid-c", { type: "hop" });
  ugm.addEdge("src", "mid-a", { type: "hop" });
  ugm.addEdge("mid-c", "tgt", { type: "hop" });
  ugm.addEdge("src", "side", { type: "hop", properties: { label: "clear" } });
  return ugm;
}

const DEMO_UGM = buildDemoUgm();

// ── Styles ──────────────────────────────────────────────────────────

const DEMO_STYLESHEET: CyStylesheet[] = [
  {
    selector: "node",
    style: {
      "background-color": "#1e293b",
      "border-color": "#334155",
      "border-width": 1.5,
      color: "#e2e8f0",
      "font-size": 11,
      "text-outline-color": "#0b1120",
      "text-outline-width": 1,
    },
  },
  {
    selector: 'node[group = "outer"]',
    style: {
      "background-color": "#1e3a5f",
      "border-color": "#3b82f6",
      "border-width": 2,
    },
  },
  {
    selector: 'node[group = "inner"]',
    style: {
      "background-color": "#1a2c24",
      "border-color": "#4ade80",
      "border-width": 1.5,
    },
  },
  {
    selector: "edge",
    style: {
      "line-color": "#475569",
      "target-arrow-color": "#475569",
      "target-arrow-shape": "triangle",
      width: 1.5,
    },
  },
  {
    selector: 'edge[type = "long"]',
    style: {
      "line-color": "#a3e635",
      "target-arrow-color": "#a3e635",
      width: 2.5,
      "line-style": "solid",
    },
  },
];

const FLOW_CONTAINER_STYLE: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 6,
  overflow: "hidden",
  minHeight: 420,
  position: "relative",
};

const CANVAS_CONTAINER_STYLE: React.CSSProperties = {
  background: "#0b1120",
  border: "1px solid #1e293b",
  borderRadius: 6,
  overflow: "hidden",
  minHeight: 320,
  position: "relative",
};

const PROSE_STYLE: React.CSSProperties = {
  background: "rgba(15,23,42,0.7)",
  border: "1px solid #1e293b",
  borderRadius: 6,
  padding: "20px 24px",
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 1.65,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: 8,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#e2e8f0",
  marginBottom: 10,
};

// ── Sized structural SVG ────────────────────────────────────────────

function SizedFlowDiagram({
  input,
  geometry,
}: {
  input: StructuralGraphInput;
  geometry: Parameters<typeof StructuralSvgView>[0]["geometry"];
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 900, h: 480 });
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={hostRef} style={{ width: "100%", height: "100%" }}>
      <StructuralSvgView
        direction="DOWN"
        input={input}
        geometry={geometry}
        width={size.w}
        height={size.h}
      />
    </div>
  );
}

// ── Shell ───────────────────────────────────────────────────────────

export function RoutingExplainShell({ onBack }: { onBack?: () => void } = {}) {
  const {
    routeMode,
    setRouteMode,
    routeEdgesConfig,
    routeRefreshSignal,
    refreshRoutes,
    relayoutSignal,
    relayout,
  } = useRoutingControls();

  // Camera-hold ref across a mode change. Mode changes are
  // RESTYLE-ONLY on the same graph (same node-id set), so the canvas
  // contract prohibits re-init/refit. The cy.on("viewport") ref below
  // captures live pan/zoom; onReady restores it on the same-graph
  // restyle path (which does NOT call onReady again, so this is a
  // belt-and-suspenders guard for the structural-scene skip path only).
  const cameraRef = useRef<{
    pan: { x: number; y: number };
    zoom: number;
  } | null>(null);
  const onCyReady = useMemo(
    () => (cy: Core) => {
      const cam = cameraRef.current;
      if (cam) cy.viewport({ zoom: cam.zoom, pan: cam.pan });
      cy.on("viewport", () => {
        cameraRef.current = { pan: { ...cy.pan() }, zoom: cy.zoom() };
      });
    },
    [],
  );

  // Flow diagram layout.
  const { structural: flowScene } = useStructuralLayout(
    FLOW_INPUT,
    FLOW_OPTIONS,
  );

  const accentColor = "#a3e635";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1120",
        color: "#e2e8f0",
        fontFamily: "var(--g3t-font, 'IBM Plex Sans', sans-serif)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 20px",
          borderBottom: "1px solid #1e293b",
          background: "#0d1424",
          flexShrink: 0,
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            data-testid="rexplain-back"
            style={{
              background: "transparent",
              border: "1px solid #334155",
              borderRadius: 4,
              color: "#94a3b8",
              cursor: "pointer",
              padding: "5px 12px",
              fontSize: 13,
            }}
          >
            {"←"} All demos
          </button>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Routing Explained</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            How the scene router decides between a straight edge and an
            orthogonal detour
          </div>
        </div>
        <span style={{ marginLeft: "auto" }}>
          <RoutingControlStrip
            idPrefix="rexplain"
            routeMode={routeMode}
            setRouteMode={setRouteMode}
            refreshRoutes={refreshRoutes}
            relayout={relayout}
          />
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "rgba(163,230,53,0.1)",
            color: accentColor,
            border: `1px solid ${accentColor}40`,
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          DEV only
        </span>
      </header>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gridTemplateRows: "1fr auto",
          gap: 16,
          padding: 16,
          minHeight: 0,
        }}
      >
        {/* Panel 1: Decision flow diagram */}
        <div
          style={{
            gridColumn: "1",
            gridRow: "1 2",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={LABEL_STYLE}>Panel 1 -- Decision flow diagram</div>
          <div
            data-testid="rexplain-flow-host"
            style={{ ...FLOW_CONTAINER_STYLE, flex: 1 }}
          >
            {flowScene ? (
              <SizedFlowDiagram
                input={flowScene.input}
                geometry={flowScene.geometry}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#475569",
                  fontSize: 13,
                }}
              >
                Laying out flow diagram...
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#475569",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            This diagram is rendered by the same structural layout engine it
            documents.
          </div>
        </div>

        {/* Panel 2: Live rule demo */}
        <div
          style={{
            gridColumn: "2",
            gridRow: "1",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={LABEL_STYLE}>Panel 2 -- Live rule demo</div>
          <div
            data-testid="rexplain-canvas-host"
            style={{ ...CANVAS_CONTAINER_STYLE, flex: 1 }}
          >
            <CytoscapeCanvas
              ugm={DEMO_UGM}
              layout="fcose"
              stylesheet={DEMO_STYLESHEET}
              animate={false}
              routeEdges={routeEdgesConfig}
              routeRefreshSignal={routeRefreshSignal}
              relayoutSignal={relayoutSignal}
              edgeClickIsolate
              onReady={onCyReady}
            />
          </div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Highlighted edge (green) is the long-range hop most likely to cross
            intermediate nodes. Flip the mode to watch its routing change.
          </div>
        </div>

        {/* Panel 3: Prose */}
        <div
          style={{
            gridColumn: "2",
            gridRow: "2",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={LABEL_STYLE}>Panel 3 -- How it works</div>
          <div style={PROSE_STYLE}>
            <div style={SECTION_TITLE_STYLE}>Direct mode (the default)</div>
            <p style={{ margin: "0 0 12px" }}>
              For each edge the router computes <code>sc</code> (source box
              center) and <code>tc</code> (target box center) and tests whether
              the straight segment <code>[sc, tc]</code> passes through any
              other node&apos;s bounding box. If it does not, the edge is left
              unrouted and renders as a bezier. If it does, the edge falls
              through to the A* router.
            </p>
            <div style={SECTION_TITLE_STYLE}>Orthogonal mode</div>
            <p style={{ margin: "0 0 12px" }}>
              Every edge is sent through the A* router regardless of whether the
              straight shot is clear. Use this when you want uniform
              axis-aligned edges across the whole scene.
            </p>
            <div style={SECTION_TITLE_STYLE}>Off mode</div>
            <p style={{ margin: "0 0 12px" }}>
              The routing pass is skipped entirely. Cytoscape draws all edges as
              its default bezier curves. Use this for force-directed scenes
              where the graph is dense enough that orthogonal routing adds
              visual noise.
            </p>
            <div style={SECTION_TITLE_STYLE}>Structural engine (separate)</div>
            <p style={{ margin: 0 }}>
              Block and MBSE views go through a different engine:{" "}
              <code>layoutStructural</code>
              assigns layers, minimizes crossings, routes obstacle-aware
              polylines, and runs the nudge separation pass. That engine always
              draws orthogonal routes and is not governed by the{" "}
              <code>routeEdges</code> mode above. CytoscapeCanvas detects
              structural scenes automatically and skips the scene routing pass
              on them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
