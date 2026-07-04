/**
 * SchemaDashboard — the toolkit's STRUCTURE and PARADIGM surface, which
 * the scenario shells don't foreground.
 *
 * Capability-first views for understanding the shape of a graph rather
 * than its contents:
 *
 *  - SchemaView: the type-level schema (node types, their properties,
 *    and the edge types between them) derived from the data.
 *  - MatrixView: the adjacency matrix, which reads dense connectivity
 *    that a node-link layout hides.
 *  - SankeyView: type-to-type flow volumes.
 *  - RDF surface: a live Turtle serialization of the current graph
 *    (exportSubgraphTurtle) plus a QueryEditor bound to an in-memory
 *    holonic adapter, making the "RDF / property-graph / holonic"
 *    paradigm claim concrete. (The in-memory adapter returns the
 *    top-level projection rather than running the query string; a
 *    backend-connected adapter would execute it. The panel says so.)
 *
 * Reference code, not a shipped product.
 *
 * @see examples/decision-dashboards/README.md
 */

import { useMemo, useState } from "react";
import { exportSubgraphTurtle, HolonicAdapter, type UGM } from "@g3t/core";
import {
  CytoscapeCanvas,
  SchemaView,
  MatrixView,
  SankeyView,
  QueryEditor,
  DEFAULT_ENCODING,
  fromLegacyConfig,
  type EncodingSpec,
} from "@g3t/react";
import { buildSupplyNetwork } from "./supply-data";

type View = "schema" | "matrix" | "sankey" | "graph";
type Side = "turtle" | "query";

export interface SchemaDashboardProps {
  className?: string;
}

export function SchemaDashboard({ className }: SchemaDashboardProps) {
  const ugm = useMemo<UGM>(() => buildSupplyNetwork(), []);
  const [view, setView] = useState<View>("schema");
  const [side, setSide] = useState<Side>("turtle");

  const spec = useMemo<EncodingSpec>(
    () => fromLegacyConfig({ ...DEFAULT_ENCODING }),
    [],
  );

  // Live Turtle serialization of the whole graph.
  const turtle = useMemo(() => exportSubgraphTurtle(ugm), [ugm]);

  // In-memory holonic adapter: no query engine, returns the projection.
  // Real query semantics need a backend-connected adapter.
  const adapter = useMemo(() => new HolonicAdapter({ holons: [] }), []);

  return (
    <div
      className={className}
      data-testid="schema-dashboard"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 420px",
        gridTemplateRows: "minmax(0, 1fr)",
        gap: 12,
        height: "100%",
        minHeight: 0,
        color: "var(--g3t-text-primary)",
      }}
    >
      {/* Structure views (left) */}
      <section
        style={{
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
          {(["schema", "matrix", "sankey", "graph"] as View[]).map((v) => (
            <button
              key={v}
              className={`g3t-btn ${view === v ? "g3t-btn-active" : "g3t-btn-ghost"}`}
              onClick={() => setView(v)}
              style={{ textTransform: "capitalize" }}
            >
              {v === "schema"
                ? "Schema"
                : v === "matrix"
                  ? "Adjacency matrix"
                  : v === "sankey"
                    ? "Flows (Sankey)"
                    : "Graph"}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {view === "schema" && <SchemaView ugm={ugm} />}
          {view === "matrix" && <MatrixView ugm={ugm} />}
          {view === "sankey" && <SankeyView ugm={ugm} mode="sankey" />}
          {view === "graph" && (
            <CytoscapeCanvas ugm={ugm} encodingSpec={spec} />
          )}
        </div>
      </section>

      {/* RDF / paradigm surface (right) */}
      <aside
        style={{
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
          {(["turtle", "query"] as Side[]).map((s) => (
            <button
              key={s}
              className={`g3t-btn ${side === s ? "g3t-btn-active" : "g3t-btn-ghost"}`}
              onClick={() => setSide(s)}
            >
              {s === "turtle" ? "Turtle (RDF)" : "Query"}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 8 }}>
          {side === "turtle" ? (
            <>
              <p style={{ fontSize: 12, opacity: 0.75, marginTop: 0 }}>
                Live RDF serialization of the graph (exportSubgraphTurtle).
              </p>
              <pre
                data-testid="turtle-output"
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "var(--g3t-bg-tertiary, #1c2142)",
                  padding: 10,
                  borderRadius: 6,
                  margin: 0,
                }}
              >
                {turtle}
              </pre>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, opacity: 0.75, marginTop: 0 }}>
                A QueryEditor bound to an in-memory holonic adapter. This
                adapter has no query engine and returns the top-level
                projection; a backend-connected adapter would execute the query.
              </p>
              <QueryEditor adapter={adapter} defaultLanguage="sparql" />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
