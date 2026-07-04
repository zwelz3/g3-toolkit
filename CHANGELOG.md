# Changelog

- CI-first-push failures: one .gitignore class, one pnpm forwarding quirk. (1) The typecheck failure (CoverageMeter missing in CI, present locally) traced to any-depth .gitignore artifact rules swallowing SOURCE: a bare `coverage/` excluded packages/react/src/views/coverage from the push entirely. A git check-ignore audit over the whole tree found four casualties of the class: the coverage view (CI typecheck), tests/dist/public-api.test.ts (would have failed CI verify two stages later, and is very plausibly the ORIGINAL mechanism behind the pre-P0 loss of that directory that killed verify for weeks), scripts/storybook-static/ (a source module with its own smoke test, silently absent and silently untested), and, once the rules were fixed, Prettier flagged the coverage files for the first time ever because it honors .gitignore too: the format gate had never actually seen them. All artifact rules are now root-anchored (/dist/, /coverage/, /build/, /results/, /storybook-static/) with the incident documented inline; the re-audit reports zero source casualties, and explicit deeper artifact paths (packages/*/dist, scripts/visual-acceptance/dist) remain. MAINTAINER ACTION after pulling: `git add -A` now picks up the previously invisible source; expect the diff to include the four paths above. (2) The e2e "No tests found" failure: pnpm forwards arguments verbatim (the `--` separator is npm's convention), so `pnpm run test:e2e -- --ignore-snapshots` handed playwright a literal `--` and it parsed the flag as a test-file regex matching nothing. The snapshot policy now lives entirely in playwright.config.ts (ignoreSnapshots opt-in via PW_SNAPSHOTS everywhere until Linux baselines are committed, with the enablement flip documented at the line), and ci.yml runs plain `pnpm run test:e2e` with a comment warning against reintroducing dash-dash forwarding.

- Windows gate compatibility (maintainer's first Windows `pnpm run gates` run). (1) verify:smoke failed on all 21 subpaths with "protocol 'c:'": scripts/smoke-test.mjs passed raw absolute paths to dynamic import(), which the ESM loader accepts on Linux (why CI and the sandbox never caught it) but rejects on Windows, where absolute paths must be file:// URLs; fixed with pathToFileURL, the canonical cross-platform form (the reconstructed tests/dist suite already used it; the sweep found no other bare dynamic imports in the gate chain). (2) Preemptive fix one stage ahead of the failure: gates:spec invoked `python3`, which Windows Python installs and pixi's conda env on win-64 do not put on PATH; switched to `python`, matching ci.yml, pixi's own tasks, and the pixi-pinned interpreter (>=3.11), so the gates command now names the same interpreter everywhere it runs. Verified green on Linux; the Windows re-run is the maintainer's confirmation.

- P2.1 (scale story): Approach 1 of the approved large-graph design (planning/large-graph-design.md, 2026-05-24) is now IMPLEMENTED, not just designed. @g3t/core gains collapseByCluster (Louvain via the new graphology-communities-louvain dependency, externalized so the core bundle is unaffected, or a pre-computed clusterProperty; supernodes carry memberCount/typeBreakdown/label; inter-cluster edges aggregate into weighted cluster-links; a maxSupernodes ceiling pools the smallest communities) and buildSubgraph (drill-in: the induced member subgraph, working-set capped with a truncated flag). UGM's graphology instance stays private; detection builds a throwaway graph from the public API. Nine core tests cover invariants (every node partitioned exactly once, honest labels, determinism under a seeded rng, property-driven exact recovery, ceiling pooling, weighted links, induced-only drill edges, cap+truncation) plus an 8,000-node budget test with catastrophic-regression ceilings. The demo path: a "Scale" capability surface on the playground landing generates a seeded 8,000-node planted-partition graph in-browser, collapses it live (the header shows the real measured generate and clustering times), renders supernodes SIZED by memberCount through the sequential size channel, and drills in from the rail or by selecting a supernode on the canvas. One test correction worth recording: the first drill assertion assumed Louvain recovers the planted partition exactly; it absorbed two bridge-heavy nodes across a boundary (202 vs 200), so the contract asserts rail-count/canvas-count agreement, which is the actual wiring invariant. The wiring guide gains a Scaling section with a CI-executed twin; the design record is annotated (Approach 1 implemented; Approach 4, worker layout + viewport culling, remains designed-only). Rendering performance at scale is browser-verified territory: the surface exists precisely so the maintainer and adopters can judge it live.

- P2.2 (motion slice): a usePrefersReducedMotion hook (matchMedia-backed, live-tracking, jsdom-safe) now feeds animate={!reducedMotion} on every canvas across the four shells and the scale surface; hook behavior is matchMedia-mock tested and the ThreadShell contract test pins the animate wiring. Scoping honesty: the deeper keyboard/ARIA audit (tree semantics, focus order) remains browser-verified follow-up work; the shells' controls are native buttons/inputs and labeled (asserted throughout the contract tests), but completeness is not claimed. Lint caught three defects in the new surface before they shipped, including the same setState-in-effect pattern eliminated from the shells in P0 (store reactions now live in the subscription callback, where they belong).

- P2.4 (npm package pages): all three per-package READMEs already existed with install blocks and typecheck-gated examples (they are in the verify:snippets list), so the item closes as verified-existing plus one addition each: a live-links strip (playground, Storybook, wiring guide) that npmjs.com will render at the top of every package page, none of which linked anywhere live before.

- Spec corpus review (CI findings plus a full pass). (1) The `gap` annotation key is now recognized by lint_specs.py: D15's use of it (recording that camera preservation is implemented for the structural path only) is exactly the honesty marker the corpus should keep, and the key's meaning is documented in the linter (a graduating gap should become a roadmap-owned requirement). (2) The R1.2 drift had two phantom-evidence sources, both self-inflicted by recent rounds: the vendored-CSS sync test landed a colocated test file in the timeline directory (upgrading TimelineView's citation under the colocated heuristic while verifying a cross-cutting aspect), and the MBSE fixture's reqId fields (R1 through R1.4 as satellite-model DATA in an already-tested directory) were earning implemented-grade credit for the whole class. Fixes at both roots: EXCLUDE_LINE now drops reqId fixture lines from citation collection, and R1.2 joins CAPS as the fourth aspect-test cap (policy count updated; the six-cap retirement threshold for the colocated heuristic is two away), since its acceptance (scrubbing, animation, canvas filtered by temporal range) is genuinely unmet, consistent with R2.10's playback cap. Status distribution unchanged after both fixes (46 implemented / 12 in-progress / 18 proposed), confirming no other requirement was leaning on the phantom class and (via the bidirectional drift check) that the flagship/standalone retirements orphaned no statuses. (3) Two honest citations added where recent work earned them: box-selection-sync cites R2.8 (the lasso leg of multi-select, which sat at implemented through the whole period the lasso was broken in browsers because tagging/grouping citations carried the status; the leg now has real test evidence) and ProvenanceTrace cites R1.11's provenance-chain acceptance leg. (4) Meta-fix: these findings reached the maintainer through CI because `pnpm run gates` mirrored only the build gates; it now chains gates:spec (lint_specs, sync_spec_status, check_roadmap_coverage), making the CI-parity claim true. All stages verified green with UNPIPED exit codes (the first local reproduction piped through tail and read the pager's exit status; the repo's own gate discipline exists for a reason).

- P1 (curated adoption path) executed; five items, each gate-verified headlessly. P1.1: README gains a "See it running" block (Pages playground, Storybook, API reference, docs landing) and the docs landing already routes there; link RESOLUTION awaits the maintainer's push and a one-time Pages enablement (source: GitHub Actions), since the deploy workflow exists but the live site could not be confirmed from this sandbox (API rate-limited). P1.2: the README quickstart was already typecheck-gated by verify:snippets (the v1.0.0-rc audit's mechanism); it now also RUNS: examples/wiring/src/readme-quickstart.test.tsx mounts the snippet VERBATIM against a stubbed SPARQL endpoint (SparqlAdapter's real parsing executes) with the real CytoscapeCanvas over the module-level cytoscape mock, and the README states the double gating. P1.3: CapabilityCallout items gained wiring-guide deep links (GitHub blob anchors, which resolve on push with well-defined slug rules; the Pages typedoc rendering has its own slugging and unconfirmed liveness); 14 mechanisms across the four shells now link to the guide section carrying their runnable snippet, demo-local helpers deliberately unlinked (linking a shell's own projection function would misattribute it as toolkit surface); the guide gained a "Render a provenance trace" recipe (CI-executed twin) because ProvenanceTrace had no section to link to. P1.4: the decision dashboards are reachable everywhere: the playground landing gained a "Capability surfaces" section routing to thin back-bar wrappers around the imported AnalyticsDashboard and SchemaDashboard (so the deployed playground carries them too), with landing tests plus a Demo routing integration test (landing -> dashboard -> back); full-workspace documented in the README as the deliberate source-reference example per ruling D2. P1.5: the supply-chain shell mounts Minimap fed by the canvas onReady core (floating with explicit stacking, the lesson from the bio toggle), contract-tested via the placeholder path plus onReady presence, with a Minimap note added to the guide's camera section and a wiring twin for the placeholder.

- Box (lasso) selection sync: root cause found one level below the gesture, fixed, and headless-tested. The Shift-modified drag still selected zero because the store sync itself has NEVER worked with the installed cytoscape: 3.33.4's mouseup handler emits `boxend` BEFORE applying the box's selection (`cy.emit('boxend')` precedes `box.emit('box')...select().emit('boxselect')`, verified in the installed renderer source), so the old handler's `cy.nodes(":selected")` read inside `boxend` saw the pre-box state: empty on the first gesture, and the PREVIOUS gesture's leftover set on every later one (the old handler was the only thing clearing `:selected`). Maintainer field report confirmed the general symptom: selection rendered one lasso operation behind, with the newest set queued. The regression suite now reproduces exactly that lag against the old logic and proves the new sync delivers each gesture's own set with nothing queued. jsdom tests bypass the renderer's gesture pipeline, so only live browser use could catch it. Fix: the sync no longer depends on `:selected` read timing at all; extracted to packages/react/src/views/canvas/box-selection-sync.ts, it collects the per-element `box` events (emitted for every boxed element) and flushes once on a microtask, after cytoscape's synchronous select pass, clearing cytoscape's internal `:selected` to preserve the class-based highlighting doctrine. Headless verification against a REAL cytoscape core replays the exact 3.33.4 emit order: four tests including one that proves the old `boxend` read receives an empty list under that order. Comments and docs that asserted the boxend doctrine (CytoscapeCanvas init note, coverage-gaps doctrine test comment, the Coordinated Selection story, the wiring-guide gesture section) updated to describe the real mechanism. The gesture-to-store pipeline end to end remains browser-verified only; the maintainer's next Playwright run is the final validation.

- Lasso (box) selection: gesture diagnosed, test fixed, capability made discoverable. The maintainer's run was down to one failure (lasso selecting zero nodes, deterministic across retries) and manual attempts in the dev server and Storybook found no way to exercise lasso at all. Root cause, verified against the installed cytoscape 3.33.4 renderer source rather than docs: with panning and box selection both enabled (the canvas default), a plain background drag PANS; box mode engages only while a multi-select modifier is held (`multSelKeyDown || !panningEnabled || !userPanningEnabled`, where the modifier is shift, ctrl, or meta). The feature works everywhere the canvas mounts (boxend reads cytoscape's :selected, clears it, and pushes into useSelectionStore; the store wiring was verified sound); it was gesture-gated behind an undocumented modifier. Fixes: the e2e test now holds Shift around the drag (with the renderer condition cited inline); the gesture is documented at every surface the maintainer searched: a visible caption in the Patterns/Coordinated Selection story, a hint line beside the harness selection readout, a "Box (lasso) selection: the gesture" section in the wiring guide (including the plain-drag alternative of disabling user panning), and the modifier semantics at the boxSelectionEnabled init site in CytoscapeCanvas for source readers. e2e change NOT executed here (browser downloads blocked); validation is the maintainer's next local run.

- e2e stabilization (from the maintainer's first real Playwright runs: 18 failures cold, 7 on rerun; test-results.json analyzed). The seven decomposed into four classes, each fixed at its root. (1) Screenshot pixel diffs (4 tests, 3-8% run-to-run on the SAME machine): the harness's initial layout was force-directed and nondeterministic; the harness canvas now uses cytoscape's grid layout with animation off, so positions are a pure function of the deterministic fixture. Architecturally the snapshot story was also backwards (CI ignores snapshots while local runs compared, and against baselines the repo never committed; the maintainer's run 1 wrote them, run 2 diffed against run 1): snapshot comparisons are now OFF locally by default (ignoreSnapshots unless CI or PW_SNAPSHOTS=1), and the snapshot path template gained a {platform} segment so an OS's baselines can never be compared against another's renders. Tolerance raised 1% -> 2% for same-platform anti-aliasing noise; contextOptions reducedMotion suppresses CSS transitions suite-wide. (2) Lasso selecting zero nodes: hardcoded drag coordinates met the nondeterministic layout; the drag box now derives from the canvas's live bounding box (near-full coverage), independent of layout. (3) The theme test waited on [data-testid='toolbar-theme'], which the harness never rendered (only UxSurface carries it): deterministic drift, not flake; the harness now mounts a minimal theme select wired to useThemeStore.setTheme. (4) The biomedical Raw-triples toggle was unclickable in a real browser: .bio-canvas-wrap's generic child rule stretched the canvas over the toggle and intercepted pointer events (jsdom's synthetic events bypass hit-testing, which is why the contract test alone missed it); the toggle now floats above the canvas with explicit stacking. Also: one local retry absorbs dev-server cold-start flake, webServer timeout 30s -> 120s (cold vite compile of the playground), and the JSON reporter is permanent (test-results.json, gitignored) for agent-round triage. NOT executed here (browser downloads blocked in this sandbox); validation is the maintainer's next local run.

- Repository URL ruling applied: github.com/zwelz3/g3-toolkit is canonical (maintainer-confirmed). The g3-toolkit-org URLs (404) replaced across the three package manifests (repository/homepage/bugs, which npm renders as the package front door) and all four NOTICE files. Maintainer note before pushing: delete any locally generated tests/e2e/__screenshots__ from the pre-{platform} runs; they are orphaned by the new template.

- Gates (P0.1, revival of a silently dead chain): `pnpm run gates` added, mirroring ci.yml exactly (typecheck, lint, verify, test); CLAUDE.md makes it the round-closing requirement. The revival exposed three rotted stages that the zip-handoff loop never ran: (1) verify:exports had lost its test sources (tests/dist was pruned by a packaging step that matched directories named dist; the received zip lacked it while package.json, vitest.dist.config.ts, and ci.yml all reference it); reconstructed from that documented contract as tests/dist/public-api.test.ts (exports-map targets exist on disk; built root entries re-export every source-barrel named export; subpath entries load). (2) verify:smoke then failed on a real adopter-facing defect: TimelineView imported vis-timeline's stylesheet from node_modules, and since vis-timeline is a build external the bare CSS import survived into dist/*.mjs, breaking plain-Node/SSR consumers (the WorkspaceShell/flexlayout precedent); fixed by vendoring the stylesheet as a local import extracted into the exported ./style.css, with a byte-compare sync test so a vis-timeline upgrade fails loudly, and NOTICE attribution. (3) verify:bundle then reported core 103% and react 120% of budget; sourcemap audit of the two largest chunks found zero node_modules bytes (the growth is the structural renderer and the encoding/toolbar surface, shipped deliberately while the gate was dead), so the budgets were raised with ledger entries per the script's own protocol (core 140 KB, react 384 KB, modest headroom).

- Flagship retirement (P0.2, maintainer ruling): examples/flagship (53 files) deleted after a fold audit (planning/flagship-retirement.md). Folds landed BEFORE deletion: CoverageMeter demonstrates in the decision-dashboards AnalyticsDashboard ("Origin coverage by tier", a real partial-coverage signal since the supply fixture leaves country genuinely undeclared on part of the network; pure helper originCoverageByTier plus a render contract test with the canvas stubbed); ProvenanceTrace demonstrates in the auditor shell ("Lineage of selection": pure chain builder src/demo/audit/chain.ts walking PROV-O out-edges, with unattributed entities bottoming out in an absence hop, the same fact the SHACL report flags; five pure tests plus a shell contract test); createCameraController, applyEncodingSpec, createTheme, findShortestPath, and exportSubgraphCsv/Json moved to a new wiring-guide "Programmatic APIs" section mirrored by CI-executed tests. FilterBuilder, GraphToolbar, LayoutSwitcher, SearchBar, and NodeStyleEditor already had Storybook coverage; the beat-runner narrative and capture-brief export were dropped per ruling D1 (recoverable from history). CoverageChart turned out to be flagship-local, not a package export; the plan's earlier claim is corrected in the matrix. Flagship planning docs archived under planning/archive/; the workspace lockfile refreshed for the removed member; package docstrings that pointed readers at the deleted example sanitized.

- Standalone demo retirement (P0.3, maintainer ruling D3): scripts/demo and scripts/thread-demo deleted with their vite configs, package scripts, docs:build copy steps, tsconfig/vitest globs, and Pages landing cards. The blocking fold landed first: the projection pipeline (createPresetPipeline, ProjectionPipeline, typeCollapse and friends) had its only demonstration in thread-demo and zero wiring-guide coverage despite being a README headline capability; it now has a wiring-guide "Projection pipeline (RDF to LPG)" section with CI-executed tests, and a live home in the biomedical shell: a Raw-triples/Projected canvas toggle (new pure rawTripleUgm; the caption lists the standard preset's step names straight from getSteps(), and the raw view is strictly larger, which the contract test pins). Minimap and the inspectors keep Storybook coverage; the richer Protege-style ontology viewer's extras die with thread-demo (recorded as optional P2.3 in the plan). Mobile preview relocates to the Pages playground, which docs:demo already deploys.

- e2e triage (P0.4): the vacuous "Demo scenario loading" tests (if-visible checks against Healthcare and Data Scientist cards removed in the overhaul) excised from capabilities.spec.ts; tests/e2e/shells.spec.ts added with one real smoke test per shipped shell (landing entry, canvas visible, one interaction: slider keypress, diagram switch, cluster mode, raw-triples toggle) plus screenshot hooks that gate once Linux baselines are committed. AUTHORED HEADLESSLY: this sandbox cannot download Playwright browsers; first execution is CI or a maintainer's local run.

- Doc truth (P0.5): STATUS.md header reconciled (it asserted all-green gates and 1011 tests from 2026-06-22 while the received zip was doubly red at lint and dead at verify); CLAUDE.md current-focus and flagship sections rewritten and the gate block now names `pnpm run gates`; the flagship-specific AGENT-ONBOARDING.md archived; README's flagship listings replaced with the retirement record; the Pages landing's github.com/graphistry links corrected to the live zwelz3/g3-toolkit repo (NOTE for maintainer: package.json still declares a g3-toolkit org URL that 404s; three-way URL divergence needs a ruling); the enhancement plan committed as planning/demo-adoption-plan.md with P0 marked executed.

- Gates (baseline restoration): the root typecheck and lint gates were both red; this round returns them to green with root-cause fixes. Typecheck (6 errors, 4 files): OntologyView.tsx imports the JSX type explicitly (the global namespace is gone under React 19 types); ThreadView.tsx coalesces indexed severity ranks under noUncheckedIndexedAccess; scripts/demo gains a vite-env.d.ts so the ?raw import resolves against vite/client; a structural-to-cytoscape test fixture narrows its port sides to PortSide via as const, matching its sibling fixtures. Lint (3 set-state-in-effect errors, none suppressed): CoverageMeter derives its at-target placement (grown || !animate) instead of writing state when animate is off, with rendering proven identical across mount and mid-flight flips (2 new tests); MbseShell derives its loading state from a stale-scene identity check (a scene laid out for a previous diagram reads as loading) instead of a synchronous reset; SupplyThreadShell computes cluster ingest and the encoding spec in one memo (spec was never state; it derives from mode), preserving the ingest-before-restyle ordering. Prettier drift in 32 files (never reached at baseline because eslint failed first in the && chain) reformatted with the repo-locked Prettier.

- Demo (headless contract tests): five new test files (+25 tests) close most of the "browser-verified only" gap for the four shells by stubbing CytoscapeCanvas to record its props and asserting the shell's side of the canvas contract. MbseShell: the canvas receives exactly projectDiagram's output laid out by the real ELK engine, and a diagram switch shows loading synchronously (a stale scene never renders). SupplyThreadShell: at the render that delivers the cluster-driven spec, every node already carries the materialized cluster property (the ordering guard; a decoupled ingest-in-effect would fail it). AuditShell: moving the window start delivers to the canvas hidden prop exactly the set hiddenForRange computes for that window, pinning the slider-to-graph wiring. BioShell: the default query renders bindings at mount, an invalid query surfaces the structured error and recovers, no crash. RangeSlider: thumb clamping in both directions, pass-through moves, fill geometry, ticks, and the max<=min degenerate case. Canvas pixels remain browser-verified; the wiring no longer is.

- Demo (adoptability narrative): every shell now carries a CapabilityCallout (src/demo/components), a closed-by-default details panel mapping each visible feature to the exact public mechanism behind it (layoutStructural and structural mode; encodingSpec over a materialized cluster property; the hidden prop; node-local SHACL; the selection and overlay stores) and naming the three integration channels with a pointer to docs/wiring-guide.md. The landing's MBSE card had regressed to describing the retired block-only demo ("opens in the block view", search/context-menu copy); it now sells the Cameo-style workbench that actually opens (containment tree, BDD/IBD/parametric/requirement projections). A new DemoLanding test pins card ids to the router's SHELL_MAP, tags, the corrected MBSE copy, and the select wiring.

- Demo (dead code): removed src/demo/fixtures entirely. healthcare.ts had no importers (resolving the open onboarding question); the Scenario.buildGraph field was consumed by nothing (every scenario routes to a dedicated shell), so it and its four model-builder imports left the landing, which made additional.ts (buildMBSEUGM) dead as well.

- Demo (auditor): reworked the auditor onto an explicit PROV-O provenance record (src/demo/audit). model.ts builds agents, activities, and entities with timestamps and derivation links as a UGM, materializing an `attributed` flag for a node-local SHACL orphan check, and seeds real audit defects (an approval with no generation time, an activity with no recorded end, a legacy spec with no provenance). shapes.ts holds the entity and activity shapes. timeline.ts is the pure core: provenanceEvents flattens the record into sorted events, hiddenForRange returns the node ids to hide for a [start, end] window (agents visible only while an activity is, timeless nodes never hidden), and provenanceReport groups SHACL results into violations and warnings. AuditShell.tsx wires these together: the provenance graph on the canvas, a SHACL report panel (violations and warnings, click to select, also registered as severity overlays), a provenance timeline table that dims out-of-window events, and a dual-range slider (RangeSlider.tsx, two thumbs on one tick-marked track) that filters both the timeline and the graph by feeding hiddenForRange into the canvas hidden prop, which closes the gap where the slider was not wired to the graph; its own compliance-ledger identity (item 5). 6 tests cover the events, bounds, range-to-hidden, and report. Retired the old AuditorMBSEDemo (the src/demo/shells directory is now empty) and repointed the landing preview and copy. Rendering and interaction are browser-verified.

- Demo (biomedical): reworked the biomedical example onto RDF (src/demo/bio). rdf.ts holds the ontology and instance triples (genes, proteins, diseases, drugs, pathways) as RDFTriple[] with numeric literals, plus rdfToUgm to project the instance data into a graph for the canvas. sparql.ts is a curated in-browser SPARQL SELECT executor: a tokenizer and recursive-descent parser for PREFIX, SELECT (DISTINCT)? with a variable list or *, a WHERE block of basic triple patterns (with the ; and , abbreviations and the a keyword), FILTER comparisons and regex, ORDER BY, and LIMIT, evaluated by nested-loop basic-graph-pattern join, returning bindings or a structured error. derive.ts turns a numeric result into linked chart data and summarizes the TBox (classes with subclass links and instance counts, object and data properties with domain/range inferred from usage). BioShell.tsx wires these together: the RDF graph on the canvas, a Protege-style ontology explorer (clicking a class selects its instances), and a SPARQL workbench with a query picker, an editor, a results table, a standing notice that this is a demo subset (bundle Comunica/Oxigraph or point SparqlAdapter at an endpoint for production), and a linked bar/scatter panel whose bars select the matching graph node; its own bio-informatics identity (item 5). 16 tests cover the executor, projection, and derivations. Retired the old BiomedicalDemo and repointed the landing preview and copy to the RDF graph. Rendering and interaction are browser-verified.

- Demo (supply chain): reworked the supply-chain example into a digital thread (src/demo/supply). model.ts consolidates five source systems (ERP bill of materials, supplier registry, certification registry, sourcing, logistics) into one UGM, tagging each node with its source and materializing two cross-source derived facts on every part (supplierCount and certificationStatus). analytics.ts provides gap analysis (sole-source parts and single-point-of-failure suppliers merged with SHACL findings into one report), clustering (by region, tier, or connected component), and downstream path tracing; shapes.ts holds two node-local SHACL shapes (certification coverage via an in-set check on the derived status, and supplier-record completeness); viz.ts adapts findings into severity overlays, a provenance summary, cluster members, and a path overlay. ThreadShell.tsx wires these to the graph: the color channel is driven by type or by a materialized cluster property (region/tier/component), gap findings register as always-on severity overlays, selecting a cluster highlights its members, and choosing a supplier traces and highlights its path to final assembly, with its own operations-console identity (item 5). 10 tests cover the derived facts, all three analytic families, SHACL validation, the merged gap report, and the viz adapters. Retired the old block-only SupplyChainDemo and repointed the landing preview to the thread graph. Graph rendering and interaction are browser-verified.

- Demo (MBSE): replaced the block-only MBSE example with a Cameo-style SysML workbench (src/demo/mbse). A containment tree (packages own model elements and diagrams) drives a linked graph view: selecting a diagram projects its typed view into a StructuralGraphInput for the structural renderer. Four projections are supported (BDD with value/operation compartments and composition; IBD with parts, ports, and port-to-port connectors; parametric with a port per parameter and binding connectors; requirement breakdown with containment and satisfy links). New files: model.ts (satellite fixture), diagrams.ts (pure projections; 10 tests including a layoutStructural smoke test per type), ContainmentTree.tsx (4 render tests), MbseShell.tsx, and a scoped blueprint-workbench stylesheet giving the shell a distinct identity (item 5). Retired the superseded MBSEDemo (removed ~393 lines plus its orphaned imports; AuditorDemo unaffected). Layout and rendering are browser-verified.

- Fix (structural perf): eliminated a Cytoscape mapping-warning flood in the structural block view. The base node/edge style rules mapped label, background-color, and shape through data() without field guards, so every structural sub-element that lacks those fields (containers, headers, toggles, rows, ports) threw mapping warnings on each render frame; the dev-mode console flood blocked the main thread and scaled with block count. Scoped the four mappings to [field] selectors (node[label], node[_color], node[_shape], edge[label]); UGM-encoded nodes still match, structural nodes no longer do. Regression test asserts the base rules carry no unguarded data() and the guarded rules exist.

- Docs: publish the standalone toolkit demo to docs-out/demo/ as part of docs:build (built via pnpm run demo, copied alongside the visual-acceptance walkthrough), with a discoverable card on the docs landing page.

- Demo: promoted the standalone toolkit demo (scripts/demo) to a managed, gated surface. Added it to the tsconfig and vitest include globs, fixed the coverage path (src/demo -> scripts/demo), added a CI build step (pnpm run demo) as a bundle/self-check gate, and landed acceptance tests: SHACL fixture validation and shape relations, k-paths enumeration, and a cytoscape-mocked component test for the validation report and the Hide-panel gating.

- Minimap: frame the overview to the union of the graph bounding box and the current viewport, so the viewed area (including white space around the graph) is captured and the viewport indicator no longer clips at the canvas edge when zoomed or panned out. Frame geometry extracted to a pure, tested `minimap-frame.ts` (computeMinimapFrame/projectToMinimap); `Transform` fields renamed bbX1/bbY1 -> frameX1/frameY1.

All notable changes to the g3-toolkit are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0-rc.2] - 2026-06-10

### views/coverage landed; coverage barrel resolved (2026-06-22)

- **Added** `packages/react/src/views/coverage/` (CoverageMeter,
  CoverageMeterList, CoverageState; 10 tests, strict typecheck clean). This
  resolves the dangling `export * from "./views/coverage"` in the
  `@g3t/react` barrel that had blocked the flagship's CoveragePanel and the
  demonstration-surface items DS1, DS3, and the DS2 chart sub-part.
- **Removed** the build-time coverage-stub workaround now that the real
  directory exists: the `g3t-coverage-stub` resolveId hooks in
  `vite.sb-client.config.ts`, `vitest.sb.config.ts`, and
  `vite.demo.config.ts`, plus `scripts/storybook-static/coverage-stub.ts`.
  Leaving the hooks would have shadowed the real component with the empty stub.


### Structural edge-routing render + Minimap + demo view-switch (2026-06-22)

- **Added** a Minimap component (`@g3t/react`, interaction/camera;
  Molecules/Minimap): a canvas overview with a draggable viewport rectangle
  that pans the main view on click/drag. Compound containers draw as one
  rectangle (not a dot per child row/port); edges route between top-level
  ancestors; an optional `nodeFilter` hides rendering-only nodes (the demo
  drops structural ports). Wired into the gallery and overlaid on the
  standalone demo in both views. Added `CameraController.panToPoint(x, y)`.
- **Landed** the obstacle-aware routing CONVERTER slice:
  `structural-to-cytoscape.ts` projects ELK route polylines onto
  `curve-style: segments` for body and synthetic-point-port edges, with the
  taxi as fallback when `routeEdges` is off or a route has no interior bend;
  declared-port edges keep the perpendicular taxi exit on purpose.
  Headless-landed; the rendered result ships for visual review (VA-31).
- **Added** the standalone demo's Graph/Structural view-switch with an ELK
  direction toggle (`scripts/demo`).
- All gate-green headlessly (test, lint, typecheck) against the partial
  sandbox baseline; rendered behaviour awaits Zach's live review.

### Flagship packaging + integration guide (2026-06-17): build section 4

- **Added** `examples/flagship/package.json` (private @g3t/flagship-example;
  declares the packages as workspace:* and carries @g3t/react's heavy peer
  deps so the published packages stay light), `tsconfig.json` (extends the
  base), and `INTEGRATION.md` (the sandbox-alias cleanup list, the
  module->toolkit-surface wiring map, the bundle-budget procedure, and the
  live-review checklist).
- Verified every direct flagship import is declared. The composition-first
  build (steps 1-6) is complete and packaged.

### Flagship interactive epilogue (2026-06-17): build step 6

- **Added** `examples/flagship/src/epilogue.ts` (epiloguePanels: the
  exploration controls, grounded in EPILOGUE_SURFACES) and
  `shell/EpilogueShell.tsx` (composes the existing GraphToolbar, SearchBar,
  FilterBuilder, LayoutSwitcher, AlgorithmPanel, NodeStyleEditor around the
  canvas; search/filter route to selection, tap opens the style editor).
- The panel spec is tested; EpilogueShell typechecks against transcribed
  signatures with the real EncodingSpec/LayoutEngine types. Its render is a
  live-review item. Completes the composition-first build (steps 1-6).

### Flagship brand theme + brief export + workspace (2026-06-17): build step 5

- **Added** `examples/flagship/src/theme.ts` (NORTHWIND_THEME via the
  toolkit's createTheme), `brief-export.ts` (the cited subgraph exported as
  Turtle/JSON/CSV via exportSubgraph*), and `workspace-snapshot.ts`
  (captureWorkspace/serializeWorkspace). The decision beat brands the
  toolkit; the brief beat takes the pursuit away as portable artifacts + a
  snapshot.
- 5 tests exercise the REAL toolkit functions (brand theme passes WCAG with
  no warning; the subgraph exports in three formats; the snapshot carries
  the encoding spec). Backs the s.theme / s.export / s.workspace credits.

### Flagship teaming + provenance path (2026-06-17): build step 4

- **Added** `examples/flagship/src/teaming.ts` (buildPartnerGraph +
  teamingNeighborhood: the partner subgraph pulled in and focused via the
  toolkit's buildNeighborhoodUGM) and `provenance-path.ts`
  (evidencePathForConcept via the toolkit's findShortestPath, for the drill
  overlay).
- 7 tests exercise the REAL toolkit graph functions: ORCA's neighborhood
  reaches the gap concept within 2 hops; the concept->evidence path is
  found with edge ids for highlighting. Backs the s.neighbors / s.path
  beat credits.

### Flagship DetailInspector wiring (2026-06-17): build step 3 complete

- **Added** `shell/InspectorPanel.tsx` (the toolkit's DetailInspector over
  the meaning UGM) and stage helpers `drillTargetForBeat` /
  `inspectorSelectionForBeat`. FlagshipShell now annotates and exposes the
  meaning UGM, gates the inspector from the two-weaknesses beat, and drives
  its selection from the active drill node.
- Fully headless-verified (DetailInspector is React-only): render tests
  confirm the inspector shows a concept's analytic attributes (state,
  coverage). Engine 73, react 55, eight tsc configs clean.

### Flagship LinkedChart integration (2026-06-17)

- **Added** `examples/flagship/src/coverage-pipeline.ts`: a real
  DataPipeline driving the toolkit's existing ECharts LinkedChart in
  scatter mode (each required concept a point at substantiated x claimable,
  with a y=x honesty diagonal; points above the line are exposed). query()
  reads both strengths from the meaning UGM; reverseMap() links a clicked
  point back to concept selection. `shell/CoverageChart.tsx` is the thin
  wrapper. `annotateForEncoding` now writes the coverage strengths onto nodes.
- 3 pipeline tests verify the rendered data and the selection mapping; the
  pipeline typechecks against the real DataPipeline/ScatterData types.

### Flagship real stage wiring (2026-06-17)

- **Added** `examples/flagship/src/stage.ts` (pure stage director: which
  EncodingSpec and layout per beat; the raw->meaning spec swap is restyle-
  only on one stable layout), `camera-directives.ts` (maps a beat's
  CameraDirective to the camera controller), and `shell/StageCanvas.tsx`
  (the real stage: CytoscapeCanvas + per-beat spec + camera + highlight).
- 9 headless tests cover the director (swap happens once, at
  consolidate->project) and the camera applier (every directive maps).
  StageCanvas typechecks against the real camera/encoding types; its live
  render is the browser-review artifact.

### Flagship per-beat toolkit credits (2026-06-17)

- **Added** `examples/flagship/src/toolkit-credits.ts`: a registry of the
  19 toolkit surfaces the demo composes, and a `toolkit: string[]` field on
  every beat naming the components it wires together. `shell/ToolkitCredits`
  renders the on-screen "Powered by" credit per beat.
- 23 grounding tests scan the real `@g3t/react` / `@g3t/core` / `@g3t/charts`
  sources and assert every credited name is a genuine export, so a credit
  cannot drift into fiction. The walkthrough is verified to span >=10
  distinct surfaces and to be mostly existing toolkit (<=3 demo-built).

### Flagship stage encoding (2026-06-17): the toolkit owns the visual logic

- **Added** `examples/flagship/src/encoding.ts`: RAW and MEANING
  `EncodingSpec`s plus `annotateForEncoding`. The stage's visual meaning is
  produced by the toolkit's shipped encoding system (node size <-
  substantiated, color <- the three states, shape <- type; edge color <-
  supports/contests, width <- weight), not by bespoke drawing. The Act I->II
  transition is a spec swap (restyle-only) on the same layout.
- 9 tests resolve the specs against the real meaning UGM with the toolkit's
  `applyEncodingSpec` and assert the produced color/size/shape/edge mapping;
  proof that the toolkit, not the demo, owns the stage.
- Part of the Option 1 (composition-first) redesign:
  `planning/flagship-plan-option1-redesign.md` supersedes plan §2-3, making
  each beat exercise a named existing toolkit surface.

### Flagship cinematic shell, started (2026-06-17): composition + panels + transport

- **Added** `examples/flagship/src/shell/`: the slot-based cinematic shell.
  FlagshipShell composes the real engine, the real toolkit components
  (CoverageMeter, ProvenanceTrace), and the beat-runner into a narrated
  walkthrough with a transport (play/pause, prev/next, replay, scrub). The
  graph stage is a `renderStage` slot; production fills it with
  CytoscapeCanvas + the camera controller. Sub-components: NarrationBar,
  Transport, CoveragePanel, BriefPanel (two faces), ProvenancePanel.
- 9 jsdom tests cover panel gating, transport, the stage slot's beat
  props, and drill wiring. A self-contained visual-acceptance page renders
  the real shell with a real-data SVG stage stand-in (`scripts/shell-va`).
- Not yet: the real CytoscapeCanvas stage + camera wiring, the Act I->II
  cross-fade (§2b), and the branded theme (§2e); these are the live-review
  items (see the acceptance ledger).

### Flagship narrative beat-runner (2026-06-17): the §2f transport

- **Added** `examples/flagship/src/narrative.ts`: the ten walkthrough
  beats as declarative data (act, narration, op, camera directive,
  encoding layer, highlights) plus a pure, total transport reducer
  (play/pause/toggle, next/prev, goTo, replay, tick) with selectors. No
  React/Cytoscape/toolkit dependency; the shell maps each beat's camera
  directive onto `createCameraController`. 10 tests, including an
  integrity check that every beat id resolves against the engine corpus.

### Camera controller (2026-06-17): programmatic viewport moves

- **Added** `createCameraController(cy)` to `@g3t/react`
  (`interaction/camera`): a thin wrapper around `cy.animate`/`cy.fit`/
  `cy.center` exposing `focusNodes` (zoom-to-subgraph), `panToNode`
  (center without zooming), `frameAll`, and `resetView`, with per-call
  and controller-level padding/duration/easing. Reduced motion is the
  caller's decision via the `animate` option; duration 0 or animate:false
  applies instantly. Reachable via `CytoscapeCanvas` `onReady(cy)`. 12
  tests (spied cy mock). Same bundle-budget note as the other §2
  components (see the acceptance ledger).

### ProvenanceTrace (2026-06-17): drill-anywhere provenance panel

- **Added** `ProvenanceTrace` to `@g3t/react` (`views/provenance`): renders
  an ordered provenance chain (depth-indented, each hop clickable) from a
  derived conclusion to the raw evidence at the leaf, or to the documented
  ABSENCE of evidence for an exposed/gap concept. Presentational and
  reusable for any provenance-bearing graph. 7 render tests (jsdom).
- **Added** a flagship provenance builder (`examples/flagship/src/
  provenance.ts`): a generic `buildProvenanceChain` walker (cycle and size
  guards) plus a `traceProvenance` adapter over the live engine artifacts.
  8 tests against the real engine.
- A self-contained visual-acceptance page with a drill-target picker
  (`scripts/provenance-va`).
- Same bundle-budget note as CoverageMeter: re-measure and bump the
  `@g3t/react` budget on landing (see the acceptance ledger).

### CoverageMeter (2026-06-17): two-strength coverage visualization

- **Added** `CoverageMeter` and `CoverageMeterList` to `@g3t/react`
  (`views/coverage`): a solid substantiated bar behind a ghost claimable
  bar, with the exposure delta drawn as a hatched band. Per-state accent
  (discriminator / exposed / gap / neutral). Presentational and
  dependency-light (React only); the consumer decides reduced-motion via
  the `animate` prop. Props align to the flagship `ConceptRelevance`
  shape but the component is generic target-vs-actual. 10 render-level
  tests (jsdom).
- A self-contained visual-acceptance page renders the real component from
  the real flagship engine output (`scripts/coverage-va`).
- NOTE for landing: the `@g3t/react` bundle budget had roughly 1.6 KB of
  headroom (about 302.4 of 304.0 KB). Adding this component requires
  re-measuring the bundle and bumping the react budget in
  `scripts/check-bundle-size.mjs` with a ledger entry. The delta is not
  measured in the build sandbox.

### Flagship two-strength engine (2026-06-17): substantiated vs. claimable

- **Added** a two-strength meaning model to the flagship example
  (`examples/flagship`). Each concept now carries `_substantiated` (the
  defensible bid floor: the prior single strength, unchanged) and
  `_claimable` (the proposal ceiling: substantiating efforts counted
  positively, plus adjacency reach and resume self-assertion). The
  per-concept gap between them is the exposure. Claimable is greater than
  or equal to substantiated by construction.
- **Added** the three honest states per required concept (discriminator,
  exposed, gap), an analytic that reports both a substantiated fit and a
  claimable fit, `traceTeaming` (surfaces a named partner with
  co-delivered evaluated converting evidence for each exposed or gapped
  concept), and a two-faced capture brief (internal truth vs. proposal
  story), every line provenance-bearing.
- **Added** ORCA Systems as a teaming partner and the TIDEGUARD joint
  past performance to the corpus; co-delivered work is surfaced only via
  teaming, never folded into the firm's solo strength.
- **Changed** `deriveActions` to team with a named partner (not a generic
  string) and to source discriminators from the two-strength state.
- **Removed** the single `_strength` concept property; consumers and
  tests move to `_substantiated` / `_claimable`.
- Worked example is unchanged in its headline: substantiated fit 68%,
  pursue-with-teaming. It now also reports claimable fit 94%, classifies
  Sustainment as exposed and Cyber Resilience as a gap, and closes both
  through ORCA. Pipeline logic tests go from 9 to 18.

### Mapping-warning sweep (2026-06-17): _confidence flood + invalid outline-offset

- **Fixed** a second per-frame Cytoscape mapping-warning flood in the block
  view: the base `edge` rule mapped `opacity` to `data(_confidence)`, which
  warned for every structural connector (no `_confidence`) on every render
  frame. The mapping is now scoped to an `edge[_confidence]` rule. Same
  class of fix as the `data(_size)` one.
- **Fixed** an invalid `outline-offset: -2` on the selected structural-row
  rule. Cytoscape rejects negative `outline-offset` and discarded it at
  parse time (a one-time warning), so the intended inset selection ring
  never rendered. The inert override is removed; the row keeps its z-lift.
  A true inset (a theme-driven border, so a selected child does not grow
  the compound container into its ports) is a follow-up.

### Block-view lag fix (2026-06-17): data(_size) mapping-warning flood

- **Fixed** a severe block-view stall (about 1.7 s on toggle) caused by the
  base `node` stylesheet rule mapping `width`/`height` to `data(_size)`.
  Structural block nodes size via `_w`/`_h` and carry no `_size`, so
  Cytoscape logged a mapping warning for every such node on every render
  frame, and the console flood blocked the main thread. The size mapping is
  now scoped to a `node[_size]` rule, so it applies only to nodes that
  carry `_size` (force and encoded nodes), and the per-frame warning stops.
  No change to how any node is sized.

### Toggle/filter lag round (2026-06-17): visibility filtering, layout animation off

- **Added** a `hidden?: ReadonlySet<string>` prop to `CytoscapeCanvas`
  (@g3t/react): a visibility filter applied as a batched `g3t-hidden`
  (display:none) class toggle. It is NOT in the canvas init dependency
  array, so changing it is a restyle, not a re-init: the Cytoscape
  instance and node positions survive, and Cytoscape auto-hides edges
  incident to a hidden node.
- **Changed** the four demo shells (Auditor, MBSE, Biomedical,
  SupplyChain) to filter by hiding rather than by rebuilding. They now
  pass the stable full UGM plus a computed `hidden` id set, instead of
  feeding a pre-filtered UGM as the canvas data; the old approach
  re-created the Cytoscape instance and re-ran layout on every checkbox
  toggle. The hidden-id derivation uses faceted semantics (a node is
  hidden only when ALL of its types are hidden), fixing a predicate that
  previously considered only a node's first type.
- **Changed** the demo canvases to `animate={false}`, so the force
  (node/edge) view is interactive immediately instead of blocking during
  an animated fcose layout.
- **Added** a "Filter by hiding, not by rebuilding" recipe to the wiring
  guide, with a matching executable twin in `examples/wiring`.

### Block-view freeze round (2026-06-17): structural-layout mount cost

- **Fixed** the MBSE demo Block view stalling the tab on entry. The root
  cause was a heavy synchronous mount (not a render loop): a throwaway
  force-directed canvas mounted before the structural geometry resolved,
  StrictMode double-invoked the layout effect in dev, and elkjs ran
  synchronously on the main thread with a fresh instance per call.
- **Changed** `layoutStructural` (@g3t/core) to reuse one shared ELK
  instance and de-dup layouts by input identity, so a repeated layout of
  the same input (StrictMode double-invoke, structural-view re-open) runs
  ELK once. Bypassed when a custom `measure` is supplied; cleared on
  rejection.
- **Added** an injectable `ElkEngine` seam to `layoutStructural`
  (`options.engine`, default the shared synchronous instance; exported
  from the core and layout barrels), so a caller can move layout off the
  main thread without coupling core to a bundler or Worker.
- **Added** a worker-backed ELK engine in the demo
  (src/demo/lib/elkWorkerEngine.ts) that runs structural layout off the
  main thread, with a graceful fallback to the synchronous engine if a
  Worker cannot be constructed.
- **Changed** the MBSE shell to show a skeleton placeholder while the
  block-view geometry computes, instead of flashing a force-directed
  canvas that is immediately discarded.

### Examples-coverage round (2026-06-16): showcase removed, dashboards reworked

- **Removed** the showcase example (and its standalone-page build): made
  redundant by the four dev-server scenario shells.
- **Changed** the decision-dashboards from two thin near-duplicates into
  two capability-first dashboards chosen by a gap analysis against the
  toolkit surface: AnalyticsDashboard (StatsPanel, bar + scatter
  LinkedChart, AlgorithmPanel, DerivedPropertyPanel) and SchemaDashboard
  (SchemaView, MatrixView, SankeyView, live Turtle export, QueryEditor).
  Together with the four shells these now demonstrate essentially every
  view, chart type, and major interaction feature.
- **Removed** both standalone-page builds (showcase-page, dashboards-page)
  and their vite configs; the examples remain as reference source.



### Demo-capabilities round (2026-06-16): surface more of the toolkit

- **Added** raster-image icon support: the encoding icon channel now
  accepts PNG/data-URI/URL values (not just SVG glyph names), so custom
  logos render on nodes. New `isImageRef` passthrough in spec-apply.
- **Added** collapse to SpecLegend (`collapsible`/`defaultCollapsed`/
  `title`), so the on-canvas legend can be tucked away.
- **Added** a demo FloatingInspector (draggable inspector overlay) and
  wired it into the Biomedical shell.
- **Changed** the four demo shells to surface more of the toolkit:
  GraphToolbar (with embedded search + layout controls) on all four; an
  AlgorithmPanel tab and floating-inspector toggle in Biomedical;
  custom PNG company icons in Supply Chain; a NodeStyleEditor
  "customize style" dialog in Supply Chain and MBSE.
- **Changed** the landing page: corrected stale counts, added a
  capability strip, refreshed styling and per-scenario tags.



### Demo-fixes round (2026-06-16): four-shell preferences + bug fixes

- **Fixed** TableView column-visibility menu had no way to close once
  open: added outside-click and Escape handling plus a close button.
- **Fixed** TreeView breadcrumb showed an arbitrary click trail; it now
  shows the ancestor path (root -> ... -> selected) from containment
  edges, and clicking a crumb navigates to that ancestor.
- **Fixed** context-menu actions (View Neighbors, Pin) did nothing in
  the structural block view: the canvas now resolves right-clicks on
  structural rows/headers to the owning container's node id.
- **Added** `categoricalColorMap(spec, ugm)` and a `colorForType` prop
  on FacetFilter, so type-filter swatches match the colors the canvas
  encoding actually assigns (previously sorted-index vs insertion-order
  disagreed).
- **Added** an `anchor` option to the demo ResizablePanels so the right
  rail holds a fixed width while the center flexes.
- **Changed** the demo: a docked Neighborhood tab (hops + layout
  controls) replaces the floating neighborhood overlay; the MBSE
  scenario is listed second and opens in the block view; the encoding
  panel defaults its color/size channels expanded.
- @g3t/react bundle budget 300 -> 304 KB (ledgered; the fixes touched
  five library components).



### Round 49 (2026-06-13): flagship capability showcase

- **Added** examples/showcase: a Neo4j-Bloom / Stardog-Studio class
  application exercising the full capability surface: a custom theme
  (Nebula) + custom accent palette + custom node icons; a 1000+ node
  graph; native g3t widgets (TableView datagrid, LinkedChart/ECharts)
  AND an external widget (Plotly) all linked through the shared
  selection store; mocked algorithm results (criticality/risk) driving
  size and a ranked panel; and an incident blast-radius decision trace.
- **Added** a "showcase-page" build producing a single self-contained
  HTML file (scripts/showcase-page/dist/showcase.html; all g3t inlined,
  Plotly from CDN) for live review including on mobile.
- Distinct from examples/decision-dashboards (which teaches the minimal
  integration pattern); the showcase pushes breadth.

### Round 48 (2026-06-13): dashboards reworked (scale, layout, app structure)

- **Fixed** the dashboards page growing vertically without bound: the
  canvas host used height:100% inside a content-sized grid row
  (Cytoscape content size grew the row, the row grew the canvas). Canvas
  hosts now use a fixed height with overflow:hidden and the grids
  declare an explicit row track.
- **Changed** the dashboard fixtures from toy size (6/11 nodes) to
  realistic scale (~35-component satellite across six subsystems; ~25-node
  supply network across four tiers), built from row data to mimic a
  query result.
- **Changed** the dashboards to teach application structure: a four-layer
  architecture (data/ingest boundary, derived signals, view config,
  wiring) split into a separate data module per domain, documented in
  the README and marked inline, so the integration surface is legible.

### Round 47 (2026-06-13): standalone dashboards HTML page

- **Added** a self-contained HTML build of the decision dashboards for
  live review on any browser, including mobile: scripts/dashboards-page
  (island + emitter), vite.dashboards.config.ts and
  vite.dashboards-emit.config.ts, and a "dashboards-page" npm script.
  The page bundles both dashboards with a domain switcher and theme
  toggle into one file (zero external references). The graph itself is
  not pre-rendered (CytoscapeCanvas needs a live DOM); the page runs
  the dashboards live in the browser. Separate pipeline from the
  visual-acceptance build.

### Round 46 (2026-06-12): cross-domain decision-dashboard examples

- **Added** examples/decision-dashboards: two reference dashboards
  showing graph visualization wired into a decision workflow across
  domains. `ConformanceDashboard` (systems engineering: SHACL design-
  gate review of a satellite subsystem) and `ImpactDashboard` (supply
  chain: centrality-driven choke-point sizing + downstream blast-
  radius trace). They share one spine (a UGM substrate, computed
  signals driving the encoding, selection linking canvas to panels)
  while using deliberately different machinery, evidencing that the
  "graph-in-a-decision-dashboard" capability is reusable across
  domains. README tells the narrative; 7 headless tests cover the
  domain logic. The pre-existing full-workspace example remains as the
  layout-shell reference.

### Round 45 (2026-06-12): A3 UML edge vocabulary + VA checklist

- **Added** A3 UML edge symbols (completing Group A's styling):
  `StructuralEdge.kind` (association/composition/aggregation/
  generalization/dependency) maps to Cytoscape arrow shapes (filled/
  hollow source diamond, hollow target triangle, dashed dependency).
  A direct converter mapping (arrow shapes are an edge concern, not
  the node-shape channel); colors stay theme-reactive. VA-27 shows
  all four symbols.
- **Added** planning/visual-acceptance-checklist.md: a consolidated
  pass/fail checklist for every unverified structural/SHACL feature
  (rounds 31-45), flagging the still-open dagre verdict.
- **Changed** @g3t/react budget 297 -> 300 KB (ledger: +0.1 KB, the
  UML edge rules).

### Round 44 (2026-06-12): linked SHACL shape + data views (B4)

- **Added** SHACL linked views (B4, the last substantive piece of
  R1.17): `shacl-links` (`resultTargets`, `resultSelectionIds`,
  `resultDetail`, `resultsForFocusNode`) ties a validation result to
  its cross-canvas highlight targets. Selecting a result feeds
  `resultSelectionIds` to the shared selection store, highlighting the
  focus node (data canvas) and the source shape container + offending
  property row (shape canvas) at once. Pure selection-store reuse, no
  new machinery. VA-30 demonstrates the three-panel linked view.
- **Changed** @g3t/core budget 128 -> 130 KB (ledger: +0.1 KB, the
  linking module).
- R1.17's one remaining item is wiring `resultDetail` into the
  production DetailInspector (shaping built and tested).

### Round 43 (2026-06-12): selected-row outline no longer expands the container

- **Fixed** a selected structural row growing the container border
  into the ports: a child's selection outline expands the compound
  parent's bbox, so the global gasket ring (outward offset) pushed the
  container border outward on selection. Structural rows now use an
  INSET selection outline (negative offset), keeping the container
  bbox stable; the ring stays fully visible via the existing z-lift.

### Round 42 (2026-06-12): port border offset

- **Fixed** structural ports encroaching on the container: ELK puts
  the port's inner edge on the boundary line, but Cytoscape strokes
  the container border centered on the bbox edge, so its outer half
  crossed into the port (and the port's own border compounded it).
  Ports now offset outward by the border width (2px) in their mounted
  direction. Drag-follow unaffected.

### Round 41 (2026-06-12): structural dark-mode fix

- **Fixed** structural/compartment views rendering light in dark mode:
  STRUCTURAL_RULES hardcoded light hex colors (Cytoscape cannot read
  CSS variables, so they never tracked the theme). Split into
  structure-only STRUCTURAL_RULES plus a new theme-reactive
  `structuralThemeRules(theme)` (exported), composed after
  themeColorRules and recomposed on theme change. The SHACL shape view
  and per-row severity badges become theme-correct through the same
  rules.

### Round 40 (2026-06-12): VA review fixes

- **Fixed** multi-canvas overlay cross-contamination: the overlay
  store is a global singleton, so on a page with several canvases an
  overlay registered for one canvas's nodes dimmed the others. The
  overlay effect now ignores overlays that reference none of its own
  elements (single-canvas apps unaffected). The deeper global-store
  design point is logged in roadmap/human-actions.md.
- **Added** sh:severity support to `ShaclPropertyConstraint`: a
  constraint may declare its result severity, overriding the per-check
  default. Lets reports carry all three tiers (violation/warning/info).
- **Added** a compartment-scoped collapse menu action: right-clicking
  a compartment row/divider toggles only that compartment; the
  container header still toggles all. No engine change (the cxttap
  target already carries the row's parent and compartment).
- **Changed** @g3t/react budget 294 -> 297 KB (ledger: +1.5 KB for the
  overlay scoping guard and the row-collapse action).

### Round 39 (2026-06-12): SHACL validation report over the data graph (B1)

- **Added** SHACL validation-report visualization (R1.17, the report
  half of the SHACL story): a versioned `ShaclReportDocument`,
  `reportFromValidationResults` adapter from the in-core validator,
  `severityOverlays` (one toggleable overlay per severity tier over
  focus nodes, optional path-edge emphasis), `shaclResultDrivers`
  (per-node `_shacl_resultCount`/`_shacl_maxSeverity` encoding
  drivers), and `reportFocusNodes`/`resultsForShape` filtering
  helpers. A pure reuse slice over the shipped overlay + encoding
  machinery; VA-29 demonstrates it over the data graph.
- Severity COLOR is driven by the encoding spec (`_shacl_maxSeverity`)
  rather than per-tier overlay classes (deviation recorded in
  shacl-views.md; the union overlay-membership rule collapses tier
  identity, and the driver path reuses the legend/restyle semantics).
- **Changed** @g3t/core budget 124 -> 128 KB (ledger: +1.9 KB, the
  report module, pure core).
- **Added** roadmap/human-actions.md for items deferred to human
  judgment (first entry: improve SHACL fixture realism).

### Round 38 (2026-06-12): SHACL shape-view polish (VA-28 review)

- **Fixed** closed-shape header label clipping (header text estimator
  under-measured the bold guillemet-bearing «NodeShape» string; widened
  to 9px/char + margin).
- **Changed** the shape compartment label "constraints" -> "properties"
  (SHACL sh:property shapes).
- **Added** edge labels: `StructuralEdge.label`, rendered by the
  converter (autorotate, white halo); SHACL reference edges are
  labeled with the property path carrying sh:node.
- **Added** an explicit SHACL coverage matrix to
  roadmap/design/shacl-views.md documenting what renders today vs the
  spec gap (sh:class/sh:node parsing, logical operators, path
  expressions, severity/order/targets) as parser-dependent follow-on.

### Round 37 (2026-06-12): SHACL shape view through the compartment API (B3)

- **Added** the SHACL shape view as a second client of the structural
  compartment API (Group A's exit criterion): `shaclShapesToStructural`
  maps `ShaclShape[]` to the same `StructuralGraphInput` the UML views
  use (NodeShape containers, property-constraint rows as
  `path : xsd:type [min..max]` with a `(+n)` value-constraint chip),
  with no parallel rendering engine. `shaclRowSeverities` badges exact
  property rows from a validation report (worst-severity-wins);
  `closedShapeIds` drives closed/open borders.
- **Added** a `StructuralDecorations` converter arg and a
  `structuralDecorations` CytoscapeCanvas prop: closed/open container
  borders and per-row violation/warning/info severity classes
  (SHACL-agnostic; any client can decorate). VA-28 demonstrates the
  shape view live with a report toggle.
- **Changed** @g3t/core budget 120 -> 124 KB (ledger: +1.5 KB for the
  SHACL mapper, pure core).
- B2 (shape view on plain child nodes) was subsumed into B3 since
  Group A shipped first; the view was built directly on compartments.

### Round 36 (2026-06-12): compartment collapse canvas slice

- **Added** the compartment-collapse store
  (`useCompartmentCollapseStore`) and the built-in
  "Collapse/expand compartments" context-menu action
  (`registerCompartmentCollapseActions`), completing R1.18's
  per-container collapse surface. The store holds collapsed
  `${node}::${compartment}` keys; the menu filters to structural
  containers and toggles their compartments; the host subscribes and
  re-runs layoutStructural (the canvas needs no collapse code). The
  container element now carries `_compartmentIds` for the menu.
- **Changed** VA-27 to drive collapse through the real store
  (right-click per-container surface + a config-default button).
- **Changed** @g3t/react budget 288 -> 294 KB (ledger: +5.8 KB for
  the store and menu contribution).

### Round 35 (2026-06-12): ports rendered fully outside the container

- **Fixed** ports to sit completely outside the container, flush to
  the edge, by making them TOP-LEVEL SIBLINGS instead of children: a
  Cytoscape compound parent always grows to enclose its children, so
  a child port can never escape it (rounds 33-34 fought this and
  could not win). The converter now uses ELK's outside port
  coordinates verbatim.
- **Added** `wireStructuralPortDrag` (auto-wired by the
  CytoscapeCanvas structural path): sibling ports do not inherit the
  compound drag-along, so this offsets a container's ports by its
  drag delta.
- **Changed** @g3t/react budget 285 -> 288 KB (ledger: +1.2 KB for
  the drag helper; the round-34 entry forecast this).

### Round 34 (2026-06-12): port straddle fix + compartment collapse

- **Fixed** ports to straddle the container boundary (center on the
  border line) instead of clamping fully inside, so they read as
  sitting on the edge (round 33 over-corrected). Small symmetric
  bbox inflation is the accepted tradeoff under compound parents.
- **Added** compartment collapse (R1.18): StructuralCompartment
  `collapsible` flag and a `collapsedCompartments` option on
  layoutStructural (keyed via the new `compartmentKey` helper); a
  collapsed compartment shows a hidden-count divider and omits its
  content rows so the container shrinks. Collapse is a layout-time
  input: toggling re-lays-out, never a style hide. Design (two toggle
  surfaces: component config + per-container action) in
  roadmap/design/structural-rendering.md; config surface demonstrated
  in VA-27 with two toggle buttons. Wiring-guide recipe + twin added;
  the per-container store and context-menu contribution land next.

### Round 33 (2026-06-12): structural rendering A3 polish (VA-27 review)

- **Changed** structural containers to rounded rectangles with
  matching header/bottom-row corners; ports are larger (default 12)
  and border-only (no fill, ready for direction glyphs); ports clamp
  flush inside the boundary, fixing the doubled container line
  (compound bbox inflation from straddling ports); selected rows
  z-lift so the full accent ring shows over zero-gap siblings; plain
  nodes label with their id when headerless (the "empty box").
- **Changed** VA-27 fixture: port sides follow the layout direction
  (SOUTH/NORTH under DOWN), fixing the vertical port-to-port routing.

### Round 32 (2026-06-12): structural rendering slice A2 (canvas application)

- **Added** `structural` prop on CytoscapeCanvas plus
  `structuralToCytoscapeElements` / `STRUCTURAL_RULES` (@g3t/react):
  the StructuralGeometry document renders as a preset-positioned
  scene: compound containers with synthetic header strips, selectable
  drag-locked compartment rows (id-matching pattern wires
  selection/inspector machinery unmodified), divider/header
  furniture, decoration ports (promotable to selectable later by
  design), port-attached edges. Structural scenes never run force
  layouts and skip encoding-spec application.
- **Added** VA-27: live three-block fixture with a DOWN/RIGHT
  re-layout toggle; doubles as the dagre verdict's visual surface.
- **Changed** @g3t/react budget 280 -> 285 KB (ledger: +4.8 KB for
  the structural scene renderer; elkjs remains build-external).
- Review threads closed: round-25 item 5 was an erroneous list
  continuation; ports confirmed promotable-but-decorations in A2.

### Round 31 (2026-06-12): structural rendering slice A1 + tracking consolidation

- **Added** structural rendering geometry in @g3t/core (Group A
  slice A1, R1.18 in-progress): `layoutStructural` produces a
  versioned `StructuralGeometry` document (absolute boxes) for
  compound containers with typed compartment rows as REAL elements
  and fixed-side boundary ports, laid out by ELK per a
  spike-validated recipe (explicit pre-measured equal row widths,
  synthetic chain edges for order, layered-DOWN zero-spacing
  containers, SEPARATE_CHILDREN root). 12-test suite; wiring-guide
  recipe with executable twin; design record
  roadmap/design/structural-rendering.md (ipyelk findings, recipe,
  failures, slice plan). elkjs remains build-external (core
  116.0/120 KB, ledger noted).
- **Answered (headless)** the dagre question: elk.layered handles
  compound DAGs (53ms, strict layering); dagre stays unbundled
  pending visual spot-check.
- **Consolidated** tracking docs: PROGRESS.md and planning/status.md
  archived verbatim to planning/milestone-history.md and removed;
  durable lore promoted to DEVELOPER.md; STATUS.md and
  roadmap/CLAUDE.md rollups corrected (user stories had been
  conflated into proposed-requirement counts since round 27; gate
  scripts were authoritative all along).

### Round 30 (2026-06-12): roadmap regrouped

- Queue restructured into sequenced functional groups: ELK
  structural rendering first (compartment API as the shared reuse
  point), SHACL consuming it (report-viz slice independent), then
  provenance affordances, analyst workflow, visualization
  algorithms, streaming, continuous platform work; dagre decision
  folded into the ELK evaluation.

### Round 29 (2026-06-12): SHACL views on the roadmap

- New proposed requirements: SHACL shape view (containers,
  constraint summaries, reference/target edges) and validation-report
  visualization (severity-tier overlays, counts as encoding drivers,
  inspector detail, shape cross-highlighting); design record in
  roadmap/design/shacl-views.md; report slice rides shipped
  machinery.

### Round 28 (2026-06-12): roadmap descope

- Sankey (and its flow-cap default) removed from the roadmap with
  spec tombstones; partial code remains uncommitted.
- Algorithm roadmap narrowed to visualization-only (embeddings as
  layout, overlay set algebra); async runners and GraphBLAS batch
  shapes removed.
- Virtualization rescoped to visualization affordances (source
  indication + provenance on virtualized nodes); connector
  requirement removed; relational-virtualizer demoted to host-side
  utility.

### Round 27 (2026-06-12): status + handoff

- STATUS.md: live-numbered repo and roadmap snapshot with the
  priority-ordered queue.
- Root CLAUDE.md rewritten as a lean agent handoff (gates, editing
  discipline, doctrine, working agreement, open threads).

### Round 26 (2026-06-12): review findings + export

- Pin badge: filled, theme-accent fill with canvas halo, fixed-pixel
  size (container-safe), theme-reactive.
- VA-23 context menu curated to a host-registered trio.
- Width cap moved from canvas host to panel (canvas fills container).
- Export slice: Turtle/JSON/CSV subgraph exporters in core
  (selection-aware, inter-edges only) + toolbar Export control with
  2x PNG.

### Round 25 (2026-06-12): review findings

- Pin indicator: registry pin glyph as a top-right node badge
  (stacked backgrounds) replacing the amber underlay.
- VA-23: real right-click context menu wired (full toolkit actions).
- VA-26: disconnected-subsystem fixture, runners auto-wire results
  into color/size channels, narrative external document; panel
  reports written property keys via onIngested.
- Live canvases width-capped.

### Round 24 (2026-06-12): VA-26 growth fix

- VA-26 made constant-height by construction after a browser growth
  report (control column scrolls internally; canvas pane capped and
  clipped; all canvas hosts clip overflow). Render-count probe added
  as a regression guard; React-state and cy-event loops ruled out by
  evidence.

### Round 23 (2026-06-12): deployed docs refresh

- GitHub Pages pipeline audited (docs.yml: live and sound); landing
  page refreshed (React 19, current-era descriptions, Wiring Guide
  and Visual Acceptance cards); wiring guide rendered inside the API
  reference via TypeDoc projectDocuments; acceptance walkthrough
  joins the deployed site; workflow deduplicated onto docs:build;
  legacy Sphinx skeleton flagged for next-major removal.

### Round 22 (2026-06-12): documentation assessment + wiring guide

- docs/wiring-guide.md: stores/props/documents integration surface,
  composition levels, eight custom-control recipes, host-direction
  subscriptions; every snippet executable in examples/wiring/ (CI).
- Public-API gaps fixed (found by the executable docs): root barrel
  gained workspace + AlgorithmPanel; toolbar and layout-manager
  barrels completed.
- Canvas story migrated off the deprecated encoding path; stories
  added for GraphToolbar and AlgorithmPanel; README/DEVELOPER
  freshness pass; typedoc validation joined the verify chain.

### Visual round 21 (2026-06-12): algorithm overlays

- Result interchange contract v1 (core): versioned documents for
  property- and structure-shaped algorithm results from any engine;
  edge-property ingestion; reference built-ins (components, degree).
- Structural overlays: registry with independent toggles, union
  membership, emphasized-members/dimmed-rest rendering that restores
  exactly on deactivation; instance pins shadow overlay borders by
  documented decision.
- AlgorithmPanel controls + VA-26: shortest-path overlay, external
  MST document ingest, and components driving the encoding spec's
  color channel (results as drivers).

### Visual round 20 (2026-06-12): theme -> canvas wiring

- The canvas follows the theme: themeColorRules (labels, edges,
  selection highlight, :parent surfaces) merged through one shared
  stylesheet assembly used by init and a restyle-in-place theme
  effect (positions hold; spec mappers win by specificity; user
  stylesheets still override). Root cause behind two earlier visual
  findings, now closed.

### Visual round 19 (2026-06-12): glyph fixes, shuffle, workspaces

- Node glyphs: explicit SVG intrinsic size (crisp rasterization) and
  contrast-ratio glyph color against each node's resolved fill;
  preview and canvas share the rule.
- Toolbar Shuffle: randomized force re-run (incremental Re-run
  unchanged).
- Workspace durability slice 1: versioned snapshot of spec,
  positions, pins, and theme with capture/apply/serialize/parse;
  storage left to the host. VA-25 exercises it live.

### Visual round 18 (2026-06-12): review fixes

- Color-picker rows: label click-forwarding removed (only the swatch
  triggers the picker).
- VA-23 menu sample contained via a transform containing-block; items
  fire real actions with a visible wiring check.
- node.shape fixed mode implemented (was unreachable).
- Pin indicator: amber disc (universal visibility, CVD-distinct from
  the selection accent).
- Runtime canvas selection modernized: the gasket outline replaces
  the legacy 3px border; :active overlay slimmed; VA-24 menu reduced
  to a purpose-built pair of actions; stale ELK copy removed.

### Visual round 17 (2026-06-11): containers + per-node pinning

- Per-node position pinning: store + pure composition rule
  (pin-all = union, release returns to per-node set), canvas lock
  effect with soft-underlay indicator, context-menu toggle action;
  the toolbar's Pin all routes through the same store.
- Compound containers slice 1: containment option maps edges to
  Cytoscape parents, UML «Stereotype» container styling, fcose
  compound layout; theme→canvas derivation wiring recorded as a gap.
- VA-24 exercises both live on a SysML-flavored fixture.

### Visual round 16 (2026-06-11): toolbar review fixes

- Context menu themed (tokens + hover + color-scheme); VA-23 shows a
  static menu sample per theme.
- LayoutManager: slider commits debounced (re-layout storm fix),
  dagre/ELK removed from the selectable list (ELK roadmapped with
  compound/UML containers), model exported, sliders labeled.
- GraphToolbar rebuilt: single 26px row, options popover with
  explicit Run layout, Pin all (whole-graph position lock with
  disabled-with-explanation controls), compact zoom group; no
  animate toggle (motion follows prefers-reduced-motion). Per-node
  pinning roadmapped in roadmap/design/toolbar-and-layouts.md.

### Visual round 15 (2026-06-11): graph toolbar

- GraphToolbar: search (camera centers on match), layout switching
  with force controls (fcose repulsion/edge-length/gravity), visible
  degradation for unbundled engines, freeze, zoom/fit: the cy glue
  the existing components lacked. layoutConfig/runGraphLayout
  exported; nine tests. VA-23 exercises it live.

### Visual round 14 (2026-06-11): override application, SpecPort

- M12 per-instance style overrides now APPLY: bypass-style effect in
  CytoscapeCanvas consuming the override store (which previously had
  no canvas consumer); node and type scopes; restores on removal;
  precedence by mechanism documented in encoding-controls.md.
- SpecPort: tier-3 spec JSON import/export surface with verbatim
  validation errors (including reserved-channel rejections).
- VA-22 demonstrates the full precedence stack live.

### Visual round 13 (2026-06-11): canvas glyphs, shape channel, migration

- node.icon renders on the canvas via SVG data URIs (iconDataUri +
  node[_icon] rule); component icons degrade gracefully.
- node.shape: ShapeScale + slot-stable resolver, panel row,
  paired-redundancy warning, legend glyph section, _shape emission.
- All demo shells (five) and DemoApp migrated off EncodingPanel /
  CanvasLegend / encodingToCytoscapeStyle; legacy exports retained
  only for external stability pending the next major.

### Visual round 12 (2026-06-11): position stability, page width

- CytoscapeCanvas contracts made explicit: ugm must be referentially
  stable (new identity = new graph = re-init + layout); encodingSpec
  changes restyle only and never move nodes. Acceptance fixtures
  memoize their graphs (the round-11 re-layout was fixture-side).
- Acceptance page: 1320px container with prose capped at a readable
  measure; VA-22 pass criteria include position stability.

### Visual round 11 (2026-06-11): spec drives the canvas

- applyEncodingSpec: element-data patches from the encoding spec via
  the shared resolvers; CytoscapeCanvas encodingSpec prop with
  batch-apply on mount and change; attribute-presence edge rules
  (edge[_ewidth]/edge[_ecolor]) keep unclaimed channels on legacy
  style. SpecLegend: spec-mirroring legend through the same
  resolvers. VA-22: first live-canvas acceptance check (panel ->
  canvas -> legend loop). Icons and shape remain canvas-absent by
  design (documented).

### Visual round 10 (2026-06-11): fixed editors, ThemeSwitcher

- Encoding panel: chip strips use one resolver per strip (multi-color
  regression fixed); FixedNumberEditor for fixed node.size and
  edge.width; edge.color chip strip plus categorical/fixed editors;
  preview sizes rounded for crisp borders.
- ThemeSwitcher component exported from the theme barrel
  (store-driven, aria-pressed, onSelect for host chrome); acceptance
  page hosts it in a main-level sticky bar (sticky-within-short-parent
  bug fixed).
- node.shape documented as a future paired-redundancy channel in
  encoding-controls.md.

### Visual round 9 (2026-06-11): review fixes + icon sets

- Encoding panel: driver-aware chip/preview sampling (label/pagerank
  drivers rendered blank), numeric color drivers default to a
  sequential ramp, preview defaults to real node attrs.
- Custom palettes: pickers edit array slots (overrides folded on
  switch), warnings evaluate EFFECTIVE colors against the live canvas
  background and clear when fixed; silent while palette-safe.
- registerIconSet: bulk icon sets with sanitize-by-default (named
  rejections for script/on*/foreignObject/url() content), trusted
  mode for adopter-compiled sets, pre-mappings +
  applyIconMappings into the encoding spec. VA-21 exercises all of
  it live.

