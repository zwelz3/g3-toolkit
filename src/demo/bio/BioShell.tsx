/**
 * Biomedical RDF shell. The graph (projected from the triples) sits center;
 * the ontology explorer is on the left; the SPARQL workbench is on the right.
 * Picking or editing a query runs it through the curated in-browser executor
 * and shows the bindings in a table and, when the result is numeric, in a
 * linked bar/scatter panel whose bars select the matching graph node. A
 * standing notice states plainly that this executor is a demo subset and a
 * production build should bundle a real engine.
 *
 * Rendering and interaction are browser-verified; the data behind the tables,
 * charts, and explorer comes from tested pure functions.
 */
import { useMemo, useState } from "react";
import {
  CytoscapeCanvas,
  useSelectionStore,
  categoricalColorMap,
} from "@g3t/react";
import type { EncodingSpec } from "@g3t/react";
import { bioGraph, rdfToUgm, rawTripleUgm, shorten } from "./rdf";
import { createPresetPipeline } from "@g3t/core";
import {
  executeSparql,
  termText,
  type SparqlResult,
  type Term,
} from "./sparql";
import { defaultQueries } from "./queries";
import { ontologySummary, resultToChartData } from "./derive";
import { BioChart } from "./BioChart";
import { OntologyExplorer } from "./OntologyExplorer";
import { BIO_STYLES } from "./bio-styles";
import { CapabilityCallout } from "../components/CapabilityCallout";

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

function cellText(term: Term | undefined): string {
  if (!term) return "";
  return term.kind === "uri" ? shorten(term.value) : termText(term);
}

