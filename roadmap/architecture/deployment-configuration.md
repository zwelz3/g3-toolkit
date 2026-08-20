# Deployment Configuration for Performance Limits

**Area:** architecture
**Owns:** R7.7 (in-progress, MUST)
**Design gate:** D5's two clauses (soft user-overridable defaults, plus
administrator ceilings users cannot exceed) must be reconciled into one
configuration model before the document format is fixed.
**Tracked as:** https://github.com/zwelz3/g3-toolkit/issues/5 (draft:
planning/github-issues/deployment-performance-configuration.md)

## Current state

The override mechanism is built and exported; nothing uses it.

`WorkingSetManager`'s constructor takes per-view overrides and merges
them over `DEFAULT_LIMITS` (canvas 500, table 10,000, tree 1,000, matrix
200, sankey 100, streaming 500). It is exported from `@g3t/core` and
`@g3t/react`. **No production code instantiates it**: every
`new WorkingSetManager(...)` in the tree is in a test file. An override
supplied today reaches nothing, because no view consumes a configured
instance.

There is no deployment configuration surface: no document, no
environment binding, no workspace-settings entry.

R7.7 read as `implemented` because it is cited in comments inside that
file. Corrected to `in-progress` 2026-08-20 after reading the code
against the acceptance criterion.

## Work breakdown (priority order)

1. **P1: Wire the manager.** Views take their limits from one injected
   `WorkingSetManager` instead of ignoring it. Nothing else here has any
   effect until this lands, and this is the actual defect: an exported
   class nothing instantiates.
2. **P1: Settle the ceiling question.** D5 promises soft defaults a user
   may raise *and* administrator ceilings they may not. The config model
   has to express both; today it expresses neither.
3. **P2: Deployment configuration document.** Versioned like the
   toolkit's other JSON documents so it can be validated rather than
   trusted, with explicit precedence: defaults, then deployment, then
   user.

## Exit

R7.7 implemented when an administrator-set canvas limit of 300 applies
to an analyst opening a canvas, and, once item 2 is settled, when an
attempt to exceed an administrator ceiling is refused rather than
prompted.
