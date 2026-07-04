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
import { useEffect, useMemo, useState } from "react";
import {
  CytoscapeCanvas,
  useSelectionStore,
  useOverlayStore,
  categoricalColorMap,
} from "@g3t/react";
import type { EncodingSpec } from "@g3t/react";
import { ingestAlgorithmResults } from "@g3t/core";
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
import { CapabilityCallout } from "../components/CapabilityCallout";

type Mode = "none" | ClusterMode;

const MODES: Array<{ key: Mode; label: string }> = [
  { key: "none", label: "Type" },
  { key: "region", label: "Region" },
  { key: "tier", label: "Tier" },
  { key: "component", label: "Component" },
];

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

  // Gap overlays are always active: risk is visible without interaction.
  useEffect(() => {
    const overlays = gapOverlays(findings);
    for (const o of overlays) useOverlayStore.getState().register(o, true);
    return () => {
      for (const o of overlays) useOverlayStore.getState().unregister(o.id);
    };
  }, [findings]);

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
        <div className="sc-modes" role="group" aria-label="Color by">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`sc-mode${mode === m.key ? " is-active" : ""}`}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="sc-body">
        <main className="sc-canvas-wrap">
          <CytoscapeCanvas ugm={ugm} encodingSpec={spec} />
        </main>

        <aside className="sc-sidebar">
          <div className="sc-panel-head">Provenance</div>
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
                const first = c.members[0];
                const swatch = first
                  ? (nodeColors.get(first) ?? "#475569")
                  : "#475569";
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
          <CapabilityCallout
            accent="#f4923b"
            items={[
              {
                mechanism: "encodingSpec",
                how: "drives node color from a materialized cluster property (ingestAlgorithmResults), so region / tier / component grouping is a restyle, not a rebuild.",
              },
              {
                mechanism: "useOverlayStore",
                how: "registers the merged SHACL + structural gap report as always-on severity overlays.",
              },
              {
                mechanism: "node-local SHACL",
                how: "checks cross-source facts (certificationStatus, supplierCount) derived during consolidation.",
              },
              {
                mechanism: "useSelectionStore",
                how: "highlights cluster members and the traced supplier-to-assembly path.",
              },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
