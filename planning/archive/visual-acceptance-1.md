# Visual Acceptance Pass 1 (design-pass-2 deliverables)

**Goal:** end this turn with an artifact Zach can verify by eye:
a single self-contained HTML page rendering the design-pass-2 work
from the REAL source (not a parallel mock that could diverge), with
numbered acceptance checks and explicit pass criteria.

**Why this shape:** jsdom verified behavior; nothing yet has verified
appearance. The Playwright baselines (release-engineering item 2)
will automate visual regression later; this page is the human
bootstrap for that, and the reviewed page becomes the reference for
the first committed baselines.

## Architecture (honesty constraint)

`scripts/visual-acceptance/render.tsx` imports the toolkit source
through the workspace aliases; `emit.ts` renders it CLIENT-SIDE under
jsdom and serializes the result. (The plan said SSR; execution found
zustand v5's React binding serves server renders the store's
creation-time snapshot, so a pre-render selection was invisible to
renderToStaticMarkup. The probe and pivot are in the turn log; the
client render is also truer to what the browser shows.) Rendered: Icon (full set), EmptyState
variants, MatrixView and TableView over fixtures with the selection
store pre-populated. Theme CSS blocks are generated from the exported
LIGHT/DARK/HIGH_CONTRAST theme objects and DESIGN_TOKENS using the
same property names ThemeManager injects; g3t-base.css is inlined
verbatim (?raw). A small vite SSR config builds the entry; a node run
emits visual-acceptance.html. No network, no build tooling needed to
view: open the file.

What cannot be in the page and why: CytoscapeCanvas (WebGL/DOM
runtime, no SSR; its halo token is shown as a swatch + the derived
stylesheet value instead) and true prefers-reduced-motion (an OS
setting; the page simulates by zeroing the duration tokens and says
so).

## Checks (VA-1 .. VA-10)

| #     | What                                              | Pass criteria                                                                              |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| VA-1  | Icon set, all 22 at 16px                          | Uniform stroke weight; nothing clipped; recognizable at a glance                           |
| VA-2  | Icon sizing row (12/16/20) + currentColor         | Crisp at all three; recolors with theme switch                                             |
| VA-3  | EmptyState + ErrorState                           | One anatomy; copy states what/why/how-to-fill; error reads as error                        |
| VA-4  | Matrix gradient (viridis)                         | Magnitude ordering obvious; counts legible on both scale ends; still legible in dark theme |
| VA-5  | Matrix truncation notice (maxSize=3 over 6 types) | Notice present, plain, non-alarming                                                        |
| VA-6  | Table selection signature                         | Accent bar + tint on selected rows; follows the accent in all three themes                 |
| VA-7  | Sequential + diverging ramps                      | Smooth perceptual progression; diverging midpoint reads neutral                            |
| VA-8  | Focus ring                                        | Tab shows the ring on every control; mouse click does not                                  |
| VA-9  | Reduced-motion simulation                         | Spinner animates; checking the box freezes it (labeled as a simulation of the OS setting)  |
| VA-10 | Theme switcher + badges                           | Three presets switch live; pass/fail badges differ by glyph and color                      |

## Turn exit

Generator + plan committed; HTML delivered for review. Feedback path:
each check is PASS / FAIL(with what looked wrong); failures become
scoped items in roadmap/design/design-system.md. On overall pass, the
page's sections seed the Playwright baseline set.

## Execution record (2026-06-11)

Generator shipped (`pnpm run visual-acceptance`): vite SSR-builds the
entry, node renders under jsdom, structural self-checks gate the
output (the self-check caught the zustand snapshot failure on its
first run). Emitted page: 40.4 KB, 22 icons, 2 selected rows, all
eight markers present. Status: AWAITING REVIEW (VA-1..VA-10).

## Review round 1 (Zach, 2026-06-11): three findings, all fixed

1. **Buttons and checkbox ignore the theme (dark mode).** Root cause
   was twofold and entirely toolkit-side: (a) class drift: the focus
   rule and the page used `.g3t-button`, but the real, tokenized class
   is `.g3t-btn` (8 component usages), so the demo buttons were
   unstyled native controls; (b) no `color-scheme` per theme and no
   `accent-color`, so native controls keep UA-light styling under dark
   themes. Fixed: G3tTheme gains `colorScheme` (injected onto the root
   plus a controls accent var), g3t-base.css gains a scoped
   accent-color rule, the focus rule and page use `.g3t-btn`.
2. **VA-8 focus ring occluded by its container.** The page's
   `.va-body { overflow-x: auto }` clipped the ring (ring + offset
   render 4px OUTSIDE the element). Fixed with padding plus a scoped
   scroll wrapper; the general rule (clip containers must pad by ring
   width + offset) is recorded in the design-system roadmap.
3. **Matrix label typography (component defect).** The unsized
   `rotate(-45deg)` column headers overlapped cells (VA-4) and touched
   the boundary (VA-5); row labels were left-aligned `td`s. Fixed in
   MatrixView: vertical-rl column headers (bottom-aligned, padded off
   the boundary), right-aligned `th scope="row"` row headers, mono
   axis-label typography.

Also added this round: VA-11 canvas selection halo, with the
border-width read from `deriveCytoscapeStyle` output at generation
time, closing the plan/page drift the provenance question surfaced.
Status: regenerated page AWAITING REVIEW round 2 (VA-1..VA-11; focus
on VA-4, VA-5, VA-8, dark-mode controls, and the new VA-11).

## Review round 2 (Zach, 2026-06-11): one residual, fixed

Matrix column labels still crowded the table boundary: the vertical
headers had bottom padding only. Fixed with top and side padding
(6px 2px 8px), self-checked in the regenerated page.

## Round 3 additions (visual-only improvements)

- VA-12 rem type scale (A6, previously deferred pending eyes): tokens
  converted px to rem with the floor raised from 10px to
  11px-equivalent; specimen rendered per size.
- VA-13 button states (A7): tokenized active surface, new disabled
  state (inert, hover-proof, not-allowed cursor).
- VA-14 table density (B3): density="compact" prop on TableView,
  side-by-side comparison, selection signature in both.
- VA-15 map selection signature (C1 sweep): selection now adds the
  accent halo and keeps the marker's categorical color; the previous
  fill-swap to a hardcoded blue violated the channel-allocation table
  and is regression-guarded by map-selection.test. Labels and fills
  moved onto theme vars (the #333 labels broke dark mode).

Status: AWAITING REVIEW round 3 (focus: VA-4/VA-5 boundary padding,
VA-12 floor legibility, VA-13 hover/disabled, VA-14 compact rhythm,
VA-15 halo).

## Review round 3 (Zach, 2026-06-11): three findings, all fixed

1. **Map background ignored dark mode.** Hardcoded #e8f4f8 on the
   SVG; now var(--g3t-canvas-bg), graticule on var(--g3t-border).
   Not intentional: a plain bug.
2. **Pagination buttons odd across themes (VA-6/VA-14).** Two causes:
   bare classless native buttons (now g3t-btn, inheriting disabled
   styling too), and the high-contrast theme carried
   colorScheme: "dark" on a white background (a round-1 mistake of
   mine; corrected to "light").
3. **HC canvas selection indiscriminable (black node, blue ring).**
   Root cause is structural: HC's typePalette[0] is pure black, so a
   color-only halo cannot read against it. Fix is geometry
   redundancy per the toolkit's own no-color-only principle: the
   selection ring is now border-style: double (halo token widened to
   4px so the double resolves) in deriveCytoscapeStyle and the VA-11
   swatch. If the double ring still reads weak in HC on re-review,
   the follow-up is an HC-specific palette pass (white fills, black
   strokes), noted in design-system.md.

## Round 4 additions

VA-16 loading skeletons (B2 complete: empty/error/loading all one
pattern; shimmer token-driven, frozen under reduce-motion). VA-17
TreeView density (B3 continued). Status: AWAITING REVIEW round 4
(focus: VA-15 map in dark mode, VA-6/VA-14 pagination across themes,
VA-11 double ring in high contrast, VA-16, VA-17).

## Review round 4 (Zach, 2026-06-11): VA-11 still failing; approach replaced

The double ring failed in all three themes: CSS double at small widths
blurs into a single ring, and the ring remained adjacent to dark
fills, so high contrast's black node still swallowed it. Replaced
with the GASKET halo (the anatomy the map halo already used, which
passed review): the node keeps its own border; the accent ring sits
offset by a canvas-colored gap (Cytoscape outline-color/width/offset;
tokens --g3t-selection-halo-width 3px + --g3t-selection-gap-width
2px). The ring now contrasts with the canvas and is separated from
ANY fill, black included. VA-11 swatch mirrors it via two-tone
box-shadow; regression-guarded in coverage-gaps (derived style is
outline-based, border untouched). The double-ring entry in the
roadmap is marked superseded.

## Round 5 additions

VA-18 panel chrome (C4 first slice): .g3t-panel /
.g3t-panel-section-header / .g3t-panel-section-content anatomy in the
base stylesheet, adopted by DetailInspector and ShaclShapeBrowser;
side-by-side comparison. Status: AWAITING REVIEW round 5 (focus:
VA-11 gasket in ALL THREE themes, especially high contrast; VA-18
sibling consistency).

## Review round 5 (Zach, 2026-06-11): ALL CHECKS PASS

VA-1 through VA-18 pass visually across all three themes, including
the gasket halo in high contrast (the HC palette escalation is not
needed). Feature request from review: indicate sh:closed vs sh:open
on SHACL shapes (lock icon or similar).

## Round 6 additions

- **sh:closed, end to end (review request).** ShaclShape gains
  `closed` and `ignoredProperties`; validateShacl now ENFORCES
  closed-world semantics (undeclared properties violate, ignored
  paths exempt, open shapes untouched: three validator tests). The
  shape browser shows a muted lock with an accessible label on closed
  shapes; `lock` joins the icon set (23 glyphs). VA-18's SiteShape is
  now closed for review.
- **createTheme() + contrastRatio() (customization layer 1).** Partial
  over a base preset with WCAG checks that warn, never block
  (textPrimary 4.5:1, secondary 4.5:1, muted 3:1, accent 3:1 against
  bgPrimary); exported through the theme barrel; three tests.
- **C4 slice 2.** AnnotationPanel, EncodingPanel, and the legend
  "Types" heading adopt .g3t-panel-section-header; VA-18 now renders
  all four panels side by side.
- **VA-19 accent editor.** Live token-override demo (layer 2): a color
  input drives --g3t-accent-\* with reset; proves the
  brand-in-one-variable claim interactively.

Status: AWAITING REVIEW round 6 (focus: VA-18 lock + four-panel
consistency, VA-19 accent propagation including focus ring and VA-11
halo).

## Round 7 additions (encoding overhaul; round 6 still awaiting review)

Design resolution for the review request "greater control without an
overwhelming surface": the encoding grammar (channel <- driver via
scale) with three disclosure tiers, written up in
roadmap/design/encoding-controls.md and implemented:

- **Spec model** (encoding-spec.ts): channels, fixed/categorical/
  sequential scales with per-value overrides (slot-stable: pinning
  one value never reshuffles the rest), auto or clamped domains,
  reserved-channel guard (effects.accent and friends rejected at
  parse with the owner named), versioned JSON round-trip, legacy
  EncodingConfig adapter, custom-palette warnings (contrast + CVD,
  warn never block). 13 model tests covering the design doc's seven
  acceptance use cases.
- **EncodingSpecPanel** (tier 1: one row per channel with driver +
  mapping chip, reserved rows visibly theme-delegated; tier 2: inline
  editors per scale kind: categorical color with palette select and
  per-value pickers, range/domain editor, per-value icon map from the
  registry). Legacy EncodingPanel kept working, marked deprecated.
- **EncodingPreview**: samples rendered THROUGH the resolvers, so the
  preview is proof of the spec, not an illustration. 10 panel and
  preview tests.

Status: AWAITING REVIEW round 7. Focus: VA-20's three panes (tier-1
scanability, tier-2 editor density, preview-vs-spec correctness) plus
the round-6 items (VA-18 lock + four panels, VA-19 accent editor).

## Review round 7 (Zach, 2026-06-11)

PASS: VA-18 (lock + four-panel anatomy), VA-19 (accent editor).
FINDINGS on VA-20, all addressed in round 8:

1. **Preview did not follow tier-2 edits.** Structural, not cosmetic:
   the page was a static serialization, so React handlers were dead
   and "proof, not illustration" only held for the initial render.
   Fix: VA-20 is now a LIVE React island: the same Va20Live component
   is SSR'd as the no-JS fallback and mounted by an inlined client
   bundle (274 KB, built from the same source through the same
   aliases), so edits drive the preview and a live spec JSON through
   the shipped resolvers. Reset, icon remap, domain clamp: all real.
2. **Unwired controls** (reset, node.icon chevron): same root cause,
   same fix.
3. **VA-18 still showed the deprecated EncodingPanel.** Replaced with
   EncodingSpecPanel (compact). The deprecated component remains in
   the package only for the four demo shells; their migration through
   fromLegacyConfig is queued in encoding-controls.md.
4. **Panes escaped the VA-20 container.** Root cause: grid/flex
   children default to min-width:auto and refuse to shrink below
   content width. Fixed with min-width:0 hygiene on layout children,
   wrap-tolerant encoding rows, and a responsive two-column live grid.

Build lesson recorded: inlining the island via String.replace's
string form exploded the page to 2.3 MB because the bundle contains
$-sequences that the string form expands as replacement patterns
(the page pasted itself into its own script). The replacer-function
form is literal; the page self-check caught it via phantom matches.

Status: AWAITING REVIEW round 8. Focus: VA-20 live behavior (pin and
reset Person's color; remap an icon; clamp the size domain; watch
preview + spec JSON), VA-18 with the spec panel, and the
narrow-window containment.

## Review round 8 (Zach, 2026-06-11): two VA-20 bugs + a feature request

1. **node.color with a label/pagerank driver broke the chip.** Root
   cause: chip and preview SAMPLE CONSTRUCTION assumed the types
   driver (values were stuffed into types[0], so other drivers
   resolved to nothing). Fixed with driver-aware sampleAttrsFor, and
   the preview's default samples are now the first four REAL node
   attrs, truthful for any driver mix. Bonus behavior from the same
   diagnosis: switching the color driver to an all-numeric property
   now defaults to a sequential ramp instead of one-color-per-number
   categorical. Regression tests added for both.
2. **Custom-palette warning never cleared.** Root cause: warnings
   evaluated the stale palette array while the pickers wrote to
   overrides. Custom mode is now one source of truth: switching to
   custom folds the EFFECTIVE colors into the array and clears
   overrides; pickers edit array slots; warnings evaluate the
   effective colors against the LIVE --g3t-canvas-bg and are skipped
   entirely while every effective color remains a member of the named
   CVD-safe palettes. Regression test renders, fixes the offending
   slot, and asserts silence.
3. **Feature: end-user icon sets.** Did not exist (registerIcon was
   single-glyph, adopter-trust only). Shipped registerIconSet with
   sanitize-by-default (geometry allowlist; script elements, on\*
   handlers, foreignObject, url()/javascript: values are rejected BY
   NAME, never silently stripped), trusted mode reserved for
   adopter-compiled sets, optional pre-mappings filtered to
   successfully registered glyphs, and applyIconMappings to drop a
   set's mappings into a spec's icon channel. Nine new tests.

## Round 9 additions

VA-20 carries the two fixes live (try the label and pagerank drivers;
break and fix a custom palette and watch the warning go). VA-21 is a
new live check: load the brand set (preview icons remap in place),
unload (defaults restore), and run the hostile set to see the
sanitizer's named rejections. Status: AWAITING REVIEW round 9.

## Review round 9 (Zach, 2026-06-11): mostly passing, five notes

1. **Chip lost its multiple palette colors.** Regression from the
   round-9 sampling fix: the resolver was created INSIDE the per-value
   map, so every value got a fresh categorical indexer and landed on
   slot 0. One resolver per strip now; regression test asserts >= 2
   distinct strip colors with no overrides.
2. **Fixed node.size / edge.width were not editable.** The design
   table's "single slider with value readout" widget existed only on
   paper. FixedNumberEditor shipped (slider + number input, px
   readout) for both; edge.color also gained its missing chip strip
   and categorical/fixed editors while in there. Five new tests.
3. **Odd-integer node sizes for icon centering?** No: centering is
   flex/SVG-based and subpixel-correct at any size. Preview sizes are
   now rounded to integers, but for crisp 1px borders, not centering.
4. **node.shape?** Yes, later: documented in encoding-controls.md as
   a categorical-only channel that defaults to pairing with
   node.color's driver (shape is the CVD redundancy channel), landing
   with the canvas spec-application milestone.
5. **Theme switcher: component + actually sticky.** ThemeSwitcher is
   now a real exported component over useThemeStore (data-theme-option
   buttons, aria-pressed, optional onSelect for host chrome). The
   sticky failure was parent physics: sticky only sticks within its
   parent's box and the switcher lived in the short header. It now
   sits in a dedicated sticky bar as a direct child of main, SSR'd
   and re-mounted live by the island; the vanilla fallback delegates
   on the component's own attribute.

## Round 10 additions

Fixed-value editors (node.size, edge.width, edge.color), chip
multi-color regression fix, integer preview sizing, ThemeSwitcher
component + sticky theme bar, node.shape design entry. Status:
AWAITING REVIEW round 10 (focus: chip strips, the three fixed
editors, edge.color editing, the theme bar following you through the
full scroll, and re-checks of VA-20/21 live behavior).

## Review round 10 (Zach, 2026-06-11): PASS

All five round-9 notes verified fixed; no new findings.

## Round 11 additions (the application milestone)

The spec drives the canvas. applyEncodingSpec computes element-data
patches through the SAME resolvers as panel and preview (4 tests:
claimed-channels-only precedence, rounding, label drivers, the
fixed-flatten screenshot case); CytoscapeCanvas gains encodingSpec
with a batch-patch effect (ordered AFTER init: effects run top-down
and the initial application needs cyRef populated) plus exported
attribute-presence edge rules (rule test). SpecLegend mirrors the
spec through the same resolvers (2 tests). VA-22 is the FIRST LIVE
CANVAS CHECK in this harness: panel, real Cytoscape canvas, and
legend share one spec in the island; selection's gasket stays
untouched throughout, demonstrating the reserved-channel contract on
the real renderer. Page grew to ~947 KB (island ~842 KB: Cytoscape +
fcose + React); acceptable for an acceptance artifact, noted for the
record. Status: AWAITING REVIEW round 11 (focus: VA-22's loop: pin a
color, switch the driver to pagerank, clamp the domain, map
edge.width fixed, click a node for the halo; plus VA-20/21
re-checks).

## Review round 11 (Zach, 2026-06-11): two findings

1. **Visual-only edits re-ran layout on VA-22.** Diagnosis: element
   data() patches never trigger layout in Cytoscape, so a re-layout
   meant a re-INIT: the fixtures rebuilt their UGM on every render,
   and a fresh ugm identity correctly reads as "different graph".
   Harness fixed (all three live fixtures memoize the graph for the
   component lifetime) and the contract is now explicit in the
   component: ugm MUST be referentially stable (jsdoc), and
   encodingSpec changes are documented restyle-only. VA-22's pass
   criteria now state it outright: positions must not move during
   visual edits. A deliberate user-invoked re-layout affordance
   (for after large size changes) is noted as a future control in
   encoding-controls.md; automatic re-layout is not on the table.
2. **860px container squished multi-pane checks.** Main is now
   1320px; prose (criteria text, derived lines) keeps a 78ch measure:
   cap the text, not the container.

## Round 12 additions

Both findings addressed; no new surface. Status: AWAITING REVIEW
round 12 (focus: VA-22 position stability through color/driver/
domain/width edits, and breathing room across VA-18/20/22).

## Round 13 additions (autonomous batch; rounds 12-13 awaiting review)

Per request, a multi-round batch without interleaved review:

