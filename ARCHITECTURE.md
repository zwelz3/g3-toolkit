# Architecture

> **When to read this:** Before adding any feature, creating any
> component, or reviewing any PR. This document defines what
> goes in the toolkit vs what stays in examples.

## Design Principle: Toolkit, Not Framework

g3-toolkit provides composable primitives for graph visualization.
It does not provide a complete application, a layout manager, a
workflow engine, or a session store. Teams compose g3t components
into their own applications alongside their own state management,
routing, and backend integration.

The distinction matters for adoption: a toolkit is something you
add to your project; a framework is something your project lives
inside. g3t is the former.

## Package Boundary

```
┌───────────────────────────────────────────────────────────────┐
│  YOUR APPLICATION                                             │
│                                                               │
│  Your layout, your routing, your auth, your state management  │
│                                                               │
│  ┌────────────────┐ ┌──────────────┐ ┌──────────────────┐     │
│  │  @g3t/react    │ │  @g3t/charts │ │  @g3t/core       │     │
│  │                │ │              │ │                   │     │
│  │  Canvas, Table │ │  LinkedChart │ │  UGM, Adapters,  │     │
│  │  Map, Tree,    │ │  Bar, Scatter│ │  Projection,     │     │
│  │  Inspector,    │ │  Line, Pie   │ │  Algorithms,     │     │
│  │  Controls      │ │              │ │  Filters, Themes │     │
│  └───────┬────────┘ └──────┬───────┘ └────────┬──────────┘    │
│          │                 │                   │               │
│          └─── peer dep ────┴─── peer dep ──────┘               │
└───────────────────────────────────────────────────────────────┘
```

### @g3t/core

Framework-agnostic TypeScript. Zero React dependency. This package
is usable from Vue, Angular, Svelte, or vanilla JS.

Contains: UGM data model, graph adapters (SPARQL, Cypher, REST,
Gremlin), RDF projection pipeline, DataPipeline interface,
algorithm wrappers (graphology-metrics), filter models, encoding
models, style override models, theme types, diff engine, undo/redo.

Dependencies (regular, installed transitively): `graphology`,
`@dagrejs/dagre`, `d3-force`, `d3-hierarchy`, `elkjs`, `expr-eval`,
`simple-statistics`. No peer dependencies.

### @g3t/react

React components that consume UGM. Each component is independently
importable; using `CytoscapeCanvas` does not pull in `TimelineView`.

Contains: 12 view components, 15 control components, accessibility
companion, state hooks (selection, theme, view filter).

Regular dependencies: `@g3t/core`, `@tanstack/react-table`, `fuse.js`.
Peer dependencies (consumer must install): `react`, `react-dom`,
`cytoscape`, `cytoscape-fcose`, `zustand`, `echarts`. Optional peers
(declared in `peerDependenciesMeta`, so a package manager does not
install them): `vis-timeline`, `vis-data`. The peer set is broad
because each view brings its own runtime; consumers tree-shake by
importing only the views they use.

Optional peers constrain the module graph, not just the bundle.
Module resolution runs BEFORE tree-shaking, so a barrel that
re-exports a component whose optional peers are absent is
unresolvable even for a consumer who never names that component.
`TimelineView` therefore ships on its own subpath,
`@g3t/react/timeline`, and is deliberately absent from the root and
`./views` barrels. `scripts/check-optional-peers.mjs` walks the
emitted import graph out of every declared subpath and fails the
build if an optional peer becomes statically reachable from any
entry not on its allowlist.
`@tanstack/react-table` is a regular dep (not peer) because it is
directly imported by `TableView` and would otherwise resolve to an
empty virtual module under Vite when consumers don't explicitly
install it.

### @g3t/charts (optional)

Linked statistical charts that synchronize selection with the
graph canvas and table. Install only if you need non-graph
visualizations.

Contains: LinkedChart wrapper, 6 chart renderers (bar, scatter
with trend, line/area, pie/donut, parallel coordinates, sankey).

Regular dependencies: `@g3t/core`, `@g3t/react`, `echarts-for-react`.
Peer dependencies: `react`, `echarts`. `echarts-for-react` is a
regular dep (not peer) because it is directly imported by
`LinkedChart` (same Vite-resolution rationale as `@tanstack/react-table`
in `@g3t/react`).

## What Is NOT in the Packages

The following patterns are useful but application-specific. They
are provided as reference implementations in `examples/`, not as
published API surface:

