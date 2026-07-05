# CLAUDE.md

Agent handoff for g3-toolkit. Current state: STATUS.md. History:
planning/ round logs (see planning/archive/ for retired efforts);
milestone-era tracking is archived in planning/milestone-history.md
(do not update it). Design records: roadmap/design/ (indexed in
roadmap/CLAUDE.md). Adopter surface: docs/wiring-guide.md (snippets
run in CI at examples/wiring/). Hand-maintained counts have drifted
several times; when a number disagrees with a gate script, the script
is right.

**CURRENT FOCUS (2026-07-03): demo quality, reliability, and OSS
adoptability.** The library is feature-stable (v1.0.0-rc.2). The
cinematic flagship demo was RETIRED per maintainer ruling: the four
dev-server shells replaced it, and every public API it alone
demonstrated was folded first (planning/flagship-retirement.md is the
audit; the flagship planning docs live in planning/archive/). The two
standalone single-file demos (scripts/demo, scripts/thread-demo) were
retired in the same round; the Pages-deployed playground supersedes
them, and the projection-pipeline story they carried now lives in the
wiring guide plus the biomedical shell's raw-vs-projected toggle. The
active plan is planning/demo-adoption-plan.md.

## What this is

A composable graph-visualization component LIBRARY (not a framework):
@g3t/core (zero React), @g3t/react, @g3t/charts. Hosts integrate via
three channels only: exported zustand stores, props/callbacks, and
versioned JSON documents (encoding spec, workspace snapshots,
algorithm results). New capability = expose through one of these +
wiring-guide snippet + executable twin in examples/wiring/.
TypeScript, React 19, Vite 8, pnpm (enforced), Cytoscape + Graphology,
Zustand, Vitest + RTL.

## Non-negotiable gates (run before claiming done)

    pnpm run gates
    # = typecheck && lint && verify && test, the exact ci.yml order.
    # verify builds the packages and runs the dist/export/smoke/bundle
    # checks; a round is not done on unit tests alone. Environment
    # self-test if typecheck seems suspiciously quiet: inject a
    # deliberate type error in src/ and confirm the gate goes red.
    pnpm run verify          # build, exports, snippets, typedoc, bundle ledger
    python3 scripts/lint_specs.py specs/
    python3 scripts/sync_spec_status.py
    python3 scripts/check_roadmap_coverage.py

NEVER pipe gate scripts through tail/head: it masks exit codes (this
shipped a red zip once). Check `$?` directly. Bundle growth requires
a written rationale in scripts/check-bundle-size.mjs (the ledger).

## Editing discipline (every lesson here was paid for)

- Every programmatic string replace gets an assert that the anchor
  exists, INCLUDING boring import edits. Prettier reflows anchors;
  silent no-ops recurred six times before this rule.
- Heredoc `cat >>` to a wrong filename creates an importless orphan
  test. Verify the target exists first.
- View a file immediately before editing it; re-view after edits.
- Spec citation policy: R-IDs in packages/ or scripts/ source strings
  COUNT as implementation citations (sync gate). Cite only what is
  truly implemented; otherwise reword. planning/ is exempt.
- Status changes ripple: flipping a requirement to implemented
  requires removing it from its roadmap Owns header AND the
  roadmap/CLAUDE.md index row (coverage gate enforces).

## Architecture doctrine (do not violate casually)

- core stays React-free. Heavy graph algorithms stay EXTERNAL
  (networkx/GraphBLAS); the toolkit consumes result documents.
- Canvas precedence by mechanism + namespace: theme = generic-selector
  stylesheet colors; spec = element data via attribute mappers
  (out-specifics theme by construction); instance overrides = bypass;
  overlays = g3t-ov-\* classes; pins = badge rule + node:locked.
  Instance pins shadow overlay borders BY DECISION.
- SAME INPUT GRAPH => the camera (pan/zoom) and node positions HOLD.
  Never re-init the canvas, refit, or recenter on a same-graph change
  (theme, spec, decorations, selection, hover). Re-init/refit ONLY on a
  genuinely different input graph (the node-id set changes) or an EXPLICIT
  user op: fit/zoom buttons, focus/zoom-to, reheat, or layout-algorithm
  selection. Enforcers in CytoscapeCanvas: theme/spec changes are
  restyle-only (style().fromJson, never re-init); decoration rebuilds key
  on CONTENT, not object identity (structuralDecorations is a fresh literal
  each render, so selection/hover must not recreate the instance);
  structural rebuilds capture pan/zoom in the effect cleanup and restore it
  on a same-graph rebuild, fitting only on first mount or a different graph.
  Fixture graphs in React are useMemo'd (referential stability contract).
  GAP: manual drags still reset on a genuine geometry change (collapse
  recreates from layout geometry); the force-directed path does not yet
  restore the camera across a same-graph re-init. See
  specs/09-design-decisions.md (camera/position stability).
- Data-mapped style props (`width: data(_size)`, `opacity:
  data(_confidence)`) MUST sit on a `[field]`-scoped selector
  (`node[_size]`, `edge[_confidence]`), never a bare `node`/`edge` rule.
  Cytoscape warns for every element missing the field on EVERY render
  frame; in the block view (structural elements carry _w/_h/_label, not
  the force-graph fields) that console flood stalled the canvas
  (~1.7s/toggle, diagnosed 2026-06-17). Negative `outline-offset` is
  rejected by Cytoscape (parse-time discard + one warning); an inset ring
  needs a border, not a negative offset.
