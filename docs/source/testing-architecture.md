> **Note:** The canonical testing guide is in [CONTRIBUTING.md](../../CONTRIBUTING.md).
> This document provides additional architectural rationale.

# Testing Architecture

## Layers

| Layer | Framework | Purpose | Frequency | Location |
|-------|-----------|---------|-----------|----------|
| Unit | Vitest | Pure logic (D6 modules), store mutations | Every commit | `src/**/*.test.ts` |
| Component | RTL (@testing-library/react) | React component rendering, props, events | Every commit | `src/**/*.test.tsx` |
| E2E | Playwright | Full browser interactions, visual regression | Pre-release | `tests/e2e/*.spec.ts` |

## Why two test frameworks (not three)

Earlier versions included Robot Framework for stakeholder-facing
acceptance tests. This was consolidated into Playwright in v1.0.0-rc
because:

1. The Robot tests were partially non-executable (45 undefined
   keywords in the M8/M10 file)
2. Playwright covers the same browser interactions with less
   infrastructure overhead
3. Maintaining three test frameworks (Vitest, Playwright, Robot)
   added cost without proportional coverage gain

The BDD test descriptions from the Robot files were migrated to
Playwright `test()` labels for readability.

## Running tests

```bash
pnpm test          # Vitest (531 unit + component tests)
pnpm test:e2e      # Playwright (requires browser install)
pnpm typecheck     # TypeScript strict mode
pnpm lint          # ESLint + Prettier
```

## Playwright setup

```bash
npx playwright install --with-deps chromium
pnpm test:e2e
```

## Conventions

- Unit tests: `describe` named after module, `it` with behavior sentence
- Component tests: import from `@testing-library/react`, verify rendering and events
- E2E tests: use `data-testid` selectors, wait for elements before asserting
- `packages/core/src/` tests use `.test.ts` (no JSX); React-component tests in `packages/react/src/` and `packages/charts/src/` use `.test.tsx`
