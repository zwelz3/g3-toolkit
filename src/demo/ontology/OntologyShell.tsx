/**
 * Ontology Workbench (Protege-style capability surface).
 *
 * Composes existing toolkit machinery over the seeded spacecraft
 * ontology (src/demo/ontology/model.ts):
 * - CytoscapeCanvas for the class hierarchy (breadthfirst), instance
 *   graph (fcose), and k-hop neighborhood; inferred edges render
 *   dashed via the toolkit's meta.asserted convention.
 * - The core SHACL structural pipeline (shaclShapesToStructural ->
 *   layoutStructural -> canvas structural prop) for the ELK shape
 *   view with [min..max] cardinality rows, closed-shape borders, and
 *   per-row validation severities; ShaclShapeBrowser as the property
 *   browser.
 * - The bio demo's in-browser SPARQL executor for scoped queries.
 * - The demo RDFS-plus reasoner behind an Asserted|Inferred toggle;
 *   every inferred axiom/typing is chipped, and the SHACL view
 *   carries the "validation is not inference" disclaimer.
 *
 * Coloring defaults (requirement 8): nodes are typed by class IRI, so
 * the canvas's palette assigns a stable color+shape per class; the
 * legend chips translate IRIs to labels. Charts in the stats rail are
 * plain div bars, deliberately: deterministic and jsdom-verifiable
 * where echarts is not.
 */
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  CytoscapeCanvas,
  TableView,
  ShaclShapeBrowser,
  useSelectionStore,
} from "@g3t/react";
import {
  layoutStructural,
  validateShacl,
  shaclShapesToStructural,
  closedShapeIds,
  shaclRowSeverities,
  type StructuralGeometry,
  type StructuralGraphInput,
} from "@g3t/core";
import { executeSparql, termText, type SparqlResult } from "../bio/sparql";
import { SurfaceFrame } from "../surfaces/DashboardSurfaces";
import { usePrefersReducedMotion } from "../components/usePrefersReducedMotion";
import {
  buildOntologyGraph,
  buildShapes,
  shapeReferences,
  shorten,
} from "./model";
import { materializeInferences } from "./reasoner";
import { OntologyStore, type EntityKind, type EntitySummary } from "./store";
import { classHierarchyUgm, instancesUgm, neighborhoodUgm } from "./project";
import { parseRdfFile } from "./import";

type LeftTab = "classes" | "properties" | "individuals";
type CenterTab =
  | "hierarchy"
  | "neighborhood"
  | "instances"
  | "shapes"
  | "sparql";

const DEFAULT_QUERIES: Array<{ id: string; label: string; sparql: string }> = [
  {
    id: "classes",
    label: "Ontology scope: all classes",
    sparql: `PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?class WHERE { ?class rdf:type owl:Class }`,
  },
  {
    id: "satellites",
    label: "Type scope: satellites and their mass",
    sparql: `PREFIX ex: <http://example.org/sat#>
SELECT ?sat ?mass WHERE { ?sat rdf:type ex:Satellite . ?sat ex:mass ?mass }`,
  },
  {
    id: "subsystems",
    label: "Instance scope: subsystems per system",
    sparql: `PREFIX ex: <http://example.org/sat#>
SELECT ?system ?subsystem WHERE { ?system ex:hasSubsystem ?subsystem }`,
  },
  {
    id: "contacts",
    label: "Inference demo: communication links (toggle inference)",
    sparql: `PREFIX ex: <http://example.org/sat#>
SELECT ?a ?b WHERE { ?a ex:communicatesWith ?b }`,
  },
  {
    id: "labels",
    label: "Ontology scope: labels",
    sparql: `SELECT ?s ?label WHERE { ?s rdfs:label ?label }`,
  },
];

const PANEL: React.CSSProperties = {
  border: "1px solid var(--g3t-border, #dee2e6)",
  borderRadius: 8,
  background: "var(--g3t-bg-primary, #fff)",
  overflow: "auto",
};

