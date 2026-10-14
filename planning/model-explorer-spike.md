# Model Explorer spike (2026-10-14)

Source: a design discussion about managing a platform's data models
(an internal Rust/TypeScript model and an external SHACL contract, kept
as two models joined by a CI-checked mapping) produced a single-file
prototype of a model explorer. The owner approved it visually and asked
for a playground scenario at visual parity with it, built on the
toolkit, to find out how much of the design the toolkit already
carries. This log records what the spike used, what it found, and what
it did not verify.

## What shipped

A ninth landing card, **Model Explorer** (capability surface,
`src/demo/explorer/`, lazy chunk like every other shell). Demo code
only: no package source, export, or bundle-ledger change.

| File | Role |
| --- | --- |
| `model.ts` | The sample model as one versioned `model-trace` document (concept, contract and realization per property, relations, sample rejected writes); view options; the three role profiles; the saved module arrangement |
| `derive.ts` | Pure projections: trace status, row text per lens and notation, the entity-view placement template, the map layout and detail levels |
| `styles.ts` | Generated from the prototype's stylesheet (scoped under `.mx`, variables renamed `--mx-*`) so parity is by construction, not by retyping |
| `ExplorerShell.tsx` | The prototype's React tree ported to TSX |
| `derive.test.ts`, `ExplorerShell.test.tsx` | 23 tests; the load-bearing one is below |

## What comes from the toolkit, and what does not

| Prototype behavior | Source in the scenario |
| --- | --- |
| Map module placement | `layoutStructural` over the module graph (modules as fixed-size plain nodes, one edge per related pair), run once per document |
| Map detail levels (Modules, Classes, Properties, Full detail) | A core `LodSchedule` resolved with `resolveLod`; edge labels follow its `edgeLabels` flag |
| Multi-class selection on the map | `useSelectionStore` (exported zustand store), so another view could read or drive it |
| Light/dark palette | `useThemeStore`, not the OS setting |
| Data | One versioned JSON document (the documents channel), never fetched or mutated by the UI |
| Drawing (entity view and map) | Scenario-local SVG, see finding 1 |
| Entity view placement (superclass above, parts below, references right, incoming left) | Scenario-local template, as proposed in the discussion |

## The load-bearing contract

`derive.test.ts`, "draws every class centred in the same slot at every
level, lens and notation": for all 10 classes, 3 drawn levels and 6
option variants, the drawn box's centre equals its slot's centre and
fits the slot's height. That is the stability rule applied to level of
detail: zoom, lens, labels and notation redraw inside fixed slots and
never re-run layout. The removed expand/collapse feature
(`planning/expand-collapse-postmortem.md`) failed because a detail
change re-laid out; this design cannot, by construction.

## Findings

1. **`StructuralSvgView` cannot carry this view's rows.** It draws one
   text run per row. The explorer needs per-row columns (name, type,
   required, example value), three per-layer marks, faded rows, and
   different content per detail level. Rather than widen a library view
   inside a spike, the scenario keeps its own SVG. Library candidate if
   the owner wants it: a row renderer hook (or multi-cell rows) on the
   structural view.
2. **A plain layered layout of the classes interleaves modules.** Probe
   (direction RIGHT, real class sizes): GroundStation landed between
   Channel and PayloadComponent, so module regions drawn from member
   bounding boxes would overlap. Hence the two-level design: modules
   are the layout's nodes, classes stack inside by template.
   `StructuralNode` has no parent/child nesting; that is the library gap
   behind this.
3. **`sketch` does not order a from-scratch layout.** Passing the saved
   arrangement as `sketch` produced coordinates identical to the
   unsketched run (the sketch is in the cache key, so this is the
   engine, not the cache). It is documented as a stability hint for
   RE-layouts, so this is arguably as designed. The scenario keeps the
   toolkit's layer assignment (columns) and orders modules within a
   column from the saved arrangement (`orderWithinLayers`), which
   reproduces the prototype's arrangement exactly.
4. **Class-level edges are straight, not routed.** Module-level layout
   runs with `routeEdges: false`; class edges are drawn box to box with
   ends spread along each side (as in the prototype). At this model's
   size that reads cleanly; at hundreds of classes it would need routed
   or bundled edges.

## Parity check

Method: the prototype and the playground scenario rendered in headless
Chromium at 1280×900, dark scheme, six states (systems-engineer entity
view; knowledge-engineer entity view with the `band` row's detail open;
app-developer with the customize drawer open; map at fit; map at the
Modules level; knowledge-engineer map at Full detail), compared side by
side.

Result: the entity views and the drawer match. The map matched in
style but not arrangement on the first pass (finding 3); after the
within-layer ordering it matches. Two differences are intentional: the
shell's "Scenarios" back button and the playground's capability
bubble.

Not verified here: the light palette inside the playground (its tokens
are generated from the same source as the prototype's), the Pages
build, phone widths, and the IBM Plex webfont (blocked in this
environment, so both renders fell back to the same system face; the
live page loads it).

## Review follow-up (same day)

Zach's review asked for two changes, both applied to the prototype and
the scenario so they stay at parity. Lenses now carry their layer
letter and canonical name everywhere a layer is named (pill, customize
panel, detail table, legend): Concept (C), Shape / Contract (S),
Realization (R), Combined (C+S+R); one `LENSES` table in `model.ts`
feeds every label. A Light/Dark switch in the header sets the toolkit
theme through `useThemeStore` (the prototype has System/Light/Dark,
since it has no host theme). Two tests cover the letters and the
switch. A separate prototype, Model Index (a searchable glossary with
SKOS labels and links), was built as an unlinked artifact and is not
part of the playground.

## Next, if the owner wants to continue

In priority order: decide whether finding 1 becomes a structural-view
row renderer; decide whether finding 2 justifies nesting in
`StructuralNode` (layout-engine work in the area the collapse
postmortem warns about; the overlay-free two-level layout here is the
cheaper alternative and may be enough); then real data through a
`model-trace` converter, which is upstream work, not toolkit work.