- Reserved encoding channels reject by owner name; keep it that way.

## Working agreement with Zach

Analytical tone, no sycophancy, no em-dashes in authored content, no
day estimates (priority ordering only), plain immediate correction of
mistakes, complete verified outputs. Visual changes ship through the
Pages playground (and Playwright screenshots once baselines land); the visual-acceptance page was RETIRED 2026-07-04
with copy that tells the reviewer what to exercise; every round gets
a planning log entry, CHANGELOG entry, and a packaged zip + page in
outputs. Findings from his review get root-caused, not patched.

## Open threads (head of queue; full queue in STATUS.md)

**Structural-view rendering (current active thread, 2026-06-21).** Full
state in STATUS.md and `roadmap/design/structural-rendering.md`. Landed and
gate-green: camera/position stability (D15), port-based body-edge
attachment with perpendicular exit, and the obstacle-aware routing CORE
slice (`layoutStructural` emits ELK node-avoiding routes into
`geometry.edges`, option `routeEdges`, default on); and (2026-06-22) the
CONVERTER slice that renders them: `structural-to-cytoscape.ts` projects
each route polyline onto `curve-style: segments` (enum, so via a class) for
body and synthetic-point-port edges, taxi as fallback when routeEdges is off
or a route has no interior bend; declared-port edges keep the taxi exit on
purpose (the port fixes a perpendicular the projection would fight). Edge
rendering is NOT headlessly verifiable: IMMEDIATE NEXT is Zach's review via
the Pages playground (the visual-acceptance surface is retired), then A3 polish.
ALSO landed 2026-06-22: a Minimap component (@g3t/react interaction/camera;
Molecules/Minimap) wired into the gallery and the standalone demo, which
also gained a Graph/Structural view-switch. ALSO active: the Storybook
atomic-design reshape (Atoms/Molecules titled, Minimap included; Toolbar
moved to Compounds and Charts/Features to Reference; Coordinated Selection
and Node Editor Modal now in Patterns; remaining legacy retitles,
CytoscapeCanvas/Views/UX-Surface/Layouts, tracked in STATUS.md).

**Perf/warning fixes (2026-06-17, UNVERIFIED — await live review).**
Block-view lag and console floods were traced (via an instrumented
build) to per-frame Cytoscape data-mapping warnings, not React. Landed
and gate-green, but rendered behavior NOT yet confirmed by Zach: (1)
type-filtering is now a canvas `hidden` visibility op (a restyle, not a
re-init) with `animate={false}` on the demo canvases; (2) `data(_size)`
width/height scoped to `node[_size]`; (3) `data(_confidence)` opacity
scoped to `edge[_confidence]`; (4) inert `outline-offset: -2` removed
from the selected structural-row rule. LIVE CHECK NEEDED: filter hides in
place without re-layout, force view interactive immediately, block-view
console clean (no per-frame _size/_confidence warnings, no outline-offset
warning). DEFERRED, needs sign-off: theme-driven border inset for the
selected structural row (the Round-43 intent, which never rendered
because Cytoscape rejects negative outline-offset); a stable
structuralScene ref to drop the double structural re-init on
block-view-on; routing the Cytoscape Core out of React state/props
(changes GraphToolbar's public `cy` contract; profiling hygiene only,
not the felt runtime cost). The earlier block-view *freeze* (slow load)
fix from this session IS verified (Zach confirmed load is fast).

**Flagship demo (RETIRED 2026-07-03).** Removed per maintainer ruling
after the fold audit (planning/flagship-retirement.md): CoverageMeter
demonstrates in the decision-dashboards, ProvenanceTrace in the
auditor shell, and the camera/encoding/theme/path/export programmatic
APIs in the wiring guide with CI-executed examples. The beat-runner
narrative was deliberately dropped, recoverable from history.

**Demo/examples surface (supporting).** Four dev-server scenario shells
(`pnpm run dev`: Auditor, MBSE, Supply Chain, Biomedical) plus two
capability dashboards (examples/decision-dashboards: Analytics,
Schema). Showcase example deleted. Custom raster/logo icons supported
(isImageRef passthrough) and shown in Supply Chain. These are
desktop-only and AWAIT VISUAL REVIEW — the build can verify
compile/test/bundle but not rendered output; the reviewer (Zach) checks
cinematics, layout, and legibility live.

**Library roadmap (valid, not the current focus).** The grouped roadmap
(Groups A-G in STATUS.md) covers SHACL views, structural rendering,
provenance/virtualization affordances, analyst workflow, viz
algorithms, and streaming. Group A (structural rendering) and the SHACL
shape+report pair shipped. Remaining library items of note: SHACL B4
(linked shape/data views), the RDF SHACL shapes PARSER (fuller R1.16;
the biggest RDF gap, bounds in roadmap/design/shacl-views.md), and the
data-paradigm/scale gaps catalogued honestly in
planning/rdf-lpg-virtualization-audit.md (no shapes parser, no
reasoning, no canvas-level virtualization). Descope note: "Sankey
removed" / "virtualization rescoped" in older docs meant removed from
the ROADMAP, not the codebase — SankeyView and the virtualizer/
incremental-layout APIs are still shipped and exported.