| Pattern                                     | Why it's application-level                 | Where to find it           |
| ------------------------------------------- | ------------------------------------------ | -------------------------- |
| Full workspace layout (FlexLayout)          | Adopters have their own page layout        | `examples/full-workspace/` |
| Workflow engine (step sequences)            | Adopters have their own analysis pipelines | `examples/full-workspace/` |
| Session persistence (save/load)             | Adopters have their own storage layer      | `examples/full-workspace/` |
| Configuration factory (`createG3Toolkit()`) | Removes composability; too opinionated     | `examples/full-workspace/` |
| Demo landing page / scenarios               | Marketing; not functionality               | `demo/`                    |

**The test:** if an adopter would need to configure, disable, or
replace it, it's application-level and belongs in examples.
If they would use it as-is (pass a UGM, get a view), it's toolkit-
level and belongs in the package.

## Data Flow

```
                    ┌──────────────────────────────────┐
                    │         Your Application          │
                    │                                   │
 Data Source ──→ Adapter ──→ UGM ──┬──→ CytoscapeCanvas │
 (SPARQL,         (@g3t/core)      │                    │
  Cypher,                          ├──→ TableView       │
  REST,                            ├──→ MapView         │
  file)                            ├──→ TreeView        │
                                   ├──→ LinkedChart     │
                                   │    (DataPipeline)  │
                                   └──→ Inspector       │
                    │                                   │
                    │  Selection Store (Zustand)         │
                    │  ← shared across all views →      │
                    └──────────────────────────────────┘
```

1. You choose the data source and create an adapter
2. You call `adapter.query()` to populate a UGM
3. You pass the UGM to whichever components you want
4. Components share selection state via `useSelectionStore`
5. You handle everything else (layout, routing, auth, persistence)

### Why `@g3t/core/events` is not a fourth channel

Ruled 2026-08-15. The integration channels stay at three: exported
stores, props and callbacks, versioned JSON documents.

The events subpath reads like a fourth one and is not. It carries
`context:*` menu intents from `registerToolkitActions` to whatever
executes them, because the toolkit cannot execute "focus this node" or
"edit this appearance" without deciding a host's navigation, panel and
styling behavior. It publishes the intent; the host rules on it. That
is a command bus between two toolkit pieces, and a host may hook it,
but it is not where state observation lives.

State observation is the store channel. Subscribe to `useSelectionStore`
and its siblings for selection, theme, filter and layout changes; every
state type is exported so a selector can be typed.

Thirteen of the twenty-one declared event types were removed in the same
ruling, having never been emitted by anything: node:selected,
node:deselected, edge:selected, selection:cleared, node:hovered,
node:doubleClicked, node:rightClicked, filter:changed, theme:changed,
layout:changed, query:executed, encoding:changed, ugm:changed. The
module header claimed the stores emitted to the bus and no store ever
did, so a host subscribing to `node:selected` waited forever with no way
to distinguish that from an idle graph.

Pass a bus you constructed. The exported `eventBus` singleton is
deprecated: two copies of `@g3t/core` in a tree, or one path reaching it
through `import` while another reaches it through `require`, produce two
buses, and the menu goes dead with nothing in a stack trace to show why.
`registerToolkitActions` and `wireCytoscapeContextActions` both take the
bus as a parameter for that reason.

### How the versioned-JSON parsers fail

Versioned JSON documents are the third integration channel, and their
parsers do not all fail the same way. The shape of each one tracks what
the document can usefully say when it fails, and the rule is stated in
full in `@g3t/core`'s `model/document-errors.ts`:

- A document that can degrade element-wise returns partial results plus
  diagnostics (`parseGraphDocument`, `parseChangeSet`). Throwing would
  discard the good elements, which is the value.
- A hand-authored document returns `{ ok, errors }` with every problem
  at once (`parseStyleConfig`). A throw carries one error; a config file
  deserves all of them.
- Everything else throws (`parseEncodingSpec`, `parseWorkspace`,
  `parseAlgorithmResult`, `parseShaclReport`). There is no half an
  encoding spec.

What IS uniform is the error vocabulary. Every failure carries the same
`code`, names the same `documentKind`, and points at a `path`.
`DocumentParseError` is the base class for the throwing parsers, and
`parseGraphDocument`'s failure branch carries the same typed error as
`detail`, so one handler covers the channel without matching on
messages.

## Module Boundary: D6 vs D13

Every module follows one of two design decisions:

**D6 (Framework-Agnostic):** Pure TypeScript, no React imports,
no JSX. These modules work in any JavaScript environment.
Located in `@g3t/core`.

