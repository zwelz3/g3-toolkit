/**
 * Biomedical RDF shell. The graph (projected from the triples) sits center;
 * the ontology explorer is on the left; the SPARQL workbench is on the right.
 * Picking or editing a query runs it through the curated in-browser executor
 * and shows the bindings in a table and, when the result is numeric, in a
 * linked bar/scatter panel whose bars select the matching graph node. A
 * standing notice states plainly that this executor is a demo subset and a
 * production build should bundle a real engine.
 *
 * The canvas carries two review opt-ins: a Labels control over the
 * collision pass (issue #40; "All" is the previous behavior) and an
 * Explore view that grows a drawn subset one neighborhood at a time
 * through additive updates (issue #26).
 *
 * Rendering and interaction are browser-verified; the data behind the tables,
 * charts, and explorer comes from tested pure functions.
 */
import { useMemo, useState } from "react";
import {
  CytoscapeCanvas,
  useSelectionStore,
  categoricalColorMap,
} from "@g3-toolkit/react";
import type { EncodingSpec } from "@g3-toolkit/react";
import { bioGraph, rdfToUgm, rawTripleUgm, shorten } from "./rdf";
import { expandNeighborhood, induceSubgraph, nodesOfType } from "./explore";
import { createPresetPipeline } from "@g3-toolkit/core";
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
import { CapabilityBubble } from "../components/CapabilityCallout";
import { usePrefersReducedMotion } from "../components/usePrefersReducedMotion";

const SPEC: EncodingSpec = {
  version: 1,
  node: {
    color: {
      driver: "types",
      scale: {
        kind: "categorical",
        palette: "okabe-ito",
        // Pinned in the projected graph's encounter order (so nothing
        // changes in the Projected view): the Explore view starts from
        // a subset that lacks most classes, and an encounter-order
        // domain would hand Disease the first slot there and reshuffle
        // every color as neighborhoods arrive.
        domain: ["Gene", "Protein", "Disease", "Drug", "Pathway"],
      },
    },
    label: { driver: "name" },
  },
  edge: { label: { driver: "type" } },
};

/** The Labels control's values, in display order. "all" is the
 *  canvas default ("none": every label drawn, the pre-#40 behavior),
 *  kept so the reviewer can compare against it on the same scene. */
const LABEL_MODES = [
  { id: "none", title: "All" },
  { id: "shorten", title: "Shorten" },
  { id: "hide", title: "Hide" },
] as const;
type LabelMode = (typeof LABEL_MODES)[number]["id"];

type CanvasView = "projected" | "raw" | "explore";
const CANVAS_VIEWS: { id: CanvasView; title: string }[] = [
  { id: "projected", title: "Projected" },
  { id: "raw", title: "Raw triples" },
  { id: "explore", title: "Explore" },
];

function cellText(term: Term | undefined): string {
  if (!term) return "";
  return term.kind === "uri" ? shorten(term.value) : termText(term);
}

