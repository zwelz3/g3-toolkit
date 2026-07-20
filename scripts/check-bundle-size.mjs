#!/usr/bin/env node
/**
 * Bundle-size budget (P6).
 *
 * For each published package, compute the total ESM dist size and
 * compare against a budget. Fails if any package exceeds its budget.
 *
 * The "total ESM" is the sum of every `.mjs` and `.js` file in the
 * package's `dist/` directory, EXCLUDING `.cjs` (CommonJS) and `.map`
 * (source maps). Shared chunks Rollup extracts during the multi-entry
 * build count.
 *
 * Budgets are unminified bytes; this is intentional because the
 * unminified surface is what consumers actually pull through their own
 * bundlers. Consumers minify in production.
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
  core: 192 * 1024, // 184 KB
  // Core ledger:
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
  react: 440 * 1024, // 420 KB
  // - 384 -> 420 KB, 2026-07-07 (review remediation round 2): measured
  //   379.9 KB (99% of cap) after the emphasis/effects layer
  //   (emphasis store + class application), useStructuralCollapse,
  //   NeighborhoodPopout, categorical domain seeding, SpecLegend
  //   labelFor/ordering, and removeNodesFromSelection. All
  //   tree-shakeable exports; sourcemap audit at the core raise found
  //   zero node_modules bytes in dist. Ratified by review direction.
  charts: 10 * 1024, // 10 KB
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
  } catch (err) {
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
