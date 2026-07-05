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
 *  - AlgorithmPanel: run a graph algorithm; results are written onto
 *    node properties.
 *  - DerivedPropertyPanel: compute a derived property from an
 *    expression and make it available to the encoding/charts.
 *
 * Everything is linked through the shared selection store: select in
 * the canvas, the table, or a chart, and the rest follow.
 *
 * Reference code, not a shipped product.
 *
 * @see examples/decision-dashboards/README.md
 */

import { useMemo, useState, useEffect } from "react";
import {
  degreeCentrality,
  connectedComponents,
  ingestAlgorithmResults,
  createDegreeDistribution,
  createCentralityVsProperty,
  DerivedPropertyEngine,
  type UGM,
  G3tEventBus,
  findShortestPath,
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
  AlgorithmPanel,
  DerivedPropertyPanel,
  DEFAULT_ENCODING,
  fromLegacyConfig,
  type EncodingSpec,
} from "@g3t/react";
import { LinkedChart } from "@g3t/charts";
import { buildSupplyNetwork, originCoverageByTier } from "./supply-data";

type Tab = "degree" | "scatter" | "stats";

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

  // Re-render trigger after an algorithm/derived-property writes new
  // properties (UGM mutates in place; bump to recompute memos).
  const [revision, setRevision] = useState(0);
  const bump = () => setRevision((r) => r + 1);

  // Context menu: the FULL toolkit action set (registerToolkitActions),
  // with every event-emitting item consumed below; this capability
  // surface is where the everything-menu belongs, while the domain
  // shells register targeted picks. Inspect and Copy ID are part of
  // the set, so the base default manager is not layered on top (it
  // would duplicate them).
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [menuStatus, setMenuStatus] = useState<string | null>(null);
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
        const hood = neighborhood(nodeId, hops);
        useSelectionStore.getState().selectNodes([...hood]);
        setMenuStatus(
          `Neighborhood of ${nodeId} (${hops}-hop): ${hood.size} nodes selected`,
        );
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
        const path = findShortestPath(ugm, sourceId, targetId);
        if (path.found) {
          useSelectionStore.getState().selectNodes(path.nodeIds);
          setMenuStatus(
            `Path ${sourceId} \u2192 ${targetId}: ${path.length} hop(s)`,
          );
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

  const [engine] = useState(() => new DerivedPropertyEngine());

  // Size nodes by degree so centrality is visible on the canvas.
  const spec = useMemo<EncodingSpec>(
    () =>
      fromLegacyConfig({
        ...DEFAULT_ENCODING,
        nodeSizeProperty: "_degree",
        nodeSizeRange: [14, 48],
      }),
    [],
  );

  const degreePipeline = useMemo(() => createDegreeDistribution(), []);
  // Centrality vs a domain property (supply nodes carry a numeric
  // "risk"); revision keeps it fresh after metric writes.
  const scatterPipeline = useMemo(
    () => createCentralityVsProperty("_degree", "risk"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );

  const [tab, setTab] = useState<Tab>("degree");

  return (
    <div
      className={className}
      data-testid="analytics-dashboard"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 380px",
        gridTemplateRows: "minmax(0, 1fr) 240px",
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
        <CytoscapeCanvas
          ugm={ugm}
          encodingSpec={spec}
          menuManager={menuManager}
          hidden={hiddenIds}
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
              position: "absolute",
              top: 8,
              right: 8,
              width: 260,
              maxHeight: "70%",
              overflow: "auto",
              zIndex: 6,
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
        <div className="g3t-card" style={{ padding: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Graph algorithms</h3>
          <AlgorithmPanel ugm={ugm} onIngested={() => bump()} />
        </div>
        <div className="g3t-card" style={{ padding: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Derived property</h3>
          <DerivedPropertyPanel ugm={ugm} engine={engine} onCompute={bump} />
        </div>
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
          {(["degree", "scatter", "stats"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`g3t-btn ${tab === t ? "g3t-btn-active" : "g3t-btn-ghost"}`}
              onClick={() => setTab(t)}
            >
              {t === "degree"
                ? "Degree distribution (bar)"
                : t === "scatter"
                  ? "Centrality vs risk (scatter)"
                  : "Statistics"}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <div style={{ fontSize: 11, opacity: 0.6, alignSelf: "center" }}>
            rev {revision}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0, padding: 8 }}>
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
          <div
            style={{
              width: 360,
              borderLeft: "1px solid var(--g3t-border)",
              overflow: "auto",
            }}
          >
            <TableView ugm={ugm} density="compact" pageSize={6} />
          </div>
        </div>
      </section>
    </div>
  );
}
