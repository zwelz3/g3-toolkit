/**
 * Executable wiring examples (docs/wiring-guide.md, round 22).
 *
 * Each test mirrors a guide snippet, importing ONLY from the public
 * package entry points the way an adopter would. If a snippet in the
 * guide stops compiling or behaving, this file fails CI: the guide
 * cannot rot silently, and the public barrels cannot quietly drop
 * the integration surface (round 22 found exactly that: workspace
 * and AlgorithmPanel were missing from the root barrel until this
 * file forced the issue).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Core } from "cytoscape";
import {
  UGM,
  routeSceneEdges,
  polylineToCytoscapeSegments,
  parseAlgorithmResult,
  applyAlgorithmResult,
  ingestAlgorithmResults,
  layoutStructural,
  isChainEdgeId,
  shaclShapesToStructural,
  shaclRowSeverities,
  closedShapeIds,
  shaclRowId,
  validateShacl,
  reportFromValidationResults,
  severityOverlays,
  shaclResultDrivers,
  resultSelectionIds,
  resultDetail,
  findShortestPath,
  exportSubgraphJson,
  exportSubgraphCsv,
  createPresetPipeline,
  ProjectionPipeline,
  typeCollapse,
  collapseByCluster,
  buildSubgraph,
  bundleEdges,
  bundledPolylineToSegments,
  optimizePlacement,
  G3tEventBus,
  HolonicAdapter,
  projectTripleTermsAsEdges,
  projectTripleTermsAsHyperarcs,
  STAR_EDGE_TYPE,
  RDF_STATEMENT_FLAG,
  type HolonicDataset,
  type RDFGraph,
  type RdfTerm,
  type TripleTermAnnotation,
} from "@g3t/core";
import {
  usePositionPinStore,
  useSelectionStore,
  useOverlayStore,
  useThemeStore,
  runGraphLayout,
  buildImageExport,
  DEFAULT_LAYOUT_OPTIONS,
  ContextMenuManager,
  captureWorkspace,
  applyWorkspace,
  serializeWorkspace,
  parseWorkspace,
  structuralToCytoscapeElements,
  FacetFilter,
  applyEncodingSpec,
  createTheme,
  createCameraController,
  labelWrapRule,
  useEmphasisStore,
  ProvenanceTrace,
  Minimap,
  createDefaultMenuManager,
  registerToolkitActions,
  registerHolonDrillItems,
  ViewErrorBoundary,
  type ProvenanceChain,
} from "@g3t/react";

beforeEach(() => {
  usePositionPinStore.setState({ pinnedIds: [], allPinned: false });
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
  useOverlayStore.getState().clear();
});

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("asset-1", { types: ["Asset"], properties: { name: "Pump" } });
  ugm.addNode("asset-2", { types: ["Asset"], properties: { name: "Valve" } });
  ugm.addEdge("asset-1", "asset-2", { type: "feeds", properties: {} });
  return ugm;
}

describe("wiring guide: custom buttons", () => {
  it("pin-all button: one store flag, aria-pressed follows", () => {
    function PinAllButton() {
      const allPinned = usePositionPinStore((s) => s.allPinned);
      return (
        <button
          className="g3t-btn"
          aria-pressed={allPinned}
          onClick={() =>
            usePositionPinStore.getState().setAllPinned(!allPinned)
          }
        >
          {allPinned ? "Unpin all" : "Pin all"}
        </button>
      );
    }
    render(<PinAllButton />);
    fireEvent.click(screen.getByText("Pin all"));
    expect(usePositionPinStore.getState().allPinned).toBe(true);
    expect(screen.getByText("Unpin all").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("focus button: selection store + camera through the cy handle", () => {
    const animate = vi.fn();
    const cy = {
      getElementById: vi.fn(() => ({ nonempty: () => true })),
      animate,
    } as unknown as Core;
    function FocusButton({ nodeId }: { nodeId: string }) {
      return (
        <button
          className="g3t-btn"
          onClick={() => {
            useSelectionStore.getState().selectNodes([nodeId]);
            const ele = cy.getElementById(nodeId);
            if (ele.nonempty()) {
              cy.animate(
                { center: { eles: ele }, zoom: 1.4 },
                { duration: 250 },
              );
            }
          }}
        >
          Focus suspect asset
        </button>
      );
    }
    render(<FocusButton nodeId="asset-1" />);
    fireEvent.click(screen.getByText("Focus suspect asset"));
    expect([...useSelectionStore.getState().selectedNodeIds]).toEqual([
      "asset-1",
    ]);
    expect(animate).toHaveBeenCalled();
  });

  it("re-layout button: runGraphLayout with the exported defaults", () => {
    const run = vi.fn();
    const cy = { layout: vi.fn(() => ({ run })) } as unknown as Core;
    runGraphLayout(cy, "force", DEFAULT_LAYOUT_OPTIONS);
    expect(run).toHaveBeenCalled();
  });

  it("theme from app settings", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme.id).toBe("dark");
    useThemeStore.getState().setTheme("light");
  });

  it("algorithm result from a backend response, overlay registered", () => {
    const ugm = graph();
    const backendJson = JSON.stringify({
      version: 1,
      kind: "overlay",
      algorithm: "networkx.k_core",
      overlay: { id: "core-2", label: "2-core", nodeIds: ["asset-1"] },
    });
    const overlay = applyAlgorithmResult(
      ugm,
      parseAlgorithmResult(backendJson),
      ingestAlgorithmResults,
    );
    if (overlay) useOverlayStore.getState().register(overlay);
    expect(useOverlayStore.getState().activeIds).toEqual(["core-2"]);
  });

  it("custom context-menu action resolves for node targets", () => {
    const navigate = vi.fn();
    const manager = new ContextMenuManager();
    manager.register("my-app", [
      {
        id: "open-dossier",
        label: "Open dossier",
        filter: (t) => t.type === "node",
        action: (t) => navigate(`/dossier/${t.id ?? ""}`),
      },
    ]);
    const target = {
      type: "node" as const,
      id: "asset-1",
      position: { x: 0, y: 0 },
    };
    const item = manager.resolve(target).find((i) => i.id === "open-dossier");
    expect(item).toBeTruthy();
    item!.action(target);
    expect(navigate).toHaveBeenCalledWith("/dossier/asset-1");
  });
});

describe("wiring guide: when a view fails to render", () => {
  /** Stands in for any view that throws during render. */
  function Exploding({ live }: { live: () => boolean }): React.ReactNode {
    if (live()) throw new Error("could not build the scene");
    return <p>rendered</p>;
  }

  it("the boundary replaces a blank page with a message, a report and a retry", () => {
    const logError = vi.fn();
    let broken = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ViewErrorBoundary
        onError={(error, info) => logError(error, info.componentStack)}
        fallback={({ error, retry }) => (
          <div>
            <p>The graph could not render: {error.message}</p>
            <button onClick={retry}>Try again</button>
          </div>
        )}
      >
        <Exploding live={() => broken} />
      </ViewErrorBoundary>,
    );
    expect(
      screen.getByText("The graph could not render: could not build the scene"),
    ).toBeTruthy();
    expect(logError).toHaveBeenCalledTimes(1);

    broken = false;
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("rendered")).toBeTruthy();
    spy.mockRestore();
  });
});

