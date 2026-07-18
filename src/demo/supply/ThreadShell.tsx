/**
 * Supply-chain digital-thread shell. The consolidated graph is the center;
 * the sidebar is where the thread's value shows. Node fill color is driven by
 * an encoding spec: by type by default, or by cluster (region / tier /
 * connected component) when a mode is chosen, which materializes a `cluster`
 * property and points the color channel at it. Gap findings are registered as
 * severity overlays, so violation and warning nodes carry emphasized borders
 * the moment the shell mounts. Selecting a cluster highlights its members;
 * picking a supplier traces and highlights its downstream path to assemblies.
 *
 * Rendering and interaction are browser-verified (headless container cannot
 * see the canvas); the data driving every panel comes from tested pure
 * functions (model, analytics, viz).
 */
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ContextMenuManager,
  createDefaultMenuManager,
  CytoscapeCanvas,
  Minimap,
  useEmphasisStore,
  useSelectionStore,
  useOverlayStore,
  categoricalColorMap,
  registerIcon,
  FloatingLegend,
} from "@g3t/react";
import type { EncodingSpec } from "@g3t/react";
import type { Core } from "cytoscape";
import { ingestAlgorithmResults, findShortestPath } from "@g3t/core";
import { buildDigitalThread } from "./model";
import { supplyShapes } from "./shapes";
import {
  analyzeGaps,
  clusterBy,
  tracePaths,
  type ClusterMode,
  type GapFinding,
} from "./analytics";
import {
  gapOverlays,
  sourceCounts,
  clusterMembers,
  tracePathOverlay,
  OVERLAY_PATH,
} from "./viz";
import { THREAD_STYLES } from "./thread-styles";
import { CapabilityBubble } from "../components/CapabilityCallout";
import { usePrefersReducedMotion } from "../components/usePrefersReducedMotion";
import { useHiddenSuppliersStore } from "./hidden-suppliers-store";
import { applyConfidenceDim, type ConfidenceCoreLike } from "./confidence-dim";

type Mode = "none" | ClusterMode;

// Consumer-readable grouping controls (review 5.8): each mode carries
// a one-line description rendered beside the radio, and "tier" is
// DEFINED rather than left as jargon.
const MODES: Array<{ key: Mode; label: string; desc: string }> = [
  { key: "none", label: "Type", desc: "One color per kind of entity." },
  {
    key: "region",
    label: "Region",
    desc: "Group suppliers by manufacturing region.",
  },
  {
    key: "tier",
    label: "Supplier tier",
    desc: "Tier 1 sells to us directly; tiers 2-3 are their upstream sources.",
  },
  {
    key: "component",
    label: "Connected group",
    desc: "Entities that trade with each other, named by their hub.",
  },
];

// Type icons (review 5.6, via the 4.4 icon channel and the 4.7 pin
// coexistence fix). Registered once at module load; the registry is
// the extension point this shell demonstrates. Shapes stay uniform;
// the glyph is the type signal.
registerIcon(
  "sc-supplier",
  '<path d="M3 20V9.5l5 3v-3l5 3V9.5l8-4.5v15H3z"/><path d="M7 16h2M12 16h2M17 16h2"/>',
);
registerIcon(
  "sc-part",
  '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
);
registerIcon(
  "sc-assembly",
  '<circle cx="12" cy="12" r="3.2"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2"/>',
);
registerIcon(
  "sc-product",
  '<path d="M20 12l-8 8-8-8V4h8l8 8z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
);
registerIcon(
  "sc-facility",
  '<rect x="5" y="8" width="14" height="12"/><path d="M5 8l7-5 7 5M9 12h2M13 12h2M9 16h2M13 16h2"/>',
);

const KIND_LABEL: Record<GapFinding["kind"], string> = {
  "sole-source": "Sole source",
  "single-point-of-failure": "Single point of failure",
  "missing-certification": "Missing certification",
  "incomplete-provenance": "Incomplete provenance",
};