1. **Icons on the canvas.** iconDataUri wraps string-markup registry
   icons as white-stroke SVG data URIs; applyEncodingSpec emits
   \_icon; the node[_icon] attribute-presence rule renders them
   (background-image, 60% fit). Component-valued icons degrade to
   panel/legend; unregistered names produce no field. Three tests
   (one caught the registry's discriminated-union renderer shape).
2. **node.shape shipped** per the round-10 design: ShapeScale,
   slot-stable resolver over NODE_SHAPES with pinning overrides,
   panel row with per-value shape selects, the paired-redundancy
   warn-not-block notice when shape and color drivers diverge, a
   legend shape section with glyphs, and \_shape emission (flows
   through the existing data(\_shape) mapper). Five tests.
3. **Legacy encoding fully retired in-repo.** All FIVE shells (a
   Healthcare shell surfaced beyond the four originally counted) and
   DemoApp migrated to EncodingSpecPanel + SpecLegend + the
   encodingSpec canvas prop via fromLegacyConfig; DemoApp's canvas
   previously received NO encoding at all (the panel drove only the
   legend), fixed by the migration. Zero residual consumers;
   deprecation notes now state removal is scheduled for the next
   major.

VA-22's spec gains shapes (Person ellipse, Org round-rectangle,
Document auto-cycles to diamond) and its copy covers
glyphs-on-canvas plus the pairing-warning exercise. Status: AWAITING
REVIEW rounds 12 + 13.

## Round 14 additions (autonomous; rounds 12-14 awaiting review)

1. **Per-instance overrides actually apply (M12 wiring).** Grounding
   found the style-override store had NO canvas consumer:
   NodeStyleEditor and the context-menu appearance actions wrote
   overrides nothing read, and the core stylesheet-merge helper's
   type-scoped selector targeted a \_type field never stamped. Wired
   as Cytoscape BYPASS styles in the canvas (win over every mapper,
   restore on removal, type scopes resolved in JS): precedence now
   holds by MECHANISM (theme=CSS vars, spec=element data, instance=
   bypass, reserved=untouched outline-\*), documented in the design
   doc with one named tension (instance border pins vs future overlay
   emphasis).
2. **SpecPort (tier 3).** The spec JSON as a live surface: follows
   panel edits until dirtied, Apply parses with every failure
   surfaced verbatim (malformed JSON, version, ReservedChannelError
   with the owner named), Reset restores. Four tests.
3. **VA-22 is now the full-stack proof**: theme bar -> panel (spec)
   -> 'Pin Helix gold' (instance override that SURVIVES spec
   recoloring and re-driving, rejoining on Clear) -> selection gasket
   (reserved) -> spec JSON round-trip including the live
   reserved-channel rejection.

Status: AWAITING REVIEW rounds 12 + 13 + 14.

## Round 15 additions (autonomous; priority request: search + toolbar)

The pieces existed but were DISCONNECTED callback components:
SearchBar searched the UGM and drove the selection store, LayoutManager
rendered full force controls (repulsion, gravity, edge length),
ZoomControls emitted callbacks, and nothing mapped any of it onto a
Cytoscape instance. GraphToolbar is that glue:

- layoutConfig/runGraphLayout map LayoutManager's (id, options) onto
  real layout configs: force -> fcose with repulsion/edge-length/
  gravity; dagre/elk degrade VISIBLY to breadthfirst (engines not
  bundled; degraded layout beats a thrown error); fcose itself
  degrades to cose if unregistered; reduced motion disables layout
  animation.
- GraphToolbar composes search (with camera center-on-match), the
  layout manager (every run deliberate: the user-invoked re-layout
  affordance promised in round 12), freeze (locks node positions),
  and zoom/fit, over a cy handle from onReady. Nine tests with a
  mock cy.
- VA-23: the toolbar live over its own canvas with a 15-node,
  three-community graph so layouts visibly differ and search has
  targets.

Harness lesson recorded: a render.tsx import edit silently no-opped
because prettier had reflowed the import to multi-line and that one
replace carried no assert; the page self-check caught it as a total
marker wipeout. Every replace gets an assert, including the
boring ones. Status: AWAITING REVIEW rounds 12-15.

## Review round 15 (Zach, 2026-06-11): five VA-23 findings

All addressed in round 16:

1. **Context menu ignored the theme.** Hardcoded white/#ccc/#eee
   replaced with tokens (bg, border, text, color-scheme, z-token) and
   a themed hover class; VA-23 now renders an always-open menu sample
   so theme compliance is reviewable without right-clicking.
2. **ELK without UML containers is pointless.** Agreed: ELK and dagre
   left the selectable list (both silently degraded to breadthfirst,
   which misleads); roadmap/design/toolbar-and-layouts.md records the
   pairing: ELK returns with compound/UML-element-container
   rendering, dagre when its extension is bundled.
3. **Layout pass (requested audit).** Six findings, dispositions in
   toolbar-and-layouts.md. The big one: LayoutManager committed a
   re-layout on EVERY slider tick, so one drag queued dozens of
   competing layout runs; commits now debounce after the drag
   settles (regression-tested), and the toolbar goes further with an
   explicit Run layout commit. Also fixed: pin silently swallowing
   layout switches. Kept deliberately: fit-on-run, incremental fcose
   (randomize:false), search zoom floor.
4. **Toolbar layout was poor.** Root cause: a sidebar-shaped
   LayoutManager and 32px overlay zoom buttons stacked into a bar.
   Rebuilt as one 26px row over LayoutManager's exported model:
   search (flex), layout select, options POPOVER with Run, Re-run,
   Pin all, compact zoom group. ZoomControls remains the
   canvas-overlay molecule it was designed to be.
5. **animate/freeze semantics.** Settled in toolbar-and-layouts.md:
   animate never meant "the engine runs" (it always runs); it means
   you watch the heatup/cooldown, so the toolbar has no animate
   toggle and motion follows prefers-reduced-motion. Freeze became
   "Pin all" (whole-graph position lock, controls disabled with
   explanation); per-node pinning is ROADMAPPED with the composition
   semantics written down.

## Round 16 additions

Menu tokenization + VA-23 menu sample; LayoutManager debounce +
honest engine list + exported model + accessible slider labels;
GraphToolbar rebuilt (single row, popover commit, Pin all); settings
glyph (24 icons); toolbar-and-layouts.md design notes. Status:
AWAITING REVIEW rounds 12-16 (VA-22 and VA-23 carry everything).

## Round 17 additions (Tier 1 execution; rounds 12-17 awaiting review)

Per the roadmap reassessment: Tier 1 items 1 and 2.

1. **Per-node position pinning (SHIPPED).** position-pin-store with
   the pure composition rule computeLockedIds (pin-all = union;
   release returns to the per-node set: regression-tested), a canvas
   pin effect that owns ALL locking (the toolbar's Pin all now only
   flips the store flag: one source of truth), the context-menu
   "Pin / unpin position" action, and a soft-underlay indicator
   (distinct by construction from the gasket's offset outline).
2. **Compound containers, slice 1 (SHIPPED).** Containment option on
   ugmToCytoscapeElements (edges of a named type become parent
   assignments and vanish as edges), UML element-container styling
   («Stereotype» + name pinned top), fcose compound awareness.
   Found and recorded: the canvas never merges deriveCytoscapeStyle
   (theme-resolved canvas rules exist but nothing consumes them), so
   container colors are neutral literals this slice; ThemeManager
   carries the theme-resolved :parent rule for when the wiring
   lands.
3. **VA-24**: live containers + pinning exercise on a SysML-flavored
   fixture (System/Navigation/Power blocks with parts and
   cross-container powers/feeds edges), context menu wired through
   createDefaultMenuManager + registerToolkitActions.

Harness lessons re-confirmed this round: the importless-test-file
trap hit a FOURTH time (ugm-to-cytoscape.test.ts did not exist;
heredoc created it without imports), and two prettier-wrapped import
anchors rolled back cleanly thanks to the all-or-nothing asserts.
Status: AWAITING COMPREHENSIVE REVIEW, rounds 12-17.

## Review rounds 12-17 (Zach, 2026-06-12): eight findings

All addressed in round 18:

1. **Color picker click scope.** Per-value rows were <label>s, so
   native click-forwarding made the WHOLE row a picker trigger and
   "outside" clicks landed back inside the label and re-opened it.
   Rows are divs now (both the per-value and fixed-color sites);
   only the swatch opens the picker.
2. **Errant floating menu at the viewport top-left.** The VA-23
   static menu sample: ContextMenu positions with position:fixed,
   which is VIEWPORT-relative, so the sample escaped its
   position:relative wrapper. The wrapper now carries
   transform: translate(0,0), making it the containing block for
   fixed descendants; the sample stays in its panel.
3. **Menu wiring proof.** The sample's items fire real actions and a
   "wiring check" line below reports which one fired.
4. **node.shape fixed was unreachable** (the driver handler mapped
   "fixed" to None). Fixed is a legitimate mode (one shape for every
   node): now mirrors node.size's handling, with a single-shape
   editor and the shape name as the chip. Two tests.
5. **Pin indication too subtle.** Gray 0.25 underlay replaced with an
   amber disc (0.4, padding 4): visible on light and dark, and
   hue-distinct from the blue selection gasket along the CVD-safe
   blue-vs-amber axis.
6. **VA-24 menu was the full toolkit set.** Replaced with a
   purpose-built two-item manager: the pin action under test plus a
   selection wiring check.
7. **Selection/click-hold modernized.** Root cause: the round-5
   gasket only ever lived in deriveCytoscapeStyle, which the runtime
   canvas never merges, so the canvas still wore the old chunky 3px
   border, plus Cytoscape's fat default :active overlay. The DEFAULT
   stylesheet now carries the real gasket (2px accent outline,
   offset 2, canvas-colored gap) and a whisper-weight :active
   (opacity 0.08, padding 4); selected edges slimmed 3 -> 2.5.
8. **Stale ELK narration** removed from VA-23 and VA-24 copy: pages
   describe what IS; history lives in toolbar-and-layouts.md.

Status: rounds 12-17 review CLOSED; round 18 fixes await spot-check.

## Round 19 additions (icon fixes + next enhancements)

1. **Node glyphs root-caused ("still off most of the time").** Two
   defects: the SVG data URIs carried no intrinsic width/height (only
   a viewBox), which browsers rasterize unpredictably (tiny, blurry,
   or absent): now explicit 64px. And the stroke was hardcoded white,
   which vanishes on okabe's light half: glyph color now picks dark
   vs white by WCAG contrast ratio against the node's RESOLVED fill
   (threaded from the color channel in the same patch pass), and the
   panel preview uses the identical rule so preview and canvas
   cannot disagree. Three tests, including the okabe light-blue case
   that overturned a naive luminance threshold.
2. **Shuffle (round-16 audit item 5, shipped):** force re-run from
   randomized positions; Re-run stays incremental; disabled for
   non-force layouts and while pinned, with explanations.
3. **Workspace durability, slice 1 (Tier-1 item 3).** WorkspaceSnapshot
   (version 1): encoding spec + positions + pins + theme id as one
   JSON document; captureWorkspace/applyWorkspace with the apply
   order encoded once (unlock-place-then-restore-pins, spec and
   theme through their owners); serialize/parse with version guard,
   and the reserved-channel guard riding along through
   parseEncodingSpec. Storage is deliberately the host's choice
   (R1.12 workspaces and R2.15 bookmarks persist these). Five tests.
   VA-25 exercises the full wreck-and-restore loop live.

Status: round 18 + 19 awaiting spot-check.

## Round 20 additions (theme -> canvas wiring)

The twice-bitten gap closed: the canvas was theme-blind because
nothing merged the theme derivation (root cause behind the round-17
neutral-literal containers and the round-18 chunky-selection finding).

- themeColorRules(theme): theme-resolved canvas colors speaking the
  theme's own canvas vocabulary (nodeLabelColor, canvasBg, edgeColor,
  edgeSelectedColor, selectionHighlight, plus :parent surfaces).
  GENERIC selectors only, so the spec's attribute mappers
  (node[_icon], edge[_ecolor], ...) out-specific them by
  construction: theming can never fight the encoding. Merged between
  the structural defaults and the user stylesheet: theme beats
  fallback literals; adopter overrides beat theme.
- The stylesheet assembly is now ONE shared composeMergedStylesheet
  used by init and by a restyle-only theme effect: a theme switch
  rebuilds the same array and applies it in place (cy.style().
  fromJson().update()), never re-initializing, so node positions
  hold; bypass overrides and classes survive by Cytoscape's
  contract. Two tests, including restyle-without-re-init pinned
  against the constructor call count.
- deriveCytoscapeStyle remains the standalone export for hosts,
  documented as such.

VA-22 and VA-24 copy now direct theme-flipping over the live
canvases (containers re-tint, selection takes each theme's
highlight, positions hold). Status: rounds 18-20 awaiting
spot-check.

## Round 21 additions (algorithm overlays; review-expanded scope)

Per the review direction: support for clustering, pathfinding, and
external engines (networkx/GraphBLAS) considered as architecture, not
features. Doctrine: the toolkit consumes RESULTS, not computation.

1. **Interchange contract v1** (core): one versioned JSON document
   for both result modes (nodeProperties / edgeProperties / overlay),
   with provenance, validation, and verbatim failure surfacing;
   worked networkx and python-graphblas exports in
   roadmap/design/algorithm-overlays.md. Edge ingestion added
   (ingestEdgeAlgorithmResults) beside the existing node adapter.
2. **Structure-shaped overlays** (the R3.9 shape): named node/edge id
   sets, never mutating the UGM; overlay store with independent
   toggles and union semantics (pure computeOverlayMembership);
   canvas renders members emphasized (theme success border/line, the
   reserved borderWeight channel realized) over dimmed non-members,
   classes-only so deactivation restores EXACTLY. The round-14
   tension RESOLVED by decision: instance pins shadow overlay
   borders (deliberate per-node acts outrank computed emphasis).
3. **Results as drivers** (the R3.5 payoff): property-shaped results
   ingest into the UGM, where the encoding grammar drives any
   channel from them: clustering is a DRIVER, not a feature, and the
   whole panel/legend/serialization machinery applies for free.
4. **AlgorithmPanel**: reference built-ins (components, degree, BFS
   shortest path: deliberately trivial; real workloads stay
   external), overlay toggles with member counts, and the ingest
   surface (seedable). VA-26 runs the full loop live, ending with
   'Color by \_component' driving the spec from a computed result.

Status: rounds 18-21 awaiting spot-check.

Round-21 status note: the sync gate flagged R3.5 drift; reviewed
against code per the gate's instruction: the adapter half is this
round's work and the histogram half (StatsPanel, M5) has existed
since its milestone, so R3.5 moved to implemented. R3.9 stays
proposed pending the live spot-check of its acceptance behavior in
VA-26 (emphasize / dim / restore), deliberately conservative.

## Round 22: documentation assessment + remediation

Assessment request: can adopters, users, and developers leverage the
toolkit easily AND wire components into their own decision-support
and process layers, including custom buttons and autodocs?

Found (good skeleton, freshness cliff at ~round 7):

- Adopter docs existed and were sound for the early era: root README
  with a 15-line integration, per-package READMEs, ARCHITECTURE.md,
  DEVELOPER.md (excellent boundary doctrine), CONTRIBUTING.md, one
  large examples/full-workspace, a README-snippet gate
  (verify:snippets).
- Autodoc INFRA existed and worked: typedoc configured and building
  clean; Storybook configured with 7 story files and a separate
  browser test config.
- The cliff: ZERO documentation of the rounds-7-21 surface anywhere
  adopter-facing (no EncodingSpec, GraphToolbar, AlgorithmPanel,
  workspaces, overlays, or pinning in any README, story, or guide),
  and NOTHING documented the stores-as-integration-surface pattern
  (the actual answer to "wire a custom button").

Built:

1. docs/wiring-guide.md: composition levels (atoms/molecules/
   compounds), the three-channel integration surface (stores, props/
   callbacks, JSON documents), eight custom-control recipes including
   the requested custom button, the reverse direction (toolkit state
   driving host decision-support components via subscriptions), and
   workspace round-trips into host persistence.
2. examples/wiring/: every guide snippet as an EXECUTABLE TEST against
   the public package entry points (8 tests in pnpm test). This
   immediately caught three real public-API gaps: workspace and
   AlgorithmPanel missing from the root barrel, GraphToolbar missing
   from the toolbar subdir barrel, DEFAULT_LAYOUT_OPTIONS missing from
   the layout-manager barrel. All fixed: the guide is now also the
   barrel-completeness gate.
3. Freshness pass: react README gained the round-7+ surface section;
   root README gained the custom-button teaser + guide link;
   DEVELOPER.md gained the integration-surface convention (new
   capability => store/prop/document + guide snippet + executable
   twin).
4. Story debt: the canvas story still used the DEPRECATED
   EncodingPanel path (round-13's migration grep had excluded
   .stories): migrated to the spec grammar; new stories for
   GraphToolbar and AlgorithmPanel (era coverage was zero).
5. Autodocs gated: docs:check (typedoc --emit none) joined the verify
   chain; docs:api regenerated (4.8MB html) and ships in this round's
   zip under docs-out/api.

Remaining documentation debt (prioritized): story coverage for
EncodingSpecPanel tiers / SpecPort / workspace flows; a user-facing
feature handbook (the VA page's copy is the de facto user doc:
extract it once features stabilize post-review); per-package README
parity for charts; storybook static build publishing.

Status: rounds 18-22 awaiting spot-check.

## Round 23: deployed docs audit + refresh

Question: does a deployed docs site exist (GitHub Pages or similar)?

YES: .github/workflows/docs.yml deploys docs-out/ to GitHub Pages on
every push to main (and on manual dispatch): landing page + TypeDoc
API reference + Storybook static build + the demo playground. The
docs/source/ Sphinx skeleton (conf.py, release 0.8.5) is the OLD
toolkit's documentation system: unreferenced by the current build,
flagged LEGACY, removal proposed for the next major.

Staleness found and fixed:

- Landing page claimed React 18+ (it is 19) and described the
  pre-round-7 era; package descriptions and cards refreshed, and two
  cards added: the Wiring Guide (now rendered INSIDE the API site via
  TypeDoc projectDocuments, so the deployed reference carries it at
  api/documents/wiring-guide.html) and the Visual Acceptance
  walkthrough (the living feature doc, now part of the deployed site
  at /acceptance/).
- docs:build gained the acceptance-page step, and docs.yml now calls
  docs:build as its single assembly step instead of duplicating the
  commands, so CI and local builds cannot drift.
- The full site was built locally exactly as CI runs it (landing +
  api 4.9M + storybook 12M + playground 3.7M + acceptance 1.1M):
  green, shipped as a zip artifact this round for direct inspection.

Verification after merge: push to main (or dispatch "Deploy Docs"),
then check the Pages URL: landing cards -> all five surfaces.
Status: rounds 18-23 awaiting spot-check.

## Round 24: VA-26 growth fix (review blocker)

Report: VA-26 grew without bound in the browser, blocking review.

Diagnosis path (what the sandbox could and could not establish):

- A render-count probe mounting the REAL island components with
  cytoscape mocked (tests/unit/va26-probe.test.tsx, kept as a
  regression guard with VA-22 as control) showed both islands settle
  flat: NO React-state feedback loop.
- Code inspection ruled out cy-event loops (GraphToolbar has no
  effects and no cy.on; layouts run on click only) and fcose's
  continuous mode (no `infinite` anywhere).
- Remaining mechanism is browser-layout feedback, which jsdom cannot
  reproduce. Rather than ship another guess, the fix makes growth
  STRUCTURALLY IMPOSSIBLE: the VA-26 section is constant-height by
  construction (left column max-height + internal scroll; right
  panel fixed height + overflow hidden; grid align-items start), and
  every canvas host gained overflow: hidden. Whatever the trigger
  was (resize-observer feedback, the user-resizable textarea
  interacting with grid row sizing, or otherwise), no internal
  behavior can change the section's size now.

Verification request for the next spot-check: confirm VA-26 holds
still in the browser; if any OTHER section grows, the same capping
pattern applies and the probe test extends to that island.

## Round 25: four review findings (item 5 arrived empty)

1. WIDTH (minor): live canvas hosts capped at 760px; panels stay
   content-sized.
2. VA-23 CONTEXT MENU: the static sample was only ever a styling
   reference; the real right-click path was never wired. The live
   canvas now carries a ContextMenuManager with the full toolkit
   action set (select, neighbors, pin/unpin position) through the
   menuManager prop; copy directs an actual node right-click.
3. VA-26 NARRATIVE: root cause of "everything orange" was a
   DEGENERATE FIXTURE: toolbarGraph is fully connected, so
   components returned one community (correct, dead). New va26Graph:
   three disconnected satellite subsystems + an unintegrated spare
   (four components, built-in degree variance). Runners are no
   longer silent: AlgorithmPanel reports written property KEYS
   through onIngested, and the VA shell auto-wires them into the
   spec (components -> color channel, degree -> size channel,
   sequential auto-domain): one click now recolors or resizes the
   canvas with the legend following. The Color-by button is gone
   (the wiring made it redundant). The seeded external document
   gained a story: a critical-power-path analysis (graphblas bfs
   over the power chain) turning the canvas into a triage view; the
   cross-subsystem path request honestly reports no path.