export function BioShell({ onBack }: { onBack: () => void }) {
  const reducedMotion = usePrefersReducedMotion();
  const ugm = useMemo(() => rdfToUgm(bioGraph), []);

  // Raw-vs-projected canvas toggle (the projection-pipeline story).
  // Raw renders the dataset as triples (literals and rdf:type as
  // first-class nodes); Projected is the LPG view every panel binds to.
  // The caption lists the standard preset's steps via the live pipeline
  // API, so the collapse names on screen come from @g3-toolkit/core, not copy.
  const [canvasView, setCanvasView] = useState<CanvasView>("projected");
  const rawUgm = useMemo(() => rawTripleUgm(bioGraph), []);

  // Explore view (the demo opt-in for additive graph updates, issue
  // #26). The drawn graph is the subgraph of the projected UGM induced
  // by `drawn`, seeded with the diseases (no edges among them, so the
  // first expansions show the seeding plainly). Expand adds the
  // selected node's neighborhood; each step is a superset ugm with
  // stable edge ids, which is what lets the canvas grow the instance
  // in place instead of re-laying it out. Reset shrinks the set back
  // to the seed, which the canvas also applies in place (issue #64:
  // the three diseases survive, so it is the same scene): the expanded
  // nodes leave, the diseases and the camera hold. The subset is only
  // induced in this view; `graphUpdate` is "additive" only here too,
  // so the other two views keep their rebuild-on-switch behavior.
  const seed = useMemo(() => nodesOfType(ugm, "Disease"), [ugm]);
  const [drawn, setDrawn] = useState<readonly string[]>(seed);
  const exploreUgm = useMemo(
    () => (canvasView === "explore" ? induceSubgraph(ugm, drawn) : null),
    [ugm, drawn, canvasView],
  );
  const canvasUgm = canvasView === "raw" ? rawUgm : (exploreUgm ?? ugm);

  // Label collision (issue #40): a canvas restyle pass, so switching
  // modes never moves a node; the default is "shorten" and "All" is
  // the previous behavior for comparison on the same scene.
  const [labelMode, setLabelMode] = useState<LabelMode>("shorten");
  const pipelineSteps = useMemo(
    () =>
      createPresetPipeline("standard")
        .getSteps()
        .map((st) => st.name),
    [],
  );
  const summary = useMemo(() => ontologySummary(bioGraph), []);
  const nodeColors = useMemo(() => categoricalColorMap(SPEC, ugm), [ugm]);

  // VR-3 (owner verification 2026-07-26) ROOT CAUSE: the old map
  // filled itself via nodeColors.get(NODE id), but categoricalColorMap
  // keys by TYPE value, so every lookup missed and the map stayed
  // EMPTY: all dots gray regardless of the round-53 key fix. The
  // type-keyed nodeColors map already IS the class color map.
  const classColorMap = nodeColors;
  const classInstances = useMemo(() => {
    const instances = new Map<string, string[]>();
    ugm.forEachNode((id, attrs) => {
      for (const t of attrs.types) {
        const list = instances.get(t) ?? [];
        list.push(id);
        instances.set(t, list);
      }
    });
    return instances;
  }, [ugm]);

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

  // The next explorer step from the current selection, or null when
  // it would add nothing (nothing selected, or the selected node and
  // its neighbors are already drawn); the Expand button disables on
  // null so a click always grows the graph.
  const nextDrawn = useMemo(() => {
    if (selectedId === null) return null;
    const next = expandNeighborhood(ugm, drawn, selectedId);
    return next === drawn ? null : next;
  }, [ugm, drawn, selectedId]);

  const pickQuery = (id: string) => {
    const q = defaultQueries.find((x) => x.id === id);
    if (!q) return;
    setQueryId(id);
    setText(q.sparql);
    setResult(executeSparql(bioGraph, q.sparql));
  };

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
          <div className="bio-view-toggle">
            <div
              className="bio-toggle-row"
              role="group"
              aria-label="Canvas view"
            >
              {CANVAS_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={
                    canvasView === v.id ? "bio-view-btn active" : "bio-view-btn"
                  }
                  onClick={() => setCanvasView(v.id)}
                >
                  {v.title}
                </button>
              ))}
              <span className="bio-view-caption" data-testid="bio-view-caption">
                {canvasView === "explore"
                  ? `${canvasUgm.getNodeIds().length} of ${ugm.nodeCount} nodes drawn; select a node and Expand: its neighbors join in place, seeded beside it and settled by one fcose pass with the drawn nodes held, camera untouched. Reset removes everything but the three diseases, in place.`
                  : `${canvasUgm.getNodeIds().length} nodes · ${
                      canvasView === "raw"
                        ? "every triple an edge; literals and rdf:type as nodes"
                        : `standard projection (${pipelineSteps.join(", ")}); panels always query this view`
                    }`}
              </span>
            </div>
            <div className="bio-toggle-row">
              <span
                className="bio-toggle-group"
                role="group"
                aria-label="Labels"
                title="Label collision: All draws every label (the previous behavior); Shorten truncates a losing label before hiding it; Hide drops it. Compare on the same scene: the pass is a restyle, nothing moves."
              >
                <span className="bio-toggle-label">Labels</span>
                {LABEL_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={
                      labelMode === m.id
                        ? "bio-view-btn active"
                        : "bio-view-btn"
                    }
                    onClick={() => setLabelMode(m.id)}
                  >
                    {m.title}
                  </button>
                ))}
              </span>
              {canvasView === "explore" && (
                <span
                  className="bio-toggle-group"
                  role="group"
                  aria-label="Explore"
                >
                  <span className="bio-toggle-label">Explore</span>
                  <button
                    type="button"
                    className="bio-view-btn"
                    disabled={nextDrawn === null}
                    title={
                      selectedId === null
                        ? "Select a node on the canvas, in the explorer, or from a chart bar"
                        : nextDrawn === null
                          ? "The selected node and its neighbors are already drawn"
                          : "Add the selected node's neighbors to the drawn graph"
                    }
                    onClick={() => {
                      if (nextDrawn !== null) setDrawn(nextDrawn);
                    }}
                  >
                    Expand selected
                  </button>
                  <button
                    type="button"
                    className="bio-view-btn"
                    disabled={drawn === seed}
                    onClick={() => setDrawn(seed)}
                  >
                    Reset
                  </button>
                </span>
              )}
            </div>
          </div>
          <CytoscapeCanvas
            ugm={canvasUgm}
            encodingSpec={SPEC}
            animate={!reducedMotion}
            labelCollision={labelMode}
            labelMaxLength={14}
            graphUpdate={canvasView === "explore" ? "additive" : "rebuild"}
          />
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
              onChange={(e) => {
                // 9.28: presets auto-run via pickQuery; edits auto-run
                // too (in-browser subset over a small graph), so the
                // Run button was redundant and is removed.
                setText(e.target.value);
                setResult(executeSparql(bioGraph, e.target.value));
              }}
            />
            <div className="bio-notice">
              This runs a curated in-browser executor (a SPARQL subset: basic
              graph patterns, FILTER, ORDER BY, LIMIT). For production, bundle a
              real engine (Comunica or Oxigraph via WASM) or point the toolkit's
              SparqlAdapter at an endpoint.
            </div>
            <CapabilityBubble
              accent="#b17ef0"
              items={[
                {
                  mechanism: "rdfToUgm",
                  how: "projects the instance triples into the graph the canvas renders; the ontology stays RDF.",
                },
                {
                  mechanism: "ProjectionPipeline",
                  anchor: "projection-pipeline-rdf-to-lpg",
                  how: "names the standard preset's collapse steps in the canvas caption; the Raw toggle shows the triple view those steps fold away.",
                },
                {
                  mechanism: "useSelectionStore",
                  anchor: "select-and-focus-a-node-of-interest",
                  how: "links the explorer, the chart bars, and the canvas: one selection, three views.",
                },
                {
                  mechanism: "encodingSpec",
                  anchor: "drive-the-encoding-from-app-state",
                  how: "colors nodes by rdf:type with the shared categorical palette.",
                },
                {
                  mechanism: "labelCollision",
                  anchor: "dense-graphs-let-labels-yield-to-each-other",
                  how: "thins overprinted labels after layout, zoom, drop, selection, and hover; the Labels control compares all, shorten, and hide on the same scene.",
                },
                {
                  mechanism: 'graphUpdate="additive"',
                  anchor: "grow-a-drawn-graph-without-rebuilding-it",
                  how: "grows the Explore view one neighborhood at a time in place: new nodes seed beside their neighbors, one fixed-node fcose pass settles them, and the camera holds.",
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
              xLabel={chartHint?.labelVar}
              yLabel={chartHint?.valueVar}
              selectedId={selectedId}
              onSelect={(id) => select([id])}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
