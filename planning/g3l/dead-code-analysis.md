# Dead-code analysis (2026-07-11, commissioned by owner)

## Method

1. Module reachability: esbuild metafile over every package entry
   (main barrel + all subpath exports per package.json), diffed
   against the full src tree.
2. Export usage: every VALUE export of the core and react barrels
   cross-referenced (word-boundary) against all in-repo consumers
   (the sibling packages, src/demo, examples, tests, e2e).
3. Dist composition: per-chunk byte ranking of the built dist; per
   dependency, consumer identification; comment/whitespace share
   measured directly.
4. Test coverage per removal candidate (a tested feature is
   MAINTAINED surface, not dead code).

## Headline findings

- ZERO orphan modules. Every src file is reachable from an entry
  (the three apparent orphans are type-only modules erased at
  compile). The tree is clean at file level.
- Heavy dependencies are all load-bearing and all EXTERNAL to dist
  (they never counted against the budgets): graphology is the UGM
  backing store, dagre backs the live sidebar layout option
  (screenshot-pinned), expr-eval backs the derived-property engine.
- The budgets measure OUR unminified dist bytes; comments were ~14%
  of them and are not consumer surface.
- Near-zero true dead code. What exists instead is UNREFERENCED
  PUBLIC SURFACE: delivered, tested milestone features that no
  in-repo consumer exercises. Removing those is an ownership ruling
  about API scope, not a cleanup.

## Actions taken this round (no functionality change)

| Lever | Effect |
| --- | --- |
| Dist comment-stripping pass (vite configs; sourcemaps still ship; code layout preserved) | core -25.0 KB, react -19.0 KB, charts +0.4 KB |
| T1 barrel hygiene: 20 internal helpers demoted from the core barrel (no consumer outside core; their tests import relatively and still pass) | core -5.0 KB |
| **Totals** | **core 177.6 -> 147.6 KB (97% -> 80% of budget); react 416.8 -> 397.8 KB (99% -> 95%)** |

Demoted (grep `DEMOTED FROM THE PUBLIC BARREL` in core/src/index.ts
for the list in place): text sizing, ELK graph assembly, QLT metric
internals, SHACL row formatting, RDF term utilities, sketch-capture
helpers.

## T2: unreferenced-but-tested feature surface (RULING REQUESTED)

Each cluster below is delivered M-phase scope with passing tests and
zero in-repo consumers. Removal would recover the listed bytes and
delete the feature and its tests. Per-cluster ruling requested;
none removed without one.

| Cluster | Exports | Est. recovery |
| --- | --- | --- |
| T2a Gremlin/REST adapters + HTTP middleware suite | GremlinAdapter, RestAdapter, composeMiddleware, defaultFetch, bearerAuth, apiKeyHeader, retryOnError, requestLogger | ~8.0 KB |
| T2f Style-config JSON + overrides + type menu + misc | parseStyleConfig, serializeStyleConfig, STYLE_CONFIG_SCHEMA, serializeOverrides, deserializeOverrides, TypeMenuProvider, createDefaultTypeMenuProvider, checkRenderPermission, unpinAll, DARK_TOKENS | ~7.8 KB |
| T2d Pipeline registry + chart pipeline creators | PipelineRegistry, createCountByProperty, createEdgeTypeBreakdown, createActivityTimeline, createCommunityBreakdown | ~3.5 KB |
| T2e Incremental layout suite | IncrementalLayout, applyIncrementalLayout, computeIncrementalUpdate, ingestEdgeAlgorithmResults | ~3.1 KB |
| T2c PROV-O extraction + RDF collapse transforms | extractProvOProperties, PROVO_MAPPINGS, literalCollapse, blankNodeCollapse, listCollapse, reificationCollapse, overlayFromDocument | ~1.3 KB |
| T2b SHACL report tooling | parseShaclReport, resultsForShape, resultTargets, resultsForFocusNode | ~0.5 KB |

Notes for the ruling: T2c and T2b sit close to the owner's semantic
web practice and the biomedical/ontology demos' future direction;
recommending KEEP regardless of bytes. T2e overlaps WS-D's internal
layout engine plans; recommending DEFER to the WS-D design. T2a and
T2f are the real candidates by bytes.

## Standing recommendation unchanged

WS-D still lands as the @g3t/layout extraction (ARC-009), taking the
router and layout machinery out of core; the budgets return to their
original envelopes at that point. Nothing in this round substitutes
for that.

## Backlog potential (recorded 2026-07-11, not scheduled)

**Split budget line for the semantic-web surface.** Rather than
exempting the SHACL/PROV-O clusters from the budget (rejected: an
exemption stops the gate from reporting real consumer cost), give
them their own line: classify dist chunks by name (shacl-*,
projection-*; ~20 KB of core today) into "core-general" and
"core-semantic" with separate ceilings in check-bundle-size.mjs.
Both numbers stay true; semantic-surface growth trips its own gate
instead of eating general headroom. If adopted, it is also the cheap
reversible precursor to a real module boundary (@g3t/core/semantic
subpath or @g3t/semantic package), which should ride with the
WS-D/ARC-009 packaging reshuffle rather than happen independently.
