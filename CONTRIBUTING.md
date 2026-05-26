# Contributing to g3-toolkit


## Toolkit Boundary

Before adding a feature, ask: "Would an adopter use this as-is
(pass a UGM, get a result), or would they need to configure,
disable, or replace it?"

- **As-is** → toolkit package (`src/`)
- **Configure/replace** → examples directory (`examples/`)

Full rationale: [ARCHITECTURE.md](ARCHITECTURE.md).

## Testing Matrix

All code changes must include tests. Use the appropriate layer:

| Layer | Framework | When to use | Location | Suffix | Run command |
|---|---|---|---|---|---|
| **Unit** | Vitest | Pure logic: UGM, adapters, projection, layout, state stores | `src/**/*.test.ts` | `.test.ts` | `pnpm test` |
| **Component** | RTL (React Testing Library) | React components render correctly, props, events | `src/**/*.test.tsx` | `.test.tsx` | `pnpm test` |
| **E2E / Visual** | Playwright | Screenshot baselines, cross-view flows, real CSS rendering | `tests/e2e/` | `.spec.ts` | `pnpm test:e2e` |

See `docs/testing-architecture.md` for the full rationale (D14).

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
npx playwright install --with-deps chromium
```

### Conventions

- Every ticket's acceptance criteria names the test layer. Use that layer.
- Files in `src/core/` MUST NOT import React. Their tests use `.test.ts` (not `.test.tsx`).
- Component tests import from `@testing-library/react`; they do NOT use Playwright.
- Playwright tests live in `tests/e2e/` and use `@playwright/test` imports.
- Use `describe` blocks named after the module or component under test.
- Use `it` or `test` with a sentence describing the expected behavior.
- Prefer `toEqual` for objects and `toBe` for primitives.

## Code Style

- TypeScript strict mode; no `any` except with a comment explaining why.
- ESLint + Prettier enforced. Run `pnpm lint:fix` before committing.
- Colorblind-safe Okabe-Ito palette for all visual defaults (R7.8).
- `src/core/` is framework-agnostic (D6): no React, no Cytoscape imports.
- `src/views/` is React (D13).

## Commit Messages

One commit per ticket. Format:

```
M0.E2.T1: Graphology wrapper with typed nodes

Implements UGM with typed node creation, iteration, lookup, remove.

Refs: R3.1
```

## Pull Request Process

1. Fork the repository and create a feature branch.
2. Run `pnpm test && pnpm typecheck && pnpm lint` before pushing.
3. PRs require passing CI (GitHub Actions).
4. Include test coverage for new functionality.
5. Update CHANGELOG.md under an `[Unreleased]` section.

## Issues

Use GitHub Issues for bug reports and feature requests. Include:
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Browser/OS/Node version
