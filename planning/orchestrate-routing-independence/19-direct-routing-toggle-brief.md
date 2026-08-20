---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 19: direct-unless-crossing routing default + per-shell routing pulldown

Owner ask (Jake, A22): "on all demos that use advanced routing, a
toggle/pulldown for routing. It should route DIRECT as a default, with
Z-routing only when the direct line crosses a node."

Today the scene router (`routeEdges`) forces axis-aligned L/Z bends on
EVERY edge, even a clear diagonal shot through open space — that is the
"orthogonal-on-force" look now on the playground. This brief makes the
straight line the default and reserves the orthogonal detour for edges
whose direct segment actually crosses a node box.

Three forks were resolved by the owner to these defaults (do NOT
re-litigate; implement as written):
- **3-state pulldown**: `Direct (auto-Z on crossing)` / `Orthogonal
  (always)` / `Off (bezier)`. Preserves today's always-orthogonal look
  as a selectable option.
- **Library-wide default**: `direct-unless-crossing` becomes the
  default routing mode for the `routeEdges` prop itself, so adopters
  (AnalyticsDashboard example, wiring guide) get the softer look too.
- **Scope**: the 8 scene-routing shells only. Do NOT touch the
  structural / MBSE block router (`g3t-structural`) — it is a separate,
  inherently-orthogonal engine and is out of scope.

## Ground truth (verified in source 2026-08-19, cite these exact sites)

- `packages/core/src/route/route-scene-edges.ts`
  - `routeSceneEdges(nodes, edges, opts)` at line 87 loops every edge
    and calls `routeOrthogonal(...)` UNCONDITIONALLY at line 109. There
    is no crossing pre-check.
  - `RouteSceneOptions` (line 38) currently carries only `clearance` /
    `bendPenalty` / `minStub`. This is where the new `mode` field lands.
  - `boxCenter` (line 81) and the per-edge `sc`/`tc` box centers
    (lines 101-102) plus the `obstacles: RouteBox[]` array (lines
    104-108) are already computed in the loop — the crossing test reuses
    them with zero extra geometry.
- `packages/core/src/route/orthogonal-router.ts`
  - `polylineIntersectsBoxes(points, boxes)` at line 389 is the exact
    crossing primitive. It is already used internally at line 139
    (`!polylineIntersectsBoxes(pruned.points, req.obstacles)`), so the
    signature and semantics are proven. For a straight edge the polyline
    is the 2-point array `[sc, tc]`.
- `packages/react/src/views/canvas/CytoscapeCanvas.tsx`
  - Prop type `routeEdges?: boolean | { maxEdges?, clearance?,
    bendPenalty?, minStub? }` at line 886. Add `mode?` here.
  - `runCanvasEdgeRouting(cy, opts, incidentTo?)` at line 909; its
    `opts` object (lines 911-916) and its call to `routeSceneEdges`
    (lines 956-960) must thread `mode` through.
  - The prop-change handler builds the config at lines 1899-1901
    (`routeEdges === true ? {maxEdges:600} : {maxEdges: routeEdges.maxEdges ?? 600, ...routeEdges}`)
    and the layoutstop path at lines 1662-1671. Both must pass `mode`.
- The 8 scene-routing shells (each currently hardcodes routing ON except
  RoutingShell which already has an on/off `<select id="rlab-routes">`):
  1. `src/demo/RoutingShell` (Routing Lab) — upgrade its existing on/off
     select to the 3-state control.
  2. `src/demo/ontology/OntologyShell.tsx` — 4 canvases, `routeEdges` hardcoded.
  3. `src/demo/*` Rdf12 shell (RDF 1.2 Hyperarcs) — hardcoded.
  4. `src/demo/legibility/*` Legibility Lab — hardcoded.
  5. `src/demo/bio/BioShell.tsx` — `ROUTE_EDGES` constant.
  6. `src/demo/stylelab/StyleLabShell.tsx` — `ROUTE_EDGES`, 2 canvases.
  7. `src/demo/supply/ThreadShell.tsx` — `ROUTE_EDGES`.
  8. `src/demo/scale/ScaleSurface.tsx` — on only in the clusters view.

  VERIFY each shell's actual routeEdges wiring by grep before editing
  (`routeEdges` / `ROUTE_EDGES`); the list above is from a prior audit
  and file paths for shells 3/4 must be confirmed via
  `src/demo/DemoLanding.tsx` (the authoritative register) + SHELL_MAP in
  `src/demo/Demo.tsx`. Do not edit a shell you have not read this run.

## Implementation

### 1. Core — `route-scene-edges.ts` (the load-bearing change)

- Add to `RouteSceneOptions`:
  `mode?: "direct-unless-crossing" | "always";` default
  `"direct-unless-crossing"`.
- In the `routeSceneEdges` loop, AFTER computing `sc`, `tc`, and
  `obstacles` but BEFORE calling `routeOrthogonal`: when mode is
  `direct-unless-crossing`, if
  `!polylineIntersectsBoxes([sc, tc], obstacles)` then `continue`
  (leave the edge unrouted — it stays a straight/bezier line; do NOT add
  it to the `routed` map). When it DOES cross, fall through to the
  existing `routeOrthogonal` call unchanged. Mode `"always"` preserves
  today's behavior exactly (route every edge).
