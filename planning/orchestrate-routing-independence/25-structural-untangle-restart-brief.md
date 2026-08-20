---
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/brief-25-structural-crossing-aware-untangle-make-the-routing-6d4aa6b1
project: g3_toolkit
---
# Brief 25 — structural crossing-aware untangle (make the Routing Lab Re-layout real)

## Context (verified 2026-08-19 against the live tree — do not re-derive)

The Routing Lab ("edge-routing stress bench") renders through `StructuralSvgView` +
`useStructuralLayout`, NOT `CytoscapeCanvas`. Therefore the brief 22/23 smart-placement
work is absent from it by construction:

- `src/demo/routing/RoutingShell.tsx:36` imports `StructuralSvgView, useStructuralLayout`
  from `@g3t/react`; `:314` `const { structural: scene } = useStructuralLayout(input, options)`.
- `optimizePlacement` / `relayoutSignal` / `routeRefreshSignal` / `edgeClickIsolate` are
  wired ONLY inside `packages/react/src/views/canvas/CytoscapeCanvas.tsx` (`:1063`, `:2068-2122`).
  The Routing Lab never mounts CytoscapeCanvas.
- Brief 24's "Re-layout" button (`RoutingShell.tsx:268-273, 381-389`) bumps `relayoutNonce`
  to force `scenario.build(size)` to rebuild. But `scenario.build` is deterministic and
  `orderLayers` (`packages/core/src/layout/g3t-engine/g3t-layered.ts:309`) is deterministic
  barycenter+transpose with a fixed sweep budget and NO random seed. So the rebuild lands in
  byte-identical positions — the button is a visible no-op. THIS is the bug.

Do NOT wire `optimizePlacement` (free-2D hill-climb) into the structural view. The correct
structural analog is crossing-aware ordering with seeded random restarts.

## Hard constraint — preserve determinism

The default layout MUST stay byte-identical. Every existing structural snapshot/geometry test
depends on deterministic ordering. New behavior is OPT-IN via a new option that is unset by
default; when unset, `orderLayers` runs exactly as today (single deterministic pass).

## Changes required

### packages/core/src/layout/g3t-engine/g3t-layered.ts
- Add optional fields to the options that flow into `orderLayers` (thread from
  `StructuralLayoutOptions`): `orderSeed?: number`, `orderRestarts?: number` (default 1).
- Use a seeded PRNG (mulberry32 pattern already used in tests, e.g.
  `packages/core/src/scale/collapse-by-cluster.test.ts:15`) — no `Math.random`.
- When `orderRestarts > 1`: run that many initial-order permutations seeded from `orderSeed`,
  run the existing barycenter+transpose sweep from each, keep the arrangement with the lowest
  `crossings` (ties → keep first for stability). Respect the existing in-sweep deadline so the
  total stays inside budget; cap total restarts so a large scene cannot blow the frame budget.
- When `orderRestarts <= 1` or unset: behavior is EXACTLY today's single deterministic pass.

### packages/core/src/layout/structural.ts (StructuralLayoutOptions)
- Add `orderSeed?`, `orderRestarts?` to the options type and pass them through to `orderLayers`.

### src/demo/routing/RoutingShell.tsx
- Replace the no-op `relayoutNonce` rebuild with a real seed change: keep a `orderSeed` state,
  and the "Re-layout" button sets a fresh random seed and `orderRestarts` (e.g. 6). Feed both
  into the `options` useMemo (add to deps). `scenario.build(size)` no longer needs the nonce.
- Surface the achieved crossing count: the shell already computes `RouteQuality`
  (`RoutingShell.tsx:317`) — display the current crossing count near the Re-layout button so
  each press visibly shows crossings dropping/holding at best.

## Verification / acceptance
- With `orderRestarts` unset, `pnpm run gates` is green with ZERO structural snapshot changes
  (prove determinism held).
- In the Routing Lab on a tangled scenario (crossing-storm / K(n,n)), pressing Re-layout
  visibly re-arranges nodes and the displayed crossing count decreases or holds at the best
  seen; repeated presses converge, they do not oscillate worse.
- Nudge toggle behavior unchanged.
- `pnpm run gates` (all 5 steps) green; bundle ledger respected (add a rationale line if core grows).

## Build + deploy
    pnpm run gates
    git add -A && git commit -m "feat(routing): seeded crossing-aware untangle makes Routing Lab Re-layout real (brief 25)"
    pnpm run docs:build
    pnpm run preview --host
