# Host-integration round (2026-10-13)

Source: tracking issue #23 (seventeen sub-issues, #24 to #40, filed
from a downstream React/Vite host that integrated 1.0.0 for five
views) plus the 2026-08-27 backlog that was still open (#10, #13, #14,
#21). Every claim in a sub-issue was re-read against the tree before
any change; the issue bodies were accurate to the line in every case.

## Method

Eleven agents ran in parallel, each in its own git worktree on a
branch cut from the round's integration branch, grouped so that no two
agents edited the same REGION of a file (CytoscapeCanvas.tsx had two
agents in wave 1 with named line ranges, then two more in wave 2 cut
from the merged file). A shared brief carried the CLAUDE.md rules, the
verification each agent had to run (typecheck, eslint and prettier on
touched files, the relevant vitest directories, build plus api-surface
and the affected verify scripts), and three prohibitions: no CHANGELOG
or STATUS or planning edits (the orchestrator writes them once from
the agents' reports), no pushes, no PRs. Branches were merged one at
a time onto the integration branch, with the affected suites re-run on
the merged tree after each merge and the full `verify` chain after
wave 1.

What the merge step caught that the agents could not:

- `docs/design-tokens.md` is GENERATED and byte-compared; one agent
  wrote the #24 font-loading note into the file by hand. The note now
  lives in the generator (`FONT_LOADING_NOTE`), which is the only place
  that survives a regeneration.
- Two branches raised the react bundle budget to 402 KB independently
  from the same 392 KB base. Merged, the dist measured 410.7 KB and
  then 411.5 KB after the css-bundle branch; the ledger carries both
  entries plus an integration note, budget 418.
- Two merges split a markdown fence and a `describe` block at the hunk
  boundary (both branches had appended a section before the same
  heading). Keeping both sides needed one closing fence and one
  `});` restored by hand; `verify:snippets` and the wiring twins were
  the signal.
- `examples/wiring/src/wiring-examples.test.tsx` conflicted on its
  import list four times (every agent added a symbol). Trivial, but it
  argues for one twin file per guide section if this pattern repeats.

## Disposition

| Issue | Verdict | Disposition |
| --- | --- | --- |
| #24 style.css restyles host | Defect | Fixed: scoped typography, opt-in `style.base.css`, dist test |
| #25 echarts in canvas chunk | Defect | Fixed: lazy `import()`, `LAZY_PEERS` gate |
| #26 additive graph updates | Addition | See wave 2 below |
| #27 preset animates away from onReady | Defect | Fixed: preset never animates; ordering documented |
| #28 stylesheet prop inert | Defect | Fixed: content-keyed restyle, no re-init |
| #29 allShortestPaths maxHops | Defect | Fixed, both functions tested |
| #30 path search options | Addition | Added: `PathGraph`, `directed`, `nodeFilter`, `kShortestPaths` (Yen) |
| #31 UGM.addEdge key | Addition | Added: `EdgeInput.key`; `fromJSON` keeps ids |
| #32 overlay colors literal | Defect | Fixed: `overlayColor` theme role, `overlayThemeRules` |
| #33 theme writes to html | Addition | Added: store `target`, `clearTheme`, `applyTheme` dispose, `themeFromCssVariables` |
| #34 ShaclShapeBrowser defects | Defect | Fixed: keys, tokens, severity badge |
| #35 ShaclShapeBrowser props | Addition | Added: `summary`, controlled selection, `targets` |
| #36 TreeView | Defect + addition | Fixed collapse; forests, `showType`, tokens, ARIA tree |
| #37 SchemaView | Addition | Added: `subClassOf` nesting, every shape badged, `validationResults` |
| #38 SpecLegend wording | Addition | Added: `sectionTitle`, channel-aware `labelFor`, data-derived edge rows |
| #39 TableView rows | Addition | Added: `rows`/`columns`, `renderCell`, `selection`; virtualization and CSV deferred |
| #40 label collision | Addition | See wave 2 below |
| #41 publish a release | Maintainer | Not an agent action; the round is the content of that release |
| #21 TableView fill/pageSize | Defect | Fixed: controlled pagination, `fill`, `rowHeight`, `autoPageSize` |
| #13 spec lost on rebuild | Defect | Fixed: ref re-apply from the init path |
| #14 _shape and label cleanup | Defect | Fixed: `_shape` cleared, `label` restored from the converter rule |
| #10 act() warnings | Hygiene | Fixed |

Left untouched, deliberately: #5 and #6 (deployment configuration and
pagination, both need a design ruling first), #9 (rasterization
coverage needs a real 2D context), #12 (advanced SVG routing), #16
(AriaCompanion ruling), #17 (derived-value provenance), #18 and #19
(breaking `cy`/`core` and `onReady` questions, for a major), #20
(overlay sequencing).

## Questions for Zach, by issue

- #24: views with unclassed inline-styled roots (CytoscapeCanvas,
  TableView cells, inspector text) now inherit the HOST font when only
  `style.css` is imported. A shared `g3t-view` root class would carry
  the toolkit face regardless; it is a public DOM change. Also glance
  at the playground chrome: buttons keep the UA line-height on purpose.
- #25: dynamic import was chosen over a `./charts-views` entry so public
  import paths hold. The `LAZY_PEERS` list is where a subpath would go
  if you prefer the entry.
- #13: the style-override, pin and overlay effects have the same latent
  rebuild gap. Same fix shape; worth its own issue.
- #14: `_color`/`_size` cleanup still deletes to the bare node rule
  (the VR-2 ruling); the converter-restore mechanism would generalize,
  but that is a semantic change.
- #27: `layoutOptions.animate` is now overridden to false under preset,
  like `fit`. A host wanting an animated transition INTO preset
  positions runs `cy.layout(...).run()` itself.
- #32: the tones now really render from the theme (dark danger is
  `#f87171`, not `#c62828`); needs a live look. Field name `overlayColor`.
- #30: Yen's algorithm (ascending length, includes longer routes) over
  a shortest-length-only enumerator; tie order follows graphology's
  edge iteration, documented as deterministic rather than insertion
  order.
- #31: `UGM.fromJSON` now preserves edge ids (it regenerated them
  before). Strictly better for undo; visible to anything that relied on
  fresh ids. Adapters do not pass keys yet.
- #33: `setThemeTarget` writes the current theme to the new target at
  once; `clearTheme` keeps the target; core's `injectDesignTokens`
  still targets `<html>`.
- #34/#35: no `--g3t-info` token exists (info uses accent-primary);
  `onSelectShape` widened via a method signature; `targets` is display
  metadata, the validator still matches `targetClass`.
- #36/#37: `subClassOf` is a `SchemaView` prop rather than a
  `SchemaModel` field; multi-parent classes nest under the first listed
  parent only; auto-detect without `rootIds` still picks the first
  source node.
- #38: with a UGM present, an override key whose value appears on no
  edge no longer gets a legend row.
- #39: `filter: "none"` is a fourth kind beyond the three asked for;
  the "values" filter is single-select; TanStack `ColumnMeta`
  augmentation was avoided because it leaks into consumer types.
- #21: fill mode (sticky header, scroll region) needs a look in a dock
  host; the sticky `th` background is `--g3t-bg-primary`.

## Wave 2

Issues #26 (additive graph updates) and #40 (label collision) were
cut from the merged wave-1 head because both touch CytoscapeCanvas;
their outcome is recorded in the CHANGELOG entry for this round and
in STATUS.md.