- Note the existing contract: edges omitted from the `routed` map get
  their stale `_segDist`/`_segWeight` CLEARED by the caller
  (CytoscapeCanvas runCanvasEdgeRouting, lines 962+), so a direct edge
  correctly renders as an unrouted straight line.

### 2. React prop — `CytoscapeCanvas.tsx`

- Extend the `routeEdges` object type with
  `mode?: "direct" | "orthogonal"`. Map at the call sites: prop `mode`
  absent or `"direct"` -> core `"direct-unless-crossing"`;
  `"orthogonal"` -> core `"always"`. `routeEdges={true}` -> direct
  (library-wide default per owner ruling).
- Thread `mode` through the `runCanvasEdgeRouting` `opts` object and
  into the `routeSceneEdges` call. Include `mode` in the
  `routeEdgesKey` JSON so a mode change re-runs the pass (it is already
  `JSON.stringify(routeEdges)` at line 1884 — object mode is covered,
  but confirm the boolean branch still maps to direct).

### 3. UI — the 3-state pulldown on each of the 8 shells

- A shared 3-state control (Direct / Orthogonal / Off). Prefer one small
  reused component or a copy-consistent `<select>` block per shell;
  match each shell's existing control styling. Default selection =
  **Direct**.
  - Direct  -> `routeEdges={{ mode: "direct" }}`
  - Orthogonal -> `routeEdges={{ mode: "orthogonal" }}`
  - Off     -> `routeEdges={false}` (bezier)
- RoutingShell: replace the 2-state `rlab-routes` on/off select with the
  same 3-state control; keep its id/label conventions.
- The per-shell `ROUTE_EDGES` constants stay as the revert lever
  (individually flippable) per the standing decision
  `routeedges-prop-wires-post-layout-obstacle-aware-routing`.

### 4. Channels doctrine (required, not optional)

- Wiring-guide snippet in `docs/wiring-guide.md` showing
  `routeEdges={{ mode: "direct" }}` and the three states, with prose on
  when each is appropriate. Add the executable twin under
  `examples/wiring/` (the snippet runs in CI). This is the adopter
  surface for the new capability — a capability without it violates the
  three-channel contract in CLAUDE.md.

### 5. Tests

- Core unit tests in
  `packages/core/src/route/route-scene-edges.test.ts` (create if
  absent, else extend): (a) direct mode leaves a clear diagonal edge
  UNROUTED (not in `routed` map); (b) direct mode routes an edge whose
  straight segment crosses a node box (present in `routed`, >=3 points);
  (c) `mode:"always"` routes both; (d) default (no mode) == direct.
- A React test asserting the pulldown drives the prop (mode -> config)
  is desirable but the core tests are the gate-blocking ones.

## Verification (the FULL gate, not a subset)

Run the exact ci.yml order and check `$?` directly — never pipe a gate
through tail/head:

    pnpm run gates
    # = typecheck && lint && verify && test && gates:spec (FIVE steps).
    # gates:spec runs the three python spec scripts; run them with
    # python3 on this host (the `python` shim is absent — a red gates
    # that is ONLY the missing python shim is a false red, rerun with
    # python3). verify runs the dist/export/snippet/bundle-ledger checks.

- Prettier MUST be clean on every touched file (`pnpm exec prettier
  --check` on the file set) — worker gate claims have historically
  false-greened on prettier (gotcha
  `brief-14-11-worker-commits-were-prettier-dirty`). Run prettier
  explicitly.
- If the bundle grows, add a dated rationale line to
  scripts/check-bundle-size.mjs (the ledger) — do not silently raise.
- Do NOT re-init/refit the canvas on a mode change: a routing-mode swap
  is a restyle on the SAME input graph, so camera + node positions must
  HOLD (CLAUDE.md camera/position stability doctrine). The existing
  routeEdges change handler is already a `cy.batch()` restyle — keep it
  that way; do not introduce a re-layout.

## Worker contract

- Emit inline `kb log` atoms during the run: a `kb log decision` for the
  mode-default choice as implemented, a `kb log gotcha` for any shell
  whose wiring differed from the audit list above, `kb log discovery`
  for anything surprising in the router. Link with
  `--part-of <this plan IRI>`.
- Commit the moment gates are green (version bump in
  `src/kb_chat/__init__.py` does NOT apply here — this is the g3 repo,
  not kb_chat; instead add a CHANGELOG entry and a planning-log line per
  CLAUDE.md working agreement). Do not push to any remote off the
  forge mesh without an explicit ask.
- Write `outcome.json` (outcome / atoms_emitted / commit_shas /
  files_changed / summary / duration_min / blockers) and end with the
  one-line stdout summary
  `done: <n> atoms; commit=<sha>; <one-phrase outcome>`.
- If a genuine blocker stops you, emit `kb log failure` + `outcome:
  bailed` and stop — do not exit 0 with an open question.
