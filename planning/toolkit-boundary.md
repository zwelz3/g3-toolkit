# Architectural Boundary: Toolkit vs. Application

## The Principle

g3-toolkit is a **component library**, not an application framework.

Teams `npm install` the toolkit and compose its pieces into THEIR
application. The toolkit doesn't dictate layout, state management
patterns, routing, or workflow orchestration. It provides the
building blocks; the team provides the architecture.

Analogy: g3t is Radix UI (composable primitives), not Retool
(complete platform). It's Cytoscape.js (rendering library), not
Neo4j Browser (full application).

## The Boundary

```
┌─────────────────────────────────────────────────┐
│  APPLICATION LAYER (not shipped as npm package)  │
│                                                  │
│  WorkspaceShell, workflow engine, session         │
│  persistence, demo scenarios, landing page,      │
│  createG3Toolkit() factory, full-app layouts     │
│                                                  │
│  Lives in: examples/, demo/, docs/               │
│  Purpose: demonstrate, not distribute             │
├─────────────────────────────────────────────────┤
│  TOOLKIT LAYER (shipped as npm packages)         │
│                                                  │
│  @g3t/core        @g3t/react       @g3t/charts   │
│  UGM              CytoscapeCanvas  LinkedChart    │
│  Adapters         TableView        BarChart       │
│  Projection       MapView          ScatterChart   │
│  Algorithms       TreeView         LineChart      │
│  DataPipeline     SchemaView       PieChart       │
│  Encoding model   DiffRenderer     ParallelCoords │
│  Theme tokens     Inspector        (peer: echarts)│
│  Filter model     EncodingPanel                   │
│  StyleOverride    Legend                           │
│  (peer: none)     FilterBuilder                   │
│                   ZoomControls                    │
│                   Toolbar                         │
│                   StatusBar                       │
│                   AriaCompanion                   │
│                   QueryEditor                     │
│                   (peer: react)                   │
│                                                  │
│  Lives in: packages/core, packages/react,        │
│            packages/charts                        │
│  Purpose: install and compose                     │
└─────────────────────────────────────────────────┘
```

## What This Means Concretely

### An adopter's code looks like this:

```tsx
// THEIR application, THEIR layout, THEIR state management
import { UGM } from "@g3t/core";
import { SparqlAdapter } from "@g3t/core/adapters";
import { CytoscapeCanvas, TableView, DetailInspector } from "@g3t/react";
import { useSelectionStore } from "@g3t/react/state";

function MyGraphPage() {
  const [ugm, setUgm] = useState<UGM | null>(null);
  const selectedId = useSelectionStore(s => [...s.selectedNodeIds][0]);

  useEffect(() => {
    const adapter = new SparqlAdapter({ endpoint: "/sparql" });
    adapter.query("SELECT * WHERE { ?s ?p ?o } LIMIT 500")
      .then(setUgm);
  }, []);

  if (!ugm) return <div>Loading...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px" }}>
      <CytoscapeCanvas ugm={ugm} />
      <div>
        <DetailInspector ugm={ugm} selection={selectedId ? { type: "node", id: selectedId } : null} />
        <TableView ugm={ugm} pageSize={20} />
      </div>
    </div>
  );
}
```

They decide the layout. They decide when to query. They decide
what goes where. The toolkit components are leaf nodes in their
component tree, not a wrapper around their app.

### NOT this:

```tsx
// This is an APPLICATION FRAMEWORK pattern; we should NOT ship this
import { G3Workspace } from "@g3t/react";

function MyPage() {
  return (
    <G3Workspace
      adapter={new SparqlAdapter({ endpoint: "/sparql" })}
      theme="dark"
      views={["canvas", "table", "inspector"]}
      layout="analyst"
    />
  );
}
```

This pattern is useful for demos and quick starts, but it takes
away the adopter's control over layout, state, and composition.
It belongs in `examples/`, not in the published package.

## Package Structure

