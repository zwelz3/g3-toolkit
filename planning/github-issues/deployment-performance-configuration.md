# Deployment-level performance configuration for working-set limits

**Labels:** `enhancement`, `core`, `react`, `deployment`
**Relates to:** requirement `R7.7` (`specs/07-ux-defaults-accessibility.md`)

## Summary

Working-set limits are the toolkit's main performance lever, and how many
nodes a deployment can render is a property of the hardware it runs on rather
than of the toolkit. `R7.7` requires those limits to be configurable per
deployment, with an explicit user action needed to exceed one.

The override **API exists and is exported**. What does not exist is anything
that supplies it, consumes it, or lets an administrator set it without writing
code. This issue is about closing that gap, not about building the mechanism
from nothing.

## Current state, verified

`packages/core/src/working-set-manager/working-set-manager.ts`:

```ts
const DEFAULT_LIMITS: Record<ViewType, number> = {
  canvas: 500, table: 10_000, tree: 1_000,
  matrix: 200, sankey: 100, streaming: 500,
};

export class WorkingSetManager {
  constructor(overrides?: Partial<Record<ViewType, number>>) {
    this.limits = { ...DEFAULT_LIMITS, ...overrides };
  }
  checkLimit(viewType: ViewType, count: number): LimitCheckResult { ... }
}
```

- The constructor takes per-view overrides. **The mechanism is built.**
- `WorkingSetManager` is exported from both `@g3t/core` and `@g3t/react`.
- **Nothing in production code instantiates it.** The only `new
  WorkingSetManager(...)` calls in the tree are in four test files. No view
  consumes a configured instance, so an override supplied today reaches
  nothing.
- There is no deployment configuration surface at all: no config document, no
  environment binding, no workspace-settings entry.

The requirement has been reading as `implemented` because `R7.7` is cited in
comments inside that file. It was corrected to `in-progress` on 2026-08-20
after reading the code against the acceptance criterion.

## Why it matters

The defaults are a guess about hardware. 500 canvas nodes is conservative on a
workstation and optimistic on a thin client, which is exactly the case
`specs/08-security-deployment.md` contemplates when it describes classified
deployments on constrained terminals. A deployment that cannot tune this has
to choose between a toolkit that feels slow and one that refuses work it could
have done.

## Proposed scope

**Wiring, first and smallest**

- Views obtain their limits from a single injected `WorkingSetManager` rather
  than ignoring it. Until this lands, nothing else here has any effect.

**Configuration surface**

- A deployment-level configuration document carrying the six limits, resolved
  once at host setup and passed to the manager. Versioned, like the toolkit's
  other JSON documents, so it can be validated rather than trusted.
- Precedence must be explicit and documented: built-in defaults, then
  deployment configuration, then any per-user override.

**The ceiling question, which needs a decision before code**

`specs/g3t/spec.md#decisions` D5 says working-set limits are soft defaults
that a user may override with explicit acknowledgment, **and** that platform
administrators may set deployment-level overrides that users cannot exceed.
Those two clauses interact: a soft default a user can raise, inside a hard
ceiling they cannot. The configuration model needs to express both, and today
it expresses neither. Worth settling before implementing, because it changes
the shape of the config document.

## Acceptance

`R7.7`'s existing criterion: given a platform administrator who sets the
canvas limit to 300 for a deployment, when an analyst opens a canvas, the
300-node limit applies. Add the ceiling case once the question above is
settled: an analyst attempting to exceed an administrator ceiling is refused
rather than prompted.

## Notes for whoever picks this up

The honest first commit is the wiring, not the config format. An exported
manager that nothing instantiates is the actual defect; the missing config
document is a consequence of nobody having needed one yet. Doing the wiring
first also makes the ceiling question concrete instead of theoretical.
