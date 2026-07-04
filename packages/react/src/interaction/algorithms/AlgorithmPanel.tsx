/**
 * AlgorithmPanel: the controls for the algorithm story (round 21).
 *
 * Three sections, matching the architecture:
 * - RUN: reference built-ins (components, degree, shortest path) so
 *   the panel works without a backend. Property-shaped results
 *   ingest into the UGM (the encoding grammar drives channels from
 *   them); the path runner produces a structural OVERLAY.
 * - OVERLAYS: the registry with independent toggles; deactivating
 *   everything restores the canvas exactly.
 * - INGEST: paste an algorithm-result document (the interchange
 *   contract: networkx, GraphBLAS, anything) and apply it; parse
 *   failures surface verbatim, like SpecPort.
 */

import { useState } from "react";
import type { UGM } from "@g3t/core";
import {
  parseAlgorithmResult,
  applyAlgorithmResult,
  ingestAlgorithmResults,
  overlayFromPath,
  findShortestPath,
  connectedComponents,
  degreeCentrality,
} from "@g3t/core";
import { useOverlayStore } from "../../state/overlay-store";

export interface AlgorithmPanelProps {
  ugm: UGM;
  /** Seed the ingest textarea (demos, host-provided examples). */
  initialJson?: string;
  /** Property-shaped results mutate the UGM in place; this fires
   *  afterward with the written property keys so the host can wire
   *  visible consequences (e.g. drive the encoding spec's color from
   *  a freshly written _component, or size from _degree: round-25
   *  finding 3, runners must not be silent). */
  onIngested?: (summary: string, propertyKeys?: string[]) => void;
  className?: string;
}

export function AlgorithmPanel({
  ugm,
  initialJson,
  onIngested,
  className,
}: AlgorithmPanelProps) {
  const overlays = useOverlayStore((s) => s.overlays);
  const activeIds = useOverlayStore((s) => s.activeIds);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [ingestJson, setIngestJson] = useState(initialJson ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nodeIds: string[] = [];
  ugm.forEachNode((id) => {
    nodeIds.push(id);
  });

  const report = (s: string, propertyKeys?: string[]) => {
    setStatus(s);
    setError(null);
    onIngested?.(s, propertyKeys);
  };

  return (
    <div className={className} data-testid="g3t-algorithm-panel">
      <div className="g3t-panel-section-header">run (reference built-ins)</div>
      <div className="va-row" style={{ flexWrap: "wrap", gap: 6 }}>
        <button
          className="g3t-btn"
          data-testid="algo-components"
          onClick={() => {
            const result = connectedComponents(ugm);
            ingestAlgorithmResults(
              ugm,
              new Map([...result].map(([id, c]) => [id, { _component: c }])),
            );
            report(
              `components: ${new Set(result.values()).size} found, written to _component`,
              ["_component"],
            );
          }}
        >
          Connected components
        </button>
        <button
          className="g3t-btn"
          data-testid="algo-degree"
          onClick={() => {
            const result = degreeCentrality(ugm);
            ingestAlgorithmResults(
              ugm,
              new Map([...result].map(([id, d]) => [id, { _degree: d }])),
            );
            report("degree centrality written to _degree", ["_degree"]);
          }}
        >
          Degree centrality
        </button>
      </div>
      <div className="va-row" style={{ marginTop: 6, gap: 6 }}>
        <select
          className="g3t-select"
          aria-label="Path source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">source…</option>
          {nodeIds.map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
        <select
          className="g3t-select"
          aria-label="Path target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">target…</option>
          {nodeIds.map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
        <button
          className="g3t-btn"
          data-testid="algo-path"
          disabled={!source || !target}
          onClick={() => {
            const path = findShortestPath(ugm, source, target);
            if (!path.found) {
              setError(`no path from ${source} to ${target}`);
              setStatus(null);
              return;
            }
            useOverlayStore
              .getState()
              .register(
                overlayFromPath(
                  `path-${source}-${target}`,
                  `Shortest path ${source} → ${target} (${path.length} hops)`,
                  path,
                ),
              );
            report(`path overlay registered (${path.length} hops)`);
          }}
        >
          Shortest path
        </button>
      </div>

      <div className="g3t-panel-section-header" style={{ marginTop: 10 }}>
        overlays (structure-shaped; toggles are independent)
      </div>
      {overlays.length === 0 ? (
        <p className="va-derived">none registered</p>
      ) : (
        overlays.map((o) => (
          <label
            key={o.id}
            className="g3t-enc-field"
            data-testid={`overlay-row-${o.id}`}
          >
            <input
              type="checkbox"
              checked={activeIds.includes(o.id)}
              onChange={() => useOverlayStore.getState().toggle(o.id)}
            />
            <span className="g3t-enc-valuename">{o.label}</span>
            <span className="g3t-legend-shapename">
              ({o.nodeIds.length}n / {o.edgeIds.length}e
              {o.algorithm ? `, ${o.algorithm}` : ""})
            </span>
          </label>
        ))
      )}
      {overlays.length > 0 ? (
        <button
          className="g3t-btn g3t-btn-ghost"
          onClick={() => useOverlayStore.getState().clear()}
        >
          Clear overlays
        </button>
      ) : null}

      <div className="g3t-panel-section-header" style={{ marginTop: 10 }}>
        ingest result document (networkx, GraphBLAS, …)
      </div>
      <textarea
        className="g3t-input g3t-spec-port-text"
        aria-label="Algorithm result JSON"
        style={{ minHeight: 90 }}
        value={ingestJson}
        spellCheck={false}
        onChange={(e) => setIngestJson(e.target.value)}
      />
      <button
        className="g3t-btn"
        data-testid="algo-ingest"
        disabled={ingestJson.trim() === ""}
        onClick={() => {
          try {
            const doc = parseAlgorithmResult(ingestJson);
            const overlay = applyAlgorithmResult(
              ugm,
              doc,
              ingestAlgorithmResults,
            );
            if (overlay) {
              useOverlayStore.getState().register(overlay);
              report(`overlay "${overlay.label}" registered`);
            } else {
              const keys = new Set<string>();
              for (const props of Object.values(doc.properties ?? {})) {
                for (const k of Object.keys(props)) keys.add(k);
              }
              report(
                `${doc.kind} ingested${doc.algorithm ? ` (${doc.algorithm})` : ""}`,
                [...keys],
              );
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setStatus(null);
          }
        }}
      >
        Apply document
      </button>
      {status ? (
        <p className="va-derived" role="status" data-testid="algo-status">
          {status}
        </p>
      ) : null}
      {error ? (
        <div className="g3t-enc-warning" role="alert" data-testid="algo-error">
          {error}
        </div>
      ) : null}
    </div>
  );
}
