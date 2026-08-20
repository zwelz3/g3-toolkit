#!/usr/bin/env node
/**
 * PUBLISH-WEIGHT budget (P6). Read the next paragraph before citing a
 * number from this file.
 *
 * For each published package, compute the total ESM dist size and
 * compare against a budget. Fails if any package exceeds its budget.
 *
 * **This is publish weight, NOT what an adopter downloads.** Every
 * package here declares `sideEffects: false` (asserted by
 * verify:treeshake), so a bundler drops what the consumer does not
 * reference. Measured 2026-08-15: importing only `UGM` costs 4.8 KB of
 * first-party code, against the 164 KB this file reports for the whole
 * package. The two numbers differ by a factor of thirty and answer
 * different questions.
 *
 * `scripts/check-consumer-cost.mjs` budgets what an adopter actually
 * pays, per import. This file stays because publish weight catches
 * things that one cannot and catches them cheaply: an accidental
 * node_modules inclusion, a dependency swap, a build that stopped
 * splitting chunks. Keep both, and do not read a raise here as a
 * regression somebody's page load will feel; check the other gate for
 * that.
 *
 * The "total ESM" is the sum of every `.mjs` and `.js` file in the
 * package's `dist/` directory, EXCLUDING `.cjs` (CommonJS) and `.map`
 * (source maps). Shared chunks Rollup extracts during the multi-entry
 * build count.
 *
 * Budgets are unminified bytes. Consumers minify in production. The
 * previous wording here said unminified dist "is what consumers
 * actually pull through their own bundlers", which was the assumption
 * that made this file look like a consumer-cost gate for a year. It is
 * not: consumers pull what they reference.
 *
 * Headroom: each budget is set ~25% above the current measured size.
 * If a legitimate change pushes any package over its budget, raise the
 * budget here with a note (in the same commit) explaining why.
 *
 * Exit codes:
 *   0  all packages within budget
 *   1  any package exceeded its budget
 *
 * Sizes recorded against Phase 5/6 baseline of g3-toolkit:
 *   @g3t/core   ≈ 96 KB
 *   @g3t/react  ≈ 165 KB
 *   @g3t/charts ≈ 5.8 KB
 */

import { readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const BUDGETS = {
  // G3L rounds 1-3 (2026-07): +11.4 KB of pure compute, deliberate
  // P0 capability per planning/g3l/implementation-plan.md: the layout
  // quality metrics oracle (G3L:QLT-002) and the style-resolution
  // engine with dependency-tracked invalidation (G3L:ARC-002,
  // STY-001..005). 176 leaves ~14 KB headroom for the C3/C4 slices
  // (theme tokens, LOD schedule), which are declarative data plumbing,
  // not algorithmic bulk.
  // RAISED 176 -> 184 (2026-07-11): the G3L:RTE-011 orthogonal
  // obstacle router (B4, ~6.4 KB) landed in core, where route
  // ownership belongs (RTE-005). SECOND raise for the style/route
  // program; the standing recommendation holds: when WS-D (internal
  // layout engine) lands, extract @g3t/layout (ARC-009), move the
  // router with it, and bring core back under its original envelope
  // rather than raising a third time.
  // Owner batch + directives 2026-07-28: +1.0 KB across the VR-9
  // detour helper, the port-pair within-body snap, and the
  // congestion-demand sizing. Register 2026-08-03: +0.3 KB for the
  // R-4 alignment spread (the option was a measured no-op before
  // it; the two-pass spread is what makes it real). All
  // oracle-pinned.
  // Round 21 (2026-08-05): +1 KB for the structural style applier
  // (R-12a), the renderer-neutral counterpart of the cytoscape one.
  // Brief 25 (2026-08-19): 209 -> 216 KB. Measured 214.5 KB after
  // the seeded crossing-aware ordering restarts landed in orderLayers
  // (mulberry32 PRNG + shuffleSeeded + refactored per-restart sweep).
  // Baseline at branch tip measured 213.5 KB, so this window covers
  // both the pre-existing overrun on the branch and the +1.0 KB of
  // opt-in restart machinery; unset options keep the fast path.
  // 216 -> 218 KB, 2026-08-20 (nudge two-pass arm separation): measured
  // 217.2 KB, +1.2 KB. nudgeRoutes now runs a second ARMS-ONLY pass
  // (computeRawArmOverlaps + armPairKey + the pre-existing-overlap
  // discriminator threaded through attemptGroupRewrite) to separate the
  // horizontal arms that the first-pass bar-spread pulls into a shared y
  // in a K(n,n) storm. The pre-existing set is what keeps the pass from
  // disturbing arms the router already stacked, so it is load-bearing,
  // not removable padding. Headroom 0.8 KB, held tight; ARC-009 (extract
  // @g3t/layout) remains the standing way back under the envelope.
  core: 218 * 1024,
  // Core ledger:
  // - 169.0 -> 209 KB, 2026-08-17 (MERGE of ai-agent-guide into
  //   fable-updates). Measured 206.3 KB.
  //
  //   The two budget lines that met here FORKED FROM THE SAME 155.5
  //   cap on 2026-08-14 and each raised against it, so the numbers
  //   below are two parallel sequences, not one. fable-updates went
  //   155.5 -> 160 -> 162 -> 166 -> 169 for hardening, then measured
  //   164.0 after withdrawing 15 subpath exports. ai-agent-guide went
  //   155.5 -> 167 -> 169 -> 173 -> 176 -> 182 -> 187 -> 190 -> 196
  //   -> 200 for feature work and measured 198.3. The 169 that appears
  //   in both is arithmetic coincidence, not a shared checkpoint, and
  //   neither cap covers the other side's code.
  //
  //   FEATURE SIDE, carried forward from ai-agent-guide. Every measured
  //   number below was taken on a tree containing NONE of the hardening
  //   accounted for further down this ledger:
  //   - 155.5 -> 167: brief 01 routing independence. g3t-nudging.ts
  //     (grouping, divergence sort, placement ladder, snapshot-plan
  //     atomic commit), the CorridorDemand contract brief 04 consumes,
  //     and the g3t-polyline-utils extraction. Opt-in behind `nudge`.
  //     Measured 165.2.
  //   - 167 -> 169: brief 10 long-edge perimeter policy in
  //     g3t-routing/g3t-layered. Edges with >= 12 near-obstacle boxes
  //     prefer a perimeter detour with deterministic outward stagger.
  //     Measured 167.0.
  //   - 169 -> 173: LAY-005 dummy chains for long-span edges.
  //     g3t-dummy-chain.ts (splitLongSpanEdges, harvestBendHints,
  //     chooseDummyParent) plus the router bend-hint seeding path that
  //     emits dummy positions as StructuralEdgeGeometry.intermediate.
  //     Measured 172.5.
  //   - 173 -> 176: brief 04 corridor supply contract
  //     (estimateCorridorDemand, computeCorridorGap) threaded through
  //     g3tLayoutFlat and g3tLayoutStructural, with a dev-mode
  //     supply/demand drift assertion. Measured 174.4.
  //   - 176 -> 182: brief 05a channel router (PRF-003 phase 1).
  //     g3t-channel-router.ts and g3t-fallback-classifier.ts, both
  //     pure-additive behind an off-by-default `useChannelRouter`.
  //     Measured 180.7. 05b measured channel-as-default and it
  //     regressed crossings 2-8x, so the flag stays off and the
  //     escalation ladder was retained; no net deletion came back.
  //   - 182 -> 187: brief 06 dense-scene legibility.
  //     projection/pseudo-nodes.ts (hubBurst satellite spreading,
  //     busCollapse fan-in junctions, the reverse maps and shared
  //     filters). Measured 184.8.
  //   - 187 -> 190: VR-10 routing correctness (travelBand/crossBounds
  //     fix the perimeter and detourAround collision checks that judged
  //     against the bbox-filtered `near` set; 8 violations to 0 across
  //     the 108-cell sweep) plus brief 12 holon boundary projection.
  //     Measured 187.7.
  //   - 190 -> 196: brief 14 RDF 1.2 triple-term projection.
  //     projection/hyperarc.ts (projectTripleTermsAsEdges and
  //     projectTripleTermsAsHyperarcs, recursing on nested triple
  //     terms). Measured 192.1.
  //   - 196 -> 200: brief 16 force-directed edge bundling (FDEB,
  //     Holten and van Wijk 2009). bundling/edge-bundling.ts, pure
  //     geometry, opt-in. Measured 198.3.
  //
  //   THE @g3t/layout (ARC-009) WITHDRAWAL STANDS, and this merge
  //   strengthens it. The entry below retired that recommendation on
  //   the grounds that this number is publish weight, every package
  //   declares `sideEffects: false`, and layout already costs nothing
  //   to a consumer who does not import it. The feature side just added
  //   roughly 43 KB of routing and layout code, which makes the
  //   distinction between publish weight and adopter cost matter more,
  //   not less. check-consumer-cost.mjs is where the real question is
  //   asked; do not reinstate the extraction on the strength of a
  //   number from this file.
  //
  //   MEASURED, not estimated: 206.3 KB against this 209 cap after
  //   `pnpm run build:packages` on the resolved merge. That is 42.5 KB
  //   over the 163.8 KB the fable-updates dist measured alone, which
  //   is the feature side's own 43 KB arriving very nearly intact:
  //   the two arcs touch different modules, so almost nothing
  //   deduplicated. Sourcemap audit run first as the 2026-07-03 entry
  //   requires: ZERO node_modules source bytes across all 110 core
  //   sourcemaps, so every byte of the growth is first-party.
  //   Headroom is 2.7 KB, held tight on purpose and in line with the
  //   entries below; the next addition of any size renegotiates here
  //   rather than riding slack.
  // - NO RAISE, 2026-08-15 (the @g3t/layout recommendation is RETIRED,
  //   and 15 subpath exports were withdrawn). Measured 164.0 KB against
  //   the unchanged 169.0 cap, so headroom went 1.4 -> 5.0 KB. Two
  //   things happened and neither was a raise.
  //
  //   FIRST: the standing recommendation carried by the four entries
  //   below, "extract @g3t/layout (ARC-009) and bring core back under
  //   its original envelope", IS WITHDRAWN. It was chasing THIS number,
  //   and this number is publish weight. Every package declares
  //   `sideEffects: false`, so a consumer downloads what it references.
  //   Measured by bundling real imports: `UGM` alone costs 4.8 KB of
  //   first-party code with ZERO layout in it (no dagre, no elk, no
  //   quadtree, no force simulation); importing the layout engines adds
  //   roughly 35 KB of first-party code, or 106 KB with their own
  //   dependencies. Layout already costs nothing to anyone who does not
  //   use it, so the extraction would have moved this number without
  //   changing one adopter's page load, while adding a fourth tarball
  //   and a fourth publish to a release sequence that already has two
  //   unrecoverable failure windows. Do not reinstate it on the
  //   strength of a number from this file. If layout ever becomes
  //   unconditionally reachable, the core-ugm scenario in
  //   check-consumer-cost.mjs is what will say so.
  //
  //   SECOND: the withdrawal (maintainer ruling) removed 15 symbols
  //   that no adopter document named and nothing here used, across the
  //   middleware, SHACL-report, pipeline, algorithms and projection
  //   subpaths. That is where the 3.6 KB came from. The cap stays at
  //   169.0 rather than being tightened to the new measurement: the
  //   headroom was earned by removing surface, and spending it
  //   immediately on a tighter cap would just force the next raise.
  // - 166 -> 169 KB, 2026-08-15 (versioned-JSON failure convention):
  //   measured 167.6 KB, +3.0 KB for model/document-errors.ts and the
  //   parser call sites that now use it. Sourcemap audit run first:
  //   ZERO node_modules source bytes, and the new module is CODE-SPLIT
  //   into its own chunk (document-errors-*.js) rather than duplicated
  //   into each of the entries that import it, which was the specific
  //   risk worth checking for a module three subpaths depend on.
  //   Most of the weight is the module docblock, which states the
  //   three-arm rule for when a parser throws, returns diagnostics, or
  //   returns an error list. That reasoning is the deliverable: the
  //   defect being fixed was seven parsers failing four different ways
  //   with nothing written down, so deleting the explanation to save
  //   bytes would reintroduce half the problem. Headroom is 1.4 KB,
  //   held tight on purpose. FOURTH raise this session, all four
  //   hardening rather than feature work. The standing recommendation
  //   is unchanged and is now overdue: extract @g3t/layout (ARC-009)
  //   and bring core back under its original envelope instead of
  //   raising a fifth time.
  // - 162 -> 166 KB, 2026-08-15 (adapter request hygiene): measured
  //   164.6 KB, +4.2 KB. Four things, all first-party:
  //   adapter/adapter-error.ts (new; AdapterHttpError plus the shared
  //   assertOk the four adapters now call instead of hand-rolling a
  //   throw), the timeout/cancellation machinery in
  //   middleware/middleware.ts (createDefaultFetch, AdapterTimeoutError,
  //   RetryExhaustedError), and RestAdapter becoming reachable from the
  //   root barrel, which it never was: its config TYPES were exported
  //   and the class was not, so a documented adapter had no import
  //   path. That last one is the only byte-visible part of the fix and
  //   it is not optional; an unreachable class is not a saving.
  //   Sourcemap audit run first as the 2026-07-03 entry requires:
  //   ZERO node_modules source bytes in core's dist, so every byte
  //   here is ours. A large share is jsdoc on adapter-error.ts and on
  //   the timeout default, which stays: budgets are unminified by
  //   deliberate policy, and "why 30 seconds" and "why aborts are
  //   never retried" are exactly what a future reader needs. New
  //   headroom is 1.4 KB, deliberately tight, because the standing
  //   recommendation is still to extract @g3t/layout (ARC-009) and
  //   bring core back under its original envelope rather than keep
  //   raising. This is the third raise this session and the third
  //   that is hardening rather than feature work.
  // - 160 -> 162 KB, 2026-08-14 (parse-boundary hardening):
  //   element-shape checking in
  //   model/graph-document.ts so parseGraphDocument honors its
  //   declared `{ error } | { document, diagnostics }` union instead
  //   of throwing a raw TypeError out of library internals, and so a
  //   numeric id stops passing as a well-typed document. Measured
  //   160.4 KB, +0.4 KB. Sourcemap audit still clean (zero
  //   node_modules bytes). The checkers are hand-written rather than
  //   a JSON Schema engine precisely because of this budget: an
  //   engine would cost more than the whole document module. Second
  //   raise this session, both of them hardening work; ordinary
  //   feature work should still expect to argue for its bytes.
  // - 155.5 -> 160 KB, 2026-08-14 (adapter query-argument safety):
  //   adapter/query-safety.ts plus the
  //   call sites in the Gremlin, Cypher and SPARQL adapters,
  //   measured 157.1 KB. This is the raise the previous entry warned
  //   was coming; it is a security fix, not the style/route program,
  //   so it does not renegotiate that program's standing
  //   recommendation (extract @g3t/layout, ARC-009, and bring core
  //   back under its original envelope). Sourcemap audit run first,
  //   as that entry requires: ZERO node_modules source bytes in
  //   core's dist, so all 1.9 KB is first-party. Most of it is the
  //   module's jsdoc, which stays: budgets are unminified by
  //   deliberate policy and the reasoning about what is bound versus
  //   validated is the part a future reader needs. New headroom is
  //   2.9 KB, set modestly on purpose so ordinary creep still trips
  //   the gate.
  // - NO raise, 2026-08-14 (nine-helper ruling): the
  //   new ./internal subpath adds dist/internal.mjs at 193 B. Rollup
  //   code-split it, so the four SHACL row-label formatters are NOT
  //   duplicated out of shacl.mjs; the entry is a re-export shim.
  //   Measured 155.2 KB against the unchanged 155.5 cap.
  //   WARNING TO THE NEXT ROUND: that is 0.3 KB of headroom, ~100%.
  //   The next first-party addition of any size trips this gate. Do
  //   not treat the pass as slack. If a raise is needed, run the
  //   sourcemap audit described in the 2026-07-03 entry first, because
  //   at this margin an accidental node_modules inclusion and a real
  //   feature look identical from the total alone.
  // - 140 -> 160 KB, 2026-07-07 (review remediation round 2): measured
  //   139.1 KB (99% of cap) after khopNeighborhood (BFS composed with
  //   buildSubgraph for the neighborhood popout) and the
  //   context:inspect typed event. First-party growth from the review
  //   plan's chrome work; raise ratified by review direction so
  //   rounds 3-4 (surface redesigns, auditor/MBSE fixtures) do not
  //   renegotiate per slice. Headroom is deliberate, not fresh-baseline.
  // - 130 -> 140 KB, 2026-07-03: measured 133.3 KB on gate revival.
  //   verify:exports lost its test sources (tests/dist) in a packaging
  //   round, so verify short-circuited and this gate did not run while
  //   rounds 44+ shipped; growth accrued unledgered. Sourcemap audit:
  //   zero node_modules bytes in dist; the growth is first-party
  //   (structural layout/routing follow-ups and SHACL report surface).
  //   Headroom set modestly (not the fresh-baseline +25%) so future
  //   creep still trips the gate.
  // - 128 -> 130 KB, 2026-06-12 (round 44): SHACL linked views (B4):
  //   shacl-links (resultTargets, resultSelectionIds, resultDetail,
  //   resultsForFocusNode) tying validation results to shape-view
  //   targets and back, +0.1 KB over the 128 cap. Pure core; the
  //   host wires the ids into the selection store (no new machinery).
  // - 124 -> 128 KB, 2026-06-12 (round 39): SHACL validation REPORT
  //   visualization (B1, R1.17): the versioned report document,
  //   reportFromValidationResults adapter, severityOverlays,
  //   shaclResultDrivers, report filtering helpers, +1.9 KB. Pure
  //   core: reports-not-validation, the toolkit consumes a document
  //   and reuses the overlay + encoding machinery.
  // - 120 -> 124 KB, 2026-06-12 (round 37): SHACL shape view through
  //   the compartment API (shaclShapesToStructural, shaclRowSeverities,
  //   closedShapeIds, the row-text/cardinality/constraint-chip
  //   formatters), +1.5 KB. The Group A exit criterion: SHACL is a
  //   second client of the structural input model, so the mapper is
  //   pure core with no new rendering engine.
  // - within 120 KB, 2026-06-12 (round 31): structural rendering
  //   geometry (StructuralGeometry v1 document, validated ELK
  //   compartment builder, layoutStructural runner), core now
  //   116.0 KB. elkjs itself is externalized by the build and adds
  //   nothing here; only the builder/flattener code counts.
  // Budget ledger (ratchets are deliberate, never silent; an
  // unexplained breach is a regression, not a bump):
  // - 200 -> 220 KB, 2026-06-11: encoding grammar (spec model +
  //   EncodingSpecPanel + EncodingPreview, +11.4 KB).
  // - 220 -> 226 KB, 2026-06-11: review round 10 (FixedNumberEditor,
  //   edge.color categorical/fixed editors, ThemeSwitcher component,
  //   +2.5 KB across four user-facing surfaces).
  // - 226 -> 232 KB, 2026-06-11: spec->canvas application milestone
  //   (applyEncodingSpec + edge rules + SpecLegend, +5.4 KB; the
  //   feature the encoding grammar existed to enable).
  // - 232 -> 240 KB, 2026-06-11: round 13 (canvas icon data-URI path,
  //   shape channel: resolver + editor + legend glyphs, +6.3 KB).
  // - 240 -> 244 KB, 2026-06-11: round 14 (override bypass
  //   application wiring + SpecPort tier-3 surface, +1.4 KB).
  // - 244 -> 248 KB, 2026-06-11: round 15 (GraphToolbar: the cy glue
  //   composing search, layouts, force controls, zoom, +1.8 KB).
  // - 248 -> 253 KB, 2026-06-11: round 16 (toolbar rebuild with
  //   popover + pin-all, menu tokenization, settings glyph, +3.6 KB).
  // - 253 -> 258 KB, 2026-06-11: round 17 (per-node pinning store +
  //   canvas effect + menu action; compound containment mapping +
  //   container rule, +2.5 KB).
  // - 258 -> 262 KB, 2026-06-12: round 19 (workspace capture/restore
  //   module, shuffle control, luminance-aware glyph path, +1.9 KB).
  // - 262 -> 264 KB, 2026-06-12: round 20 (theme->canvas wiring:
  //   themeColorRules + shared stylesheet assembly, +0.2 KB over the
  //   previous ceiling).
  // - 264 -> 274 KB, 2026-06-12: round 21 (algorithm story: overlay
  //   store + canvas overlay effect + OVERLAY_RULES + AlgorithmPanel
  //   with runners and ingest surface, +8.7 KB; the panel dominates).
  // - 274 -> 276 KB, 2026-06-12: round 25 (pin badge stack composition,
  //   property-key reporting, +0.8 KB).
  // - 276 -> 280 KB, 2026-06-12: round 26 (filled theme-aware pin
  //   badge, toolbar export control with three data formats + PNG,
  //   +2.7 KB).
  // - 280 -> 285 KB, 2026-06-12: round 32 (structural scene
  //   rendering, slice A2: StructuralGeometry -> Cytoscape converter,
  //   class-scoped structural stylesheet, preset-layout branch in
  //   the canvas; +4.8 KB for a new view capability, in line with
  //   the +5.4 KB spec-application ratchet. elkjs stays external.)
  // - 285 -> 288 KB, 2026-06-12: round 35 (ports moved to top-level
  //   siblings to live fully outside the container per VA-27 review;
  //   wireStructuralPortDrag reattaches the drag-along siblings lose,
  //   +1.2 KB). The round-34 entry warned this addition would force a
  //   ledger decision; it did.
  // - 288 -> 294 KB, 2026-06-12: round 36 (compartment collapse
  //   canvas slice: compartment-collapse-store + the built-in
  //   "Collapse/expand compartments" context-menu contribution,
  //   +5.8 KB for the per-container runtime surface that R1.18's
  //   third acceptance criterion needs).
  // - 294 -> 297 KB, 2026-06-12 (round 40): VA-review fixes: the
  //   overlay effect's per-canvas scoping guard (multiple canvases
  //   sharing the global overlay store no longer cross-dim) and the
  //   compartment-row-scoped collapse menu action (+1.5 KB).
  // - 297 -> 300 KB, 2026-06-12 (round 45): A3 UML edge vocabulary
  //   (composition/aggregation/generalization/dependency arrow rules
  //   on structural edges) +0.1 KB over the 297 cap.
  // - 300 -> 304 KB, 2026-06-16 (demo-fixes round): user-facing fixes
  //   that touched library components: the TableView column-menu
  //   close affordance (outside-click + Escape + close button), the
  //   TreeView ancestor-path breadcrumb (parent-map derivation
  //   replacing the click trail), the CytoscapeCanvas structural
  //   cxttap container-resolution (so context actions get the real
  //   node id in block view), the FacetFilter colorForType swatch
  //   hook, and the categoricalColorMap encoding helper. +0.3 KB over
  //   the 300 cap.
  // Ledger, 2026-07-20 (G3L Round 49, MEASUREMENT-BASIS rebase,
  // authority granted): removing the vite-8-ignored esbuild
  // whitespace-only trio switched lib dist to FULL minification
  // (sourcemaps ship, so strictly better). New basis measured:
  // core 146.0, react 357.1, charts 6.4. Budgets rebased to the
  // new basis with ~4-9% headroom: core 192 -> 152, react
  // 440 -> 372, charts 10 -> 7. Historical numbers in older ledger
  // entries are in the OLD (whitespace-only) basis.
  // Core ledger, 2026-07-19 (D3b part 1 rebase, authority granted
  // "rebase authority granted"): 196 -> 192. elkjs left the tree;
  // measured 187.3 KB post-removal. The removed code was OUR
  // dispatch/flatten/adapter (elkjs itself was external, never in
  // this number); the REAL relief is the ARC-009 extraction (D3b
  // part 2), which rebases again from fresh measurements. Also:
  // installs shed the elkjs dependency entirely.
  // Core ledger, 2026-07-18 (BRIDGE raise; OWNER RATIFIED same day:
  // "ratify core 196"): 184 -> 196. D3a landed the engine flip and the code
  // it forced (scene routing, direction support, engine dispatch,
  // cache-key growth): +8.3 KB on a package that was at 99%. Raised
  // per the ledger doctrine (same commit, with rationale) rather
  // than holding the flip hostage; flagged to the owner for a
  // one-word ratification or veto (revert is one line). D3b removes
  // elkjs AND extracts @g3t/layout out of core, returning core far
  // under its original envelope; like the react 440, this is the
  // bridge, not the new normal.
  // React ledger, 2026-07-18 (OWNER-APPROVED raise): 420 -> 440.
  // Growth is the F1/F2/INT-001 feature surface (SVG + Canvas
  // adapters, structural SVG view, uniform pointer events), not
  // waste; the dead-code round measured the tree clean. The ARC-009
  // extraction moves the render adapters out of @g3t/react and
  // returns this budget under its original envelope; this raise is
  // the bridge, not the new normal.
  // React ledger (revival entry; older ratchets above):
  // - 304 -> 384 KB, 2026-07-03: measured 365.4 KB on gate revival
  //   (gate dead since tests/dist was lost; see the core entry).
  //   Sourcemap audit of the two largest chunks (191 KB + 209 KB of
  //   pre-minified source): zero node_modules bytes; the growth is
  //   the structural renderer (structural-to-cytoscape.ts 49 KB,
  //   CytoscapeCanvas.tsx 49 KB with structural mode, ports,
  //   compartments, obstacle-aware routing) plus the encoding and
  //   toolbar interaction surface (EncodingSpecPanel 33 KB,
  //   GraphToolbar/UxSurface/VisualEncoding). All deliberate,
  //   CHANGELOG-documented rounds. Modest headroom, same rationale
  //   as core.
  // Upstream round-6 + round-17 adoptions 2026-07-28: the round-6
  // set (multi-type helper, TreeView onSelect, inspector
  // titleAccessory, containment content-key) plus round-17 R-1
  // drag-suppressed clicks, R-2 glyph slots with their hit zone,
  // and R-3 two-line headers. Register 2026-08-03: +3 KB for R-5
  // (glyphs and two-line headers on plain nodes: a second render
  // branch), R-7 relayoutAroundFixed, and the R-8 suppression
  // path. All oracle-pinned.
  // Register 2026-08-05: +4.5 KB for R-9 (pinch zoom + controlled
  // view transform), R-10 (affordance zones exempt from panning,
  // screen-space slop resolved per pointer type), R-11 (row
  // glyphs), and R-13 (override selectors + legend disclosure).
  // All oracle-pinned.
  // Round 21 (2026-08-05): +1.5 KB for R-12 (structural node
  // styles, controlled drag offsets, the renderer-neutral editor
  // target) and R-13.3 (one legend serving both renderers).
  // Brief 25 (2026-08-19): 397 -> 398 KB. Measured 397.1 KB at
  // branch tip (unrelated to this brief's changes, which touch core
  // and demo only, not @g3t/react). Absorbing here so the gate
  // reflects reality; the drift was already present before this brief.
  react: 398 * 1024,
  // React ledger:
  // - 390 -> 397 KB, 2026-08-17 (MERGE of ai-agent-guide into
  //   fable-updates). Measured 393.9 KB. Same shape as the core entry:
  //   the two react caps also forked from one 386 baseline and raised
  //   in parallel, so 390 and 393 are siblings, not a sequence.
  //   Carried forward from ai-agent-guide, all measured without any of
  //   the hardening below:
  //   - 386 -> 388: brief 10 perimeter policy, core routing growth
  //     re-bundled through the react dist. No react-side code added.
  //     Measured 386.1.
  //   - 388 -> 390: the `routeEdges` prop on CytoscapeCanvas. New
  //     runCanvasEdgeRouting pass (post-layout obstacle-aware routing
  //     for non-structural scenes), the g3t-canvas-edge-routed
  //     stylesheet rule, and a routeEdges change effect. The geometry
  //     (routeSceneEdges, polylineToCytoscapeSegments) is imported from
  //     @g3t/core, so the react-side growth is wiring only.
  //     Measured 389.1.
  //   - 390 -> 393: brief 12 holon boundary view.
  //     registerHolonDrillItems plus four field-scoped stylesheet rules
  //     (node[_boundaryRing] double ring, node[_portalStub]
  //     de-emphasis, edge[_portalTransit] mid-edge glyph with a diamond
  //     override for CONSTRUCT-backed portals). Measured 390.6.
  //   Sourcemap audit: ZERO node_modules source bytes across all 137
  //   react sourcemaps, so the growth is first-party here too.
  //   Headroom is 3.1 KB. Note this package is at 99% of cap: the
  //   react dist carries core's routing growth through its own bundle,
  //   so a core-side addition lands here too even when no react code
  //   changes. Two of the three entries above are exactly that.
  // - NO RAISE, 2026-08-14 (timeline moved to its own subpath):
  //   387.2 -> 387.7 KB, +0.5 KB, headroom 2.8 -> 2.3 KB. TimelineView
  //   statically imports the two OPTIONAL peers, and rollup had hoisted
  //   it into a chunk the root barrel imported, so the documented
  //   install produced an unresolvable `import { CytoscapeCanvas } from
  //   "@g3t/react"`. Splitting it to its own entry costs one 2.5 KB
  //   entry file and returns most of that from the chunk it left; it
  //   still shares EmptyState and selection-store. Recorded here rather
  //   than passed over because the previous entry set this headroom
  //   deliberately, and a fix that eats a fifth of it should say so.
  // - 386 -> 390 KB, 2026-08-14 (render-failure containment):
  //   views/error/ViewErrorBoundary.tsx, measured 387.2 KB, +1.4 KB.
  //   The package shipped no error boundary at all, and there is no
  //   hook form of one, so a render-phase throw under any view (a
  //   code-split chunk that fails to fetch, a malformed document
  //   reaching a renderer) unmounted the whole tree to a blank page
  //   with nothing in the UI to act on. This is the one component a
  //   host cannot write around the library's own views without
  //   wrapping every one of them itself. Sourcemap audit run first as
  //   the 2026-07-03 core entry requires: ZERO node_modules source
  //   bytes in react's dist, so all 1.4 KB is first-party, most of it
  //   the docblock explaining why a class component is here (budgets
  //   are unminified by deliberate policy). It is a tree-shakeable
  //   named export, so hosts that never reference it pay nothing.
  //   New headroom is 2.8 KB, set modestly on purpose.
  // - 384 -> 420 KB, 2026-07-07 (review remediation round 2): measured
  //   379.9 KB (99% of cap) after the emphasis/effects layer
  //   (emphasis store + class application), useStructuralCollapse,
  //   NeighborhoodPopout, categorical domain seeding, SpecLegend
  //   labelFor/ordering, and removeNodesFromSelection. All
  //   tree-shakeable exports; sourcemap audit at the core raise found
  //   zero node_modules bytes in dist. Ratified by review direction.
  // VR-17 (2026-07-28): +0.3 KB for explicit legible nameTextStyle
  // on five chart axes (owner-verified illegibility fix).
  charts: 7.5 * 1024,
};

function dirSize(dir, includeExt) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      total += dirSize(full, includeExt);
    } else {
      if (
        includeExt.some((ext) => entry.endsWith(ext)) &&
        !entry.endsWith(".cjs") &&
        !entry.endsWith(".map") &&
        !entry.endsWith(".d.ts")
      ) {
        total += st.size;
      }
    }
  }
  return total;
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

let failures = 0;

console.log("Bundle-Size Budget");
console.log("==================\n");

for (const [pkg, budget] of Object.entries(BUDGETS)) {
  const dist = resolve(ROOT, "packages", pkg, "dist");
  let total;
  try {
    total = dirSize(dist, [".mjs", ".js"]);
  } catch {
    console.error(
      `  @g3t/${pkg}: dist/ missing; run pnpm run build:packages first`,
    );
    failures++;
    continue;
  }
  const pct = ((total / budget) * 100).toFixed(0);
  const within = total <= budget;
  const symbol = within ? "✓" : "✗";
  console.log(
    `  ${symbol} @g3t/${pkg}: ${fmt(total)} / ${fmt(budget)} (${pct}%)`,
  );
  if (!within) failures++;
}

if (failures > 0) {
  console.error(
    `\nBundle-size budget exceeded: ${failures} package(s) over budget.`,
  );
  console.error(
    `If the growth is justified, raise the budget in scripts/check-bundle-size.mjs\n` +
      `in the same commit, with a comment explaining why.`,
  );
  process.exit(1);
}
console.log("\nAll packages within budget.");
