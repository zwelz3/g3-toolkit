# Encoding Controls: Grammar and Disclosure

**Area:** design
**Owns:** no spec requirements; this is the design resolution for the
Visual Encoding overhaul (review request, 2026-06-11) and the
authority the rebuilt panel implements. It extends, and defers to,
the channel-allocation table in projection-and-encoding.md.

## The problem, precisely

"Color by type" names a driver but not a mapping. The user who says
it next needs to say WHICH color each type gets, whether the palette
is categorical or a ramp, and what happens to unmapped values. A flat
control surface that exposes all of that at once (the failure mode of
Gephi's appearance tab at its worst) drowns the common case; one that
hides it (the current panel: property dropdowns only) makes the
common follow-up impossible.

## The grammar: channel ← driver via scale

Every encoding is a triple, and the triple is the data model, the UI
model, and the persistence model:

- **Channel** = target × property. Targets: node, edge, effects,
  canvas. Properties: color, size, icon, label (nodes); color, width,
  label (edges); accent and halo geometry (effects); background and
  grid (canvas). A channel is addressed as `node.color`, `edge.width`.
- **Driver** = what feeds the channel: an element attribute (`types`,
  `pagerank`, any property key), or `fixed` (no attribute; one value
  for all), or `none` (channel falls back to theme defaults).
- **Scale** = how driver values become channel values:
  - `fixed`: a single value (one color, one size, one icon).
  - `categorical`: distinct values → distinct outputs. Carries a
    palette (named: okabe-ito, viridis-9, or custom array) plus
    per-value **overrides** (Person → #7a0bc0), an `unmapped` output,
    and for icon channels a value → icon-name map.
  - `sequential`: numeric domain → ramp or numeric range. Carries
    domain (auto from data, or manual [min,max]), the ramp
    (sequential/diverging tokens) for color, or [min,max] output
    range for size/width.

This is the Vega-Lite/ggplot encoding model specialized to graphs;
its virtue here is that the *answer to the review question is
structural*: the panel never needs an "overwhelming number of
options" because options belong to the scale, and the scale is only
shown for the one channel being edited.

## Reserved channels (the allocation table, enforced)

The grammar makes projection-and-encoding.md's allocation table
machine-checkable instead of advisory:

- `effects.accent` (selection) is **not attribute-mappable**: no
  driver may claim the accent. It is theme territory, edited through
  the theme/accent layer (createTheme, token overrides; proven by
  VA-19), never through the encoding spec.
- `edge.dash` is owned by inference (D9, asserted/inferred) and
  `*.borderWeight` by algorithm overlays (R3.9): the spec model
  rejects mappings onto reserved channels at parse time with an
  explanatory error, so a saved workspace can never smuggle one in.
- `canvas.background/grid` are theme tokens (--g3t-canvas-bg): the
  panel shows them as theme-delegated rows (visible so the mental
  model is complete; editable where themes are edited).

Precedence, lowest to highest: theme defaults → encoding spec
(rule-based, this design) → style overrides (NodeStyleEditor, M12,
per-instance) → reserved-channel owners (selection halo, overlay
emphasis, inference dash). Higher layers never delete lower ones;
they shadow them. As of round 14 each layer has a DISTINCT mechanism,
so precedence holds by construction rather than convention: theme =
CSS variables + stylesheet defaults; spec = element DATA consumed by
stylesheet mappers; instance overrides = Cytoscape BYPASS styles
(win over all mappers, restore on removal; the store previously had
no canvas consumer at all, a round-14 finding); reserved owners =
class-based styles on properties (outline-*) no lower layer touches.
One documented tension: instance overrides may set border color and
width, which algorithm-overlay emphasis also claims; when overlays
land, the overlay class must apply border via bypass on its marked
elements or accept shadowing by instance pins.

## Disclosure: three tiers

**Tier 1: the surface.** One row per channel:
`[channel] [driver select] [mapping chip]`. The chip is a one-glance
summary of the scale: a palette strip for categorical color, a ramp
strip for sequential, `12-32px` for a size range, the icon trio for
icon maps, `Aa propertyName` for labels. Eight rows cover everything;
the panel reads in five seconds.

**Tier 2: the mapping editor.** Activating the chip expands (inline,
not modal: panels are narrow and modals orphan context) the editor
FOR THAT SCALE ONLY: palette select + per-value swatch pickers +
unmapped row (categorical color); ramp select + domain auto/manual
(sequential color); min/max sliders + domain (size/width); per-value
icon selects from the IconRegistry (icon); property select (label).
Editors validate as they go: custom categorical palettes run the
contrastRatio check against the canvas background and WARN (never
block), the createTheme posture, and a CVD note appears when a custom
palette abandons the safe defaults (R7.8 is a default, not a cage).

**Tier 3: the spec itself.** The whole encoding state is one
serializable JSON document (versioned, validated on parse).
Workspaces persist it (R1.12), adopters preconfigure it, and power
users round-trip it. The panel is a view over the spec, not the
spec's owner: this is the spec-driven posture applied to styling.

## Widget selection (dimension 3 of the request)

| Scale × channel | Widget |
|---|---|
| fixed color | color picker (native input) |
| categorical color | palette select + per-value pickers + chip strip |
| sequential color | ramp select (token ramps) + domain pair |
| fixed size/width | single slider with value readout |
| sequential size/width | min/max pair + domain auto/manual |
| categorical icon | per-value icon select (registry names) |
| label | property select (+ fixed-text input for fixed) |
| effects/canvas | theme-delegated row (link, not control) |

Rule: the widget is determined by (channel kind × scale kind), never
chosen ad hoc per feature. New scales get a widget once, everywhere.

## Application milestone: SHIPPED (round 11)

The spec now drives the canvas: `applyEncodingSpec(spec, ugm)`
computes per-element data patches through the panel's own resolvers
(nodes: _color/_size/label; edges: _ecolor/_ewidth/label), and
CytoscapeCanvas accepts `encodingSpec`, batch-applying the patch on
mount and on every spec change. Attribute-presence stylesheet rules
(edge[_ewidth], edge[_ecolor]) keep unclaimed edges on the legacy
fixed style, so precedence holds by construction. SpecLegend mirrors
the spec through the same resolvers: legend and canvas cannot
disagree. Restyle-only is the contract: spec
changes patch element data and never re-run layout (round-11 review
finding: the acceptance fixture was rebuilding the UGM per render,
which reads as "new graph" and legitimately re-inits; the stability
requirement is now in the ugm prop's contract). A deliberate,
user-invoked re-layout affordance for after large size changes is a
sensible future control: automatic re-layout is not. Round 13
closed the two deliberate absences: node.icon renders ON the canvas
as sanitized SVG data URIs (string-markup registry icons; component
icons degrade to panel/legend), and node.shape shipped as designed
below.

## node.shape: SHIPPED (round 13), as designed below

Shipped per this design: categorical-only, slot-stable over NODE_SHAPES with pinning overrides, defaulting to the color channel's driver; the panel shows a warn-not-block notice when the two drivers diverge. Original rationale: shape already exists on the canvas: the default
stylesheet reads data(_shape), assigned per type alongside hue: shape
is the REDUNDANCY channel that keeps type distinctions legible under
color-vision deficiency (R7.8's intent). That pairing is the design
rule for when the channel becomes spec-addressable: `node.shape` will
be categorical-only and DEFAULT to the same driver as `node.color`,
with a warn-not-block notice when the two are deliberately unpaired,
because shape-vs-hue disagreement destroys the redundancy that makes
the default safe. It lands with the canvas spec-application milestone
(the spec does not yet drive the canvas's _color/_shape/_size data
fields; wiring that path is the prerequisite, and shape arrives with
it rather than as a panel row that styles nothing).

## Use cases the grammar must satisfy (acceptance for the design)

1. Color nodes by `types`, then change Person to brand purple and
   leave the rest on Okabe-Ito. (categorical + override)
2. Size nodes by `pagerank`, clamping the domain to [0, 0.2] so one
   hub doesn't flatten the rest. (sequential + manual domain)
3. Icon nodes by `types` from the registry; swap the whole set for a
   brand set without touching the spec. (categorical icon + registry)
4. Color edges by `type`, width by `weight`, labels off. (edge
   channels, mixed scales)
5. Make everything one muted gray for a screenshot, except selection.
   (fixed scales; selection unaffected because accent is reserved)
6. Save the workspace and reopen it with every mapping intact.
   (tier-3 serialization)
7. Try to map confidence onto the accent: rejected with an
   explanation naming the owner. (reserved-channel guard)

## Migration

`EncodingConfig` (flat: nodeColorProperty, nodeSizeRange, ...) maps
losslessly into the spec via `fromLegacyConfig`; the existing
`EncodingPanel` signature survives as a thin adapter so the four demo
shells compile unchanged, marked deprecated in favor of
`EncodingSpecPanel`. `encodingToCytoscapeStyle` gains a spec-aware
successor; migration COMPLETE (round 13): all five demo shells and
DemoApp run on EncodingSpecPanel + SpecLegend + the canvas
encodingSpec prop through fromLegacyConfig; EncodingPanel,
CanvasLegend, and encodingToCytoscapeStyle have no in-repo consumers
and are kept only for external API stability until the next major; the `data(_color)/_size/_shape)` application path in the
canvas is unchanged (the spec resolves to the same element data
fields). NodeStyleEditor is untouched: it is the per-instance layer
above this one.