describe("wiring guide: toolkit state driving the host", () => {
  it("non-React subscription notifies a process engine on selection", () => {
    const notify = vi.fn();
    const unsubscribe = useSelectionStore.subscribe((state) => {
      notify("selection", [...state.selectedNodeIds]);
    });
    useSelectionStore.getState().selectNodes(["asset-2"]);
    expect(notify).toHaveBeenCalledWith("selection", ["asset-2"]);
    unsubscribe();
  });

  it("workspace snapshot round-trips through host storage", () => {
    usePositionPinStore.getState().pin("asset-1");
    const snapshot = captureWorkspace({ cy: null });
    const stored = serializeWorkspace(snapshot); // your storage layer
    usePositionPinStore.getState().clear();
    applyWorkspace(parseWorkspace(stored), { cy: null });
    expect(usePositionPinStore.getState().pinnedIds).toEqual(["asset-1"]);
  });
});

describe("wiring guide: structural (UML-style) layout", () => {
  it("returns a version-1 geometry document of absolute boxes with real row elements", async () => {
    const geometry = await layoutStructural({
      nodes: [
        {
          id: "sensor",
          header: { stereotype: "Block", name: "Sensor" },
          compartments: [
            {
              id: "attributes",
              title: "attributes",
              rows: [
                {
                  id: "sensor.cal",
                  text: "calibrationDate : xsd:date [1..1]",
                },
              ],
            },
          ],
          ports: [{ id: "sensor.out", side: "EAST" }],
        },
        { id: "lens", header: { name: "Lens" } },
      ],
      edges: [
        {
          id: "feeds",
          source: "sensor",
          target: "lens",
          sourcePort: "sensor.out",
        },
      ],
    });
    expect(geometry.version).toBe(1);
    // Rows are real elements with renderer passthroughs:
    const row = geometry.nodes["sensor.cal"]!;
    expect(row.kind).toBe("row");
    expect(row.parent).toBe("sensor");
    expect(row.compartment).toBe("attributes");
    expect(row.text).toBe("calibrationDate : xsd:date [1..1]");
    // Compartment titles arrive as divider rows:
    const divider = geometry.nodes["sensor::attributes::title"]!;
    expect(divider.divider).toBe(true);
    // Ports carry their declared side:
    expect(geometry.ports["sensor.out"]!.side).toBe("EAST");
    // Synthetic ordering edges are identifiable for filtering:
    expect(isChainEdgeId("g3t-chain:a->b")).toBe(true);
    expect(isChainEdgeId("feeds")).toBe(false);
  });

  it("tags UML edge kinds onto the converted edge (A3)", async () => {
    const input = {
      nodes: [
        { id: "whole", header: { name: "Whole" }, compartments: [] },
        { id: "part", header: { name: "Part" }, compartments: [] },
      ],
      edges: [
        {
          id: "c",
          source: "whole",
          target: "part",
          kind: "composition" as const,
        },
      ],
    };
    const geometry = await layoutStructural(input);
    const edge = structuralToCytoscapeElements(input, geometry).find(
      (e) => e.data.id === "c",
    )!;
    expect(edge.classes).toContain("g3t-uml-composition");
    expect(edge.data._kind).toBe("composition");
  });
});

