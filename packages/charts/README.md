# @g3t/charts

Linked statistical charts (bar, scatter, line, pie, parallel
coordinates, sankey) for the g3-toolkit. Charts synchronize selection
with the graph canvas and table via the `@g3t/core` `DataPipeline`
abstraction.

Install only if you need non-graph visualizations alongside your
graph views.

## Install

```bash
npm install @g3t/core @g3t/react @g3t/charts react echarts
```

`echarts-for-react` is pulled in transitively (regular dep of
`@g3t/charts`).

## Quick start

```tsx
import { UGM } from "@g3t/core";
import { LinkedChart } from "@g3t/charts";

function NodeDegreeChart({ ugm }: { ugm: UGM }) {
  return (
    <LinkedChart
      pipeline="node-degree"
      chartType="bar"
      ugm={ugm}
    />
  );
}
```

## Documentation

Full documentation, architecture overview, and integration examples:
[g3-toolkit repository](https://github.com/anthropic-experiments/g3-toolkit).

## License

Apache-2.0
