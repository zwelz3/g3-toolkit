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
import { useEffect, useRef, useState } from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import type { Core } from "cytoscape";
import {
  UGM,
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
  allShortestPaths,
  kShortestPaths,
  type PathGraph,
  exportSubgraphJson,
  exportSubgraphCsv,
  DerivedPropertyEngine,
  createPresetPipeline,
  ProjectionPipeline,
  typeCollapse,
  tripleEdgeKey,
  collapseByCluster,
  buildSubgraph,
  G3tEventBus,
  WorkingSetManager,
  pageNodes,
  pageCount,
  parseWorkingSetConfig,
  type RDFGraph,
  type PageWindow,
} from "@g3-toolkit/core";
import {
  usePositionPinStore,
  useSelectionStore,
  useOverlayStore,
  useThemeStore,
  runGraphLayout,
  DEFAULT_LAYOUT_OPTIONS,
  ContextMenuManager,
  captureWorkspace,
  applyWorkspace,
  serializeWorkspace,
  parseWorkspace,
  structuralToCytoscapeElements,
  FacetFilter,
  CytoscapeCanvas,
  applyEncodingSpec,
  createTheme,
  applyTheme,
  themeFromCssVariables,
  createCameraController,
  ProvenanceTrace,
  AriaCompanion,
  useAnnouncer,
  Minimap,
  useOverlaySequence,
  OverlayTransport,
  computeSequenceActiveIds,
  SchemaView,
  TreeView,
  type TreeRowNode,
  type TreeLabelContext,
  createDefaultMenuManager,
  registerToolkitActions,
  ViewErrorBoundary,
  ShaclShapeBrowser,
  FloatingLegend,
  TableView,
  getCsv,
  type TableSort,
  MatrixView,
  PaginationControl,
  resolveLabelCollisions,
  composeLabelPriority,
  WorkingSetProvider,
  useWorkingSetManager,
  workingSetLimitMessage,
  type EncodingSpec,
  type LegendChannel,
  type LabelCandidate,
  type ProvenanceChain,
  type ShaclShape,
  type DataGridColumn,
} from "@g3-toolkit/react";

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

  it("theme scoped to the graph area: setThemeTarget on mount, clearTheme on unmount", () => {
    const root = document.documentElement.style;
    root.removeProperty("color-scheme");
    root.removeProperty("--g3t-bg-primary");
    function GraphArea() {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => {
        const { setThemeTarget, clearTheme } = useThemeStore.getState();
        setThemeTarget(ref.current!);
        return () => clearTheme();
      }, []);
      return <div ref={ref} data-testid="graph-area" />;
    }
    const { unmount } = render(<GraphArea />);
    useThemeStore.getState().setTheme("dark");
    const area = screen.getByTestId("graph-area") as HTMLElement;
    expect(area.style.getPropertyValue("color-scheme")).toBe("dark");
    expect(area.style.getPropertyValue("--g3t-bg-primary")).not.toBe("");
    // The host page keeps its own scheme.
    expect(root.getPropertyValue("color-scheme")).toBe("");
    expect(root.getPropertyValue("--g3t-bg-primary")).toBe("");
    unmount();
    expect(area.style.getPropertyValue("color-scheme")).toBe("");
    expect(area.style.getPropertyValue("--g3t-bg-primary")).toBe("");
    useThemeStore.getState().setThemeTarget("root");
    useThemeStore.getState().setTheme("light");
    useThemeStore.getState().clearTheme();
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

describe("wiring guide: style the toolkit's text (the g3t-view root class)", () => {
  it("every view root carries g3t-view after the host class and the component's own class", () => {
    render(
      <>
        <TableView ugm={graph()} className="host-table" />
        <SchemaView ugm={graph()} className="host-schema" />
        <FacetFilter ugm={graph()} onFilterChange={vi.fn()} />
      </>,
    );
    expect(screen.getByTestId("table-view").className).toBe(
      "g3t-table host-table g3t-view",
    );
    expect(screen.getByTestId("schema-view").className).toBe(
      "host-schema g3t-view",
    );
    // No host class: the view still carries the toolkit's root class.
    expect(screen.getByTestId("facet-filter").className).toBe("g3t-view");
  });
});

describe("wiring guide: word the legend for your audience", () => {
  it("sectionTitle and the channel-aware labelFor reach every section; edge rows need no overrides", () => {
    const ugm = graph();
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "types",
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
      },
      edge: {
        color: {
          driver: "type",
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
      },
    };
    const words: Record<LegendChannel, string> = {
      "node.color": "Node type",
      "node.size": "Importance",
      "node.shape": "Node type",
      "node.icon": "Node type",
      "edge.color": "Relation",
      "edge.width": "Strength",
    };
    const relationLabels: Record<string, string> = { feeds: "feeds into" };
    render(
      <FloatingLegend
        ugm={ugm}
        spec={spec}
        sectionTitle={(channel) => words[channel]}
        labelFor={(value, channel) =>
          channel === "edge.color" ? (relationLabels[value] ?? value) : value
        }
      />,
    );
    const titles = Array.from(
      document.querySelectorAll(".g3t-legend-title"),
    ).map((el) => el.textContent);
    expect(titles).toContain("Node type");
    expect(titles).toContain("Relation");
    expect(titles.some((t) => t?.includes("edge color:"))).toBe(false);
    // The edge scale declares no overrides; the row still appears, and
    // it carries the host's relation wording, not the node wording.
    expect(screen.getByTestId("legend-edge-color-feeds").textContent).toContain(
      "feeds into",
    );
    expect(screen.getByTestId("legend-color-Asset").textContent).toContain(
      "Asset",
    );
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

    // Severity overlays register INACTIVE, matching the guide and the
    // Auditor shell: active-at-mount dims every non-finding node and
    // the surface reads as broken rather than filtered.
    for (const overlay of severityOverlays(report)) {
      useOverlayStore.getState().register(overlay, false);
    }
    expect(useOverlayStore.getState().overlays.length).toBeGreaterThan(0);
    expect(useOverlayStore.getState().activeIds).not.toContain(
      "shacl-violation",
    );
    // Each tier carries its tone, so activating violations draws them
    // in the danger treatment rather than the generic emphasis.
    expect(
      useOverlayStore
        .getState()
        .overlays.find((o) => o.id === "shacl-violation")?.tone,
    ).toBe("danger");
    // Toggling is the reviewer's act:
    useOverlayStore.getState().toggle("shacl-violation");
    expect(useOverlayStore.getState().activeIds).toContain("shacl-violation");

    // Drivers ingest onto the failing node:
    ingestAlgorithmResults(ugm, shaclResultDrivers(report));
    expect(ugm.getNode("c1")!.properties._shacl_resultCount).toBe(1);
    expect(ugm.getNode("c1")!.properties._shacl_maxSeverity).toBe("violation");
    // The conforming node carries no driver props.
    expect(ugm.getNode("c2")!.properties._shacl_resultCount).toBeUndefined();
  });
});