4. PIN BADGE: the amber underlay (round 18) replaced after review:
   halos read poorly under multiselect. Pinned nodes now show the
   registry's PIN GLYPH as a top-right badge via stacked background
   images; the pin effect composes the parallel arrays into element
   data (encoding icon stays centered with the badge beside it;
   plain nodes get the badge alone; unlock removes the data).
   BROWSER CHECK REQUESTED: stacked-background rendering with data()
   array mappers is the one piece jsdom cannot verify; if badges
   misrender, the fallback is composing a single combined SVG per
   pinned node in the same effect.

Status: rounds 18-25 awaiting spot-check; review item 5 truncated,
awaiting resend.

## Round 26: three review findings + export slice

1. PIN CONSISTENCY: (a) badge now FILLED in the theme's warning
   accent with a canvas-colored halo stroke (punch-out separation
   from any node/container color), theme-resolved and re-composed on
   theme switch (the pin effect gained the theme dependency); (b)
   container distortion fixed: badge dimensions are FIXED PIXELS
   (16px), immune to compound parents' aspect ratios. pinBadgeUri
   exported.
2. VA-23 MENU CURATED: the full toolkit action set replaced by a
   hand-registered trio (Pin/unpin position, Select node, Center
   here) built directly on the stores: the wiring-guide pattern,
   demonstrating hosts register exactly what they want.
3. WIDTH CAP MOVED UP: capping the canvas host (round 25) starved
   the graph of panel width; the cap now sits on the PANEL
   (:has-based rule), canvas fills its container edge-to-edge.
4. R3.9 graduated to implemented: two live review passes exercised
   overlay emphasize/dim with only narrative findings; citation
   added to overlay-store per the sync gate's contract; ownership
   bookkeeping through the coverage gate.
5. ENHANCEMENT (export, slice 1 of the export requirement): core
   exportSubgraphTurtle/Json/Csv over the induced subgraph of a
   selection (nodes + properties + INTER-edges: the acceptance
   shape; empty selection = whole graph; provenance IRIs pass
   through to prov:wasDerivedFrom). Toolbar Export popover:
   selection-aware data formats + 2x full-canvas PNG via cy.png.
   buildExport is pure and tested; remaining for later slices:
   JSON-LD, SVG, structured reports.

Status: rounds 18-26 awaiting spot-check; review item 5 from the
previous round still awaited.

## Round 27: status snapshot + agent handoff

STATUS.md written at root: live-numbered snapshot (1.0.0-rc.2, 727
tests, 47/12/35 implemented/in-progress/proposed, 29 open singly
owned, bundle 278.7/280 KB), capability inventory by area, quality
infrastructure, review state, and the priority-ordered queue. Root
CLAUDE.md REWRITTEN as a lean handoff (~520 words, replacing the
stale 309-line round-7-era version): entry-point map, the gate
commands with the tail-masking warning, the paid-for editing
discipline (assert-every-replace, heredoc orphan trap, citation and
ownership ripple rules), architecture doctrine in brief, the working
agreement, and open threads. Detail lives in STATUS.md and the
planning log; the handoff points rather than duplicates.

## Round 28: roadmap descope (review direction)

Three descopes executed end to end through the spec gates:

1. SANKEY REMOVED: the view requirement and its flow-cap UX default
   were removed from the specs with prose tombstones (the gates
   taught the policy: 'deferred' is not a valid requirement status,
   so roadmap removal means requirement removal with history
   preserved as non-requirement prose, and tombstones must not carry
   bare requirement-ID tokens or the undefined-reference lint
   fires). Ownership and index rows rippled; the partial SankeyView
   code remains in the tree, uncommitted; the working-set-manager's
   stale citation reworded per policy.
2. ALGORITHM ROADMAP NARROWED to items focused solely on graph
   visualization: async host-provided runners and GraphBLAS columnar
   batch shapes removed; embeddings-as-layout and overlay set
   algebra remain. The interchange contract is unchanged: hosts
   orchestrate computation and emit version-1 documents.
3. VIRTUALIZATION RESCOPED to Stardog-style visualization
   affordances: the data-layer requirement was rewritten in place
   (source-system indication on virtualized nodes; provenance:
   system, table, key in inspector and tooltip; acceptance updated;
   status proposed since nothing implements the new scope), the
   connector requirement was removed (tombstoned, it was a canonical
   duplicate), and the relational-virtualizer module's citations
   were reworded: it remains as host-side utility code outside the
   roadmap.

Rollup after descope: 46 implemented, 9 in-progress, 36 proposed; 27
open requirements singly owned. STATUS.md and the CLAUDE.md handoff
updated to match, including the standing descope rules for future
agents.

## Round 29: SHACL views added to the roadmap

Per review direction (alongside the UML/ELK custom-view track): two
new proposed requirements (R1.16 shape view, R1.17 validation-report
visualization), owned in view-acceptance, designed in
roadmap/design/shacl-views.md. Design highlights: NodeShapes as
compound containers with the blank-node-contains / named-shape-
references rule (compound nesting must stay a forest while SHACL
shapes are reusable); property shapes as contained items now and
compartment rows with the ELK work (SHACL is a second client of the
UML compartment machinery, not a separate engine); constraint
summaries inline (path, type, UML-style cardinality) with detail in
the inspector; sh:closed as the solid/dashed border variant;
sh:severity through theme semantic colors; targets as dashed edges
or cross-view highlights. Report visualization reuses the shipped
trio directly: severity tiers as structural overlays, result counts
and max severity as encoding drivers, result-path edges in the
emphasis; the document contract mirrors the algorithm interchange
and adapts from both the existing in-core validator and external
engines (pyshacl, Jena). Slice 1 (report viz) is mostly wiring.
Gate lessons reconfirmed: design-doc Owns headers must not mention
R-IDs they do not own, and Owns parsing wants the compact
comma-list form with commentary in a following paragraph.

## Round 30: roadmap reprioritized into functional groups

Per review direction: the flat queue became sequenced functional
groups in STATUS.md, ordered by ENABLEMENT. Group A (ELK containers
slice 2) moves first with an explicitly reuse-shaped exit criterion:
a compartment API rendering typed rows for any client. Group B
(SHACL) consumes it, with the no-ELK-dependency slices (B1 report
visualization, B2 shape view on current containers) free to start
anytime and B3 named as the appropriate-reuse milestone (SHACL
property shapes render through the same compartment API as UML,
zero parallel machinery). Then C provenance/virtualization
affordances (badge + provenance reuse), D analyst workflow
(temporal, analytics, export slices, bookmarks), E visualization
algorithms, F streaming (after D: shares temporal machinery), G
platform/quality interleaving continuously, and an
awaiting-external-input bucket (holonic pending community-group
direction, security pending deployment posture, long tail). The
dagre decision folded into Group A (evaluate ELK layered as the DAG
layout). CLAUDE.md handoff and the toolbar/containers and SHACL
design docs updated to match the sequencing.

## Round 31: doc consolidation + structural rendering slice A1

TRACKING CONSOLIDATION: the milestone-era PROGRESS.md and
planning/status.md were archived VERBATIM into
planning/milestone-history.md and deleted; their durable engineering
lore (selector/typing/jsdom gotchas) promoted to DEVELOPER.md.
STATUS.md's rollup was CORRECTED: rounds 27-30 had conflated the 18
user-story status lines into the proposed-requirement count (38 was
20 requirements + 18 user stories; 9 + 38 never reconciled with the
29-open coverage figure). The gate scripts were right all along; the
hand-counts were wrong. roadmap/CLAUDE.md's index header had the
same disease (claimed 31 items/13/18 over 29 actual rows) and was
corrected to derive from the rows.

GROUP A STRATEGY + SLICE A1, informed by the ipyelk reference
library (jupyrdf; reviewed this round): compartments are LAYOUT
OPTIONS, not a renderer feature, and text measurement must precede
layout. Two ipyelk choices deliberately NOT transferred: rows as
node labels (g3t rows are REAL nodes so selection/overlays/badges
apply per row) and Sprotty as a second renderer (the single
Cytoscape canvas stays; ELK produces a geometry document the canvas
consumes). Three spike iterations against elkjs 0.11.1 produced the
validated recipe and two instructive failures: INCLUDE_CHILDREN on
the root collapses everything into one global pass that ignores
container sub-layouts (rows go horizontal), and ELK's label-driven
sizing misbehaves, so rows get explicit pre-measured dimensions.
Recipe: equal explicit row widths, synthetic chain edges for order,
layered DOWN zero-spacing containers with header-strip top padding,
default SEPARATE_CHILDREN at the root, FIXED_SIDE ports. Container
sizing came out pixel-exact (221x94 computed = 221x94 produced).

Shipped: packages/core/src/layout/structural.ts (input model,
buildStructuralElkGraph, layoutStructural, StructuralGeometry v1
document with absolute boxes and renderer passthroughs,
deterministic TextMeasure estimator, isChainEdgeId filter) with a
12-test colocated suite; root-barrel + ./layout exposure; a
wiring-guide recipe with its executable twin. New requirement R1.18
(structural element views) added to specs/01, CAPPED in-progress
(geometry only; canvas application is slice A2), owned by the new
design record roadmap/design/structural-rendering.md. DAGRE
QUESTION ANSWERED headless: elk.layered laid a compound DAG in 53ms
with strict layering; dagre stays unbundled pending the visual
spot-check. Gate lesson re-paid then fixed: the prose mention
"(R1.16 slice B3)" in the new module's header counted as a phantom
implementation citation for R1.16 (reworded per policy), and
noUncheckedIndexedAccess caught 36 unchecked accesses the first
typecheck pass had truncated out of view (tail had masked the error
list, not the exit code this time, but the same lesson).

Numbers after: 740 tests, 46/10/20 rollup, 30/30 open owned, core
116.0/120 KB (ledger note added; elkjs stays external to the
bundle). All gates green. Slice A2 (canvas application of the
geometry document) is the head of Group A's remaining queue.

### Round 31 addendum: rounds 18-26 verified

User confirmed browser verification of rounds 18 through 26 on
2026-06-12, including the stacked-background pin badges (the one
jsdom-unverifiable item); the SVG-composition fallback is retired
unneeded. Round 31 itself has NO visual surface (slice A1 is
geometry-only; the rebuilt page is content-identical to round 26),
so no round-31 spot-check exists. The dagre verdict's visual check
is deferred to the A3 fixture. Still open from review: round-25
item 5 (truncated).

## Round 32: structural rendering slice A2 (canvas application) + VA-27

PORTS DECISION (user, 2026-06-12): ports stay decorations in A2 but
WILL be promotable to selectable inspectables (SysML proxy/full
ports carry inspectable semantics); the converter renders them as
real elements with stable ids and a node back-reference so the
promotion is a one-flag change. Round-25 review item 5 was an
erroneous list continuation: disregarded, thread closed.

SLICE A2 SHIPPED: structuralToCytoscapeElements +
STRUCTURAL_RULES (react, beside ugm-to-cytoscape: core stays
renderer-neutral) convert the StructuralGeometry document to
preset-positioned elements: containers as positionless compound
parents (header strip is a synthetic child, so parent bbox equals
the geometry box and the generic :parent padding is overridden to
zero), rows as SELECTABLE, drag-locked children (id-matching
pattern: give rows the source element's UGM id and
selection/inspector machinery lights up unmodified), dividers and
headers as non-selectable furniture, ports as decoration children,
port-attached edges targeting port elements, chain edges never
emitted. CytoscapeCanvas gained the `structural` prop: structural
scenes render with layout "preset", skip the scatter and the
encoding-spec application, and merge the structural rules AFTER the
compound rule so the override wins. Canvas-level tests cover preset
layout, element emission, rule merge, and row-tap selecting exactly
the row (R1.18 acceptance 2's selection clause); the cy mock gained
elements() (the selection-highlight subscription path no prior test
exercised).

VA-27 ADDED (the round's visual surface, and the dagre verdict's):
three-block «Block» fixture with compartments and ports, live
canvas, selection echo line, and a Re-layout DOWN/RIGHT toggle so
elk.layered's DAG quality is directly judgeable. The VA page grew
to ~2.4 MB because elkjs now bundles into the page island; the
LIBRARY budget is unaffected (elkjs external).

GATE EVENT: @g3t/react 283.5 KB exceeded the 280 KB budget; ratchet
to 285 KB with ledger rationale (+4.8 KB for the structural scene
renderer, proportionate to the +5.4 KB spec-application ratchet).

Numbers after: 751 tests, 46/10/20 rollup (R1.18 stays CAPPED
in-progress until VA-27 passes visual acceptance), all gates green.
AWAITING REVIEW: VA-27 (compartment look, row selection, port
placement, layering quality = the dagre verdict). Next in Group A:
A3 polish per VA-27 feedback, then SHACL B3 consumes the
compartment API.

## Round 33: A3 polish from VA-27 review (round-32 findings applied)

Six findings from the user's VA-27 review, all addressed:

1. ROUNDED CONTAINERS: container is round-rectangle (corner-radius
   6); the header and each container's bottom row (new
   g3t-structural-row-last class, tagged by the converter) round to
   match. Interior-seam artifacts of a per-corner-radius-less
   renderer accepted; radius kept small for that reason.
2. PORTS: default size 8 -> 12 (core), border-only with no fill: the
   open square is the canvas for future direction glyphs, per the
   review's explicit intent.
3. DOUBLE CONTAINER LINE: root-caused as the A2-accepted tradeoff
   biting: ELK ports STRADDLE the boundary, and a child crossing the
   parent's bounds inflates the compound bbox, drawing the container
   border outside the rows and around the port. The converter now
   clamps ports flush INSIDE their declared side (outer edge on the
   border line); bbox is exact again.
4. SELECTION ACCENT INCONSISTENCY: the gasket outline of a selected
   row was overpainted top/bottom by its zero-gap siblings (later in
   z-order). Selected structural rows now lift via z-index; the full
   ring shows.
5. EMPTY FIRST BOX: the unlabeled plain note node. Core now labels
   plain nodes with their id when no header is given (an unlabeled
   box reads as a bug, not a choice).
6. DOWN RE-LAYOUT ROUTING: EAST/WEST ports fighting a vertical flow.
   VA-27's fixture now derives port sides from the direction
   (RIGHT: EAST/WEST; DOWN: SOUTH/NORTH); the library always
   supported any side, so this is a fixture/demo concern, not a
   code gap.

Numbers after: 754 tests (+3: last-row tagging, port clamp, label
fallback), react 284.5/285 KB (within the round-32 ratchet; 0.5 KB
headroom: the NEXT react addition will need a ledger decision), all
gates green. R1.18 stays CAPPED in-progress pending re-review of
VA-27. SHACL B3 remains next after acceptance.

## Round 34: port straddle fix + compartment collapse (input-side)

PORT OVER-CORRECTION FIXED (VA-27 review): round 33 clamped ports
flush INSIDE the boundary, which read as "inside the container"
rather than "on the edge." Root geometry re-checked headless: ELK's
container width equals the row width exactly (rows are the widest
element), and ELK puts the EAST port's left edge at x=width. The
converter now STRADDLES: port center on the border line, inner half
over rows, outer half protruding. This inflates the Cytoscape
compound bbox by the port's outer half only (symmetric, ~6px),
which is the honest tradeoff: with compound parents a boundary port
either straddles (small symmetric inflation) or floats inside. Port
default size 8 -> 12 stands from round 33.

COMPARTMENT COLLAPSE, design + input-side slice (responding to the
review's explicit ask for toggling attribute/operation detail as a
context op and/or component config). Design recorded in
roadmap/design/structural-rendering.md. THE LOAD-BEARING DECISION:
collapse is a LAYOUT-TIME input, not a post-layout style hide: a
collapsed compartment's rows must not occupy space, so the container
shrinks, so collapse feeds layoutStructural and toggling re-runs it.
This is the existing "re-layout is an explicit user action, never a
styling side effect" discipline; a hide would reintroduce exactly
the bbox dishonesty the port fixes chased.

SHIPPED (input-side, headless-tested): StructuralCompartment gains
`collapsible` (default true); layoutStructural gains
`collapsedCompartments` (a Set of `${node}::${compartment}` keys,
built via the new exported compartmentKey helper). A collapsed
compartment emits its title divider with a "(n hidden)" suffix (or a
synthetic "(n hidden)" divider when untitled) and omits content
rows; the container shrinks. Non-collapsible compartments ignore
membership. Six core tests; a wiring-guide recipe + twin; the
converter tags containers with `_structuralContainer` for the future
menu filter.

TWO TOGGLE SURFACES (design; config surface demonstrated live now,
the per-container store + context-menu contribution is the next
canvas slice): VA-27 gained two buttons: 'Toggle ALL operations'
(component-config surface) and 'Toggle Sensor attributes'
(per-container surface), both writing a collapsed-key set that
re-runs layout. The canvas needs no change: it renders whatever
geometry the host computes, so the host owning collapse state and
re-calling layoutStructural is the clean separation. The dedicated
collapse-state store and the built-in "Collapse/expand compartments"
context-menu item land with the next canvas slice (jsdom-bound).

R1.18 extended (collapse clause + third acceptance criterion), stays
CAPPED in-progress pending VA-27 re-review. Numbers after: 760 tests
(+6 collapse, +straddle/label adjustments folded in), core
116.9/120 KB, react 284.6/285 KB (both within budget; react still
has only ~0.4 KB headroom). All gates green.

## Round 35: ports moved fully outside the container (sibling model)

VA-27 review: ports were still partly inside. ROOT CAUSE, finally
named: a Cytoscape compound parent ALWAYS grows to enclose its
children, so a port that is a CHILD of the container can never sit
outside it. Rounds 33-34 fought this geometrically (clamp inside,
then straddle) and could not win. THE FIX: ports are now TOP-LEVEL
SIBLINGS, not children, positioned with ELK's own outside
coordinates (which already place EAST at x=width, WEST at x=-w,
etc.: flush outside, aligned to the edge). The converter stopped
overriding ELK's port geometry; it uses geometry.ports verbatim and
emits no parent, carrying a `_portHost` back-reference instead.

CONSEQUENCE: siblings do not inherit the compound-child drag-along,
so dragging a container would leave its ports behind.
wireStructuralPortDrag (exported; auto-wired by the CytoscapeCanvas
structural path, disposed on cleanup) records each container's
position on grab and offsets its `_portHost`-matched ports by the
drag delta on each drag step. Two stubbed-cy tests cover the offset
and the no-ports no-op; the canvas mock gained removeListener (the
disposer) alongside the round-32 elements() addition.

Numbers after: 762 tests (+2 drag wiring). GATE EVENT as forecast:
@g3t/react 285.8 KB exceeded the 285 KB budget (the round-34 entry
explicitly warned the next react addition would); ratcheted to
288 KB with ledger rationale (+1.2 KB for the drag helper). core
116.9/120 KB. All gates green. R1.18 stays CAPPED pending VA-27
re-review (ports outside + drag-follow are the new things to check).
The collapse canvas slice (store + context-menu toggle) and SHACL B3
remain the queue.

## Round 36: compartment collapse canvas slice (store + context menu)

The canvas half of the collapse feature (round 34 shipped the
input-side geometry; this completes R1.18's third acceptance
criterion's per-container surface).

SHIPPED:

- compartment-collapse-store (Zustand, mirrors position-pin-store):
  holds the SET of collapsed `${node}::${compartment}` keys with
  collapse/expand/toggle/toggleAll/setCollapsed/clear;
  collapsedCompartmentSet() yields the Set layoutStructural wants.
  toggleAll is batch-aware (all-collapsed -> expand all, else
  collapse all) for the "collapse this container" action. Shape
  chosen to serialize into the workspace document later.
- registerCompartmentCollapseActions: the built-in "Collapse/expand
  compartments" context-menu item, filtering to structural
  containers via the converter's `_structuralContainer` +
  `_compartmentIds` tags (added to the container element this round),
  toggling the container's compartment keys in the store. Plus
  compartmentCollapseSubmenu() for hosts wanting per-compartment
  toggles on 2+ compartment containers.

ARCHITECTURE: the canvas renders whatever geometry the host hands it,
so it needs NO collapse-specific code; the host subscribes to the
store and re-runs layoutStructural. This is the same separation as
the round-35 port-drag (toolkit provides the mechanism; the host
owns layout). VA-27 now drives collapse through the real store: the
right-click action is the per-container surface; the "Toggle ALL
operations" button is the component-config surface (seeds the
store). The two-button demo from round 34 is replaced by
right-click + one config button.

