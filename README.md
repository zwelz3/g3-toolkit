# g3-toolkit (v1.0.0-rc)

Composable graph visualization components for RDF, LPG, and Holonic architectures.

g3t is a **component library**, not an application framework. You install it, import the components you need, and compose them into your own application with your own layout, state management, and backend.

## Packages

| Package | What it is | Peer dependencies |
|---------|-----------|-------------------|
| `@g3t/core` | Data model, adapters, projection pipeline, algorithms, theming | graphology |
| `@g3t/react` | 12 view components + 15 controls (canvas, table, map, tree, etc.) | react, @g3t/core, cytoscape |
| `@g3t/charts` | Linked statistical charts (bar, scatter, line, pie) | react, @g3t/core, echarts |

## Minimal Integration (15 lines)

```tsx
import { UGM, SparqlAdapter } from "@g3t/core";
import { CytoscapeCanvas, TableView } from "@g3t/react";
import { useSelectionStore } from "@g3t/react/state";

function MyGraphPage() {
  const [ugm, setUgm] = useState<UGM | null>(null);

  useEffect(() => {
    new SparqlAdapter({ endpoint: "/sparql" })
      .query("SELECT * WHERE { ?s ?p ?o } LIMIT 200")
      .then(setUgm);
  }, []);

  if (!ugm) return <div>Loading...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", height: "100vh" }}>
      <CytoscapeCanvas ugm={ugm} />
      <TableView ugm={ugm} pageSize={20} />
    </div>
  );
}
```

You decide the layout. You decide when to query. The toolkit components are leaf nodes in your component tree.

## What This Is NOT

g3t does **not** provide a complete application shell, workflow engine, or session manager. Those patterns are demonstrated in `examples/full-workspace/` for teams who want them, but they are not part of the published packages. See [ARCHITECTURE.md](ARCHITECTURE.md) for the boundary rationale.

## Components

### Views (@g3t/react)

| Component | Description |
|-----------|-------------|
| `CytoscapeCanvas` | Graph layout (7 engines) with animated transitions, edge styles (bezier/straight/taxi), selection, context menu, lasso |
| `TableView` | Sortable, paginated data table with multi-select (ctrl+click, shift+click) |
| `DetailInspector` | Property panel for selected node/edge |
| `TimelineView` | Temporal visualization (vis-timeline) |
| `MapView` | Geographic markers with edges between geo-positioned nodes |
| `TreeView` | Expandable containment hierarchy with breadcrumb |
| `SchemaView` | Ontology class hierarchy with SHACL constraint badges |
| `ShaclShapeBrowser` | SHACL shape list with validation badges and per-node results |
| `DiffRenderer` | Color-coded graph diff (added/removed/changed) |
| `MatrixView` | Adjacency heatmap by node type |
| `SankeyView` | Flow/chord visualization between types |
| `QueryEditor` | SPARQL/Cypher/GQL input with execute |

### Controls (@g3t/react)

| Component | Description |
|-----------|-------------|
| `LayoutManager` | Layout selection (7 engines), force parameter tuning, direction/spacing for hierarchical, reset, freeze/unfreeze |
| `EncodingPanel` | Map properties to node size, color, edge width, labels |
| `CanvasLegend` | Auto-generated type-color, size scale, edge style legend |
| `FacetFilter` | Checkbox filter by node type with select all/none |
| `FilterBuilder` | Property-level filter with AND/OR, 8 operators |
| `SearchBar` | Fuzzy search across node properties (Fuse.js) |
| `PropertyEditor` | Inline property editing with backend validation callback |
| `AnnotationPanel` | Notes on nodes/edges with pluggable storage (localStorage default) |
| `TemporalSlider` | Time range slider with play/pause/speed controls |
| `ZoomControls` | +/−/fit button group |
| `Toolbar` | Select/pan mode, layout trigger, panel toggles, theme selector |
| `StatusBar` | Node/edge/selection counts, zoom level |
| `HoverTooltip` | Positioned tooltip on node mouseover |
| `KeyboardShortcutModal` | Shortcut reference ("?" key) |
| `AriaCompanion` | Hidden focusable node list for screen readers |

### Data Layer (@g3t/core)

| Module | Description |
|--------|-------------|
| `UGM` | Universal Graph Model (Graphology MultiGraph wrapper) |
| `SparqlAdapter` | SPARQL 1.1 HTTP adapter |
| `CypherAdapter` | Neo4j/Memgraph HTTP transaction adapter |
| `RestAdapter` | Generic REST/GraphQL with response mapping |
| `ProjectionPipeline` | RDF → LPG collapse transforms (type, literal, blank node, list, reification) |
| `DataPipeline` | Query-to-chart bridge with bidirectional selection |
| `VisualEncodingManager` | Property-to-visual-channel mapping |
| `PropertyFilter` | Numeric range, text match, AND/OR filter groups |
| `NodeStyleOverride` | Per-node/per-type visual customization |
| `UndoRedoStack` | Snapshot-based undo/redo with configurable depth |
| `ComboManager` | User-driven node grouping with collapse/expand/nest |
| `ShaclValidator` | Validate UGM nodes against SHACL shapes |
| `IncrementalLayout` | Lock existing nodes on small graph changes; minimal-movement updates |
| `DerivedPropertyEngine` | Computed properties from expressions (expr-eval) |
| `diffGraphs` | Structural diff between two UGM instances |

### Theming

CSS custom properties (`--g3t-*`) for colors, typography, spacing, shadows. Three built-in presets (light, dark, high-contrast). Components adapt automatically when the theme changes.

```typescript
import { useThemeStore } from "@g3t/react/state";
useThemeStore.getState().setTheme("dark");
```

## Development

This project uses [pnpm](https://pnpm.io) (not npm or yarn).

```bash
corepack enable               # enables pnpm via Node.js corepack
pnpm install
pnpm dev                      # Interactive demo at localhost:5173
pnpm storybook                # Component explorer at localhost:6006
pnpm test                     # 556 unit + component tests
pnpm typecheck
pnpm lint
```

## Project Structure

```
packages/           ← Published npm packages
  core/             ← @g3t/core (framework-agnostic)
  react/            ← @g3t/react (React components)
  charts/           ← @g3t/charts (linked ECharts)
examples/           ← Reference integrations (NOT published)
  react-neo4j/      ← Minimal React + Neo4j
  react-rest-api/   ← React + generic REST backend
  full-workspace/   ← Full app with layout, workflows, sessions
demo/               ← Dev server showcase (NOT published)
docs/               ← Adopter guides
specs/              ← specl-format requirements (72 requirements)
planning/           ← Roadmap, audits, evaluations
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the toolkit/application boundary.

## License

Apache 2.0
See [LICENSE](LICENSE) for details.
