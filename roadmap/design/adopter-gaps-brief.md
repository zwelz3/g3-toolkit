# Brief: first-adopter gaps (public reheat op + authed SPARQL wiring)

Source: haunt/GExplore adopter feedback, mirrored into this project as
Discovery `haunt-gexplore-adopter-feedback-on-g3-1-sparqladapter-banned-bb20d55f`;
originating haunt Decision
`kb/haunt/Decision/gexplore-g3-swap-bff-routed-select-ugm-identity-swap-pattern-499d98ba`
("Never use @g3t/core SparqlAdapter in haunt: all SPARQL through
project BFF"; "UGM.fromJSON copy gives CytoscapeCanvas identity swap
for fcose re-layout").

The first real adopter had to invent two workarounds. Both point at
library gaps, not adopter error.

## Gap 1: no public reheat / re-layout operation

What the adopter did: to force an fcose re-layout on the SAME graph,
GExplore deep-copies the UGM via `UGM.fromJSON` so CytoscapeCanvas sees
a new object identity and re-inits. Cost: a full canvas teardown
(camera lost, positions lost, all decorations rebuilt), and it works
AGAINST the D15 same-graph stability contract instead of with it.

What exists today: only `relayoutAroundFixed`
(`packages/react/src/interaction/relayout.ts`), which is scoped to
settling neighbours around held elements. There is no exported "re-run
the layout now" op, even though CLAUDE.md's stability doctrine
explicitly lists **reheat** as one of the sanctioned explicit user ops.

Design: export a `reheat(cy, options?)` op from `@g3t/react`
interaction (same home as `relayoutAroundFixed`):

- Runs the current (or named) layout on the existing canvas as an
  EXPLICIT user op: no UGM copy, no canvas re-init, decorations and
  styles untouched.
- `options`: `{ name?, layoutOptions?, fit? }` with `fit` default
  false (doctrine: refit only on explicit user request, so the caller
  opts in).
- Adoption channels per CLAUDE.md: exported function + wiring-guide
  snippet ("Re-run the layout without losing your canvas") + executable
  twin in `examples/wiring/`. Wire a Reheat button into one demo shell
  so Zach can exercise it.

## Gap 2: SparqlAdapter auth wiring is undiscoverable

What the adopter did: banned SparqlAdapter project-wide because the
default usage hits raw Fuseki, bypassing Cloudflare Access JWT and
project graph scoping, and routed everything through their BFF by hand.

What exists today: the SparqlAdapter constructor ALREADY accepts a
custom fetch + middleware; the capability is real but invisible. This
is a documentation gap, not a code gap.

Design: wiring-guide snippet "Authenticated SPARQL through a
BFF/proxy": custom fetch that injects auth headers (CF Access service
token as the worked example), base-URL override pointing at a BFF
route, and a note on graph-scoping the query server-side. Executable
twin with a mock fetch asserting the header + URL rewrite are applied.
No library code change expected; if the twin exposes a hook that is
missing, that hook becomes a work item here.

## Explicit non-goals

- Changing style precedence: the adopter's third finding
  (`properties._color` beats Okabe-Ito) is precedence working as
  designed; no action.
- A server-side BFF reference implementation (host-specific).

## Work items

- [ ] W1 `reheat` op + unit tests (layout invoked on same core, no
      re-init, fit only when requested, locks/errors released).
- [ ] W2 demo wiring: Reheat button in one shell (Auditor proposed).
- [ ] W3 wiring guide: reheat snippet + executable twin.
- [ ] W4 wiring guide: authed-SPARQL/BFF snippet + executable twin.
- [ ] W5 gates + CHANGELOG + STATUS queue note; bundle ledger entry if
      the react bundle grows.

## Verification

- Unit: W1 tests assert the same Cytoscape core instance survives and
  camera holds when `fit: false`.
- Twins run in CI (examples/wiring executable-snippet contract).
- Adopter loop: report the closure back to the haunt thread so
  GExplore can drop the `UGM.fromJSON` identity-swap and re-evaluate
  SparqlAdapter under the documented auth pattern.
