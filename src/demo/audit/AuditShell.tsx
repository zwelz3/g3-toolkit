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
  NodePropertyInspector,
  FloatingPanel,
  categoricalColorMap,
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
import { CapabilityBubble } from "../components/CapabilityCallout";
import { usePrefersReducedMotion } from "../components/usePrefersReducedMotion";
import { provenanceChainFor } from "./chain";
import { createDefaultMenuManager } from "@g3t/react";

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

/** Review 6.3: one symbol per event kind, shared by the timeline
 *  list and the slider ticks so the two read as the same events. */
export const KIND_SYMBOL: Record<string, string> = {
  generated: "\u25cf",
  started: "\u25b6",
  ended: "\u25a0",
};

function fmt(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function AuditShell({ onBack }: { onBack: () => void }) {
  const reducedMotion = usePrefersReducedMotion();
  const ugm = useMemo(() => buildProvenance(), []);
  // Review 6.1: each menu label does what it says. "Inspect
  // properties" opens the floating property inspector (4.11 pattern);
  // "Inspect lineage" is a SEPARATE action, offered only on Entities
  // (a derivation chain is meaningless on an Agent), and it sets an
  // EXPLICIT trace root instead of riding selection, which is what
  // caused the tree to re-root (and visually collapse) whenever a
  // hop was clicked.
  const [inspectId, setInspectId] = useState<string | null>(null);
  const auNodeColors = useMemo(() => categoricalColorMap(SPEC, ugm), [ugm]);
  const undatedCount = useMemo(() => {
    let n = 0;
    ugm.forEachNode((_id, attrs) => {
      if (attrs.types.includes("Entity") && !attrs.properties.generatedAtTime)
        n += 1;
      else if (
        attrs.types.includes("Activity") &&
        !attrs.properties.startedAtTime
      )
        n += 1;
    });
    return n;
  }, [ugm]);
  const [traceRoot, setTraceRoot] = useState<string | null>(null);
  const [menuManager] = useState(() =>
    createDefaultMenuManager({
      onInspect: (t) => {
        if (t.id !== undefined) setInspectId(t.id);
      },
    }),
  );
  useEffect(() => {
    menuManager.register("audit-lineage", [
      {
        id: "inspect-lineage",
        label: "Inspect lineage",
        icon: "\u2934",
        filter: (t) =>
          t.type === "node" &&
          t.id !== undefined &&
          (ugm.getNode(t.id)?.types.includes("Entity") ?? false),
        action: (t) => {
          if (t.id !== undefined) {
            setTraceRoot(t.id);
            useSelectionStore.getState().selectNodes([t.id]);
          }
        },
      },
    ]);
    return () => menuManager.unregister("audit-lineage");
  }, [menuManager, ugm]);
  const events = useMemo(() => provenanceEvents(ugm), [ugm]);
  const bounds = useMemo(() => timeBounds(events), [events]);
  const report = useMemo(() => provenanceReport(ugm, provenanceShapes), [ugm]);

  // Lineage of the EXPLICIT root (review 6.1), rendered by the
  // toolkit's ProvenanceTrace. Chain derivation is pure (chain.ts);
  // unattributed entities bottom out in an absence hop, mirroring
  // the SHACL report.
  const traceChain = useMemo(
    () => (traceRoot !== null ? provenanceChainFor(ugm, traceRoot) : []),
    [ugm, traceRoot],
  );

  const [start, setStart] = useState(bounds.min);
  const [end, setEnd] = useState(bounds.max);

  // Review 6.3: play sweeps the window END from the current start to
  // the span's end in discrete steps, so events accumulate on the
  // canvas in time order. Steps are discrete state updates (the
  // hidden-set filter has no tween), so reduced-motion preferences
  // are not violated by the sweep itself.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const span = bounds.max - bounds.min;
    const step = span / 32;
    const t = window.setInterval(() => {
      setEnd((prev) => {
        const next = Math.min(prev + step, bounds.max);
        if (next >= bounds.max) setPlaying(false);
        return next;
      });
    }, 250); // 9.28: Zach's pacing ruling
    return () => window.clearInterval(t);
  }, [playing, bounds]);

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
    // Review 6.2: register INACTIVE. Active-at-mount overlays dimmed
    // every non-finding node by default with no stated reason (the
    // reviewed "most nodes are muted"); the default shows everything
    // and the chips below are the explicit narrative controls.
    for (const o of overlays) useOverlayStore.getState().register(o, false);
    return () => {
      for (const o of overlays) useOverlayStore.getState().unregister(o.id);
    };
  }, [overlays]);
  const activeOverlayIds = useOverlayStore((s) => s.activeIds);

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
          <div className="au-ov-chips">
            {overlays.map((o) => {
              const on = activeOverlayIds.includes(o.id);
              return (
                <button
                  type="button"
                  key={o.id}
                  className={`au-ov-chip${on ? " on" : ""}`}
                  data-testid={`au-ov-${o.id.split(".").pop()}`}
                  onClick={() => useOverlayStore.getState().toggle(o.id)}
                  title="Emphasizes these findings on the canvas; other nodes dim while active"
                >
                  {on ? "Hide" : "Highlight"} {o.label.toLowerCase()} on canvas
                </button>
              );
            })}
          </div>
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

          <CapabilityBubble
            bottomOffset={112}
            accent="#2dd4bf"
            items={[
              {
                mechanism: "ProvenanceTrace",
                anchor: "render-a-provenance-trace",
                how: "renders the selected node's lineage; unattributed entities end in an absence hop, the same fact the report flags.",
              },
              {
                mechanism: "hidden prop",
                anchor: "filter-by-hiding-not-by-rebuilding",
                how: "the range slider feeds hiddenForRange straight into the canvas, so the time window filters the graph itself, not just the table.",
              },
              {
                mechanism: "node-local SHACL",
                anchor:
                  "visualize-a-shacl-validation-report-over-the-data-graph",
                how: "audits the PROV-O record via derived facts (attributed, timestamps); findings group into this report.",
              },
              {
                mechanism: "useOverlayStore",
                anchor: "register-an-algorithm-result-from-your-backend",
                how: "projects violations and warnings onto the graph as severity borders.",
              },
              {
                mechanism: "useSelectionStore",
                anchor: "select-and-focus-a-node-of-interest",
                how: "clicking a finding or a timeline event selects the node on the canvas.",
              },
            ]}
          />
        </aside>

        <main className="au-canvas-wrap">
          {/* 9.23 (fold of the retired FloatingInspector pattern into
              the toolkit): both panels FLOAT over the graph on
              FloatingPanel; lineage bottom-left, inspector top-right,
              each draggable by its header. */}
          {traceRoot !== null && traceChain.length > 0 && (
            <FloatingPanel
              positioning="absolute"
              corner="bottom-left"
              onClose={() => setTraceRoot(null)}
              testId="au-lineage"
              closeTestId="au-trace-close"
              header={
                <strong>
                  Lineage:{" "}
                  {String(ugm.getNode(traceRoot)?.properties.name ?? traceRoot)}
                </strong>
              }
            >
              <div style={{ maxHeight: 260, overflow: "auto" }}>
                <ProvenanceTrace
                  chain={traceChain}
                  selectedId={traceRoot}
                  // Hop clicks SELECT on the canvas; the root stays
                  // put, so the tree never collapses under the click.
                  onSelectHop={(id) => {
                    if (!id.endsWith("::absence")) select(id);
                  }}
                  title=""
                />
              </div>
            </FloatingPanel>
          )}
          {inspectId !== null && (
            <FloatingPanel
              positioning="absolute"
              corner="top-right"
              onClose={() => setInspectId(null)}
              testId="au-inspector"
              closeTestId="au-inspector-close"
              header={<strong>Inspect properties</strong>}
            >
              <div style={{ maxHeight: 260, overflow: "auto" }}>
                <NodePropertyInspector
                  ugm={ugm}
                  selection={{ type: "node", id: inspectId }}
                  // 12.11: chip colors from the SURFACE's map so the
                  // panel matches the graph encoding.
                  typeColorOf={(t) => auNodeColors.get(t)}
                />
              </div>
            </FloatingPanel>
          )}
          <CytoscapeCanvas
            ugm={ugm}
            encodingSpec={SPEC}
            hidden={hidden}
            animate={!reducedMotion}
            menuManager={menuManager}
          />
        </main>

        <aside className="au-timeline">
          <div className="au-panel-head">
            <span>Provenance timeline</span>
            <span className="au-range-label">
              {events.filter((e) => inRange(e.time)).length} in window
            </span>
          </div>
          {/* 12.17 (answered, not a filter bug): undated records are
              NEVER hidden by the window; a missing timestamp is a
              data-quality defect the auditor surfaces (Signed
              approval is the fixture's planted case). Without this
              cue, their constant presence reads as broken
              filtering. */}
          {undatedCount > 0 && (
            <div className="au-undated-note" data-testid="au-undated-note">
              {undatedCount} undated record{undatedCount === 1 ? "" : "s"}{" "}
              always shown (missing timestamps are audit findings, not filters)
            </div>
          )}
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
                  {KIND_SYMBOL[e.kind]} {e.kind}
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
              data-testid="au-play"
              onClick={() => {
                if (!playing && end >= bounds.max) setEnd(start);
                setPlaying((p) => !p);
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="au-range-reset"
              onClick={() => {
                setPlaying(false);
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
          ticks={events.map((e) => ({
            time: e.time,
            kind: e.kind,
            label: `${e.nodeName}: ${e.kind} ${e.iso.slice(0, 10)}`,
          }))}
          onChange={(s, en) => {
            setStart(s);
            setEnd(en);
          }}
        />
      </footer>
    </div>
  );
}
