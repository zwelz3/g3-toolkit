# Changelog

All notable changes to the g3-toolkit are documented here.

Versioning: milestones use minor versions (0.1.0, 0.2.0, ...);
post-audit patches use patch versions (0.0.1, 0.1.1, ...).

## [0.0.1] - 2026-05-20

### M0: Foundation

First milestone complete. Proves the data-to-rendering pipeline:
UGM (Graphology) → Cytoscape.js canvas with right-click context
menu and detail inspector.

#### Added

- **Unified Graph Model (UGM):** Graphology MultiGraph wrapper with
  typed nodes (multi-label), Qualified Edge model (confidence,
  provenance, temporal, asserted), event bus (7 event types with
  unsubscribe), and JSON serialization/deserialization.

- **Cytoscape Canvas:** React wrapper component accepting UGM as
  prop. Okabe-Ito colorblind-safe palette (8 colors × 8 shapes).
  Node encoding: type → color+shape, name → label, size → diameter.
  Edge encoding: type → label, confidence → opacity, asserted/inferred
  → solid/dashed (D9). fcose layout registered.

- **Context Menu:** Framework-agnostic ContextMenuManager with
  plugin extension API. Default items: "Inspect properties" and
  "Copy IRI" (filtered by target type). React ContextMenu component
  with positioned rendering, click-outside close, Escape close.

- **Detail Inspector:** Property panel rendering node types,
  properties (with nested object expansion), and Qualified Edge
  metadata (confidence, provenance, temporal, asserted). Updates
  on selection change.

- **Build Tooling:** Vite 8, TypeScript 6 (strict), Vitest 4,
  Playwright, ESLint 10 (flat config), Prettier. Path aliases
  (@core, @views, @state, @interaction, @a11y). CI pipeline
  (GitHub Actions).

#### Performance

- 500 nodes + 2,000 edges: 305ms initialization (headless).
  Go/no-go gate passed; no Sigma.js pivot needed.

#### Architecture

- `src/core/` has zero React imports (D6 verified).
- `src/views/` uses React (D13).
- Module boundary enforced by convention; build-time test
  scheduled for M3.E4.T1.

#### Test Coverage

- 90 tests across 9 files, all passing.
- Layers: Vitest unit (core logic), RTL component (React views),
  Playwright e2e (stub; full visual tests require browser install).
