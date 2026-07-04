# g3-toolkit (v1.0.0-rc.2)

Composable graph visualization components for RDF, LPG, and Holonic architectures.

g3t is a **component library**, not an application framework. You install it, import the components you need, and compose them into your own application with your own layout, state management, and backend.

## See it running

- [Playground](https://zwelz3.github.io/g3-toolkit/playground/): four
  domain shells (provenance auditing, an MBSE workbench, a supply-chain
  digital thread, a biomedical knowledge graph) plus the two capability
  dashboards, live in the browser.
- [Storybook](https://zwelz3.github.io/g3-toolkit/storybook/): every
  component and control in isolation.
- [API reference](https://zwelz3.github.io/g3-toolkit/api/): typedoc,
  including the rendered [wiring guide](https://github.com/zwelz3/g3-toolkit/blob/main/docs/wiring-guide.md).
- [Docs landing](https://zwelz3.github.io/g3-toolkit/): all of the
  above from one page.

## Packages

| Package       | What it is                                                        | Peer dependencies           |
| ------------- | ----------------------------------------------------------------- | --------------------------- |
| `@g3t/core`   | Data model, adapters, projection pipeline, algorithms, theming    | graphology                  |
| `@g3t/react`  | 12 view components + 15 controls (canvas, table, map, tree, etc.) | react, @g3t/core, cytoscape |
| `@g3t/charts` | Linked statistical charts (bar, scatter, line, pie)               | react, @g3t/core, echarts   |

## Minimal Integration (15 lines)

```tsx
import { useEffect, useState } from "react";
import { UGM, SparqlAdapter } from "@g3t/core";
import { CytoscapeCanvas, TableView } from "@g3t/react";

function MyGraphPage() {
  const [ugm, setUgm] = useState<UGM | null>(null);

  useEffect(() => {
    new SparqlAdapter("/sparql")
      .query("SELECT * WHERE { ?s ?p ?o } LIMIT 200")
      .then(setUgm);
  }, []);

  if (!ugm) return <div>Loading...</div>;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        height: "100vh",
      }}
    >
      <CytoscapeCanvas ugm={ugm} />
      <TableView ugm={ugm} pageSize={20} />
    </div>
  );
}
```

You decide the layout. You decide when to query. The toolkit components are leaf nodes in your component tree.

This snippet is CI-verified twice over: every fenced code block in this
README typechecks against the built packages (`verify:snippets`), and
this one also RUNS as a test with a stubbed SPARQL endpoint
(`examples/wiring/src/readme-quickstart.test.tsx`), so it cannot rot
silently.

## What This Is NOT

g3t does **not** provide a complete application shell, workflow engine, or session manager. Those patterns are demonstrated in `examples/full-workspace/` for teams who want them, but they are not part of the published packages. See [ARCHITECTURE.md](ARCHITECTURE.md) for the boundary rationale.

## Components

### Views (@g3t/react)

| Component           | Description                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `CytoscapeCanvas`   | Graph layout (7 engines) with animated transitions, edge styles (bezier/straight/taxi), selection, context menu, lasso |
| `TableView`         | Sortable, paginated data table with multi-select (ctrl+click, shift+click)                                             |
| `DetailInspector`   | Property panel for selected node/edge                                                                                  |
| `TimelineView`      | Temporal visualization (vis-timeline)                                                                                  |
| `MapView`           | Geographic markers with edges between geo-positioned nodes                                                             |
| `TreeView`          | Expandable containment hierarchy with breadcrumb                                                                       |
| `SchemaView`        | Ontology class hierarchy with SHACL constraint badges                                                                  |
| `ShaclShapeBrowser` | SHACL shape list with validation badges and per-node results                                                           |
| `DiffRenderer`      | Color-coded graph diff (added/removed/changed)                                                                         |
| `MatrixView`        | Adjacency heatmap by node type                                                                                         |
| `SankeyView`        | Flow/chord visualization between types                                                                                 |
| `QueryEditor`       | SPARQL/Cypher/GQL input with execute                                                                                   |

### Controls (@g3t/react)

| Component               | Description                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `LayoutManager`         | Layout selection (7 engines), force parameter tuning, direction/spacing for hierarchical, reset, freeze/unfreeze |
| `EncodingPanel`         | Map properties to node size, color, edge width, labels                                                           |
| `CanvasLegend`          | Auto-generated type-color, size scale, edge style legend                                                         |
| `FacetFilter`           | Checkbox filter by node type with select all/none                                                                |
| `FilterBuilder`         | Property-level filter with AND/OR, 8 operators                                                                   |
| `SearchBar`             | Fuzzy search across node properties (Fuse.js)                                                                    |
| `PropertyEditor`        | Inline property editing with backend validation callback                                                         |
| `AnnotationPanel`       | Notes on nodes/edges with pluggable storage (localStorage default)                                               |
| `TemporalSlider`        | Time range slider with play/pause/speed controls                                                                 |
| `ZoomControls`          | +/−/fit button group                                                                                             |
| `Toolbar`               | Select/pan mode, layout trigger, panel toggles, theme selector                                                   |
| `StatusBar`             | Node/edge/selection counts, zoom level                                                                           |
| `HoverTooltip`          | Positioned tooltip on node mouseover                                                                             |
| `KeyboardShortcutModal` | Shortcut reference ("?" key)                                                                                     |
| `AriaCompanion`         | Hidden focusable node list for screen readers                                                                    |

### Data Layer (@g3t/core)

| Module                  | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `UGM`                   | Universal Graph Model (Graphology MultiGraph wrapper)                        |
| `SparqlAdapter`         | SPARQL 1.1 HTTP adapter                                                      |
| `CypherAdapter`         | Neo4j/Memgraph HTTP transaction adapter                                      |
| `RestAdapter`           | Generic REST/GraphQL with response mapping                                   |
| `ProjectionPipeline`    | RDF → LPG collapse transforms (type, literal, blank node, list, reification) |
| `DataPipeline`          | Query-to-chart bridge with bidirectional selection                           |
| `VisualEncodingManager` | Property-to-visual-channel mapping                                           |
| `PropertyFilter`        | Numeric range, text match, AND/OR filter groups                              |
| `NodeStyleOverride`     | Per-node/per-type visual customization                                       |
| `UndoRedoStack`         | Snapshot-based undo/redo with configurable depth                             |
| `ComboManager`          | User-driven node grouping with collapse/expand/nest                          |
| `ShaclValidator`        | Validate UGM nodes against SHACL shapes                                      |
| `IncrementalLayout`     | Lock existing nodes on small graph changes; minimal-movement updates         |
| `DerivedPropertyEngine` | Computed properties from expressions (expr-eval)                             |
| `diffGraphs`            | Structural diff between two UGM instances                                    |

### Wiring your own controls

All toolkit behavior is drivable from your components through
exported stores and functions; for example a pin-all button:

```tsx
import { usePositionPinStore } from "@g3t/react";

<button onClick={() => usePositionPinStore.getState().setAllPinned(true)}>
  Pin all positions
</button>;
```

The full recipe set (selection focus, layout/shuffle, theme,
encoding-spec switching, algorithm results from your backend, custom
context-menu actions, and toolkit state driving YOUR
decision-support components) lives in
[`docs/wiring-guide.md`](docs/wiring-guide.md); every snippet runs in
CI at `examples/wiring/`.

## Examples & demos

Not sure which one shows your need? The
[capability index](docs/capability-index.md) maps each adopter need to a
demo, a wiring recipe, and a component story.

- **Playground** (`pnpm run dev`, or [live](https://zwelz3.github.io/g3-toolkit/playground/)):
  four scenario shells (Auditor, MBSE, Supply Chain, Biomedical)
  showing the toolkit in domain stories, plus the two capability
  dashboards under "Capability surfaces" on the same landing page.
  Every shell carries a "Built on the toolkit" panel whose mechanisms
  deep-link into the wiring guide.
- **Capability dashboards** (`examples/decision-dashboards`): the
  Analytics and Schema dashboards as plain importable components
  (stats/charts/algorithms/coverage; schema/matrix/sankey/RDF export).
  Reachable from the playground landing; consumable directly from
  their package (`vitest run` covers them headlessly).
- **Application-shell example** (`examples/full-workspace`): the
  multi-pane workspace pattern (flexlayout) that the published
  packages deliberately do NOT include; source reference plus tests
  (`pnpm --filter @g3t/example-full-workspace test`), not a hosted app.
- **Executable wiring snippets** (`examples/wiring`): the CI-run twins
  of every wiring-guide recipe and of the README quickstart above.

The former cinematic flagship demo was retired 2026-07-03: the four
scenario shells replaced it, and every public API it alone
demonstrated was folded into the shells, the dashboards, or the
wiring guide first (`planning/flagship-retirement.md` is the audit).

## Data-paradigm support (honest scope)

The adapters (`SparqlAdapter`, `CypherAdapter`, `GremlinAdapter`,
`RestAdapter`) are real HTTP clients with result parsers, but each
handles a common response shape rather than the full breadth of its
protocol; `SparqlAdapter` parses SELECT bindings (not arbitrary RDF
graphs), and there is no SHACL **shapes parser**, no reasoning, and no
canvas-level virtualization yet. For the full shipped-vs-gap map across
RDF / LPG / virtualization, see
[capabilities and limits](docs/capabilities-and-limits.md) (the deeper
internal accounting is in
[`planning/rdf-lpg-virtualization-audit.md`](planning/rdf-lpg-virtualization-audit.md)).

## Theming

CSS custom properties (`--g3t-*`) for colors, typography, spacing, shadows. Three built-in presets (light, dark, high-contrast). Components adapt automatically when the theme changes.

```typescript
import { useThemeStore } from "@g3t/react/state";
useThemeStore.getState().setTheme("dark");
```

## Development

This project uses [pnpm](https://pnpm.io).

```bash
corepack enable               # enables pnpm via Node.js corepack
pnpm install
pnpm dev                      # Interactive demo at localhost:5173
pnpm storybook                # Component explorer at localhost:6006
pnpm test                     # Vitest unit + component tests (run for current count)
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
  full-workspace/   ← Multi-pane workspace shell with flexlayout-react
                      and role-based layouts
  decision-dashboards/ ← Two capability dashboards (Analytics, Schema)
  wiring/           ← Executable twins of the wiring-guide snippets (CI)
src/                ← Interactive demo + test harness for `pnpm dev`
                      (four scenario shells; the dev demo, not a
                      published artifact)
docs/               ← Adopter guides
specs/              ← specl-format requirements
roadmap/            ← Spec-gap work plan by area and capability
                      (see roadmap/CLAUDE.md; coverage enforced in CI)
planning/           ← Milestones, audits, evaluations; retired-effort
                      records live in planning/archive/
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the toolkit/application boundary.

## License

Apache 2.0
See [LICENSE](LICENSE) for details.