export function BioShell({ onBack }: { onBack: () => void }) {
  const ugm = useMemo(() => rdfToUgm(bioGraph), []);

  // Raw-vs-projected canvas toggle (the projection-pipeline story).
  // Raw renders the dataset as triples (literals and rdf:type as
  // first-class nodes); Projected is the LPG view every panel binds to.
  // The caption lists the standard preset's steps via the live pipeline
  // API, so the collapse names on screen come from @g3t/core, not copy.
  const [canvasView, setCanvasView] = useState<"projected" | "raw">(
    "projected",
  );
  const rawUgm = useMemo(() => rawTripleUgm(bioGraph), []);
  const canvasUgm = canvasView === "raw" ? rawUgm : ugm;
  const pipelineSteps = useMemo(
    () =>
      createPresetPipeline("standard")
        .getSteps()
        .map((st) => st.name),
    [],
  );
  const summary = useMemo(() => ontologySummary(bioGraph), []);
  const nodeColors = useMemo(() => categoricalColorMap(SPEC, ugm), [ugm]);

  const { classColorMap, classInstances } = useMemo(() => {
    const colors = new Map<string, string>();
    const instances = new Map<string, string[]>();
    ugm.forEachNode((id, attrs) => {
      for (const t of attrs.types) {
        if (!colors.has(t)) {
          const c = nodeColors.get(id);
          if (c) colors.set(t, c);
        }
        const list = instances.get(t) ?? [];
        list.push(id);
        instances.set(t, list);
      }
    });
    return { classColorMap: colors, classInstances: instances };
  }, [ugm, nodeColors]);

  const first = defaultQueries[0];
  const [queryId, setQueryId] = useState(first?.id ?? "");
  const [text, setText] = useState(first?.sparql ?? "");
  const [result, setResult] = useState<SparqlResult>(() =>
    executeSparql(bioGraph, first?.sparql ?? ""),
  );
  const [chartType, setChartType] = useState<"bar" | "scatter">("bar");

  const chartHint = useMemo(
    () => defaultQueries.find((q) => q.id === queryId)?.chart,
    [queryId],
  );
  const chartData = useMemo(
    () => resultToChartData(result, chartHint),
    [result, chartHint],
  );

  const selectedId = useSelectionStore(
    (s) => [...s.selectedNodeIds][0] ?? null,
  );
  const select = (ids: string[]) =>
    useSelectionStore.getState().selectNodes(ids);

  const pickQuery = (id: string) => {
    const q = defaultQueries.find((x) => x.id === id);
    if (!q) return;
    setQueryId(id);
    setText(q.sparql);
    setResult(executeSparql(bioGraph, q.sparql));
  };
  const run = () => setResult(executeSparql(bioGraph, text));

  return (
    <div className="bio-shell">
      <style>{BIO_STYLES}</style>

      <header className="bio-topbar">
        <button type="button" className="bio-back" onClick={onBack}>
          {"\u2190"} Scenarios
        </button>
        <div className="bio-wordmark">
          <b>Bio Knowledge Graph</b>
          <span>RDF + SPARQL workbench</span>
        </div>
      </header>

      <div className="bio-body">
        <aside className="bio-explorer">
          <div className="bio-panel-head">Ontology</div>
          <OntologyExplorer
            summary={summary}
            classColor={(name) => classColorMap.get(name) ?? "#8b83a3"}
            onSelectClass={(iri) => {
              const local = shorten(iri).replace(/^ex:/, "");
              select(classInstances.get(local) ?? []);
            }}
          />
        </aside>

        <main className="bio-canvas-wrap">
          <div
            className="bio-view-toggle"
            role="group"
            aria-label="Canvas view"
          >
            {(["projected", "raw"] as const).map((v) => (
              <button
                key={v}
                className={
                  canvasView === v ? "bio-view-btn active" : "bio-view-btn"
                }
                onClick={() => setCanvasView(v)}
              >
                {v === "projected" ? "Projected" : "Raw triples"}
              </button>
            ))}
            <span className="bio-view-caption" data-testid="bio-view-caption">
              {canvasUgm.getNodeIds().length} nodes ·{" "}
              {canvasView === "raw"
                ? "every triple an edge; literals and rdf:type as nodes"
                : `standard projection (${pipelineSteps.join(", ")}); panels always query this view`}
            </span>
          </div>
          <CytoscapeCanvas ugm={canvasUgm} encodingSpec={SPEC} />
        </main>

        <aside className="bio-sparql">
          <div className="bio-panel-head">SPARQL</div>
          <div className="bio-section">
            <select
              className="bio-query-select"
              value={queryId}
              onChange={(e) => pickQuery(e.target.value)}
            >
              {defaultQueries.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
            <textarea
              className="bio-editor"
              value={text}
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="button" className="bio-run" onClick={run}>
              Run query
            </button>
            <div className="bio-notice">
              This runs a curated in-browser executor (a SPARQL subset: basic
              graph patterns, FILTER, ORDER BY, LIMIT). For production, bundle a
              real engine (Comunica or Oxigraph via WASM) or point the toolkit's
              SparqlAdapter at an endpoint.
            </div>
            <CapabilityCallout
              accent="#b17ef0"
              items={[
                {
                  mechanism: "rdfToUgm",
                  how: "projects the instance triples into the graph the canvas renders; the ontology stays RDF.",
                },
                {
                  mechanism: "ProjectionPipeline",
                  how: "names the standard preset's collapse steps in the canvas caption; the Raw toggle shows the triple view those steps fold away.",
                },
                {
                  mechanism: "useSelectionStore",
                  how: "links the explorer, the chart bars, and the canvas: one selection, three views.",
                },
                {
                  mechanism: "encodingSpec",
                  how: "colors nodes by rdf:type with the shared categorical palette.",
                },
              ]}
            />

            {result.ok ? (
              <>
                <table className="bio-results">
                  <thead>
                    <tr>
                      {result.head.map((h) => (
                        <th key={h}>?{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        {result.head.map((h) => (
                          <td key={h}>{cellText(row[h])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bio-rowcount">
                  {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
                </div>
              </>
            ) : (
              <div className="bio-error">Query error: {result.error}</div>
            )}
          </div>

          <div className="bio-panel-head">Analytics</div>
          <div className="bio-section">
            <div className="bio-chart-head">
              <span className="bio-rowcount">
                {chartHint ? "Linked to graph selection" : "No numeric column"}
              </span>
              <div className="bio-chart-toggle">
                <button
                  type="button"
                  className={chartType === "bar" ? "is-active" : ""}
                  onClick={() => setChartType("bar")}
                >
                  Bar
                </button>
                <button
                  type="button"
                  className={chartType === "scatter" ? "is-active" : ""}
                  onClick={() => setChartType("scatter")}
                >
                  Scatter
                </button>
              </div>
            </div>
            <BioChart
              data={chartData}
              type={chartType}
              selectedId={selectedId}
              onSelect={(id) => select([id])}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
