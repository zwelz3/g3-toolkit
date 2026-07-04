# @g3t/core

Framework-agnostic data model, adapters, projection pipeline, and
algorithms for the g3-toolkit. Zero React dependency; usable from
Vue, Angular, Svelte, or plain JavaScript.

## Install

```bash
npm install @g3t/core
# or
pnpm add @g3t/core
```

## Quick start

```ts
import { SparqlAdapter } from "@g3t/core";

const ugm = await new SparqlAdapter("https://example.org/sparql").query(
  "SELECT * WHERE { ?s ?p ?o } LIMIT 200",
);

console.log(`Graph has ${ugm.nodeCount} nodes, ${ugm.edgeCount} edges.`);
```

## Subpath imports

`@g3t/core` ships subpath exports so consumers can pull only what they
need:

```ts
import { ForceLayout } from "@g3t/core/layout";
import { ShaclValidator } from "@g3t/core/shacl";
import { ProjectionPipeline } from "@g3t/core/projection";
```

Available subpaths: `adapters`, `middleware`, `events`, `projection`,
`pipeline`, `shacl`, `diff`, `layout`, `algorithms`, `undo-redo`,
`theme`, `path-analysis`.

## Documentation

Full documentation, architecture overview, and integration examples:
[g3-toolkit repository](https://github.com/anthropic-experiments/g3-toolkit).

See `ARCHITECTURE.md` for the toolkit/application boundary and
`docs/source/` for adopter guides.

## License

Apache-2.0