export function OntologyShell({ onBack }: { onBack: () => void }) {
  const reducedMotion = usePrefersReducedMotion();

  // ── Data: seeded graph + optional import, reasoner, store ────────
  const [imported, setImported] = useState<{
    name: string;
    triples: ReturnType<typeof buildOntologyGraph>["triples"];
  } | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const baseGraph = useMemo(() => buildOntologyGraph(), []);
  const graph = useMemo(
    () =>
      imported
        ? { triples: [...baseGraph.triples, ...imported.triples] }
        : baseGraph,
    [baseGraph, imported],
  );
  const inferredTriples = useMemo(() => materializeInferences(graph), [graph]);
  const store = useMemo(
    () => new OntologyStore(graph, inferredTriples),
    [graph, inferredTriples],
  );
  const [inferenceOn, setInferenceOn] = useState(false);
  const shapes = useMemo(() => buildShapes(), []);
  const stats = useMemo(() => store.stats(), [store]);

  // ── Selection: the toolkit store is the single source ────────────
  const selectedNodeIds = useSelectionStore((s) => s.selectedNodeIds);
  const selectedIri = useMemo(() => {
    for (const id of selectedNodeIds) {
      if (id.startsWith("http")) return id;
    }
    return null;
  }, [selectedNodeIds]);
  const select = (iri: string) =>
    useSelectionStore.getState().selectNodes([iri]);

  // ── UI state ─────────────────────────────────────────────────────
  const [leftTab, setLeftTab] = useState<LeftTab>("classes");
  const [centerTab, setCenterTab] = useState<CenterTab>("hierarchy");
  const [search, setSearch] = useState("");
  const [hops, setHops] = useState(2);
  const [scopeClass, setScopeClass] = useState<string | null>(null);

  // ── Projections ──────────────────────────────────────────────────
  const hierUgm = useMemo(
    () => classHierarchyUgm(store, inferenceOn),
    [store, inferenceOn],
  );
  const instUgm = useMemo(
    () => instancesUgm(store, inferenceOn, scopeClass),
    [store, inferenceOn, scopeClass],
  );
  const fullInstUgm = useMemo(
    () => instancesUgm(store, inferenceOn, null),
    [store, inferenceOn],
  );
  const neighborhood = useMemo(
    () =>
      selectedIri !== null
        ? neighborhoodUgm(
            fullInstUgm.hasNode(selectedIri) ? fullInstUgm : hierUgm,
            selectedIri,
            hops,
          )
        : null,
    [fullInstUgm, hierUgm, selectedIri, hops],
  );

  // ── SHACL: validate the toggle-selected graph; ELK shape view ────
  const validation = useMemo(
    () => validateShacl(fullInstUgm, shapes),
    [fullInstUgm, shapes],
  );
  const [structural, setStructural] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);
  useEffect(() => {
    if (centerTab !== "shapes" || structural !== null) return;
    const input = shaclShapesToStructural(shapes, {
      references: shapeReferences(),
    });
    let cancelled = false;
    void layoutStructural(input, { direction: "RIGHT" }).then((geometry) => {
      if (!cancelled) setStructural({ input, geometry });
    });
    return () => {
      cancelled = true;
    };
  }, [shapes, centerTab, structural]);
  const decorations = useMemo(
    () => ({
      closedContainers: closedShapeIds(shapes),
      rowSeverities: shaclRowSeverities(validation),
    }),
    [shapes, validation],
  );

  // ── SPARQL ───────────────────────────────────────────────────────
  const [queryId, setQueryId] = useState(DEFAULT_QUERIES[0]?.id ?? "classes");
  const [sparqlText, setSparqlText] = useState(
    DEFAULT_QUERIES[0]?.sparql ?? "",
  );
  const [sparqlResult, setSparqlResult] = useState<SparqlResult | null>(null);
  const runSparql = () =>
    setSparqlResult(executeSparql(store.graph(inferenceOn), sparqlText));

  // ── Import ───────────────────────────────────────────────────────
  const onImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void file.text().then(async (text) => {
      try {
        const result = await parseRdfFile(file.name, text);
        setImported({ name: file.name, triples: result.triples });
        setImportMsg(
          `Imported ${result.triples.length} triple(s) from ${file.name}.` +
            (result.warnings.length > 0 ? ` ${result.warnings.join(" ")}` : ""),
        );
      } catch (err) {
        setImportMsg(err instanceof Error ? err.message : String(err));
      }
    });
  };

  // ── Left rail content ────────────────────────────────────────────
  const searchResults = useMemo(() => store.search(search), [store, search]);

  const renderClassTree = (parent: string | null, depth: number): ReactNode =>
    store.childrenOf(parent).map((c) => (
      <div key={c.iri}>
        <EntityRow
          entity={c}
          depth={depth}
          selected={selectedIri === c.iri}
          onSelect={select}
        />
        {renderClassTree(c.iri, depth + 1)}
      </div>
    ));

  const propertyGroups: Array<[string, EntityKind]> = [
    ["Object properties", "ObjectProperty"],
    ["Datatype properties", "DatatypeProperty"],
    ["Annotation properties", "AnnotationProperty"],
  ];

  return (
    <SurfaceFrame
      title="Ontology Workbench"
      subtitle="Protege-style browsing over toolkit components: hierarchy, neighborhood, instances, SHACL (ELK), SPARQL, and a demo RDFS-plus reasoner"
      accent="#7048e8"
      onBack={onBack}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 320px",
          gap: 8,
          padding: 8,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ── Left rail: browser ─────────────────────────────────── */}
        <div style={{ ...PANEL, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              padding: 8,
              borderBottom: "1px solid var(--g3t-border, #eee)",
            }}
          >
            <input
              data-testid="ow-search"
              placeholder="Search entities"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                fontSize: 12,
                padding: "4px 6px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {(["classes", "properties", "individuals"] as const).map((t) => (
                <TabButton
                  key={t}
                  testId={`ow-tab-${t}`}
                  active={leftTab === t}
                  onClick={() => setLeftTab(t)}
                  label={t[0]?.toUpperCase() + t.slice(1)}
                />
              ))}
            </div>
          </div>
          <div
            style={{ overflow: "auto", flex: 1, padding: "4px 0" }}
            data-testid="ow-browser"
          >
            {search.trim() !== "" ? (
              searchResults.length === 0 ? (
                <div style={{ padding: 8, fontSize: 12, color: "#888" }}>
                  No matches.
                </div>
              ) : (
                searchResults.map((r) => (
                  <EntityRow
                    key={r.iri}
                    entity={r}
                    depth={0}
                    selected={selectedIri === r.iri}
                    onSelect={select}
                    showKind
                  />
                ))
              )
            ) : leftTab === "classes" ? (
              <div data-testid="ow-class-tree">{renderClassTree(null, 0)}</div>
            ) : leftTab === "properties" ? (
              propertyGroups.map(([title, kind]) => (
                <div key={kind}>
                  <div style={groupHeaderStyle}>{title}</div>
                  {store.entities(kind).map((p) => (
                    <EntityRow
                      key={p.iri}
                      entity={p}
                      depth={0}
                      selected={selectedIri === p.iri}
                      onSelect={select}
                    />
                  ))}
                </div>
              ))
            ) : (
              store
                .entities("Individual")
                .map((i) => (
                  <EntityRow
                    key={i.iri}
                    entity={i}
                    depth={0}
                    selected={selectedIri === i.iri}
                    onSelect={select}
                  />
                ))
            )}
          </div>
        </div>

        {/* ── Center: views ──────────────────────────────────────── */}
        <div
          style={{
            ...PANEL,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              padding: 8,
              borderBottom: "1px solid var(--g3t-border, #eee)",
              flexWrap: "wrap",
            }}
          >
            {(
              [
                ["hierarchy", "Hierarchy"],
                ["neighborhood", "Neighborhood"],
                ["instances", "Instances"],
                ["shapes", "SHACL shapes"],
                ["sparql", "SPARQL"],
              ] as Array<[CenterTab, string]>
            ).map(([t, label]) => (
              <TabButton
                key={t}
                testId={`ow-view-${t}`}
                active={centerTab === t}
                onClick={() => setCenterTab(t)}
                label={label}
              />
            ))}
            <span style={{ flex: 1 }} />
            <label
              style={{
                fontSize: 11,
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              <input
                data-testid="ow-inference-toggle"
                type="checkbox"
                checked={inferenceOn}
                onChange={(e) => setInferenceOn(e.target.checked)}
              />
              Show inferred (demo RDFS-plus reasoner: {stats.inferredTriples}{" "}
              triples)
            </label>
            <label
              className="g3t-btn"
              style={{ fontSize: 11, cursor: "pointer", padding: "3px 8px" }}
            >
              Import RDF
              <input
                data-testid="ow-import-input"
                type="file"
                accept=".ttl,.n3,.nt,.nq,.trig,.jsonld,.json,.owl,.rdf,.xml"
                style={{ display: "none" }}
                onChange={onImport}
              />
            </label>
            {imported !== null && (
              <button
                className="g3t-btn"
                style={{ fontSize: 11 }}
                onClick={() => {
                  setImported(null);
                  setImportMsg(null);
                }}
              >
                Reset to seed
              </button>
            )}
          </div>
          {importMsg !== null && (
            <div
              data-testid="ow-import-msg"
              style={{ padding: "4px 8px", fontSize: 11, color: "#7048e8" }}
            >
              {importMsg}
            </div>
          )}

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {centerTab === "hierarchy" && (
              <>
                <Legend
                  items={[
                    ["solid edge", "asserted subClassOf"],
                    ["dashed edge", "inferred (equivalence/transitivity)"],
                  ]}
                />
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CytoscapeCanvas
                    ugm={hierUgm}
                    layout="breadthfirst"
                    animate={!reducedMotion}
                  />
                </div>
              </>
            )}
            {centerTab === "neighborhood" && (
              <>
                <div
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span>Hops:</span>
                  <select
                    data-testid="ow-hops"
                    value={hops}
                    onChange={(e) => setHops(Number(e.target.value))}
                  >
                    {[1, 2, 3].map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span style={{ color: "#888" }}>
                    {selectedIri !== null
                      ? `around ${store.labelOf(selectedIri)}`
                      : "select an entity in the browser"}
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  {neighborhood !== null &&
                  neighborhood.getNodeIds().length > 0 ? (
                    <CytoscapeCanvas
                      ugm={neighborhood}
                      animate={!reducedMotion}
                    />
                  ) : (
                    <EmptyNote testId="ow-neighborhood-empty">
                      Select a class or individual to see its {hops}-hop
                      neighborhood.
                    </EmptyNote>
                  )}
                </div>
              </>
            )}
            {centerTab === "instances" && (
              <>
                <div
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span>Scope:</span>
                  <select
                    data-testid="ow-scope"
                    value={scopeClass ?? ""}
                    onChange={(e) =>
                      setScopeClass(
                        e.target.value === "" ? null : e.target.value,
                      )
                    }
                  >
                    <option value="">All individuals</option>
                    {stats.instancesPerClass.map((c) => (
                      <option key={c.iri} value={c.iri}>
                        {c.label} ({c.count})
                      </option>
                    ))}
                  </select>
                  <span style={{ color: "#888" }}>
                    colored by class; dashed edges are inferred
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CytoscapeCanvas ugm={instUgm} animate={!reducedMotion} />
                </div>
                <div
                  style={{
                    maxHeight: 220,
                    overflow: "auto",
                    borderTop: "1px solid var(--g3t-border, #eee)",
                  }}
                >
                  <TableView ugm={instUgm} pageSize={10} density="compact" />
                </div>
              </>
            )}
            {centerTab === "shapes" && (
              <>
                <div
                  data-testid="ow-shacl-note"
                  style={{ padding: "6px 8px", fontSize: 11, color: "#666" }}
                >
                  Shapes are toolkit ShaclShape structures (not shape triples),
                  rendered through the core SHACL-to-structural pipeline with
                  ELK layout; rows carry [min..max] cardinality and validation
                  severity, closed shapes a solid border.
                  {inferenceOn && (
                    <strong>
                      {" "}
                      Note: SHACL validation does not perform inference. The
                      reasoner materialized typings first; results differ from
                      the asserted graph only because of that pre-step.
                    </strong>
                  )}
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  {structural !== null ? (
                    <CytoscapeCanvas
                      ugm={hierUgm /* ignored when structural is set */}
                      structural={structural}
                      structuralDecorations={decorations}
                      animate={!reducedMotion}
                    />
                  ) : (
                    <EmptyNote testId="ow-shapes-loading">
                      Laying out shapes…
                    </EmptyNote>
                  )}
                </div>
              </>
            )}
            {centerTab === "sparql" && (
              <div
                style={{
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    data-testid="ow-sparql-preset"
                    value={queryId}
                    onChange={(e) => {
                      const q = DEFAULT_QUERIES.find(
                        (d) => d.id === e.target.value,
                      );
                      setQueryId(e.target.value);
                      if (q) setSparqlText(q.sparql);
                    }}
                    style={{ fontSize: 12 }}
                  >
                    {DEFAULT_QUERIES.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                  <button
                    data-testid="ow-run-sparql"
                    className="g3t-btn"
                    style={{ fontSize: 12 }}
                    onClick={runSparql}
                  >
                    Run over {inferenceOn ? "asserted+inferred" : "asserted"}{" "}
                    graph
                  </button>
                </div>
                <textarea
                  data-testid="ow-sparql-text"
                  value={sparqlText}
                  onChange={(e) => setSparqlText(e.target.value)}
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    minHeight: 90,
                    padding: 6,
                  }}
                />
                <div
                  style={{ flex: 1, overflow: "auto" }}
                  data-testid="ow-sparql-results"
                >
                  {sparqlResult === null ? (
                    <div style={{ fontSize: 12, color: "#888" }}>
                      Run a query to see bindings.
                    </div>
                  ) : sparqlResult.ok ? (
                    <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {sparqlResult.head.map((h) => (
                            <th key={h} style={cellStyle}>
                              ?{h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sparqlResult.rows.map((row, i) => (
                          <tr key={i} data-testid="ow-sparql-row">
                            {sparqlResult.head.map((h) => {
                              const term = row[h];
                              const text = term ? termText(term) : "";
                              return (
                                <td key={h} style={cellStyle} title={text}>
                                  {shorten(text)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 12, color: "#c92a2a" }}>
                      {sparqlResult.error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right rail: details + shapes browser + stats ───────── */}
        <div
          style={{ ...PANEL, padding: 8, fontSize: 12 }}
          data-testid="ow-details"
        >
          {selectedIri !== null ? (
            <EntityDetails
              store={store}
              iri={selectedIri}
              shapes={shapes}
              inferenceOn={inferenceOn}
              onSelect={select}
              onShowShapes={() => setCenterTab("shapes")}
            />
          ) : (
            <div style={{ color: "#888" }}>
              Select an entity to see annotations, axioms, and targeting shapes.
            </div>
          )}
          {centerTab === "shapes" && (
            <div style={{ marginTop: 8 }}>
              <div style={groupHeaderStyle}>SHACL property browser</div>
              <ShaclShapeBrowser
                shapes={shapes}
                validationResults={validation}
                onSelectShape={() => undefined}
              />
            </div>
          )}
          <div style={{ marginTop: 12 }} data-testid="ow-stats">
            <div style={groupHeaderStyle}>Ontology statistics</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                margin: "4px 0",
              }}
            >
              {(
                [
                  ["triples", stats.triples],
                  ["inferred", stats.inferredTriples],
                  ["classes", stats.classes],
                  ["obj props", stats.objectProperties],
                  ["data props", stats.datatypeProperties],
                  ["ann props", stats.annotationProperties],
                  ["individuals", stats.individuals],
                ] as Array<[string, number]>
              ).map(([label, value]) => (
                <span key={label} style={chipStyle}>
                  {label}: <strong>{value}</strong>
                </span>
              ))}
            </div>
            <div style={{ marginTop: 6 }}>
              {stats.instancesPerClass.slice(0, 8).map((c) => {
                const max = stats.instancesPerClass[0]?.count ?? 1;
                return (
                  <div
                    key={c.iri}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "1px 0",
                    }}
                  >
                    <span
                      style={{
                        width: 110,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                    </span>
                    <div
                      style={{
                        height: 8,
                        width: `${(c.count / max) * 140}px`,
                        background: "#7048e8",
                        borderRadius: 2,
                      }}
                    />
                    <span>{c.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </SurfaceFrame>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function EntityRow({
  entity,
  depth,
  selected,
  onSelect,
  showKind = false,
}: {
  entity: EntitySummary;
  depth: number;
  selected: boolean;
  onSelect: (iri: string) => void;
  showKind?: boolean;
}) {
  return (
    <button
      data-testid={`ow-entity-${shorten(entity.iri)}`}
      onClick={() => onSelect(entity.iri)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        background: selected ? "rgba(112, 72, 232, 0.12)" : "transparent",
        cursor: "pointer",
        fontSize: 12,
        padding: `2px 8px 2px ${8 + depth * 14}px`,
      }}
    >
      {entity.label}
      {showKind && (
        <span style={{ color: "#888", marginLeft: 6, fontSize: 10 }}>
          {entity.kind}
        </span>
      )}
      {entity.inferredKind && <InferredChip />}
    </button>
  );
}

function EntityDetails({
  store,
  iri,
  shapes,
  inferenceOn,
  onSelect,
  onShowShapes,
}: {
  store: OntologyStore;
  iri: string;
  shapes: ReturnType<typeof buildShapes>;
  inferenceOn: boolean;
  onSelect: (iri: string) => void;
  onShowShapes: () => void;
}) {
  const kind = store.kindOf(iri);
  const axioms = store.axiomsOf(iri).filter((a) => inferenceOn || !a.inferred);
  const annotations = store.annotationsOf(iri);
  const targeting = shapes.filter((s) => s.targetClass === iri);
  const instances = (
    kind?.kind === "Class" ? store.instancesOf(iri) : []
  ).filter((i) => inferenceOn || !i.inferred);
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{store.labelOf(iri)}</div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "#888",
          wordBreak: "break-all",
        }}
      >
        {shorten(iri)}
      </div>
      {kind !== null && (
        <span style={{ ...chipStyle, background: "#7048e8", color: "#fff" }}>
          {kind.kind}
        </span>
      )}
      {annotations.length > 0 && (
        <>
          <div style={groupHeaderStyle}>Annotations</div>
          {annotations.map((a, i) => (
            <div key={i} style={{ padding: "1px 0" }}>
              <span style={{ color: "#888" }}>{a.predicate}</span> {a.value}
            </div>
          ))}
        </>
      )}
      {axioms.length > 0 && (
        <>
          <div style={groupHeaderStyle}>Axioms</div>
          {axioms.map((a, i) => (
            <div
              key={i}
              data-testid="ow-axiom"
              data-inferred={a.inferred ? "true" : "false"}
              style={{
                padding: "1px 0",
                fontFamily: "monospace",
                fontSize: 11,
              }}
            >
              {a.text}
              {a.inferred && <InferredChip />}
            </div>
          ))}
        </>
      )}
      {targeting.length > 0 && (
        <>
          <div style={groupHeaderStyle}>Targeting SHACL shapes</div>
          {targeting.map((s) => (
            <button
              key={s.id}
              data-testid={`ow-shape-link-${s.name ?? s.id}`}
              className="g3t-btn"
              style={{ fontSize: 11, marginRight: 4 }}
              onClick={onShowShapes}
            >
              {s.name ?? shorten(s.id)} ({s.properties.length} constraints)
            </button>
          ))}
        </>
      )}
      {instances.length > 0 && (
        <>
          <div style={groupHeaderStyle}>Instances ({instances.length})</div>
          {instances.map((i) => (
            <button
              key={i.iri}
              onClick={() => onSelect(i.iri)}
              style={{
                display: "block",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 11,
                padding: "1px 0",
                textAlign: "left",
              }}
            >
              {i.label}
              {i.inferred && <InferredChip />}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function InferredChip() {
  return (
    <span
      data-testid="ow-inferred-chip"
      style={{
        marginLeft: 6,
        padding: "0 5px",
        fontSize: 9,
        borderRadius: 8,
        background: "#e5dbff",
        color: "#5f3dc4",
      }}
    >
      inferred
    </span>
  );
}

function TabButton({
  testId,
  active,
  onClick,
  label,
}: {
  testId: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 4,
        border: "1px solid var(--g3t-border, #ccc)",
        background: active ? "#7048e8" : "transparent",
        color: active ? "#fff" : "inherit",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div
      data-testid="ow-legend"
      style={{
        display: "flex",
        gap: 12,
        padding: "4px 8px",
        fontSize: 11,
        color: "#666",
      }}
    >
      {items.map(([k, v]) => (
        <span key={k}>
          <strong>{k}</strong>: {v}
        </span>
      ))}
    </div>
  );
}

function EmptyNote({
  testId,
  children,
}: {
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={{ padding: 16, fontSize: 12, color: "#888" }}
    >
      {children}
    </div>
  );
}

const groupHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#888",
  padding: "8px 8px 2px 0",
  fontWeight: 600,
};

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 8,
  background: "var(--g3t-bg-secondary, #f1f3f5)",
  fontSize: 10,
  margin: "2px 2px 2px 0",
};

const cellStyle: React.CSSProperties = {
  border: "1px solid var(--g3t-border, #dee2e6)",
  padding: "2px 8px",
  textAlign: "left",
};