### Visual round 8 (2026-06-11): live encoding island

- VA-20 is interactive: the Va20Live composition is SSR'd as fallback
  and mounted by an inlined client bundle built from the same source;
  preview and spec JSON update live through the shipped resolvers.
- VA-18 shows EncodingSpecPanel; the deprecated EncodingPanel remains
  only for the demo shells (migration queued).
- Layout containment: min-width:0 hygiene for grid/flex children,
  wrap-tolerant encoding rows.
- Harness lesson: inline bundles via a replacer function;
  String.replace's string form expands $-sequences (caught by the
  page self-check as a 2.3 MB explosion).

### Visual round 7 (2026-06-11): encoding grammar

- Encoding overhaul per roadmap/design/encoding-controls.md: spec
  model (channel <- driver via scale; fixed/categorical/sequential;
  slot-stable overrides; reserved-channel guard; versioned JSON;
  legacy adapter; palette warnings), EncodingSpecPanel (progressive
  disclosure: rows + chips + inline scale editors), EncodingPreview
  (resolver-driven proof strip). Legacy EncodingPanel deprecated but
  intact; 23 new tests.

### Visual round 6 (2026-06-11): sh:closed, createTheme, panel slice 2

- SHACL closed-world support: ShaclShape.closed + ignoredProperties,
  enforced by validateShacl (undeclared properties violate); lock
  indicator in the shape browser; `lock` icon added (23 glyphs).
