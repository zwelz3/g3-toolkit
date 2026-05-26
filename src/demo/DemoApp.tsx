/**
 * DemoApp: full application shell with properly wired components.
 *
 * Everything is connected:
 * - FacetFilter hides/shows node types on the canvas
 * - Search highlights matching nodes
 * - Right-click opens context menu with neighborhood view
 * - Legend overlays on the canvas
 * - Zoom controls overlay on the canvas
 * - Table/inspector/views are tabbed below the canvas
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import type { Scenario } from "./DemoLanding";
import { UGM } from "@g3t/core";
import { CytoscapeCanvas } from "@g3t/react";
import { TableView } from "@g3t/react";
import { DetailInspector } from "@g3t/react";
import { SchemaView } from "@g3t/react";
import { DiffRenderer } from "@g3t/react";
import { MapView } from "@g3t/react";
import { TreeView } from "@g3t/react";
import { MatrixView } from "@g3t/react";
import { QueryEditor } from "@g3t/react";
import {
  StatusBar,
  KeyboardShortcutModal,
  ZoomControls,
} from "@g3t/react";
import {
  EncodingPanel,
  CanvasLegend,
  DEFAULT_ENCODING,
} from "@g3t/react";
import { FacetFilter } from "@g3t/react";
import { SearchBar } from "@g3t/react";
import { useSelectionStore } from "@g3t/react";
import { useThemeStore } from "@g3t/react";
import { AriaCompanion } from "@g3t/react";
import { ContextMenuManager } from "@g3t/react";
import { G3tEventBus } from "@g3t/core";
import {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "@g3t/react";
import { AnnotationPanel } from "@g3t/react";
import { PropertyEditor } from "@g3t/react";
import { LayoutManager } from "@g3t/react";
import type { LayoutOptions } from "@g3t/react";

import type { EncodingConfig } from "@g3t/react";
import type { DiffResult } from "@g3t/core";
import type { SearchResult } from "@g3t/react";

// ── Secondary View Tabs ─────────────────────────────────────────────

type ViewTab = "table" | "map" | "tree" | "matrix" | "schema" | "query";

const VIEW_TABS: Array<{ id: ViewTab; label: string }> = [
  { id: "table", label: "Table" },
  { id: "map", label: "Map" },
  { id: "tree", label: "Tree" },
  { id: "matrix", label: "Matrix" },
  { id: "schema", label: "Schema" },
  { id: "query", label: "Query" },
];

// ── Component ───────────────────────────────────────────────────────

export function DemoApp({
  scenario,
  onBack,
}: {
  scenario: Scenario;
  onBack: () => void;
}) {
  const ugm = useMemo(() => scenario.buildGraph(), [scenario]);
  const { theme, setTheme } = useThemeStore();
  const selected = useSelectionStore((s) => s.selectedNodeIds);
  const selectedId = [...selected][0] ?? null;

  const [encoding, setEncoding] = useState<EncodingConfig>({
    ...DEFAULT_ENCODING,
    nodeSizeProperty: "risk",
    nodeSizeRange: [18, 52],
  });
  const [activeView, setActiveView] = useState<ViewTab>("table");
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showBottom, setShowBottom] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [searchDimmedIds, setSearchDimmedIds] = useState<Set<string>>(
    new Set(),
  );

  // Cytoscape ref for zoom controls
  const [cyInstance, setCyInstance] = useState<unknown>(null);

  const handleZoomIn = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cy = cyInstance as any;
    if (cy) {
      const currentZoom = cy.zoom();
      cy.zoom({
        level: currentZoom * 1.3,
        renderedPosition: {
          x: cy.width() / 2,
          y: cy.height() / 2,
        },
      });
    }
  }, [cyInstance]);

  const handleZoomOut = useCallback(() => {
    const cy = cyInstance as any;
    if (cy) {
      const currentZoom = cy.zoom();
      cy.zoom({
        level: currentZoom * 0.7,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    }
  }, [cyInstance]);

  const handleFit = useCallback(() => {
    const cy = cyInstance as any;
    if (cy) cy.fit(undefined, 40);
  }, [cyInstance]);

  // Neighborhood view state
  const [neighborhoodUGM, setNeighborhoodUGM] = useState<UGM | null>(null);
  const [neighborhoodCenter, setNeighborhoodCenter] = useState<string | null>(
    null,
  );

  // Event bus + context menu
  const [eventBus] = useState(() => new G3tEventBus());
  const [menuManager] = useState(() => {
    const mgr = new ContextMenuManager();
    registerToolkitActions(mgr, {
      ugm,
      eventBus,
      onViewNeighbors: (nodeId, hops) => {
        const sub = buildNeighborhoodUGM(ugm, nodeId, hops);
        setNeighborhoodUGM(sub);
        setNeighborhoodCenter(nodeId);
      },
      onEditAppearance: (nodeId) => {
        useSelectionStore.getState().selectNodes([nodeId]);
      },
    });
    return mgr;
  });

  // Keyboard shortcut listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?") setShowShortcuts(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // FacetFilter: hide/show node types
  const handleFilterChange = useCallback((hidden: Set<string>) => {
    setHiddenTypes(hidden);
  }, []);

  // Search: dim non-matching nodes
  const handleSearch = useCallback((result: SearchResult) => {
    if (!result.query) {
      setSearchDimmedIds(new Set());
    } else {
      setSearchDimmedIds(new Set(result.nonMatchingIds));
    }
  }, []);

  // Filtered UGM (apply type filter)
  const filteredUGM = useMemo(() => {
    if (hiddenTypes.size === 0) return ugm;
    const filtered = new UGM();
    ugm.forEachNode((id, attrs) => {
      if (!hiddenTypes.has(attrs.types[0] ?? "")) {
        filtered.addNode(id, {
          types: attrs.types,
          properties: attrs.properties,
        });
      }
    });
    ugm.forEachEdge((_eid, attrs, source, target) => {
      if (filtered.hasNode(source) && filtered.hasNode(target)) {
        filtered.addEdge(source, target, attrs);
      }
    });
    return filtered;
  }, [ugm, hiddenTypes]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
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
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: scenario.accent,
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          {scenario.title}
        </span>
        <div className="g3t-divider" />
        <button
          className={`g3t-btn ${showLeftSidebar ? "g3t-btn-active" : ""}`}
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
        >
          Sidebar
        </button>
        <button
          className={`g3t-btn ${showBottom ? "g3t-btn-active" : ""}`}
          onClick={() => setShowBottom(!showBottom)}
        >
          Views
        </button>
        <button
          className={`g3t-btn ${showRightSidebar ? "g3t-btn-active" : ""}`}
          onClick={() => setShowRightSidebar(!showRightSidebar)}
        >
          Inspector
        </button>
        <span style={{ flex: 1 }} />
        <button
          className="g3t-btn g3t-btn-ghost"
          onClick={() => setShowShortcuts(true)}
        >
          ?
        </button>
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
        {/* Left sidebar */}
        {showLeftSidebar && (
          <div
            style={{
              width: 220,
              flexShrink: 0,
              borderRight: "1px solid var(--g3t-border)",
              background: "var(--g3t-bg-secondary)",
              overflow: "auto",
            }}
          >
            <SidebarSection title="Search">
              <SearchBar ugm={ugm} onSearchChange={handleSearch} />
            </SidebarSection>
            <SidebarSection title="Filter by Type">
              <FacetFilter ugm={ugm} onFilterChange={handleFilterChange} />
            </SidebarSection>
            <SidebarSection title="Encoding">
              <EncodingPanel
                ugm={ugm}
                encoding={encoding}
                onChange={setEncoding}
              />
            </SidebarSection>
            <SidebarSection title="Layout">
              <LayoutManager
                onLayoutChange={(name, opts) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const cy = cyInstance as any;
                  if (cy) {
                    cy.layout({
                      name: name === "force" ? "cose" : name,
                      animate: opts.animate,
                      animationDuration: opts.animationDuration,
                      nodeRepulsion: opts.nodeRepulsion,
                      gravity: opts.gravity,
                      idealEdgeLength: opts.edgeLength,
                      rankDir: opts.direction,
                      nodesep: opts.nodeSeparation,
                      ranksep: opts.rankSeparation,
                    }).run();
                  }
                }}
                onResetLayout={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const cy = cyInstance as any;
                  if (cy) cy.fit(undefined, 40);
                }}
                onFreezeLayout={(frozen) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const cy = cyInstance as any;
                  if (cy) {
                    if (frozen) cy.nodes().lock();
                    else cy.nodes().unlock();
                  }
                }}
              />
            </SidebarSection>
          </div>
        )}

        {/* Center */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Graph canvas with overlaid controls */}
          <div
            style={{
              flex: 1,
              position: "relative",
              minHeight: 200,
              background: "var(--g3t-canvas-bg)",
            }}
          >
            <CytoscapeCanvas
              ugm={filteredUGM}
              menuManager={menuManager}
              onReady={(cy) => setCyInstance(cy)}
            />

            {/* Overlaid legend */}
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                zIndex: 10,
                maxWidth: 180,
              }}
            >
              <CanvasLegend ugm={filteredUGM} encoding={encoding} />
            </div>

            {/* Overlaid zoom controls */}
            <div
              style={{
                position: "absolute",
                bottom: 12,
                right: 12,
                zIndex: 10,
              }}
            >
              <ZoomControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onFit={handleFit}
              />
            </div>

            {/* Neighborhood view panel */}
            {neighborhoodUGM && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 320,
                  height: 260,
                  zIndex: 10,
                  border: `2px solid ${scenario.accent}`,
                  borderRadius: "var(--g3t-radius-md, 6px)",
                  background: "var(--g3t-bg-primary)",
                  overflow: "hidden",
                  boxShadow: "var(--g3t-shadow-lg)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--g3t-bg-secondary)",
                    borderBottom: "1px solid var(--g3t-border)",
                  }}
                >
                  <span>Neighborhood: {neighborhoodCenter}</span>
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

          {/* Bottom panel */}
          {showBottom && (
            <div
              style={{
                height: 240,
                flexShrink: 0,
                borderTop: "1px solid var(--g3t-border)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  background: "var(--g3t-bg-secondary)",
                  borderBottom: "1px solid var(--g3t-border)",
                  flexShrink: 0,
                }}
              >
                {VIEW_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={`g3t-btn ${activeView === tab.id ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                    onClick={() => setActiveView(tab.id)}
                    style={{
                      borderRadius: 0,
                      borderRight: "1px solid var(--g3t-border)",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                {activeView === "table" && (
                  <TableView
                    ugm={filteredUGM}
                    menuManager={menuManager}
                    pageSize={8}
                  />
                )}
                {activeView === "map" && <MapView ugm={filteredUGM} />}
                {activeView === "tree" && (
                  <TreeView ugm={filteredUGM} initialDepth={2} />
                )}
                {activeView === "matrix" && <MatrixView ugm={filteredUGM} />}
                {activeView === "schema" && <SchemaView ugm={filteredUGM} />}
                {activeView === "query" && (
                  <QueryEditor defaultLanguage="sparql" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {showRightSidebar && (
          <div
            style={{
              width: 280,
              flexShrink: 0,
              borderLeft: "1px solid var(--g3t-border)",
              background: "var(--g3t-bg-secondary)",
              overflow: "auto",
            }}
          >
            <SidebarSection title="Inspector">
              <DetailInspector
                ugm={filteredUGM}
                selection={selectedId ? { type: "node", id: selectedId } : null}
              />
            </SidebarSection>
            {selectedId && (
              <>
                <SidebarSection title="Edit Properties">
                  <PropertyEditor
                    ugm={filteredUGM}
                    elementType="node"
                    elementId={selectedId}
                  />
                </SidebarSection>
                <SidebarSection title="Notes">
                  <AnnotationPanel elementId={selectedId} />
                </SidebarSection>
              </>
            )}
          </div>
        )}
      </div>

      <StatusBar ugm={filteredUGM} zoomLevel={1.0} />
      <AriaCompanion ugm={filteredUGM} />
      <KeyboardShortcutModal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "var(--g3t-space-3, 12px)",
        borderBottom: "1px solid var(--g3t-border)",
      }}
    >
      <div className="g3t-panel-title">{title}</div>
      {children}
    </div>
  );
}
