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
  parseAlgorithmResult,
  applyAlgorithmResult,
  ingestAlgorithmResults,
  layoutStructural,
  isChainEdgeId,
  compartmentKey,
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
  type RDFGraph,
} from "@g3t/core";
import {
  usePositionPinStore,
  useSelectionStore,
  useOverlayStore,
  useThemeStore,
  runGraphLayout,
  DEFAULT_LAYOUT_OPTIONS,
  ContextMenuManager,
  registerCompartmentCollapseActions,
  useCompartmentCollapseStore,
  collapsedCompartmentSet,
  captureWorkspace,
  applyWorkspace,
  serializeWorkspace,
  parseWorkspace,
  structuralToCytoscapeElements,
  FacetFilter,
  applyEncodingSpec,
  createTheme,
  createCameraController,
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

  it("collapses a compartment by feeding its key to the layout", async () => {
    const input = {
      nodes: [
        {
          id: "sensor",
          header: { stereotype: "Block", name: "Sensor" },
          compartments: [
            {
              id: "operations",
              title: "operations",
              rows: [
                { id: "sensor.calibrate", text: "calibrate() : void" },
                { id: "sensor.reset", text: "reset() : void" },
              ],
            },
          ],
        },
      ],
      edges: [],
    };
    const expanded = await layoutStructural(input);
    const collapsed = await layoutStructural(input, {
      collapsedCompartments: new Set([compartmentKey("sensor", "operations")]),
    });
    // Content rows gone, divider with hidden count remains, shorter.
    expect(collapsed.nodes["sensor.calibrate"]!).toBeUndefined();
    expect(collapsed.nodes["sensor::operations::title"]!.text).toBe(
      "operations (2 hidden)",
    );
    expect(collapsed.nodes["sensor"]!.height).toBeLessThan(
      expanded.nodes["sensor"]!.height,
    );
  });

  it("right-click collapse action drives the store, which drives re-layout", async () => {
    useCompartmentCollapseStore.getState().clear();
    const input = {
      nodes: [
        {
          id: "sensor",
          header: { stereotype: "Block", name: "Sensor" },
          compartments: [
            {
              id: "operations",
              title: "operations",
              rows: [{ id: "sensor.calibrate", text: "calibrate() : void" }],
            },
          ],
        },
      ],
      edges: [],
    };

    // Host registers the built-in action; the menu reads the
    // converter-set container tags off the target.
    const manager = new ContextMenuManager();
    registerCompartmentCollapseActions(manager);
    const target = {
      type: "node" as const,
      id: "sensor",
      position: { x: 0, y: 0 },
      data: { _structuralContainer: true, _compartmentIds: ["operations"] },
    };
    const action = manager
      .resolve(target)
      .find((i) => i.id === "collapse-compartments")!;
    action.action(target);

    expect(useCompartmentCollapseStore.getState().collapsedKeys).toEqual([
      "sensor::operations",
    ]);
    // Host re-runs layout with the store's set folded in.
    const geometry = await layoutStructural(input, {
      collapsedCompartments: collapsedCompartmentSet(
        useCompartmentCollapseStore.getState().collapsedKeys,
      ),
    });
    expect(geometry.nodes["sensor.calibrate"]).toBeUndefined();
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