- createTheme()/contrastRatio() exported: partial-over-preset theme
  creation with WCAG contrast warnings.
- Panel anatomy adopted by AnnotationPanel, EncodingPanel, and legend
  headings (C4 complete for current panels).
- Acceptance page: four-panel VA-18 with a closed shape; VA-19 live
  accent-override editor.

### Visual round 5 (2026-06-11): gasket halo, panel anatomy

- Selection halo rebuilt as a gasket: offset accent outline over a
  canvas-colored gap (Cytoscape outline-*), replacing the double ring
  that failed review in all themes; new --g3t-selection-gap-width
  token; derived-style regression test.
- Panel anatomy classes (.g3t-panel*) in the base stylesheet, adopted
  by DetailInspector and ShaclShapeBrowser (C4 first slice).

### Visual round 4 (2026-06-11): review fixes, skeletons, tree density

- Map background and graticule onto theme vars (dark mode bug).
- Table pagination buttons onto g3t-btn; high-contrast colorScheme
  corrected to "light" (round-1 error).
- Canvas selection ring is now double (geometry redundancy; halo
  token 4px) so selection reads on black high-contrast nodes.
- Skeleton component completes the B2 pattern (reduce-motion-safe
  shimmer); TreeView density="compact".

### Visual round 3 (2026-06-11): rem scale, states, density, map signature