13 new unit tests (7 store, 6 menu) + 1 wiring twin
(right-click -> store -> re-layout). Wiring-guide gained the
store+menu recipe.

GATE EVENT: @g3t/react 291.6 KB exceeded the round-35 288 KB budget;
ratcheted to 294 KB with ledger rationale (+5.8 KB for the store and
menu contribution). core 116.9/120 KB. All gates green. 776 tests.

R1.18 stays CAPPED in-progress pending VA-27 re-review of the
right-click collapse surface. Next in Group A: A3 final polish
(stereotype/edge-symbol styling) if wanted, else the exit criterion
(SHACL B3 consuming the compartment API). SHACL B1 report viz remains
startable anytime.

## Round 37: SHACL shape view through the compartment API (B3)

Group A's EXIT CRITERION: the appropriate-reuse milestone proving the
"any client renders through the compartment API with zero parallel
machinery" claim from the structural-rendering design. SHACL is now a
second client of the structural input model, alongside the UML views.

SEQUENCING CORRECTION made this round: B3 presupposed B2 (shape view
on plain child nodes) and B1 (report adapter), both still `proposed`.
But since Group A shipped first, building the shape view directly on
COMPARTMENTS _is_ B3, with no child-node intermediate to migrate;
B2 collapsed into B3. (ShaclShapeBrowser is a side-panel LIST view,
not the canvas shape graph; the canvas view genuinely did not exist.)

SHIPPED (core, pure):

- shaclShapesToStructural: ShaclShape[] -> the identical
  StructuralGraphInput the UML views use. Each NodeShape is a
  «NodeShape» container with one "constraints" compartment; property
  constraints are rows in the UML-attribute form
  `path : xsd:type [min..max]` with a `(+n)` chip for value
  constraints (sh:pattern, sh:in, sh:minInclusive, sh:maxInclusive).
- shaclRowSeverities: maps a report's results onto exact property
  ROWS (worst-severity-wins), the B3 per-row-badge payoff: rows are
  real elements, so a report flags the failing constraint, not just
  the shape.
- closedShapeIds + the row-text/cardinality/chip formatters.

SHIPPED (react):

- StructuralDecorations arg on the converter + a structuralDecorations
  prop on CytoscapeCanvas: closed/open container borders (sh:closed
  solid, open dashed) and per-row severity classes (violation/warning/
  info, semantic colors). Generic and SHACL-agnostic.
- VA-28: live shape-view fixture (two NodeShapes, one closed one open,
  a reference edge) with a report toggle that badges the name
  (violation) and age (warning) rows.

NOT BUILT (R1.16 stays in-progress): the lightweight in-core SHACL
model has no blank-node-vs-IRI property-shape distinction and no
sh:node/sh:target structure, so reference edges are caller-supplied
(a references map) and target edges are unbuilt; a richer shapes
parse is the follow-on. R1.17 (data-graph report overlays, B1) is
untouched and remains startable.

GATE EVENT: @g3t/core 121.5 KB exceeded the 120 KB budget; ratcheted
to 124 KB with ledger rationale (+1.5 KB for the SHACL mapper, pure
core). @g3t/react unaffected (292.6/294). 795 tests (+19: 14 core
mapper, 3 converter decorations, 2 wiring twins). All gates green.

R1.16 in-progress, pending VA-28 visual acceptance (closed/open
borders, row badges, the reference edge: a browser judgment). Group A
is now functionally closed; the queue is B1 (report overlays) and
B4 (linked views), plus optional A3 styling and the richer SHACL
parse.

## Round 38: SHACL shape-view polish from VA-28 review

Four VA-28 findings, addressed; one deliberately scoped down:

1. CLOSED-SHAPE LABEL CLIPPING: the header estimator under-measured
   the bold, guillemet-bearing «NodeShape» Name string (8px/char,
   no margin), so a header-widest container clipped its label. Fixed:
   header estimate to 9px/char + a 12px margin (rows + 4px); the
   estimator stays a deterministic fallback (the canvas can inject
   real measurement for pixel-true sizing).
2. "constraints" -> "properties": the compartment holds SHACL
   sh:property shapes, so "properties" is the correct term.
3. EDGE LABELS: StructuralEdge gained an optional `label`; the
   converter carries it to the element and the edge rule renders it
   (autorotate, white halo). The SHACL mapper labels reference edges
   with the property path carrying sh:node, so the worksFor row and
   the worksFor-labeled edge to OrgShape read as one fact.
4. FIXTURE COHERENCE: worksFor is now minCount 1/maxCount 1 (a real
   obligation, not an optional dangling reference); the edge and the
   row visibly correspond now that the edge is labeled.

SCOPED DOWN, NOT DONE: "cover the SHACL specification" is multi-slice
follow-on, not a single round. Added an explicit COVERAGE MATRIX to
roadmap/design/shacl-views.md: what renders today (datatype/
cardinality/pattern/range/in + sh:closed + labeled reference edges)
vs the spec gap (sh:class/sh:node as parsed structure, logical
operators, path expressions, sh:severity/order/targets, blank-node/
IRI distinction). Full coverage needs the RDF shapes PARSER first
(shapes are hand-authored ShaclShape objects today), then validator
extensions, then rendering; the rendering layer extends without
structural change. VA-28 narrative now carries the same caveat so it
is not mistaken for complete.

Numbers after: 796 tests (+1 edge-label converter test; the SHACL
edge-label and properties-rename assertions updated in place). core
121.9/124, react 292.9/294, both within the round-37 budgets. All
gates green. R1.16 stays in-progress. Next: SHACL B1 (data-graph
report overlays, R1.17), B4 (linked views), or the SHACL parser that
unlocks fuller R1.16 coverage.

## Round 39: SHACL validation report over the data graph (B1)

The report half of the SHACL story (R1.17), and a pure REUSE slice:
no new rendering engine, only the shipped overlay + encoding
machinery, over the already-reviewed data-graph canvas.

SHIPPED (core, pure: reports-not-validation):

- ShaclReportDocument: a versioned interchange document (version,
  conforms, source, results[] with focusNode/path/severity/
  sourceShape/message/value), the same pattern as algorithm results.
  parseShaclReport validates it.
- reportFromValidationResults: adapts the in-core validator's
  ShaclValidationResult[] into the document (external pyshacl/Jena
  reports convert via a host adapter; JSON-LD parsing is later).
- severityOverlays: one toggleable StructuralOverlay per non-empty
  tier (violation/warning/info) over the focus nodes, with optional
  path-edge emphasis via a resolver. Reuses the overlay store's
  union/dim semantics; deactivating restores exactly.
- shaclResultDrivers: per-node \_shacl_resultCount + \_shacl_maxSeverity
  for ingestion, so the encoding grammar drives size from count and
  color from severity (clustering-is-a-driver applied to conformance).
- reportFocusNodes / resultsForShape: cross-link and shape-filter
  helpers (the selection-filters-the-report direction, for B4).

SHIPPED (VA-29): a live report over the satellite data graph.
ComponentShape requires name (all have) + partNumber (only PDU and
FlightComputer carry), so most Components fail. Load -> failing
nodes emphasize and conforming ones dim, a toggle per tier, color
from \_shacl_maxSeverity and size from \_shacl_resultCount through the
grammar, legend included. Clear restores exactly.

