/**
 * D6: Auditor Provenance Certification.
 *
 * PROV-O timeline. SHACL validation. DiffRenderer placeholder.
 * Layout: left=timeline+SHACL | center=graph | right=inspector
 */

import { useState, useMemo, useEffect } from "react";
import { CytoscapeCanvas } from "@views/canvas";
import { TableView } from "@views/table";
import { DetailInspector } from "@views/inspector";
import { TreeView } from "@views/tree";
import { ShaclShapeBrowser } from "@views/schema/ShaclShapeBrowser";
import { ZoomControls, StatusBar } from "@interaction/toolbar";
import { CanvasLegend, DEFAULT_ENCODING } from "@interaction/encoding";
import { FacetFilter } from "@interaction/filter";
import { SearchBar } from "@interaction/search";
import { TemporalRangeFilter } from "@interaction/remaining-tickets";
import { useSelectionStore } from "@state/selection-store";
import { AnnotationPanel } from "@interaction/annotations";
import { PropertyEditor } from "@interaction/property-editor";
import { useThemeStore } from "@theme/ThemeManager";
import { ContextMenuManager } from "@interaction/context-menu";
import { G3tEventBus } from "@core/event-bus";
import {
  registerToolkitActions,
  buildNeighborhoodUGM,
} from "@interaction/context-menu/toolkit-actions";
import { validateShacl, type ShaclShape } from "@core/shacl";
import { extractProvOProperties } from "@core/advanced";
import { UGM } from "@core/ugm";
import { buildAuditorUGM, buildMBSEUGM } from "../fixtures/additional";

const AUDITOR_SHAPES: ShaclShape[] = [
  {
    id: "shape:entity-provenance",
    name: "Entity Provenance",
    targetClass: "Entity",
    description: "Every entity must have generation time.",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "prov:generatedAtTime",
        name: "Generated At",
        datatype: "date",
        minCount: 1,
      },
    ],
  },
  {
    id: "shape:activity-timing",
    name: "Activity Timing",
    targetClass: "Activity",
    description: "Every activity must have start and end time.",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "prov:startedAtTime",
        name: "Started At",
        datatype: "date",
        minCount: 1,
      },
      {
        path: "prov:endedAtTime",
        name: "Ended At",
        datatype: "date",
        minCount: 1,
      },
    ],
  },
];

type LeftTab = "timeline" | "shacl" | "filter";

export function AuditorDemo({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => {
    const u = buildAuditorUGM();
    extractProvOProperties(u);
    return u;
  }, []);
  const { theme, setTheme } = useThemeStore();
  const selected = useSelectionStore((s) => s.selectedNodeIds);
  const selectedId = [...selected][0] ?? null;

  const [leftTab, setLeftTab] = useState<LeftTab>("timeline");
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [neighborhoodUGM, setNeighborhoodUGM] = useState<UGM | null>(null);
  const [cyInstance, setCyInstance] = useState<unknown>(null);
  const [_timeRange, setTimeRange] = useState<{
    min: number;
    max: number;
  } | null>(null);

  const validationResults = useMemo(
    () => validateShacl(ugm, AUDITOR_SHAPES),
    [ugm],
  );

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
            background: "#ec4899",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          Auditor Provenance Certification
        </span>
        <span style={{ flex: 1 }} />
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
            {(["timeline", "shacl", "filter"] as LeftTab[]).map((t) => (
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
                {t === "shacl" ? "SHACL" : t}
              </button>
            ))}
          </div>
          <div style={{ padding: 8 }}>
            <SearchBar ugm={ugm} onSearchChange={() => {}} />
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
            {leftTab === "timeline" && (
              <>
                <div className="g3t-panel-title">Time Range</div>
                <TemporalRangeFilter
                  ugm={ugm}
                  timeProperty="prov:startedAtTime"
                  onChange={setTimeRange}
                />
                <div className="g3t-panel-title" style={{ marginTop: 12 }}>
                  Provenance Tree
                </div>
                <TreeView ugm={filteredUGM} initialDepth={3} />
              </>
            )}
            {leftTab === "shacl" && (
              <ShaclShapeBrowser
                shapes={AUDITOR_SHAPES}
                validationResults={validationResults}
              />
            )}
            {leftTab === "filter" && (
              <FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
            )}
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, position: "relative" }}>
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
                  width: 300,
                  height: 240,
                  zIndex: 10,
                  border: "2px solid #ec4899",
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
                  <span>Inputs/Outputs</span>
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
          <div
            style={{
              height: 200,
              borderTop: "1px solid var(--g3t-border)",
              overflow: "auto",
            }}
          >
            <TableView
              ugm={filteredUGM}
              menuManager={menuManager}
              pageSize={6}
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
    </div>
  );
}

/**
 * D2: MBSE Satellite System.
 *
 * Tree-primary. Graph is a dependency projection. Search navigates tree.
 * Layout: left=tree | center=graph+neighborhood | bottom=table | right=inspector
 */

export function MBSEDemo({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => buildMBSEUGM(), []);
  const { theme, setTheme } = useThemeStore();
  const selected = useSelectionStore((s) => s.selectedNodeIds);
  const selectedId = [...selected][0] ?? null;

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [neighborhoodUGM, setNeighborhoodUGM] = useState<UGM | null>(null);
  const [cyInstance, setCyInstance] = useState<unknown>(null);
  const [showTree, setShowTree] = useState(true);

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
            background: "#f97316",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "var(--g3t-font-sm)", fontWeight: 600 }}>
          MBSE Satellite System
        </span>
        <span style={{ flex: 1 }} />
        <button
          className={`g3t-btn ${showTree ? "g3t-btn-active" : ""}`}
          onClick={() => setShowTree(!showTree)}
        >
          Tree
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
        {showTree && (
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
                padding: 8,
                borderBottom: "1px solid var(--g3t-border)",
              }}
            >
              <SearchBar
                ugm={ugm}
                onSearchChange={() => {}}
                placeholder="Search blocks..."
              />
            </div>
            <div
              style={{
                padding: 8,
                borderBottom: "1px solid var(--g3t-border)",
              }}
            >
              <FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
              <div className="g3t-panel-title">System Hierarchy</div>
              <TreeView ugm={filteredUGM} initialDepth={3} />
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, position: "relative" }}>
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
                  border: "2px solid #f97316",
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
                  <span>Dependencies</span>
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
          <div
            style={{
              height: 200,
              borderTop: "1px solid var(--g3t-border)",
              overflow: "auto",
            }}
          >
            <TableView
              ugm={filteredUGM}
              menuManager={menuManager}
              pageSize={6}
            />
          </div>
        </div>

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
    </div>
  );
}