- Type tokens converted to rem with the xs floor raised to
  11px-equivalent (browser text-zoom now works).
- Button disabled state and tokenized active surface.
- TableView density="compact" prop.
- MapView selection: accent halo replaces the fill-swap-to-blue
  (channel-allocation compliance), theme-var fills and labels;
  regression-guarded. Matrix column-label boundary padding fixed.

### Visual review round 1 fixes (2026-06-11)

- G3tTheme: per-theme `colorScheme` injected onto the root; scoped
  `accent-color` for native checkboxes/radios (dark-mode native
  controls stayed UA-light).
- Focus rule class drift fixed: `.g3t-button` (nonexistent) →
  `.g3t-btn` (the real tokenized class).
- MatrixView header typography: vertical-rl column headers replacing
  unsized rotate(-45deg) overlap; right-aligned `th scope="row"` row
  headers; mono axis labels; boundary padding.
- Acceptance page: ring-clearance fix, themed controls, VA-11 canvas
  halo swatch derived from deriveCytoscapeStyle at generation time.

### Visual acceptance harness (2026-06-11)

- `pnpm run visual-acceptance`: jsdom-rendered, self-checked,
  single-file gallery of the design-pass-2 work (real components,
  real tokens, three live themes) with checks VA-1..VA-10 for human
  review; the reviewed page seeds the Playwright baseline set.
  Plan and execution record: planning/visual-acceptance-1.md.

