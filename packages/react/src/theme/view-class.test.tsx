/**
 * Issue #45: every exported view and panel root carries `g3t-view`.
 *
 * #24 scoped the toolkit typography to `g3t-` classes and left the
 * reset and body rule to the opt-in page stylesheet, which exposed
 * the views whose root was an unclassed, inline-styled element: they
 * inherited the host font. The `.g3t-view` rule in g3t-base.css is
 * where the toolkit's text now starts, so this table renders each
 * component with minimal props and pins (a) the root carries the
 * class, and (b) a host `className` stays FIRST so selectors on it
 * keep working. A component missing from this table is a component
 * that can silently lose the toolkit face again.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  UGM,
  DerivedPropertyEngine,
  type LayoutEngine,
  type StructuralGeometry,
  type StructuralGraphInput,
  type VisualAttributes,
} from "@g3-toolkit/core";
import { stubChartDims } from "../../../../tests/chart-dims";
import { useSelectionStore } from "../state/selection-store";
import { VIEW_CLASS, viewClass } from "./view-class";

// Cytoscape needs a real 2D context; the wrapper's DOM is the subject.
const mockCy = {
  on: vi.fn(),
  one: vi.fn(),
  removeListener: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => ({ length: 0, forEach: vi.fn() })),
  edges: vi.fn(() => ({ length: 0, forEach: vi.fn() })),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
  getElementById: vi.fn(() => ({ nonempty: () => false })),
  fit: vi.fn(),
  pan: vi.fn(() => ({ x: 0, y: 0 })),
  zoom: vi.fn(() => 1),
  viewport: vi.fn(),
  elements: vi.fn(() => ({ removeClass: vi.fn(), forEach: vi.fn() })),
  $id: vi.fn(() => ({ empty: () => true, json: vi.fn() })),
  remove: vi.fn(),
  collection: vi.fn(() => ({})),
  add: vi.fn(),
};
vi.mock("cytoscape", () => ({
  default: vi.fn(() => mockCy),
  __esModule: true,
}));
vi.mock("cytoscape-fcose", () => ({ default: vi.fn(), __esModule: true }));

const { CytoscapeCanvas } = await import("../views/canvas/CytoscapeCanvas");
const { AriaCompanion } = await import("../a11y/AriaCompanion");
const { ThemeSwitcher } = await import("./ThemeSwitcher");
const { AlgorithmPanel } =
  await import("../interaction/algorithms/AlgorithmPanel");
const { AnnotationPanel } =
  await import("../interaction/annotations/AnnotationPanel");
const { Minimap } = await import("../interaction/camera/Minimap");
const { ContextMenu } = await import("../interaction/context-menu/ContextMenu");
const { EncodingSpecPanel, EncodingPreview } =
  await import("../interaction/encoding/EncodingSpecPanel");
const { DEFAULT_SPEC } = await import("../interaction/encoding/encoding-spec");
const { NodeStyleEditor } =
  await import("../interaction/encoding/NodeStyleEditor");
const { SpecLegend } = await import("../interaction/encoding/SpecLegend");
const { SpecPort } = await import("../interaction/encoding/SpecPort");
const { EncodingPanel, CanvasLegend, DEFAULT_ENCODING } =
  await import("../interaction/encoding");
const { EmptyState } = await import("../interaction/feedback/EmptyState");
const { FacetFilter } = await import("../interaction/filter/FacetFilter");
const { FilterBuilder } = await import("../interaction/filter/FilterBuilder");
const { LayoutManager } =
  await import("../interaction/layout-manager/LayoutManager");
const { LayoutSwitcher } =
  await import("../interaction/layout-switcher/LayoutSwitcher");
const { OverlayTransport } =
  await import("../interaction/overlay/OverlayTransport");
const { PaginationControl } =
  await import("../interaction/pagination/PaginationControl");
const { DerivedPropertyPanel } =
  await import("../interaction/property-editor/DerivedPropertyPanel");
const { PropertyEditor } =
  await import("../interaction/property-editor/PropertyEditor");
const { SearchBar } = await import("../interaction/search/SearchBar");
const { TemporalRangeFilter } =
  await import("../interaction/temporal/TemporalRangeFilter");
const { TemporalSlider } =
  await import("../interaction/temporal/TemporalSlider");
const { GraphToolbar } = await import("../interaction/toolbar/GraphToolbar");
const {
  HoverTooltip,
  ZoomControls,
  Toolbar,
  StatusBar,
  KeyboardShortcutModal,
} = await import("../interaction/toolbar/UxSurface");
const { CanvasAdapter } = await import("../views/canvas2d/canvas-adapter");
const { CoverageMeter, CoverageMeterList } =
  await import("../views/coverage/CoverageMeter");
const { ViewErrorBoundary } = await import("../views/error/ViewErrorBoundary");
const { DetailInspector } = await import("../views/inspector/DetailInspector");
const { NodeEditorModal } = await import("../views/inspector/NodeEditorModal");
const { NodePropertyInspector } =
  await import("../views/inspector/NodePropertyInspector");
const { FloatingLegend } = await import("../views/legend/FloatingLegend");
const { MapView } = await import("../views/map/MapView");
const { MatrixView } = await import("../views/matrix/MatrixView");
const { FloatingPanel } = await import("../views/popout/FloatingPanel");
const { NeighborhoodPopout } =
  await import("../views/popout/NeighborhoodPopout");
const { ProvenanceTrace } = await import("../views/provenance/ProvenanceTrace");
const { QueryEditor } = await import("../views/query/QueryEditor");
const { SankeyView } = await import("../views/sankey/SankeyView");
const { DiffRenderer } = await import("../views/schema/DiffRenderer");
const { SchemaView } = await import("../views/schema/SchemaView");
const { ShaclShapeBrowser } = await import("../views/schema/ShaclShapeBrowser");
const { StatsPanel } = await import("../views/stats/StatsPanel");
const { StructuralSvgView } = await import("../views/svg/structural-svg-view");
const { SvgAdapter } = await import("../views/svg/svg-adapter");
const { TableView } = await import("../views/table/TableView");
const { TimelineView } = await import("../views/timeline/TimelineView");
const { TreeView } = await import("../views/tree/TreeView");

stubChartDims();
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", {
    types: ["Person"],
    properties: {
      name: "Alice",
      score: 0.4,
      date: "2025-03-15",
      latitude: 40.7,
      longitude: -74.0,
    },
  });
  ugm.addNode("b", {
    types: ["Org"],
    properties: {
      name: "Acme",
      score: 0.9,
      date: "2025-06-20",
      latitude: 51.5,
      longitude: -0.1,
    },
  });
  ugm.addNode("c", {
    types: ["Part"],
    properties: { name: "Cog", score: 0.2 },
  });
  ugm.addEdge("a", "b", { type: "worksAt", key: "ab" });
  ugm.addEdge("b", "c", { type: "contains", key: "bc" });
  return ugm;
}

const engines: LayoutEngine[] = [
  { name: "Force", id: "force", compute: vi.fn(async () => new Map()) },
];

const STRUCT_INPUT: StructuralGraphInput = {
  nodes: [{ id: "n", header: { name: "N" }, width: 100, height: 40 }],
  edges: [],
};
const STRUCT_GEOMETRY: StructuralGeometry = {
  version: 1,
  headerHeight: 24,
  nodes: { n: { x: 0, y: 0, width: 100, height: 40, kind: "node", text: "N" } },
  ports: {},
  edges: {},
};
const SCENE_NODES = [{ id: "n1", x: 20, y: 20, width: 20, height: 20 }];
const SCENE_RESOLVED = new Map<string, VisualAttributes>([
  ["n1", { shape: "ellipse" }],
]);

function Throws(): never {
  throw new Error("boom");
}

interface Case {
  name: string;
  /** Render with an optional host class; return the root. */
  render: (className?: string) => ReactElement;
  root: () => Element;
  /** False when the component takes no className prop. */
  host?: false;
}