```
g3-toolkit/
├── packages/
│   ├── core/                    ← @g3t/core (npm)
│   │   ├── src/
│   │   │   ├── ugm/             ← UGM data model
│   │   │   ├── adapters/        ← SPARQL, Cypher, REST, Gremlin
│   │   │   ├── projection/      ← RDF→LPG pipeline
│   │   │   ├── pipeline/        ← DataPipeline interface + built-ins
│   │   │   ├── algorithms/      ← graphology-* wrappers
│   │   │   ├── encoding/        ← VisualEncodingManager (model only)
│   │   │   ├── filter/          ← PropertyFilter, ViewFilter (models)
│   │   │   ├── style-override/  ← NodeStyleOverride (model only)
│   │   │   ├── diff/            ← diffGraphs, computeSchemaHash
│   │   │   └── theme/           ← G3tTheme type, design tokens, CSS vars
│   │   ├── package.json         ← zero peer deps (just graphology)
│   │   └── tsconfig.json
│   │
│   ├── react/                   ← @g3t/react (npm)
│   │   ├── src/
│   │   │   ├── canvas/          ← CytoscapeCanvas
│   │   │   ├── table/           ← TableView
│   │   │   ├── inspector/       ← DetailInspector
│   │   │   ├── map/             ← MapView
│   │   │   ├── tree/            ← TreeView
│   │   │   ├── schema/          ← SchemaView, DiffRenderer
│   │   │   ├── matrix/          ← MatrixView
│   │   │   ├── sankey/          ← SankeyView
│   │   │   ├── timeline/        ← TimelineView
│   │   │   ├── query/           ← QueryEditor
│   │   │   ├── controls/        ← EncodingPanel, Legend, FilterBuilder,
│   │   │   │                      ZoomControls, Toolbar, StatusBar,
│   │   │   │                      KeyboardShortcutModal, NodeStyleEditor
│   │   │   ├── a11y/            ← AriaCompanion
│   │   │   ├── state/           ← useSelectionStore, useThemeStore
│   │   │   └── hooks/           ← useLinkedPipeline, useViewFilter
│   │   ├── package.json         ← peer: react, @g3t/core, cytoscape
│   │   └── tsconfig.json
│   │
│   └── charts/                  ← @g3t/charts (npm, optional)
│       ├── src/
│       │   ├── LinkedChart.tsx
│       │   ├── renderers/       ← Bar, Scatter, Line, Pie, Parallel
│       │   └── pipelines/       ← re-exports from @g3t/core for convenience
│       ├── package.json         ← peer: react, @g3t/core, echarts
│       └── tsconfig.json
│
├── examples/                    ← NOT published; reference implementations
│   ├── react-neo4j/             ← Minimal React + Neo4j (50 lines)
│   ├── react-rest-api/          ← React + generic REST API
│   ├── react-sparql/            ← React + SPARQL endpoint
│   ├── react-file-import/       ← React + drag-and-drop file loading
│   └── full-workspace/          ← Full app with WorkspaceShell, workflows, etc.
│
├── demo/                        ← NOT published; the dev server showcase
│   ├── Demo.tsx
│   ├── DemoLanding.tsx
│   ├── DemoApp.tsx
│   └── fixtures/
│
└── docs/                        ← Guides, not API reference (TypeDoc handles that)
    ├── getting-started.md       ← "npm install @g3t/react" → render a graph
    ├── core-concepts.md         ← UGM, adapters, projection, encoding
    ├── component-catalog.md     ← Every component with props table
    ├── theming.md               ← CSS variables, dark mode, custom themes
    ├── adapters.md              ← SPARQL, Cypher, REST, Gremlin, file import
    └── extending.md             ← Custom adapters, layouts, menu items
```

## What Moves Out of the Toolkit

These items from the enhancement plan (M11-M13) are application-
level concerns that belong in `examples/full-workspace/`, not in
the published packages:

| Item | Current Location | Correct Location |
|------|-----------------|-----------------|
| WorkspaceShell (FlexLayout) | packages/react | examples/full-workspace |
| WorkflowRunner | planned for @g3t/core | examples/full-workspace |
| WorkflowPanel UI | planned for @g3t/react | examples/full-workspace |
| Session persistence | planned for @g3t/core | examples/full-workspace |
| Demo workflows (4) | planned for @g3t/react | demo/ |
| createG3Toolkit() factory | planned for @g3t/core | examples/full-workspace |
| Event bus | planned for @g3t/core | **keep** (small, useful utility) |

The event bus stays because it's a 30-line utility that helps
adopters observe toolkit state changes without depending on
Zustand. It's a convenience, not an application pattern.

## What Stays in the Toolkit

Everything that's a **composable primitive** an adopter would
plug into their own layout:

**@g3t/core (zero React):**
- UGM (the data model)
- Adapters (SPARQL, Cypher, REST, Gremlin, file import)
- Projection pipeline (RDF → LPG)
- DataPipeline interface + built-in pipeline functions
- Algorithm wrappers (graphology-metrics, communities, path)
- PropertyFilter + ViewFilter models
- NodeStyleOverride model
- VisualEncoding model
- Theme types + design tokens + CSS variable injection
- Diff engine
- Undo/redo stack

**@g3t/react (React components):**
- 12 view components (canvas, table, map, tree, etc.)
- Control components (encoding panel, legend, filter builder, etc.)
- Accessibility (AriaCompanion)
- State hooks (useSelectionStore, useThemeStore, useViewFilter)
- NodeStyleEditor (the per-node customization panel)

**@g3t/charts (optional, ECharts-based):**
- LinkedChart wrapper
- 6 chart renderers (bar, scatter, line, pie, donut, parallel)

## Revised Milestone Impact

M10.5 (Integration Core) focuses ONLY on package distribution
and adapter infrastructure. No application-level factories.

M11-M13 tickets are reviewed against the boundary:
- Pipeline functions → @g3t/core (keep)
- LinkedChart + renderers → @g3t/charts (keep)
- PropertyFilter + FilterBuilder → core model + react component (keep)
- NodeStyleOverride + editor → core model + react component (keep)
- WorkflowRunner → examples/full-workspace (move)
- Session persistence → examples/full-workspace (move)
- Derived properties → @g3t/core (keep; it's a computation primitive)
- Subgraph pinning → @g3t/core ViewFilter extension (keep)

Net effect: M13 shrinks from 10 to 5 tickets (workflow engine
and session persistence move to examples). The toolkit packages
stay focused on composable primitives.