describe("wiring guide: SHACL shape view through the compartment API", () => {
  const shapes = [
    {
      id: "PersonShape",
      targetClass: "Person",
      name: "Person",
      closed: true,
      properties: [
        { path: "name", datatype: "string" as const, minCount: 1, maxCount: 1 },
        { path: "age", datatype: "number" as const, minInclusive: 0 },
      ],
    },
    {
      id: "OrgShape",
      targetClass: "Org",
      name: "Organization",
      properties: [
        { path: "legalName", datatype: "string" as const, minCount: 1 },
      ],
    },
  ];

  it("maps shapes to the same structural input the UML views use", async () => {
    const input = shaclShapesToStructural(shapes, {
      references: { "PersonShape::worksFor": "OrgShape" },
    });
    const geometry = await layoutStructural(input);
    // NodeShape containers with property-shape rows:
    expect(geometry.nodes["PersonShape"]!.kind).toBe("container");
    const nameRow = geometry.nodes[shaclRowId("PersonShape", "name")]!;
    expect(nameRow.kind).toBe("row");
    expect(nameRow.text).toBe("name : xsd:string [1..1]");
    // sh:node-style reference edge present:
    expect(input.edges.some((e) => e.target === "OrgShape")).toBe(true);
  });

  it("derives closed shapes and per-row severities for canvas decorations", () => {
    expect([...closedShapeIds(shapes)]).toEqual(["PersonShape"]);
    const severities = shaclRowSeverities([
      {
        nodeId: "p1",
        shapeId: "PersonShape",
        shapeName: "Person",
        targetClass: "Person",
        valid: false,
        violations: [
          { path: "name", message: "missing", severity: "violation" },
        ],
      },
    ]);
    expect(severities.get(shaclRowId("PersonShape", "name"))).toBe("violation");
  });
});

describe("wiring guide: SHACL validation report over the data graph", () => {
  beforeEach(() => {
    useOverlayStore.getState().clear();
  });

  it("renders a report by registering severity overlays and ingesting drivers", () => {
    const ugm = new UGM();
    ugm.addNode("c1", { types: ["Component"], properties: { name: "c1" } });
    ugm.addNode("c2", {
      types: ["Component"],
      properties: { name: "c2", partNumber: "P-2" },
    });
    const shapes = [
      {
        id: "ComponentShape",
        targetClass: "Component",
        properties: [
          { path: "name", datatype: "string" as const, minCount: 1 },
          { path: "partNumber", datatype: "string" as const, minCount: 1 },
        ],
      },
    ];
    const report = reportFromValidationResults(validateShacl(ugm, shapes));
    // c1 lacks partNumber -> a violation; c2 conforms.
    expect(report.conforms).toBe(false);

    // Severity overlays register and activate:
    for (const overlay of severityOverlays(report)) {
      useOverlayStore.getState().register(overlay, true);
    }
    expect(useOverlayStore.getState().overlays.length).toBeGreaterThan(0);
    expect(useOverlayStore.getState().activeIds).toContain("shacl-violation");

    // Drivers ingest onto the failing node:
    ingestAlgorithmResults(ugm, shaclResultDrivers(report));
    expect(ugm.getNode("c1")!.properties._shacl_resultCount).toBe(1);
    expect(ugm.getNode("c1")!.properties._shacl_maxSeverity).toBe("violation");
    // The conforming node carries no driver props.
    expect(ugm.getNode("c2")!.properties._shacl_resultCount).toBeUndefined();
  });
});

describe("wiring guide: linked shape + data views (B4)", () => {
  it("cross-selects focus node, shape container, and property row from a result", () => {
    const result = {
      focusNode: "person-1",
      path: "name",
      severity: "violation" as const,
      sourceShape: "PersonShape",
      message: "missing required name",
    };
    const ids = resultSelectionIds(result);
    expect(ids).toEqual([
      "person-1",
      "PersonShape",
      shaclRowId("PersonShape", "name"),
    ]);
    // Feeding these to the shared selection store links every canvas.
    useSelectionStore.getState().selectNodes(ids);
    expect([...useSelectionStore.getState().selectedNodeIds].sort()).toEqual(
      [...ids].sort(),
    );

    // resultDetail shapes the same result for an inspector panel.
    expect(resultDetail(result)).toMatchObject({
      focusNode: "person-1",
      sourceShape: "PersonShape",
      path: "name",
      severity: "violation",
    });
  });
});

describe("wiring guide: filter by hiding, not by rebuilding", () => {
  it("FacetFilter emits the toggled type to onFilterChange", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Asset"], properties: {} });
    ugm.addNode("b", { types: ["Site"], properties: {} });
    const onFilterChange = vi.fn();
    render(<FacetFilter ugm={ugm} onFilterChange={onFilterChange} />);
    // Unchecking a type adds it to the emitted hidden-types set.
    const row = screen.getByTestId("facet-Asset");
    fireEvent.click(row.querySelector("input")!);
    const emitted = onFilterChange.mock.calls.at(-1)![0] as Set<string>;
    expect(emitted.has("Asset")).toBe(true);
  });

  it("maps hidden types to node ids with faceted (all-types) semantics", () => {
    const ugm = new UGM();
    ugm.addNode("only-asset", { types: ["Asset"], properties: {} });
    ugm.addNode("both", { types: ["Asset", "Site"], properties: {} });
    // The guide's derivation: a node is hidden only when ALL its types
    // are hidden; "both" survives while "Site" is still shown.
    const hiddenTypes = new Set(["Asset"]);
    const hidden = new Set<string>();
    ugm.forEachNode((id, attrs) => {
      if (
        attrs.types.length > 0 &&
        attrs.types.every((t) => hiddenTypes.has(t))
      )
        hidden.add(id);
    });
    expect(hidden.has("only-asset")).toBe(true);
    expect(hidden.has("both")).toBe(false);
  });
});

