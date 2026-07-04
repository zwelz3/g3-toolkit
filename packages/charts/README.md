# @g3t/charts

Linked statistical charts (bar, scatter, line, pie, parallel
coordinates, sankey) for the g3-toolkit. Charts synchronize selection
with the graph canvas and table via the `@g3t/core` `DataPipeline`
abstraction.

Install only if you need non-graph visualizations alongside your
graph views.

Live: [playground](https://zwelz3.github.io/g3-toolkit/playground/) ·
[Storybook](https://zwelz3.github.io/g3-toolkit/storybook/) ·
[wiring guide](https://github.com/zwelz3/g3-toolkit/blob/main/docs/wiring-guide.md)
(every guide snippet runs in CI).

## Install

```bash
npm install @g3t/core @g3t/react @g3t/charts react echarts
```

`echarts-for-react` is pulled in transitively (regular dep of
`@g3t/charts`).

## Quick start

```tsx
import { UGM, createDegreeDistribution } from "@g3t/core";
import { LinkedChart } from "@g3t/charts";

const degreePipeline = createDegreeDistribution();

function NodeDegreeChart({ ugm }: { ugm: UGM }) {
  return <LinkedChart ugm={ugm} pipeline={degreePipeline} type="bar" />;
}
```

## Embedding projection (recipe, not a component)

Per the capability landscape (research/capability-landscape.md,
section E), embedding projection is a pipeline recipe over the
existing scatter chart, not a new component: the toolkit consumes
algorithm results, it does not compute them (design principle P1).
Reduce your embeddings to 2D upstream (UMAP, t-SNE, PCA), ingest the
coordinates as node properties, then project:

```tsx
import {
  UGM,
  type DataPipeline,
  type ScatterData,
  type PointSetSelection,
} from "@g3t/core";
import { LinkedChart } from "@g3t/charts";

const embeddingProjection: DataPipeline<ScatterData, PointSetSelection> = {
  id: "embedding-2d",
  name: "Embedding projection",
  query: (ugm: UGM): ScatterData => ({
    points: ugm
      .getNodeIds()
      .map((id) => {
        const props = ugm.getNode(id)?.properties ?? {};
        return {
          x: Number(props["emb_x"]),
          y: Number(props["emb_y"]),
          nodeId: id,
        };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  }),
  reverseMap: (selection, data) =>
    selection.indices.map((i) => data.points[i]?.nodeId ?? "").filter(Boolean),
};

function EmbeddingView({ ugm }: { ugm: UGM }) {
  return (
    <LinkedChart ugm={ugm} pipeline={embeddingProjection} type="scatter" />
  );
}
```

Brush selection in the scatter maps back to node IDs through
`reverseMap`, so lassoing a cluster of embeddings selects those nodes
in the canvas and table.

## Documentation

Full documentation, architecture overview, and integration examples:
[g3-toolkit repository](https://github.com/anthropic-experiments/g3-toolkit).

## License

Apache-2.0
