/**
 * D1: Healthcare Ontology Explorer.
 *
 * Tree linked to graph. SHACL validation. Domain icons.
 * Layout: left=tree+SHACL | center=graph+neighborhood | bottom=table | right=inspector
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { CytoscapeCanvas } from "@views/canvas";
import { TableView } from "@views/table";
import { DetailInspector } from "@views/inspector";
import { TreeView } from "@views/tree";
import { SchemaView } from "@views/schema";
import { ShaclShapeBrowser } from "@views/schema/ShaclShapeBrowser";
import {
  ZoomControls,
  StatusBar,
  KeyboardShortcutModal,
} from "@interaction/toolbar";
import { CanvasLegend, DEFAULT_ENCODING } from "@interaction/encoding";
import { FacetFilter } from "@interaction/filter";
import { SearchBar } from "@interaction/search";
import { useSelectionStore } from "@state/selection-store";
import { AnnotationPanel } from "@interaction/annotations";
import { PropertyEditor } from "@interaction/property-editor";
import { LayoutManager } from "@interaction/layout-manager";
import { useThemeStore } from "@theme/ThemeManager";
import { ContextMenuManager } from "@interaction/context-menu";
import { G3tEventBus } from "@core/event-bus";
import {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "@interaction/context-menu/toolkit-actions";
import { validateShacl } from "@core/shacl";
import { UGM } from "@core/ugm";
import {
  buildHealthcareUGM,
  HEALTHCARE_SHACL_SHAPES,
} from "../fixtures/healthcare";
import type { SearchResult } from "@interaction/search";

type LeftTab = "tree" | "shacl" | "filter";

export function HealthcareDemo({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => buildHealthcareUGM(), []);
  const { theme, setTheme } = useThemeStore();
  const selected = useSelectionStore((s) => s.selectedNodeIds);
  const selectedId = [...selected][0] ?? null;

  const [leftTab, setLeftTab] = useState<LeftTab>("tree");
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [neighborhoodUGM, setNeighborhoodUGM] = useState<UGM | null>(null);
  const [cyInstance, setCyInstance] = useState<unknown>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const validationResults = useMemo(
    () => validateShacl(ugm, HEALTHCARE_SHACL_SHAPES),
    [ugm],
  );

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

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "?") setShowShortcuts(true);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const filteredUGM = useMemo(() => {
    if (hiddenTypes.size === 0) return ugm;
    const f = new UGM();
    ugm.forEachNode((id, attrs) => {
      if (!hiddenTypes.has(attrs.types[0] ?? ""))
        f.addNode(id, { types: attrs.types, properties: attrs.properties });
    });
    ugm.forEachEdge((_eid, attrs, src, tgt) => {
      if (f.hasNode(src) && f.hasNode(tgt)) f.addEdge(src, tgt, attrs);
    });
    return f;
  }, [ugm, hiddenTypes]);

  const handleSearch = useCallback((_r: SearchResult) => {}, []);
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
            background: "#22c55e",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          Healthcare Ontology Explorer
        </span>
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
        {/* Left: Tree + SHACL + Filter */}
        <div
          style={{
            width: 260,
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
            {(["tree", "shacl", "filter"] as LeftTab[]).map((t) => (
              <button
                key={t}
                className={`g3t-btn ${leftTab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                onClick={() => setLeftTab(t)}
                style={{
                  flex: 1,
                  borderRadius: 0,
                  textTransform: "capitalize",
                  fontSize: 11,
                }}
              >
                {t === "shacl" ? "SHACL" : t}
              </button>
            ))}
          </div>
          <div style={{ padding: 8 }}>
            <SearchBar ugm={ugm} onSearchChange={handleSearch} />
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
            {leftTab === "tree" && (
              <TreeView ugm={filteredUGM} initialDepth={2} />
            )}
            {leftTab === "shacl" && (
              <ShaclShapeBrowser
                shapes={HEALTHCARE_SHACL_SHAPES}
                validationResults={validationResults}
              />
            )}
            {leftTab === "filter" && (
              <FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
            )}
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
                maxWidth: 180,
              }}
            >
              <CanvasLegend ugm={filteredUGM} encoding={DEFAULT_ENCODING} />
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
                  border: "2px solid #22c55e",
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
                  <span>Neighborhood View</span>
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

          {/* Bottom: Table */}
          <div
            style={{
              height: 220,
              borderTop: "1px solid var(--g3t-border)",
              overflow: "auto",
            }}
          >
            <TableView
              ugm={filteredUGM}
              menuManager={menuManager}
              pageSize={8}
            />
          </div>
        </div>

        {/* Right: Inspector */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            borderLeft: "1px solid var(--g3t-border)",
            background: "var(--g3t-bg-secondary)",
            overflow: "auto",
            padding: 12,
          }}
        >
          <div className="g3t-panel-title">Inspector</div>
          <DetailInspector
            ugm={filteredUGM}
            selection={selectedId ? { type: "node", id: selectedId } : null}
          />
        </div>
      </div>

      <StatusBar ugm={filteredUGM} zoomLevel={1.0} />
      <KeyboardShortcutModal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
