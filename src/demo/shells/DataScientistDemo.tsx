/**
 * D5: Data Scientist Exploration Dashboard.
 *
 * Charts prominent. FilterBuilder. EncodingPanel. MatrixView. Undo/redo.
 * Layout: left=filter+encoding | center=graph | right=charts | bottom=table+matrix
 */

import { useState, useMemo, useCallback } from "react";
import { CytoscapeCanvas } from "@g3t/react";
import { TableView } from "@g3t/react";
import { DetailInspector } from "@g3t/react";
import { MatrixView } from "@g3t/react";
import { ZoomControls, StatusBar } from "@g3t/react";
import {
  EncodingPanel,
  CanvasLegend,
  DEFAULT_ENCODING,
} from "@g3t/react";
import { FacetFilter } from "@g3t/react";
import { FilterBuilder } from "@g3t/react";
import { SearchBar } from "@g3t/react";
import { LinkedChart } from "@g3t/charts";
import { useSelectionStore } from "@g3t/react";
import { AnnotationPanel } from "@g3t/react";
import { PropertyEditor } from "@g3t/react";
import { LayoutManager } from "@g3t/react";
import { useThemeStore } from "@g3t/react";
import { ContextMenuManager } from "@g3t/react";
import { G3tEventBus } from "@g3t/core";
import {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "@g3t/react";
import {
  createCountByType,
  createPropertyCorrelation,
  createDegreeDistribution,
} from "@g3t/core";
import { UGM } from "@g3t/core";
import { buildDataSciUGM } from "../fixtures/additional";
import type { EncodingConfig } from "@g3t/react";
import type { SearchResult } from "@g3t/react";

type BottomTab = "table" | "matrix";
type RightTab = "charts" | "inspector";

export function DataScientistDemo({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => buildDataSciUGM(), []);
  const { theme, setTheme } = useThemeStore();
  const selected = useSelectionStore((s) => s.selectedNodeIds);
  const selectedId = [...selected][0] ?? null;

  const [encoding, setEncoding] = useState<EncodingConfig>({
    ...DEFAULT_ENCODING,
    nodeSizeProperty: "pagerank",
    nodeSizeRange: [14, 50],
    nodeColorProperty: "community",
  });
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [filterNodeIds, setFilterNodeIds] = useState<Set<string> | null>(null);
  const [neighborhoodUGM, setNeighborhoodUGM] = useState<UGM | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("table");
  const [rightTab, setRightTab] = useState<RightTab>("charts");
  const [cyInstance, setCyInstance] = useState<unknown>(null);

  const [eventBus] = useState(() => new G3tEventBus());
  const [menuManager] = useState(() => {
    const mgr = new ContextMenuManager();
    registerToolkitActions(mgr, {
      ugm,
      eventBus,
      onViewNeighbors: (nodeId, hops) => {
        setNeighborhoodUGM(buildNeighborhoodUGM(ugm, nodeId, hops));
      },
    });
    return mgr;
  });

  // Pipelines
  const countByType = useMemo(() => createCountByType(), []);
  const degreeVsPagerank = useMemo(
    () => createPropertyCorrelation("degree", "pagerank"),
    [],
  );

  // Filtered UGM (type filter + property filter)
  const filteredUGM = useMemo(() => {
    const f = new UGM();
    ugm.forEachNode((id, attrs) => {
      if (hiddenTypes.has(attrs.types[0] ?? "")) return;
      if (filterNodeIds !== null && !filterNodeIds.has(id)) return;
      f.addNode(id, { types: attrs.types, properties: attrs.properties });
    });
    ugm.forEachEdge((_eid, attrs, src, tgt) => {
      if (f.hasNode(src) && f.hasNode(tgt)) f.addEdge(src, tgt, attrs);
    });
    return f;
  }, [ugm, hiddenTypes, filterNodeIds]);

  const handleSearch = useCallback((_r: SearchResult) => {}, []);
  const handleFilterApply = useCallback(
    (ids: Set<string>) => {
      setFilterNodeIds(ids.size === ugm.nodeCount ? null : ids);
    },
    [ugm],
  );

  const cy = cyInstance as any; // eslint-disable-line

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
      {/* Toolbar */}
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
            background: "#06b6d4",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          Data Scientist Dashboard
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--g3t-text-muted)" }}>
          {filteredUGM.nodeCount} / {ugm.nodeCount} nodes visible
        </span>
        <div className="g3t-divider" />
        <select
          className="g3t-select"
          value={theme.id}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="high-contrast">High Contrast</option>
        </select>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Search + Filter + Encoding */}
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
            <SearchBar ugm={ugm} onSearchChange={handleSearch} />
          </div>
          <div
            style={{ padding: 8, borderBottom: "1px solid var(--g3t-border)" }}
          >
            <div className="g3t-panel-title">Property Filter</div>
            <FilterBuilder ugm={ugm} onApply={handleFilterApply} />
          </div>
          <div
            style={{ padding: 8, borderBottom: "1px solid var(--g3t-border)" }}
          >
            <FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
          </div>
          <div style={{ padding: 8 }}>
            <div className="g3t-panel-title">Encoding</div>
            <EncodingPanel
              ugm={ugm}
              encoding={encoding}
              onChange={setEncoding}
            />
          </div>
        </div>

        {/* Center: Graph */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, position: "relative", minHeight: 200 }}>
            <CytoscapeCanvas
              ugm={filteredUGM}
              menuManager={menuManager}
              onReady={(c) => setCyInstance(c)}
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
              <CanvasLegend ugm={filteredUGM} encoding={encoding} />
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
            {neighborhoodUGM && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 300,
                  height: 240,
                  zIndex: 10,
                  border: "2px solid #06b6d4",
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
                  <span>Neighborhood</span>
                  <button
                    className="g3t-btn g3t-btn-ghost"
                    onClick={() => setNeighborhoodUGM(null)}
                    style={{ fontSize: 14, padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
                <CytoscapeCanvas ugm={neighborhoodUGM} />
              </div>
            )}
          </div>

          {/* Bottom: Table + Matrix */}
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
              {(["table", "matrix"] as BottomTab[]).map((t) => (
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
                  ugm={filteredUGM}
                  menuManager={menuManager}
                  pageSize={6}
                />
              )}
              {bottomTab === "matrix" && <MatrixView ugm={filteredUGM} />}
            </div>
          </div>
        </div>

        {/* Right: Charts + Inspector */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            borderLeft: "1px solid var(--g3t-border)",
            background: "var(--g3t-bg-secondary)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--g3t-border)",
            }}
          >
            {(["charts", "inspector"] as RightTab[]).map((t) => (
              <button
                key={t}
                className={`g3t-btn ${rightTab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                onClick={() => setRightTab(t)}
                style={{
                  flex: 1,
                  borderRadius: 0,
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {rightTab === "charts" && (
              <>
                <div className="g3t-panel-title">Node Types</div>
                <LinkedChart
                  ugm={filteredUGM}
                  pipeline={countByType}
                  type="bar"
                  height={160}
                />
                <div className="g3t-panel-title" style={{ marginTop: 12 }}>
                  Degree vs PageRank
                </div>
                <LinkedChart
                  ugm={filteredUGM}
                  pipeline={degreeVsPagerank}
                  type="scatter"
                  height={180}
                />
              </>
            )}
            {rightTab === "inspector" && (
              <DetailInspector
                ugm={filteredUGM}
                selection={selectedId ? { type: "node", id: selectedId } : null}
              />
            )}
          </div>
        </div>
      </div>

      <StatusBar ugm={filteredUGM} zoomLevel={1.0} />
    </div>
  );
}