### Design pass 2 (2026-06-11): icons, states, selection signature

- **Icon system (B1).** 22-glyph stroke set behind an IconRegistry
  (@g3t/react/icons subpath): semantic names, currentColor, strict
  a11y contract (labeled when standalone, hidden when decorative),
  adopter-swappable without forking components. All Unicode glyph
  call sites migrated (tree, inspector, table sort, SHACL badges,
  search clear, play/pause, zoom).
- **EmptyState/ErrorState (B2).** One anatomy replacing eight per-view
  improvisations; copy rewritten to say what the view is, why it is
  empty, and what fills it. Existing testids preserved.
- **Reduced motion to JS animation (A2).** prefersReducedMotion()
  consulted by the canvas animate default and the ECharts theme.
- **Selection signature (C1).** Geometry tokens
  (--g3t-selection-*); table selection migrated off hardcoded #2563eb
  (which was not even the theme accent) onto theme + tokens; canvas
  halo width from the shared token; charts select/emphasis on the
  accent. Channel-allocation table recorded in
  roadmap/design/projection-and-encoding.md: selection owns accent
  exclusively, overlays own weight, inference owns dash.
- **Matrix truncation notice.** The silent .slice() at maxSize now
  announces "showing N of M types" (R7.7's no-silent-limits
  principle).