describe("wiring guide: step through overlays in order", () => {
  beforeEach(() => {
    useOverlayStore.getState().clear();
  });

  it("the sequence sets only the ids it owns; a foreign overlay keeps its state throughout", () => {
    const store = useOverlayStore.getState();
    const tier = (id: string, nodeIds: string[]) => ({
      id,
      label: id,
      nodeIds,
      edgeIds: [],
    });
    // Three tiers registered inactive, as the SHACL recipe does...
    store.register(tier("shacl-info", ["asset-1"]), false);
    store.register(tier("shacl-warning", ["asset-2"]), false);
    store.register(tier("shacl-violation", ["asset-1"]), false);
    // ...and a path overlay another part of the app owns, ACTIVE.
    store.register(tier("path-1", ["asset-1", "asset-2"]), true);
    expect(useOverlayStore.getState().activeIds).toEqual(["path-1"]);

    const TIER_ORDER = ["shacl-info", "shacl-warning", "shacl-violation"];
    function SeverityWalkthrough() {
      const [speedMs, setSpeedMs] = useState(1500);
      const [loop, setLoop] = useState(false);
      const sequence = useOverlaySequence({
        ids: TIER_ORDER,
        mode: "cumulative",
        speedMs,
        loop,
      });
      return (
        <OverlayTransport
          sequence={sequence}
          speedMs={speedMs}
          onSpeedChange={setSpeedMs}
          loop={loop}
          onLoopChange={setLoop}
        />
      );
    }
    const { unmount } = render(<SeverityWalkthrough />);

    // Mount: step 0 active, the foreign overlay untouched.
    expect(useOverlayStore.getState().activeIds).toEqual([
      "path-1",
      "shacl-info",
    ]);
    expect(screen.getByTestId("overlay-transport-readout").textContent).toBe(
      "1 of 3",
    );
    fireEvent.click(screen.getByLabelText("Next step"));
    fireEvent.click(screen.getByLabelText("Next step"));
    // Cumulative: every earlier tier rides along; matches the pure rule.
    expect(useOverlayStore.getState().activeIds).toEqual([
      "path-1",
      ...computeSequenceActiveIds(TIER_ORDER, 2, "cumulative"),
    ]);
    expect(screen.getByTestId("overlay-transport-readout").textContent).toBe(
      "3 of 3",
    );
    // At the end without loop the next button is a hard stop.
    expect(screen.getByLabelText("Next step")).toBeDisabled();

    // The host toggling its own overlay mid-walk is respected.
    useOverlayStore.getState().toggle("path-1");
    fireEvent.click(screen.getByLabelText("Previous step"));
    expect(useOverlayStore.getState().activeIds).toEqual([
      "shacl-info",
      "shacl-warning",
    ]);
    useOverlayStore.getState().toggle("path-1");

    // Unmount hands the owned ids back as it found them (all inactive)
    // and leaves the foreign overlay active.
    unmount();
    expect(useOverlayStore.getState().activeIds).toEqual(["path-1"]);
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

describe("wiring guide: shape browser from a deep link or an aggregated report", () => {
  const shapes: ShaclShape[] = [
    {
      id: "ex:QuoteShape",
      targetClass: "ex:Quote",
      targets: [
        { kind: "class", value: "ex:Quote" },
        { kind: "subjectsOf", value: "ex:quoteVerified" },
      ],
      properties: [
        // Two property shapes on one path: give each its own id.
        { id: "ex:QuoteShape-verified", path: "ex:quoteVerified", minCount: 1 },
        {
          id: "ex:QuoteShape-verified-bool",
          path: "ex:quoteVerified",
          datatype: "boolean",
        },
      ],
    },
    { id: "ex:OrderShape", targetClass: "ex:Order", properties: [] },
  ];

  it("summary totals win over counting, and the selected shape opens expanded", () => {
    function Host() {
      // From the URL: /shapes?selected=ex:QuoteShape
      const [selected, setSelected] = useState<string | null>("ex:QuoteShape");
      return (
        <ShaclShapeBrowser
          shapes={shapes}
          validationResults={[]}
          summary={{
            "ex:QuoteShape": {
              focus: 120,
              failing: 3,
              bySeverity: { warning: 3 },
            },
          }}
          selectedShape={selected}
          onSelectShape={setSelected}
        />
      );
    }
    render(<Host />);
    // No placeholder results, yet the totals and tier come through.
    expect(screen.getByTestId("shape-ex:QuoteShape").textContent).toContain(
      "117/120 pass",
    );
    const badge = screen.getByTestId("shape-badge-ex:QuoteShape");
    expect(badge.getAttribute("data-severity")).toBe("warning");
    expect(badge.getAttribute("aria-label")).toBe("3 failing");
    // Deep link: expanded on load, both constraint rows rendered.
    expect(
      screen
        .getByTestId("shape-toggle-ex:QuoteShape")
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen.getByTestId("constraint-ex:QuoteShape-ex:QuoteShape-verified"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        "constraint-ex:QuoteShape-ex:QuoteShape-verified-bool",
      ),
    ).toBeInTheDocument();
    // Every target renders, class first.
    expect(screen.getByTestId("shape-targets-ex:QuoteShape").textContent).toBe(
      "→ ex:Quote, subjects of ex:quoteVerified",
    );
    // The host owns the selection: collapsing reports null and closes.
    fireEvent.click(screen.getByTestId("shape-toggle-ex:QuoteShape"));
    expect(
      screen
        .getByTestId("shape-toggle-ex:QuoteShape")
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});

describe("wiring guide: class hierarchy (SchemaView nesting, TreeView forests)", () => {
  it("SchemaView nests subclasses and badges every targeting shape with the worst status", () => {
    const shapes = [
      {
        id: "PersonBasic",
        targetClass: "Person",
        properties: [{ path: "name", minCount: 1 }],
      },
      {
        id: "PersonContact",
        targetClass: "Person",
        properties: [{ path: "email", minCount: 1 }],
      },
    ];
    const ugm = new UGM();
    ugm.addNode("p1", { types: ["Person"], properties: { name: "Ada" } });
    // p1 has no email: PersonContact fails with a violation.
    const validationResults = validateShacl(ugm, shapes);

    render(
      <SchemaView
        schema={{
          nodeTypes: ["Agent", "Person"],
          edgeTypes: [],
          nodeProperties: { Person: ["name", "email"] },
          edgeProperties: {},
        }}
        subClassOf={{ Person: "Agent" }}
        shapes={shapes}
        validationResults={validationResults}
      />,
    );
    expect(screen.getByTestId("schema-class-Person")).toHaveAttribute(
      "data-parent",
      "Agent",
    );
    expect(screen.getByTestId("schema-subclasses-Agent")).toContainElement(
      screen.getByTestId("schema-class-Person"),
    );
    const badge = screen.getByTestId("shacl-badge-Person");
    expect(badge).toHaveTextContent(
      "SHACL: 2 constraints, 2 shapes, violation",
    );
    expect(badge).toHaveAttribute("data-severity", "violation");
  });

  it("SchemaView badges `targets` classes, inherits superclass shapes, and renders a class under each parent (#56)", () => {
    const shapes = [
      {
        id: "AgentShape",
        targetClass: "Agent",
        properties: [{ path: "name", minCount: 1 }],
      },
      {
        id: "NamedShape",
        // An empty targetClass with `targets` naming several classes.
        targetClass: "",
        targets: [
          { kind: "class" as const, value: "Person" },
          { kind: "class" as const, value: "Org" },
        ],
        properties: [{ path: "label", minCount: 1 }],
      },
    ];
    render(
      <SchemaView
        schema={{
          nodeTypes: ["Agent", "LegalEntity", "Person", "Org"],
          edgeTypes: [],
          nodeProperties: {},
          edgeProperties: {},
        }}
        // Org has two superclasses: it renders under both.
        subClassOf={{
          Person: "Agent",
          Org: ["Agent", "LegalEntity"],
        }}
        shapes={shapes}
      />,
    );
    // NamedShape badges Person through `targets`, not `targetClass`.
    expect(screen.getByTestId("shacl-badge-Person")).toHaveTextContent(
      "2 shapes, 1 inherited",
    );
    const personList = screen.getByTestId("shacl-constraints-Person");
    expect(
      within(personList).getByTestId("shacl-shape-AgentShape"),
    ).toHaveAttribute("data-inherited-from", "Agent");
    // Org appears once under each parent, with its own path.
    const copies = screen.getAllByTestId("schema-class-Org");
    expect(copies).toHaveLength(2);
    expect(copies.map((c) => c.getAttribute("data-path")).sort()).toEqual([
      "Agent/Org",
      "LegalEntity/Org",
    ]);
  });

  it("TreeView renders a forest, seeds expansion, drops the type prefix, and moves by keyboard", () => {
    const ugm = new UGM();
    ugm.addNode("owl:Thing", {
      types: ["Class"],
      properties: { name: "Thing" },
    });
    ugm.addNode("prov:Agent", {
      types: ["Class"],
      properties: { name: "Agent" },
    });
    ugm.addNode("prov:Entity", {
      types: ["Class"],
      properties: { name: "Entity" },
    });
    ugm.addNode("prov:Plan", {
      types: ["Class"],
      properties: { name: "Plan" },
    });
    ugm.addEdge("owl:Thing", "prov:Agent", { type: "subClassOf" });
    ugm.addEdge("prov:Entity", "prov:Plan", { type: "subClassOf" });

    render(
      <TreeView
        ugm={ugm}
        rootIds={["owl:Thing", "prov:Entity"]}
        initialDepth={1}
        showType={false}
      />,
    );
    // Two top-level rows, no synthetic parent, children seeded open.
    expect(screen.getByTestId("tree-node-owl:Thing")).toHaveAttribute(
      "aria-level",
      "1",
    );
    expect(screen.getByTestId("tree-node-prov:Entity")).toHaveAttribute(
      "aria-level",
      "1",
    );
    expect(screen.getByTestId("tree-node-prov:Plan")).toHaveAttribute(
      "aria-level",
      "2",
    );
    expect(screen.getByTestId("tree-node-owl:Thing")).not.toHaveTextContent(
      "[Class]",
    );
    // A seeded row collapses (impossible before issue #36).
    fireEvent.click(screen.getByTestId("tree-toggle-owl:Thing"));
    expect(screen.queryByTestId("tree-node-prov:Agent")).toBeNull();
    // Keyboard: ArrowDown moves the roving tab stop to the next row.
    const thing = screen.getByTestId("tree-node-owl:Thing");
    thing.focus();
    fireEvent.keyDown(thing, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByTestId("tree-node-prov:Entity"),
    );
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });
});

describe("wiring guide: ontology rails (TreeView filter, group rows, rich labels, controlled selection)", () => {
  function railGraph(): UGM {
    const ugm = new UGM();
    const cls = (id: string, name: string, type = "Class") =>
      ugm.addNode(id, { types: [type], properties: { name } });
    cls("owl:Thing", "Thing");
    cls("ex:Artifact", "Artifact");
    cls("ex:Requirement", "Requirement");
    cls("ex:Design", "Design");
    cls("ex:Agent", "Agent");
    cls("ex:Deliverable", "Deliverable");
    cls("ex:props", "Object properties", "Group");
    cls("ex:satisfies", "satisfies", "Property");
    const sub = (p: string, c: string) =>
      ugm.addEdge(p, c, { type: "subClassOf", properties: {} });
    sub("owl:Thing", "ex:Artifact");
    sub("ex:Artifact", "ex:Requirement");
    sub("ex:Artifact", "ex:Design");
    sub("owl:Thing", "ex:Agent");
    // Two superclasses: Deliverable shows under Artifact AND Agent.
    sub("ex:Artifact", "ex:Deliverable");
    sub("ex:Agent", "ex:Deliverable");
    sub("owl:Thing", "ex:props");
    sub("ex:props", "ex:satisfies");
    return ugm;
  }

  it("filters with ancestors, toggles group rows, renders rich labels, and keeps the selection in the host", () => {
    const ugm = railGraph();
    const navigate = vi.fn();
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    let setFromOutside: (id: string | null) => void = () => {};

    function ClassRail() {
      const [selectedClass, setSelectedClass] = useState<string | null>(
        "ex:Requirement",
      );
      setFromOutside = setSelectedClass;
      const [query, setQuery] = useState("");
      return (
        <>
          <input
            aria-label="Filter classes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <TreeView
            ugm={ugm}
            rootIds={["owl:Thing"]}
            ariaLabel="Classes"
            showType={false}
            initialDepth={1}
            initialExpanded={["ex:Artifact"]}
            filter={query}
            isGroup={(node: TreeRowNode) => node.type === "Group"}
            renderLabel={(node: TreeRowNode, ctx: TreeLabelContext) => (
              <span style={{ fontStyle: ctx.group ? "italic" : undefined }}>
                {node.label}
                {ctx.childCount > 0 && (
                  <span title={`${ctx.childCount} subclasses`}>
                    {" "}
                    ({ctx.childCount})
                  </span>
                )}
              </span>
            )}
            selected={selectedClass}
            onSelect={(id) => {
              setSelectedClass(id);
              navigate(`/classes/${encodeURIComponent(id)}`);
            }}
          />
        </>
      );
    }

    try {
      useSelectionStore.getState().clear();
      render(<ClassRail />);
      const item = (id: string) => screen.getByTestId(`tree-node-${id}`);
      const row = (id: string) => item(id).querySelector(".g3t-tree-row")!;

      // ariaLabel, the controlled selection at mount (highlighted and
      // scrolled to), initialExpanded, and the rich label with its count.
      expect(screen.getByRole("tree", { name: "Classes" })).toBeInTheDocument();
      expect(item("ex:Requirement")).toHaveAttribute("aria-selected", "true");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
      expect(scrollIntoView.mock.instances[0]).toBe(item("ex:Requirement"));
      expect(screen.getByTestId("tree-label-ex:Artifact")).toHaveTextContent(
        "Artifact (3)",
      );
      expect(
        screen.getByTestId("tree-label-ex:Artifact").querySelector("[title]"),
      ).toHaveAttribute("title", "3 subclasses");

      // A class with two superclasses renders under both; selecting
      // one copy highlights both.
      expect(screen.getAllByTestId("tree-node-ex:Deliverable")).toHaveLength(1);
      fireEvent.click(screen.getByTestId("tree-toggle-ex:Agent"));
      const copies = screen.getAllByTestId("tree-node-ex:Deliverable");
      expect(copies).toHaveLength(2);
      fireEvent.click(copies[1]!.querySelector(".g3t-tree-row")!);
      for (const c of copies) {
        expect(c).toHaveAttribute("aria-selected", "true");
      }

      // A group row toggles and never selects; the store stays empty.
      expect(item("ex:props")).not.toHaveAttribute("aria-selected");
      expect(item("ex:props")).toHaveAttribute("data-group", "true");
      fireEvent.click(row("ex:props"));
      expect(item("ex:satisfies")).toBeInTheDocument();
      // Only the Deliverable pick above reached the host.
      expect(navigate).toHaveBeenCalledTimes(1);

      // A pick stays in the host: onSelect fires, the store is untouched.
      fireEvent.click(row("ex:Design"));
      expect(navigate).toHaveBeenCalledWith("/classes/ex%3ADesign");
      expect(item("ex:Design")).toHaveAttribute("aria-selected", "true");
      expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);

      // The store is ignored on the way in, too.
      act(() => {
        useSelectionStore.getState().selectNodes(["ex:Agent"]);
      });
      expect(item("ex:Agent")).toHaveAttribute("aria-selected", "false");

      // A selection arriving from outside (the route) scrolls its row.
      scrollIntoView.mockClear();
      act(() => setFromOutside("ex:Agent"));
      expect(item("ex:Agent")).toHaveAttribute("aria-selected", "true");
      expect(scrollIntoView.mock.instances[0]).toBe(item("ex:Agent"));

      // Filter: matches plus ancestors, ancestors held open.
      fireEvent.change(screen.getByLabelText("Filter classes"), {
        target: { value: "req" },
      });
      expect(item("ex:Requirement")).toBeInTheDocument();
      expect(screen.queryByTestId("tree-node-ex:Design")).toBeNull();
      expect(screen.queryByTestId("tree-node-ex:Agent")).toBeNull();
      expect(screen.getByTestId("tree-toggle-ex:Artifact")).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Filter classes"), {
        target: { value: "nothing here" },
      });
      expect(screen.getByTestId("tree-view-filter-empty")).toBeInTheDocument();
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      useSelectionStore.getState().clear();
    }
  });
});

describe("wiring guide: double-click a node to open detail", () => {
  // The recipe binds `dbltap` inside onReady. Cytoscape's event
  // model is the same headless, so the twin runs the recipe's handler
  // against a headless core and fires the gesture from the API.
  it("dbltap on a node selects it and opens detail; on the background it fits", async () => {
    const { default: cytoscape } = await import("cytoscape");
    const cy = cytoscape({
      headless: true,
      elements: [{ data: { id: "n1" } }, { data: { id: "n2" } }],
    });
    const opened: string[] = [];
    const animate = vi.spyOn(cy, "animate");
    const handleReady = (core: Core) => {
      core.on("dbltap", "node", (evt) => {
        const id = evt.target.id();
        useSelectionStore.getState().selectNodes([id]);
        opened.push(id);
      });
      core.on("dbltap", (evt) => {
        if (evt.target === core) {
          core.animate(
            { fit: { eles: core.elements(), padding: 40 } },
            { duration: 200 },
          );
        }
      });
    };
    handleReady(cy);
    cy.getElementById("n1").emit("dbltap");
    expect(opened).toEqual(["n1"]);
    expect(useSelectionStore.getState().selectedNodeIds.has("n1")).toBe(true);
    cy.emit("dbltap");
    expect(animate).toHaveBeenCalledTimes(1);
    // Issue #50: the twin also pins that bus wiring of the same shape
    // belongs in onReady; see the "Add your action" recipe.
    cy.destroy();
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

describe("wiring guide: grow a drawn graph without rebuilding it", () => {
  // The canvas's in-place growth is pinned under a cytoscape mock in
  // packages/react (CytoscapeCanvas.additive.test.tsx) and against the
  // real fcose in additive-update.test.ts. This twin runs the HOST side
  // of the recipe: every step is a superset ugm whose drawn edges keep
  // their ids, which is what makes the diff add only what is new.
  it("each step is a superset ugm with stable edge ids; additive mode is a canvas prop", () => {
    const base = graph();
    const neighborhood = (nodeId: string) =>
      nodeId === "asset-2"
        ? [
            {
              id: "asset-3",
              types: ["Asset"],
              properties: {},
              relation: "feeds",
            },
          ]
        : [];
    const expand = (current: UGM, nodeId: string): UGM => {
      const next = UGM.fromJSON(current.toJSON());
      for (const n of neighborhood(nodeId)) {
        if (!next.hasNode(n.id))
          next.addNode(n.id, { types: n.types, properties: n.properties });
        next.addEdge(nodeId, n.id, {
          type: n.relation,
          key: `${nodeId}->${n.id}`,
        });
      }
      return next;
    };
    const next = expand(base, "asset-2");
    for (const id of base.getNodeIds()) expect(next.hasNode(id)).toBe(true);
    const drawnEdgeIds: string[] = [];
    base.forEachEdge((id) => drawnEdgeIds.push(id));
    expect(drawnEdgeIds.length).toBeGreaterThan(0);
    for (const id of drawnEdgeIds) expect(next.hasEdge(id)).toBe(true);
    expect(next.hasEdge("asset-2->asset-3")).toBe(true);
    expect(next.nodeCount).toBe(base.nodeCount + 1);
    // The prop is on the public canvas type.
    const el = <CytoscapeCanvas ugm={next} graphUpdate="additive" />;
    expect(el.props.graphUpdate).toBe("additive");
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

  it("edge ids are the triple's key, stable across runs and deduped on a repeated triple", () => {
    const regulates = tinyRdf.triples[2]!;
    const edgeId = tripleEdgeKey(
      regulates.subject,
      regulates.predicate,
      regulates.object,
    );
    expect(edgeId).toBe(`<${EX}p53> <${EX}regulates> <${EX}mdm2>`);
    const ugm = createPresetPipeline("standard").project(tinyRdf);
    expect(ugm.getEdge(edgeId)?.type).toBe("regulates");
    // Same input, second run: same id.
    expect(
      createPresetPipeline("standard").project(tinyRdf).hasEdge(edgeId),
    ).toBe(true);
    // The triple bound twice (two SELECT rows) is one edge, first wins.
    const twice = createPresetPipeline("standard").project({
      triples: [...tinyRdf.triples, regulates],
    });
    expect(twice.getEdgesBetween(`${EX}p53`, `${EX}mdm2`).length).toBe(1);
    // An edge id never equals a node id.
    expect(ugm.hasNode(edgeId)).toBe(false);
    // A named graph is opt-in and makes a distinct key.
    expect(tripleEdgeKey("s", "p", "o", "g")).toBe("<s> <p> <o> <g>");
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

    const { ugm: sub, truncated } = buildSubgraph(
      big,
      members.get("cluster:t1") ?? [],
      25,
    );
    expect(truncated).toBe(true);
    expect(sub.getNodeIds().length).toBe(25);
  });
});

describe("dense labels (guide: Dense graphs: let labels yield to each other)", () => {
  it("resolves overprinting labels by the canvas's priority rule", () => {
    const selectedIds = new Set(["p2"]);
    const labels: LabelCandidate[] = [
      {
        id: "p1",
        kind: "node" as const,
        text: "Deep residual learning",
        box: { x: 0, y: 0, w: 140, h: 12 },
        priority: 0,
      },
      {
        id: "p2",
        kind: "node" as const,
        text: "Attention is all you need",
        box: { x: 120, y: 4, w: 160, h: 12 },
        priority: 0,
      },
    ].map((l) => ({
      ...l,
      priority: composeLabelPriority({
        kind: l.kind,
        selected: selectedIds.has(l.id),
        explicit: 0,
      }),
    }));
    const { decisions, shortened } = resolveLabelCollisions(labels, {
      mode: "shorten",
      maxLength: 14,
    });
    // The selected paper keeps its full label; the other is truncated
    // (14 of 22 chars: 89px centered on x=70 ends at 115, clear of
    // p2 at x>=120).
    expect(decisions.get("p2")).toBe("show");
    expect(decisions.get("p1")).toBe("shorten");
    expect(shortened.get("p1")).toBe("Deep residual\u2026");
    // Same input in any order, same answer.
    const again = resolveLabelCollisions([...labels].reverse(), {
      mode: "shorten",
      maxLength: 14,
    });
    expect([...again.decisions.entries()].sort()).toEqual(
      [...decisions.entries()].sort(),
    );
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

describe("screen-reader narration (guide: Announce graph state to a screen reader)", () => {
  it("host announcements reach the companion's live region, debounced, muted while playing, hidden mirrored", () => {
    vi.useFakeTimers();
    try {
      const ugm = graph();
      const hidden = new Set<string>();
      function Narrated({ playing }: { playing: boolean }) {
        const selectedId = useSelectionStore(
          (s) => [...s.selectedNodeIds][0] ?? null,
        );
        const { announcement, announce } = useAnnouncer();
        useEffect(() => {
          if (selectedId === null) return;
          const name = String(ugm.getNode(selectedId)?.properties.name);
          announce(`Selected ${name}`);
        }, [selectedId, announce]);
        return (
          <AriaCompanion
            ugm={ugm}
            hidden={hidden}
            label="Provenance nodes"
            instructions="Focusing a node selects it on the canvas; arrow right follows an edge."
            summarizeNode={(g, id) =>
              `${String(g.getNode(id)?.properties.name)}, ${g.getNodeEdges(id).length} provenance edges`
            }
            announcement={announcement}
            announceDebounceMs={300}
            muted={playing}
          />
        );
      }
      const { rerender } = render(<Narrated playing={false} />);
      const list = screen.getByRole("listbox", { name: "Provenance nodes" });
      expect(
        document.getElementById(list.getAttribute("aria-describedby")!)
          ?.textContent,
      ).toContain("arrow right follows an edge");
      expect(
        screen.getByTestId("aria-node-asset-1").getAttribute("aria-label"),
      ).toBe("Pump, 1 provenance edges");
      const live = () => screen.getByTestId("aria-live-region").textContent;
      act(() => {
        useSelectionStore.getState().selectNodes(["asset-1"]);
      });
      expect(live()).toBe("");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(live()).toBe("Selected Pump");
      // Muted while playing: the region holds; the latest commits on stop.
      rerender(<Narrated playing />);
      act(() => {
        useSelectionStore.getState().selectNodes(["asset-2"]);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(live()).toBe("Selected Pump");
      rerender(<Narrated playing={false} />);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(live()).toBe("Selected Valve");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("table view recipes (guide: Table view recipes)", () => {
  interface Binding {
    s: string;
    label: string;
    count: number;
  }
  const rows: Binding[] = [
    { s: "urn:1", label: "one", count: 1 },
    { s: "urn:2", label: "two", count: 2 },
  ];
  const columns: DataGridColumn<Binding>[] = [
    { id: "s", header: "Subject", value: (r) => r.s },
    {
      id: "label",
      header: "Label",
      value: (r) => r.label,
      render: (v, r) => <a href={r.s}>{String(v)}</a>,
    },
    { id: "count", header: "Count", value: (r) => r.count, filter: "range" },
  ];

  it("renders plain rows without a UGM, with host-owned selection", () => {
    const onSelect = vi.fn();
    render(
      <TableView
        rows={rows}
        columns={columns}
        rowId={(r) => r.s}
        selection={{ selected: new Set(), onSelect }}
      />,
    );
    expect(screen.getByText("Subject")).toBeDefined();
    expect(screen.getByRole("link", { name: "two" })).toBeDefined();
    fireEvent.click(screen.getByTestId("table-row-urn:1"));
    expect(onSelect).toHaveBeenCalledWith(["urn:1"]);
    // The shared store was not written: this is a standalone register.
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
  });

  it("fill mode names the regions and keeps pageSize live", () => {
    const ugm = graph();
    const { rerender } = render(
      <TableView ugm={ugm} fill rowHeight={28} pageSize={1} />,
    );
    const root = screen.getByTestId("table-view");
    expect(root.className).toContain("g3t-table-fill");
    expect(root.querySelector(".g3t-table-scroll")).not.toBeNull();
    expect(root.querySelector(".g3t-table-pagination")).not.toBeNull();
    expect(screen.getByTestId("table-pagination").textContent).toContain(
      "Page 1 of 2",
    );
    rerender(<TableView ugm={ugm} fill rowHeight={28} pageSize={2} />);
    expect(screen.getByTestId("table-pagination").textContent).toContain(
      "Page 1 of 1",
    );
  });

  it("export, search, reorder and multi-value filters (guide: Export, search, reorder, multi-value filters)", () => {
    interface Tagged extends Binding {
      kind: string;
    }
    const tagged: Tagged[] = [
      { s: "urn:1", label: "one", count: 1, kind: "A" },
      { s: "urn:2", label: "two", count: 2, kind: "B" },
      { s: "urn:3", label: "three", count: 3, kind: "A" },
    ];
    const taggedColumns: DataGridColumn<Tagged>[] = [
      { id: "s", header: "Subject", value: (r) => r.s },
      { id: "label", header: "Label", value: (r) => r.label },
      { id: "kind", header: "Kind", value: (r) => r.kind, filter: "values" },
    ];
    const download = vi.fn();
    function Register() {
      const [order, setOrder] = useState<string[]>(["kind", "label", "s"]);
      return (
        <TableView
          rows={tagged}
          columns={taggedColumns}
          rowId={(r) => r.s}
          selection="none"
          search
          exportCsv={{ filename: "bindings.csv", download }}
          columnOrder={order}
          onColumnOrderChange={setOrder}
        />
      );
    }
    render(<Register />);
    const headers = () =>
      [...document.querySelectorAll("thead th")].map((th) =>
        String(th.textContent)
          .replace(/All.*$/, "")
          .trim(),
      );
    expect(headers()).toEqual(["Kind", "Label", "Subject"]);

    // Reorder from the column menu; the host's state follows.
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    fireEvent.click(screen.getByTestId("column-move-right-kind"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(headers()).toEqual(["Label", "Kind", "Subject"]);

    // Multi-value filter: tick A only (None, then A).
    fireEvent.click(screen.getByTestId("column-filter-kind"));
    fireEvent.click(screen.getByTestId("column-filter-kind-none"));
    fireEvent.click(screen.getByTestId("column-filter-kind-option-A"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("table-pagination").textContent).toContain(
      "2 of 3 rows",
    );

    // Search stacks on it and the count follows.
    fireEvent.change(screen.getByTestId("table-search"), {
      target: { value: "thr" },
    });
    expect(screen.getByTestId("table-pagination").textContent).toContain(
      "1 of 3 rows",
    );

    // Export: the filtered rows, the columns in their current order.
    fireEvent.click(screen.getByTestId("table-export-csv"));
    expect(download).toHaveBeenCalledWith(
      "Label,Kind,Subject\r\nthree,A,urn:3\r\n",
      "bindings.csv",
    );
  });

  it("virtualize mounts a window of a long page and the export still sees every row (guide: Virtualize a long page)", () => {
    const bindings: Binding[] = Array.from({ length: 300 }, (_, i) => ({
      s: `urn:${i}`,
      label: `row ${i}`,
      count: i,
    }));
    const download = vi.fn();
    render(
      <div style={{ height: 480 }}>
        <TableView
          rows={bindings}
          columns={columns}
          rowId={(r) => r.s}
          fill
          rowHeight={24}
          pageSize={10_000}
          virtualize={{ overscan: 20 }}
          exportCsv={{ download }}
        />
      </div>,
    );
    // jsdom has no layout, so the body is unmeasured and the table
    // renders the first `overscan` rows; a browser windows on scroll.
    const mounted = document.querySelectorAll("[data-testid^='table-row-']");
    expect(mounted).toHaveLength(20);
    const spacer = screen.getByTestId("table-virtual-spacer");
    expect(spacer.style.height).toBe(`${(300 - 20) * 24}px`);
    expect(screen.getByTestId("table-pagination").textContent).toContain(
      "300 rows",
    );
    fireEvent.click(screen.getByTestId("table-export-csv"));
    const csv = download.mock.calls[0]![0] as string;
    expect(csv.split("\r\n").filter((l) => l !== "")).toHaveLength(301);
  });

  it("sorting, hidden columns, CSV values, empty state, toolbar slot (guide: Sorting, hidden columns, CSV values, empty state, toolbar slot)", () => {
    interface Subject {
      iri: string;
      label: string;
      statements: number;
      graph: string;
    }
    const subjects: Subject[] = [
      { iri: "urn:a", label: "Alpha", statements: 3, graph: "g1" },
      { iri: "urn:b", label: "Beta", statements: 12, graph: "g1" },
      { iri: "urn:c", label: "Gamma", statements: 7, graph: "g2" },
    ];
    const subjectColumns: DataGridColumn<Subject>[] = [
      {
        id: "label",
        header: "Label",
        title: "The rdfs:label, or the IRI's local name",
        value: (r) => r.label,
        csv: (r) => r.iri,
        width: 240,
      },
      {
        id: "statements",
        header: "N",
        value: (r) => r.statements,
        align: "num",
      },
      { id: "graph", header: "Graph", value: (r) => r.graph, hidden: true },
    ];
    const download = vi.fn();
    const exportJson = vi.fn();
    let lastSorting: TableSort[] = [];
    function Register() {
      const [sorting, setSorting] = useState<TableSort[]>([
        { id: "statements", desc: true },
      ]);
      const [pageSize, setPageSize] = useState(25);
      lastSorting = sorting;
      return (
        <TableView
          rows={subjects}
          columns={subjectColumns}
          rowId={(r) => r.iri}
          selection="none"
          sorting={sorting}
          onSortingChange={setSorting}
          pageSize={pageSize}
          pageSizeOptions={[25, 100, 500]}
          onPageSizeChange={setPageSize}
          emptyMessage="No subjects match. Clear a filter to widen the set."
          exportCsv={{ filename: "subjects.csv", download }}
          toolbar={
            <button type="button" onClick={() => exportJson(subjects)}>
              Export JSON
            </button>
          }
        />
      );
    }
    render(<Register />);
    const rowIds = () =>
      [...document.querySelectorAll("[data-testid^='table-row-']")].map((tr) =>
        String(tr.getAttribute("data-testid")).replace("table-row-", ""),
      );
    // Controlled sort applied from the host's state; the hidden column
    // is not in the header row but is in the column menu.
    expect(rowIds()).toEqual(["urn:b", "urn:c", "urn:a"]);
    expect(screen.queryByTestId("column-sort-graph")).toBeNull();
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    expect(screen.getByTestId("column-menu-row-graph")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    // A header click (or Enter on the focused header) reports the next
    // sort, the host stores it, the table follows.
    fireEvent.keyDown(screen.getByTestId("column-sort-label"), {
      key: "Enter",
    });
    expect(lastSorting).toEqual([{ id: "label", desc: false }]);
    expect(rowIds()).toEqual(["urn:a", "urn:b", "urn:c"]);
    // The numeric column was inferred as a range filter and is
    // right-aligned; the header carries the tooltip and width.
    expect(screen.getByTestId("column-filter-statements-min")).toBeDefined();
    const labelTh = screen.getByTestId("column-sort-label").closest("th")!;
    expect(labelTh.style.width).toBe("240px");
    expect(screen.getByTestId("column-sort-label").getAttribute("title")).toBe(
      "The rdfs:label, or the IRI's local name",
    );
    // The export writes the IRI, not the rendered label.
    fireEvent.click(screen.getByTestId("table-export-csv"));
    expect(download).toHaveBeenCalledWith(
      "Label,N\r\nurn:a,3\r\nurn:b,12\r\nurn:c,7\r\n",
      "subjects.csv",
    );
    // The host's own button sits in the same toolbar end.
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(exportJson).toHaveBeenCalledWith(subjects);
    // Rows-per-page goes through the host's state.
    fireEvent.change(screen.getByTestId("table-page-size"), {
      target: { value: "100" },
    });
    expect(
      (screen.getByTestId("table-page-size") as HTMLSelectElement).value,
    ).toBe("100");
    // The empty state names the host's message.
    fireEvent.change(screen.getByTestId("column-filter-statements-min"), {
      target: { value: "99" },
    });
    expect(screen.getByRole("status").textContent).toBe(
      "No subjects match. Clear a filter to widen the set.",
    );
  });

  it("getCsv is the pure half, callable with a row model's rows and leaf columns (guide: Export, search, reorder, multi-value filters)", () => {
    // @tanstack/react-table is a peer of @g3-toolkit/react and is not
    // installed at this example's root, so the rows and columns here
    // are the shape getCsv reads (`row.getValue(id)`, `column.id`,
    // `column.columnDef.header`); the real-table case runs in
    // packages/react/src/views/table/table-followups.test.tsx.
    type CsvRows = Parameters<typeof getCsv>[0];
    type CsvColumns = Parameters<typeof getCsv>[1];
    const records = [...rows].reverse();
    const csvRows = records.map((r) => ({
      getValue: (id: string) => r[id as keyof Binding],
    })) as unknown as CsvRows;
    const csvColumns = [
      { id: "s", columnDef: { header: "Subject" } },
      { id: "label", columnDef: { header: "Label, long" } },
    ] as unknown as CsvColumns;
    expect(getCsv(csvRows, csvColumns)).toBe(
      'Subject,"Label, long"\r\nurn:2,two\r\nurn:1,one\r\n',
    );
  });
});

describe("working-set limits (guide: Working-set limits: page past them)", () => {
  function typed(n: number): UGM {
    const ugm = new UGM();
    for (let i = 0; i < n; i++) {
      ugm.addNode(`n${String(i).padStart(3, "0")}`, {
        types: [`T${String(i).padStart(3, "0")}`],
        properties: {},
      });
    }
    for (let i = 0; i < n - 1; i++) {
      ugm.addEdge(
        `n${String(i).padStart(3, "0")}`,
        `n${String(i + 1).padStart(3, "0")}`,
        { type: "rel", properties: {} },
      );
    }
    return ugm;
  }

  it("checkLimit names the strategy and page size; pageNodes cuts a stable, described window", () => {
    const ugm = typed(350);
    const limits = new WorkingSetManager();
    const check = limits.checkLimit("matrix", 350);
    expect(check).toEqual({
      allowed: false,
      limit: 200,
      requested: 350,
      strategy: "page",
      pageSize: 200,
    });
    expect(limits.checkLimit("canvas", 600).strategy).toBe("refuse");
    expect(limits.checkLimit("canvas", 600, "page").strategy).toBe("page");
    expect(limits.checkLimit("matrix", 100).strategy).toBe("allow");

    const page = pageNodes(ugm, { offset: 0, size: check.pageSize });
    const window: PageWindow = page.window;
    expect(window).toEqual({
      offset: 0,
      size: 200,
      total: 350,
      totalExact: true,
    });
    expect(pageCount(window)).toBe(2);
    const next = pageNodes(ugm, { offset: window.size, size: window.size });
    expect(next.items).toHaveLength(150);
    expect(next.items[0]).toBe("n200");
    // Stable: the same request names the same ids on every call.
    expect(pageNodes(ugm, { offset: 0, size: 200 })).toEqual(page);
  });

  it("MatrixView pages per axis at the manager's limit; PaginationControl pages a host list", () => {
    const ugm = typed(7);
    const limits = new WorkingSetManager({ matrix: 4 });
    render(<MatrixView ugm={ugm} maxSize={limits.getLimit("matrix")} />);
    expect(
      screen.getByTestId("matrix-rows-pagination-summary").textContent,
    ).toBe("rows 1 to 4 of 7");
    expect(screen.queryByTestId("matrix-cell-T003-T004")).toBeNull();
    fireEvent.click(screen.getByTestId("matrix-columns-pagination-next"));
    expect(screen.getByTestId("matrix-cell-T003-T004").textContent).toBe("1");

    function NodeRegister() {
      const [page, setPage] = useState(0);
      const size = 3;
      const { items, window } = pageNodes(ugm, { offset: page * size, size });
      return (
        <>
          <ul>
            {items.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <PaginationControl
            page={page}
            pageSize={size}
            total={window.total}
            totalExact={window.totalExact}
            noun="nodes"
            onPageChange={setPage}
          />
        </>
      );
    }
    render(<NodeRegister />);
    expect(screen.getByTestId("pagination-control-summary").textContent).toBe(
      "nodes 1 to 3 of 7",
    );
    const nav = screen.getByRole("navigation", { name: "Nodes pagination" });
    fireEvent.keyDown(nav, { key: "End" });
    expect(screen.getByTestId("pagination-control-summary").textContent).toBe(
      "nodes 7 to 7 of 7",
    );
    expect(screen.getByText("n006")).toBeDefined();
    expect(screen.queryByText("n000")).toBeNull();
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

  it("path options: maxHops, directed, nodeFilter (guide: Path analysis)", () => {
    const ugm = tinyGraph();
    // a - b - c plus a hub joining a and c directly.
    ugm.addNode("hub:1", { types: ["Hub"], properties: {} });
    ugm.addEdge("a", "hub:1", { type: "feeds" });
    ugm.addEdge("hub:1", "c", { type: "feeds" });
    ugm.addEdge("c", "a", { type: "returns" });

    const bounded = findShortestPath(ugm, "a", "c", {
      maxHops: 4,
      directed: true,
      nodeFilter: (id) => !id.startsWith("hub:"),
    });
    expect(bounded.nodeIds).toEqual(["a", "b", "c"]);
    // Undirected, c - a is one hop; directed, that edge points the
    // other way.
    expect(findShortestPath(ugm, "a", "c").length).toBe(1);
    // A farther target under maxHops is reported not found.
    expect(
      findShortestPath(ugm, "a", "c", { maxHops: 1, directed: true }).found,
    ).toBe(false);
    expect(
      allShortestPaths(ugm, "a", "c", { maxHops: 1, directed: true }).found,
    ).toBe(false);
  });

  it("kShortestPaths lists individual routes, shortest first (guide: Path analysis)", () => {
    const ugm = tinyGraph();
    ugm.addNode("hub:1", { types: ["Hub"], properties: {} });
    ugm.addEdge("a", "hub:1", { type: "feeds" });
    ugm.addEdge("hub:1", "c", { type: "feeds" });
    ugm.addEdge("a", "c", { type: "direct" });
    const routes = kShortestPaths(ugm, "a", "c", { k: 5, maxHops: 4 });
    expect(routes.map((r) => r.nodeIds)).toEqual([
      ["a", "c"],
      ["a", "b", "c"],
      ["a", "hub:1", "c"],
    ]);
    expect(routes.every((r) => r.edgeIds.length === r.nodeIds.length - 1)).toBe(
      true,
    );
    // k larger than the number of routes: a shorter array, not an error.
    expect(kShortestPaths(ugm, "a", "c", { k: 50 })).toHaveLength(3);
  });

  it("PathGraph: a four-method view stands in for a UGM (guide: Path analysis)", () => {
    const ugm = tinyGraph();
    const view: PathGraph = {
      hasNode: (id) => ugm.hasNode(id),
      getNodeEdges: (id) => ugm.getNodeEdges(id),
      getEdgeEndpoints: (id) => ugm.getEdgeEndpoints(id),
      getEdge: (id) => ugm.getEdge(id),
    };
    expect(findShortestPath(view, "a", "c").nodeIds).toEqual(["a", "b", "c"]);
    expect(kShortestPaths(view, "a", "c", { k: 2 })).toHaveLength(1);
  });

  it("endpoints: a node hasNode does not report is never found; an existing node is its own zero-hop path (guide: Path analysis)", () => {
    const ugm = tinyGraph();
    ugm.addNode("lone", { types: ["Site"], properties: {} });
    // An adjacency-style index: only nodes with edges are reported.
    const view: PathGraph = {
      hasNode: (id) => ugm.hasNode(id) && ugm.getNodeEdges(id).length > 0,
      getNodeEdges: (id) => ugm.getNodeEdges(id),
      getEdgeEndpoints: (id) => ugm.getEdgeEndpoints(id),
      getEdge: (id) => ugm.getEdge(id),
    };
    expect(findShortestPath(view, "lone", "lone").found).toBe(false);
    expect(allShortestPaths(view, "lone", "lone").pathCount).toBe(0);
    expect(kShortestPaths(view, "lone", "lone", { k: 3 })).toEqual([]);
    expect(findShortestPath(view, "b", "b")).toEqual({
      nodeIds: ["b"],
      edgeIds: [],
      length: 0,
      found: true,
    });
    expect(allShortestPaths(view, "b", "b").pathCount).toBe(1);
    expect(kShortestPaths(view, "b", "b", { k: 3 })).toEqual([
      { nodeIds: ["b"], edgeIds: [] },
    ]);
  });

  it("kShortestPaths over the allShortestPaths union lists only the shortest routes (guide: Path analysis)", () => {
    const ugm = tinyGraph();
    // a - b - c, a second two-hop route through a hub, and a three-hop
    // detour that kShortestPaths over the full graph would list too.
    ugm.addNode("hub:1", { types: ["Hub"], properties: {} });
    ugm.addEdge("a", "hub:1", { type: "feeds" });
    ugm.addEdge("hub:1", "c", { type: "feeds" });
    ugm.addNode("d1", { types: ["Site"], properties: {} });
    ugm.addNode("d2", { types: ["Site"], properties: {} });
    ugm.addEdge("a", "d1", { type: "feeds" });
    ugm.addEdge("d1", "d2", { type: "feeds" });
    ugm.addEdge("d2", "c", { type: "feeds" });
    expect(kShortestPaths(ugm, "a", "c", { k: 50 })).toHaveLength(3);

    const union = allShortestPaths(ugm, "a", "c");
    expect(union.found).toBe(true);
    expect(union.length).toBe(2);
    expect(union.pathCount).toBe(2);
    const nodes = new Set(union.nodeIds);
    const edges = new Set(union.edgeIds);
    const unionView: PathGraph = {
      hasNode: (id) => nodes.has(id),
      getNodeEdges: (id) => ugm.getNodeEdges(id).filter((e) => edges.has(e)),
      getEdgeEndpoints: (id) => ugm.getEdgeEndpoints(id),
      getEdge: (id) => ugm.getEdge(id),
    };
    const shortestRoutes = kShortestPaths(unionView, "a", "c", {
      k: union.pathCount,
      maxHops: union.length,
    });
    expect(shortestRoutes.map((r) => r.nodeIds).sort()).toEqual([
      ["a", "b", "c"],
      ["a", "hub:1", "c"],
    ]);
    expect(shortestRoutes.every((r) => r.edgeIds.length === union.length)).toBe(
      true,
    );
  });

  it("UGM.addEdge keeps a host-supplied key as the edge id (guide: The integration surface)", () => {
    const ugm = new UGM();
    ugm.addNode("pump-1", { types: ["Asset"], properties: { name: "Pump" } });
    ugm.addNode("site-north", { types: ["Site"], properties: {} });
    const edgeId = ugm.addEdge("pump-1", "site-north", {
      key: "pump-1|locatedAt|site-north",
      type: "locatedAt",
    });
    expect(edgeId).toBe("pump-1|locatedAt|site-north");
    // Snapshots and the JSON export carry it unchanged.
    expect(UGM.fromJSON(ugm.toJSON()).hasEdge(edgeId)).toBe(true);
    const exported = JSON.parse(exportSubgraphJson(ugm)) as {
      edges: Array<{ id: string }>;
    };
    expect(exported.edges[0]?.id).toBe(edgeId);
    expect(() =>
      ugm.addEdge("pump-1", "site-north", { key: edgeId, type: "locatedAt" }),
    ).toThrow(/already exists/);
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

  it("derived properties carry their provenance (guide: Derived properties carry their provenance)", () => {
    const ugm = new UGM();
    ugm.addNode("pump-1", { types: ["Asset"], properties: { risk: 0.4 } });
    ugm.addNode("pump-2", { types: ["Asset"], properties: { risk: 0.9 } });

    const engine = new DerivedPropertyEngine();
    engine.define({
      name: "riskScore",
      expression: "risk * 100",
      reactive: false,
    });
    engine.compute(ugm);

    const stamp = ugm.getDerivation("pump-1", "riskScore");
    expect(stamp).toMatchObject({
      definitionId: "riskScore",
      version: 1,
      expression: "risk * 100",
    });
    expect(stamp?.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(ugm.getDerivation("pump-1", "risk")).toBeUndefined();
    expect(ugm.listDerivations()).toHaveLength(2);
    expect(ugm.listDerivations("pump-2")).toHaveLength(1);

    // The value is a plain property; only the sidecar knows it is derived.
    expect(ugm.getNode("pump-1")?.properties.riskScore).toBeCloseTo(40);

    // Snapshot round-trip (version 2) keeps the stamp; a pre-2 snapshot loads.
    const snapshot = ugm.toJSON();
    expect(snapshot.version).toBe(2);
    expect(UGM.fromJSON(snapshot).getDerivation("pump-1", "riskScore")).toEqual(
      stamp,
    );
    const legacy = UGM.fromJSON({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
    });
    expect(legacy.nodeCount).toBe(2);
    expect(legacy.listDerivations()).toEqual([]);

    // A changed rule leaves the old values stale until recomputed.
    engine.define({
      name: "riskScore",
      expression: "risk * 1000",
      reactive: false,
    });
    expect(
      engine
        .listStale(ugm)
        .map((r) => r.nodeId)
        .sort(),
    ).toEqual(["pump-1", "pump-2"]);
    engine.recompute(ugm, "riskScore");
    expect(engine.listStale(ugm)).toEqual([]);
    expect(ugm.getDerivation("pump-1", "riskScore")?.version).toBe(2);

    // A source write clears the stamp.
    ugm.updateNodeProperties("pump-2", { riskScore: 1 });
    expect(ugm.getDerivation("pump-2", "riskScore")).toBeUndefined();

    // The JSON export carries it; CSV does not.
    const doc = JSON.parse(exportSubgraphJson(ugm)) as {
      nodes: Array<{
        id: string;
        derivations?: Record<string, { definitionId: string }>;
      }>;
    };
    expect(
      doc.nodes.find((n) => n.id === "pump-1")?.derivations?.riskScore
        ?.definitionId,
    ).toBe("riskScore");
    expect(
      doc.nodes.find((n) => n.id === "pump-2")?.derivations,
    ).toBeUndefined();
    expect(exportSubgraphCsv(ugm)).not.toContain("computedAt");
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

  it("themeFromCssVariables + applyTheme: follow the host's variables, dispose on unmount", () => {
    const sheet = document.createElement("style");
    sheet.textContent =
      ":root { --app-surface: #111111; --app-text: #eeeeee; --app-accent: #ff8800; }";
    document.head.appendChild(sheet);
    const theme = themeFromCssVariables(
      document.body,
      {
        bgPrimary: "--app-surface",
        textPrimary: "--app-text",
        accentPrimary: "--app-accent",
      },
      { id: "app", name: "App", colorScheme: "dark" },
    );
    expect(theme.bgPrimary).toBe("#111111");
    expect(theme.accentPrimary).toBe("#ff8800");
    const dispose = applyTheme(theme, { target: document.body });
    expect(document.body.style.getPropertyValue("--g3t-bg-primary")).toBe(
      "#111111",
    );
    expect(document.body.style.getPropertyValue("color-scheme")).toBe("dark");
    dispose();
    expect(document.body.style.getPropertyValue("--g3t-bg-primary")).toBe("");
    expect(document.body.style.getPropertyValue("color-scheme")).toBe("");
    sheet.remove();
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

describe("wiring guide: set deployment working-set limits", () => {
  const deploymentConfigText = JSON.stringify({
    version: 1,
    limits: {
      canvas: { default: 300, ceiling: 800 },
      tree: { ceiling: 2000 },
      matrix: { default: 3 },
    },
  });

  function ringOfTypes(n: number): UGM {
    const ugm = new UGM();
    for (let i = 0; i < n; i++) {
      ugm.addNode(`n${i}`, { types: [`T${i}`], properties: {} });
    }
    for (let i = 0; i < n; i++) {
      ugm.addEdge(`n${i}`, `n${(i + 1) % n}`, { type: "next" });
    }
    return ugm;
  }

  it("R7.7: the administrator's 300 canvas limit applies through the provider", () => {
    const manager = WorkingSetManager.fromConfig(
      parseWorkingSetConfig(deploymentConfigText),
    );
    let seen: WorkingSetManager | null = null;
    function Probe() {
      seen = useWorkingSetManager();
      return null;
    }
    render(
      <WorkingSetProvider manager={manager}>
        <Probe />
        <MatrixView ugm={ringOfTypes(5)} />
      </WorkingSetProvider>,
    );
    expect(seen).toBe(manager);
    expect(manager.getLimit("canvas")).toBe(300);
    expect(manager.checkLimit("canvas", 301).allowed).toBe(false);
    // The matrix read its limit from the same document: it pages at 3
    // per axis (#6 replaced the truncation notice with paging).
    expect(
      screen.getByTestId("matrix-rows-pagination-summary").textContent,
    ).toBe("rows 1 to 3 of 5");
  });

  it("the explicit action to exceed: a prompt under the ceiling, a refusal above it", () => {
    const manager = WorkingSetManager.fromConfig(
      parseWorkingSetConfig(deploymentConfigText),
    );
    function ShowAllNotice({ requested }: { requested: number }) {
      const mgr = useWorkingSetManager();
      const notice = workingSetLimitMessage(mgr, "canvas", requested);
      if (notice.kind === "within") return null;
      if (notice.kind === "refused") {
        return <p role="status">{notice.message}</p>;
      }
      return (
        <p role="status">
          {notice.message}{" "}
          <button onClick={() => mgr.setUserOverride("canvas", requested)}>
            Show all
          </button>
        </p>
      );
    }
    const { rerender } = render(
      <WorkingSetProvider manager={manager}>
        <ShowAllNotice requested={650} />
      </WorkingSetProvider>,
    );
    expect(screen.getByRole("status").textContent).toMatch(/Show all\?/);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(manager.getLimit("canvas")).toBe(650);

    rerender(
      <WorkingSetProvider manager={manager}>
        <ShowAllNotice requested={801} />
      </WorkingSetProvider>,
    );
    expect(screen.getByRole("status").textContent).toMatch(
      /exceeds this deployment's canvas ceiling of 800/,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(manager.canRaise("canvas", 801)).toMatchObject({
      ok: false,
      reason: "above-ceiling",
    });
    expect(manager.getCeiling("canvas")).toBe(800);
  });

  it("a malformed document fails at setup with the shared typed error", () => {
    expect(() =>
      parseWorkingSetConfig(
        JSON.stringify({ version: 1, limits: { canvass: { ceiling: 1 } } }),
      ),
    ).toThrow(/unknown view type "canvass"/);
  });
});
