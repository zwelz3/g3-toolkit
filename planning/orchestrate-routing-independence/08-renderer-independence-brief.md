---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 08: renderer independence -- native canvas replaces cytoscape (Tier 3a)

Owner ruling (Jake, 2026-08-14, A15): complete dependency
independence INCLUDING the renderer. This supersedes brief 07's
"Tier 3 out of scope" clause. Clean-room rule unchanged: no cytoscape
source is read during IMPLEMENTATION; behavior parity is defined by OUR
conformance and e2e suites, not by matching cytoscape internals. Plan
authorship and documentation may reference cytoscape event names and
calling conventions to accurately describe what is being replaced; the
clean-room rule applies to implementation code files only.

## What already exists (verified in tree, 2026-08-14)

The native path is not greenfield:

- `canvas2d/display-list.ts` + `canvas-adapter.tsx` -- RND-004 stage 1:
  pure buildDisplayList (conformance-tested) + a thin 2D-context
  replayer with HiDPI scaling and `hitTestScene` wiring.
- `views/conformance/adapter-conformance.test.tsx` -- the cross-adapter
  contract suite (svg + canvas2d) that DEFINES renderer parity.
- `structural-svg-view.tsx` -- the structural path already renders the
  g3t engine output with zero cytoscape.
- Core owns the semantics: StyleEngine/resolveStyles, visual
  attributes, LOD, hit-test, layouts (post 03-05 + 07 Tier 1). The
  cytoscape layer is projection + interaction, not intelligence.
- Internal coupling to cytoscape is narrow within the library source:
  `GraphToolbar` imports `type { Core }` (the `cy` prop) -- that is the
  primary internal site the S6 cutover must break. The adopter-side
  breaking surface is wider: any TypeScript consumer who passes or
  references the `cy` prop will get a compile-time error when the prop
  type changes, and any JavaScript consumer calling `cy.*` methods on the
  returned handle will get runtime failures. The wiring guide must
  enumerate the full adopter migration surface, not only the internal
  library site.

## Stages (each gate-green before the next)

1. **S1 usage audit**: enumerate every cytoscape API call in
   CytoscapeCanvas.tsx and friends (~96 references -- note: this
   approximation may undercount re-export chains and `import type { Core }`
   type-only imports; the matrix pass must use full AST traversal, not
   grep) into a capability matrix: needed / already-native / drop.
   Output checked into roadmap/design/renderer-capability-matrix.md.
   Timebox: if S1 surfaces cytoscape APIs with no native analog
   (compound node layout semantics, plugin hook contracts relied on by
   consumer code), stages S2-S5 require a replanning decision before
   proceeding; do not silently absorb unbridgeable gaps into S2 scope.
   The matrix must explicitly flag any consumer use of `cy.json()` or
   `cy.getElementById()` -- these methods are not carried forward in the
   NativeRendererHandle (see S6); if consumer code depends on them, the
   handle must be extended before S6 ships.

2. **S2 scene + camera**: native scene component (force/general path)
   on the canvas2d adapter: nodes/edges from UGM via the existing
   attribute resolution (bypassing visual-attributes-to-cytoscape),
   cameraController pan/zoom (already renderer-agnostic), fit/zoom-to.
   Camera/position-stability doctrine (CLAUDE.md) is a conformance
   TEST here, not prose: same-graph prop changes never re-init,
   restyle only.

   Minimap requires a rebuild in S2, not reuse. Verified in tree:
   `packages/react/src/interaction/camera/Minimap.tsx` imports
   `type { Core, NodeSingular } from "cytoscape"`, subscribes to
   `cy.on("render", schedule)` for repaint triggers, calls
   `cy.nodes()`, `cy.elements().boundingBox()`, `cy.extent()`,
   `cy.edges().forEach()`, and `cy.nodes(":orphan").forEach()` to
   build its thumbnail. None of these exist on the native adapter.

   S2 must define an internal render-notification contract in the
   canvas2d adapter layer (e.g., a TypeScript callback type or an
   event emitter interface) that the Minimap rebuild subscribes to.
   This internal contract is the stable signal from S2 through S6; it
   must be committed as a typed definition, not left as an implicit
   hook, so that the S6 NativeRendererHandle simply re-exports the
   same signal as `on("render", ...)` without refactoring what S2
   wired. The bounding-box query and node/edge iteration must be wired
   through the display-list or the same adapter layer. S2 gate criteria
   must include a Minimap conformance test that verifies thumbnail
   redraws on pan/zoom/layout events and correct viewport-rectangle
   tracking.

