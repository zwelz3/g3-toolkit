---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
depends_on: planning/orchestrate-routing-independence/19-direct-routing-toggle-brief.md
---

# Brief 20: "Routing Explained" DEV-only explainer box (flow/sequence diagram of the routing logic)

Owner ask (Jake, A29): "add a new dev box that shows a flow/sequence
diagram that explains to humans the background / routing logic."

This adds ONE new DEV-only capability surface whose job is didactic:
show a human, at a glance, how the scene router decides between a
straight edge and an orthogonal detour, and where the separate
structural/MBSE engine sits. It ships nothing to the public landing
page (DEV-gated exactly like Style Lab).

DEPENDS ON BRIEF 19. Brief 19 introduces the `direct-unless-crossing`
default and the 3-state routing mode (`Direct` / `Orthogonal` / `Off`).
This box must describe the logic AS BRIEF 19 LANDED IT — read the
merged `route-scene-edges.ts` and `CytoscapeCanvas.tsx` at the start of
this run and diagram the real, current control flow, not this brief's
paraphrase. If brief 19's landed field names differ from the summary
below, the LANDED code wins; cite the lines you actually read.

## The routing logic to explain (verify against landed code before drawing)

Scene routing (the non-structural demos, `routeEdges` prop):
- For each edge the router has `sc` = source box center, `tc` = target
  box center, and `obstacles: RouteBox[]` = the other node boxes
  (`packages/core/src/route/route-scene-edges.ts`).
- Decision gate (added by brief 19): if the straight 2-point segment
  `[sc, tc]` does NOT intersect any obstacle box
  (`polylineIntersectsBoxes([sc, tc], obstacles)` is false), the edge is
  left UNROUTED — it renders as a straight/bezier line (DIRECT).
- Otherwise it falls through to `routeOrthogonal(...)`
  (`packages/core/src/route/orthogonal-router.ts`): an A* orthogonal
  router that finds an axis-aligned detour around the boxes, then the
  polyline is projected onto Cytoscape `curve-style: segments`
  (`polylineToCytoscapeSegments`).
- Three user-facing modes (brief 19): `Direct` (the gate above, default),
  `Orthogonal` (route every edge — core `mode: "always"`), `Off`
  (`routeEdges={false}`, plain bezier, no routing pass).

Structural / MBSE engine (SEPARATE, out of scope for the toggle):
- `layoutStructural` / the layered engine is a different, inherently
  orthogonal engine (layer assignment, crossing minimization,
  port-based body attachment, the nudging post-pass). It always draws
  orthogonal routes and is NOT governed by the scene `mode`. The box
  should say so in one sentence so a reader does not conflate the two.

## What to build

A new shell `src/demo/routing-explain/RoutingExplainShell.tsx`
(directory is new) exporting `RoutingExplainShell({ onBack })`, matching
the shape of the other shells (a back control, dark surface, the shared
shell chrome the neighboring shells use — read one, e.g.
`src/demo/routing/RoutingShell.tsx`, for the exact import set and
layout conventions this run).

Three panels, all dogfooding the toolkit's OWN renderers (do NOT add a
mermaid or any diagram dependency — it would violate the ESM-only /
bundle-ledger contract and the three-channel doctrine for zero gain):

1. DECISION-FLOW DIAGRAM (the "flow/sequence diagram" Jake asked for).
   Build a small `StructuralGraphInput` of the routing decision as a
   flow and render it with `StructuralSvgView` + `useStructuralLayout`
   (the RoutingShell/MbseShell pattern). Nodes/edges roughly:
   `edge to route` -> `straight line [sc,tc] clears every node box?`
   -> (yes) `render DIRECT (straight/bezier)`;
   -> (no) `routeOrthogonal: A* orthogonal detour`
   -> `project polyline onto curve-style: segments`.
   Also a short branch node for the two other modes
   (`Orthogonal = route every edge`, `Off = bezier, no pass`) and a
   separate note node for the structural engine. This literally draws
   the orthogonal explainer WITH the orthogonal structural engine —
   keep that meta-point in a code comment.