**D13 (React):** React components with hooks. These require a
React render tree. Located in `@g3t/react` and `@g3t/charts`.

When adding new functionality, the rule is: if it can be pure
TypeScript, it goes in core. The React layer is a thin consumer
of core interfaces.

## Extending the Toolkit

### Custom Adapter

```typescript
import { GraphAdapter, UGM } from "@g3t/core";

class MyDatabaseAdapter implements GraphAdapter {
  id = "my-db";
  name = "My Database";

  async query(queryString: string): Promise<UGM> {
    const response = await fetch("/api/query", {
      method: "POST",
      body: JSON.stringify({ query: queryString }),
    });
    const json = await response.json();
    const ugm = new UGM();
    // Map your response format to UGM nodes/edges
    for (const node of json.nodes) {
      ugm.addNode(node.id, { types: [node.label], properties: node.data });
    }
    for (const edge of json.edges) {
      ugm.addEdge(edge.source, edge.target, { type: edge.type });
    }
    return ugm;
  }
}
```

### Custom Layout Engine

```typescript
import { LayoutEngine, LayoutResult } from "@g3t/core";

class CircularLayout implements LayoutEngine {
  id = "circular";
  name = "Circular Layout";

  async compute(ugm: UGM): Promise<LayoutResult> {
    const positions: Record<string, { x: number; y: number }> = {};
    const ids = ugm.getNodeIds();
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length;
      positions[id] = { x: Math.cos(angle) * 300, y: Math.sin(angle) * 300 };
    });
    return { positions };
  }
}
```

### Custom Context Menu Item

```typescript
menuManager.register({
  id: "flag-review",
  label: "Flag for Review",
  applicableTo: ["node"],
  execute: (target) => {
    console.log("Flagged:", target.id);
  },
});
```

### Custom DataPipeline (for @g3t/charts)

```typescript
import { DataPipeline, CategoricalData } from "@g3t/core";

const riskByRole: DataPipeline<CategoricalData> = {
  id: "risk-by-role",
  name: "Average Risk by Role",
  query: (ugm) => {
    const groups = new Map<
      string,
      { sum: number; count: number; ids: string[] }
    >();
    ugm.forEachNode((id, attrs) => {
      const role = String(attrs.properties.role ?? "Unknown");
      const risk = Number(attrs.properties.risk ?? 0);
      const g = groups.get(role) ?? { sum: 0, count: 0, ids: [] };
      g.sum += risk;
      g.count++;
      g.ids.push(id);
      groups.set(role, g);
    });
    return {
      categories: [...groups.entries()].map(([label, g]) => ({
        label,
        count: g.sum / g.count,
        nodeIds: g.ids,
      })),
    };
  },
  reverseMap: (selection, data) => {
    const cat = data.categories.find((c) => c.label === selection.category);
    return cat?.nodeIds ?? [];
  },
};
```

## Theming

All components read from CSS custom properties (`--g3t-*`).
To theme g3t to match your application:

```typescript
import { useThemeStore } from "@g3t/react/state";

// Use a built-in preset
useThemeStore.getState().setTheme("dark");

// Or define your own
useThemeStore.getState().setCustomTheme({
  id: "my-brand",
  name: "My Brand",
  bgPrimary: "#1a1a2e",
  accentPrimary: "#e94560",
  // ... (see G3tTheme type for all fields)
});
```

Components that use inline styles reference `var(--g3t-*)`.
Components that use class names (`.g3t-btn`, `.g3t-panel`) inherit
from the global `g3t-base.css`. You can override any class in your
own stylesheet.

## FOSS Integration Patterns

g3t intentionally does not bundle advanced geospatial, streaming,
or entity resolution capabilities. Adopters can integrate these
FOSS libraries alongside g3t; coordination is through the UGM
and the event bus.

**Geospatial:** Leaflet (g3t's current map dep), Maplibre GL
(Mapbox GL fork for custom tiles), deck.gl (WebGL map layers),
Turf.js (spatial analysis: distances, buffers, intersections).

**Streaming:** The adopter's server consumes Kafka/WebSocket
and pushes graph deltas to the browser. g3t receives updates
via the event bus (`graph:nodeAdded`, `graph:edgeRemoved`).

**Entity resolution:** Run Senzing, dedupe.io, or custom ML
on the backend. Visualize results in g3t with a "merged from"
property on resolved entities.

**Temporal analysis:** g3t's TemporalRangeFilter provides basic
time filtering. For advanced temporal analysis (trajectory
rendering, dwell-time heatmaps), use d3-time + d3-geo alongside
the UGM's temporal properties.
