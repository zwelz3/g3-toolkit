/**
 * D3: Cyber Threat Intelligence (upgraded).
 * D4: Supply Chain Risk Monitor (upgraded).
 *
 * Both add LinkedChart panels and enhanced filtering to the generic DemoApp.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { CytoscapeCanvas } from "@g3t/react";
import { TableView } from "@g3t/react";
import { DetailInspector } from "@g3t/react";
import { MapView } from "@g3t/react";
import { ZoomControls, StatusBar } from "@g3t/react";
import {
  EncodingPanel,
  CanvasLegend,
  DEFAULT_ENCODING,
  encodingToCytoscapeStyle,
} from "@g3t/react";
import { FacetFilter } from "@g3t/react";
import { SearchBar } from "@g3t/react";
import { LinkedChart } from "@g3t/charts";
import { TemporalRangeFilter } from "@g3t/react";
import { useSelectionStore } from "@g3t/react";
import { useThemeStore } from "@g3t/react";
import { ContextMenuManager } from "@g3t/react";
import { G3tEventBus } from "@g3t/core";
import {
  registerToolkitActions,
  buildNeighborhoodUGM,
  wireCytoscapeContextActions,
} from "@g3t/react";
import { createCountByType, createPropertyCorrelation } from "@g3t/core";
import { UGM } from "@g3t/core";
import {
  buildCyberGraph,
  buildSupplyChainGraph,
  upgradeCyberWithDates,
  upgradeSupplyWithProps,
} from "../fixtures/scenarios";
import type { EncodingConfig } from "@g3t/react";
import type { SearchResult } from "@g3t/react";

type BottomTab = "table" | "map";

// ── Shared shell builder ────────────────────────────────────────────

function useGraphDemo(buildFn: () => UGM, upgradeFn?: (u: UGM) => void) {
  const ugm = useMemo(() => {
    const u = buildFn();
    upgradeFn?.(u);
    return u;
  }, []);
  const { theme, setTheme } = useThemeStore();
  const selected = useSelectionStore((s) => s.selectedNodeIds);
  const selectedId = [...selected][0] ?? null;
  const [encoding, setEncoding] = useState<EncodingConfig>({
    ...DEFAULT_ENCODING,
    nodeSizeProperty: "risk",
    nodeSizeRange: [16, 48],
  });
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [neighborhoodUGM, setNeighborhoodUGM] = useState<UGM | null>(null);
  const [cyInstance, setCyInstance] = useState<unknown>(null);

  const [eventBus] = useState(() => new G3tEventBus());
  const [menuManager] = useState(() => {
    const mgr = new ContextMenuManager();
    registerToolkitActions(mgr, {
      ugm,
      eventBus,
      onViewNeighbors: (id, h) =>
        setNeighborhoodUGM(buildNeighborhoodUGM(ugm, id, h)),
    });
    return mgr;
  });
  // Bugfix 17: wire toolkit context-menu events to cytoscape (see
  // DataScientistDemo for rationale).
  useEffect(() => {
    if (!cyInstance) return;
    return wireCytoscapeContextActions(
      cyInstance as Parameters<typeof wireCytoscapeContextActions>[0],
      eventBus,
      ugm,
      {
        onViewNeighborhood: (subUGM) => setNeighborhoodUGM(subUGM),
      },
    );
  }, [cyInstance, eventBus, ugm]);


  const filteredUGM = useMemo(() => {
    if (hiddenTypes.size === 0) return ugm;
    const f = new UGM();
    ugm.forEachNode((id, attrs) => {
      if (!hiddenTypes.has(attrs.types[0] ?? ""))
        f.addNode(id, { types: attrs.types, properties: attrs.properties });
    });
    ugm.forEachEdge((_eid, attrs, s, t) => {
      if (f.hasNode(s) && f.hasNode(t)) f.addEdge(s, t, attrs);
    });
    return f;
  }, [ugm, hiddenTypes]);

  return {
    ugm,
    filteredUGM,
    theme,
    setTheme,
    selectedId,
    encoding,
    setEncoding,
    // Bugfix 9: derived stylesheet so the EncodingPanel actually drives
    // the canvas. See DataScientistDemo for rationale.
    encodingStylesheet: encodingToCytoscapeStyle(
      encoding,
      filteredUGM,
      theme.typePalette,
    ),
    hiddenTypes,
    setHiddenTypes,
    neighborhoodUGM,
    setNeighborhoodUGM,
    cyInstance,
    setCyInstance,
    menuManager,
  };
}

// ── D3: Cyber Threat Intelligence ───────────────────────────────────

export function CyberDemo({ onBack }: { onBack: () => void }) {
  const g = useGraphDemo(buildCyberGraph, upgradeCyberWithDates);
  const countByType = useMemo(() => createCountByType(), []);
  const [bottomTab, setBottomTab] = useState<BottomTab>("table");
  const cy = g.cyInstance as any; // eslint-disable-line

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--g3t-bg-primary)",
        color: "var(--g3t-text-primary)",
      }}
    >
      <div className="g3t-toolbar" style={{ gap: 6 }}>
        <button className="g3t-btn g3t-btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="g3t-divider" />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#f43f5e",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          Cyber Threat Intelligence
        </span>
        <span style={{ flex: 1 }} />
        <select
          className="g3t-select"
          value={g.theme.id}
          onChange={(e) => g.setTheme(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="high-contrast">High Contrast</option>
        </select>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: search + filter + temporal + encoding */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid var(--g3t-border)",
            background: "var(--g3t-bg-secondary)",
            overflow: "auto",
          }}
        >
          <div
            style={{ padding: 8, borderBottom: "1px solid var(--g3t-border)" }}
          >
            <SearchBar
              ugm={g.ugm}
              onSearchChange={(r: SearchResult) => {
                // Bugfix 10: select matching nodes as the user types.
                if (r.matchingIds.length > 0) {
                  useSelectionStore.getState().selectNodes(r.matchingIds);
                }
              }}
            />
          </div>
          <div
            style={{ padding: 8, borderBottom: "1px solid var(--g3t-border)" }}
          >
            <FacetFilter ugm={g.ugm} onFilterChange={g.setHiddenTypes} />
          </div>
          <div
            style={{ padding: 8, borderBottom: "1px solid var(--g3t-border)" }}
          >
            <TemporalRangeFilter
              ugm={g.ugm}
              timeProperty="startDate"
              onChange={() => {}}
            />
          </div>
          <div style={{ padding: 8 }}>
            <div className="g3t-panel-title">Encoding</div>
            <EncodingPanel
              ugm={g.ugm}
              encoding={g.encoding}
              onChange={g.setEncoding}
            />
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <CytoscapeCanvas
              ugm={g.filteredUGM}
              menuManager={g.menuManager}
              stylesheet={g.encodingStylesheet as any}
              onReady={(c) => g.setCyInstance(c)}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                zIndex: 10,
                maxWidth: 160,
              }}
            >
              <CanvasLegend ugm={g.filteredUGM} encoding={g.encoding} />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 12,
                right: 12,
                zIndex: 10,
              }}
            >
              <ZoomControls
                onZoomIn={() =>
                  cy?.zoom({
                    level: cy.zoom() * 1.3,
                    renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
                  })
                }
                onZoomOut={() =>
                  cy?.zoom({
                    level: cy.zoom() * 0.7,
                    renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
                  })
                }
                onFit={() => cy?.fit(undefined, 40)}
              />
            </div>
            {g.neighborhoodUGM && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 300,
                  height: 240,
                  zIndex: 10,
                  border: "2px solid #f43f5e",
                  borderRadius: 6,
                  background: "var(--g3t-bg-primary)",
                  overflow: "hidden",
                  boxShadow: "var(--g3t-shadow-lg)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--g3t-bg-secondary)",
                    borderBottom: "1px solid var(--g3t-border)",
                  }}
                >
                  <span>Infrastructure</span>
                  <button
                    className="g3t-btn g3t-btn-ghost"
                    onClick={() => g.setNeighborhoodUGM(null)}
                    style={{ fontSize: 14, padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
                <CytoscapeCanvas ugm={g.neighborhoodUGM} layout="breadthfirst" />
              </div>
            )}
          </div>
          <div
            style={{
              height: 220,
              borderTop: "1px solid var(--g3t-border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--g3t-border)",
                background: "var(--g3t-bg-secondary)",
              }}
            >
              <button
                className={`g3t-btn ${bottomTab === "table" ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                onClick={() => setBottomTab("table")}
                style={{ borderRadius: 0 }}
              >
                Table
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              <TableView
                ugm={g.filteredUGM}
                menuManager={g.menuManager}
                pageSize={6}
              />
            </div>
          </div>
        </div>

        {/* Right: charts + inspector */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: "1px solid var(--g3t-border)",
            background: "var(--g3t-bg-secondary)",
            overflow: "auto",
            padding: 8,
          }}
        >
          <div className="g3t-panel-title">Attacks by Type</div>
          <LinkedChart
            ugm={g.filteredUGM}
            pipeline={countByType}
            type="bar"
            height={150}
          />
          <div style={{ marginTop: 12 }}>
            <div className="g3t-panel-title">Inspector</div>
            <DetailInspector
              ugm={g.filteredUGM}
              selection={
                g.selectedId ? { type: "node", id: g.selectedId } : null
              }
            />
          </div>
        </div>
      </div>
      <StatusBar ugm={g.filteredUGM} zoomLevel={1.0} />
    </div>
  );
}

// ── D4: Supply Chain Risk Monitor ───────────────────────────────────

export function SupplyChainDemo({ onBack }: { onBack: () => void }) {
  const g = useGraphDemo(buildSupplyChainGraph, upgradeSupplyWithProps);
  const countByType = useMemo(() => createCountByType(), []);
  const [bottomTab, setBottomTab] = useState<BottomTab>("table");
  const cy = g.cyInstance as any; // eslint-disable-line

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--g3t-bg-primary)",
        color: "var(--g3t-text-primary)",
      }}
    >
      <div className="g3t-toolbar" style={{ gap: 6 }}>
        <button className="g3t-btn g3t-btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="g3t-divider" />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#f59e0b",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          Supply Chain Risk Monitor
        </span>
        <span style={{ flex: 1 }} />
        <select
          className="g3t-select"
          value={g.theme.id}
          onChange={(e) => g.setTheme(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="high-contrast">High Contrast</option>
        </select>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid var(--g3t-border)",
            background: "var(--g3t-bg-secondary)",
            overflow: "auto",
          }}
        >
          <div
            style={{ padding: 8, borderBottom: "1px solid var(--g3t-border)" }}
          >
            <SearchBar
              ugm={g.ugm}
              onSearchChange={(r: SearchResult) => {
                // Bugfix 10: select matching nodes as the user types.
                if (r.matchingIds.length > 0) {
                  useSelectionStore.getState().selectNodes(r.matchingIds);
                }
              }}
            />
          </div>
          <div
            style={{ padding: 8, borderBottom: "1px solid var(--g3t-border)" }}
          >
            <FacetFilter ugm={g.ugm} onFilterChange={g.setHiddenTypes} />
          </div>
          <div style={{ padding: 8 }}>
            <div className="g3t-panel-title">Encoding</div>
            <EncodingPanel
              ugm={g.ugm}
              encoding={g.encoding}
              onChange={g.setEncoding}
            />
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <CytoscapeCanvas
              ugm={g.filteredUGM}
              menuManager={g.menuManager}
              stylesheet={g.encodingStylesheet as any}
              onReady={(c) => g.setCyInstance(c)}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                zIndex: 10,
                maxWidth: 160,
              }}
            >
              <CanvasLegend ugm={g.filteredUGM} encoding={g.encoding} />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 12,
                right: 12,
                zIndex: 10,
              }}
            >
              <ZoomControls
                onZoomIn={() =>
                  cy?.zoom({
                    level: cy.zoom() * 1.3,
                    renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
                  })
                }
                onZoomOut={() =>
                  cy?.zoom({
                    level: cy.zoom() * 0.7,
                    renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
                  })
                }
                onFit={() => cy?.fit(undefined, 40)}
              />
            </div>
            {g.neighborhoodUGM && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 300,
                  height: 240,
                  zIndex: 10,
                  border: "2px solid #f59e0b",
                  borderRadius: 6,
                  background: "var(--g3t-bg-primary)",
                  overflow: "hidden",
                  boxShadow: "var(--g3t-shadow-lg)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--g3t-bg-secondary)",
                    borderBottom: "1px solid var(--g3t-border)",
                  }}
                >
                  <span>Supply Chain</span>
                  <button
                    className="g3t-btn g3t-btn-ghost"
                    onClick={() => g.setNeighborhoodUGM(null)}
                    style={{ fontSize: 14, padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
                <CytoscapeCanvas ugm={g.neighborhoodUGM} layout="breadthfirst" />
              </div>
            )}
          </div>
          <div
            style={{
              height: 220,
              borderTop: "1px solid var(--g3t-border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--g3t-border)",
                background: "var(--g3t-bg-secondary)",
              }}
            >
              {(["table", "map"] as BottomTab[]).map((t) => (
                <button
                  key={t}
                  className={`g3t-btn ${bottomTab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                  onClick={() => setBottomTab(t)}
                  style={{ borderRadius: 0, textTransform: "capitalize" }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {bottomTab === "table" && (
                <TableView
                  ugm={g.filteredUGM}
                  menuManager={g.menuManager}
                  pageSize={6}
                />
              )}
              {bottomTab === "map" && <MapView ugm={g.filteredUGM} />}
            </div>
          </div>
        </div>

        <div
          style={{
            width: 260,
            flexShrink: 0,
            borderLeft: "1px solid var(--g3t-border)",
            background: "var(--g3t-bg-secondary)",
            overflow: "auto",
            padding: 8,
          }}
        >
          <div className="g3t-panel-title">Companies by Type</div>
          <LinkedChart
            ugm={g.filteredUGM}
            pipeline={countByType}
            type="pie"
            height={160}
          />
          <div style={{ marginTop: 12 }}>
            <div className="g3t-panel-title">Inspector</div>
            <DetailInspector
              ugm={g.filteredUGM}
              selection={
                g.selectedId ? { type: "node", id: g.selectedId } : null
              }
            />
          </div>
        </div>
      </div>
      <StatusBar ugm={g.filteredUGM} zoomLevel={1.0} />
    </div>
  );
}
