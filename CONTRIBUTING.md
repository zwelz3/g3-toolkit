# Contributing to g3-toolkit

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Suspected vulnerabilities go through the private channel in
[SECURITY.md](SECURITY.md), never a public issue.

## Setup

Three prerequisites, all load-bearing:

| Tool | Version | Why |
|---|---|---|
| Node | >= 22.13 (the `engines` field) | build and test runtime |
| pnpm | 11.3.0 (the `packageManager` field) | the only supported package manager |
| Python | 3.12 with `pyyaml` | the last stage of `pnpm run gates` is three spec scripts |

pnpm comes from corepack, which ships with Node. Do not `npm i -g pnpm`:
corepack pins the version recorded in `packageManager`, and a global pnpm
of a different major resolves the workspace differently.

```bash
corepack enable            # once per machine
pnpm install               # workspace install (all three packages)
pip install pyyaml         # only scripts/sync_spec_status.py needs it
```

`npm install` fails by design: `preinstall` runs `only-allow pnpm`. If you
see "Use pnpm to install dependencies in this project", that is the guard
working, not a broken checkout.

### The one command

```bash
pnpm run gates
```

That is typecheck, lint, verify, test and the three Python spec gates, in
the exact order ci.yml runs them. `verify` builds the packages first and
then checks the published dist, the exports map, the wiring-guide
snippets, typedoc and the two size gates, so a change is not verified by
unit tests alone.

The two size gates measure different things and both matter.
`verify:bundle` budgets PUBLISH WEIGHT, the whole `dist/` of each
package. `verify:consumer-cost` bundles imports an adopter actually
writes and budgets what THEIR bundle grows by. The packages declare
`sideEffects: false`, so the two diverge sharply: importing only `UGM`
costs 4.8 KB of first-party code against the 164 KB the package weighs.
Raising either needs a written reason in the same commit; a raise in
the consumer-cost gate is the more serious one, because that number is
somebody's page load.

Playwright is not part of `gates`; it runs in its own CI job and needs a
one-time browser install (see E2E tests below).

## Toolkit Boundary

Before adding a feature, ask: "Would an adopter use this as-is
(pass a UGM, get a result), or would they need to configure,
disable, or replace it?"

- **As-is** → a toolkit package (`packages/core`, `packages/react`, `packages/charts`)
- **Configure/replace** → examples directory (`examples/`) or the demo (`src/demo/`)

Full rationale: [ARCHITECTURE.md](ARCHITECTURE.md).

## Testing Matrix

All code changes must include tests. Use the appropriate layer:

| Layer | Framework | When to use | Location | Suffix | Run command |
|---|---|---|---|---|---|
| **Unit** | Vitest | Pure logic: UGM, adapters, projection, layout, state stores | beside the module, `packages/*/src/**/*.test.ts` | `.test.ts` | `pnpm test` |
| **Component** | RTL (React Testing Library) | React components render correctly, props, events | beside the component, `packages/*/src/**/*.test.tsx` | `.test.tsx` | `pnpm test` |
| **E2E / Visual** | Playwright | Screenshot baselines, cross-view flows, real CSS rendering | `tests/e2e/` | `.spec.ts` | `pnpm test:e2e` |

Demo and example code carries its own tests under `src/demo/` and
`examples/` on the same two suffixes.

See `docs/source/testing-architecture.md` for the full rationale (D14).

### Unit tests (Vitest)

For pure TypeScript logic with no DOM. Tests run in jsdom but
should not depend on rendering.

```typescript
import { describe, it, expect } from "vitest";
import { MyModule } from "./my-module";

describe("MyModule", () => {
  it("does the thing", () => {
    const result = MyModule.doThing();
    expect(result).toBe(expected);
  });
});
```

### Component tests (RTL)

For React components. Verify rendering, props, and user events.

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders with props", () => {
    render(<MyComponent title="hello" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
```

### E2E tests (Playwright)

For full application flows and visual regression. Playwright starts
the dev server automatically.

```typescript
import { test, expect } from "@playwright/test";

test("user can right-click a node", async ({ page }) => {
  await page.goto("/");
  // ...interaction...
  await expect(page).toHaveScreenshot("after-right-click.png");
});
```

### First-time Playwright setup

Install the browser binaries (one-time):

```bash
pnpm exec playwright install --with-deps chromium
```

### Conventions

- Where a work item names a test layer, use that layer.
- Files in `packages/core/` MUST NOT import React. Their tests use `.test.ts` (not `.test.tsx`), and the rule is enforced by `packages/core/src/module-boundary.test.ts`.
- Component tests import from `@testing-library/react`; they do NOT use Playwright.
- Playwright tests live in `tests/e2e/` and use `@playwright/test` imports.
- Use `describe` blocks named after the module or component under test.
- Use `it` or `test` with a sentence describing the expected behavior.
- Prefer `toEqual` for objects and `toBe` for primitives.

## Code Style

- TypeScript strict mode; no `any` except with a comment explaining why.
- ESLint + Prettier enforced. `pnpm lint` is the gate; `pnpm lint:fix`
  autofixes what it can.
- Colorblind-safe Okabe-Ito palette for all visual defaults (R7.8).
- `packages/core` is framework-agnostic (D6): no React, no Cytoscape imports.
- `packages/react` and `packages/charts` are React (D13).

## Commit Messages

One commit per self-contained change. The subject says what the commit
does to the codebase, in the imperative, with no ticket prefix. The body
says what was wrong and why this is the fix. Cite requirement IDs only
when the commit implements one.

```
Parameterize the three remote query adapters

String interpolation built each query, so a node id containing a quote
produced a malformed query at best and an injected clause at worst. All
three adapters now bind values through their protocol's parameter
channel.

Refs: R1.13
```

The milestone ticket format (`M0.E2.T1:`) is retired; see
planning/milestone-history.md for the era it belonged to.

## Pull Request Process

1. Fork the repository and create a feature branch.
2. Run `pnpm run gates` before pushing. Not `pnpm test && pnpm typecheck
   && pnpm lint`: that trio is a strict subset of CI and skips `verify`
   and the spec gates, which is where build, export-map and documentation
   breakage shows up.
3. PRs require passing CI (GitHub Actions).
4. Include test coverage for new functionality.
5. Add a CHANGELOG.md entry at the top, under the current version's dated
   heading. The changelog is organised by release date, not by an
   `[Unreleased]` section.

## Issues

Use GitHub Issues for bug reports and feature requests. Include:
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Browser/OS/Node version

Not for security. A suspected vulnerability goes through the private
advisory form described in [SECURITY.md](SECURITY.md), which also
states what is in scope.

Not for security. A suspected vulnerability goes through the private
advisory form described in [SECURITY.md](SECURITY.md), which also
states what is in scope.