DEVIATION recorded in shacl-views.md: severity COLOR is an encoding
driver, not dedicated per-tier overlay classes (the union
overlay-membership rule collapses tier identity, so per-tier overlay
color would fork it; the driver path reuses the legend/restyle
semantics and is the doctrine's own mechanism 2). Overlays still
give per-tier toggle + dim (mechanism 1).

GATE EVENT: @g3t/core 126.3 KB exceeded the 124 KB budget; ratcheted
to 128 KB with ledger rationale (+1.9 KB, the report module, pure
core). @g3t/react unaffected (292.9/294). 808 tests (+12: 11 core
report tests, 1 wiring twin). All gates green.

R1.17 -> in-progress (overlays + drivers shipped; inspector
detail-listing and the shape-view cross-link remain). Rollup now
46/12/18. The queue: B4 (linked shape+data views: cross-highlight a
selected result to its shape, filter the report by selected shape,
plus the inspector result detail), the RDF shapes parser (fuller
R1.16), and optional A3 styling.

## Round 40: VA review fixes (overlay isolation, three-tier report, per-compartment collapse)

Four findings from the VA-26/27/29 review:

1+3. GLOBAL-STORE CROSS-CONTAMINATION (the same root cause): the
overlay store is a module-level singleton shared by every canvas
on the page, so toggling VA-29's report tiers dimmed VA-26 and
the other live canvases wholesale (none of their nodes are members
of VA-29's overlays, so they all got g3t-ov-dim), and VA-26 thus
appeared to carry "validation info." FIXED defensively: the
overlay effect now computes whether any active overlay references
an element PRESENT on this canvas, and if not, leaves this canvas
untouched. A single-canvas app is unaffected (its overlays always
reference its own nodes). The deeper design point (per-canvas
state in a global store) is logged in roadmap/human-actions.md as
a non-urgent reconsideration, since production is single-canvas.

2. REPORT ONLY SHOWED VIOLATIONS: the in-core validator emitted
   violation for most checks and warning only for sh:pattern, never
   info. Added sh:severity support to ShaclPropertyConstraint: a
   constraint may declare its result severity, overriding the
   per-check default (a small real SHACL-spec feature, not just a
   demo fix). VA-29's fixture now trips all three tiers: partNumber
   missing (violation/red), malformed serial via sh:pattern
   (warning/amber), missing reviewStatus with sh:severity Info
   (info/blue). The green-outline-no-stroke note: overlay member
   emphasis is a border; with the severity ENCODING now driving fill
   color (red/amber/blue), the fill is the primary signal and the
   overlay border secondary, which is the intended layering.

3. PER-COMPARTMENT COLLAPSE VIA RIGHT-CLICK: feasible with no engine
   change, because the cxttap target already carries the clicked
   row's parent and \_compartment. Added a second menu action,
   "Collapse/expand this compartment", filtering to compartment rows
   (and dividers), toggling only that compartment; the container
   HEADER still gives the toggle-all action. Right-click attributes
   -> attributes only; right-click the header -> the whole container.

Numbers after: 810 tests (+2 row-scoped collapse menu tests; the
SHACL severity-override path is covered through VA and the existing
validator tests). core 126.4/128, react ratcheted 294 -> 297 KB
(+1.5 KB: overlay scoping guard + row collapse action). All gates
green. R1.16/R1.17 unchanged (in-progress). Queue unchanged: SHACL
B4, the RDF shapes parser, optional A3 styling.

## Round 41: structural dark-mode fix

VA review: the compartment/structural view rendered rows (and
containers, headers, ports, edges) in LIGHT colors even in dark mode.

ROOT CAUSE: STRUCTURAL_RULES hardcoded light hex colors (#ffffff
rows, #f8f9fa containers, #495057 borders, etc.). Cytoscape cannot
read CSS variables, so unlike themed DOM these rules were static and
never saw the theme. The established canvas pattern, themeColorRules
(theme), builds rules from the resolved G3tTheme and is recomposed on
theme change; the structural rules had bypassed it.

FIX: split the structural stylesheet.

- STRUCTURAL_RULES now carries STRUCTURE ONLY (shapes, sizes, label
  bindings, fonts, border-widths/styles, corner-radius, opacity,
  events, z-index): no fill, stroke, or text color.
- structuralThemeRules(theme): a new exported function returning the
  COLOR rules from theme tokens (containers bgSecondary, headers
  bgTertiary, rows canvasBg, dividers bgTertiary, labels textPrimary,
  ports/edges textSecondary, severity borders error/warning/
  accentPrimary). Merged in CytoscapeCanvas AFTER themeColorRules so
  the structural selectors win their colors; recomposed on theme
  change exactly like themeColorRules. Severity fills now stay the
  row surface (the colored BORDER is the tier signal), which holds
  contrast in both themes.

This also makes the SHACL shape view (VA-28) and the per-row severity
badges theme-correct, since they render through the same rules.

3 new tests: a regression guard that STRUCTURAL_RULES contains no
colors, and a light-vs-dark resolution check on structuralThemeRules
(rows flip canvasBg #ffffff <-> #1a1b1e; severity borders track the
theme's semantic tokens). 812 tests total. core 126.4/128, react
296.0/297 (no ratchet: the split added little). All gates green.
R1.16/R1.17 unchanged. Queue unchanged: SHACL B4, the RDF shapes
parser, optional A3 styling.

## Round 42: port border offset

VA review: ports align to the container edge, but then their border
(and the container's) are stroked, so the port border encroaches on
the container internals.

CAUSE: ELK places the port's inner edge ON the boundary line, and
the converter used that verbatim. But Cytoscape strokes the container
border CENTERED on the bbox edge, so its outer half (0.75px at 1.5
width, 1px at the 2px closed-shape width) crosses into the port; the
port's own 1.5px border adds to the collision.

FIX: offset each port OUTWARD (in its mounted direction: EAST +x,
WEST -x, SOUTH +y, NORTH -y) by PORT_BORDER_OFFSET = 2 (the closed-
shape border width), applied once at conversion in
structuralToCytoscapeElements. Clears both half-strokes with a small
clean gap. Drag-follow is unaffected: the offset is baked into the
starting position and wireStructuralPortDrag moves by delta.

Test strengthened: the port-position test now asserts the inner edge
sits STRICTLY OUTSIDE the container edge (was: on-or-outside), so a
regression that drops the offset is caught. 812 tests. core
126.4/128, react 296.3/297 (no ratchet). All gates green. Queue
unchanged: SHACL B4, the RDF shapes parser, optional A3 styling.

## Round 43: selected-row outline no longer grows the container into the ports

VA review: selecting a container row expands the container border,
which then collides with the ports.

CAUSE: the row is a CHILD of the container, and Cytoscape grows a
compound parent's bbox to enclose a child's OUTLINE. The global
selection ring (g3t-selected: outline-width 2, outline-offset 2)
expanded the selected row's visual bounds by ~4px outward, so the
container bbox grew on the selected side and its border pushed into
the ports (which were offset to clear only the unselected border).

FIX: the existing structural-row selected rule
(node.g3t-structural-row.g3t-selected) now overrides outline-offset
to -2 (INSET). The ring renders within the row's own bounds, so the
container bbox is unchanged on selection and the ports stay clear.
The ring is still fully visible (the z-lift already handles zero-gap
sibling overpaint). outline-width/color inherit from the global rule;
the structural selector is more specific AND later in merge order, so
the offset override wins. Considered but rejected: widening the port
offset to absorb the 4px expansion (would push ports out permanently
even with nothing selected).

1 test: asserts the selected structural-row rule carries a negative
outline-offset. 813 tests. core 126.4/128, react 296.3/297 (no
change: one style property). All gates green. Queue unchanged: SHACL
B4, the RDF shapes parser, optional A3 styling.

## Round 44: linked SHACL shape + data views (B4)

The linked-views acceptance bar that makes the shape view and the
report a genuinely useful PAIR, and the last substantive piece of
R1.17.

SHIPPED (core, pure): shacl-links.

- resultTargets / resultSelectionIds: given a validation result,
  resolve the cross-canvas highlight targets: the focus node (data
  canvas), the source shape container, and the offending property-
  shape row (shape canvas, via shaclRowId). A node-level result stops
  at the container; a result with no source shape yields only the
  node.
- resultDetail: shapes a result (focusNode/sourceShape/path/severity/
  message/value) for a Detail Inspector, so the inspector needs no
  SHACL knowledge.
- resultsForFocusNode: results for a selected data node.
  (resultsForShape, the shape->report filter, shipped with B1.)

THE CROSS-LINK IS PURE SELECTION-STORE REUSE: resultSelectionIds
returns the element ids, and the shared selection store highlights
them in every subscribed canvas at once. No new linking machinery.
NOTE the contrast with round 40: there, the shared OVERLAY store
cross-contaminating independent canvases was a bug (fixed by
scoping); here, the shared SELECTION store linking the shape and data
canvases is the DESIRED behavior. Different stores, opposite intents.

SHIPPED (VA-30): a three-panel linked view: result list, shape view,
data view. Clicking a result selects across both canvases; the shape
view also carries B3's closed/open borders and per-row severity.

GATE EVENT: @g3t/core 128.1 KB exceeded the 128 KB budget; ratcheted
to 130 KB with ledger rationale (+0.1 KB, the linking module). react
unaffected (296.3/297). 821 tests (+8: 7 link tests, 1 wiring twin).
All gates green.

R1.17 stays in-progress: the cross-link, filter, and detail SHAPING
are shipped and demonstrated, but resultDetail is not yet wired into
the production DetailInspector component (the only remaining item).
The SHACL arc (B1+B3+B4) is otherwise complete; the shape view and
report are now a linked pair. Queue: wire resultDetail into the
inspector (closes R1.17), the RDF shapes parser (fuller R1.16),
optional A3 styling.

## Round 45: A3 UML edge vocabulary + consolidated VA checklist

A3 styling polish (the last design-listed Group A item) plus a
standalone visual-acceptance checklist for the unverified backlog.

A3 SHIPPED: StructuralEdge gained an optional `kind`
(association/composition/aggregation/generalization/dependency). The
converter maps it to Cytoscape arrow shapes: filled diamond at the
SOURCE (whole) end for composition, hollow diamond for aggregation,
hollow triangle at the TARGET (parent) end for generalization, dashed
line + open arrow for dependency, plain arrow for association
(default). Arrow shapes are an edge concern, not the node-shape
channel, so this is a direct converter mapping rather than the
encoding grammar (the design said "where possible"); colors stay
theme-reactive in structuralThemeRules (source-arrow-color added).
VA-27 demonstrates all four symbols on the «Block» fixture. The
stereotype header already rendered the «Block» guillemets; A3 adds no
further header treatment. 3 converter tests + 1 wiring twin.

CONSOLIDATED CHECKLIST: planning/visual-acceptance-checklist.md, a
standalone pass/fail checklist covering every unverified
structural/SHACL feature from rounds 31-45 (VA-27 through VA-30, plus
cross-cutting theme/console/perf checks), with the dagre verdict
flagged as the load-bearing still-open decision and the known-open
items (port strategy, fixture realism, global stores, R1.17 inspector
wiring, SHACL coverage) listed so they are not re-filed as bugs.

GATE EVENT: @g3t/react 297.1 KB exceeded the 297 KB budget; ratcheted
to 300 KB with ledger rationale (+0.1 KB, the UML edge rules). core
unaffected (128.1/130). 824 tests (+4: 3 converter, 1 wiring twin).
All gates green.

GROUP A IS NOW FUNCTIONALLY COMPLETE (A1+A2+A3). R1.18 stays
in-progress pending the VA-27 visual sign-off (the checklist). Queue:
the VA checklist itself (human, desktop), wiring resultDetail into the
production DetailInspector (closes R1.17), the RDF shapes parser
(fuller R1.16).

## Round 46: cross-domain decision-dashboard examples

Request: examples demonstrating the toolkit's narrative (graph
visualization integrated into a decision dashboard across domains).

ASSESSED THE EXISTING EXAMPLES first: examples/wiring is the
executable twin of the wiring guide (pure tests, no app), and
examples/full-workspace is a FlexLayout shell with abstract views
(viewFactory maps names to whatever the host passes). Neither tells
the narrative: full-workspace demonstrates pane layout, not a graph
wired into a decision. That is the gap this round fills.

ADDED examples/decision-dashboards, two domain dashboards sharing one
spine (one UGM substrate; computed signals drive color/size through
the encoding grammar, not hand-styling; selection links the canvas to
the side panels):

- ConformanceDashboard (systems engineering): a satellite power
  subsystem UGM + SHACL design rules. The decision is "which
  components fail the design gate, how badly, and what specifically is
  wrong." Uses validateShacl -> reportFromValidationResults ->
  severityOverlays + shaclResultDrivers (color by worst severity, size
  by failing-rule count) + DetailInspector. Reports-not-validation: a
  pyshacl/Jena report would drop into the same seam.
- ImpactDashboard (supply chain): a supplier/part/assembly/product
  dependency UGM. The decision is "if this node fails, what is the
  downstream blast radius, and which nodes are choke points." Uses
  degreeCentrality ingested as a size driver + a directed downstream
  walk on selection. DELIBERATELY different machinery from dashboard 1
  (graph algorithm not SHACL; impact trace not inspector) over the
  SAME UGM/canvas/encoding/selection spine, which is the "across
  domains" evidence.
- README.md tells the cross-domain narrative; 7 headless tests cover
  the domain models, the conformance results (PDU missing part number
  = violation, FlightComputer over-mass = warning), centrality
  surfacing the single-source supplier, and the impact walk.

THE TYPECHECK CAUGHT THREE REAL API MISUSES on first pass (good): I
had imported EncodingSpec from @g3t/core (it is @g3t/react), and used
a `style` prop on CytoscapeCanvas (it takes className). Fixed; the
dashboards now compose the published API exactly, which is the point
of an example. (The React components mount only in a browser, so the
canvas rendering is not unit-tested; the domain logic and toolkit
wiring that CAN run headless are.)

831 tests (+7). Bundles unaffected (examples are not bundled). All
gates green. No requirement status change (examples are reference
code, not a spec requirement). Queue unchanged: the VA checklist
(human/desktop), wiring resultDetail into the production inspector
(closes R1.17), the RDF shapes parser.

## Round 47: standalone dashboards HTML page (mobile review)

Request: bundle the decision dashboards as HTML for mobile review.

CAVEAT STATED: the dashboards mount CytoscapeCanvas (needs a real
browser DOM), so the GRAPH cannot be pre-rendered to static HTML. The
deliverable is a self-contained HTML page that runs the dashboards
LIVE in a mobile browser, mirroring how the visual-acceptance page
works.

ADDED a standalone pipeline (does NOT touch the VA build):

- scripts/dashboards-page/island.tsx: a review harness mounting both
  dashboards (examples/decision-dashboards) with a domain switcher
  (conformance | impact) and the ThemeSwitcher. Logs
  DASHBOARDS_ISLAND_MOUNTED.
- vite.dashboards.config.ts: bundles the island to one ES file with
  @g3t aliases (843 modules from real source; 904 KB / 272 KB gzip),
  mirroring vite.va-client.config.ts.
- scripts/dashboards-page/emit.ts + vite.dashboards-emit.config.ts:
  inlines the bundle into a single HTML skeleton (root div + sized
  .dashboard-canvas CSS so Cytoscape has a box to fill) with a
  </script>-escaping replacer FUNCTION (the bundle has $-sequences).
  Self-checks fail rather than emit a hollow page: asserts the mount
  marker and both dashboard roots are present. (No jsdom render: the
  canvas does not run under node, unlike the VA emitter which can.)
- package.json: "dashboards-page" script for repeatability.

Output: scripts/dashboards-page/dist/dashboards.html, fully self-
contained (zero external refs, verified), ~884 KB. Typecheck/lint
clean; dashboard tests still 7 passing; VA pipeline untouched
(separate configs and output dirs). No requirement status change
(review tooling). Queue unchanged: the VA + dashboards visual review
(now mobile-reviewable), wiring resultDetail into the production
inspector (closes R1.17), the RDF shapes parser.

## Round 48: dashboards reworked for scale, layout fix, and app-structure narrative

Three issues from review of the dashboards HTML:

1. INDEFINITE VERTICAL GROWTH (layout bug). The canvas host used
   height:100% inside a grid whose ROW track was content-sized, so
   Cytoscape's reported content size grew the row and the row grew the
   canvas (feedback loop). FIXED: canvas hosts now use a fixed height
   (520px, 380px under 720px) with overflow:hidden (the robust pattern
   the VA page uses), the grids declare an explicit
   gridTemplateRows: minmax(0,1fr), and the harness main scrolls
   internally. A canvas needs a deterministic box, not a percentage of
   an ambiguous parent.

2. GRAPH SCALE TOO SMALL (toy demo). The fixtures were 6 and 11 nodes.
   REPLACED with realistically-scaled, programmatically-built models:
   ~35 components across six satellite subsystems (EPS/ADCS/OBC/COMM/
   THERM/PAYLOAD) with power/data/command links; ~25 supply-chain
   nodes across four tiers with deliberate single-sourcing. Built from
   row data via fetch\*Rows() to mimic a query result.

3. DID NOT TELL THE APP-BUILDING STORY (the deepest issue). The
   dashboards used the toolkit but did not teach how to STRUCTURE an
   app around it. REWORKED into an explicit four-layer architecture,
   documented in each file header, in the README, and marked inline:
   (1) DATA / ingest boundary, now a separate module (satellite-data.ts,
   supply-data.ts) that is "the only thing you swap to point at real
   SPARQL/RDF/CSV/REST"; (2) DERIVED SIGNALS (SHACL report / centrality)
   as pure core functions; (3) VIEW CONFIG (EncodingSpec + overlays) as
   declared data; (4) WIRING (selection-store subscription). The
   integration surface is now legible rather than buried in one
   component function.

The data layer is exported from the example index so integrators see
the pattern and tests exercise it directly. Tests grew to 9 (data-layer
scale assertions, three-tier conformance incl. info severity, larger
impact radius). 833 tests total. Typecheck/lint/verify/spec-gates
green; bundles unaffected (examples are not bundled); VA pipeline
untouched. No requirement status change (examples + review tooling).
Queue unchanged: the VA + dashboards visual review, wiring resultDetail
into the production inspector (closes R1.17), the RDF shapes parser.

## Round 49: flagship capability showcase

Request: a showcase exercising the FULL capability surface (custom
theme/accents/icons, external widgets like datagrid/Plotly alongside
g3t widgets, decision traces, linked views, 1000+ nodes, algorithm
results) that looks like a Neo4j Bloom / Stardog Studio app and helps
people imagine what is buildable. Distinct from the decision-dashboards
example (which teaches HOW to integrate, minimally); this pushes
BREADTH.

VERIFIED THE CAPABILITY SURFACE FIRST (rather than promising blind):
createTheme/setCustomTheme (custom themes, WCAG-checked), typePalette
(custom accents), registerIconSet/sanitizeIconMarkup (custom icons),
the node.icon encoding channel, the native TableView (selection-linked
datagrid, 10k-row cap) and LinkedChart (ECharts, selection-linked) and
the ready-made pipelines (createDegreeDistribution), and cy.batch for
large graphs.

ADDED examples/showcase:

- infra-data.ts: a deterministic ~1200-node cloud topology
  (regions/clusters/services/databases/caches/queues/gateways) with
  MOCKED algorithm scores (\_criticality/\_risk) written onto nodes, and
  a depth-limited blastRadius() trace. The "ingest" an integrator owns.
- branding.ts: NEBULA_THEME (custom dark theme via createTheme + custom
  typePalette accents) and registerShowcaseIcons (custom 24x24 node
  icons per resource kind via the sanitizing icon-set API).
- PlotlyKindBars.tsx: an EXTERNAL Plotly chart wired to the g3t
  selection store (click a bar selects that kind; graph selection
  emphasizes the bar). Plotly loads from CDN at runtime; graceful
  fallback if absent. This is the "bring your own viz lib alongside
  g3t widgets" story.
- ShowcaseApp.tsx: the flagship screen. Large graph (custom theme +
  custom-accent color-by-kind + custom-icon-by-kind + size-by-mocked-
  criticality), a decision-trace card (incident blast radius by hop),
  and four switchable selection-linked panels: ranked top-risk list,
  native TableView, external Plotly, native LinkedChart (ECharts
  degree distribution). Everything linked through the one selection
  store.
- README.md framing it against the teaching example (breadth, not a
  different architecture).
- 5 headless tests (1000+ node determinism, all kinds present, mocked
  scores on every node, blast-radius depths/exclusion).

STANDALONE PAGE: scripts/showcase-page (island + emit) + three vite
configs + a "showcase-page" script, mirroring the dashboards-page
pipeline. Output scripts/showcase-page/dist/showcase.html (~2 MB; all
g3t inlined, ECharts bundled, Plotly from CDN: verified exactly one
external ref). Self-check asserts the mount marker, the app, the trace,
the theme, the icons, and the Plotly CDN are present.

TYPECHECK CLEAN ON FIRST ATTEMPT (the up-front API verification paid
off); lint caught only unused imports + index-access assertions, fixed.
838 tests (+5). Typecheck/lint/verify/spec-gates green; package bundles
unaffected; VA and dashboards pipelines untouched. No requirement status
change (example + review tooling). Queue unchanged: the VA + dashboards

- showcase visual review, wiring resultDetail into the production
  inspector (closes R1.17), the RDF shapes parser.

## Demo-fixes round (2026-06-16): preferences + bugs on the four shells

User-reported preferences and bugs against the trimmed four-shell demo.

PREFERENCES:

1. Filter swatches collided with the encoding. ROOT CAUSE: FacetFilter
   colored swatches by sorted-index Okabe-Ito while the encoding's
   categorical scale assigns colors in data INSERTION order; the two
   orderings disagree. FIX: added categoricalColorMap(spec, ugm)
   (exported from the encoding module) returning value->color in the
   same insertion order the resolver consumes, plus a colorForType prop
   on FacetFilter. All four shells pass colorForType so swatches match
   the canvas. When a shell colors by SHACL severity (not type),
   colorForType returns undefined and falls back: no false collision.
2. MBSE listed second + opens in block view: reordered SCENARIOS
   (Auditor first, MBSE second) and defaulted MBSEDemo structuralView
   to true.
3. Sensible initial layout: added an anchor="first"|"second" option to
   ResizablePanels so the right rail can hold a fixed width (~340px)
   while the CENTER flexes (previously the center had a fixed 720px
   width, which mis-proportioned on varying viewports). The four inner-
   horizontal splits now anchor the right rail.
4. Inspector expanded by default: DetailInspector's PropertySection
   already defaults expanded=true (verified), so the library was
   already correct; the collapsed surface was EncodingSpecPanel
   (defaultExpanded=[]). Set the SupplyChain encoding panel to default
   node.color + node.size expanded.
5. Neighbors docked instead of overlay: NEW RightPanel demo component
   with Inspector + Neighborhood tabs; the Neighborhood tab has a hops
   (1-4) control and a layout selector (force/hierarchy/circle/grid/
   concentric) and renders the N-hop subgraph on its own canvas. The
   floating overlay is removed from all four shells. "View Neighbors"
   selects the node and switches to the tab via a render-time
   previous-signal comparison (not a setState-in-effect, which the
   hooks lint forbids).

BUGS:

1. column-visibility menu could not be closed: added outside-click +
   Escape listeners and a close (x) button, wrapped toggle+menu in a
   ref container so re-clicking the toggle does not flicker. 1 new test.
2. tree breadcrumb did not reset / made no sense: replaced the click-
   history trail with a true ancestor PATH (root -> ... -> selected)
   derived from containment edges. Clicking an ancestor navigates
   because it is a real path; a lone root shows no crumb. 4 new tests.
3. View Neighbors broken in block view: ROOT CAUSE: in structural mode
   cxttap fired on a row/header/compartment whose id is a synthetic
   compound id, not a UGM node id, so context actions resolved nothing.
   FIX: the canvas now climbs ancestors to the owning \_structuralContainer
   and resolves to its id before building the MenuTarget. Expand
   Neighbors (adds neighbors to selection) is left intact: the docked
   Neighborhood tab now serves that need, and the action has tests.
4. Pin Node broken in block view: same root cause as bug 3; with the
   container-resolution fix, context:pinNodes now receives the real
   container id and locks it. (Pin is inherently a no-op against a
   precomputed structural layout for non-grabbable sub-elements; the
   container itself is grabbable and locks.)

GATES: 845 tests (+7), typecheck/lint/eslint-src/verify/spec-gates all
green. @g3t/react bundle 300.3 KB; budget ratcheted 300 -> 304 KB with a
ledger entry (the fixes touched five library components). Dev build OK.

## Demo-capabilities round (2026-06-16): surface more of the toolkit

Seven follow-up remarks. Distributed each capability to its best-fit
shell rather than cramming all into one.

LIBRARY CHANGES:

- Custom RASTER icons (item 4): spec-apply now passes image references
  (data: URIs, http(s)/relative image URLs) through the icon channel
  untouched via a new isImageRef() guard, instead of routing everything
  through iconDataUri (SVG-glyph-only). The canvas already stamps
  \_icon as background-image, so PNG/logo icons "just work". 1 test.
- Legend collapse (item 5): SpecLegend gained collapsible/
  defaultCollapsed/title props with a chevron header. Default off, so
  existing usages are unchanged; the demos opt in.

DEMO COMPONENTS:

- FloatingInspector: a draggable, closeable inspector overlay (item 6)
  wrapping DetailInspector, so it does not consume sidebar height.

SHELL WIRING (item 2 = GraphToolbar everywhere; the rest distributed):

- Supply Chain: GraphToolbar (embedded search + layout select + force
  popover + zoom), CUSTOM PNG icons per company role (genuine 32x32
  PNG data-URIs generated with a pure-Node encoder, in
  fixtures/supply-chain-icons.ts, applied via applyIconMappings),
  NodeStyleEditor "customize style" dialog opened from the context
  menu's Edit Appearance (item 1), collapsible legend.
- Biomedical: GraphToolbar, an "Algo" left tab hosting AlgorithmPanel
  whose onIngested sizes nodes by the computed metric (item 7), a
  "Float inspector" header toggle showing the FloatingInspector
  (item 6), collapsible legend.
- Auditor + MBSE: GraphToolbar + collapsible legend; MBSE also gets the
  customize-style dialog (item 1, second example).

LANDING (item 3): refreshed the hero (accurate copy: "10+ linked
views, 5 layout engines, SHACL, RDF/LPG/holonic" instead of the stale
"12 views, 4 engines"), added a capability stat strip, refined the
gradient/badge styling, and rewrote each card's tags to name the
standout feature it now demonstrates.

GATES: 846 tests (+1), typecheck/lint/eslint-src/verify/spec-gates all
green. @g3t/react 301.6 KB (within the 304 KB budget set last round; no
bump needed). Dev build OK.

## Examples-coverage round (2026-06-16): delete showcase, rework dashboards by gap

Deleted the showcase example (examples/showcase, scripts/showcase-page,
its two vite configs, the showcase-page script): it tried to do
everything at once and was made redundant by the four dev-server shells,
which now demonstrate real capabilities better.

Did a capability gap analysis: enumerated the toolkit surface (views,
chart types, interaction features, core paradigms) and mapped it against
what the four scenario shells demonstrate. Gaps found: SchemaView,
MatrixView, SankeyView, StatsPanel, QueryEditor, TimelineView never
shown; only the pie chart type used (bar/scatter/line/parallel unshown);
AlgorithmPanel/DerivedPropertyPanel and the RDF/holonic adapters +
Turtle export never surfaced in a UI.

Reworked the two thin near-duplicate dashboards (ConformanceDashboard +
ImpactDashboard, each just a canvas + inspector) into two capability-
first dashboards that fill the gaps:

- AnalyticsDashboard: StatsPanel, LinkedChart bar (degree distribution)
  - scatter (centrality vs risk), AlgorithmPanel, DerivedPropertyPanel.
    Graph seeded with degree centrality + connected components on load,
    nodes sized by degree.
- SchemaDashboard: SchemaView (derived type schema), MatrixView
  (adjacency), SankeyView (type flows), live Turtle serialization
  (exportSubgraphTurtle), and a QueryEditor on an in-memory holonic
  adapter (honest about the adapter returning the projection, not
  executing the query).

Moved downstreamImpact from the deleted ImpactDashboard into
supply-data.ts (pure graph logic belongs with the data); kept
satellite-data.ts and its SHACL-conformance tests. Also removed the
dashboards-page standalone build (island referenced the deleted
dashboards; the page builds were the maintenance burden, and dev-quality
reference source is the goal now, matching the showcase-page removal).

Verified the gap-component wiring by reading every prop interface first;
typecheck passed on the first attempt. 841 tests (showcase's 5 data
tests removed; dashboards test stays at 9), typecheck/lint/eslint-src+
examples/verify/spec-gates all green. Bundles unaffected (examples).
Coverage statement in the dashboards README: between the 4 shells and
the 2 dashboards, essentially every view, chart type, and major feature
is demonstrated somewhere.

## Housekeeping / handoff round (2026-06-17): docs for the flagship handoff

No code changes; documentation accuracy and handoff readiness for a new
agent to pick up the flagship build.

CREATED:

- AGENT-ONBOARDING.md (repo root): dedicated onboarding for the flagship
  effort — what the project is, the four docs to read, current engine
  state, repo map, gates, editing discipline, the honesty line, the
  working agreement, and concrete first steps (do plan §1, the
  two-strength rework, before the shell).
- examples/flagship/README.md: build-state table, the worked-example
  outcome, the honesty line, packaging note, and the correct test
  invocations (the per-package pnpm --filter form does NOT work; root
  suite or `pnpm -w exec vitest run examples/flagship/src/`).
- planning/rdf-lpg-virtualization-audit.md: honest shipped-vs-gap
  accounting for RDF / LPG / virtualization, plus the documentation
  drift it surfaced.
- Moved planning/flagship-narrative.html and
  planning/flagship-implementation-plan.md into planning/ (the docs
  reference them there).

CORRECTED DRIFT (found during the audit):

- "Sankey REMOVED 2026-06-12" in STATUS.md and CLAUDE.md read as code
  deletion; SankeyView is shipped, tested, and in the public barrel
  (the SchemaDashboard uses it). What was removed was the ROADMAP entry
  (it had shipped, R1.9). Both docs now distinguish "removed from
  roadmap investment" from "absent from the codebase."
- Same fix for "relational connectors removed" / "virtualization
  rescoped": virtualizeRelationalData, parseCSV, and the
  incremental-layout API are still exported. Flagged for the maintainer
  to decide keep-vs-deprecate and align docs.
- STATUS.md capability-inventory header said "rounds 1-31"; corrected
  to note it is current as of 2026-06-16 with the SHACL B-series,
  structural rendering, icon raster passthrough, and demo overhaul
  reflected in the round log/CHANGELOG.
- Test count reconciled to the gate-verified 850 (841 library + 9
  flagship engine).

UPDATED:

- CLAUDE.md intro + open-threads: now lead with the flagship as the
  current focus, point at AGENT-ONBOARDING.md, and demote the library
  roadmap to "valid, not the current focus."
- STATUS.md: added a CURRENT FOCUS section (the flagship: the four docs,
  the engine state, the two-strength rework as next task, the
  demo/examples surface) right after the header.
- README.md: added an "Examples & demos" section, a "Data-paradigm
  support (honest scope)" caveat linking the audit, and refreshed the
  directory tree to list the current examples.

GATES: docs-only; full sweep re-run to confirm green (850 tests,
typecheck/lint/eslint/verify/spec-gates). No bundle impact.

## Demo block-view freeze round (2026-06-17): structural-layout mount cost

User report: the MBSE demo's Block view hangs on entry (the browser shows
"page unresponsive"); separately, the type-filter checkboxes fight the
Cytoscape encoding. THIS round fixes the freeze. The filter/encoding
disconnect is diagnosed and queued (see NOT FIXED below).

DIAGNOSIS (measured, not guessed):

- Headless measurement of the data path: the MBSE fixture is 31 nodes /
  39 edges / 12 blocks; the structural input is 12 containers / 4 edges;
  layoutStructural is ~560 ms (mostly elkjs cold-start) and yields 64
  Cytoscape elements. Volume is not the cause.
- The maintainer's DevTools Performance trace put the single long task in
  react-dom (commit work), as ONE wide block (not a repeating sawtooth):
  a heavy synchronous mount, not a loop.
- Mounting the real shell with Cytoscape mocked threw no "Maximum update
  depth exceeded", confirming no React setState cascade. The only
  automatic trigger in the path (ResizablePanels' ResizeObserver) uses a
  monotonic clamp that converges, and CytoscapeCanvas has no observer.
- Three causes compound: (1) the first-paint FLIP mounted a throwaway
  force canvas (fcose layout + animation on the full graph) before the
  structural scene resolved, discarded the instant it arrived; (2)
  StrictMode (src/main.tsx) double-invokes effects in dev, so the
  structural effect ran ELK twice and a third Cytoscape instance
  appeared; (3) elkjs ran synchronously on the main thread via a fresh
  `new ELK()` per call (~560 ms cold each). Probe under StrictMode: 3
  Cytoscape constructions, 2 ELK runs.

FIX (items 1-3, root causes):

1. Killed the flip: MBSEDemo now renders a shimmer skeleton placeholder
   until the structural geometry resolves, instead of mounting a force
   canvas as a stand-in. Removes a Cytoscape construction, a discarded
   fcose layout, and the entry flash.
2. ELK made cheap (packages/core/src/layout/structural.ts): one lazily
   created SHARED ELK instance (was `new ELK()` per call), plus a de-dup
   of layouts by input identity (WeakMap keyed by input + layout-affecting
   options) so the StrictMode double-invoke and any structural-view
   re-open run ELK once. Bypassed when a custom `measure` is supplied
   (not part of the key); the cache entry is cleared on rejection so a
   failed layout can retry.
3. Off the main thread: added an injectable ElkEngine seam to
   layoutStructural (`options.engine`, default the shared synchronous
   instance), exported from the core + layout barrels. Core stays
   framework-agnostic and never constructs a Worker. The demo wires a
   worker-backed elk-api engine (src/demo/lib/elkWorkerEngine.ts) with a
   graceful fallback to the synchronous default if a Worker cannot be
   created (so the demo never breaks; the fallback path is exercised in
   jsdom, where Worker is undefined).

POST-FIX probe (StrictMode): ELK runs ONCE (was 2); Cytoscape
constructions 2 (was 3; the remaining two are StrictMode's effect
double-invoke of the single structural canvas, a dev-only artifact); no
React loop. In production (no StrictMode) this is one off-thread ELK run
and a single canvas mount.

TESTS: +5 in structural.test.ts (engine injection honored; concurrent and
sequential re-layout de-dup to one ELK run; no caching when a custom
measure is supplied; cache keyed by layout options). The 17 existing
structural tests are unchanged (each calls a fresh blockFixture(), so the
input-identity cache never collides across them).

NOT FIXED THIS ROUND (queued, next polish items): the type-filter <->
encoding disconnect. The shells rebuild a subset `filteredUGM` and feed it
as the canvas data prop, which forces a full canvas re-init and loses
positions on every toggle (against the restyle-only doctrine); the
predicate checks `types[0]` only (multi-type nodes filter wrong); and in
block view the filter is a no-op (the structural scene is built from the
original UGM). FacetFilter's own contract ("hidden on the canvas, kept in
the UGM") wants a visibility encoding, not a UGM rebuild. SupplyChain uses
a different filtering story (GraphToolbar search, no FacetFilter), and the
filteredUGM block is copy-pasted across three shells.

GATES: test 855 (+5), lint, eslint src/, typecheck, lint_specs,
sync_spec_status, check_roadmap_coverage, visual-acceptance all green.
verify sub-steps build:packages + treeshake + smoke + types + snippets +
docs:check + bundle all green (core 129.3/130.0 KB, react 301.6/304.0 KB;
no ledger change). verify:exports is RED IN THIS SANDBOX ONLY: tests/dist
is gitignored and absent from the uploaded zip, so that config (which
lacks passWithNoTests) finds no test files. It is independent of this
change. Maintainer to confirm the new TYPE-ONLY ElkEngine barrel export
needs no dist-export test update in the full tree (type-only exports do
not affect runtime export assertions).

LIVE REVIEW NEEDED (cannot self-verify rendered behavior): in
`pnpm run dev` -> MBSE, entry should show a brief skeleton then the block
view with no force-graph flash and no unresponsive-tab stall; toggling
Block view off then on should be instant (cached geometry); during layout
the main thread should stay responsive (DevTools Performance: the long
react-dom task should be gone or much smaller, with ELK off-thread).

## Demo toggle/filter lag round (2026-06-17): visibility filtering + animate-off

Follow-up to the block-view freeze round. Loading is fast now, but the
user reported three residual lags: the FacetFilter checklist to graph link
is slow, toggling Block view off then on has the same delay, and the force
(node/edge) view "renders instantly but you cannot interact for a second
or two." A Chrome performance trace was attached and parsed (51 MB, 229707
events; CPU profile of 105933 samples).

TRACE VERDICT (artifact vs real). Self-time is dominated by two react-dom
DEV functions: getArrayKind (~26 s, one node ~22 s) and
addValueToProperties / addObjectDiffToProperties recursing into itself
(~7 s). These are React 19.2's dev-mode "Performance tracks": while the
Performance panel records, React serializes and diffs each component's
props and state to annotate the timeline. The recursion is React walking
one enormous, deeply nested, partly cyclic object. That object is the
Cytoscape Core, held in React state (cyInstance) and passed as a prop
(cy={cyInstance} to GraphToolbar). So most of the headline 29 s / 2.8 s /
1.2 s react-dom tasks are an artifact of recording with that feature on,
NOT the app's reconciliation. Corroboration: initial load is fast and also
commits once with the cy prop set; if the serialization ran on every dev
commit, load would stall too. It does not, so it is recording-triggered
(or triggered by hovering a component in the DevTools inspector). Browser
style/layout in the trace is negligible (UpdateLayoutTree ~1 ms).

REAL, ALWAYS-PRESENT COST (confirmed in code). (1) Filter toggle rebuilt
filteredUGM (a new object) and fed it as the canvas ugm prop; the canvas
init effect's dep array is data + config, so a new ugm destroyed and
re-created the instance and re-ran layout. Same mechanism on the
block-view toggle (a new structuralScene wrapper each time). (2) animate
defaults to true, so fcose runs an ANIMATED force simulation on every
init; during the animation the view is janky and not interactive.

FIX (items 1 and 2 of the proposal; 3 and 4 deferred below).

- @g3t/react canvas: new prop `hidden?: ReadonlySet<string>` (node ids to
  hide). A `.g3t-hidden { display: none }` rule is appended LAST to the
  composed stylesheet (wins over every mapper). A module-level
  applyHiddenClasses(cy, hidden) toggles the class in a single cy.batch;
  it runs inside init (via hiddenRef, so a rebuilt instance re-applies)
  and in a useEffect keyed on [hidden] only. `hidden` is NOT in the init
  dep array, so toggling the filter is a restyle, never a re-init: the
  instance and node positions survive. Cytoscape auto-hides edges incident
  to a display:none node, so nodes-only is sufficient.
- Shells (all four: Auditor, MBSE, Biomedical, SupplyChain): each now
  computes a hiddenIds set with faceted semantics (a node is hidden only
  when ALL of its types are hidden, i.e. visible while it has any shown
  type). This fixes the old types[0]-only predicate (multi-type nodes
  filtered wrong). filteredUGM is derived from hiddenIds and kept ONLY for
  the non-canvas views (tree/table/status/toolbar), which are cheap to
  re-render. Every CytoscapeCanvas now takes the stable ugm={ugm} (each
  shell builds ugm with useMemo(..., []), confirmed stable); the force
  canvases additionally take hidden={hiddenIds} and animate={false}. The
  MBSE structural canvas was also switched from ugm={filteredUGM} to
  ugm={ugm} so a filter toggle no longer re-inits it either (its elements
  come from `structural`, so the ugm prop only mattered as a re-init
  trigger).
- Correction to the prior round's note: SupplyChain DOES use FacetFilter
  (the earlier "GraphToolbar search, no FacetFilter" was wrong) and got
  the same rewire.
- Wiring (doctrine): docs/wiring-guide.md gained a "Filter by hiding, not
  by rebuilding" recipe; examples/wiring grew an executable twin locking
  the two host-side pieces the snippet relies on (FacetFilter emits the
  toggled type; the faceted hidden-id derivation keeps a multi-type node
  visible while a shown type remains). The canvas `hidden` prop itself is
  locked by CytoscapeCanvas.hidden.test.tsx, which renders with it.

TESTS: +3 in packages/react/src/views/canvas/CytoscapeCanvas.hidden.test
.tsx (emits the display:none rule; toggles the class on hidden-set nodes
at init; re-applies on hidden change WITHOUT re-creating the instance) and
+2 in the wiring twin. 860 total (was 855).

GATES: test 860, lint (eslint + prettier), eslint src/, typecheck,
lint_specs, sync_spec_status, check_roadmap_coverage, visual-acceptance all
green. verify sub-steps build:packages + treeshake + smoke + types +
snippets + docs:check + bundle all green (core 129.3/130.0 KB, react
302.3/304.0 KB; the canvas grew slightly for the hidden prop, still under
budget). verify:exports is RED IN THIS SANDBOX ONLY: tests/dist is
gitignored and absent from the uploaded zip, so that config (no
passWithNoTests) finds no test files; independent of this change.

LIVE REVIEW NEEDED (cannot self-verify rendered behavior): in
`pnpm run dev`, on any shell with the FacetFilter, toggling a type checkbox
should hide/show its nodes INSTANTLY with no relayout and no loss of node
positions, and the force (node/edge) view should be interactive
immediately (no 1-2 s stall) because layout no longer animates. Block-view
toggle off then on should not re-run a force layout. Note: block-view
(structural) filtering is still a no-op because structural element ids are
not the UGM node ids; that is out of scope this round (flag if wanted).

DEFERRED, teed up for next round.

- (3) Block-view toggle still re-creates the Cytoscape instance. Root: the
  structural effect builds a NEW { input, geometry } wrapper on every
  toggle, so the canvas `structural` prop changes identity and the init
  effect re-runs. A stable-reference cache (keyed on the structural input,
  reusing the existing wrapper when the geometry is unchanged) would let a
  toggle reuse the instance. The ELK de-dup from the freeze round already
  makes the layout itself cheap; this is about avoiding the Cytoscape
  rebuild.
- (4) Stop routing the raw Cytoscape Core through React state and props
  (cyInstance state, cy={cyInstance} to GraphToolbar). Keep the Core in a
  ref and give GraphToolbar a small stable command surface (fit, run
  layout, zoom) instead of the raw object. This removes the dev
  Performance-track / DevTools serialization explosion (the 33 s artifact)
  and trims consumer re-renders. It changes GraphToolbar's public `cy`
  prop contract, so it needs maintainer sign-off; it does not affect the
  felt runtime delay (that was items 1 and 2), only profiling hygiene.

## Block-view lag, actual root cause (2026-06-17): data(\_size) mapping-warning flood

The toggle/filter lag round (items 1 and 2) did not move the felt lag, and
the lag persisted in an extension-free incognito window, which ruled out
the React 19.2 Performance-tracks serialization I had blamed. After two
wrong reads of a heavy Chrome trace (whose top cost was that serialization,
present only because the React DevTools extension was loaded), I shipped an
instrumented build with explicit console timers and measured the real
per-phase cost.

MEASUREMENTS (repro: load MBSE in block view, toggle a node type, click
Block view off, click Block view on):

- MBSE render count: about 2 per interaction (StrictMode doubling). No
  re-render storm.
- ELK layoutStructural: 612 ms on first run, 0.1 ms thereafter (the freeze
  round's layout cache works).
- Every Cytoscape (re)build: 31 to 72 ms synchronous. Init is not the cost.
- Block view off (into force): click to paint 129 ms. Acceptable.
- Block view on (into structural): click to paint 1716 ms. This is the lag.

Alongside the slow toggle, the console was flooded, once per render frame
per node, with: "Do not assign mappings to elements without corresponding
data (ele blk:memory has no mapping for property height with data field
\_size); try a [_size] selector". The stack shows it firing from
Cytoscape's render loop (renderFn under requestAnimationFrame, through
drawImages / getLabelBox / boundingBox to printMappingErr).

ROOT CAUSE: the base `node` rule in DEFAULT_STYLESHEET mapped width and
height to data(\_size). Force and encoded nodes carry \_size (set in
ugm-to-cytoscape with a default, and by the encoding via spec-apply), but
structural block nodes size via \_w/\_h and never set \_size. So in the block
view every blk:\* node triggered a Cytoscape mapping warning on every render
frame, and that console flood (with dev stack capture) blocked the main
thread. This was the felt lag in every prior round; the extension only
added a second, separate serialization cost on top while a trace was being
recorded, which is what misled the trace reads. It is Cytoscape, not React.

FIX: scope the data-driven size mapping to `node[_size]`, exactly as the
Cytoscape warning recommends. Width and height: data(\_size) moved out of
the base `node` rule into a new `node[_size]` rule. Force and encoded nodes
still size from \_size; structural nodes are no longer matched, so the
per-frame warning stops. No behavior change for nodes that lacked \_size:
the mapping was already failing for them, it just also warned. Verified
that structural nodes set \_w/\_h and \_label but not \_size/\_color/\_shape, and
that only the \_size (width/height) mapping reached printMappingErr (color,
shape, and label mappings to missing data did not warn, consistent with the
console output).

TESTS: +1 in CytoscapeCanvas.hidden.test.tsx asserting the base `node` rule
no longer carries width/height and a `node[_size]` rule does. 861 total.

GATES: typecheck, test 861, lint (eslint + prettier), eslint src/,
lint_specs, sync_spec_status, check_roadmap_coverage, visual-acceptance,
and verify sub-steps build:packages + treeshake + smoke + types + snippets

- docs:check + bundle all green (core 129.3/130.0 KB, react 302.4/304.0
  KB). verify:exports red in this sandbox only (gitignored tests/dist),
  unchanged.

LIVE REVIEW: confirm the block view is now responsive and the console is no
longer flooding with \_size mapping warnings on every frame. The diagnostic
timers from the instrumented build were removed.

STILL OPEN (minor, optional). The Block-view-on toggle does two structural
rebuilds back to back (init #4 then #5 in the trace): the structural effect
sets a fresh scene wrapper after the cached layout resolves, so the
structural prop identity changes and init runs twice. Each is about 50 ms,
so it is no longer a felt cost once the warning flood is gone; a stable
scene-reference cache would remove it (the previously deferred item 3).
Item 4 (route the Cytoscape Core out of React state/props) remains relevant
only for clean profiling, not for runtime, and changes GraphToolbar's
public cy contract, so it stays deferred pending sign-off.

## Mapping-warning sweep follow-up (2026-06-17): \_confidence flood + invalid outline-offset

After the \_size fix, two more stylesheet warnings remained (the console was
"fewer but still" flooding).

1. data(\_confidence) flood (same class as \_size). The base `edge` rule
   mapped opacity to data(\_confidence). Force/ugm edges carry \_confidence
   (ugm-to-cytoscape), but structural connectors (e.g. geid_198_35) do not,
   so Cytoscape warned per edge per render frame in the block view. Fix:
   moved opacity: data(\_confidence) out of the base `edge` rule into a
   scoped `edge[_confidence]` rule. This was the remaining per-frame flood.

2. Invalid `outline-offset: -2` (one-time parse warning, not a flood, but a
   latent bug). The Round-43 structural-row selection rule
   (node.g3t-structural-row.g3t-selected) set outline-offset -2 to INSET
   the selection ring so a selected child would not grow the compound
   container's bbox into the ports. Cytoscape rejects negative
   outline-offset and discards it at parse time, so the inset never
   rendered: the row has been inheriting the global outward ring all along,
   and the ports-overpaint issue Round 43 targeted is likely still present.
   Removed the inert override (no rendered change, warning gone) and kept
   the working z-lift. A true inset needs a theme-driven border
   (outline-width 0 + border in the selection color); it cannot be a
   hardcoded color because a regression test (round 41) keeps colors out of
   the static STRUCTURAL_RULES for dark-mode. Deferred to a review-gated
   follow-up rather than changed silently.

TESTS: +1 in CytoscapeCanvas.hidden.test.tsx (base `edge` rule has no
opacity; `edge[_confidence]` rule does). The Round-43 structural-row test
was rewritten: it asserted a negative outline-offset (which never worked);
it now asserts the z-lift (z-index 9999) and that no invalid negative
offset is present. 862 total.

GATES: typecheck, test 862, lint (eslint + prettier), eslint src/, the
three python gates, visual-acceptance, and all verify sub-steps green (core
129.3/130.0 KB, react 302.4/304.0 KB). verify:exports red in this sandbox
only (gitignored tests/dist), unchanged.

LIVE REVIEW: confirm the block-view console is now clean (no per-frame
\_size or \_confidence mapping warnings, no outline-offset warning). SEPARATE
DECISION pending: whether to implement the theme-driven border inset so a
selected structural row's ring does not grow the container into the ports
(the Round-43 intent, never realized); it is a visual change needing your
sign-off.

## Round 50: flagship two-strength engine rework (implementation-plan section 1)

Request: implement the two-strength meaning model the narrative is built
on, updating the engine tests (not retaining a back-compat `_strength`
alias). This is the prerequisite for everything visual in sections 2 and
3: the cinematic shell renders what this engine computes.

DESIGN DECISION (de-risks the round): `_substantiated` keeps the exact
existing strength formula (signed sum of substantiating associations;
marginal efforts sign negative), so the substantiated fit stays 68% and
the coverage-based outcomes are preserved. `_claimable` is a parallel
sum that (a) counts every substantiating effort positively (a proposal
cites a marginal effort too), (b) adds adjacency reach, and (c) adds
resume self-assertion. Claimable is therefore >= substantiated by
construction, so per-concept exposure (claimable minus substantiated) is
non-negative and the claimable fit strictly exceeds the substantiated
fit. The continuous coverage that feeds fitScore is untouched; the three
honest states are a separate, threshold-driven classification, so the
68% floor is independent of any state tuning.

CORPUS (`src/corpus.ts`):

- CONCEPT_ADJACENCY + adjacentConcepts: a lightweight undirected concept
  taxonomy. Sustainment is adjacent to Predictive Logistics (the strong
  area it reaches off); Cyber Resilience is adjacent only to thin areas.
  Built without non-null assertions (per the source-code rule).
- PARTNERS (ORCA Systems) and CODELIVERED (TIDEGUARD, a Northwind+ORCA
  joint effort evaluated Very Good in cyber + sustainment). Co-delivered
  work is deliberately NOT folded into Northwind's solo strength (that
  would erase the gap); it surfaces only through traceTeaming as the
  converting evidence.

PIPELINE (`src/pipeline.ts`):

- AssociationTrace gains a `bucket` ("substantiating" | "claimable-only").
- projectMeaning rewritten: two passes. Pass 1 builds substantiating
  associations and substantiated strength. Pass 2 adds claimable-only
  reach (gated behind a strength floor so only a genuinely strong
  neighbour lends reach: this is what separates Exposed from Gap) and
  resume assertions. Concept nodes carry \_substantiated, \_claimable,
  \_supportCount. `_strength` removed.
- runRelevanceAnalytic returns per-concept substantiated/claimable
  coverage, exposure, and one of three states (discriminator/exposed/
  gap); plus fitScore (substantiated floor), claimableFitScore (the
  contrast), and discriminators/exposed/gaps lists. topAwards now ranks
  substantiating associations only (reach/resume edges are not past
  performance).
- traceTeaming(relevance): for each exposed/gap concept, surfaces a
  partner with co-delivered evaluated work that converts the soft claim.
- deriveActions: teaming is now a NAMED-partner action sourced from
  traceTeaming (with a generic fallback only where no partner covers a
  concept); discriminators come from the two-strength state.
- assembleCaptureBrief: two faces. internal (the truth bid on:
  substantiated fit, provable discriminators, exposed, gaps, closeable-
  by-partner) and proposal (lead citations, discriminator anchors,
  teaming backstop, Section M mapping). Every line keeps tracesTo.

TESTS (`src/pipeline.test.ts`): rewritten from 9 to 18. The marginal-
effort test now asserts TIDEWATER signs negative when substantiating and
positive when claimable. New assertions: claimable >= substantiated per
concept; substantiated fit is exactly 68; claimable fit exceeds it;
sustainment is Exposed (claimCoverage > subCoverage, exposure > 0); cyber
is a Gap; the three provable areas are discriminators (subCov >= 0.5,
claimCov >= 0.7); topAwards leads with the genuinely relevant awards;
traceTeaming surfaces ORCA for the cyber gap with rating>=3 converting
evidence and also closes the sustainment exposure; deriveActions fans
into >=3 kinds with a NAMED partner tracing to o.orca; both brief faces
populate and stay traceable, and the internal face names the cyber gap
and traces to it.

WORKED-EXAMPLE OUTPUT (reproduced from the engine): substantiated fit
68, claimable fit 94. Discriminators: Digital Thread, Data Governance,
Predictive Logistics (and MBSE, Semantic align high). Exposed:
Sustainment (sub 0.30 / claim 1.00 coverage, exposure 0.70). Gap: Cyber
Resilience (sub 0.42 / claim 0.54). Teaming: ORCA via TIDEGUARD closes
both. Verdict pursue-with-teaming. The Act II table and the two-faced
brief are now reproducible from the engine alone.

VERIFIED IN THIS SANDBOX: the section-1 engine logic, via a headless
harness built on the REAL `@g3t/core` UGM (graphology only) plus vitest:
18/18 tests green. Types checked with `tsc --noEmit` under the repo's
strict settings (strict + noUncheckedIndexedAccess, mirroring
tsconfig.base): clean. Em-dash scan of all three edited files: zero. No
non-null assertions in source.

NOT VERIFIED HERE (needs pnpm and the full tree, neither installable in
this sandbox): the repo gate sweep (eslint + prettier, the full
aggregate test suite, the three python gates, visual-acceptance, and the
verify bundle-size sub-steps). These should be run before landing. The
change is confined to examples/flagship and touches no package source,
so bundle-size and the core/react gates are not expected to move, but
that is a prediction, not a verified result.

OPEN / NEXT: sections 2 (toolkit enhancements: CoverageMeter,
ProvenanceTrace, camera, transitions) and 3 (the cinematic shell) remain.
The dagre layout verdict remains the separate standing architectural
decision, untouched here.

## Round 51: CoverageMeter (implementation-plan section 2c)

Request: continue the flagship build. Per the plan's build sequence, the
first toolkit enhancement after the engine is CoverageMeter (the
signature Act II visual: two bars per requirement). Built it as a real,
reusable @g3t/react component wired to the section-1 engine output, not
demo-only scaffolding.

COMPONENT (`packages/react/src/views/coverage/CoverageMeter.tsx`):

- CoverageMeter: one concept's two-strength coverage as a SOLID bar
  (substantiated, the defensible floor) behind a GHOST bar (claimable,
  the performative ceiling), with the delta between them (the exposure)
  drawn as a hatched band from the solid's edge to the ghost's edge. The
  per-state accent (discriminator/exposed/gap/neutral) tints it. The
  ghost is clamped to never fall behind the solid, so exposure never
  reads negative. Props align to the ConceptRelevance shape
  (substantiated = subCoverage, claimable = claimCoverage, state) so the
  engine output drops in, but the component is generic target-vs-actual
  and dependency-light (React only). Reduced-motion is the consumer's
  call via the `animate` prop; the meter does not consult matchMedia.
- CoverageMeterList: the Act II table as one component (stacked rows,
  optional mount stagger). The row is the unit of reuse.
- Tokens follow the inline-style + CSS-custom-property convention
  (var(--g3t-\*, fallback)); per-state colors fall back to hardcoded hex
  when a brand theme has not defined the semantic token, matching how
  EmptyState already references --g3t-error.
- Exported through a new `views/coverage` barrel and registered in the
  package barrel (`export * from "./views/coverage"`).

TESTS (`CoverageMeter.test.tsx`, 10, render-level on jsdom via
@testing-library/react): label/track/both bars render; ghost sits ahead
of solid when exposed; exposure band is sized to the run-past
(left = solid width, width = claim minus sub); no exposure band when
claim does not exceed proof; a claimable below substantiated is clamped;
the aria-label is descriptive and includes the exposure; values render;
animate=false disables transitions; the default sets a width transition;
the list renders one meter per row with the right number of exposure
bands.

VISUAL ACCEPTANCE: `scripts/coverage-va/` bundles the REAL component fed
by the REAL engine (buildRawGraph -> projectMeaning ->
runRelevanceAnalytic, required concepts mapped to rows in opportunity
order) into a single self-contained HTML page
(`dist/coverage-meter.html`), React inlined, no external refs. It shows
the MERIDIAN coverage table with Sustainment exposed, Cyber Resilience a
gap, and the discriminators solid, plus the 68 vs 94 fit headline. The
page is the human bootstrap for eyeballing the meter; open it to sign off
on color, spacing, and the exposure read.

VERIFIED IN THIS SANDBOX: CoverageMeter render behavior on jsdom with the
real @testing-library/react (10/10 green); types via `tsc --noEmit` under
strict + noUncheckedIndexedAccess + react-jsx, including the test
(clean); the VA page bundles via esbuild and passes a self-check (mount
marker, inlined script, no external src, component testid, engine concept
names present). Zero em-dashes; the section-1 engine harness still 18/18.

NOT VERIFIED HERE (needs pnpm and the full react package build): eslint +
prettier, the full react test suite, the module-boundary test, treeshake,
and crucially `verify:bundle`. The react budget was at about 302.4 of
304.0 KB, so a real component WILL require a measured budget bump with a
ledger entry in scripts/check-bundle-size.mjs. I cannot measure the delta
without building the package; do that on landing and bump the react
budget accordingly (the component is small and dependency-light, so the
delta should be modest, but that is a prediction). The package barrel
edit (one `export *` line) is not typechecked here against the whole
package.

OPEN / DECISIONS: the plan sequences section-4 packaging (flagship as a
quarantined optional package) BEFORE the toolkit enhancements; I went
straight to 2c because it is the verifiable, highest-signal increment and
packaging is a repo-structure decision that needs your sign-off. Still
ahead: ProvenanceTrace (2d, the spotlight), camera (2a) and transitions
(2b) (both need the cytoscape-mock canvas test infra, not reproducible in
this sandbox), the branded theme (2e), and the shell (section 3). The
dagre layout verdict remains the separate standing decision.

## Round 52: ProvenanceTrace (implementation-plan section 2d)

Request: continue the build, and start a tracked acceptance ledger for
everything that needs verification once the full toolchain is available.

The ledger now lives at planning/flagship-acceptance-ledger.md (the
canonical place to run an acceptance pass: gate sweep, the react bundle
budget bump, the two VA pages, and the open decisions). This round added
ProvenanceTrace, the drill-anywhere capability the demo sells.

COMPONENT (`packages/react/src/views/provenance/ProvenanceTrace.tsx`):

- ProvenanceTrace: renders an ordered provenance chain (a pre-order
  flattening of the provenance tree, each hop carrying depth and
  parentId) as an indented, clickable trail from a derived conclusion to
  the raw evidence: action -> analytic -> concept -> award -> evaluation.
  A leaf is either real evidence or, for an exposed/gap concept, the
  documented ABSENCE of substantiating evidence, styled distinctly
  (data-absence, the warning accent) so the gap reads as clearly as the
  proof. Presentational and reusable: the caller supplies the chain and
  decides what a hop means. Exported through a new views/provenance
  barrel and registered in the package barrel.

BUILDER (`examples/flagship/src/provenance.ts`):

- buildProvenanceChain: a generic pre-order DFS walker (root seed +
  childrenOf callback) that assigns depth/parentId, guards cycles (no id
  repeated on a path), and caps total hops. Reusable; kept demo-side
  because what a tracesTo id MEANS is the adopter's, matching the
  projection/analytic rule.
- traceProvenance: the concrete flagship adapter. describe() classifies
  an id by prefix (act./c./a./e./co./o./absence:) into a hop seed with
  tier and label from the live engine + corpus; childrenOf() expands an
  action to its tracesTo, a concept to its substantiating awards (and an
  absence leaf when exposed/gap), an award to its evaluation, and a
  partner to its co-deliveries.

TESTS: 7 component render tests (jsdom): hop-per-entry, depth indent,
leaf and absence marking, onSelectHop, selected highlight, empty state.
8 builder tests against the REAL engine: the walker's pre-order
flattening, cycle guard, and maxHops; and the concrete traces (a
discriminator reaching e.helios Exceptional with no absence; the
sustainment exposure reaching both a.atlas (supports) and a.tidewater
(contests) plus an absence leaf; the cyber gap reaching a "no
substantiating evidence" absence; the teaming action reaching o.orca and
the co.tideguard joint-evidence leaf; root depth 0, children deeper).

VISUAL ACCEPTANCE: scripts/provenance-va/ bundles the real component fed
by real traces into a single self-contained page
(dist/provenance-trace.html) with a drill-target picker (discriminators,
exposure, gap, teaming action) and hop highlighting on click.

VERIFIED IN THIS SANDBOX: 7 + 8 tests green (jsdom for the component,
node for the builder against the real engine); `tsc --noEmit` strict +
noUncheckedIndexedAccess across three configs (the engine stays pure; the
component under react-jsx; the adapter + generic walker under a config
that maps @g3t/core to the UGM barrel and @g3t/react to the provenance
barrel): all clean. The VA page bundles and self-checks (mount marker,
inlined script, no external src, component testid, real evidence strings
TIDEGUARD + Exceptional present). Zero em-dashes; no source non-null
assertions; the section-1 engine harness still green (now 26 with the
provenance builder tests alongside).

NOT VERIFIED HERE (in the ledger, item A/B): eslint + prettier, the full
react suite under the repo config, module-boundary, treeshake, and
verify:bundle. The react budget needs the same measured bump as round 51
now that a second component lands; the two together should be sized once.

OPEN / DECISIONS (ledger item D): the example-vs-toolkit split for the
provenance WALK (component reusable in the toolkit; the walk demo-side),
packaging §4 sequencing, and component placement confirming the budget
bump. The dagre verdict remains separate.

## Round 53: camera controller (implementation-plan section 2a)

Request: continue. Added the camera/viewport controller, the third and
last of the SANDBOX-VERIFIABLE section-2 toolkit additions (after
CoverageMeter 2c and ProvenanceTrace 2d).

COMPONENT (`packages/react/src/interaction/camera/cameraController.ts`):

- createCameraController(cy, defaults?): a thin, documented wrapper around
  cy.animate / cy.fit / cy.center exposing named moves the shell narrates
  with: focusNodes(ids) (zoom-to-subgraph, fit the union of present
  nodes; missing ids ignored; empty set is a no-op), panToNode(id) (center
  without changing zoom), frameAll(), resetView(). Per-call and
  controller-level padding/duration/easing. Reduced motion is the caller's
  decision via the `animate` option (the canvas already defaults that from
  the OS preference; pass the same value through); when not animating, or
  duration 0, the move applies instantly via cy.fit / cy.center.
- Reachable because CytoscapeCanvas hands back the instance through
  onReady(cy); the demo wraps it once instead of poking Cytoscape in a
  dozen places. Dependency-light: cytoscape types only (no @g3t/core
  import, so no reduced-motion coupling).
- Exported through a new interaction/camera barrel and registered in the
  package barrel.

TESTS (`cameraController.test.ts`, 12): jsdom cannot render Cytoscape, so
(as the existing canvas tests do) the tests spy on a mock cy and assert
the calls: focusNodes animates a fit to the unioned present nodes with
defaults; missing ids are dropped and an all-missing set is a no-op; a
single missing id still frames the present ones; animate=false and
duration=0 both apply instantly via cy.fit; custom and controller-level
padding/duration/easing pass through; frameAll/resetView fit all
elements; panToNode centers a present node (center, not fit), no-ops on a
missing one, and centers instantly when animate=false.

NO STANDALONE VA PAGE BY DESIGN: the controller's contract is the
animate/fit/center calls, fully covered by the spy tests (the method the
plan prescribes for 2a). A real-canvas page would pull the whole renderer
(cytoscape + fcose + theme + zustand) into a bundle that cannot be
validated without a browser; the camera will be exercised visually inside
the section-3 shell instead.

VERIFIED IN THIS SANDBOX: 12 tests green; `tsc --noEmit` strict +
noUncheckedIndexedAccess with the real cytoscape types (clean). Zero
em-dashes; no source non-null assertions. CoverageMeter and
ProvenanceTrace harnesses still green (react harness now 29 across the
three components).

SECTION-2 STATUS: 2a (camera), 2c (CoverageMeter), 2d (ProvenanceTrace)
built and sandbox-verified. 2b's v1 is a SHELL-SIDE cross-fade (no toolkit
change; the encoding-interpolation helper is decision-gated, "only if the
cross-fade looks cheap"), so it belongs to section 3. 2e (branded theme)
exercises existing APIs demo-side; 2f (the beat runner) is demo harness.
NEXT verifiable increment: the 2f beat-runner state machine (pure,
unit-testable) as the connective tissue for the shell.

LEDGER: planning/flagship-acceptance-ledger.md updated with Round 53.

## Round 54: narrative beat-runner (implementation-plan section 2f)

Request: continue. Added the demo-side narrative model and transport, the
connective tissue the section-3 shell drives. Pure data plus a tiny
reducer; no React, no Cytoscape, no toolkit import, so it is fully
sandbox-verifiable.

MODEL (`examples/flagship/src/narrative.ts`):

- BEATS: the ten beats of the walkthrough as DATA, mirroring
  planning/flagship-narrative.html act by act (cold open, consolidate;
  project, opportunity, analytic, two-weaknesses; decision, teaming,
  drill, brief). Each beat carries id, act, title, narration, the op it
  represents, an optional camera directive, an encoding/layer hint, and
  highlight ids. Keeping the acts declarative makes them easy to retune
  and keeps the runner trivial.
- CameraDirective: a tagged union (frameAll / reset / focusNodes /
  panToNode) the shell maps onto createCameraController (section 2a),
  wiring 2f to 2a as data, not as a hard dependency.
- runnerReducer + initialRunnerState + selectors (currentBeat,
  isFirstBeat, isLastBeat): a pure, total transport. play/pause/toggle
  drive only the playing flag; next/prev/goTo move and clamp to the beat
  range; replay restarts at 0 playing; tick is the auto-play step that
  advances while playing and STOPS at the last beat (no loop). Timing and
  rendering stay in the React layer, which dispatches tick on a timer and
  maps the active beat's camera/highlight/encoding onto the canvas.

TESTS (`narrative.test.ts`, 10): the reducer's play/pause/toggle,
next/prev clamping, goTo clamp+truncate, replay, and tick semantics
(advance while playing, no-op when paused, stop at the last beat); a full
auto-play reaches the last beat in exactly LAST+1 ticks then stops; the
selectors; and a data-integrity check: ten unique ids across three
NON-DECREASING acts, and every camera/highlight id RESOLVES against the
real engine corpus (concepts, awards, evaluations, partners,
co-deliveries), so the declarative beats cannot drift from the data.

NO VA PAGE: this is a state machine; its visual is the shell. The
integrity test ties the beats to real ids, which is the meaningful
sandbox check.

VERIFIED IN THIS SANDBOX: 10 tests green (engine harness now 36 across
pipeline, provenance, narrative); `tsc --noEmit` strict +
noUncheckedIndexedAccess (clean); zero em-dashes; no source non-null
assertions.

SECTION-2 STATUS: 2a, 2c, 2d (toolkit) and 2f (demo) are built and
sandbox-verified. 2b's v1 cross-fade and 2e's branded theme land with the
shell. NEXT: section 3, the cinematic shell, which assembles all of the
above. The shell is a browser/full-stack integration: the parts are
verified here, but the assembled, rendered, auto-playing shell needs your
toolchain and eyes (it will be the largest acceptance item).

LEDGER: planning/flagship-acceptance-ledger.md updated with Round 54.

## Round 55: cinematic shell, composition + panels + transport (section 3, started)

Request: start on the shell. Built the shell as a SLOT-based composition
so the parts that do not need a rendering engine are verifiable here; the
real Cytoscape stage and camera/motion polish (the explicitly live-review
items) are isolated behind the slot.

ARCHITECTURE: FlagshipShell takes a `renderStage(stageProps)` slot. It
owns the engine compute (once, memoized), the beat-runner state, the
transport, the narration, and the three real panels; it passes the active
beat's layer/highlight/camera-directive to the slot. Production fills the
slot with CytoscapeCanvas + createCameraController; a real-data SVG
stand-in fills it for the browser preview. This is why the composition is
testable on jsdom without a renderer.

COMPONENTS (`examples/flagship/src/shell/`):

- NarrationBar (act/title/narration/op), Transport (play/pause, prev/next,
  replay, a beat scrubber with dots).
- CoveragePanel: one clickable CoverageMeter per required concept from the
  real analytic, in opportunity order; clicking a row drills its
  provenance. BriefPanel: the two faces (internal/proposal), each line
  clickable to drill. ProvenancePanel: wraps ProvenanceTrace over
  traceProvenance for the current drill root.
- FlagshipShell: orchestrates. panelsForBeat gates the panels (coverage
  from the analytic beat, provenance from the drill beat, brief at the
  brief beat); preferredRoot picks a drill root from a beat's highlight;
  an optional autoAdvanceMs wires a timer to dispatch tick (0 in tests,
  5000 in the preview). Imports the toolkit from "@g3t/react"; for
  test/bundle a slim alias barrel re-exports the three components from the
  same package sources (no divergence), avoiding the heavy peer deps.

TESTS (`FlagshipShell.test.tsx`, 9, jsdom): panelsForBeat/preferredRoot
gating; opens on Act I with no analytic panels; the stage slot receives
the active beat's layer and camera directive; the coverage panel appears
at the analytic beat with one row per requirement and the 68% headline;
the two-faced brief appears on the final beat; a provenance chain renders
from the drill beat; drilling the Sustainment coverage row updates the
provenance root to its absence-leaf trace; transport play/pause and
replay drive the runner.

VISUAL ACCEPTANCE: scripts/shell-va/ bundles the REAL shell (real engine,
real toolkit components, real beat-runner) into a single self-contained
page (dist/flagship-shell.html). The stage slot is filled with an SVG
stand-in drawn from the REAL engine associations (honest data, simplified
renderer), captioned "stage preview (production: CytoscapeCanvas)". It
auto-plays and the transport works.

VERIFIED IN THIS SANDBOX: 9 shell tests green (react harness now 38);
`tsc --noEmit` strict + noUncheckedIndexedAccess across all four configs
(engine, react components, provenance adapter, and the new shell config
that maps @g3t/core and @g3t/react): clean. The VA page bundles and
self-checks. Zero em-dashes; no source non-null assertions. Engine harness
still 36.

NOT VERIFIED HERE (the genuinely live-review items the plan called out):

- The REAL stage: wiring CytoscapeCanvas + createCameraController into the
  slot, the actual graph render, and the camera moves on a real canvas
  (build-order step 1-real and step 6). The SVG stand-in is a preview, not
  the production stage.
- The Act I->II graph-swap cross-fade (2b v1, shell-side) and the
  branded Northwind theme/icons (2e): not built yet; they belong to the
  real-stage increment.
- Motion/easing/legibility and "do the two bars read instantly" (step 7):
  judgable only live.
  These are in the acceptance ledger (a new "shell live review" section).

OPEN / DECISIONS: confirm the slot architecture (renderStage prop) is the
shape you want, vs the shell importing CytoscapeCanvas directly. The slot
keeps the composition testable and lets the real canvas land as a
contained next step; it also means the shell does not hard-depend on the
canvas, which is arguably cleaner for reuse.

LEDGER: planning/flagship-acceptance-ledger.md updated with Round 55 and a
shell live-review section.

## Round 56: Option 1 redesign + encoding composition (the toolkit owns the stage)

Request: the flagship had become a strong narrative in which the toolkit
read as incidental. Chosen direction: Option 1, make the toolkit
load-bearing inside the same story. Re-designed the plan, then began.

PLAN: planning/flagship-plan-option1-redesign.md supersedes sections 2-3.
Core change: prefer an EXISTING toolkit surface over bespoke shell code at
every beat. The stage becomes the real CytoscapeCanvas driven by the
toolkit's OWN encoding system (not bespoke drawing); a beat-to-surface map
names the existing component each beat exercises (CytoscapeCanvas, the
encoding system, LinkedChart, DetailInspector, neighbors/buildNeighborhood,
subgraph export, GraphToolbar and the interaction stack for an
exploration epilogue), with new components (camera, CoverageMeter,
ProvenanceTrace) justified only where no existing surface fits. A
"powered by" credit per beat makes the composition legible on screen.

THE LOAD-BEARING MOVE (built and verified this round): the stage's visual
meaning is produced by the toolkit's encoding system, not by the demo.

- examples/flagship/src/encoding.ts: RAW_ENCODING and MEANING_ENCODING
  (real EncodingSpec data) and annotateForEncoding, which writes the
  analytic's `_state`/`_exposure` onto the meaning UGM's concept nodes so
  the spec can drive node color off state. The Act I->II transition is a
  SPEC SWAP on the same laid-out graph (applyEncodingSpec restyles only,
  so nodes do not move).
- MEANING_ENCODING: node.size <- \_substantiated (sequential 16..46),
  node.color <- \_state (categorical: discriminator green, exposed amber,
  gap red, none/award neutral), node.shape <- types (Concept ellipse,
  Award rectangle), node.label <- name, edge.color <- type (supports
  green, contests red), edge.width <- weight.

VERIFIED HEADLESSLY: examples/flagship/src/encoding.test.ts (9) runs the
TOOLKIT's shipped applyEncodingSpec against the REAL meaning UGM and
asserts the produced patch: c.digital-thread green and large,
c.sustainment amber, c.cyber-resil red, awards rectangular and neutral,
supports edges green and contesting edges (TIDEWATER) red, names labeled,
the raw view flat (no state color, fixed size), and the raw->meaning swap
restyling the SAME node identities. Both specs round-trip through
parse/serialize (no reserved-channel violations). This is the concrete
proof that the toolkit, not bespoke code, owns the stage's visual logic,
driven by real engine data.

To run applyEncodingSpec headlessly: a slim @g3t/core alias barrel
(scripts/core-slim.ts: ugm + the import-free design-tokens module) avoids
the layout adapters, and the slim @g3t/react barrel was extended with the
encoding API; zustand and @types/node added to the harness for the
ThemeManager/icons chain.

VERIFIED: 9 encoding tests; full react harness 47, engine harness 36;
`tsc --noEmit` strict across all configs including the new encoding chain
config (clean). Zero em-dashes; no source non-null assertions.

NOT VERIFIED HERE (browser): the rendered canvas with the spec applied,
the spec-swap transition, layouts, and the camera moves. These are the
next increment (wire the real CytoscapeCanvas + encodingSpec + camera into
the stage slot), tracked in the ledger's section E.

LEDGER: planning/flagship-acceptance-ledger.md updated with Round 56; the
redesign is noted as superseding the original §2-3.

## Round 57: per-beat toolkit credits (the composition, made legible)

Request: in addition to the Option 1 rework, each beat should call out the
list of toolkit components it wires together to support the demo.

BUILT:

- examples/flagship/src/toolkit-credits.ts: TOOLKIT_SURFACES, a registry
  of the 19 EXISTING toolkit surfaces the flagship composes. Each entry is
  { id, name (a REAL exported symbol), pkg, blurb, isNew? }. isNew marks
  the three components added during this work (camera, CoverageMeter,
  ProvenanceTrace); the other 16 are pre-existing. EPILOGUE_SURFACES lists
  the exploration stack handed to the viewer after auto-play.
- narrative.ts: the Beat type gains `toolkit: string[]` (surface ids), and
  all ten beats are populated (e.g. cold-open: canvas+layout; project: the
  encoding spec swap; analytic: LinkedChart+CoverageMeter+encoding; drill:
  ProvenanceTrace+inspector+path; brief: export+workspace).
- shell/ToolkitCredits.tsx: the on-screen "Powered by" chip row for the
  active beat (name, package tint, a "new" marker), wired into
  FlagshipShell under the narration.

GROUNDED (the anti-drift guarantee): toolkit-credits.test.ts (23) scans
the ACTUAL package sources (@g3t/react, @g3t/core, @g3t/charts) and
asserts every credited surface name is really exported by its claimed
package; that every beat references the registry and lists at least one
surface; that the epilogue stack resolves; that the demo composes mostly
existing surface (<=3 new, >=12 existing); and that the walkthrough spans

> =10 distinct surfaces. A renamed or removed component fails this test, so
> a credit can never claim something fictional.

VERIFIED: engine harness 59 (incl. 23 grounding), react harness 51 (incl.
ToolkitCredits 3 and the shell credit assertion); `tsc --noEmit` strict
clean across all five configs; zero em-dashes; no source non-null
assertions. No package source changed (the registry and credits live in
the example).

NOT VERIFIED HERE: nothing new is browser-only this round (the credits are
data + a presentational chip, both headless-verified). The browser items
remain the real-canvas stage wiring from the redesign (ledger section E).

## Round 58: the real stage wiring (CytoscapeCanvas + encoding + camera)

Continues the Option 1 build order (step 2). Goal: the stage stops being a
stand-in and becomes the real toolkit canvas driven by the per-beat
EncodingSpec and the camera controller. Built so the DECISION logic is
fully verified headlessly and only the browser-render glue is left for the
live pass.

BUILT:

- examples/flagship/src/stage.ts: the pure stage director. The stage
  renders the MEANING UGM throughout (stable node set + one stable layout,
  fcose); Act I beats encode it flat (RAW_ENCODING), and from the
  projection beat onward it encodes meaning. So the Act I->II change is a
  SPEC SWAP (restyle, not relayout): nodes do not move. Exposes
  encodingForBeat, specForBeat, isSpecSwap, STAGE_LAYOUT, and
  stagePropsForBeat (everything the canvas needs for a beat).
- examples/flagship/src/camera-directives.ts: applyCameraDirective, the
  exhaustive map from a beat's CameraDirective to the camera controller's
  calls (focusNodes/panToNode/frameAll/resetView).
- examples/flagship/src/shell/StageCanvas.tsx: the REAL stage. Thin glue
  composing CytoscapeCanvas (renders the memoized meaning UGM), the
  per-beat EncodingSpec, createCameraController + applyCameraDirective for
  the camera, and a cy node-filter for the highlight selection. All
  decisions come from the pure modules above; the component only wires
  them to the canvas.

VERIFIED HEADLESSLY: stage.ts (6 tests, incl. the swap happens exactly
once at consolidate->project, on one stable layout) and camera-directives
(3 tests, mock controller, every beat directive maps correctly). Engine
harness now 68. StageCanvas.tsx typechecks strict against the REAL camera
and encoding types; only the CytoscapeCanvas component signature is a
local mirror of the props read from the package source (the full canvas
cannot be parsed headlessly: it transitively needs the whole package type
graph and untyped cytoscape-fcose). `tsc` clean across all six configs;
zero em-dashes; no source non-null assertions.

NOT VERIFIED HERE (the live-review frontier, ledger E): the canvas
actually rendering the meaning UGM, the encoding producing the intended
colors/sizes ON the canvas (the data mapping is already proven by the
encoding tests; what is unproven is the rendered result), the raw->meaning
spec swap reading as a restyle without movement, and the camera moves
animating well. StageCanvas is the artifact to drop into the browser build
for that pass.

WIRING NOTE: StageCanvas stays out of the shell's headless barrel (it
pulls the full canvas). The production entry owns the memoized meaning UGM
and fills the shell's renderStage slot with
(p) => <StageCanvas ugm={ugm} beat={beatById(p.beatId)} animate />.

DECISION TO CONFIRM: rendering the meaning UGM throughout (so Act I shows
the concept nodes styled flat, then the projection lights them up) is what
makes the transition a pure restyle. The alternative (render the raw
subgraph first, then add concept nodes) would relayout and move nodes.
The redesign chose restyle; flag if you want the literal node-introduction
instead.

## Round 59: LinkedChart wired (the two strengths as an existing ECharts view)

Continues Option 1 build step 3. The two-strength contrast is rendered by
the toolkit's EXISTING LinkedChart (ECharts), not bespoke chart code, and
it is a real LINKED view (clicking selects on the canvas).

DESIGN: LinkedChart takes a UGM + a DataPipeline + a chart type. The
single-series bar mode cannot show two strengths at once, so the contrast
is told in SCATTER mode: each required concept is a point at
(substantiated x, claimable y) with a y=x honesty diagonal. Points above
the line are exactly the exposed concepts (claim outruns proof). This
reads the thesis better than bars and uses the shipped view authentically.

BUILT:

- encoding.ts: annotateForEncoding now also writes `_subCoverage` and
  `_claimCoverage` onto concept nodes, so a linked chart can query both
  strengths straight from the graph (no external state).
- coverage-pipeline.ts: `coveragePipeline`, a real
  DataPipeline<ScatterData, PointSetSelection>. query() reads the two
  strengths from the meaning UGM into scatter points (+ the y=x trend);
  reverseMap() turns a clicked point back into its concept node id (the
  link to canvas selection).
- shell/CoverageChart.tsx: thin glue handing LinkedChart the UGM + the
  pipeline in scatter mode.

VERIFIED HEADLESSLY: coverage-pipeline (3 tests): one point per required
concept with x/y matching the analytic's subCoverage/claimCoverage;
exposed concepts sit above the y=x diagonal; reverseMap maps a point to
its concept. encoding.test gains a coverage-on-nodes assertion. The
pipeline typechecks against the REAL DataPipeline/ScatterData/
PointSetSelection types (tsconfig.coverage-pipeline.json, @g3t/core ->
core-pipeline-slim). CoverageChart typechecks against a mirrored
LinkedChart signature (the real component pulls echarts; not parseable
headlessly). Engine harness 71, react 52; eight tsc configs clean; zero
em-dashes; no source non-null assertions. No package source changed.

This makes the beat.analytic credit (s.chart = LinkedChart) genuinely
backed by a wired, tested pipeline.

NOT VERIFIED HERE (ledger E): the scatter actually rendering in ECharts,
and the point-click selecting the concept on the canvas. CoverageChart is
the artifact for that live check. DetailInspector (the other half of step 3) is the next increment.

## Round 60: DetailInspector wired (node drill) - build step 3 complete

The other half of step 3. Unlike the canvas and the chart, DetailInspector
is React-only (it reads attributes straight from the UGM), so this
composition is FULLY verified headlessly, including its render.

BUILT:

- stage.ts: drillTargetForBeat + inspectorSelectionForBeat (the concept a
  beat drills into, as a DetailInspector selection), plus the
  InspectorSelection type.
- shell/InspectorPanel.tsx: thin pass-through to the toolkit's
  DetailInspector over the meaning UGM.
- FlagshipShell now annotates the projection UGM (annotateForEncoding) and
  exposes it, gates an inspector panel from the two-weaknesses beat onward,
  and drives the inspector selection from the same drill node as the
  provenance panel (selectedTrace, else the beat's drill target). Exposing
  the annotated UGM also stages the real-canvas wiring.

VERIFIED HEADLESSLY: stage inspector-selection tests (2); InspectorPanel
render tests (2, jsdom): the inspector shows the selected concept's
attributes including the analytic-written `_state` (e.g. "exposed" for
sustainment), and renders an empty state for no selection; the shell shows
the inspector with the drill node at the drill beat. Engine harness 73,
react harness 55; eight tsc configs clean; zero em-dashes; no source
non-null assertions. No package source changed.

This backs the s.inspector credit (beats two-weaknesses and drill) with a
wired, rendered panel. Build step 3 (LinkedChart + DetailInspector) is
complete; LinkedChart's render remains the only step-3 live item.

NEXT: build step 4 (neighbors pull-in for the teaming beat via
buildNeighborhoodUGM; the provenance path overlay via findShortestPath).

## Round 61: teaming neighborhood + provenance path (build step 4)

Both pieces exercise REAL toolkit graph functions at runtime (not mirrors),
verified headlessly; only the canvas OVERLAY of the result is browser.

BUILT:

- teaming.ts: the partner the graph "knew". The partner (ORCA) and its
  co-delivered work are deliberately NOT in Northwind's solo graph (that
  would erase the gap). buildPartnerGraph constructs the partner subgraph
  from corpus co-delivery data (partner -> co-delivery -> the concepts it
  delivered, supporting edges weighted by the customer rating);
  teamingNeighborhood runs the toolkit's buildNeighborhoodUGM on it to
  focus ORCA's neighborhood.
- provenance-path.ts: evidencePathForConcept uses the toolkit's
  findShortestPath (undirected BFS) to return the node/edge ids of the
  trail from a drilled concept to a supporting award, for canvas
  highlighting on the drill beat.

VERIFIED (REAL toolkit functions, graphops config): teaming (5):
buildPartnerGraph assembles ORCA + co.tideguard + the delivered concepts
with the right edges; buildNeighborhoodUGM focuses ORCA and reaches the
gap concept c.cyber-resil within 2 hops (the gap-closing reveal).
provenance-path (2): findShortestPath returns the concept->supporting-award
trail (endpoint is an award; edge ids carry for highlighting), null for an
unknown concept. Totals: engine 73, react 55, graphops 7; nine tsc configs
clean; zero em-dashes; no source non-null assertions. No package source
changed. This backs the s.neighbors and s.path credits with wired, tested
calls into the real toolkit.

HARNESS NOTE: the graph-ops tests run in vitest.graphops.config.ts against
the real buildNeighborhoodUGM (its module co-locates zustand-store actions;
runs fine with zustand + core-slim) and the real findShortestPath; they are
excluded from the ugm-only engine harness. Typecheck mirrors only
buildNeighborhoodUGM's signature (path uses the real core types).

NOT VERIFIED HERE (ledger E): rendering the pulled-in neighborhood and the
path overlay ON the canvas (the graph results are proven; the cytoscape
highlight is the live item).

NEXT: build step 5 (branded Northwind theme via createTheme; subgraph
export + workspace snapshot for the brief beat).

## Round 62: brand theme + brief export + workspace snapshot (build step 5)

The decision and brief beats, all via REAL toolkit functions (createTheme,
exportSubgraph\*, captureWorkspace/serializeWorkspace), verified headlessly.

BUILT:

- theme.ts: NORTHWIND_THEME via the toolkit's createTheme (brand accent +
  type palette over the light base; WCAG-contrast-safe, no warning). The
  "this becomes OUR product" beat brands the toolkit without forking it.
- brief-export.ts: briefCitationIds (the required concepts + the awards that
  support them) and exportBriefSubgraph -> Turtle / JSON / CSV via the
  toolkit's subgraph exporters. "Take the brief away" as portable,
  provenance-bearing artifacts.
- workspace-snapshot.ts: briefWorkspaceSnapshot captures the pursuit (the
  active encoding spec + view state) via captureWorkspace/serializeWorkspace.

VERIFIED (REAL toolkit functions, graphops config, now 12): theme (2) -
the brand theme has the Northwind id/accent and emits no contrast warning;
brief-export (2) - the citation includes concepts + supporting awards, and
the subgraph exports as Turtle/JSON/CSV (Turtle carries the concept id, JSON
parses, CSV has rows); workspace (1) - the serialized snapshot carries
version 1 + the encoding spec. Engine 73, react 55, graphops 12; ten tsc
configs clean; zero em-dashes; no source non-null assertions. No package
source changed. Backs the s.theme, s.export, s.workspace beat credits.

NOT VERIFIED HERE (ledger E): applying the brand theme to the LIVE canvas,
and the export/snapshot DOWNLOAD UX (the data + serialization are proven;
the visual theme and the download buttons are the live items).

NEXT: build step 6 (the interactive epilogue: GraphToolbar + SearchBar +
FilterBuilder + LayoutSwitcher + AlgorithmPanel + NodeStyleEditor).

## Round 63: the interactive epilogue (build step 6)

The hands-on closer: after the auto-play, the viewer drives the toolkit.
This is the lowest-verifiability step (it is browser-only UI assembly of
existing interaction components), so the honest split is: the panel SPEC is
grounded and tested, the shell is typechecked against transcribed
signatures, and the render is a live item.

BUILT:

- epilogue.ts: epiloguePanels(), the ordered exploration controls derived
  from the credit registry's EPILOGUE_SURFACES (each a real toolkit
  component). The pure spec of what the epilogue exposes.
