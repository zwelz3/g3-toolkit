# Brief 23 — refresh-routes / re-layout imperative ops + edge click-isolate (@g3t/react)

project: g3_toolkit
cwd: /GSystems/src/g3-toolkit
branch: docs/ai-agent-guide (local commit only; NO push, NO PR)
model: opus
part_of: orchestrate-routing-independence (advanced smart routing capability, A54)
depends_on: brief 22 (optimizePlacement must be exported from @g3t/core)

## Goal (owner ruling A54, verified against live tree 2026-08-19)

Expose the two developer ops through the PROPS/CALLBACKS channel of
`CytoscapeCanvas`, plus an opt-in edge click-to-isolate interaction:

1. **Refresh routes** — re-run the obstacle-aware routing pass on the CURRENT
   node positions WITHOUT moving any node. (Owner: "refresh route that calls the
   routing but does not move the objects so I can separate things and then have
   clean routes.")
2. **Re-layout (untangle)** — run `optimizePlacement` (brief 22) on the current
   scene, apply the new positions, then re-route. This is an EXPLICIT user op, so
   the camera/position-hold rule does NOT apply (same class as reheat/fit/zoom).
3. **Edge click-isolate** — click a line: it stays lit, everything else dims;
   click the SAME line again (or click empty canvas): all lines show again.

Owner deferred during-drag live routing ("might take too long") — the Refresh
button IS the explicit-op answer. Do NOT wire drag-time routing in this brief.

## Substrate (read these before editing; assert every anchor)

- `packages/react/src/views/canvas/CytoscapeCanvas.tsx`:
  - The routeEdges pass is a local routine (~lines 903-965, `runRouteEdgesPass`
    or similar — READ and confirm the name) run on `layoutstop` and on
    `free`/drag of incident edges, inside `cy.batch()`. Refresh-routes must call
    THIS SAME pass on demand over ALL visible edges (not just incident).
  - Props are destructured ~line 1098; `routeEdges` prop handled ~886, 1893-1941.
  - Edge tap today (~1565): `cy.on("tap","edge", e => selectEdges([id]))`.
    Background tap (~1570): `clearSelection()`. Node tap ~1554.
  - Emphasis store already subscribed ~1649-1652 via `applyEmphasisClasses`.
- `packages/react/src/state/emphasis-store.ts`: `useEmphasisStore` with
  `setPathEffect(nodeIds, edgeIds, label?)` (dims all, un-dims + lights the given
  edges) and `clear()`. Classes `g3t-effect-edge` / `g3t-effect-dim`. This is
  EXACTLY the isolate behavior — reuse it, do not build a new dim mechanism.
- CONFIRM the DEFAULT_STYLESHEET in CytoscapeCanvas has rules for
  `.g3t-effect-edge` and `.g3t-effect-dim`; if a non-structural canvas lacks
  them, add minimal rules (dim = lowered opacity; effect-edge = heavier stroke).

## Changes

### CytoscapeCanvas props (callbacks channel — multi-instance safe, no global store)

Add three props (READ the interface block first; add to the type + destructure):

- `routeRefreshSignal?: number` — when the value CHANGES (host bumps a counter),
  re-run the routeEdges pass over all visible edges on current boxes, in
  `cy.batch()`. No node movement. No-op when `routeEdges` is off/undefined or the
  scene is structural.
- `relayoutSignal?: number` — when the value CHANGES: read current visible node
  boxes + visible edge endpoint pairs, call
  `optimizePlacement(nodes, edges, { budgetMs: 350 })`, apply returned positions
  via `cy.getElementById(id).position({x,y})` inside `cy.batch()`, THEN re-run the
  routeEdges pass. Non-structural only. Because this is an explicit op, capturing
  and restoring pan/zoom is NOT required (unlike same-graph rebuilds).
- `edgeClickIsolate?: boolean` (default false) — when true, an edge tap calls
  `useEmphasisStore.getState().setPathEffect([], [edgeId], edgeId)` instead of
  plain select; tapping the currently-isolated edge again, or the background,
  calls `clear()`. Implement the toggle by reading the current
  `emphasizedEdgeIds` from the store (single-edge isolate) — do NOT add new
  React state; the store is the source of truth.

Wire the two signals with the SAME generation-guard discipline the existing
routeEdges effect uses (a ref holding the last-seen signal value; run only on a
real change; guard against the init effect double-running). Follow the existing
`routeEdgesKey` effect (~1893) as the pattern.

### Barrel / types

- Export any new public option types from `packages/react/src/index.ts` if the
  props reference new named types (prefer inline `number`/`boolean`, so likely no
  new export needed — confirm).

## Wiring guide + executable twin (REQUIRED — three-channel doctrine)

- `docs/wiring-guide.md`: add a short section "Refresh routes / re-layout /
  isolate an edge" showing a host that keeps `routeRefreshSignal`/`relayoutSignal`
  counters in state, bumps them from buttons, and sets `edgeClickIsolate`.
- `examples/wiring/src/`: add an executable twin test that mounts CytoscapeCanvas
  with the signals + `edgeClickIsolate`, bumps a signal, and asserts the routing
  pass ran / an edge isolate lit (the snippets run in CI — keep it RTL-shaped like
  the neighboring wiring examples).

## Tests

- A canvas test: bumping `relayoutSignal` moves nodes (positions change) and
  leaves the node-id set intact (no re-init); bumping `routeRefreshSignal` leaves
  positions unchanged. Use the existing CytoscapeCanvas test harness patterns
  (jsdom fake cy where needed).
- An edge-isolate test: with `edgeClickIsolate`, a simulated edge tap sets the
  emphasis store to that single edge; a second tap clears it.

## Gates + landing + known reds

Same as brief 22: run full `pnpm run gates` ($? directly, no tail), python3 for
spec gates, honor the bundle ledger, distinguish the 3 documented pre-existing
reds via `git stash`. Local commit only, NO push/PR. Emit a kb:Decision
(props-channel signal-counter design over a global command store, for
multi-instance safety) + kb:Gotcha if the emphasis stylesheet had to be extended.
outcome.json + one-line stdout.

## Acceptance

- `routeRefreshSignal`, `relayoutSignal`, `edgeClickIsolate` on CytoscapeCanvas.
- Refresh re-routes without moving nodes; Re-layout untangles + re-routes; edge
  click isolates with click-again/background-clear toggle.
- wiring-guide section + executable twin added; `pnpm run gates` green except the
  three documented pre-existing reds.
