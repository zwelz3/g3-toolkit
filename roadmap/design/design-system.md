# Design System

**Area:** design
**Owns:** no spec requirements. Design quality is cross-cutting;
items here that grow into requirements get adopted through the
gap-analysis process, the same route the query editor, community
overlay, and entity page entered the spec corpus.
**Grounding:** assessed against the shipped token system
(packages/core/src/theme/design-tokens.ts, ThemeManager, g3t-base.css,
canvas palette) and the surveyed systems in
research/capability-landscape.md.

## Design position (the brief, stated once)

The toolkit is infrastructure for other people's applications, which
inverts the usual distinctiveness budget: adopter products must look
like themselves, not like g3t. The right identity is a **precision
instrument**: quiet chrome, data-forward, credible by default in a
defense/engineering context, and brandable by changing a small number
of variables. The existing choices already point there (IBM Plex as a
technical voice; Okabe-Ito with shape redundancy as a principled
palette; CSS custom properties as the theming spine) and should be
completed, not replaced.

The one place to spend boldness: **selection**. Cross-view linking is
the product's core verb; the moment a node lights up simultaneously in
canvas, table, timeline, and chart is the toolkit's signature. One
unmistakable selection treatment (halo + accent + consistent motion),
identical across every compound, with the focus ring as its keyboard
counterpart. Everything else stays disciplined.

## A. Atoms (token layer)

Shipped in this pass (the quality floor a component library does not
get to skip):

- **A1. Motion tokens + reduced motion.** Easing curves
  (`--g3t-ease-out`, `--g3t-ease-in-out`) added beside the existing
  durations; `prefers-reduced-motion` now zeroes the duration tokens
  globally, so every token-reading transition disables with one rule.
- **A2. Shipped:** `prefersReducedMotion()` in @g3t/core; CytoscapeCanvas
  animate default and deriveEChartsTheme animation now consult it.
  Originally: Cytoscape layout animation bypasses CSS tokens
  (JS-driven). Add a `prefersReducedMotion()` helper in @g3t/react and
  make CytoscapeCanvas's `animate` default consult it; same for
  ECharts animation config in deriveEChartsTheme.
- **A3. Focus ring tokens + `:focus-visible` rules.** Shipped: one
  treatment (accent outline, 2px, offset) for every interactive g3t
  element; pointer clicks stay quiet, keyboard navigation (R7.9) is
  unmistakable.
- **A4. Data scales.** Shipped: 9-step viridis sequential and PuOr
  diverging scales as tokens (`--g3t-seq-*`, `--g3t-div-*`) plus a
  `scaleColor()` helper, extending the R7.8 colorblind commitment from
  categorical to continuous encodings. MatrixView migrated off its
  hardcoded alpha-blue ramp (which washed out on dark backgrounds) as
  the first consumer.
- **A8. Shipped (from visual review):** per-theme `color-scheme` on
  G3tTheme plus a scoped `accent-color` rule, so native controls
  (checkboxes, selects, scrollbars) follow dark themes. Companion
  rule for adopters: containers that clip content must pad by focus
  ring width + offset (4px), or rings occlude at the edges.
- **A5. Z-index scale.** Shipped as tokens; remaining: sweep ad hoc
  z-index literals in dropdown/tooltip/modal components onto it (P2).
- **A6. Shipped (review pending in VA-12).** Type scale to rem: Pixel font sizes defeat browser-zoom
  text scaling; convert the scale to rem with the same visual sizes
  and raise the floor (10px xs is below comfortable density even for
  data UI; 11px equivalent minimum). One token change, but verify
  table/tree density at the new floor before committing.
- **A7. Shipped for buttons (VA-13); remaining inputs/rows P2.** State tokens: Hover/active/disabled surface and text
  tokens so molecules stop deriving states ad hoc; prerequisite for
  the density work in B3.

## B. Molecules (widgets)

- **B1. Shipped.** Icon system: Current iconography is Unicode glyphs
  (▶ ▼ ✓ ✗ across tree, table, inspector, SHACL browser) plus one
  inline SVG: inconsistent cross-platform rendering, unthemable,
  unannounceable. Replace with a small internal SVG icon set
  (chevrons, check, cross, search, gear, pin, layers, filter, play/
  pause: roughly 20 glyphs, stroke-based, `currentColor`, sized by
  token) behind an **IconRegistry** so adopters can swap the set
  wholesale (their brand likely has one). Registry over dependency:
  shipping lucide as a peer would impose an aesthetic and a package on
  every adopter; the registry default costs a few KB and stays
  swappable. Every icon-bearing element keeps a text or aria label
  (the glyphs-as-text today at least read; the SVGs must not regress
  this).