- shell/EpilogueShell.tsx: composes the EXISTING interaction stack around
  the canvas over the meaning UGM: SearchBar and FilterBuilder route to
  canvas selection, LayoutSwitcher re-lays-out, AlgorithmPanel runs graph
  algorithms, GraphToolbar gets cy, and tapping a node opens NodeStyleEditor.
  Layout engines are injected by the caller (production builds the real
  ones), so the shell stays free of the heavy layout adapters.

VERIFIED HEADLESSLY: epilogue (2): the controls are the EPILOGUE_SURFACES in
order and name the six real components. EpilogueShell typechecks (strict)
against transcribed component signatures, with the REAL EncodingSpec and
LayoutEngine types. Engine 75, react 55, graphops 12; eleven tsc configs
clean; zero em-dashes; no source non-null assertions. No package source
changed.

NOT VERIFIED HERE (ledger E): the epilogue renders and the controls
actually drive the canvas. This is the largest live item, being all UI.

STATUS: the composition-first rebuild (build steps 1-6) is now BUILT. What
remains: the consolidated live-review set (ledger E: the canvas stage +
camera, LinkedChart render, theme-on-canvas, the neighborhood/path overlays,
and now the epilogue), step 7 (motion/easing/legibility, inherently live),
the §4 packaging (quarantine the flagship deps), and the react bundle-budget
bump for the three new components (CoverageMeter, ProvenanceTrace, camera).

