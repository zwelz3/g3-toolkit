# @g3t/core

Framework-agnostic data model, adapters, projection pipeline, and
algorithms for the g3-toolkit. Zero React dependency; usable from
Vue, Angular, Svelte, or plain JavaScript.

Live: [playground](https://zwelz3.github.io/g3-toolkit/playground/) ·
[Storybook](https://zwelz3.github.io/g3-toolkit/storybook/) ·
[wiring guide](https://github.com/zwelz3/g3-toolkit/blob/main/docs/wiring-guide.md)
(every guide snippet runs in CI).

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

## Adapter requests: timeouts, cancellation, and failures

Every remote adapter times out after 30 seconds by default. Override it
per adapter, or pass `0` to turn it off:

```ts
import { SparqlAdapter, RestAdapter } from "@g3t/core";

const sparql = new SparqlAdapter("https://example.org/sparql", undefined, {
  timeoutMs: 60_000,
});

const rest = new RestAdapter({
  url: "https://example.org/graph",
  mapResponse: () => ({ nodes: [], edges: [] }),
  timeoutMs: 5_000,
});

void [sparql, rest];
```

Failures arrive as named errors rather than as bare strings, so a host
can branch on them:

```ts
import { SparqlAdapter } from "@g3t/core";
import { AdapterHttpError, AdapterArgumentError } from "@g3t/core/adapters";
import { AdapterTimeoutError } from "@g3t/core/middleware";

const adapter = new SparqlAdapter("https://example.org/sparql");

try {
  await adapter.query("SELECT * WHERE { ?s ?p ?o }");
} catch (err) {
  if (err instanceof AdapterArgumentError) {
    // The request never left: an argument could not be safely placed.
  } else if (err instanceof AdapterTimeoutError) {
    // `err.timedOut` separates the timeout from a caller cancellation.
  } else if (err instanceof AdapterHttpError) {
    // The endpoint answered and refused. `err.status`, `err.url` and
    // `err.body` carry what it said, truncated to 1000 characters.
  }
}
```

To cancel an in-flight request, pass an `AbortSignal` on the request
through middleware; the default transport honors it alongside its own
timeout.

Building a middleware chain by hand needs a base transport at the end
of it. `createDefaultFetch` is that transport, and it takes the same
timeout the adapters do:

```ts
import {
  composeMiddleware,
  createDefaultFetch,
  bearerAuth,
  DEFAULT_TIMEOUT_MS,
} from "@g3t/core/middleware";

const fetcher = composeMiddleware(
  [bearerAuth(() => sessionStorage.getItem("token") ?? "")],
  createDefaultFetch({ timeoutMs: DEFAULT_TIMEOUT_MS }),
);

void fetcher;
```

Before wiring a browser directly to a graph store, read
[SECURITY.md](https://github.com/zwelz3/g3-toolkit/blob/main/SECURITY.md)
on what the auth middleware does and does not protect.

## Documentation

Full documentation, architecture overview, and integration examples:
[g3-toolkit repository](https://github.com/zwelz3/g3-toolkit).

See `ARCHITECTURE.md` for the toolkit/application boundary and
`docs/source/` for adopter guides.

## License

Apache-2.0