- **B2. Shipped complete (empty/error/loading; VA-16).** One pattern: The
  skill's writing rules applied as a component: an `EmptyState`
  molecule (what this is, why it's empty, the one action that fills
  it) and a skeleton/loading convention for adapter-bound views.
  Today each view improvises (MatrixView's empty div, inspector's
  not-found); the audit pattern applies to copy too: errors say what
  happened and what to do, never apologize, never go vague.
- **B3. Shipped for TableView and TreeView (VA-14/VA-17).** Density variants: `comfortable | compact` density prop
  driven by a token multiplier, for the thin-client analyst
  deployments the working-set limits already acknowledge; tables and
  trees first, where row count is the job.
- **B4 (P2). Badge discipline.** Validation and count badges gain the
  shape-redundancy rule (R7.8 applies to badges too: pass/fail must
  differ by glyph, not only green/red); the SHACL browser's ✓/✗ pair
  already complies in spirit and converts to B1 icons.

## C. Compounds (components and views)

- **C1. Shipped (tokens + table + charts + canvas double-ring + map halo; gasket halo (offset accent ring over a canvas gap) after the round-4 finding that the double ring failed in every theme; HC palette pass remains the documented escalation; timeline/map sweep remains P2 pending visual baselines).** The selection signature: Unify the selection treatment:
  one halo color/weight (token-driven), one transition (ease-out,
  fast), applied identically in canvas (node halo + edge emphasis),
  table (row accent bar, not full-row fill), timeline (event ring),
  charts (point/bar emphasis with non-selected de-emphasis), map
  (marker ring). The R3.9 overlay emphasis and D9 inferred-edge
  styling allocate around it: selection owns the accent; overlays own
  weight/emphasis; inference owns dash. This is the channel-allocation
  table design/projection-and-encoding.md already commits to: produce
  it first, then sweep the compounds.
- **C2 (P1). Canvas legibility at scale.** Level-of-detail labeling
  (labels fade below a zoom threshold instead of colliding),
  degree-weighted label priority, and hover affordance (cursor +
  subtle halo preview). Pairs with the large-graph work; the LOD
  thresholds become tokens so deployments tune them.
- **C3 (P2). Chart theme completion.** deriveEChartsTheme adopts the
  sequential/diverging tokens for continuous axes and heat series so
  charts and matrix agree on what magnitude looks like; trend lines
  and brush chrome read from theme tokens rather than ECharts
  defaults.
- **C4. Shipped (VA-18): panel anatomy adopted by inspector, shape browser, annotation panel, encoding panel, and legend headings.** Panel chrome consistency: Inspector, shape browser,
  encoding panel, annotation panel converge on one header/section/
  spacing grammar (tokens exist; usage drifts). A Storybook
  "panel anatomy" story becomes the reference, and visual-regression
  baselines (release-engineering item 2) make it durable.

## D. Shells (reference applications)

- **D1 (P2).** full-workspace and the demo shells adopt the density
  prop, the icon set, and the selection signature, demonstrating
  composition rather than re-styling: the shells are where adopters
  judge whether the system holds together.
- **D2 (P2).** A "theming" demo scenario: live theme editor over the
  G3tTheme interface proving the brand-in-one-variable claim (set
  accent + palette, watch canvas/table/charts follow).

The Storybook and demo side of adopter evaluation (showing the selection
signature as a live cross-view moment, co-locating the verified wiring
recipes, the D2 theming demo above, an intent index, and a minimal
starter) is sequenced in design/demonstration-surface.md; C1 and D2 are
its design-quality inputs.

## E. Customization model (the adopter contract)

Three sanctioned layers, documented in this order in the theming
docs: (1) **theme**: a `createTheme(partial)` helper over G3tTheme
with WCAG-contrast validation of the result (warn, don't block), so
brand themes start from a checked baseline rather than copying the
light preset; (2) **tokens**: scoped CSS-variable overrides per
container for surgical changes (already works; document it as the
supported path); (3) **structure**: className/style passthrough
(exists) plus the IconRegistry (B1), icon SETS with sanitize-by-default for end-user-loaded glyphs and trusted mode for adopter-compiled ones (registerIconSet, VA-21), and render-prop slots only where
a real case exists (entity-page sections are the first candidate).
Explicitly unsupported: reaching into g3t class internals; the base
stylesheet's class names are not API.

## Sequencing

P1 set (A2, A6, B1, B2, C1, C2) is one coherent pass: floor
completion + the signature. P2 set follows the visual-regression
baselines landing (release-engineering), because chrome-consistency
work without screenshot gating regresses silently. Each shipped item
updates this file's tier list from plan to shipped, as A1/A3/A4/A5
already are.