// ── Programmatic APIs (flagship-retirement fold, 2026-07-03) ────────
// The flagship example was the only demonstration of these public
// APIs; retiring it moved their demonstrations here so the guide
// snippets stay compilable and behavioral under CI.
describe("projection pipeline (guide: Projection pipeline)", () => {
  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const EX = "http://example.org/";
  const tinyRdf: RDFGraph = {
    triples: [
      {
        subject: `${EX}p53`,
        predicate: RDF_TYPE,
        object: `${EX}Protein`,
        objectType: "uri",
      },
      {
        subject: `${EX}p53`,
        predicate: `${EX}label`,
        object: "Cellular tumor antigen p53",
        objectType: "literal",
      },
      {
        subject: `${EX}p53`,
        predicate: `${EX}regulates`,
        object: `${EX}mdm2`,
        objectType: "uri",
      },
      {
        subject: `${EX}mdm2`,
        predicate: RDF_TYPE,
        object: `${EX}Protein`,
        objectType: "uri",
      },
    ],
  };

  it("the standard preset collapses rdf:type into node types and literals into properties", () => {
    const ugm = createPresetPipeline("standard").project(tinyRdf);
    const p53 = ugm.getNode(`${EX}p53`);
    expect(p53?.types).toContain("Protein");
    expect(p53?.properties.label).toBe("Cellular tumor antigen p53");
    // The Protein class resource is folded away, not rendered as a node.
    expect(ugm.hasNode(`${EX}Protein`)).toBe(false);
    // The object relation survives as an edge.
    expect(ugm.getEdgesBetween(`${EX}p53`, `${EX}mdm2`).length).toBe(1);
  });

  it("a custom pipeline runs exactly the steps you add", () => {
    const p = new ProjectionPipeline();
    p.addStep({
      name: "Type Collapse",
      transform: typeCollapse,
      enabled: true,
    });
    const ugm = p.project(tinyRdf);
    expect(ugm.getNode(`${EX}p53`)?.types).toContain("Protein");
    // Steps are inspectable (BioShell renders these names in its caption).
    expect(p.getSteps().map((st) => st.name)).toEqual(["Type Collapse"]);
  });
});

describe("context menu base contract (guide: Add your action to the canvas context menu)", () => {
  it("zero config: one clipboard-wired copy item, labeled by id shape", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const manager = createDefaultMenuManager();
    const rdf = manager.resolve({
      type: "node",
      id: "http://example.org/p53",
      position: { x: 0, y: 0 },
    });
    expect(rdf.map((i) => i.label)).toEqual(["Copy IRI"]);
    const lpg = manager.resolve({
      type: "node",
      id: "supplier-7",
      position: { x: 0, y: 0 },
    });
    expect(lpg.map((i) => i.label)).toEqual(["Copy ID"]);
    lpg[0]!.action({
      type: "node",
      id: "supplier-7",
      position: { x: 0, y: 0 },
    });
    expect(writeText).toHaveBeenCalledWith("supplier-7");
    vi.unstubAllGlobals();
  });

  it("registerToolkitActions: the full set resolves; emit-only items reach the bus", () => {
    const bus = new G3tEventBus();
    const manager = new ContextMenuManager();
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"], properties: {} });
    ugm.addNode("b", { types: ["T"], properties: {} });
    ugm.addEdge("a", "b", { type: "r" });
    registerToolkitActions(manager, { ugm, eventBus: bus, defaultHops: 2 });
    const seen: unknown[] = [];
    bus.on("context:focusNode", (d) => seen.push(d));
    const items = manager.resolve({
      type: "node",
      id: "a",
      position: { x: 0, y: 0 },
    });
    expect(items.map((i) => i.label)).toContain("Focus (2-hop)");
    items
      .find((i) => i.label === "Focus (2-hop)")!
      .action({ type: "node", id: "a", position: { x: 0, y: 0 } });
    expect(seen).toEqual([{ nodeId: "a", hops: 2 }]);
  });

  it("Inspect appears only when wired; registered app items resolve after built-ins", () => {
    const onInspect = vi.fn();
    const manager = createDefaultMenuManager({ onInspect });
    manager.register("my-app", [
      {
        id: "open-dossier",
        label: "Open dossier",
        filter: (t) => t.type === "node",
        action: () => undefined,
      },
    ]);
    const items = manager.resolve({
      type: "node",
      id: "n1",
      position: { x: 0, y: 0 },
    });
    expect(items.map((i) => i.label)).toEqual([
      "Inspect properties",
      "Copy ID",
      "Open dossier",
    ]);
  });
});

