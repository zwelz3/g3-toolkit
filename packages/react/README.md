# @g3t/react

React components for graph visualization: canvas, table, inspector,
tree, map, schema, timeline, and more. Pairs with `@g3t/core` for the
underlying data model.

Live: [playground](https://zwelz3.github.io/g3-toolkit/playground/) ·
[Storybook](https://zwelz3.github.io/g3-toolkit/storybook/) ·
[wiring guide](https://github.com/zwelz3/g3-toolkit/blob/main/docs/wiring-guide.md)
(every guide snippet runs in CI).

## Install

```bash
npm install @g3t/core @g3t/react react react-dom \
  cytoscape cytoscape-fcose zustand \
  echarts vis-timeline vis-data
```

The peer dependency list is broad because each view brings its own
runtime. Tree-shake by importing only the components you need.
`@g3t/react` itself pulls in `@tanstack/react-table` and `fuse.js`
transitively (they're regular dependencies of the package, not peers).

## Quick start

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

## Controls and integration (the round-7+ surface)

Beyond the views, the package ships the encoding grammar and its
surfaces (`EncodingSpecPanel`, `SpecLegend`, `SpecPort`, the
`encodingSpec` canvas prop: a versioned, serializable spec drives
color/size/icon/shape/labels with reserved-channel guards), the
connected `GraphToolbar` (search, layouts with force controls,
Shuffle, Pin all, zoom), per-node position pinning with a context-menu
action, structural algorithm overlays plus `AlgorithmPanel` and the
algorithm-result interchange (networkx/GraphBLAS documents), workspace
snapshots (`captureWorkspace`/`applyWorkspace`: spec + positions +
pins + theme as one JSON document), and theme-aware canvas rendering.

Integration happens through exported zustand stores (selection,
position pins, overlays, style overrides, theme), props/callbacks,
and the JSON contracts: a custom button controlling the toolkit is
usually one store call in an `onClick`. **See
[`docs/wiring-guide.md`](../../docs/wiring-guide.md)**: every snippet
there runs in CI at `examples/wiring/`.

## Subpath imports

```ts
import { CytoscapeCanvas } from "@g3t/react/views";
import { FilterBuilder } from "@g3t/react/controls";
import { useSelectionStore } from "@g3t/react/state";
import { useThemeStore } from "@g3t/react/theme";
import { AriaCompanion } from "@g3t/react/a11y";
```

## Documentation

Full documentation, architecture overview, and integration examples:
[g3-toolkit repository](https://github.com/anthropic-experiments/g3-toolkit).

## License

Apache-2.0
