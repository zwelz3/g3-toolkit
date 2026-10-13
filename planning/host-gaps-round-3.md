# Host gaps round 3 (2026-10-13)

Source: tracking issue #53, the twelve gaps the host from #23 found
when it moved to 1.2.0 (eight defects against shipped behavior, four
surface additions), every claim re-checked by the host against the
`v1.2.0` tag. The method is the one `planning/host-integration-round.md`
records (isolated worktrees per agent, one merge at a time, the
affected suites re-run on the merged tree, no attribution in commit
messages). Ten agents: eight started at once on the issues that needed
no ruling, two started after the rulings below from a worktree cut off
the merged integration branch, so the three `CytoscapeCanvas.tsx`
edits stacked instead of conflicting.

## Rulings that unblocked the round

| Decision | Ruling |
| --- | --- |
| #63 overlay precedence | Overlay rules move after the host stylesheet (CLAUDE.md's order); no split prop |
| #64 shrink | `additive` itself removes in place; no `incremental` mode |
| #56 and #59 several parents | A class or node with several parents renders under every parent |
| #58 search | Every word anywhere in the row (word-AND); quoted phrase as one substring; default changed |

One correction to the #63 ruling's wording, found by the agent with a
headless probe: Cytoscape has no selector specificity, so "a host
restyles an overlay through a more specific selector" was never a
path. Order alone decides. The guide and the design record say theme
(`overlayColor`, the tone colors) or a per-element bypass instead.

## Disposition

| Issue | Outcome |
| --- | --- |
| #54 | Fixed: empty `targetClass` contributes no target entry; `targetClass` stays required on the type (ruling needed to make it optional) |
| #55 | Fixed: a summary entry with 0 focus nodes reads "No focus nodes"; every badge state exposes `data-state` |
| #56 | Fixed in full: `targets` badges, inherited superclass shapes, a class under each parent (ruling) |
| #57 | Fixed: native button sort trigger, Enter/Space/Shift+Enter, `aria-sort` omitted on unsortable columns |
| #58 | Done, items 1 to 6 plus every "smaller difference", plus the search ruling |
| #59 | Done, all eight items including several parents (ruling) |
| #60 | Fixed, both halves: rendered-label candidacy, field-diffing subscriber with the hover debounce |
| #61 | Fixed: the painter skips non-`visible()` elements and frames the visible ones |
| #62 | Fixed: the probe reads the canvas container; message names the theme first |
| #63 | Done per ruling; order contract documented in three places |
| #64 | Done per ruling, with the compound-parent move-out and the disjoint/empty boundary |
| #65 | Fixed: one endpoint rule; guide paragraph and twin for the k × L recipe |

## What the merge step caught

- The #59 and #57/#58 agents raised the react budget independently
  (455 and 456), each measured against the 1.2.0 base; #56 added about
  1.8 KB without a raise. The merged tree measures 461.3 KB; the ledger
  keeps both entries and a merge-step entry setting 465.
- The #56 agent left the wiring guide's class-hierarchy prose stale
  (it still described first-parent nesting) because other agents were
  editing the guide; the orchestrator wrote the paragraph and a twin
  after the table and tree merges.
- The #64 agent flagged that a pure removal runs no layout, so a
  label hidden under a removed node's label stayed hidden until the
  next zoom; fixed by one dependency (`ugm`) on the collision effect,
  with a regression test that needed the collision mock to carry the
  layout-settlement callback (`cy.one`) the canvas gates the pass on.
- No split-closer conflicts this round: the two guide-and-twin
  appenders (#58, #59) landed in different sections, and #65's twin
  sat under a different describe.

## Questions for Zach, by issue

The ones that are work are filed: #67 (`targetClass` optional on
`ShaclShape`), #68 (label-collision threads from #60), #69 (a
post-overlay host slot, from #63), #70 (TreeView threads from #59).
The rest are recorded here only.

- #54: should `targetClass` become optional on `ShaclShape` now that
  `targets` carries every target? The validator still matches by
  `targetClass` only, so a shape without one validates nothing today.
- #55: the "No focus nodes" glyph is the `minus` icon, close in shape
  to the "Not validated" text glyph; they differ in aria-label,
  `data-state` and the summary line. Say if a stronger visual
  difference is wanted. `data-state` is a small additive DOM contract
  the guide does not yet mention.
- #56: inherited results count toward the subclass status (a
  superclass shape's violation on a sibling's instance still colors
  the badge, since results carry no node type). Kept per the ruling.
- #58: a quote inside a word is literal, only a quote that starts a
  term opens a phrase; duplicate row ids use a `#` suffix;
  `pageSizeOptions` without `onPageSizeChange` holds the pick until
  the `pageSize` prop next changes, and `autoPageSize` still wins;
  filter inference is rows-path only (the UGM path's Types/score
  filters and e2e selectors would flip).
- #59: the reveal opens EVERY copy of an outside selection and scrolls
  to the first in DOM order; the breadcrumb still follows the first
  incoming edge; the 100,000-row placement cap is a silent cut.
- #60: the toolkit's resolver already filed a zero box as "show", so
  if the host really saw the hide class land on blank edges at 1.2.0,
  its blanking rule may be `text-opacity: 0` rather than `label: ""`;
  that case keeps a real box and would need the candidacy read to
  consult the property. Selection changes still run synchronously;
  only hover rides the debounce. Shorten mode truncates the data
  label, not the rendered one (pre-existing).
- #61: `visible()` treats `opacity: 0` as hidden, so a host that fades
  nodes sees them leave the minimap.
- #62: with no theme applied, every existing canvas unit test still
  emits the warning once per instance; a `tests/setup.ts` line could
  silence it.
- #63: a host path that wins over the overlay for specific elements
  would need a post-overlay slot in the builder (the issue's "split
  the user stylesheet" option), a surface addition not done.
- #64: the empty-live boundary moved (the first non-empty ugm after an
  empty one rebuilds and fits); the Bio demo's Reset now keeps the
  three diseases and the camera where they were, worth a live look.

## Needs eyes rather than a gate

The overlay precedence on a canvas with a host stylesheet (#63), a
collapse in the Bio Explore view and its Reset (#64), the minimap on a
type-filtered demo canvas (#61), the TableView pagination bar with its
First/Last buttons and rows-per-page select (#58; any screenshot
baseline that includes the bar shifts), keyboard sorting with a screen
reader (#57), a TreeView rail with a two-parent class (#59), and the
SchemaView cards for a class under two parents (#56). Playwright e2e
did not run in the agents' worktrees (no browser); CI runs it.