- **R1.4 verification executed.** Gradient and limit-notice
  acceptance pass; two gaps found and scoped (no type-pair selection;
  truncation is not aggregation). R1.4 remains in-progress: the
  verification tier producing its designed outcome.

### Design-system quality floor (roadmap/design/design-system.md)

- Motion: easing tokens added; `prefers-reduced-motion` now zeroes the
  duration tokens toolkit-wide.
- Focus: `:focus-visible` ring tokens and base rules; keyboard
  navigation gets one unmistakable treatment, pointer clicks stay
  quiet.
- Data scales: viridis sequential and PuOr diverging scale tokens plus
  `scaleColor()`, extending the colorblind-safe commitment (R7.8) to
  continuous encodings; MatrixView migrated off its hardcoded
  alpha-blue ramp (illegible on dark themes).
- Z-index scale tokens added.
- Capability landscape survey (research/capability-landscape.md):
  4 requirements adopted (R1.15 entity page, R2.16 change history,
  R2.17 saved queries, R3.9 algorithm subgraph overlays), spec corpus
  now 76; roadmap coverage gate extended to 31 open requirements.

### M15: Audit Remediation

Full inventory and validation evidence: planning/audit-remediation.md.

#### Fixed (release-blocking)

- **Consumer type resolution.** Published packages shipped untyped:
  `build:packages` ran tsc declaration emit and then Vite's
  `emptyOutDir: true` deleted the emitted .d.ts files, and the
  exports maps listed the `types` condition after `import`/`require`
  (so it could never match) while pointing at the now-phantom paths.
  Fixed by disabling emptyOutDir (explicit clean via
  scripts/clean-dist.mjs instead), reordering `types` first in every
  conditional export across all three packages, and post-processing
  emitted declarations for node16 extension rules
  (scripts/fix-dts-extensions.mjs). Gated by `verify:types`, which
  typechecks a scratch consumer under node16 and bundler resolution.
