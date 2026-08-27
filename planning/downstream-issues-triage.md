# Downstream issues triage (2026-08-27)

Source: an adopter filing against `main` at `2af8139` plus the
published 1.0.0 packages. Fifteen items, A through O. Every claim was
reproduced against the tree before any change.

The filing itself is not in the repository. Inbound drops land in
`docs/.downstream/`, which is gitignored: the triaged output belongs
in history, the raw drop does not. This document is that output.

The drop contained the issue list ONLY. Both "attached" artifacts (the
`check-design-tokens.mjs` gate in A, the `overlay-sequence` extension
in F) were absent, so A's gate is written here from scratch and F
cannot be evaluated as code.

Deferred items are written up as filing-ready issues in
`docs/.downstream/issue-*.md` (also gitignored; they are drafts to
paste into the tracker, not repository documents).

## Verdicts

| Item | Verdict | Disposition |
| --- | --- | --- |
| A. Broken design-token refs | Valid, count wrong both ways | Fixed + gated |
| B. Token vocabulary undocumented | Valid | Fixed (generated) |
| C. FloatingLegend drops `defaultCollapsed` | Valid | Fixed |
| D. Overlay severity discarded | Valid | Fixed |
| E. No scalar type key | Valid | Fixed |
| F. Overlay sequence player | Unevaluable, scope call | DEFERRED |
| G. No double-click | Valid | Documented |
| H. Incremental layout unreferenced | Valid question, false dichotomy | Answered in docs |
| I. Derived values lack provenance | Valid | BACKLOG |
| J. StatsPanel unlabelled | Valid, overstated | Fixed |
| K. Handle naming inconsistent | Valid, breaking to fix | Documented only |
| L. Subpath symbols in root examples | Valid, both halves | Fixed |
| M. `core/internal` undocumented | Valid | Documented |
| N. No pattern pairings | Valid | Fixed |
| O. AriaCompanion unused | Valid | DEFERRED, needs ruling |

## A: the report's own count is wrong in both directions

The eight listed references reproduce. Two corrections:

**Three were missed.** `--g3t-success-muted`, `--g3t-warning-muted`,
and `--g3t-error-muted` resolve to nothing at `CoverageMeter.tsx:57`,
`:62`, `:67`. They sit in a four-row map whose fourth row uses the
real `--g3t-accent-muted`, so the intent is unambiguous: the semantic
trio wanted muted companions and never got them.

**One is a false positive.** `--g3t-toggle-accent`
(`PropertyField.css:116`) is an element-scoped custom property, set
inline at `PropertyField.tsx:78`. It resolves correctly and is not a
defect. A gate reading only the two global emitters, which is how the
report describes its attached script, necessarily flags it. The gate
written here treats a local definition as a definition, and reports 4
element-scoped properties separately from the 70 global tokens.

True figure: 11 broken references across 9 names.

Fixes: `zPopover` added to the z-scale between dropdown (400) and
overlay (800), with both fallback literals (9999 and 50, which had
already drifted apart) normalized to 600; `--g3t-color-scheme` emitted
from `theme.colorScheme`; `successMuted` / `warningMuted` /
`errorMuted` added to `G3tTheme` as OPTIONAL (required fields would
break consumer theme literals at 1.0.0) and defined in all three
presets; four references repointed at existing tokens.

`scripts/check-design-tokens.mjs` runs first in `verify` so it fails
before the build.

## B: generated, not authored

`docs/design-tokens.md` is emitted by the same script (`--write-docs`)
and drift-checked on every run. A hand-maintained table would have
diverged from the emitters within a round, which is the failure mode
the report is describing in the first place.

## D: tone, not severity

`StructuralOverlay` is algorithm-neutral, so a SHACL `severity` field
would have been wrong on it. Added `OverlayTone`
(`neutral | info | warning | danger`) as an optional hint, with
`severityOverlays` mapping violation/warning/info onto
danger/warning/info. `computeOverlayMembership` resolves tone
strongest-wins across overlapping active overlays, so a node that is
both a violation and an info reads as a violation. Neutral is stored
as absence, so `nodeTones.has(id)` means "wants a tone treatment".

The canvas keeps `g3t-ov-member` for geometry and takes color from the
tone class, declared after the member rules. Both stylesheets (static
and theme-derived) carry the rules. Every tone class is stripped
alongside the member class, preserving the round-21 restore-by-
construction property.

## H: the framing is a false dichotomy

"Either wired into the canvas or dead exports" is not the only
option for a library. `computeIncrementalUpdate` is exported, tested
in `combo/f1-f8.test.ts`, and documented as shipped in
`capabilities-and-limits.md:64`. It is correctly NOT wired: the canvas
cannot distinguish an additive change from a different subject, and
only the host knows. It was a documentation gap, now filled in
`consuming-g3t.md`.

Worth recording: the first draft of that documentation invented the
signatures, writing `computeIncrementalUpdate(oldUgm, nextUgm, prev)`
when the real function takes `(previousPositions, currentIds,
previousIds)` and operates on a live Cytoscape core, not a UGM. This
was caught only by putting `consuming-g3t.md` under the snippet gate,
which is now done. Two pre-existing illustrative fragments there took
the sanctioned `no-check` tag.

## J is overstated

The panel is not unlabelled: it has a title (`Distribution: {key}`)
and a "Count" y-axis name. The real gaps are a missing x-axis name, no
unit, and no way for a host to say what a bar counts for a derived
property. Added `title`, `unit`, `description`; x-axis now names the
property; y-axis renamed "Count" to "Nodes", which is what it counts.

## K is half-actionable

`GraphToolbar` takes `cy`, `Minimap` takes `core`, both the same
`onReady` value. Real, but both are 1.x public API and renaming either
is breaking. Documented instead; the rename is a maintainer call.

The undocumented half is worth more than the naming: `GraphToolbar`
ALREADY CONTAINS a `SearchBar` (its anatomy comment, line 7, records
this and the wiring guide did not). Adding a `SearchBar` beside the
toolbar ships two search fields both driving the selection store. Now
in the composition-levels section.

## Deferred, with reasons

**F.** The implementation was not attached. Even with it, this adds a
hook, a component, and a public export to a 1.0.0 library. Scope call
for the maintainer, not something to land unilaterally.

**I.** Valid and real. A provenance stamp on `DerivedPropertyEngine`
ripples into the encoding spec, the table, exports, and the validator.
Backlog, as the report itself categorizes it.

**O.** `AriaCompanion` and `useAnnounce` are genuinely unused by any
shell. Which shell should carry it is a demo-surface decision.

## Open thread this surfaced

G's larger point is the one worth keeping: `onReady` is load-bearing
for a whole category of consumer work (gestures, position capture,
camera, ad-hoc classes), and it hands out the raw Cytoscape `Core`.
Renderer independence would break every consumer reaching through it
simultaneously. That is a migration-planning item, not a gesture
question. Flagged in the wiring guide as a scoped caveat; the
migration story itself is unwritten.
