# @g3t/react

React components for graph visualization: canvas, table, inspector,
tree, map, schema, timeline, and more. Pairs with `@g3t/core` for the
underlying data model.

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
import { UGM, SparqlAdapter } from "@g3t/core";
import { CytoscapeCanvas, TableView } from "@g3t/react";

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

## Subpath imports

```ts
import { CytoscapeCanvas } from "@g3t/react/views";
import { FilterBuilder } from "@g3t/react/controls";
import { useSelectionStore } from "@g3t/react/state";
import { ThemeProvider } from "@g3t/react/theme";
import { AriaCompanion } from "@g3t/react/a11y";
```

## Documentation

Full documentation, architecture overview, and integration examples:
[g3-toolkit repository](https://github.com/anthropic-experiments/g3-toolkit).

## License

Apache-2.0
