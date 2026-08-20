/**
 * RDF 1.2 hyperarc demo shell (Brief 14).
 *
 * Left rail: the authored quoted triples with their annotations
 * (statedBy / confidence / recordedAt / reviewedBy). Center: the
 * same rows rendered TWO ways, toggled live —
 *
 * - Hyperarc (default): each unique `« s p o »` becomes a diamond
 *   `_Statement` pseudo-node with rdf:subject/object edges and one
 *   annotation edge per row; the nested review reads as a
 *   statement-to-statement link (the shape the edge render cannot
 *   express).
 * - Asserted: haunt g-xplore convention — one dashed `star` edge per
 *   annotation from the base subject to the base object, layered
 *   over the asserted base edge. Low visual clutter; drops the
 *   nested case to a synthetic label-node fallback.
 *
 * Both renders fold a numeric `confidence` annotation onto its
 * projected artifact as `_confidence`, and the shell ships a stylesheet
 * with `[_confidence]`-scoped opacity plus a `[_rdfStatement]`-scoped
 * diamond shape — data-mapped style props stay on `[field]`-scoped
 * selectors per CLAUDE.md (bare `node`/`edge` rules would flood the
 * console with per-frame Cytoscape warnings on the elements missing
 * the field).
 */
import { useMemo, useState } from "react";
import {
  CytoscapeCanvas,
  DetailInspector,
  useSelectionStore,
  type CyStylesheet,
} from "@g3t/react";
import {
  projectTripleTermsAsEdges,
  projectTripleTermsAsHyperarcs,
  RDF_STATEMENT_FLAG,
  STAR_EDGE_TYPE,
  UGM,
} from "@g3t/core";
import { publishCanvas } from "../testing/e2e-hooks";
import { CapabilityBubble } from "../components/CapabilityCallout";
import { usePrefersReducedMotion } from "../components/usePrefersReducedMotion";
import { RDF12_ROWS, tripleLabel, termLabel } from "./rdf12";
import {
  useRoutingControls,
  RoutingControlStrip,
} from "../components/routing-controls";

/* eslint-disable @typescript-eslint/no-explicit-any --
   Cytoscape's TS types don't accept `data(x)` strings for opacity /
   shape even though they work at runtime; style objects cast to any
   the same way CytoscapeCanvas's own ENCODING_*_RULES do. */

const ACCENT = "#38bdf8";

type ViewMode = "hyperarc" | "asserted";

/** Group flat annotation rows by their quoted triple for the rail. */
function useGrouped() {
  return useMemo(() => {
    const groups: Array<{
      label: string;
      annotations: Array<{ pred: string; value: string }>;
    }> = [];
    const byLabel = new Map<string, number>();
    for (const row of RDF12_ROWS) {
      const label = tripleLabel(row.stmt.value);
      let idx = byLabel.get(label);
      if (idx === undefined) {
        idx = groups.length;
        byLabel.set(label, idx);
        groups.push({ label, annotations: [] });
      }
      const group = groups[idx];
      if (group) {
        group.annotations.push({
          pred: termLabel(row.ann),
          value: termLabel(row.val),
        });
      }
    }
    return groups;
  }, []);
}

// [_rdfStatement] and [_confidence] scoped rules only; NEVER a bare
// `node` / `edge` selector on data-mapped props (CLAUDE.md doctrine).
const HYPERARC_STYLE: CyStylesheet[] = [
  {
    selector: "node[?_rdfStatement]",
    style: {
      shape: "diamond",
      "background-color": ACCENT,
      "border-color": "#0369a1",
      "border-width": 2,
      width: 44,
      height: 44,
      "font-size": 10,
    } as any,
  },
  {
    selector: "node[_confidence]",
    style: { opacity: "data(_confidence)" } as any,
  },
  {
    selector: "edge[?_annotation]",
    style: {
      "line-style": "dashed",
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
      width: 1.5,
    } as any,
  },
  {
    selector: "edge[type = 'rdf:subject']",
    style: {
      "line-color": ACCENT,
      "target-arrow-color": ACCENT,
      width: 2,
    } as any,
  },
  {
    selector: "edge[type = 'rdf:object']",
    style: {
      "line-color": ACCENT,
      "target-arrow-color": ACCENT,
      width: 2,
      "line-style": "dotted",
    } as any,
  },
];

