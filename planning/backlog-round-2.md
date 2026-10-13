# Backlog round 2 (2026-10-13)

Source: the backlog left after PR #43 (the five follow-ups it filed,
#44 to #48, plus the 2026-08 design-level issues #5, #6, #9, #12, #16
to #20), worked after the maintainer ruled on each open decision. The
method is the one `planning/host-integration-round.md` records
(isolated worktrees per agent, one merge at a time, affected suites
re-run on the merged tree), with one change: agents were told to put
no attribution of any kind in commit messages.

## Rulings that unblocked the round

| Decision | Ruling |
| --- | --- |
| #18 handle name | `core` wins; `cy` a deprecated alias for one major |
| #17 derivation stamp | Sidecar map on the UGM, JSON snapshot and export, not CSV, no PROV-O yet |
| #20 overlay sequencing | Library surface in `@g3-toolkit/react` |
| #16 AriaCompanion | Provenance Auditor carries it |
| #5 working-set config | Default plus ceiling per view; wiring first |
| #6 pagination | Go: UGM page descriptor, richer `checkLimit`, matrix pages, shared control; canvas and tree excluded |
| #47 virtualization | Go, with `@tanstack/react-virtual` as a regular dependency |
| #45 `g3t-view` | Go, as a public DOM change |
| #48 sparql/projection | Key on the triple, skip a duplicate first-wins |
| #12 and PR #3 | Held; routing needs the live review, the fork PR its own review |

## Disposition

| Issue | Outcome |
| --- | --- |
| #44 | Fixed: overrides, pins and overlays re-applied from the init path |
| #46 | Demo half done (Biomedical: Labels control, Explore view); the live checklist stays open for the maintainer |
| #48 | Done, both halves (cypher/gremlin/rest/holonic; sparql/projection via `tripleEdgeKey`) |
| #47 | Done, all five items |
| #19 | Inventory delivered as `roadmap/design/onready-inventory.md`; the ruling is the maintainer's, issue stays open |
| #18 | Done |
| #20 | Done |
| #17 | Done |
| #9 | Done (unit tests through a recorded context, e2e pixel readback) |
| #16 | Done, with five component gaps closed |
| #6 | Done as scoped |
| #5 | Done: config document, ceilings, provider, two views wired |
| #45 | Done: 49 roots carry `g3t-view`; `.g3t-view` carries the toolkit text |

## What the merge step caught

- The #5 and #6 agents raised the core budget to 180 independently;
  the #17 and #48 raises stacked on top. Each merge re-measured and the
  ledger carries one entry per raise.
- Two merges split a `describe` block at the hunk boundary (the
  Minimap test, the working-set test). The split-closer pattern is now
  familiar: when two branches append at the same spot, git attributes
  the shared closing lines to the second block.
- The #5 agent's matrix tests asserted the truncation notice that #6
  replaced with paging; retargeted at the paging summary.
- The virtualization branch rewrote TableView's row rendering into
  `renderRow` while #17 had added the derived-cell marker inside the old
  inline map; the marker was ported into `renderRow` by hand.
- Two pipelines in the orchestrator's own merge checks used `| grep`,
  which masked a red test run and a consumer-cost overage into a pushed
  commit; both fixed in the next commit. CLAUDE.md's rule about piping
  gate output applies to the orchestrator too.

## Questions for Zach, by issue

- #19 (the record asks for): option a/b/c for `onReady` and the
  stability-policy text for specs/09; which promoted surfaces enter the
  roadmap and in what order; the #18 name under option b would be
  `canvas: CanvasHandle`, where this round shipped `core` per the
  earlier ruling (a later narrowing changes the type, not the name).
  Incidental: the dbltap recipe lacks a twin; `CytoscapeCanvas.stories`
  wires the bus over a stored handle; `context:hideNodes` writes a
  `display` bypass the `hidden` prop never clears.
- #18: `captureWorkspace`/`applyWorkspace` contexts still take `{ cy }`
  (function arguments, not props); `core` became optional on
  GraphToolbar, so a caller forgetting both gets a no-op toolbar.
- #48: Cytoscape's single id space is a general #31 hazard (an edge key
  equal to a node id is dropped silently); converter namespacing versus
  a documented host obligation. Cypher on Neo4j 4.x gets dedupe only;
  Cypher nodes stay on legacy `id`; mirrored portals collapse to one
  edge; the SPARQL dedupe is silent (a count needs a richer `query`
  return); blank nodes are bracketed like IRIs in the key.
- #47: a host using `TableView` has no handle on the internal TanStack
  instance for its own CSV button; "All" clears and "None" sets `[]`;
  reorder moves within all leaf columns including hidden ones;
  virtualization without `fill` is degenerate but stable; overscan 10
  and the 22/29 px estimates are judgment calls.
- #20: restore versus deactivate on hand-back (restore chosen);
  `mergeSequenceActiveIds` public or internal before the next tag.
- #17: the UGM floor grew 2.6 KB, half of it the typed error vocabulary
  reachable from `fromJSON`; `exportSubgraphJson` stays version 1 with
  the additive field; `definitionId` is the definition's `name`.
- #16: every list option is a Tab stop (R7.9); ArrowRight follows only
  the first neighbor; the list is keyed on UGM identity; re-selecting
  the same node is silent by design.
- #6: two matrix controls versus one with an axis selector (needs a
  live look); MatrixView's per-cell inline style cost (a
  `g3t-matrix-cell` class would cut it but changes the CSS contract);
  TableView adoption of `PaginationControl`.
- #5: R7.7 already read implemented; admin `setLimit` is bounded by the
  ceiling (bypass rejected); `expandNeighbors` does not fall back to the
  module default; `WorkingSetProvider` with `config` rebuilds on
  identity change. #6's `strategy` is where a ceiling refusal belongs;
  a per-call override should not be able to turn it into "page".
- #46: Expand uses the first selected node; Reset rebuilds (a
  camera-holding shrink would be library work); the Explore caption is
  long review copy.
- #9: the Style Lab e2e test relies on `?e2e=1` exposing the DEV-only
  shell in prod, as the existing stylelab spec already does.
- #45: hosts without `style.base.css` now see 13px/1.5/text-primary
  inside views (a visible change, the intent); `line-height: normal`
  on `.g3t-input` also pins textareas; `ViewErrorBoundary`'s fallback
  keeps its inline system font.

## Needs eyes rather than a gate

The Biomedical Labels control and Explore view (#46), the matrix
paging controls (#6), TableView virtualization scrolling and the sticky
header over spacer rows (#47), the AriaCompanion wiring with VoiceOver
or NVDA (#16), and the `g3t-view` typography on every view (#45).
