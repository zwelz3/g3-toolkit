# Archived public surface

Owner ruling (2026-07-12): **archive, don't delete.** The clusters
below are delivered, tested feature surface that had no in-repo
consumer. They left the ROOT barrel (`src/index.ts`); the MODULES AND
THEIR TESTS REMAIN IN THE TREE AND KEEP RUNNING in every vitest pass,
so the code cannot rot silently.

## Read this before citing anything below as "not shipped"

**Leaving the root barrel is not leaving the API.** `@g3t/core`
publishes thirteen subpaths, and a symbol dropped from `src/index.ts`
is still public if any subpath barrel exports it. This document said
"they no longer ship in dist or appear in the API", and that was wrong
for most of the list: 27 of the 38 symbols shipped from a subpath,
including every symbol in the middleware, SHACL-report,
pipeline-registry and incremental-layout clusters.

**Withdrawal round, 2026-08-15 (maintainer ruling).** Of those 27,
**14 were withdrawn** and 13 kept. The 14 were the ones named in NO
adopter document and used nowhere in this repository. The 13 kept are
load-bearing prose: `RestAdapter`, `GremlinAdapter`, `bearerAuth` and
`apiKeyHeader` appear in README.md and SECURITY.md's credentials
section, `parseShaclReport` in ARCHITECTURE.md and the wiring guide,
and the incremental-layout trio in `docs/capabilities-and-limits.md`,
which lists it as **Shipped** with its import path. Withdrawing those
would have broken documented promises.

`RetryExhaustedError` left with `retryOnError` rather than on its own
merits: it is that middleware's error type, and an error nothing
reachable can throw is dead surface. It is the one row here that was
never part of the 2026-07-12 ruling.

Current count: **13 ship, 26 absent**, of 39 tracked symbols.

That is not a defect in the ruling, which was about the root barrel and
about not deleting code. It is a defect in how this document described
the result, and the description is what changed.

The table now carries a status per symbol.
`scripts/check-archive-accuracy.mjs` (wired into `verify`)
cross-references every row against `api-surface.json` and fails the
build when the two disagree, in both directions: a row marked ABSENT
that ships, and a row marked SHIPS that no longer does. Re-exporting an
archived symbol is a fine thing to do deliberately; leaving this file
claiming otherwise is what the gate prevents.

**Restore procedure:** re-add the symbol to `src/index.ts`, regenerate
`api-surface.json` with `node scripts/check-api-surface.mjs --update`,
and run `node scripts/check-archive-accuracy.mjs`, which will tell you
which row to update. Nothing else is required; no files moved.

## Status by symbol

| Symbol                           | Cluster | Status | Exported from                 |
| -------------------------------- | --- | ------ | ----------------------------- |
| `GremlinAdapter`                 | T2a | SHIPS  | @g3t/core/adapters            |
| `RestAdapter`                    | T2a | SHIPS  | @g3t/core, @g3t/core/adapters |
| `composeMiddleware`              | T2a | SHIPS  | @g3t/core/middleware          |
| `defaultFetch`                   | T2a | ABSENT | -                             |
| `bearerAuth`                     | T2a | SHIPS  | @g3t/core/middleware          |
| `apiKeyHeader`                   | T2a | SHIPS  | @g3t/core/middleware          |
| `retryOnError`                   | T2a | ABSENT | -                             |
| `requestLogger`                  | T2a | ABSENT | -                             |
| `parseShaclReport`               | T2b | SHIPS  | @g3t/core/shacl               |
| `resultsForShape`                | T2b | ABSENT | -                             |
| `resultTargets`                  | T2b | ABSENT | -                             |
| `resultsForFocusNode`            | T2b | ABSENT | -                             |
| `extractProvOProperties`         | T2c | ABSENT | -                             |
| `PROVO_MAPPINGS`                 | T2c | ABSENT | -                             |
| `literalCollapse`                | T2c | SHIPS  | @g3t/core/projection          |
| `blankNodeCollapse`              | T2c | SHIPS  | @g3t/core/projection          |
| `listCollapse`                   | T2c | SHIPS  | @g3t/core/projection          |
| `reificationCollapse`            | T2c | SHIPS  | @g3t/core/projection          |
| `overlayFromDocument`            | T2c | ABSENT | -                             |
| `PipelineRegistry`               | T2d | ABSENT | -                             |
| `createCountByProperty`          | T2d | ABSENT | -                             |
| `createEdgeTypeBreakdown`        | T2d | ABSENT | -                             |
| `createActivityTimeline`         | T2d | ABSENT | -                             |
| `createCommunityBreakdown`       | T2d | ABSENT | -                             |
| `IncrementalLayout`              | T2e | SHIPS  | @g3t/core/layout              |
| `applyIncrementalLayout`         | T2e | SHIPS  | @g3t/core/layout              |
| `computeIncrementalUpdate`       | T2e | SHIPS  | @g3t/core/layout              |
| `ingestEdgeAlgorithmResults`     | T2e | ABSENT | -                             |
| `parseStyleConfig`               | T2f | ABSENT | -                             |
| `serializeStyleConfig`           | T2f | ABSENT | -                             |
| `STYLE_CONFIG_SCHEMA`            | T2f | ABSENT | -                             |
| `serializeOverrides`             | T2f | ABSENT | -                             |
| `deserializeOverrides`           | T2f | ABSENT | -                             |
| `TypeMenuProvider`               | T2f | ABSENT | -                             |
| `createDefaultTypeMenuProvider`  | T2f | ABSENT | -                             |
| `checkRenderPermission`          | T2f | ABSENT | -                             |
| `unpinAll`                       | T2f | ABSENT | -                             |
| `DARK_TOKENS`                    | T2f | ABSENT | -                             |
| `RetryExhaustedError`            | T2a | ABSENT | -                             |

Clusters, for the names used above:

| Tag | Cluster |
| --- | ------- |
| T2a | Gremlin/REST adapters + HTTP middleware |
| T2b | SHACL report tooling |
| T2c | PROV-O extraction + RDF collapse transforms |
| T2d | Pipeline registry + chart pipeline creators |
| T2e | Incremental layout suite |
| T2f | Style-config JSON + overrides + type menu + misc |

Context: the analysis that produced the original table (methods, byte
costs, the rejected-exemption discussion) is
`planning/g3l/dead-code-analysis.md`. Type-only exports associated with
these clusters remain exported: types cost zero dist bytes and removing
them breaks consumers disproportionately.