const EDGE_STYLE: CyStylesheet[] = [
  {
    selector: `edge[type = '${STAR_EDGE_TYPE}']`,
    style: {
      "line-style": "dashed",
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
      "curve-style": "bezier",
      "control-point-step-size": 40,
      width: 1.5,
      label: "data(annP)",
      "font-size": 9,
      color: "#8b949e",
    } as any,
  },
  {
    selector: "edge[_confidence]",
    style: { opacity: "data(_confidence)" } as any,
  },
  {
    selector: "edge[?asserted]",
    style: {
      width: 2,
      "line-color": ACCENT,
      "target-arrow-color": ACCENT,
    } as any,
  },
];

/**
 * The interior of a hyperarc IS a graph: a reified `_Statement`
 * diamond plus its outgoing rdf:subject / rdf:object term links and
 * annotation edges. Given the full hyperarc UGM and a statement node
 * id, return a self-contained sub-UGM of just that statement's
 * interior, so the canvas can drill into a single fact-about-a-fact.
 * A nested statement endpoint re-appears as its own diamond, so the
 * same drill recurses.
 */
export function buildStatementInterior(full: UGM, stmtId: string): UGM {
  const sub = new UGM();
  const copyNode = (id: string) => {
    if (sub.hasNode(id)) return;
    const attrs = full.getNode(id);
    if (!attrs) return;
    sub.addNode(id, { types: attrs.types, properties: attrs.properties });
  };
  copyNode(stmtId);
  for (const edgeId of full.getNodeEdges(stmtId)) {
    const ends = full.getEdgeEndpoints(edgeId);
    const attrs = full.getEdge(edgeId);
    if (!ends || !attrs || ends.source !== stmtId) continue;
    copyNode(ends.source);
    copyNode(ends.target);
    sub.addEdge(ends.source, ends.target, {
      type: attrs.type,
      properties: attrs.properties,
      ...attrs.meta,
    });
  }
  return sub;
}