function makeSpec(mode: Mode): EncodingSpec {
  return {
    version: 1,
    node: {
      color: {
        driver: mode === "none" ? "types" : "cluster",
        scale: {
          kind: "categorical",
          palette: "okabe-ito",
          overrides: { Other: "#475569" },
        },
      },
      label: { driver: "name" },
      // Review 5.6: the type reads as an ICON, stable across color
      // modes (cluster coloring recolors, the glyph still says what
      // each node IS).
      icon: {
        driver: "types",
        scale: {
          kind: "categorical",
          overrides: {
            Supplier: "sc-supplier",
            Part: "sc-part",
            Assembly: "sc-assembly",
            Product: "sc-product",
            Facility: "sc-facility",
          },
        },
      },
    },
    edge: { label: { driver: "type" } },
  };
}

export function SupplyThreadShell({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => buildDigitalThread(), []);
  const findings = useMemo(() => analyzeGaps(ugm, supplyShapes), [ugm]);
  const sources = useMemo(() => sourceCounts(ugm), [ugm]);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    ugm.forEachNode((id, attrs) => {
      const n = attrs.properties.name;
      m.set(id, typeof n === "string" ? n : id);
    });
    return m;
  }, [ugm]);

  const suppliers = useMemo(() => {
    const out: Array<{ id: string; name: string }> = [];
    ugm.forEachNode((id, attrs) => {
      if (attrs.types.includes("Supplier"))
        out.push({ id, name: nameMap.get(id) ?? id });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [ugm, nameMap]);

  const [mode, setMode] = useState<Mode>("none");
  const [supplier, setSupplier] = useState<string>("");
  // Cytoscape core from the canvas, feeding the Minimap overview inset
  // (disabled placeholder until the canvas is ready).
  const reducedMotion = usePrefersReducedMotion();
  const [core, setCore] = useState<Core | null>(null);
  const [routeStatus, setRouteStatus] = useState<string | null>(null);
  // Review 5.7: default shows everything at full strength; the
  // data-driven confidence dimming only appears via this explicit
  // control (see confidence-dim.ts for why a data patch, not a
  // bypass).
  const [dimByConfidence, setDimByConfidence] = useState(false);
  const confidenceOriginals = useRef(new Map<string, number>());
  useEffect(() => {
    if (!core) return;
    applyConfidenceDim(
      core as unknown as ConfidenceCoreLike,
      dimByConfidence,
      confidenceOriginals.current,
    );
  }, [core, dimByConfidence]);

  // Suppliers seed HIDDEN so "Expand suppliers" is real graph
  // expansion (review 3.8: the old action only grew the selection on
  // an already fully drawn graph, which read as a dead control). The
  // set lives in a store (not component state) because the menu
  // closures below read it at event time via getState(), mirroring
  // how they already read the selection store.
  const hiddenIds = useHiddenSuppliersStore((s) => s.hiddenIds);

  // Context menu: base copy plus two domain actions in supply terms.
  // "Expand suppliers" grows the selection by the node's direct
  // neighbors (impact spreading); "Shortest route" runs core
  // findShortestPath between the right-clicked node and the one other
  // selected node, then selects the route. No Inspect: this shell has
  // no property surface, and the base contract omits unwired items.
  const menuManager = useMemo(() => {
    const manager: ContextMenuManager = createDefaultMenuManager();
    manager.register("supply-analysis", [
      {
        id: "expand-suppliers",
        label: "Expand suppliers (1-hop)",
        icon: "\u2295",
        // Wired-or-absent: only offered when the node actually has
        // hidden supplier neighbors to reveal.
        filter: (t) =>
          t.type === "node" &&
          t.id !== undefined &&
          ugm
            .getNeighbors(t.id)
            .some((n) => useHiddenSuppliersStore.getState().hiddenIds.has(n)),
        action: (t) => {
          if (t.id === undefined) return;
          const revealed = ugm
            .getNeighbors(t.id)
            .filter((n) => useHiddenSuppliersStore.getState().hiddenIds.has(n));
          useHiddenSuppliersStore.getState().reveal(revealed);
          useSelectionStore.getState().addNodesToSelection(revealed);
        },
      },
      {
        id: "shortest-route",
        label: "Shortest route to selected",
        icon: "\u27f6",
        filter: (t) =>
          t.type === "node" &&
          [...useSelectionStore.getState().selectedNodeIds].filter(
            (id) => id !== t.id,
          ).length === 1,
        action: (t) => {
          if (t.id === undefined) return;
          const other = [
            ...useSelectionStore.getState().selectedNodeIds,
          ].filter((id) => id !== t.id)[0];
          if (other === undefined) return;
          const path = findShortestPath(ugm, t.id, other);
          if (path.found) {
            // Review 4.6: routes render as an emphasis EFFECT (amber
            // edges, dimmed complement), never as selection.
            useEmphasisStore
              .getState()
              .setPathEffect(
                path.nodeIds,
                path.edgeIds,
                `Route ${t.id} \u2192 ${other}`,
              );
            setRouteStatus(
              `Route ${t.id} \u2192 ${other}: ${path.length} hop(s)`,
            );
          } else {
            setRouteStatus(`No route from ${t.id} to ${other}`);
          }
        },
      },
    ]);
    return manager;
  }, [ugm]);

  // Cluster mode: materialize a `cluster` property on every node (overwriting
  // any prior mode's labels, with "Other" for nodes outside the clustering),
  // then point the color driver at it. Ingest and spec are computed in ONE
  // memo so the materialization always precedes the restyle that reads it
  // (the canvas restyles on the new spec identity after this render
  // commits). clusterBy is deterministic and the ingest idempotent per mode,
  // so a re-run is safe; spec was never state, it derives from mode.
  const spec = useMemo<EncodingSpec>(() => {
    if (mode !== "none") {
      const cmap = clusterBy(ugm, mode);
      const full = new Map<string, Record<string, unknown>>();
      ugm.forEachNode((id) =>
        full.set(id, { cluster: cmap.get(id) ?? "Other" }),
      );
      ingestAlgorithmResults(ugm, full);
    }
    return makeSpec(mode);
  }, [mode, ugm]);

  // 9.10 root cause (and the dominant source of the original 5.7
  // "most nodes muted" finding, which the confidence-edge fix only
  // partially addressed): these overlays registered ACTIVE, so the
  // overlay renderer dimmed every non-finding element at all times.
  // That presented as stuck emphasis, made the confidence-dim toggle
  // invisible beneath it, and muddied the legend. Same treatment as
  // the auditor (6.2): register INACTIVE; the chips in the Gaps
  // section are the explicit narrative controls.
  const overlays = useMemo(() => gapOverlays(findings), [findings]);
  useEffect(() => {
    for (const o of overlays) useOverlayStore.getState().register(o, false);
    return () => {
      for (const o of overlays) useOverlayStore.getState().unregister(o.id);
    };
  }, [overlays]);
  const activeOverlayIds = useOverlayStore((s) => s.activeIds);

  const paths = useMemo(
    () => (supplier ? tracePaths(ugm, supplier, "Assembly") : []),
    [ugm, supplier],
  );
  useEffect(() => {
    if (!supplier) return;
    const overlay = tracePathOverlay(ugm, paths);
    useOverlayStore.getState().register(overlay, true);
    return () => useOverlayStore.getState().unregister(OVERLAY_PATH);
  }, [ugm, supplier, paths]);

  const nodeColors = useMemo(() => categoricalColorMap(spec, ugm), [spec, ugm]);
  // Legend rows (review 5.8): the color driver's values with their
  // resolved swatches and member counts, adjacent to the grouping
  // controls that change them.
  const legendEntries = useMemo(() => {
    const byValue = new Map<string, { color: string; count: number }>();
    ugm.forEachNode((id, attrs) => {
      const value =
        mode === "none"
          ? (attrs.types[0] ?? "Unknown")
          : String(attrs.properties.cluster ?? "Other");
      const cur = byValue.get(value);
      if (cur) cur.count += 1;
      else
        byValue.set(value, {
          // 12.16 root cause: categoricalColorMap keys by the
          // driver's VALUES, not node ids; the id lookup missed on
          // every row and every swatch fell back to slate (the
          // reviewed rgb(71,85,105)).
          color: nodeColors.get(value) ?? "#475569",
          count: 1,
        });
    });
    return [...byValue.entries()]
      .map(([value, v]) => ({ value, ...v }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }, [ugm, mode, nodeColors]);
  const clusters = useMemo(
    () => (mode === "none" ? [] : clusterMembers(clusterBy(ugm, mode))),
    [ugm, mode],
  );

  const select = (ids: string[]) =>
    useSelectionStore.getState().selectNodes(ids);

  const sortedFindings = useMemo(
    () =>
      [...findings].sort((a, b) =>
        a.severity === b.severity ? 0 : a.severity === "violation" ? -1 : 1,
      ),
    [findings],
  );

  return (
    <div className="sc-shell">
      <style>{THREAD_STYLES}</style>

      <header className="sc-topbar">
        <button type="button" className="sc-back" onClick={onBack}>
          {"\u2190"} Scenarios
        </button>
        <div className="sc-wordmark">
          <b>Supply Thread</b>
          <span>consolidated sourcing graph</span>
        </div>
      </header>

      <div className="sc-body">
        <main className="sc-canvas-wrap">
          {/* 12.16: the canvas legend 4.3 asked for; never adopted
              here. Inline four-side offsets defeat the wrap's
              inset:0 stretch rule. */}
          <FloatingLegend ugm={ugm} spec={spec} />
          <CytoscapeCanvas
            ugm={ugm}
            // Review 5.6: the sourcing graph is a DAG (supplier ->
            // part -> assembly -> product); breadthfirst renders it
            // as readable tiers where fcose produced an undifferentiated
            // blob. Browser-verify item: tier spacing at real sizes.
            layout="breadthfirst"
            encodingSpec={spec}
            hidden={hiddenIds}
            onReady={setCore}
            animate={!reducedMotion}
            menuManager={menuManager}
          />
          {hiddenIds.size > 0 && (
            <div className="sc-route-status" data-testid="hidden-suppliers">
              {hiddenIds.size} supplier{hiddenIds.size === 1 ? "" : "s"} hidden.
              Right-click a part {"\u2192"} Expand suppliers, or{" "}
              <button
                type="button"
                data-testid="reveal-all-suppliers"
                onClick={() => useHiddenSuppliersStore.getState().revealAll()}
                style={{
                  font: "inherit",
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                reveal all
              </button>
              .
            </div>
          )}
          {routeStatus !== null && (
            <div className="sc-route-status" data-testid="route-status">
              {routeStatus}{" "}
              <button
                type="button"
                data-testid="clear-route"
                onClick={() => {
                  useEmphasisStore.getState().clear();
                  setRouteStatus(null);
                }}
                style={{
                  font: "inherit",
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                clear
              </button>
            </div>
          )}
          <div className="sc-minimap">
            <Minimap core={core} width={180} height={120} />
          </div>
        </main>

        <aside className="sc-sidebar">
          <div className="sc-panel-head">Legend &amp; grouping</div>
          <div className="sc-section" data-testid="sc-legend">
            {legendEntries.map((e) => (
              <div className="sc-src-row" key={e.value}>
                <span className="sc-swatch" style={{ background: e.color }} />
                <span className="sc-src-name">{e.value}</span>
                <span className="sc-count">{e.count}</span>
              </div>
            ))}
            <div
              role="radiogroup"
              aria-label="Color by"
              style={{ marginTop: 8 }}
            >
              {MODES.map((m) => (
                <label
                  key={m.key}
                  className="sc-src-row"
                  style={{ cursor: "pointer", alignItems: "baseline" }}
                >
                  <input
                    type="radio"
                    name="sc-color-mode"
                    checked={mode === m.key}
                    onChange={() => setMode(m.key)}
                    data-testid={`sc-mode-${m.key}`}
                  />
                  <span className="sc-src-name">
                    <b>{m.label}</b>
                    <span style={{ display: "block", opacity: 0.7 }}>
                      {m.desc}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label
              className="sc-src-row"
              style={{
                cursor: "pointer",
                alignItems: "baseline",
                marginTop: 6,
              }}
            >
              <input
                type="checkbox"
                checked={dimByConfidence}
                onChange={(e) => setDimByConfidence(e.target.checked)}
                data-testid="sc-dim-confidence"
              />
              <span className="sc-src-name">
                <b>Dim by record confidence</b>
                <span style={{ display: "block", opacity: 0.7 }}>
                  Supplies links come from merged procurement records (0.9
                  confidence); ownership and operation links are authoritative.
                  Off by default so nothing is faded without saying why.
                </span>
              </span>
            </label>
          </div>

          <div className="sc-panel-head">Entities per source</div>
          <div className="sc-section">
            {sources.map((s) => (
              <div className="sc-src-row" key={s.source}>
                <span className="sc-src-name">{s.source}</span>
                <span className="sc-count">{s.count}</span>
              </div>
            ))}
          </div>

          <div className="sc-panel-head">
            Clusters {mode === "none" ? "(choose a mode)" : ""}
          </div>
          <div className="sc-section">
            {clusters.length === 0 ? (
              <div className="sc-empty">
                Color by region, tier, or component to group nodes.
              </div>
            ) : (
              clusters.map((c) => {
                // 12.16: same value-vs-id bug as the legend rows; the
                // cluster's swatch is its VALUE's color.
                const swatch = nodeColors.get(c.label) ?? "#475569";
                return (
                  <button
                    type="button"
                    className="sc-cluster-row"
                    key={c.label}
                    onClick={() => select(c.members)}
                    title={`Highlight ${c.members.length} member(s)`}
                  >
                    <span
                      className="sc-swatch"
                      style={{ background: swatch }}
                    />
                    <span className="sc-cluster-label">{c.label}</span>
                    <span className="sc-cluster-count">{c.members.length}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="sc-panel-head">Gaps ({findings.length})</div>
          <div className="sc-section">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {overlays.map((o) => {
                const on = activeOverlayIds.includes(o.id);
                return (
                  <button
                    type="button"
                    key={o.id}
                    className={`sc-chip${on ? " sc-chip-on" : ""}`}
                    data-testid={`sc-ov-${o.id.split(".").pop()}`}
                    onClick={() => useOverlayStore.getState().toggle(o.id)}
                    title="Emphasizes these findings on the canvas; other elements dim while active"
                  >
                    {on ? "Hide" : "Highlight"} {o.label.toLowerCase()} on
                    canvas
                  </button>
                );
              })}
            </div>
            <p className="sc-empty" data-testid="sc-gap-provenance">
              How these are computed: graph analysis finds sole-source parts and
              single-point-of-failure suppliers; SHACL validation adds missing
              certifications and incomplete consolidated records.
            </p>
            {sortedFindings.map((f, i) => (
              <button
                type="button"
                className="sc-gap-row"
                key={`${f.nodeId}-${f.kind}-${i}`}
                onClick={() => select([f.nodeId])}
              >
                <span className={`sc-chip sc-chip-${f.severity}`}>
                  {f.severity === "violation" ? "VIOL" : "WARN"}
                </span>
                <span className="sc-gap-body">
                  <span className="sc-gap-kind">{KIND_LABEL[f.kind]}</span>
                  <span className="sc-gap-detail">{f.detail}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="sc-panel-head">Trace supply path</div>
          <div className="sc-section">
            <select
              className="sc-select"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">Select a supplier{"\u2026"}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="sc-path">
              {supplier && paths.length === 0 ? (
                <div className="sc-empty">No downstream assemblies found.</div>
              ) : (
                paths.map((p, i) => (
                  <div className="sc-path-line" key={i}>
                    <b>
                      {p.map((id) => nameMap.get(id) ?? id).join(" \u2192 ")}
                    </b>
                  </div>
                ))
              )}
            </div>
          </div>
          <CapabilityBubble
            accent="#f4923b"
            items={[
              {
                mechanism: "encodingSpec",
                anchor: "drive-the-encoding-from-app-state",
                how: "drives node color from a materialized cluster property (ingestAlgorithmResults), so region / tier / component grouping is a restyle, not a rebuild.",
              },
              {
                mechanism: "useOverlayStore",
                anchor: "register-an-algorithm-result-from-your-backend",
                how: "registers the merged SHACL + structural gap report as always-on severity overlays.",
              },
              {
                mechanism: "node-local SHACL",
                anchor:
                  "visualize-a-shacl-validation-report-over-the-data-graph",
                how: "checks cross-source facts (certificationStatus, supplierCount) derived during consolidation.",
              },
              {
                mechanism: "manager.register",
                anchor: "add-your-action-to-the-canvas-context-menu",
                how: "right-click a node: Expand suppliers grows the selection; with one other node selected, Shortest route runs findShortestPath and selects it.",
              },
              {
                mechanism: "Minimap",
                anchor: "camera-control",
                how: "overview inset fed by the canvas onReady core; its viewport rectangle tracks and drives the camera.",
              },
              {
                mechanism: "useSelectionStore",
                anchor: "select-and-focus-a-node-of-interest",
                how: "highlights cluster members and the traced supplier-to-assembly path.",
              },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
