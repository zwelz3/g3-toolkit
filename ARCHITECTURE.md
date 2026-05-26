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

Peer dependency: `graphology` only.

### @g3t/react

React components that consume UGM. Each component is independently
importable; using `CytoscapeCanvas` does not pull in `TimelineView`.

Contains: 12 view components, 10 control components, accessibility
companion, state hooks (selection, theme, view filter).

Peer dependencies: `react`, `@g3t/core`, `cytoscape`.

### @g3t/charts (optional)

Linked statistical charts that synchronize selection with the
graph canvas and table. Install only if you need non-graph
visualizations.

Contains: LinkedChart wrapper, 6 chart renderers (bar, scatter
with trend, line/area, pie/donut, parallel coordinates).

Peer dependencies: `react`, `@g3t/core`, `echarts`.

## What Is NOT in the Packages

The following patterns are useful but application-specific. They
are provided as reference implementations in `examples/`, not as
published API surface:

| Pattern | Why it's application-level | Where to find it |
|---------|---------------------------|-----------------|
| Full workspace layout (FlexLayout) | Adopters have their own page layout | `examples/full-workspace/` |
| Workflow engine (step sequences) | Adopters have their own analysis pipelines | `examples/full-workspace/` |
| Session persistence (save/load) | Adopters have their own storage layer | `examples/full-workspace/` |
| Configuration factory (`createG3Toolkit()`) | Removes composability; too opinionated | `examples/full-workspace/` |
| Demo landing page / scenarios | Marketing; not functionality | `demo/` |

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
    const groups = new Map<string, { sum: number; count: number; ids: string[] }>();
    ugm.forEachNode((id, attrs) => {
      const role = String(attrs.properties.role ?? "Unknown");
      const risk = Number(attrs.properties.risk ?? 0);
      const g = groups.get(role) ?? { sum: 0, count: 0, ids: [] };
      g.sum += risk; g.count++; g.ids.push(id);
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
    const cat = data.categories.find(c => c.label === selection.category);
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