const cases: Case[] = [
  {
    name: "CytoscapeCanvas (outer wrapper; the mount keeps className)",
    render: () => <CytoscapeCanvas ugm={graph()} />,
    root: () => screen.getByTestId("cytoscape-canvas").parentElement!,
    host: false,
  },
  {
    name: "AriaCompanion",
    render: (c) => <AriaCompanion ugm={graph()} className={c} />,
    root: () => screen.getByTestId("aria-companion"),
  },
  {
    name: "ThemeSwitcher",
    render: (c) => <ThemeSwitcher className={c} />,
    root: () => screen.getByTestId("g3t-theme-switcher"),
  },
  {
    name: "AlgorithmPanel",
    render: (c) => <AlgorithmPanel ugm={graph()} className={c} />,
    root: () => screen.getByTestId("g3t-algorithm-panel"),
  },
  {
    name: "AnnotationPanel (selected)",
    render: (c) => <AnnotationPanel elementId="a" className={c} />,
    root: () => screen.getByTestId("annotation-panel"),
  },
  {
    name: "AnnotationPanel (nothing selected)",
    render: (c) => (
      <div data-testid="wrap">
        <AnnotationPanel elementId={null} className={c} />
      </div>
    ),
    root: () => screen.getByTestId("wrap").firstElementChild!,
  },
  {
    name: "Minimap",
    render: (c) => <Minimap core={null} className={c} />,
    root: () => screen.getByTestId("minimap"),
  },
  {
    name: "ContextMenu",
    render: () => (
      <ContextMenu
        items={[{ id: "i", label: "Inspect", action: vi.fn() }]}
        target={{ type: "node", id: "a", position: { x: 1, y: 1 } }}
        onClose={vi.fn()}
      />
    ),
    root: () => screen.getByTestId("context-menu"),
    host: false,
  },
  {
    name: "EncodingSpecPanel",
    render: (c) => (
      <EncodingSpecPanel
        ugm={graph()}
        spec={DEFAULT_SPEC}
        onChange={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("encoding-spec-panel"),
  },
  {
    name: "EncodingPreview",
    render: (c) => (
      <EncodingPreview ugm={graph()} spec={DEFAULT_SPEC} className={c} />
    ),
    root: () => screen.getByTestId("encoding-preview"),
  },
  {
    name: "NodeStyleEditor",
    render: (c) => (
      <NodeStyleEditor
        ugm={graph()}
        nodeId="a"
        onClose={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("node-style-editor"),
  },
  {
    name: "SpecLegend",
    render: (c) => (
      <SpecLegend ugm={graph()} spec={DEFAULT_SPEC} className={c} />
    ),
    root: () => screen.getByTestId("g3t-spec-legend"),
  },
  {
    name: "SpecPort",
    render: (c) => (
      <SpecPort spec={DEFAULT_SPEC} onApply={vi.fn()} className={c} />
    ),
    root: () => screen.getByTestId("g3t-spec-port"),
  },
  {
    name: "EncodingPanel",
    render: (c) => (
      <EncodingPanel
        ugm={graph()}
        encoding={DEFAULT_ENCODING}
        onChange={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("encoding-panel"),
  },
  {
    name: "CanvasLegend",
    render: (c) => (
      <CanvasLegend ugm={graph()} encoding={DEFAULT_ENCODING} className={c} />
    ),
    root: () => screen.getByTestId("canvas-legend"),
  },
  {
    name: "EmptyState (the empty branch of matrix, sankey, tree, schema, diff)",
    render: (c) => <EmptyState title="Nothing" testId="empty" className={c} />,
    root: () => screen.getByTestId("empty"),
  },
  {
    name: "FacetFilter",
    render: (c) => (
      <FacetFilter ugm={graph()} onFilterChange={vi.fn()} className={c} />
    ),
    root: () => screen.getByTestId("facet-filter"),
  },
  {
    name: "FilterBuilder",
    render: (c) => (
      <FilterBuilder ugm={graph()} onApply={vi.fn()} className={c} />
    ),
    root: () => screen.getByTestId("filter-builder"),
  },
  {
    name: "LayoutManager",
    render: (c) => (
      <LayoutManager
        onLayoutChange={vi.fn()}
        onResetLayout={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("layout-manager"),
  },
  {
    name: "LayoutSwitcher",
    render: (c) => (
      <LayoutSwitcher
        engines={engines}
        activeId="force"
        onSwitch={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("layout-switcher"),
  },
  {
    name: "OverlayTransport",
    render: (c) => (
      <OverlayTransport
        sequence={{
          index: 0,
          length: 2,
          isPlaying: false,
          play: vi.fn(),
          pause: vi.fn(),
          next: vi.fn(),
          prev: vi.fn(),
          goTo: vi.fn(),
        }}
        className={c}
      />
    ),
    root: () => screen.getByRole("group", { name: "Overlay sequence" }),
  },
  {
    name: "PaginationControl",
    render: (c) => (
      <PaginationControl
        page={0}
        pageSize={10}
        total={30}
        noun="rows"
        onPageChange={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByRole("navigation"),
  },
  {
    name: "DerivedPropertyPanel",
    render: (c) => (
      <DerivedPropertyPanel
        ugm={graph()}
        engine={new DerivedPropertyEngine()}
        onCompute={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("derived-property-panel"),
  },
  {
    name: "PropertyEditor",
    render: (c) => (
      <PropertyEditor
        ugm={graph()}
        elementType="node"
        elementId="a"
        className={c}
      />
    ),
    root: () => screen.getByTestId("property-editor"),
  },
  {
    name: "SearchBar",
    render: (c) => (
      <SearchBar ugm={graph()} onSearchChange={vi.fn()} className={c} />
    ),
    root: () => screen.getByTestId("search-bar"),
  },
  {
    name: "TemporalRangeFilter",
    render: (c) => (
      <TemporalRangeFilter
        ugm={graph()}
        timeProperty="date"
        onChange={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("temporal-range-filter"),
  },
  {
    name: "TemporalSlider",
    render: (c) => (
      <TemporalSlider
        ugm={graph()}
        timeProperty="date"
        onRangeChange={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("temporal-slider"),
  },
  {
    name: "GraphToolbar",
    render: (c) => <GraphToolbar ugm={graph()} core={null} className={c} />,
    root: () => screen.getByTestId("g3t-graph-toolbar"),
  },
  {
    name: "HoverTooltip",
    render: () => (
      <HoverTooltip
        data={{ id: "a", label: "A", type: "T", properties: {}, x: 1, y: 1 }}
      />
    ),
    root: () => screen.getByTestId("hover-tooltip"),
    host: false,
  },
  {
    name: "ZoomControls",
    render: (c) => (
      <ZoomControls
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("zoom-controls"),
  },
  {
    name: "Toolbar",
    render: (c) => (
      <Toolbar mode="select" onModeChange={vi.fn()} className={c} />
    ),
    root: () => screen.getByTestId("toolbar"),
  },
  {
    name: "StatusBar",
    render: (c) => <StatusBar ugm={graph()} className={c} />,
    root: () => screen.getByTestId("status-bar"),
  },
  {
    name: "KeyboardShortcutModal",
    render: () => <KeyboardShortcutModal open onClose={vi.fn()} />,
    root: () => screen.getByTestId("shortcut-modal-backdrop"),
    host: false,
  },
  {
    name: "CanvasAdapter",
    render: () => (
      <CanvasAdapter
        nodes={SCENE_NODES}
        edges={[]}
        resolved={SCENE_RESOLVED}
        width={100}
        height={100}
        data-testid="canvas-adapter"
      />
    ),
    root: () => screen.getByTestId("canvas-adapter"),
    host: false,
  },
  {
    name: "CoverageMeter",
    render: (c) => (
      <CoverageMeter
        label="Sustainment"
        substantiated={0.3}
        claimable={1}
        animate={false}
        className={c}
      />
    ),
    root: () => screen.getByTestId("g3t-coverage-meter"),
  },
  {
    name: "CoverageMeterList",
    render: (c) => <CoverageMeterList rows={[]} className={c} />,
    root: () => screen.getByTestId("g3t-coverage-meter-list"),
  },
  {
    name: "ViewErrorBoundary (default fallback)",
    render: () => (
      <ViewErrorBoundary>
        <Throws />
      </ViewErrorBoundary>
    ),
    root: () => screen.getByRole("alert"),
    host: false,
  },
  {
    name: "DetailInspector (nothing selected)",
    render: (c) => (
      <DetailInspector ugm={graph()} selection={null} className={c} />
    ),
    root: () => screen.getByTestId("detail-inspector"),
  },
  {
    name: "DetailInspector (node)",
    render: (c) => (
      <DetailInspector
        ugm={graph()}
        selection={{ type: "node", id: "a" }}
        className={c}
      />
    ),
    root: () => screen.getByTestId("detail-inspector"),
  },
  {
    name: "DetailInspector (edge)",
    render: (c) => (
      <DetailInspector
        ugm={graph()}
        selection={{ type: "edge", id: "ab" }}
        className={c}
      />
    ),
    root: () => screen.getByTestId("detail-inspector"),
  },
  {
    name: "NodeEditorModal",
    render: (c) => (
      <NodeEditorModal
        ugm={graph()}
        nodeId="a"
        onClose={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("node-editor-modal"),
  },
  {
    name: "NodePropertyInspector",
    render: (c) => (
      <NodePropertyInspector ugm={graph()} selection={null} className={c} />
    ),
    root: () => screen.getByTestId("node-property-inspector"),
  },
  {
    name: "FloatingLegend",
    render: () => <FloatingLegend ugm={graph()} spec={DEFAULT_SPEC} />,
    root: () => screen.getByTestId("g3t-floating-legend"),
    host: false,
  },
  {
    name: "MapView",
    render: (c) => <MapView ugm={graph()} className={c} />,
    root: () => screen.getByTestId("map-view"),
  },
  {
    name: "MatrixView",
    render: (c) => <MatrixView ugm={graph()} className={c} />,
    root: () => screen.getByTestId("matrix-view"),
  },
  {
    name: "FloatingPanel",
    render: (c) => (
      <FloatingPanel header="H" testId="floating-panel" className={c}>
        body
      </FloatingPanel>
    ),
    root: () => screen.getByTestId("floating-panel"),
  },
  {
    name: "NeighborhoodPopout",
    render: (c) => (
      <NeighborhoodPopout
        ugm={graph()}
        focusId="a"
        onClose={vi.fn()}
        className={c}
      />
    ),
    root: () => screen.getByTestId("g3t-neighborhood-popout"),
  },
  {
    name: "ProvenanceTrace",
    render: (c) => (
      <ProvenanceTrace
        chain={[{ id: "r", tier: "raw", label: "Root", depth: 0 }]}
        className={c}
      />
    ),
    root: () => screen.getByTestId("g3t-provenance-trace"),
  },
  {
    name: "QueryEditor",
    render: (c) => <QueryEditor className={c} />,
    root: () => screen.getByTestId("query-editor"),
  },
  {
    name: "SankeyView",
    render: (c) => <SankeyView ugm={graph()} className={c} />,
    root: () => screen.getByTestId("sankey-view"),
  },
  {
    name: "DiffRenderer",
    render: (c) => (
      <DiffRenderer
        diff={{
          addedNodes: [{ id: "n", status: "added" }],
          removedNodes: [],
          changedNodes: [],
          addedEdges: [],
          removedEdges: [],
          changedEdges: [],
        }}
        className={c}
      />
    ),
    root: () => screen.getByTestId("diff-renderer"),
  },
  {
    name: "SchemaView",
    render: (c) => <SchemaView ugm={graph()} className={c} />,
    root: () => screen.getByTestId("schema-view"),
  },
  {
    name: "ShaclShapeBrowser",
    render: (c) => (
      <ShaclShapeBrowser shapes={[]} validationResults={[]} className={c} />
    ),
    root: () => screen.getByTestId("shacl-shape-browser"),
  },
  {
    name: "StatsPanel",
    render: (c) => (
      <StatsPanel ugm={graph()} propertyKey="score" className={c} />
    ),
    root: () => screen.getByTestId("stats-panel"),
  },
  {
    name: "StructuralSvgView",
    render: () => (
      <StructuralSvgView
        input={STRUCT_INPUT}
        geometry={STRUCT_GEOMETRY}
        width={200}
        height={100}
        data-testid="ssv"
      />
    ),
    root: () => screen.getByTestId("ssv"),
    host: false,
  },
  {
    name: "SvgAdapter",
    render: () => (
      <SvgAdapter
        nodes={SCENE_NODES}
        edges={[]}
        resolved={SCENE_RESOLVED}
        width={100}
        height={100}
        data-testid="svg-adapter"
      />
    ),
    root: () => screen.getByTestId("svg-adapter"),
    host: false,
  },
  {
    name: "TableView",
    render: (c) => <TableView ugm={graph()} className={c} />,
    root: () => screen.getByTestId("table-view"),
  },
  {
    name: "TableView (fill keeps g3t-table-fill ahead of the view class)",
    render: (c) => <TableView ugm={graph()} fill className={c} />,
    root: () => screen.getByTestId("table-view"),
  },
  {
    name: "TimelineView",
    render: (c) => <TimelineView ugm={graph()} className={c} />,
    root: () => screen.getByTestId("timeline-view"),
  },
  {
    name: "TreeView",
    render: (c) => <TreeView ugm={graph()} rootId="b" className={c} />,
    root: () => screen.getByTestId("tree-view"),
  },
];

const tokens = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

describe("viewClass", () => {
  it("appends g3t-view after the given classes and drops empties", () => {
    expect(viewClass()).toBe(VIEW_CLASS);
    expect(viewClass(undefined, "", false, null)).toBe(VIEW_CLASS);
    expect(viewClass("g3t-table", false, "host")).toBe(
      "g3t-table host g3t-view",
    );
    expect(viewClass("host", "g3t-view")).toBe("host g3t-view");
  });
});

describe("every view root carries g3t-view (issue #45)", () => {
  for (const c of cases) {
    it(`${c.name}: root carries ${VIEW_CLASS}`, () => {
      render(c.render());
      expect(tokens(c.root())).toContain(VIEW_CLASS);
    });
    if (c.host !== false) {
      it(`${c.name}: a host className stays first`, () => {
        render(c.render("host-root"));
        const t = tokens(c.root());
        expect(t.indexOf("host-root")).toBeGreaterThanOrEqual(0);
        expect(t.indexOf("host-root")).toBeLessThan(t.indexOf(VIEW_CLASS));
        // The component's own root class (g3t-table, g3t-minimap, the
        // fill opt-in) is ahead of the host class, as before #45.
        for (const own of t.filter(
          (x) => x.startsWith("g3t-") && x !== VIEW_CLASS,
        )) {
          expect(t.indexOf(own)).toBeLessThan(t.indexOf("host-root"));
        }
      });
    }
  }
});
