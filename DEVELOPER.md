# Developer Guide

Install first: CONTRIBUTING.md's Setup section names the three
prerequisites (Node, pnpm via corepack, Python for the spec gates) and
the single `pnpm run gates` command CI runs. Everything below assumes a
working install.

## Toolkit Boundary

Before writing any code, understand what goes where:

**Integration surface convention:** adopter-facing behavior flows
through three channels only: exported zustand stores (read, write,
subscribe from anywhere), props/callbacks, and versioned JSON
documents (encoding spec, workspace snapshots, algorithm results).
When you add a capability, expose it through one of these and add a
snippet to docs/wiring-guide.md WITH its executable twin in
examples/wiring/ (the guide cannot rot: CI runs every snippet, and
the round-22 pass caught three public-barrel gaps exactly this way).

**Toolkit packages** (`packages/core`, `packages/react`, `packages/charts`)
contain composable primitives that adopters `pnpm install` and use in
their own applications. A toolkit component:

- Is independently importable (using Canvas doesn't pull in Timeline)
- Accepts a UGM and renders/processes it (leaf node in the adopter's tree)
- Does NOT dictate page layout, routing, or application architecture
- Does NOT persist state to localStorage/files (that's the adopter's job)
- Does NOT orchestrate multi-step workflows (that's application logic)

**Examples** (`examples/`) contain reference implementations showing
how to compose toolkit components into full applications. These are
NOT published to npm. An example can include WorkspaceShell, workflow
engines, session persistence, and configuration factories.

**Demo** (`src/demo/`) is the dev server showcase. It uses toolkit
components with fixture data to demonstrate capabilities. NOT published.

### The Test

When adding a new feature, ask: "Would an adopter use this as-is
(pass a UGM, get a result), or would they need to configure,
disable, or replace it?"

- **As-is** → toolkit package
- **Configure/replace** → examples directory

### D6 vs D13

Every module follows one of two rules:

**D6 (Framework-Agnostic):** Pure TypeScript, no React, no JSX.
Goes in `@g3t/core`. Usable from Vue, Angular, Svelte, or Node.js.

**D13 (React):** React components with hooks. Goes in `@g3t/react`
or `@g3t/charts`. Peer-depends on React.

Rule: if it CAN be pure TypeScript, it MUST go in core.

## Project Structure

The three published packages live under `packages/`; everything at the
repository root is unpublished tooling, demo or docs. Only the
directories a contributor has to find are listed; run `ls packages/*/src`
for the rest.

```
packages/
├── core/src/                ← @g3t/core (D6, zero React)
│   ├── ugm/                 ← Universal Graph Model
│   ├── model/               ← Graph document + snapshot schemas
│   ├── adapter/             ← SPARQL, Cypher, REST, Holonic adapters
│   ├── middleware/          ← Adapter request interceptors
│   ├── projection/          ← RDF → LPG pipeline + transforms
│   ├── pipeline/            ← Projection stage composition
│   ├── layout/              ← Layout engine interfaces + implementations
│   ├── route/               ← Obstacle-aware edge routing
│   ├── shacl/               ← Shape and validation-report documents
│   ├── style/               ← Encoding spec → VisualAttributes
│   ├── export/              ← Turtle, CSV, JSON emitters
│   ├── algorithm-adapter/   ← Algorithm result ingestion
│   ├── relational-virtualizer/ ← CSV/relational → graph
│   ├── diff/                ← Graph diff engine
│   ├── event-bus/           ← Framework-agnostic pub/sub
│   ├── working-set-manager/ ← Node count limits
│   └── internal/            ← Deliberate second entry point, not public API
├── react/src/               ← @g3t/react (D13)
│   ├── views/               ← Canvas, table, timeline, map, schema, ...
│   ├── interaction/         ← Controls (toolbar, filter, search, camera, ...)
│   ├── state/               ← Zustand stores
│   ├── theme/               ← Theming (tokens + store)
│   ├── a11y/                ← Accessibility
│   └── stories/             ← Storybook
└── charts/src/              ← @g3t/charts (D13, peer-depends on core + react)

src/demo/                    ← Dev-server showcase (NOT published)
examples/                    ← Reference apps + the wiring-guide twins
tests/                       ← E2E, perf, and cross-package tests
specs/  roadmap/  planning/  ← Requirements, design records, round logs
```

## Adding a New Component

1. Decide: D6 (core) or D13 (react)?
2. Create the module in the correct package's `src/`
3. Write tests beside it (unit for D6; RTL for D13)
4. Export it from that package's barrel (`packages/<pkg>/src/index.ts`).
   A symbol reachable only through an inner barrel is not importable by
   an adopter, and `verify:exports` fails on it. Any type a consumer must
   NAME to use a documented prop has to be exported too (`verify:typeref`)
5. Regenerate the published-surface golden file:
   `node scripts/check-api-surface.mjs --update`. `verify:surface` fails
   the build until it matches, which is the point: an unintended export
   cannot slip in unreviewed
6. Add a Storybook story (if D13)
7. Expose it through one of the three integration channels and add a
   wiring-guide snippet with its executable twin in `examples/wiring/`
8. Record the work: a CHANGELOG entry and a STATUS.md refresh if
   numbers moved (PROGRESS.md and the visual-acceptance round log are
   both retired; the milestone-era record is
   planning/milestone-history.md)

## Adding a New Adapter

1. Implement the `GraphAdapter` interface (`packages/core/src/adapter/types.ts`)
2. Accept `middleware?: Middleware[]` in the constructor
3. Bind user-supplied values through the protocol's parameter channel;
   never build a query by string interpolation
4. Write unit tests with mocked network calls
5. Add to `packages/core/src/index.ts` and regenerate the surface file
6. Document in ARCHITECTURE.md

## Theming

All visual values come from CSS custom properties (`--g3t-*`).
Never hardcode colors, fonts, or spacing in components. Use:

```css
color: var(--g3t-text-primary);
background: var(--g3t-bg-secondary);
padding: var(--g3t-space-3);
font-size: var(--g3t-font-sm);
```

## Testing

| Layer     | Tool                         | What it covers                           |
| --------- | ---------------------------- | ---------------------------------------- |
| Unit      | Vitest                       | Pure functions (D6 modules), store logic |
| Component | RTL (@testing-library/react) | React components in jsdom                |
| E2E       | Playwright                   | Full browser interactions                |

```bash
pnpm run gates     # everything CI runs, in CI's order
pnpm test          # unit + component only
pnpm run test:coverage  # the same run, with a v8 coverage report
pnpm typecheck     # TypeScript verification
pnpm lint          # ESLint + Prettier check
pnpm storybook     # Component explorer
```

Test counts are deliberately not quoted here. Hand-maintained numbers in
this repository have drifted several times; when a number disagrees with
a gate script, the script is right. Coverage is reported, NOT gated
(ruled 2026-08-16): there is no threshold and none should be added from
a single measurement, which would pin the number where it happened to
land and make the next honest refactor read as a regression.

`pnpm test` does not run the e2e suite; `pnpm run test:e2e` does, and it
needs browsers (`pnpm exec playwright install --with-deps chromium`).
Run it before trusting any change to `tests/e2e/`, because typecheck and
lint cannot tell you whether a selector matches anything.

## Running the Demo

```bash
pnpm dev          # Opens at localhost:5173
```

The landing page offers eight cards, each with a dedicated shell (there
is no generic fallback app any more): four scenario shells (Provenance
Auditor, MBSE Satellite Workbench, Supply Chain Digital Thread,
Biomedical Knowledge Graph) and four capability surfaces (Analytics
Dashboard, Scale, Style Lab, Ontology Workbench). Two of the surfaces are
environment-gated in `src/demo/DemoLanding.tsx`: Style Lab is dev-only and Scale
is production-only, both overridable with `?e2e=1`.

Every shell is a lazy chunk, so the landing paints from a small bundle
and a shell loads on selection. A failed chunk fetch is caught by a
`ViewErrorBoundary` with a retry, not left to blank the page.

Demo code lives in `src/demo/` and is NOT part of the published package.

## Implementation Lore (promoted from the retired PROGRESS.md)

Hard-won environment facts that bite repeatedly; verify before
"fixing" any of them:

- Cytoscape selectors do not support booleans: `_asserted` is stored
  as numeric 0/1 and selected with `edge[_asserted = 0]`.
- @types/cytoscape rejects `"data(x)"` strings for shape/opacity;
  the `as any` casts in stylesheets are deliberate.
- cytoscape-fcose has no @types package; the custom declaration
  lives in packages/react/src/types/cytoscape-fcose.d.ts.
- jsdom lacks Canvas 2D, so Cytoscape component tests mock cytoscape
  (the `canvas` npm package needs native compilation). Anything that
  truly renders needs Playwright or a live look at the Pages playground
  (the standalone visual-acceptance page was retired 2026-07-04).
- jsdom reports hex colors as rgb(); color assertions match either.
- elkjs imports from `elkjs/lib/elk.bundled.js` (async API, works in
  browser and Node without a worker file).
- d3-force runs synchronously via a tick() loop; d3-hierarchy BFS
  skips visited nodes to survive cycles.
- UGM composes over graphology MultiGraph (never inherits);
  QualifiedEdgeMeta lives in a `meta` sub-object on EdgeAttributes.
- Non-null assertions are allowed in test files only (ESLint
  override); Vitest mock typing uses `as Record<string, unknown>`.

## Relationship to CONTRIBUTING.md

CONTRIBUTING.md covers install, the gate command, the PR process,
commit conventions, and testing requirements: read it first.
DEVELOPER.md covers project structure, architecture rules, and "where
things go." Read both before your first contribution.