3. **S3 interaction parity**: element-pointer-events (already
   SceneHit-shaped), drag, multi-select, hover, context-menu
   anchoring, compound expand/drag semantics from the structural path.

   Two modules in S3 are cytoscape-coupled and require reimplementation,
   not wiring:

   - **box-selection-sync** (`packages/react/src/views/canvas/box-selection-sync.ts`):
     verified in tree -- binds `cy.on("box", ...)` (a cytoscape-internal
     per-element event fired before cytoscape's own select pass),
     collects node ids, and flushes via `cy.elements().unselect()`.
     The timing contract (microtask after boxend) and the
     class-not-`:selected` convention can be preserved; only the
     event source changes. The canvas2d adapter (verified in tree:
     `packages/react/src/views/canvas2d/canvas-adapter.tsx`) does not
     currently emit a box-gesture event. Adding a box-gesture signal to
     the canvas2d adapter is an unlisted S3 prerequisite that must be
     completed before the box-selection-sync replacement can be wired.
     The replacement must subscribe to that adapter signal rather than
     a cytoscape event. S3 gate must include a box-selection conformance
     test that verifies the same timing behavior reproduced in
     `box-selection-sync.test.ts`.

   - **drag with routed-segment bypass**: verified in tree --
     `applyRoutedSegmentBypass` in
     `packages/react/src/views/canvas/structural-to-cytoscape.ts`
     applies segment geometry to a Cytoscape edge via the per-element
     style bypass API (`edge.style(...)` / `edge.scratch()`). On the
     native adapter this mechanism does not exist; drag write-back
     must update the display-list segment data directly. S3 gate must
     cover live drag of a routed structural edge and verify the route
     updates without artifact.

4. **S4 style parity**: theme/spec/override/overlay/pin precedence
   (the five-mechanism doctrine) resolved entirely by core StyleEngine
   onto display-list ops; the g3t-ov-* class and bypass mechanisms
   become explicit attribute layers. Okabe-Ito + `properties._color`
   precedence per the haunt lesson.

   S4 gate criterion: extend `packages/core/src/style/style-engine.test.ts`
   with a test suite that verifies display-list op output for each of
   the five precedence layers (theme < spec < override < overlay < pin)
   in isolation and in combination, confirming the correct layer wins at
   each precedence boundary. S4 is green when that suite passes and the
   adapter-conformance suite shows no style-layer regressions.

5. **S5 layout wiring**: native scene consumes Tier-1 layouts (g3t
   layered, native force, tidy tree, preset). No fcose.

   Position format compatibility: workspace snapshots and shared graph
   JSON that encode positions as x/y in UGM node data remain valid as
   preset-layout input because preset layout honors stored x/y
   coordinates. This applies to positions stored through the UGM
   serialization path (the documented adopter channel). Adopters who
   persisted positions by calling `cy.json()` directly (cytoscape's own
   serialization, which produces a different structure than UGM) have no
   covered migration path; the S1 matrix must flag any such usage and
   the wiring guide must address it. The "no special migration required"
   claim applies only to UGM-serialized positions. The "no fcose" change
   only means fcose is not available as a NEW layout option; adopters who
   relied on fcose as the default should be pointed to g3t-layered or
   native force in the wiring guide.

   Routing from brief 02/05 plugs in as segment ops in the display list.

   Rollback for S2-S5: S2-S5 changes are additive -- new components and
   adapter extensions are not wired as the default renderer until S6 PR
   6a. If a shipped S2-S5 commit introduces a regression in the existing
   cytoscape path, that commit is reverted via standard git revert. The
   freeze-dual-renderer-state stall handling (no further cytoscape
   changes during a stall) limits entanglement. No flag-off mechanism is
   required for S2-S5 reversals because S2-S5 code is not on the default
   rendering path.

6. **S6 cutover**: CytoscapeCanvas props surface moves to the native
   component. The component retains the `CytoscapeCanvas` export name
   for backward compatibility at the import site; the `cy` prop is
   removed and replaced by a typed native renderer handle. This IS
   a breaking change (v2.0.0): TypeScript adopters who reference
   `type { Core }` from cytoscape will get a compile-time error when
   the prop type changes; JS adopters calling `cy.*` methods will get
   runtime failures. The migration note in the wiring guide must name
   the removed prop, the replacement type, and every method on the
   replacement handle that was available on `Core`.

   Native renderer handle spec (the replacement for `cy: Core`):

   ```typescript
   // @g3t/react public API, v2.0.0
   export interface NativeRendererHandle {
     /** Export current view as a PNG data-URL (replaces cy.png()). */
     exportPng(opts?: { scale?: number }): string;
     /** Register a one-time or persistent render-frame listener. */
     on(event: "render", handler: () => void): () => void;
     /** Apply a batch of display-list updates atomically. */
     batch(fn: () => void): void;
     /** Return the current viewport extent in model space. */
     extent(): { x1: number; y1: number; x2: number; y2: number };
   }
   ```

   This surface covers `cy.batch()`, `cy.png()`, `cy.on()`, and
   `cy.extent()`. It does NOT include `cy.json()` or `cy.getElementById()`;
   those methods expose cytoscape's internal serialization and DOM query
   model, which have no direct equivalent on a display-list renderer. If
   the S1 matrix flags consumer use of either method, the handle must be
   extended with an appropriate replacement before S6 ships. The S1
   matrix entry for these two methods must specify whether an extension
   is needed or whether the usage can be eliminated at the call site.

   The wiring guide sections required for S6 are: removed `cy` prop,
   replacement NativeRendererHandle API, and a migration table for
   commonly-used `cy.*` methods (mapping each to its NativeRendererHandle
   equivalent or to the recommended elimination approach). Owner: S6
   implementor. Format: append to `docs/wiring-guide.md` following the
   existing snippet format. Deadline: the wiring guide sections must
   exist and be review-ready before PR 6a merges; they are a PR 6a
   ship criterion, not a follow-up.

   S6 is split into two PRs to bound revert risk:
   - PR 6a (cutover): wire native component behind CytoscapeCanvas
     name, merge feature flag off, run visual acceptance and perf
     budget in Pages playground with flag on, merge flag-removal
     follow-up only after sign-off. Emergency rollback: if flag-on
     reveals a critical regression, set the flag off immediately. The
     cytoscape rendering path is fully intact until PR 6b because
     S2-S5 changes are additive and do not touch the existing
     CytoscapeCanvas code path; flag-off restores the cytoscape
     renderer completely without reverting S2-S5 commits.
   - PR 6b (deletion): delete cytoscape, cytoscape-fcose, and
     @types/cytoscape from the package.json files in scope. Verified
     in tree: cytoscape dependencies appear in the root `package.json`
     (devDep: @types/cytoscape; peerDeps: cytoscape, cytoscape-fcose)
     and `packages/react/package.json` (peerDeps: cytoscape,
     cytoscape-fcose). @g3t/core has no cytoscape dependency. PR 6b
     touches these two files only. Merge only after PR 6a has been in
     production (Pages deployment) for one review cycle: defined as a
     minimum of five business days with active monitoring, zero
     regression reports, and explicit owner sign-off. This gate cannot
     be shortened or waived by the implementor.

   Dual-renderer existence is allowed between S2 and PR 6a only. If
   a stage stalls for more than one sprint the holding pattern is:
   freeze dual-renderer state (do not ship further cytoscape changes),
   triage root cause, and escalate to an owner decision before
   extending the stall. No open-ended dual-renderer window is
   permitted.

## Verification

- adapter-conformance suite extended to the full scene component and
  passing on the native adapter (it is the parity definition).
- The e2e Playwright suites (canvas, interaction, selection, drag-
  reroute, toolbar) run against the native renderer and pass.
- render-settle-probe perf budget: native settle time <= cytoscape
  baseline on the Scale shell's collapsed view AND on an expanded
  force-layout view at 500+ nodes; record both numbers.
- Accessibility: a conformance check (automated where possible, manual
  otherwise) must verify that any ARIA roles, focusable elements, or
  screen-reader labels currently present on the cytoscape canvas are
  preserved or explicitly declared dropped with owner sign-off. The
  native HTML Canvas element has no inherent ARIA semantics; any
  accessible affordance must be carried by the AriaCompanion overlay
  (`packages/react/src/a11y/AriaCompanion.tsx`), not the canvas element
  itself.
- Bundle ledger: expect a large SHRINK (cytoscape+fcose leave the
  peer surface); record it.
- Visual acceptance: Zach on the Pages playground, all shells.

## Kept platform (not "extra" deps -- the adoption contract itself)

react, react-dom, zustand stay: CLAUDE.md defines the three adopter
channels as zustand stores + props/callbacks + JSON documents; a React
component library replacing React is scope inversion. Dev-time
toolchain (vite, vitest, playwright, storybook, eslint) is not shipped
code and stays. Overridable by owner ruling only.
