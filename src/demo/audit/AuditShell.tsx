/**
 * Auditor shell. The provenance graph is center, a SHACL report of violations
 * and warnings is on the left, and the provenance timeline is on the right.
 * The dual-range slider along the bottom is the point of item 3: it drives
 * both the timeline (dimming out-of-window events) and the graph (feeding
 * hiddenForRange into the canvas hidden prop), so dragging it filters the
 * graph and not just the table. Clicking a report finding or a timeline event
 * selects that node. SHACL findings also register as severity overlays so the
 * offending nodes carry emphasized borders.
 *
 * Rendering and interaction are browser-verified; the report, events, and
 * range-to-hidden set all come from tested pure functions.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CytoscapeCanvas,
  ProvenanceTrace,
  useSelectionStore,
  useOverlayStore,
} from "@g3t/react";
import type { EncodingSpec } from "@g3t/react";
import type { StructuralOverlay } from "@g3t/core";
import { buildProvenance } from "./model";
import { provenanceShapes } from "./shapes";
import {
  provenanceEvents,
  timeBounds,
  hiddenForRange,
  provenanceReport,
  type Finding,
} from "./timeline";
import { RangeSlider } from "./RangeSlider";
import { AUDIT_STYLES } from "./audit-styles";
import { CapabilityCallout } from "../components/CapabilityCallout";
import { provenanceChainFor } from "./chain";

const SPEC: EncodingSpec = {
  version: 1,
  node: {
    color: {
      driver: "types",
      scale: { kind: "categorical", palette: "okabe-ito" },
    },
    label: { driver: "name" },
  },
  edge: { label: { driver: "type" } },
};

function fmt(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function AuditShell({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => buildProvenance(), []);
  const events = useMemo(() => provenanceEvents(ugm), [ugm]);
  const bounds = useMemo(() => timeBounds(events), [events]);
  const report = useMemo(() => provenanceReport(ugm, provenanceShapes), [ugm]);

  // Lineage of the current selection, rendered by the toolkit's
  // ProvenanceTrace. Chain derivation is pure (chain.ts); unattributed
  // entities bottom out in an absence hop, mirroring the SHACL report.
  const selectedIds = useSelectionStore((s) => s.selectedNodeIds);
  const traceRoot = [...selectedIds][0];
  const traceChain = useMemo(
    () => (traceRoot !== undefined ? provenanceChainFor(ugm, traceRoot) : []),
    [ugm, traceRoot],
  );

  const [start, setStart] = useState(bounds.min);
  const [end, setEnd] = useState(bounds.max);

  const hidden = useMemo(
    () => hiddenForRange(ugm, start, end),
    [ugm, start, end],
  );
  const inRange = (t: number) => t >= start && t <= end;

  const overlays = useMemo<StructuralOverlay[]>(() => {
    const v = [...new Set(report.violations.map((f) => f.nodeId))];
    const w = [...new Set(report.warnings.map((f) => f.nodeId))].filter(
      (id) => !v.includes(id),
    );
    return [
      {
        id: "prov.violations",
        label: "Violations",
        nodeIds: v,
        edgeIds: [],
        algorithm: "shacl",
      },
      {
        id: "prov.warnings",
        label: "Warnings",
        nodeIds: w,
        edgeIds: [],
        algorithm: "shacl",
      },
    ];
  }, [report]);

  useEffect(() => {
    for (const o of overlays) useOverlayStore.getState().register(o, true);
    return () => {
      for (const o of overlays) useOverlayStore.getState().unregister(o.id);
    };
  }, [overlays]);

  const select = (id: string) => useSelectionStore.getState().selectNodes([id]);

  const renderFinding = (f: Finding, sev: "v" | "w") => (
    <button
      type="button"
      className={`au-finding ${sev}`}
      key={`${f.nodeId}-${f.path}`}
      onClick={() => select(f.nodeId)}
    >
      <span className="au-finding-bar" />
      <span className="au-finding-body">
        <span className="au-finding-name">{f.nodeName}</span>
        <span className="au-finding-msg">{f.message}</span>
      </span>
    </button>
  );

  return (
    <div className="au-shell">
      <style>{AUDIT_STYLES}</style>

      <header className="au-topbar">
        <button type="button" className="au-back" onClick={onBack}>
          {"\u2190"} Scenarios
        </button>
        <div className="au-wordmark">
          <b>Provenance Auditor</b>
          <span>PROV-O audit trail</span>
        </div>
        <div className="au-counts">
          <span className="au-count-chip">
            <span className="au-dot au-dot-v" />{" "}
            <b>{report.violations.length}</b> violations
          </span>
          <span className="au-count-chip">
            <span className="au-dot au-dot-w" /> <b>{report.warnings.length}</b>{" "}
            warnings
          </span>
        </div>
      </header>

      <div className="au-body">
        <aside className="au-report">
          <div className="au-panel-head">SHACL report</div>
          <div className="au-section">
            {report.violations.length === 0 && report.warnings.length === 0 ? (
              <div className="au-clear">All provenance checks pass.</div>
            ) : (
              <>
                {report.violations.map((f) => renderFinding(f, "v"))}
                {report.warnings.map((f) => renderFinding(f, "w"))}
              </>
            )}
          </div>
          {traceChain.length > 0 && (
            <div className="au-trace">
              <ProvenanceTrace
                chain={traceChain}
                selectedId={traceRoot}
                onSelectHop={(id) => {
                  if (!id.endsWith("::absence")) select(id);
                }}
                title="Lineage of selection"
              />
            </div>
          )}
          <CapabilityCallout
            accent="#2dd4bf"
            items={[
              {
                mechanism: "ProvenanceTrace",
                how: "renders the selected node's lineage; unattributed entities end in an absence hop, the same fact the report flags.",
              },
              {
                mechanism: "hidden prop",
                how: "the range slider feeds hiddenForRange straight into the canvas, so the time window filters the graph itself, not just the table.",
              },
              {
                mechanism: "node-local SHACL",
                how: "audits the PROV-O record via derived facts (attributed, timestamps); findings group into this report.",
              },
              {
                mechanism: "useOverlayStore",
                how: "projects violations and warnings onto the graph as severity borders.",
              },
              {
                mechanism: "useSelectionStore",
                how: "clicking a finding or a timeline event selects the node on the canvas.",
              },
            ]}
          />
        </aside>

        <main className="au-canvas-wrap">
          <CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} hidden={hidden} />
        </main>

        <aside className="au-timeline">
          <div className="au-panel-head">
            <span>Provenance timeline</span>
            <span className="au-range-label">
              {events.filter((e) => inRange(e.time)).length} in window
            </span>
          </div>
          <div className="au-section">
            {events.map((e, i) => (
              <button
                type="button"
                key={`${e.nodeId}-${e.kind}-${i}`}
                className={`au-event${inRange(e.time) ? "" : " out"}`}
                onClick={() => select(e.nodeId)}
              >
                <span className="au-event-time">{e.iso.slice(0, 10)}</span>
                <span className={`au-event-kind au-kind-${e.kind}`}>
                  {e.kind}
                </span>
                <span className="au-event-name">{e.nodeName}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <footer className="au-footer">
        <div className="au-range-head">
          <span className="au-range-label">Time window</span>
          <span className="au-range-window">
            <b>{fmt(start)}</b> to <b>{fmt(end)}</b>
            <button
              type="button"
              className="au-range-reset"
              onClick={() => {
                setStart(bounds.min);
                setEnd(bounds.max);
              }}
            >
              Reset
            </button>
          </span>
        </div>
        <RangeSlider
          min={bounds.min}
          max={bounds.max}
          start={start}
          end={end}
          ticks={events.map((e) => ({ time: e.time, kind: e.kind }))}
          onChange={(s, en) => {
            setStart(s);
            setEnd(en);
          }}
        />
      </footer>
    </div>
  );
}