- **Broken quickstarts.** All four README code examples failed as
  written (SparqlAdapter object-arg constructor that doesn't exist,
  missing React hook imports, getters called as methods, a phantom
  `ThemeProvider` export, a string passed where a DataPipeline is
  required). Fixed and gated by `verify:snippets`, which typechecks
  every fenced ts/tsx block in the READMEs against the real types.

#### Fixed (process integrity)

- **Spec lint gate.** scripts/lint_specs.py now exits non-zero on
  warnings (it previously returned 0 unconditionally across two
  audits) and additionally enforces: required sub-bullets per item
  kind, RFC 2119 text vs `priority` agreement, acceptance criteria on
  MUST requirements, and cross-file identifier resolution. Spec
  linting and status-sync now run in CI (spec-lint job).
- **Spec corpus.** Relocated R1.13/R1.14 and R2.13-R2.15 out of User
  Stories sections; aligned seven MUST-text/SHOULD-priority
  disagreements to their priority fields; added acceptance criteria
  to eleven requirements; corrected OQ9's false attribution;
  deduplicated the open-questions register (OQ2/OQ5 vs the Holonic
  spec) and added OQ13 (fog-redaction export gap) and OQ14; anchored
  the capability clusters (C1-C8) and the 90% coverage claim to
  research/use-case-survey.md.
- **Truth in claims.** The "72/72 spec requirements referenced"
  metric is retired; spec statuses are the record (currently 45
  implemented / 13 in-progress / 14 proposed), kept consistent with
  code citations by scripts/sync_spec_status.py, which guards against
  the comment-only phantom citations this pass removed (R2.15, R3.6,
  R3.8, R6.2 and others were status-credited off comments with no
  implementation behind them). HolonicAdapter's header now states
  what it implements and that R5.1's backend acceptance criteria are
  unmet; its query() logs when it ignores a query string instead of
  doing so silently. PROGRESS.md, planning/status.md, planning/
  roadmap.md, and pixi.toml ticket/test/version figures reconciled.

#### Changed

- tests/dist/public-api.test.ts (moved from packages/core/src) runs
  via `verify` after the build instead of via `pnpm test`, so a fresh
  clone passes the unit/component suite without building packages.
- CI gained spec-lint and e2e jobs. The e2e job gates functional
  assertions with `--ignore-snapshots` until Linux screenshot
  baselines are committed (bootstrap instructions inline in ci.yml).
- Private root package.json no longer carries publish-only fields
  (peerDependencies, peerDependenciesMeta, files, sideEffects);
  lockfile regenerated; full suite re-verified.
- NOTICE and LICENSE files added to each package (they were declared
  in `files` arrays but absent).

#### Known limitations

- Typed CommonJS consumption (`require` from a TS .cts file under
  node16) fails with TS1479: the packages emit a single ESM-flavored
  .d.ts per entry. Runtime CJS works (verify:smoke). Durable fix is
  per-entry declaration bundling (.d.ts/.d.cts); tracked in
  planning/audit-remediation.md.

## [1.0.0-rc] - 2026-05-24

### M14: Release Engineering

- Replaced mathjs (17.6 MB) with expr-eval (3 KB) in
  DerivedPropertyEngine. Bundle reduced 20%.
- Reclassified optional view dependencies (@tanstack/react-table,
  fuse.js, echarts-for-react) as optional peer deps.
- Added `sideEffects: ["*.css"]` for tree-shaking.
- Created per-package entry points (core-entry.ts, react-entry.ts,
  charts-entry.ts) and Vite build configs.
- Created per-package package.json in dist/ for npm publish.
- Added GitHub Actions CI (.github/workflows/ci.yml) and publish
  (.github/workflows/publish.yml) workflows.
- Added bundle analysis (rollup-plugin-visualizer) and
  treeshaking verification script.
- Annotated all 72/72 spec requirements in source code.

### F1-F8: Feature Enhancements

- F1: Animated layout transitions (animate, animationDuration props)
- F2: Adaptive/incremental layouts (computeIncrementalUpdate,
  lock existing nodes on small changes)
- F3: Node group collapsing (ComboManager, combo create/dissolve/
  collapse/expand/nest, Cytoscape compound nodes, serialization)
- F4: Annotations framework (AnnotationStore interface,
  localStorage default, AnnotationPanel component)
- F5: Node/edge property editor (PropertyEditor, inline editing,
  PropertyEditCallback for backend persistence)
- F6: Enhanced map view (edges between geo nodes, tile URL prop,
  TemporalSlider with play/pause/speed controls)
- F7: Link label styling (background, border, padding, radius
  via Cytoscape text-background properties)
- F8: Orthogonal edge routing (taxi curve-style, straight-triangle)
- LayoutManager: layout selection (7 layouts), force parameter
  tuning (repulsion, gravity, edge length), reset, freeze/unfreeze,
  animate toggle, edge style selector

## [0.13.0] - 2026-05-24

Four enhancement milestones completing the toolkit's analytical
and customization capabilities. (Previously this block was published
as a second [1.0.0-rc] section in CHANGELOG.md; corrected to its own
version as part of Phase 1 release-engineering hygiene.)

### M10.5: Integration Core

- **Middleware pattern (D6):** Composable request/response
  interceptors. Built-in: `bearerAuth()`, `apiKeyHeader()`,
  `retryOnError()`, `requestLogger()`.
- **RestAdapter (D6):** Generic REST/GraphQL with `mapResponse`
  function and middleware support.
- **GremlinAdapter (D6):** HTTP-based Gremlin adapter for
  Neptune, Cosmos DB, and JanusGraph.
- **Event bus (D6):** `G3tEventBus` typed pub/sub with 20 event
  types. Context action events for multi-view wiring.
- **Build pipeline:** Vite library mode producing ESM + CJS
  bundles with 88 TypeScript declaration files.
- **Adapter middleware:** SPARQL and Cypher adapters updated to
  accept `middleware` option.

### M11: Pipeline Infrastructure

- **DataPipeline interface (D6):** `query(ugm) -> ChartData` +
  `reverseMap(selection, data) -> nodeIds`. PipelineRegistry for
  named pipelines.
- **8 built-in pipelines:** countByType, countByProperty,
  degreeDistribution, edgeTypeBreakdown, propertyCorrelation
  (OLS trend via simple-statistics), centralityVsProperty,
  activityTimeline, communityBreakdown.
- **LinkedChart (D13):** React component wiring DataPipeline to
  ECharts. 5 chart types: bar, scatter+trend, line/area, pie,
  parallel coordinates. Bidirectional selection sync.
- **PropertyFilter (D6):** AND/OR filter groups with 8 operators
  (gt, gte, lt, lte, eq, neq, contains, exists). Nested groups.
- **ViewFilter (D6):** showOnlySelected, hideSelected,
  expandToNHops, subgraph pinning.
- **FilterBuilder (D13):** Visual filter builder UI.
- **Table enhancements:** Column visibility toggle, inline
  per-column property filters.

### M12: Customization & Filters

- **NodeStyleOverride (D6):** Per-node and per-type visual
  overrides (color, shape, size, icon, border, opacity).
  Cytoscape stylesheet merge with correct CSS specificity.
- **SVG icon library:** 20 built-in icons (person, building,
  globe, shield, server, etc.) as path data constants.
- **NodeStyleEditor (D13):** Color palette, shape selector,
  size slider, icon grid, scope toggle (this node / all of type).
- **Context-sensitive menus (D6):** TypeMenuProvider with
  per-type menu items. Default items for Person, Location, Event.