## Round 64: mobile storyboard (reviewable artifact)

A self-contained, mobile-friendly HTML review of the composition-first
flagship, producible without the full canvas runtime.

It renders the REAL FlagshipShell (engine, beat-runner, per-beat toolkit
credits, and the real CoverageMeter / DetailInspector / ProvenanceTrace /
brief panels) with the graph stage colored by the TOOLKIT's own encoding:
applyEncodingSpec(specForBeat(beat), meaningUGM) drives node colors and
sizes, so the raw->meaning spec swap is visible. Auto-advances; tap to step.

scripts/storyboard/ -> dist/flagship-storyboard.html (single file, inlined,
no external requests; mobile viewport). No source changed; this is a review
tool. It is NOT the production cinematic (the live canvas, camera, overlays,
and epilogue remain ledger E), but it makes the narrative + the per-beat
composition + the real encoding reviewable on a phone.

## Round 65: flagship packaging + integration guide (build step section 4)

Quarantine the example's heavy deps and consolidate the multi-round build
into one landable guide. Both verifiable here.

BUILT:

- examples/flagship/package.json: private, @g3t/flagship-example. Declares
  @g3t/{core,react,charts} as workspace:\* and carries the heavy runtime
  deps that @g3t/react lists as PEERS (react, react-dom, cytoscape,
  cytoscape-fcose, zustand, echarts, vis-timeline, vis-data). The
  quarantine: published packages stay light (peers); the never-published
  example carries concrete versions. echarts-for-react is a direct dep of
  @g3t/charts, so the example omits it.