describe("scaling (guide: Scaling: collapse large graphs to clusters)", () => {
  it("collapses past the threshold and drills back in, capped", () => {
    const big = new UGM();
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 40; i++) {
        big.addNode(`x${c}-${i}`, {
          types: ["Thing"],
          properties: { name: `x${c}-${i}`, team: `t${c}` },
        });
        if (i > 0) big.addEdge(`x${c}-${i}`, `x${c}-0`, { type: "in" });
      }
    }
    const {
      ugm: clustered,
      members,
      collapsed,
    } = collapseByCluster(big, {
      threshold: 100,
      clusterProperty: "team",
    });
    expect(collapsed).toBe(true);
    expect(clustered.getNodeIds().length).toBe(3);
    expect(members.get("cluster:t1")?.length).toBe(40);
    expect(clustered.getNode("cluster:t1")?.properties.memberCount).toBe(40);

    // Interior + boundary edge counts land on every supernode. In
    // this fixture every edge stays inside its team (created as
    // `x{c}-i` -> `x{c}-0`), so boundary must be 0 and interior
    // must be the team's edge count. This is the wiring an adopter
    // uses to answer "how many paths in this cluster?" without
    // re-walking the source UGM.
    expect(clustered.getNode("cluster:t1")?.properties.interiorEdgeCount).toBe(
      39,
    );
    expect(clustered.getNode("cluster:t1")?.properties.boundaryEdgeCount).toBe(
      0,
    );

    const { ugm: sub, truncated } = buildSubgraph(
      big,
      members.get("cluster:t1") ?? [],
      25,
    );
    expect(truncated).toBe(true);
    expect(sub.getNodeIds().length).toBe(25);
  });

  it("composes the count badge for a Cytoscape label via clusterBadgeText", async () => {
    const { clusterBadgeText } = await import("@g3t/core");
    const big = new UGM();
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 40; i++) {
        big.addNode(`y${c}-${i}`, {
          types: ["Thing"],
          properties: { name: `y${c}-${i}`, team: `t${c}` },
        });
        if (i > 0) big.addEdge(`y${c}-${i}`, `y${c}-0`, { type: "in" });
      }
    }
    const { ugm: clustered } = collapseByCluster(big, {
      threshold: 100,
      clusterProperty: "team",
    });

    // Precompute the badge onto each supernode so the Cytoscape
    // stylesheet can point at `data(_badge)`. Renderer-neutral: the
    // helper is a pure text function, no cytoscape import required.
    clustered.forEachNode((_id, attrs) => {
      attrs.properties._badge = clusterBadgeText(attrs.properties);
    });

    expect(clustered.getNode("cluster:t0")?.properties._badge).toBe(
      "40 nodes · 39 links",
    );
  });
});

