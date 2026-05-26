# Developer Guide

## Toolkit Boundary

Before writing any code, understand what goes where:

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

**Demo** (`demo/`) is the dev server showcase. It uses toolkit
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

```
src/
├── core/                    ← @g3t/core (D6)
│   ├── ugm/                 ← Universal Graph Model
│   ├── adapter/             ← SPARQL, Cypher, REST, Holonic adapters
│   ├── projection/          ← RDF → LPG pipeline + transforms
│   ├── middleware/           ← Adapter request interceptors
│   ├── event-bus/           ← Framework-agnostic pub/sub
│   ├── layout/              ← Layout engine interfaces + implementations
│   ├── working-set-manager/ ← Node count limits
│   ├── algorithm-adapter/   ← Algorithm result ingestion
│   ├── relational-virtualizer/ ← CSV/relational → graph
│   └── diff/                ← Graph diff engine
├── views/                   ← @g3t/react (D13)
├── interaction/             ← @g3t/react controls (D13)
├── state/                   ← Zustand stores (D13)
├── theme/                   ← Theming (D6 tokens + D13 store)
├── a11y/                    ← Accessibility (D13)
└── demo/                    ← Demo app (NOT published)
```

## Adding a New Component

1. Decide: D6 (core) or D13 (react)?
2. Create the module in the correct directory
3. Write tests (unit for D6; RTL for D13)
4. Add to the barrel export (`src/index.ts`)
5. Add a Storybook story (if D13)
6. Update PROGRESS.md

## Adding a New Adapter

1. Implement the `GraphAdapter` interface (`src/core/adapter/types.ts`)
2. Accept `middleware?: Middleware[]` in the constructor
3. Write unit tests with mocked network calls
4. Add to barrel export
5. Document in ARCHITECTURE.md

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

| Layer | Tool | What it covers |
|-------|------|----------------|
| Unit | Vitest | Pure functions (D6 modules), store logic |
| Component | RTL (@testing-library/react) | React components in jsdom |
| E2E | Playwright | Full browser interactions |
| E2E | Playwright | Full browser interactions |

```bash
pnpm test          # 399 unit + component tests
pnpm typecheck     # TypeScript verification
pnpm lint          # ESLint
pnpm storybook     # Component explorer
```

## Running the Demo

```bash
pnpm dev          # Opens at localhost:5173
```

The demo has 9 scenarios on a landing page. 5 have custom shells
(Healthcare, Data Scientist, Analytics, Auditor, MBSE); the rest
use the generic DemoApp. Demo code lives in `src/demo/` and is
NOT part of the published package.

## Relationship to CONTRIBUTING.md

DEVELOPER.md covers project structure, architecture rules, and
"where things go." CONTRIBUTING.md covers the PR process, commit
conventions, and testing requirements. Read both before your
first contribution.