2. LIVE RULE DEMO. A small `CytoscapeCanvas` scene with a handful of
   nodes and exactly two illustrative edges: one whose straight shot is
   clear (renders DIRECT) and one whose straight shot crosses a node
   (renders as an orthogonal detour), with `routeEdges={{ mode: "direct" }}`
   (the brief-19 prop). A tiny mode control (reuse brief 19's 3-state
   control if it was extracted as a shared component; otherwise a local
   `<select>`) lets the reader flip Direct/Orthogonal/Off and WATCH the
   same two edges change. Respect camera/position stability: a mode swap
   is a restyle on the SAME graph — do not re-init/refit (CLAUDE.md).

3. PROSE PANEL. Plain-language paragraphs: the direct-unless-crossing
   rule, when each of the 3 modes is appropriate, and the one-sentence
   structural-engine distinction. Analytical tone, no em-dashes
   (Zach working agreement).

## Register the box (files brief 19 does NOT touch — no collision)

- `src/demo/DemoLanding.tsx`: add a `CAPABILITY_SURFACES` entry
  `id: "routing-explain"`, title "Routing Explained", a subtitle and
  description in the established voice, an accent color not already in
  use, an icon glyph, tags. Then gate it DEV-only in
  `surfaceVisibleHere`: add `if (id === "routing-explain") return import.meta.env.DEV;`
  (same rule as `style-lab`), so it shows in `pnpm run dev` and is
  absent from the deployed page. Update the two build-time cross-checks
  if `scripts/build-landing.mjs` enforces register<->SHELL_MAP parity
  (it does per CLAUDE.md — run it and keep it green).
- `src/demo/Demo.tsx`: add the `SHELL_MAP["routing-explain"]` loader
  `() => import("./routing-explain/RoutingExplainShell").then((m) => ({ default: m.RoutingExplainShell }))`.

## Channels doctrine + tests

- This is a DEMO surface, not a new library capability, so it does NOT
  require a new wiring-guide channel entry of its own. But if you extract
  any reusable piece into `@g3t/react` (e.g. a shared routing-mode
  control), that piece needs the wiring-guide snippet + executable twin
  under `examples/wiring/`. Prefer keeping it demo-local to avoid that.
- A shell smoke test in the demo test style (a `*.test.tsx` beside the
  shell) asserting it mounts, renders the flow diagram container, and
  the mode control drives the scene canvas prop. Match the existing
  shell-test conventions (read a neighboring `*Shell.test.tsx`).
- If e2e/production-smoke walks the register, confirm a DEV-gated
  surface does not break the prod-set count assertion (Style Lab is the
  precedent: DEV-only, excluded from the prod smoke).

## Verification (FULL gate, ci.yml order, check $? directly)

    pnpm run gates
    # typecheck && lint && verify && test && gates:spec (FIVE steps).
    # gates:spec runs the three python spec scripts; run them with
    # python3 on this host (the `python` shim is absent; a red gates that
    # is ONLY the missing shim is a false red — rerun spec gates with
    # python3). verify runs dist/export/snippet/bundle-ledger checks.

- Prettier MUST be clean on every touched file (`pnpm exec prettier
  --check` the file set explicitly — worker gates have false-greened on
  prettier before: gotcha `brief-14-11-worker-commits-were-prettier-dirty`).
- If the bundle grows, add a dated rationale line to
  `scripts/check-bundle-size.mjs` (the ledger) — never silently raise.
- Run `node scripts/build-landing.mjs` (or the documented landing build)
  and confirm the register<->SHELL_MAP cross-check passes both ways.

## Worker contract

- Emit inline `kb log` atoms: a `kb log decision` for how the flow
  diagram was modeled (structural-engine dogfood), a `kb log discovery`
  for anything about brief 19's landed routing shape that differed from
  this brief's summary, a `kb log gotcha` for any register/parity
  surprise. Link with `--part-of` this plan IRI.
- Commit the moment gates are green; add a CHANGELOG entry and a
  planning-log line (CLAUDE.md working agreement — no `src/kb_chat`
  version bump, this is the g3 repo). Do NOT push off the forge mesh
  without an explicit ask.
- Write `outcome.json` (outcome / atoms_emitted / commit_shas /
  files_changed / summary / duration_min / blockers) and end with the
  one-line stdout `done: <n> atoms; commit=<sha>; <one-phrase outcome>`.
- On a genuine blocker: `kb log failure` + `outcome: bailed` and stop.
  Never exit 0 with an open question.