describe("edge bundling (guide: Edge bundling)", () => {
  it("bundles a small parallel cluster deterministically, endpoints preserved", () => {
    // Two near-parallel edges between four nodes: the FDEB canonical
    // convergence case. The wiring-guide snippet shape.
    const positions = {
      a1: { x: 0, y: 0 },
      a2: { x: 100, y: 0 },
      b1: { x: 0, y: 8 },
      b2: { x: 100, y: 8 },
    };
    const edges = [
      { id: "a", source: "a1", target: "a2" },
      { id: "b", source: "b1", target: "b2" },
    ];

    const { routes, skipped } = bundleEdges(positions, edges);
    expect(skipped).toBe(false);

    // Endpoints stay pinned to the input node positions.
    for (const e of edges) {
      const poly = routes.get(e.id)!;
      expect(poly[0]).toBe(positions[e.source as keyof typeof positions]);
      expect(poly[poly.length - 1]).toBe(
        positions[e.target as keyof typeof positions],
      );
    }

    // The two edges' same-index interior points converge relative
    // to the input gap of 8.
    const a = routes.get("a")!;
    const b = routes.get("b")!;
    const mid = Math.floor(a.length / 2);
    expect(Math.abs(a[mid]!.y - b[mid]!.y)).toBeLessThan(8);

    // Second run yields byte-identical routes (no RNG anywhere).
    const again = bundleEdges(positions, edges);
    for (const e of edges) {
      const p1 = routes.get(e.id)!;
      const p2 = again.routes.get(e.id)!;
      expect(p1.length).toBe(p2.length);
      for (let i = 0; i < p1.length; i++) {
        expect(p1[i]!.x).toBe(p2[i]!.x);
        expect(p1[i]!.y).toBe(p2[i]!.y);
      }
    }

    // The segments projection is what the Cytoscape `curve-style:
    // segments` rule consumes on the render side.
    const seg = bundledPolylineToSegments(a);
    expect(seg).not.toBeNull();
    expect(seg!.weights.length).toBe(a.length - 2);
    expect(seg!.distances.length).toBe(a.length - 2);
  });

  it("bypasses cleanly (skipped=true) when input exceeds maxEdges", () => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < 20; i++) positions[`n${i}`] = { x: i * 10, y: 0 };
    const edges = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 10}`,
    }));
    const { routes, skipped } = bundleEdges(positions, edges, { maxEdges: 5 });
    expect(skipped).toBe(true);
    for (const e of edges) {
      expect(routes.get(e.id)!.length).toBe(2);
    }
  });
});

describe("provenance trace (guide: Render a provenance trace)", () => {
  it("renders hops, edge details, and the absence hop", () => {
    const chain: ProvenanceChain = [
      { id: "rel", tier: "entity", label: "Release 1.2", depth: 0 },
      {
        id: "build",
        tier: "activity",
        label: "CI build",
        detail: "wasGeneratedBy",
        depth: 1,
        parentId: "rel",
      },
      {
        id: "rel::gap",
        tier: "gap",
        label: "No attribution recorded",
        depth: 1,
        parentId: "rel",
        leaf: true,
        absence: true,
      },
    ];
    const onSelectHop = vi.fn();
    render(
      <ProvenanceTrace
        chain={chain}
        title="Lineage"
        onSelectHop={onSelectHop}
      />,
    );
    const panel = screen.getByTestId("g3t-provenance-trace");
    expect(panel.textContent).toContain("Release 1.2");
    expect(panel.textContent).toContain("wasGeneratedBy");
    expect(panel.textContent).toContain("No attribution recorded");
    fireEvent.click(screen.getByText("CI build"));
    expect(onSelectHop).toHaveBeenCalledWith("build");
  });

  it("Minimap renders its disabled placeholder while the core is null (guide: Camera control)", () => {
    render(<Minimap core={null} />);
    expect(screen.getByTestId("minimap")).toBeDefined();
  });
});

describe("programmatic APIs (guide: Programmatic APIs)", () => {
  function tinyGraph(): UGM {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Site"], properties: { name: "A" } });
    ugm.addNode("b", { types: ["Site"], properties: { name: "B" } });
    ugm.addNode("c", { types: ["Asset"], properties: { name: "C" } });
    ugm.addEdge("a", "b", { type: "feeds" });
    ugm.addEdge("b", "c", { type: "feeds" });
    return ugm;
  }

  it("findShortestPath returns the hop sequence between two nodes", () => {
    const path = findShortestPath(tinyGraph(), "a", "c");
    expect(path.found).toBe(true);
    expect(path.nodeIds).toEqual(["a", "b", "c"]);
    expect(path.length).toBe(2);
  });

  it("exportSubgraphJson / exportSubgraphCsv serialize the (sub)graph", () => {
    const ugm = tinyGraph();
    const parsed = JSON.parse(exportSubgraphJson(ugm)) as {
      version: number;
      nodes: unknown[];
      edges: unknown[];
    };
    expect(parsed.version).toBe(1);
    expect(parsed.nodes.length).toBe(3);
    expect(parsed.edges.length).toBe(2);

    const csv = exportSubgraphCsv(ugm);
    const header = csv.split("\n")[0] ?? "";
    expect(header).toContain("name");
    expect(csv.split("\n").length).toBeGreaterThan(3);
  });

  it("buildImageExport(cy) returns a PNG blob artifact via cy.png", () => {
    // jsdom cannot rasterize, so the wiring twin verifies the
    // delegation contract with a stub Core (real browser confirms
    // pixels via Zach's visual pass).
    const png = vi.fn(() => new Blob(["fake"], { type: "image/png" }));
    const cy = { png } as unknown as Core;
    const art = buildImageExport(cy, { scale: 2 });
    expect(png).toHaveBeenCalledWith({
      output: "blob",
      full: true,
      scale: 2,
      bg: undefined,
    });
    expect(art.filename).toBe("g3t-graph.png");
    expect(art.mime).toBe("image/png");
    expect(art.blob).toBeInstanceOf(Blob);
  });

  it("applyEncodingSpec resolves a spec into per-element visual patches", () => {
    const ugm = tinyGraph();
    const patch = applyEncodingSpec(
      {
        version: 1,
        node: {
          color: {
            driver: "types",
            scale: { kind: "categorical", palette: "okabe-ito" },
          },
        },
        edge: {},
      },
      ugm,
    );
    expect(patch.nodes.size).toBe(3);
    const a = patch.nodes.get("a");
    const c = patch.nodes.get("c");
    // Patch fields are underscore-prefixed materialized visual channels
    // (the same keys ingestAlgorithmResults-style consumers read).
    expect(a?._color).toBeDefined();
    // Different types resolve to different categorical colors.
    expect(a?._color).not.toBe(c?._color);
  });

  it("createTheme derives a contrast-checked theme from a base", () => {
    const theme = createTheme({ id: "acme", name: "Acme" });
    expect(theme.id).toBe("acme");
    expect(theme.bgPrimary.length).toBeGreaterThan(0);
    expect(theme.textPrimary.length).toBeGreaterThan(0);
  });

  it("labelWrapRule builds a node[label]-scoped wrap rule for the stylesheet prop", () => {
    const styleOf = (rule: ReturnType<typeof labelWrapRule>) =>
      (rule as unknown as { style: Record<string, string> }).style;
    const rule = labelWrapRule(90);
    // Field-scoped selector (mapping-warning doctrine) so nodes without
    // a data label never trigger per-frame Cytoscape warnings.
    expect(rule.selector).toBe("node[label]");
    expect(styleOf(rule)["text-wrap"]).toBe("wrap");
    expect(styleOf(rule)["text-max-width"]).toBe("90px");
    // Default width when called bare.
    expect(styleOf(labelWrapRule())["text-max-width"]).toBe("120px");
    // false DISABLES the canvas's default 110px wrap.
    expect(styleOf(labelWrapRule(false))["text-wrap"]).toBe("none");
  });

  it("createCameraController drives the cy viewport imperatively", () => {
    const eles = { length: 2, nonempty: () => true };
    const fit = vi.fn();
    const animate = vi.fn();
    const cy = {
      nodes: vi.fn(() => eles),
      elements: vi.fn(() => eles),
      getElementById: vi.fn(() => ({ nonempty: () => true, length: 1 })),
      $: vi.fn(() => eles),
      filter: vi.fn(() => eles),
      fit,
      animate,
      center: vi.fn(),
      zoom: vi.fn(() => 1),
      stop: vi.fn(),
    } as unknown as Core;
    const camera = createCameraController(cy, { duration: 0 });
    camera.frameAll();
    expect(fit.mock.calls.length + animate.mock.calls.length).toBeGreaterThan(
      0,
    );
  });
});

describe("routeEdges (guide: Route edges around nodes on any layout)", () => {
  it("routeSceneEdges + polylineToCytoscapeSegments give a canvas-ready detour", () => {
    // A -> B with an obstacle sitting between them; the pure module
    // that the CytoscapeCanvas routeEdges pass calls under the hood.
    const nodes = [
      { id: "a", x: 0, y: 40, width: 40, height: 40 },
      { id: "obst", x: 100, y: 0, width: 60, height: 200 },
      { id: "b", x: 240, y: 40, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(nodes, [
      { id: "e", source: "a", target: "b" },
    ]);
    const pts = routed.get("e");
    expect(pts).toBeDefined();
    if (!pts) return;
    const seg = polylineToCytoscapeSegments(pts);
    expect(seg).not.toBeNull();
    if (!seg) return;
    // segment-distances/weights arrays consumable by cytoscape's
    // "curve-style: segments" — same field names the canvas stamps as
    // `_segDist` / `_segWeight` under the g3t-canvas-edge-routed class.
    expect(seg.distances.length).toBe(seg.weights.length);
    expect(seg.distances.length).toBeGreaterThan(0);
  });

  it("mode: direct — clear edge left as bezier, crossing edge routed", () => {
    // Verifies the prop API documented in the wiring guide:
    //   routeEdges={{ mode: "direct" }} (the default)
    // Clear A -> B (no obstacle between them) → not routed (stays bezier).
    const clearNodes = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "b", x: 200, y: 200, width: 40, height: 40 },
    ];
    const { routed: clearRouted } = routeSceneEdges(
      clearNodes,
      [{ id: "e", source: "a", target: "b" }],
      { mode: "direct-unless-crossing" },
    );
    expect(clearRouted.has("e")).toBe(false);

    // A -> B with an obstacle on the straight path → must route.
    const blockedNodes = [
      { id: "a", x: 0, y: 40, width: 40, height: 40 },
      { id: "obst", x: 100, y: 0, width: 60, height: 200 },
      { id: "b", x: 240, y: 40, width: 40, height: 40 },
    ];
    const { routed: blockedRouted } = routeSceneEdges(
      blockedNodes,
      [{ id: "e", source: "a", target: "b" }],
      { mode: "direct-unless-crossing" },
    );
    expect(blockedRouted.has("e")).toBe(true);
  });

  it("mode: always — routes every edge regardless of crossing", () => {
    // Verifies routeEdges={{ mode: "orthogonal" }} (mapped to "always" in core).
    const nodes = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "b", x: 200, y: 0, width: 40, height: 40 },
    ];
    const { routed } = routeSceneEdges(
      nodes,
      [{ id: "e", source: "a", target: "b" }],
      { mode: "always" },
    );
    expect(routed.has("e")).toBe(true);
  });
});

describe("refresh routes / re-layout / edge isolate (guide: Refresh routes / re-layout / isolate an edge)", () => {
  it("optimizePlacement reduces (or preserves) crossings — the primitive relayoutSignal drives", () => {
    // Four nodes wired as a K(2,2) storm: the two "cross" edges intersect
    // on straight lines. optimizePlacement is what the CytoscapeCanvas
    // relayoutSignal effect calls under the hood.
    const nodes = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "b", x: 200, y: 0, width: 40, height: 40 },
      { id: "c", x: 0, y: 200, width: 40, height: 40 },
      { id: "d", x: 200, y: 200, width: 40, height: 40 },
    ];
    const edges = [
      { id: "e1", source: "a", target: "d" },
      { id: "e2", source: "b", target: "c" },
    ];
    const result = optimizePlacement(nodes, edges, { budgetMs: 50, seed: 7 });
    expect(result.crossingsAfter).toBeLessThanOrEqual(result.crossingsBefore);
    // Positions returned for every node (id set preserved — the canvas
    // relies on this to apply positions without re-init).
    for (const n of nodes) expect(result.positions.has(n.id)).toBe(true);
  });

  it("useEmphasisStore.setPathEffect / clear is the isolate contract (edgeClickIsolate)", () => {
    // With edgeClickIsolate on, an edge tap calls setPathEffect for that
    // single edge; a repeat tap (or a background tap) calls clear. The
    // canvas talks to this exact store shape.
    const store = useEmphasisStore.getState();
    store.clear();
    store.setPathEffect([], ["e-42"], "e-42");
    const s1 = useEmphasisStore.getState();
    expect(s1.active).toBe(true);
    expect(s1.emphasizedEdgeIds.has("e-42")).toBe(true);
    expect(s1.emphasizedEdgeIds.size).toBe(1);
    useEmphasisStore.getState().clear();
    const s2 = useEmphasisStore.getState();
    expect(s2.active).toBe(false);
    expect(s2.emphasizedEdgeIds.size).toBe(0);
  });
});

describe("holon boundary (guide: Holon boundary views)", () => {
  const dataset: HolonicDataset = {
    holons: [
      {
        id: "space",
        label: "Space Segment",
        types: ["Segment"],
        properties: {},
        interiorNodes: [
          { id: "comms", types: ["CommsSubsystem"], properties: {} },
          { id: "bus", types: ["BusSubsystem"], properties: {} },
        ],
        interiorEdges: [{ source: "comms", target: "bus", type: "on" }],
        boundaryNodeIds: ["comms"],
        portals: [
          {
            id: "p-down",
            label: "downlinksTo",
            sourceHolonId: "space",
            targetHolonId: "ground",
            boundaryNodeId: "comms",
          },
        ],
      },
      {
        id: "ground",
        label: "Ground Segment",
        types: ["Segment"],
        properties: {},
        portals: [],
      },
    ],
  };

  it("projects the three drill levels with ring, containment, and transit markers", () => {
    const adapter = new HolonicAdapter(dataset);

    // Holarchy: opaque holons, portals as edges.
    const holarchy = adapter.projectToLPG();
    expect(holarchy.nodeCount).toBe(2);

    // Boundary: ringed holon + exposed node + external stub; the
    // hidden interior node (bus) does not appear.
    const boundary = adapter.projectHolonBoundary(dataset.holons[0]!);
    expect(boundary.getNode("space")?.properties._boundaryRing).toBe(true);
    expect(boundary.getNode("comms")?.properties._exposed).toBe(true);
    expect(boundary.hasNode("bus")).toBe(false);
    let containment = 0;
    let transit = 0;
    boundary.forEachEdge((_id, attrs) => {
      if (attrs.type === HolonicAdapter.BOUNDARY_CONTAINMENT_EDGE)
        containment++;
      if (attrs.properties._portalTransit === true) transit++;
    });
    expect(containment).toBe(1);
    expect(transit).toBe(1);

    // Interior: the fully open flat LPG.
    expect(adapter.projectHolonInterior(dataset.holons[0]!).nodeCount).toBe(2);
  });

  it("registers drill items the host consumes to swap the canvas UGM", () => {
    const adapter = new HolonicAdapter(dataset);
    const menuManager = new ContextMenuManager();
    const opened: string[] = [];
    registerHolonDrillItems(adapter, menuManager, (level, holon) => {
      opened.push(`${level}:${holon.id}`);
    });

    const items = menuManager.resolve({
      type: "node",
      id: "space",
      position: { x: 0, y: 0 },
    });
    items
      .find((i) => i.id === "open-holon-boundary")
      ?.action({ type: "node", id: "space", position: { x: 0, y: 0 } });
    expect(opened).toEqual(["boundary:space"]);
  });
});

describe("wiring guide: rdf 1.2 hyperarcs", () => {
  const EX = "http://example.org/sat#";
  const XSD = "http://www.w3.org/2001/XMLSchema#";
  const uri = (l: string): RdfTerm & { type: "uri" } => ({
    type: "uri",
    value: `${EX}${l}`,
  });
  const lit = (v: string, dt?: string): RdfTerm => ({
    type: "literal",
    value: v,
    ...(dt ? { datatype: `${XSD}${dt}` } : {}),
  });
  const quote = (
    s: RdfTerm,
    p: RdfTerm,
    o: RdfTerm,
  ): RdfTerm & { type: "triple" } => ({
    type: "triple",
    value: { subject: s, predicate: p, object: o },
  });

  const massFact = quote(uri("aquila1"), uri("hasMass"), lit("950", "decimal"));
  const rows: TripleTermAnnotation[] = [
    { stmt: massFact, ann: uri("statedBy"), val: uri("engineering") },
    { stmt: massFact, ann: uri("confidence"), val: lit("0.9", "decimal") },
    // Nested review OF the mass-confidence assertion — only the
    // hyperarc render can express it.
    {
      stmt: quote(
        quote(massFact, uri("confidence"), lit("0.9", "decimal")),
        uri("reviewedBy"),
        uri("qa"),
      ),
      ann: uri("statedBy"),
      val: uri("qa"),
    },
  ];

  it("hyperarc render reifies each unique « s p o » to a diamond pseudo-node", () => {
    const ugm = projectTripleTermsAsHyperarcs(rows);
    const stmts = ugm
      .getNodeIds()
      .filter((id) => ugm.getNode(id)?.types.includes("_Statement"));
    // massFact + outer review + inner (mass, confidence 0.9) = 3
    expect(stmts.length).toBe(3);
    for (const s of stmts) {
      expect(ugm.getNode(s)?.properties[RDF_STATEMENT_FLAG]).toBe(true);
    }
    // Numeric confidence folds onto the statement node for opacity.
    const confidences = stmts
      .map((s) => ugm.getNode(s)?.properties._confidence)
      .filter((c): c is number => typeof c === "number");
    expect(confidences).toContain(0.9);
  });

  it("edge render emits one dashed `star` edge per annotation row", () => {
    const ugm = projectTripleTermsAsEdges(rows);
    let stars = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.type === STAR_EDGE_TYPE) stars++;
    });
    expect(stars).toBe(rows.length);
  });
});
