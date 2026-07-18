/**
 * AnalyticsDashboard — the toolkit's ANALYTICAL surface, which the
 * scenario shells don't foreground.
 *
 * Where the four dev-server scenarios tell a domain story, this
 * dashboard is capability-first: it shows the pieces you reach for when
 * you want to understand a graph quantitatively.
 *
 *  - StatsPanel: a degree/metric histogram over the whole graph.
 *  - LinkedChart in its less-obvious forms: a BAR degree distribution
 *    and a SCATTER of centrality vs a domain property (the scenarios
 *    only ever show a pie).
 *    node properties.
 *    expression and make it available to the encoding/charts.
 *
 * Everything is linked through the shared selection store: select in
 * the canvas, the table, or a chart, and the rest follow.
 *
 * Reference code, not a shipped product.
 *
 * @see examples/decision-dashboards/README.md
 */

import type { Core } from "cytoscape";
import { useMemo, useState, useEffect } from "react";
import {
  degreeCentrality,
  connectedComponents,
  ingestAlgorithmResults,
  createDegreeDistribution,
  createCentralityVsProperty,
  type UGM,
  G3tEventBus,
  allShortestPaths,
} from "@g3t/core";
import {
  CoverageMeter,
  ContextMenuManager,
  registerToolkitActions,
  NodeStyleEditor,
  useSelectionStore,
  usePositionPinStore,
  CytoscapeCanvas,
  TableView,
  StatsPanel,
  DEFAULT_ENCODING,
  fromLegacyConfig,
  type EncodingSpec,
  useEmphasisStore,
  NeighborhoodPopout,
  NodePropertyInspector,
  MatrixView,
  SankeyView,
  GraphToolbar,
  FloatingPanel,
  categoricalColorMap,
} from "@g3t/react";
import { LinkedChart } from "@g3t/charts";
import { buildSupplyNetwork, originCoverageByTier } from "./supply-data";

type Tab = "degree" | "scatter" | "stats" | "matrix" | "sankey";

export interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  // Seed the graph with computed metrics so the analytical views have
  // real data the moment the dashboard opens (degree centrality +
  // connected components written onto node properties).
  const ugm = useMemo<UGM>(() => {
    const g = buildSupplyNetwork();
    const degree = degreeCentrality(g);
    const comp = connectedComponents(g);
    const results = new Map<string, Record<string, unknown>>();
    for (const id of g.getNodeIds()) {
      results.set(id, {
        _degree: degree.get(id) ?? 0,
        _component: comp.get(id) ?? 0,
      });
    }
    ingestAlgorithmResults(g, results);
    return g;
  }, []);

  // Context menu: the FULL toolkit action set (registerToolkitActions),
  // with every event-emitting item consumed below; this capability
  // surface is where the everything-menu belongs, while the domain
  // shells register targeted picks. Inspect and Copy ID are part of
  // the set, so the base default manager is not layered on top (it
  // would duplicate them).
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [menuStatus, setMenuStatus] = useState<string | null>(null);
  const [core, setCore] = useState<Core | null>(null);
  // 9.17: the path effect needs a visible exit; the chip renders
  // whenever the emphasis layer is active.
  const emphasisActive = useEmphasisStore((s) => s.active);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const { menuManager, bus } = useMemo(() => {
    const eventBus = new G3tEventBus();
    const manager = new ContextMenuManager();
    registerToolkitActions(manager, { ugm, eventBus, defaultHops: 2 });
    return { menuManager: manager, bus: eventBus };
  }, [ugm]);

  // Event consumers: every emit-only action lands somewhere visible.
  useEffect(() => {
    const all = () => new Set(ugm.getNodeIds());
    // k-hop neighborhood over the UGM (breadth-first, hops bounded).
    const neighborhood = (rootId: string, hops: number): Set<string> => {
      const seen = new Set([rootId]);
      let frontier = [rootId];
      for (let h = 0; h < hops; h++) {
        const next: string[] = [];
        for (const id of frontier) {
          for (const n of ugm.getNeighbors(id)) {
            if (!seen.has(n)) {
              seen.add(n);
              next.push(n);
            }
          }
        }
        frontier = next;
      }
      return seen;
    };
    const unsubs = [
      bus.on("context:viewNeighbors", (d) => {
        const { nodeId, hops } = d as { nodeId: string; hops: number };
        setNeighborsOf({ nodeId, hops });
        setMenuStatus(`Neighborhood popout: ${nodeId}`);
      }),
      bus.on("context:inspect", (d) => {
        const { nodeId } = d as { nodeId: string };
        setInspected(nodeId);
      }),
      bus.on("context:focusNode", (d) => {
        const { nodeId, hops } = d as { nodeId: string; hops: number };
        const hood = neighborhood(nodeId, hops);
        const hidden = new Set([...all()].filter((id) => !hood.has(id)));
        setHiddenIds(hidden);
        setMenuStatus(
          `Focused on ${nodeId} (${hops}-hop): ${hidden.size} nodes hidden`,
        );
      }),
      bus.on("context:hideNodes", (d) => {
        const { nodeIds } = d as { nodeIds: string[] };
        setHiddenIds((prev) => new Set([...prev, ...nodeIds]));
        setMenuStatus(`Hidden: ${nodeIds.join(", ")}`);
      }),
      bus.on("context:viewSubgraph", (d) => {
        const { nodeIds } = d as { nodeIds: string[] };
        const keep = new Set(nodeIds);
        setHiddenIds(new Set([...all()].filter((id) => !keep.has(id))));
        setMenuStatus(`Subgraph view: ${nodeIds.length} selected nodes`);
      }),
      bus.on("context:findPath", (d) => {
        const { sourceId, targetId } = d as {
          sourceId: string;
          targetId: string;
        };
        // 9.17: the UNION of all shortest routes, not one arbitrary
        // representative (the singular finder made this a one-path
        // demo by construction). The count caps at 50 to keep the
        // label honest on dense graphs.
        const path = allShortestPaths(ugm, sourceId, targetId);
        if (path.found) {
          // Review 4.6: a path is an EFFECT, not a selection. Edges
          // along it emphasize, everything else dims, and the nodes
          // stay unstyled so the result cannot read as selected.
          const countLabel =
            path.pathCount >= 50 ? "50+" : String(path.pathCount);
          const label = `${countLabel} shortest path(s) ${sourceId} \u2192 ${targetId}: ${path.length} hop(s)`;
          useEmphasisStore
            .getState()
            .setPathEffect(path.nodeIds, path.edgeIds, label);
          setMenuStatus(label);
        } else {
          setMenuStatus(`No path from ${sourceId} to ${targetId}`);
        }
      }),
      bus.on("context:editAppearance", (d) => {
        setEditNodeId((d as { nodeId: string }).nodeId);
      }),
      bus.on("context:pinNodes", (d) => {
        const { nodeIds } = d as { nodeIds: string[] };
        for (const id of nodeIds) usePositionPinStore.getState().toggle(id);
        setMenuStatus(`Toggled pin: ${nodeIds.join(", ")}`);
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [bus, ugm]);

  // Reviews 5.1/5.2: every demonstration has a visible consequence,
  // wired through the encoding spec. Size follows the last computed
  // numeric property (degree by default, or a derived property);
  // color switches to _component after the components demo. The
  // reset chip returns both to defaults.
  const [sizeKey, setSizeKey] = useState("_degree");
  const [colorKey, setColorKey] = useState<string | null>(null);
  const spec = useMemo<EncodingSpec>(() => {
    const base = fromLegacyConfig({
      ...DEFAULT_ENCODING,
      nodeSizeProperty: sizeKey,
      nodeSizeRange: [14, 48],
    });
    if (colorKey === null) return base;
    return {
      ...base,
      node: {
        ...base.node,
        color: {
          driver: colorKey,
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
      },
    };
  }, [sizeKey, colorKey]);
  const styledOffDefault = sizeKey !== "_degree" || colorKey !== null;

  const degreePipeline = useMemo(() => createDegreeDistribution(), []);
  // Centrality vs a domain property (supply nodes carry a numeric
  // "risk"). 12.6 removed the property-writing panels, so the
  // pipeline is static (degree ingests once at mount).
  const scatterPipeline = useMemo(
    () => createCentralityVsProperty("_degree", "risk"),
    [],
  );
  const nodeColors = useMemo(() => categoricalColorMap(spec, ugm), [ugm]);

  const [tab, setTab] = useState<Tab>("degree");
  // Review 4.10: "View Neighbors" opens a floating second graph view
  // instead of selecting the whole neighborhood on the main canvas.
  const [neighborsOf, setNeighborsOf] = useState<{
    nodeId: string;
    hops: number;
  } | null>(null);
  // Review 4.11: "Inspect" opens an actual inspector panel.
  const [inspected, setInspected] = useState<string | null>(null);

  return (
    <div
      className={className}
      data-testid="analytics-dashboard"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 380px",
        // Review 5.4: the data row is HALF the window, not a 240px strip.
        gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 12,
        height: "100%",
        minHeight: 0,
        color: "var(--g3t-text-primary)",
      }}
    >
      {/* Canvas (top-left) */}
      <section
        style={{
          minWidth: 0,
          minHeight: 0,
          border: "1px solid var(--g3t-border)",
          borderRadius: 8,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Checklist line 50 (traceability sweep 2026-07-07): basic
            graph controls were asked for on THIS surface; Round 2
            adopted the toolbar on the workbench and scale only. */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 20,
          }}
        >
          <GraphToolbar ugm={ugm} cy={core} />
        </div>
        <CytoscapeCanvas
          ugm={ugm}
          encodingSpec={spec}
          menuManager={menuManager}
          hidden={hiddenIds}
          onReady={setCore}
        />
        {(menuStatus !== null || hiddenIds.size > 0) && (
          <div
            data-testid="menu-status"
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 11,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            <span>{menuStatus}</span>
            {emphasisActive && (
              <button
                type="button"
                data-testid="clear-path"
                onClick={() => {
                  useEmphasisStore.getState().clear();
                  setMenuStatus(null);
                }}
                style={{
                  font: "inherit",
                  fontSize: 11,
                  padding: "1px 8px",
                  border: "1px solid #f08c00",
                  borderRadius: 4,
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Clear path
              </button>
            )}
            {hiddenIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setHiddenIds(new Set());
                  setMenuStatus(null);
                }}
                style={{
                  font: "inherit",
                  fontSize: 11,
                  cursor: "pointer",
                  border: "1px solid #fff",
                  borderRadius: 3,
                  background: "transparent",
                  color: "inherit",
                  padding: "1px 6px",
                }}
              >
                Show all ({hiddenIds.size} hidden)
              </button>
            )}
          </div>
        )}
        {editNodeId !== null && (
          <div
            data-testid="dashboard-style-editor"
            style={{
              // Review 4.13: the absolute-in-section placement could
              // clip against the overflow-hidden canvas section and
              // abut the right panel. Fixed positioning escapes
              // ancestor clipping; the right offset clears the
              // 380px panel plus the grid gap by construction.
              position: "fixed",
              top: 72,
              right: 404,
              width: 260,
              maxWidth: "calc(100vw - 420px)",
              maxHeight: "70vh",
              overflow: "auto",
              zIndex: 30,
            }}
          >
            <NodeStyleEditor
              ugm={ugm}
              nodeId={editNodeId}
              onClose={() => setEditNodeId(null)}
            />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            fontSize: 12,
            opacity: 0.75,
          }}
        >
          {ugm.getNodeIds().length} nodes · sized by degree centrality
        </div>
        {inspected !== null && (
          <FloatingPanel
            testId="dashboard-inspector"
            corner="top-right"
            positioning="absolute"
            onClose={() => setInspected(null)}
            closeTestId="inspector-close"
            header={<strong>Inspector</strong>}
          >
            {/* 12.11: no sizing wrapper (the reviewed box was too
                small); the inspector renders at its natural width
                and the panel scrolls. Type chip colors come from the
                SURFACE's categorical map so they match the graph. */}
            <div style={{ maxHeight: 340, overflow: "auto" }}>
              <NodePropertyInspector
                ugm={ugm}
                selection={{ type: "node", id: inspected }}
                typeColorOf={(t) => nodeColors.get(t)}
              />
            </div>
          </FloatingPanel>
        )}
        {neighborsOf !== null && (
          <NeighborhoodPopout
            ugm={ugm}
            focusId={neighborsOf.nodeId}
            // 9.20: always start at ONE hop; the stepper widens.
            defaultHops={1}
            positioning="absolute"
            onClose={() => setNeighborsOf(null)}
          />
        )}
      </section>

      {/* Right rail: run algorithms / derive properties */}
      <aside
        style={{
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "auto",
        }}
      >
        {/* 12.6 (Zach's 9.6 ruling): the algorithm and
            derived-property demonstration cards stayed unhelpful
            through two review passes and are REMOVED from this
            surface; the components live on in the toolkit and the
            wiring guide. Origin coverage is the rail's one story. */}
        <div className="g3t-card" style={{ padding: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>
            Origin coverage by tier
          </h3>
          <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.75 }}>
            Share of each tier with a declared country of origin. The ghost bar
            is the claimable extent; the band between is exposure (claimed
            supply base without geographic substantiation).
          </p>
          {originCoverageByTier(ugm).map((c) => (
            <CoverageMeter
              key={c.tier}
              label={`${c.tier} (${c.total})`}
              substantiated={c.substantiated}
              claimable={1}
              state={
                c.substantiated >= 1
                  ? "discriminator"
                  : c.substantiated > 0
                    ? "exposed"
                    : "gap"
              }
              animate={false}
              testId={`origin-coverage-${c.tier}`}
            />
          ))}
        </div>
      </aside>

      {/* Charts / stats (bottom, spans both columns) */}
      <section
        style={{
          gridColumn: "1 / -1",
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--g3t-border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 8,
            borderBottom: "1px solid var(--g3t-border)",
          }}
        >
          {(["degree", "scatter", "stats", "matrix", "sankey"] as Tab[]).map(
            (t) => (
              <button
                key={t}
                className={`g3t-btn ${tab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                onClick={() => setTab(t)}
              >
                {t === "degree"
                  ? "Degree distribution (bar)"
                  : t === "scatter"
                    ? "Centrality vs risk (scatter)"
                    : t === "stats"
                      ? "Statistics"
                      : t === "matrix"
                        ? "Adjacency matrix"
                        : "Type flows (sankey)"}
              </button>
            ),
          )}
          <span style={{ flex: 1 }} />
        </div>
        {tab === "matrix" || tab === "sankey" ? (
          // Relocated from the retired Schema Dashboard (ruling 8.4):
          // structure-shaped views take the full row.
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 8 }}>
            {tab === "matrix" ? (
              <MatrixView ugm={ugm} />
            ) : (
              <SankeyView ugm={ugm} mode="sankey" />
            )}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <div
              style={{
                flex: "0 0 40%",
                minWidth: 0,
                padding: 8,
                overflow: "auto",
              }}
            >
              {tab === "degree" && (
                <LinkedChart
                  ugm={ugm}
                  pipeline={degreePipeline}
                  type="bar"
                  height={180}
                />
              )}
              {tab === "scatter" && (
                <LinkedChart
                  ugm={ugm}
                  pipeline={scatterPipeline}
                  type="scatter"
                  height={180}
                />
              )}
              {tab === "stats" && (
                <StatsPanel ugm={ugm} propertyKey="_degree" bins={16} />
              )}
            </div>
            {/* Review 5.4: the table is the primary reading surface;
                it takes the remaining ~60% of the full-width row. */}
            <div
              data-testid="analytics-table-pane"
              style={{
                flex: 1,
                minWidth: 0,
                borderLeft: "1px solid var(--g3t-border)",
                overflow: "auto",
              }}
            >
              <TableView ugm={ugm} density="compact" pageSize={12} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