- **Bulk operations:** Multi-select context menu (color, pin,
  hide, show-only, view subgraph, find path). applyBulkStyle().

### M13: Advanced Features

- **PROV-O extraction (D6):** Maps prov:startedAtTime,
  prov:endedAtTime, etc. to toolkit temporal properties.
- **DerivedPropertyEngine (D6):** Safe expression evaluator
  (expr-eval). User-defined computed properties on nodes.
- **Subgraph pinning (D6):** Pinned nodes stay visible despite
  ViewFilter hide operations.
- **TemporalRangeFilter (D13):** Dual-handle time range slider.
- **DerivedPropertyPanel (D13):** Define/compute/remove UI.

### Toolkit Context Menu Actions

- **registerToolkitActions():** Single function registers 19
  context menu items (9 single-node, 3 single-edge, 7 multi-select).
- **buildNeighborhoodUGM():** Creates subgraph UGM for secondary
  canvas views.
- **Event-driven wiring:** Context actions emit events
  (context:viewNeighbors, context:findPath, etc.) for application
  to wire up secondary views.

### Documentation

- **ARCHITECTURE.md:** Toolkit boundary, package diagram, data
  flow, extension examples.
- **DEVELOPER.md:** D6/D13 rules, project structure, testing.
- **CLAUDE.md:** Agent handoff context.

### FOSS Dependencies Added

graphology-shortest-path, graphology-metrics,
graphology-communities-louvain, graphology-components,
crossfilter2, simple-statistics, expr-eval.

### Test Coverage

520 tests across 36 files, all passing.

## [0.8.5] - 2026-05-22

### M8.5: UX Surface & Theming

Vendor-quality visual controls, centralized theming, and interaction
affordances.

#### Added

- **ThemeManager:** Centralized theming via CSS custom properties
  (--g3t-*). Three presets: light, dark, high-contrast. Zustand
  store with setTheme(). Derived Cytoscape stylesheets and ECharts
  theme objects. All components read from CSS variables.

- **VisualEncodingManager (D6):** Maps UGM property keys to visual
  channels (nodeSize, nodeColor, edgeWidth, nodeLabel). Produces
  Cytoscape mapData() stylesheet entries. Type-based palette
  coloring. Property range auto-detection.

- **EncodingPanel:** React sidebar with dropdowns for each encoding
  channel. Includes label selector (M8.5.E4.T2).

- **CanvasLegend:** Auto-generated from active encoding. Type-color
  dots, size scale, edge line-style meanings.

- **HoverTooltip:** Positioned tooltip on node mouseover with label,
  type, and top 5 properties.

- **ZoomControls:** +, -, fit-to-screen button group.

- **Toolbar:** Mode buttons (select/pan), layout trigger, filter and
  encoding toggles, theme selector dropdown (light/dark/HC).

- **StatusBar:** Reactive node count, edge count, selection count,
  zoom level.

- **KeyboardShortcutModal:** "?" key opens reference with 12 shortcuts.

#### Test Coverage

- 372 tests across 27 files, all passing.

## [0.8.0] - 2026-05-22

### M8: Accessibility

WCAG 2.1 AA support with ARIA companion, keyboard navigation,
screen reader summaries, and high-contrast mode.

#### Added

- **AriaCompanion (R7.9, R7.10):** Hidden focusable node list
  mirroring the UGM. Degree-ordered tab sequence. Structured
  aria-labels ("Alice, Person, 5 connections: 3 to Person, 2 to
  Organization"). Keyboard edge traversal via arrow keys.

- **aria-live region (R7.10):** Polite announcements for context
  changes (selection, expansion, layout switches).

- **High-contrast mode (R7.12):** HighContrastConfig with WCAG AA
  defaults. Black on white (21:1 contrast ratio), 4px strokes.

- **Table fallback (R7.11):** Verified cross-view selection store
  ensures table always reflects current selection from any view.

#### Test Coverage

- 327 tests across 26 files, all passing.

## [0.7.0] - 2026-05-22

### M7: Charts & Enhancements + Gap Analysis

Sankey/chord and matrix views. Three critical gap-analysis additions:
path analysis, query editor, undo/redo.

#### Added

- **Shortest Path Analysis (R2.13):** BFS path finder between two
  nodes with edge type filter and maxHops constraint. Returns
  ordered node/edge IDs for canvas highlighting.

- **Query Editor (R1.13):** SPARQL/Cypher/GQL text input with
  execute button, Ctrl+Enter shortcut, error display, and adapter
  integration.

- **Undo/Redo Stack (R2.14):** UGM snapshot stack with configurable
  depth. Redo cleared on new action. Framework-agnostic.

- **SankeyView (R1.9):** ECharts Sankey + chord mode toggle.
  Aggregates edge counts between node types.

- **MatrixView (R1.4):** Adjacency heatmap by node type. Color-
  scaled cells with click-to-select. maxSize limit (R7.3).

#### Spec Additions

- R2.13 (path analysis), R2.14 (undo/redo), R2.15 (bookmarks),
  R1.13 (query editor), R1.14 (community overlay) added to spec.
- Gap analysis document: `planning/enhancement-plan.md`.

#### Test Coverage

- 314 tests across 25 files, all passing.

## [0.6.0] - 2026-05-22

### M6: Workspace & Schema

Multi-view workspace composition, schema visualization with SHACL
overlay, graph diff engine, and ontology version tracking.

#### Added

- **WorkspaceShell (FlexLayout):** Tabbed/split-pane workspace host.
  ViewFactory pattern. Role-based defaults (analyst, engineer).

- **Save/Load:** Workspace state serialized to JSON including
  FlexLayout model and schema hash. Round-trip verified.

- **SchemaView:** Class hierarchy from UGM registry or SchemaModel.
  SHACL shape badges on target classes with constraint counts.

- **DiffRenderer:** Color-coded diff visualization (green=added,
  red=removed, amber=changed). Property-level change display.

- **Graph Diff Engine:** diffGraphs() compares nodes, edges, and
  properties. computeSchemaHash() for version tracking.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.5.0] - 2026-05-22

### M5: Secondary Views

Timeline, map, statistics, and tree views implemented with
cross-view selection linking.

#### Added

- **TimelineView (vis-timeline):** Renders temporal nodes. Brush
  selection filters by time range and writes to selection store.

- **MapView (SVG equirectangular):** Renders geo-located nodes as
  markers. Click-to-select and pan-to-selected via useMemo viewBox.

- **StatsPanel (ECharts):** Histogram of numeric property values
  with brush-to-select for highlighting matching nodes.

- **TreeView:** Lazy-load containment hierarchy with configurable
  initial depth, expand/collapse, breadcrumb trail, and working-set
  limit enforcement. BFS cycle handling.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.4.0] - 2026-05-22

### M4: Projection Pipeline

RDF data projected to UGM through configurable collapse transforms.
Pre-extraction architecture ensures types and properties are always
preserved regardless of which collapses are enabled.

### Testing Infrastructure (D14)

Four-layer testing strategy adopted: Vitest unit, RTL component,
Playwright visual regression, Robot Framework acceptance.

#### Added

- **Shared test harness:** `/?test-harness` URL activates a
  deterministic rendering of all components (20 nodes, 30 edges,
  3 types) for screenshot-stable testing.

- **Playwright e2e tests:** 3 spec files (canvas, selection, sidebar)
  with `toHaveScreenshot()` visual regression baselines. Consistent
  1280x800 viewport, single worker, 1% pixel tolerance.

- **Robot Framework acceptance tests:** 2 suites (M0 foundation,
  M1 interaction) with keyword-driven tests tagged by requirement
  ID (R1.1, R2.5, D3, etc.). HTML reports with embedded screenshots.

- **CI pipeline updated:** Robot Framework steps added alongside
  Playwright. Test artifacts (screenshots, reports) uploaded on
  all runs.

#### Added

- **ProjectionPipeline:** Ordered sequence of collapse steps with
  pre-extraction of types and properties from the full RDF graph.
  Steps can be enabled/disabled by name.

- **5 Collapse Transforms:** Type (rdf:type → types array), Literal
  (datatype triples → properties), Blank-Node (inline as nested
  objects), List (rdf:first/rest → arrays), Reification (rdf:Statement
  metadata → edge annotations).

- **3 Presets:** Standard (all on), Ontology (type edges visible),
  Provenance-Preserving (reification nodes visible).

- **ViewRouter Gate:** checkRenderPermission() blocks raw RDF from
  renderers; schema and inspector views exempt (R4.6).

- **Holonic Compatibility:** Pipeline satisfies HolonicProjectionPipeline
  interface via structural typing.

#### Architecture

- Pre-extraction runs BEFORE collapse steps to avoid ordering
  dependency between literalCollapse and structural collapses.
- literalCollapse preserves blank-node-subject literals so BNode,
  List, and Reification collapses can still read them.
- localPart() handles IRIs, CURIEs, and plain strings.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.3.0] - 2026-05-22

### M3: Data Adapters & Integration

Toolkit connects to external graph data sources. SPARQL, Cypher,
and Holonic adapters populate the UGM. Algorithm results and
relational data merge as supplementary properties. D6 module
boundary verified.

#### Added

- **GraphAdapter interface:** query(), expandNeighborhood(),
  getSchema(), getNodeProperties().
- **SparqlAdapter:** SPARQL SELECT/CONSTRUCT via HTTP.
- **CypherAdapter:** Neo4j HTTP transaction API with graph results.
- **HolonicAdapter:** P6 four-graph model; projectToLPG() for
  holarchy visualization; portal right-click menu items.
- **AlgorithmResultAdapter:** ingestAlgorithmResults() merges
  algorithm output (PageRank, community ID) into UGM nodes.
- **RelationalVirtualizer:** Tabular data merge by shared key.
  parseCSV() with quoted field support.
- **D6 Module Boundary Test:** All core modules import without React.

#### Test Coverage

- 230 tests across 20 files, all passing.

## [0.2.0] - 2026-05-22

### M2: Layout Engines

Four pluggable layout engines with a common interface, layout
switcher UI, and pin/unpin state management.

#### Added

- **LayoutEngine interface:** `compute(ugm, options) → Promise<LayoutResult>`.
  All engines are async, stateless, and honor pinned node positions.

- **ForceLayout (d3-force):** Force-directed with configurable tick
  count. Uses forceManyBody, forceCenter, forceCollide. Pinned via
  fx/fy constraints.

- **HierarchyLayout (d3-hierarchy):** Tree/cluster layout with auto
  root detection and BFS cycle handling. Orphan nodes placed separately.

- **DagreLayout (@dagrejs/dagre):** DAG layout with configurable
  direction (TB/LR/BT/RL). 50-node DAG in <100ms.

- **ElkLayout (elkjs):** Layered hierarchical layout via async ELK
  computation. Handles 200-node DAGs.

- **LayoutSwitcher:** React component rendering engine selection
  buttons with active highlight.

- **usePinState:** React hook managing pinned node positions with
  pin/unpin/isPinned API.

#### Test Coverage

- 230 tests across 20 files, all passing.

## [0.1.0] - 2026-05-22

### M1: Interaction & Selection

Cross-view selection model proven: canvas and table are linked
through a shared Zustand store. Core interaction primitives
(expand, filter, search, tag, group) implemented.

#### Added

- **Selection Store (Zustand):** Shared selection state with
  selectNodes, selectEdges, addToSelection, clearSelection, setHover.
  All views read/write the same store. Redux DevTools support.

- **Table View (TanStack Table):** Dynamic columns from UGM
  property-key registry. Sortable headers, pagination. Click-to-select
  syncs with canvas. Right-click shows same context menu as canvas
  (R2.1 universality).

- **N-Degree Neighbor Expansion:** BFS at configurable depth.
  Returns discovered IDs with working-set limit check. Framework-
  agnostic; ready for adapter integration in M3.

- **Faceted Filter:** Checkbox toggle per node type with color
  swatches and counts. Reports hidden types set for canvas filtering.

- **Full-Text Search:** Case-insensitive substring matching across
  node labels. Reports matching/non-matching ID sets for canvas
  highlight/dim.

- **Tag Manager:** User-defined labels persisted as UGM node
  properties. Survives serialization round-trip. Query by tag.

- **Grouping Manager:** Compound node creation with expand/collapse
  state tracking. Children get `_parent` reference; group nodes
  get `_isGroup` flag.

- **Working-Set Manager:** Per-view-type element limits (canvas 500,
  table 10k, tree 1k, matrix 200, sankey 100, streaming 500).
  Admin override. Constructor accepts initial overrides.

- **Multi-Select:** Shift-click accumulates selection. Lasso
  (box selection) enabled; boxend event syncs to store.

#### Test Coverage

- 165 tests across 16 files, all passing.

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
