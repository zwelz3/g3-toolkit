# Archived public surface

Owner ruling (2026-07-12): **archive, don't delete.** The clusters
below are delivered, tested feature surface that had no in-repo
consumer. They left the public barrel (`src/index.ts`), so they no
longer ship in dist or appear in the API; the MODULES AND THEIR
TESTS REMAIN IN THE TREE AND KEEP RUNNING in every vitest pass, so
the code cannot rot silently.

**Restore procedure:** re-add the symbols to `src/index.ts` (the
archived export lists are reproduced below verbatim) and note the
restoration here. Nothing else is required; no files moved.

| Cluster | Symbols |
| --- | --- |
| T2a Gremlin/REST adapters + HTTP middleware | GremlinAdapter, RestAdapter, composeMiddleware, defaultFetch, bearerAuth, apiKeyHeader, retryOnError, requestLogger |
| T2b SHACL report tooling | parseShaclReport, resultsForShape, resultTargets, resultsForFocusNode |
| T2c PROV-O extraction + RDF collapse transforms | extractProvOProperties, PROVO_MAPPINGS, literalCollapse, blankNodeCollapse, listCollapse, reificationCollapse, overlayFromDocument |
| T2d Pipeline registry + chart pipeline creators | PipelineRegistry, createCountByProperty, createEdgeTypeBreakdown, createActivityTimeline, createCommunityBreakdown |
| T2e Incremental layout suite | IncrementalLayout, applyIncrementalLayout, computeIncrementalUpdate, ingestEdgeAlgorithmResults |
| T2f Style-config JSON + overrides + type menu + misc | parseStyleConfig, serializeStyleConfig, STYLE_CONFIG_SCHEMA, serializeOverrides, deserializeOverrides, TypeMenuProvider, createDefaultTypeMenuProvider, checkRenderPermission, unpinAll, DARK_TOKENS |

Context: the analysis that produced the table (methods, byte costs,
the rejected-exemption discussion) is
`planning/g3l/dead-code-analysis.md`. Type-only exports associated
with these clusters remain exported: types cost zero dist bytes and
removing them breaks consumers disproportionately.