export function Rdf12Shell({ onBack }: { onBack: () => void }) {
  const reducedMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<ViewMode>("hyperarc");
  const ugm = useMemo(
    () =>
      mode === "hyperarc"
        ? projectTripleTermsAsHyperarcs(RDF12_ROWS)
        : projectTripleTermsAsEdges(RDF12_ROWS),
    [mode],
  );
  const stylesheet = mode === "hyperarc" ? HYPERARC_STYLE : EDGE_STYLE;
  const groups = useGrouped();

  // Holon drill: a hyperarc can be a graph itself. `drill` is the
  // stack of statement ids entered; the deepest is the interior shown
  // on the canvas (only meaningful in hyperarc mode).
  const [drill, setDrill] = useState<string[]>([]);
  const focusId =
    mode === "hyperarc" ? (drill[drill.length - 1] ?? null) : null;
  const displayUgm = useMemo(
    () => (focusId ? buildStatementInterior(ugm, focusId) : ugm),
    [ugm, focusId],
  );

  const selectedNodeId = useSelectionStore(
    (s) => [...s.selectedNodeIds][0] ?? null,
  );
  const selectedEdgeId = useSelectionStore(
    (s) => [...s.selectedEdgeIds][0] ?? null,
  );
  const selection = selectedEdgeId
    ? ({ type: "edge", id: selectedEdgeId } as const)
    : selectedNodeId
      ? ({ type: "node", id: selectedNodeId } as const)
      : null;
  const selectedIsStatement =
    selection?.type === "node" &&
    displayUgm.getNode(selection.id)?.properties[RDF_STATEMENT_FLAG] === true;
  const {
    routeMode,
    setRouteMode,
    routeEdgesConfig,
    routeRefreshSignal,
    refreshRoutes,
    relayoutSignal,
    relayout,
  } = useRoutingControls();

  const enterInterior = (id: string) => {
    setDrill((d) => [...d, id]);
    useSelectionStore.getState().clearSelection();
  };
  const popTo = (depth: number) => {
    setDrill((d) => d.slice(0, depth));
    useSelectionStore.getState().clearSelection();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "var(--g3t-font, 'IBM Plex Sans', sans-serif)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 16px",
          borderBottom: "1px solid #21262d",
        }}
      >
        <button
          type="button"
          className="g3t-btn"
          data-testid="rdf12-back"
          onClick={onBack}
          style={{ fontSize: 12 }}
        >
          {"←"} Scenarios
        </button>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <b style={{ fontSize: 15 }}>RDF 1.2 Hyperarcs</b>
          <span style={{ fontSize: 12, color: "#8b949e" }}>
            quoted triples as hyperarcs — pseudo-node reification vs haunt-style
            annotation edges
          </span>
        </div>
        <span style={{ marginLeft: "auto" }}>
          <RoutingControlStrip
            idPrefix="rdf12"
            routeMode={routeMode}
            setRouteMode={setRouteMode}
            refreshRoutes={refreshRoutes}
            relayout={relayout}
          />
        </span>
        <div
          role="tablist"
          aria-label="Render mode"
          style={{ display: "flex", gap: 6 }}
        >
          {(["hyperarc", "asserted"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              data-testid={`rdf12-view-${m}`}
              onClick={() => {
                setMode(m);
                setDrill([]);
                useSelectionStore.getState().clearSelection();
              }}
              className="g3t-btn"
              style={{
                fontSize: 12,
                borderColor: mode === m ? ACCENT : "#30363d",
                color: mode === m ? ACCENT : "#c9d1d9",
              }}
            >
              {m === "hyperarc" ? "Hyperarc" : "Asserted"}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside
          data-testid="rdf12-rail"
          style={{
            width: 340,
            flex: "0 0 340px",
            borderRight: "1px solid #21262d",
            overflowY: "auto",
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#8b949e",
              marginBottom: 8,
            }}
          >
            Authored statements
          </div>
          {groups.map((g) => (
            <div
              key={g.label}
              data-testid="rdf12-statement"
              style={{
                border: `1px solid ${ACCENT}40`,
                borderLeft: `3px solid ${ACCENT}`,
                borderRadius: 6,
                padding: "8px 10px",
                marginBottom: 10,
                background: "rgba(56,189,248,0.06)",
              }}
            >
              <code
                style={{
                  fontSize: 12,
                  color: ACCENT,
                  fontFamily: "var(--g3t-font-mono, monospace)",
                  wordBreak: "break-word",
                }}
              >
                {g.label}
              </code>
              <div style={{ marginTop: 6 }}>
                {g.annotations.map((a) => (
                  <div
                    key={a.pred + a.value}
                    style={{ fontSize: 11, color: "#8b949e" }}
                  >
                    <span style={{ color: "#c9d1d9" }}>{a.pred}</span> {a.value}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            data-testid="rdf12-legend"
            style={{
              display: "flex",
              gap: 14,
              padding: "6px 12px",
              fontSize: 11,
              color: "#8b949e",
              borderBottom: "1px solid #21262d",
              flexWrap: "wrap",
            }}
          >
            {mode === "hyperarc" ? (
              <>
                <span>
                  <strong style={{ color: "#c9d1d9" }}>diamond</strong>: reified
                  statement (« s p o »)
                </span>
                <span>
                  <strong style={{ color: "#c9d1d9" }}>
                    rdf:subject / rdf:object
                  </strong>
                  : term links
                </span>
                <span>
                  <strong style={{ color: "#c9d1d9" }}>dashed</strong>:
                  annotation (statedBy / confidence / recordedAt)
                </span>
                <span>
                  <strong style={{ color: "#c9d1d9" }}>
                    statement → statement
                  </strong>
                  : nested quoted triple
                </span>
              </>
            ) : (
              <>
                <span>
                  <strong style={{ color: "#c9d1d9" }}>solid</strong>: asserted
                  base triple
                </span>
                <span>
                  <strong style={{ color: "#c9d1d9" }}>dashed</strong>:
                  annotation edge (one per row, label = ann predicate)
                </span>
                <span>
                  <strong style={{ color: "#c9d1d9" }}>opacity</strong>: driven
                  by <code>_confidence</code>
                </span>
              </>
            )}
          </div>
          {focusId && drill.length > 0 && (
            <div
              data-testid="rdf12-breadcrumb"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 11,
                borderBottom: "1px solid #21262d",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="g3t-btn"
                data-testid="rdf12-breadcrumb-root"
                onClick={() => popTo(0)}
                style={{
                  fontSize: 11,
                  borderColor: "#30363d",
                  color: "#c9d1d9",
                }}
              >
                Full graph
              </button>
              {drill.map((id, i) => {
                const label = ugm.getNode(id)?.properties.name ?? id;
                const last = i === drill.length - 1;
                return (
                  <span
                    key={id}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ color: "#6e7681" }}>{"›"}</span>
                    <button
                      type="button"
                      className="g3t-btn"
                      onClick={() => popTo(i + 1)}
                      disabled={last}
                      style={{
                        fontSize: 11,
                        borderColor: last ? ACCENT : "#30363d",
                        color: last ? ACCENT : "#c9d1d9",
                        fontFamily: "var(--g3t-font-mono, monospace)",
                      }}
                    >
                      {String(label)}
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            <CytoscapeCanvas
              ugm={displayUgm}
              layout="fcose"
              stylesheet={stylesheet}
              onReady={publishCanvas("rdf12")}
              animate={!reducedMotion}
              routeEdges={routeEdgesConfig}
              routeRefreshSignal={routeRefreshSignal}
              relayoutSignal={relayoutSignal}
              edgeClickIsolate
            />
          </div>
          <div style={{ padding: 12 }}>
            <CapabilityBubble
              accent={ACCENT}
              items={[
                {
                  mechanism: "projectTripleTermsAsHyperarcs",
                  how: "reifies each `« s p o »` into a diamond pseudo-node with rdf:subject/object; nested triples recurse to statement-to-statement links.",
                },
                {
                  mechanism: "projectTripleTermsAsEdges",
                  how: "one dashed `star` edge per annotation, layered over the asserted base edge (the haunt g-xplore convention).",
                },
                {
                  mechanism: "SparqlAdapter (RDF 1.2 triple terms)",
                  anchor: "rdf-1-2-hyperarcs-triple-terms",
                  how: "parses `« s p o »` triple terms out of SPARQL-1.2-JSON, recursively; `tripleTermToValue` preserves nesting.",
                },
              ]}
            />
          </div>
        </main>

        <aside
          data-testid="rdf12-inspector"
          style={{
            width: 300,
            flex: "0 0 300px",
            borderLeft: "1px solid #21262d",
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#8b949e",
              padding: "4px 12px 8px",
            }}
          >
            Inspector
          </div>
          {selectedIsStatement && selection && (
            <button
              type="button"
              className="g3t-btn"
              data-testid="rdf12-enter-interior"
              onClick={() => enterInterior(selection.id)}
              style={{
                margin: "0 12px 8px",
                fontSize: 12,
                borderColor: ACCENT,
                color: ACCENT,
              }}
            >
              {"◉"} Enter interior
            </button>
          )}
          <DetailInspector ugm={displayUgm} selection={selection} />
        </aside>
      </div>
    </div>
  );
}
