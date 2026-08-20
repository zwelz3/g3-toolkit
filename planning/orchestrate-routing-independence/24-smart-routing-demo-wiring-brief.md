# Brief 24 — wire refresh/re-layout/isolate onto the demo shells + deploy

project: g3_toolkit
cwd: /GSystems/src/g3-toolkit
branch: docs/ai-agent-guide (local commit only; NO push, NO PR)
model: opus
part_of: orchestrate-routing-independence (advanced smart routing capability, A54)
depends_on: brief 23 (props routeRefreshSignal / relayoutSignal / edgeClickIsolate)

## Goal (owner ruling A54)

Surface the new ops on the shells the owner named: **Scale, RDF 1.2, Legibility**
(Cytoscape canvases) and **Routing Lab** (structural). Each gets, where it
applies: a "Refresh routes" button, a "Re-layout" (untangle) button, and edge
click-to-isolate.

## Which shell gets what (VERIFIED — these files use CytoscapeCanvas)

- `src/demo/scale/ScaleSurface.tsx` — force canvas. Full set: both buttons +
  `edgeClickIsolate`.
- `src/demo/rdf12/Rdf12Shell.tsx` — hyperarc/holon canvas. Full set.
- `src/demo/legibility/LegibilityShell.tsx` — full set.
- `src/demo/routing/RoutingShell.tsx` — STRUCTURAL SVG (`StructuralSvgView` +
  `useStructuralLayout`), NOT CytoscapeCanvas. It ALREADY has edge click-isolate
  (the `tracedEdge` toggle, ~lines 263/327) and its crossing minimization is the
  structural ordering pass. Do NOT bolt the Cytoscape signal props on it. Add
  only a "Re-layout" button that forces a fresh structural layout pass (bump a
  `nonce` fed into the layout options / input memo so the engine re-settles) so a
  reviewer can watch it re-run. Leave its existing isolate as-is.

## Changes (Cytoscape shells: Scale, RDF, Legibility)

For each of the three, READ the file first and confirm the CytoscapeCanvas call
site + existing toolbar/control cluster:

- Add `const [routeRefreshSignal, setRouteRefreshSignal] = useState(0)` and
  `const [relayoutSignal, setRelayoutSignal] = useState(0)`.
- Pass `routeRefreshSignal={routeRefreshSignal}`,
  `relayoutSignal={relayoutSignal}`, `edgeClickIsolate` to the CytoscapeCanvas.
- Add two buttons near the existing controls: "Refresh routes"
  (`onClick={() => setRouteRefreshSignal(n => n + 1)}`) and "Re-layout"
  (`onClick={() => setRelayoutSignal(n => n + 1)}`). Match each shell's existing
  button styling; give them `data-testid` (`<shell>-refresh-routes`,
  `<shell>-relayout`) so tests and e2e can find them.
- Only enable the refresh/relayout buttons when that shell actually routes
  (Scale routes; confirm RDF/Legibility pass `routeEdges` — if a shell does not
  currently route, still wire the buttons; refresh no-ops harmlessly and relayout
  still untangles positions).

## Routing Lab (structural)

- Add a "Re-layout" button that increments a `nonce` state threaded into the
  `input`/`options` memo so `useStructuralLayout` re-runs. `data-testid`
  `rlab-relayout`. Keep the existing Routes on/off and click-isolate untouched.

## Tests

- One render/interaction test per touched shell: the buttons exist and clicking
  them bumps the signal (Scale/RDF/Legibility) or forces a re-layout (Routing
  Lab). Follow each shell's existing `.test.tsx` patterns; jsdom has no real
  layout, so assert the prop/handler wiring, not pixels.

## Gates, landing, DEPLOY

- Full `pnpm run gates` ($? directly, no tail/head; python3 for spec gates; honor
  the bundle ledger). Distinguish the 3 documented pre-existing reds via
  `git stash`.
- Local commit to `docs/ai-agent-guide`, NO push, NO PR.
- **DEPLOY** (standing rule — g3.ghostsystems.ai serves this checkout's
  `docs-out/`; `pnpm run docs:build` IS the deploy):

      pnpm run docs:build

  Then keep a preview reachable on the tailnet:

      pnpm run build && (vite preview --host --port 4173 &)

- Emit a kb:Decision (demo surface wired; Routing-Lab structural exception) +
  a kb:WorkBlock close if one was opened for the capability. outcome.json +
  one-line stdout.

## Acceptance

- Scale, RDF, Legibility: "Refresh routes" + "Re-layout" buttons + edge isolate,
  all functional; Routing Lab: "Re-layout" button, existing isolate intact.
- `pnpm run gates` green except the three documented pre-existing reds.
- `docs-out/` rebuilt and deployed; preview up on :4173.