- examples/flagship/tsconfig.json: extends tsconfig.base.json, includes src.
- examples/flagship/INTEGRATION.md: the consolidated guide. The sandbox-only
  files to drop (all scripts/_-slim, the sandbox tsconfig._ and
  vitest.\*.config), the wiring map (module -> toolkit surface), packaging,
  the bundle-budget procedure, the grounding-test cwd caveat, and the
  live-review checklist (ledger E).

VERIFIED: every direct import in the flagship source has a matching manifest
declaration; the heavy transitive peers are quarantined (no direct import,
pulled by canvas/charts at runtime). Example tsconfig is valid and extends
the base. Engine 75, react 55, graphops 12; eleven tsc configs clean; zero
em-dashes; no source non-null assertions. No package source changed.

NOT VERIFIABLE HERE: workspace:\* resolution (needs pnpm) and the bundle
measurement (needs the full package build). The bundle item: react budget
is 304 KB with ~165 KB measured per the check's own doc, so the three new
components very likely fit; run pnpm verify:bundle and bump only if it fails
(template in INTEGRATION.md section 4).

STATUS: composition-first build complete (steps 1-6) and packaged. The
remaining work is the section E live review (browser) + step 7 polish
(inherently live) + the in-repo bundle confirmation.

## Round 66: documentation + review handoff structure

No code. Structured the handoff so the maintainer can run the browser
visual validation externally (and start unrelated repo work in a parallel
agent chat) and resume cleanly afterward.

ADDED:

- planning/flagship-resume.md: the NEXT-AGENT entry point after the review.
  It reads examples/flagship/REVIEW-RESULTS.md and carries the decision tree
  - a failure->owning-module routing table, so a resuming agent does not
    re-derive the review procedure.
- examples/flagship/REVIEW-RUNBOOK.md: the detailed review procedure for the
  external turn (phase 0 land/cleanup, phase 1 in-repo gates, phase 2 visual).
- examples/flagship/REVIEW-RESULTS.md: a short results inbox the maintainer
  fills during review (the handoff the next agent reads).

UPDATED (stale "engine built, shell pending" -> composition build complete +
packaged + awaiting visual review): CLAUDE.md (with a parallel-agent
coordination note: do not disturb examples/flagship/\*\* or the three new
@g3t/react components; a flagship-example resolution error or a verify:bundle
trip is this in-flight work), STATUS.md, AGENT-ONBOARDING.md.

The single entry point on return is planning/flagship-resume.md.
