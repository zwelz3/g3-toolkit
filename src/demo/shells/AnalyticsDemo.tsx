/**
 * D7: Graph Analytics Workbench.
 *
 * Full pipeline: schema → projection → algorithms → charts → sankey → matrix.
 * Layout: left=schema+filter | center=graph | right=charts | bottom=table+matrix+sankey+query
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { CytoscapeCanvas } from "@g3t/react";
import { TableView } from "@g3t/react";
import { SchemaView } from "@g3t/react";
import { MatrixView } from "@g3t/react";
import { SankeyView } from "@g3t/react";
import { QueryEditor } from "@g3t/react";
import { ZoomControls, StatusBar } from "@g3t/react";
import {
  EncodingPanel,
  CanvasLegend,
  DEFAULT_ENCODING,
  encodingToCytoscapeStyle,
} from "@g3t/react";
import { FacetFilter } from "@g3t/react";
import { FilterBuilder } from "@g3t/react";
import { SearchBar } from "@g3t/react";
import { LinkedChart } from "@g3t/charts";
import { useSelectionStore } from "@g3t/react";
import { useThemeStore } from "@g3t/react";
import { ContextMenuManager } from "@g3t/react";
import { G3tEventBus } from "@g3t/core";
import {
  registerToolkitActions,
  buildNeighborhoodUGM,
  wireCytoscapeContextActions,
} from "@g3t/react";
import { createCountByProperty, createPropertyCorrelation } from "@g3t/core";
import { UGM } from "@g3t/core";
import { buildAnalyticsUGM } from "../fixtures/analytics";
import type { EncodingConfig } from "@g3t/react";
import type { SearchResult } from "@g3t/react";

type BottomTab = "table" | "matrix" | "sankey" | "query";
type LeftTab = "schema" | "filter" | "encoding";

export function AnalyticsDemo({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => buildAnalyticsUGM(), []);
  const { theme, setTheme } = useThemeStore();
  // const selected = useSelectionStore((s) => s.selectedNodeIds);
  // const selectedId = [...selected][0] ?? null;

  const [encoding, setEncoding] = useState<EncodingConfig>({
    ...DEFAULT_ENCODING,
    nodeSizeProperty: "pagerank",
    nodeSizeRange: [12, 48],
    nodeColorProperty: "community",
  });

  // Bugfix 9: apply encoding to canvas (see DataScientistDemo for rationale)
  const encodingStylesheet = useMemo(
    () =>
      encodingToCytoscapeStyle(
        encoding,
        ugm,
        theme.typePalette,
      ) as unknown as Parameters<typeof CytoscapeCanvas>[0]["stylesheet"],
    [encoding, ugm, theme.typePalette],
  );
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [filterNodeIds, setFilterNodeIds] = useState<Set<string> | null>(null);
  const [neighborhoodUGM, setNeighborhoodUGM] = useState<UGM | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("table");
  const [leftTab, setLeftTab] = useState<LeftTab>("schema");
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

  const papersByTopic = useMemo(() => createCountByProperty("name"), []);
  const pagerankVsCitations = useMemo(
    () => createPropertyCorrelation("pagerank", "citations"),
    [],
  );

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
            background: "#8b5cf6",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          Graph Analytics Workbench
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--g3t-text-muted)" }}>
          {filteredUGM.nodeCount} nodes | {filteredUGM.edgeCount} edges
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
        {/* Left */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: "1px solid var(--g3t-border)",
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
            {(["schema", "filter", "encoding"] as LeftTab[]).map((t) => (
              <button
                key={t}
                className={`g3t-btn ${leftTab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                onClick={() => setLeftTab(t)}
                style={{
                  flex: 1,
                  borderRadius: 0,
                  fontSize: 11,
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ padding: 8 }}>
            <SearchBar
              ugm={ugm}
              onSearchChange={(r: SearchResult) => {
                // Bugfix 10: actually wire search to the graph view.
                // Select matches as the user types; ignore empty-query
                // events so the user's previous selection isn't blown
                // away when they clear the box.
                if (r.matchingIds.length > 0) {
                  useSelectionStore.getState().selectNodes(r.matchingIds);
                }
              }}
            />
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
            {leftTab === "schema" && <SchemaView ugm={filteredUGM} />}
            {leftTab === "filter" && (
              <>
                <FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
                <div style={{ marginTop: 8 }}>
                  <FilterBuilder ugm={ugm} onApply={handleFilterApply} />
                </div>
              </>
            )}
            {leftTab === "encoding" && (
              <EncodingPanel
                ugm={ugm}
                encoding={encoding}
                onChange={setEncoding}
              />
            )}
          </div>
        </div>

        {/* Center: Graph */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, position: "relative", minHeight: 200 }}>
            <CytoscapeCanvas
              ugm={filteredUGM}
              menuManager={menuManager}
              stylesheet={encodingStylesheet}
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
                  width: 320,
                  height: 260,
                  zIndex: 10,
                  border: "2px solid #8b5cf6",
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
                  <span>Co-author Network</span>
                  <button
                    className="g3t-btn g3t-btn-ghost"
                    onClick={() => setNeighborhoodUGM(null)}
                    style={{ fontSize: 14, padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
                <CytoscapeCanvas ugm={neighborhoodUGM} layout="breadthfirst" />
              </div>
            )}
          </div>

          {/* Bottom tabs */}
          <div
            style={{
              height: 240,
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
              {(["table", "matrix", "sankey", "query"] as BottomTab[]).map(
                (t) => (
                  <button
                    key={t}
                    className={`g3t-btn ${bottomTab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                    onClick={() => setBottomTab(t)}
                    style={{ borderRadius: 0, textTransform: "capitalize" }}
                  >
                    {t}
                  </button>
                ),
              )}
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
              {bottomTab === "sankey" && <SankeyView ugm={filteredUGM} />}
              {bottomTab === "query" && (
                <QueryEditor defaultLanguage="sparql" />
              )}
            </div>
          </div>
        </div>

        {/* Right: Charts */}
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
          <div className="g3t-panel-title">Authors by Institution</div>
          <LinkedChart
            ugm={filteredUGM}
            pipeline={papersByTopic}
            type="bar"
            height={150}
          />
          <div className="g3t-panel-title" style={{ marginTop: 12 }}>
            PageRank vs Citations
          </div>
          <LinkedChart
            ugm={filteredUGM}
            pipeline={pagerankVsCitations}
            type="scatter"
            height={170}
          />
        </div>
      </div>

      <StatusBar ugm={filteredUGM} zoomLevel={1.0} />
    </div>
  );
}
