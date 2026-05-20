# g3-toolkit

A composable, paradigm-neutral graph visualization toolkit.

**Status:** M0 (Foundation) complete. Version 0.0.1.

## What's Working

- **Unified Graph Model (UGM):** Graphology-backed data model with
  typed nodes, Qualified Edge metadata, event bus, and serialization.
- **Cytoscape Canvas:** React wrapper rendering UGM data with
  Okabe-Ito colorblind-safe palette, force-directed layout, and
  visual encoding (shape+color by type, dashed for inferred edges).
- **Context Menu:** Extensible right-click menu with plugin API.
- **Detail Inspector:** Property panel with nested expansion and
  Qualified Edge metadata display.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests (90 tests)
npm run test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Documentation

```bash
# Install pixi (for Python-based doc tooling)
curl -fsSL https://pixi.sh/install.sh | bash

# Build specification docs
pixi run docs

# Serve docs locally
pixi run docs-serve
```

## Specification

The specification lives in `specs/` as specl-format markdown files:

- 67 requirements across 11 files
- 14 design decisions
- 15 open questions
- 100 implementation tickets across 11 milestones

See `planning/roadmap.md` for the full implementation plan.

## Repository Structure

```
g3-toolkit/
├── src/                            # Application source (TypeScript + React)
│   ├── core/ugm/                   # Unified Graph Model (D6: no React)
│   ├── interaction/context-menu/   # Context menu manager + component
│   ├── views/canvas/              # Cytoscape wrapper + palette
│   ├── views/inspector/           # Detail property panel
│   └── index.ts                   # Public API barrel
├── tests/
│   └── e2e/                       # Playwright visual/integration tests
├── specs/                          # specl-format specification (11 files)
├── research/                       # Use-case survey, technology survey
├── planning/                       # Roadmap, audit, manual test plan
├── docs/source/                    # Sphinx documentation config
├── scripts/                        # Build and lint tooling
├── CLAUDE.md                       # Claude Code handoff instructions
├── DEVELOPER.md                    # Human developer workflow
├── PROGRESS.md                     # Persistent implementation state
├── CONTRIBUTING.md                 # Testing matrix and code style
├── CHANGELOG.md                    # Version history
├── package.json                    # Node.js dependencies and scripts
├── pixi.toml                       # Python env + task runner
└── tsconfig.json                   # TypeScript strict config
```

## Architecture (M0)

- `src/core/` is framework-agnostic TypeScript (D6); no React imports
- `src/views/` uses React (D13)
- UGM (Graphology MultiGraph) is the canonical data model
- Cytoscape.js renders via the ugmToCytoscapeElements converter
- 500-node benchmark: 305ms initialization (go/no-go gate passed)
- 90 automated tests (Vitest unit + RTL component)

## License

TBD
