# Consuming g3-toolkit outside the monorepo

Everything a host application needs that is not obvious from the
type signatures. Written because consumers reported losing review
rounds to each item below.

## Install

```bash
pnpm add @g3t/core @g3t/react
# charts are optional
pnpm add @g3t/charts
```

Peer dependencies are NOT installed for you. `@g3t/react` peers:
`react`, `react-dom`, `cytoscape`, `cytoscape-fcose`, `zustand`,
`echarts`. `@g3t/charts` peers: `react`, `echarts`. `@g3t/core`
peers: `graphology`.

`@g3t/react` also declares two OPTIONAL peers, `vis-timeline` and
`vis-data`. Install them only if you use `TimelineView`, which is
the sole consumer:

```bash
pnpm add vis-timeline vis-data
```

`TimelineView` is reachable exclusively from `@g3t/react/timeline`
for this reason. Importing it from the root barrel or from
`@g3t/react/views` will not work, by design: those barrels are
resolvable without the optional peers installed, and they can only
stay that way by not referencing the component that needs them.

## Import the stylesheet, first

```ts
import "@g3t/react/style.css";
```

The packages ship CSS as a separate file (standard Vite
library-mode output) and the bundle does not import it for you:
auto-injection breaks strict CSP setups and server rendering, so
the decision stays with your bundler. Without this line every view
renders unstyled, with no error and no warning. In development the
canvas logs a one-time warning when the design tokens are absent
from the document, which is the fastest way to spot a missing
import.

## Which props re-run layout

A full re-initialization (layout re-runs; arranged positions are
discarded unless the same-graph preset replay applies) is triggered
ONLY by CONTENT changes to: `ugm` identity, `containment`,
`layout`, `layoutOptions`, `interactionOptions`, `edgeStyle`,
`animate`.

`stylesheet` and `encodingSpec` changes are STYLE REFRESHES and
preserve positions.

`ugm` is compared by IDENTITY: a new instance means "different
graph". Memoize it in the host; do not rebuild it per render. The
object-valued props above are content-keyed internally, so an
inline literal rebuilt each render is safe.

For scene switches (a different diagram, a different subject),
prefer a keyed remount over mutating props:

```tsx
<CytoscapeCanvas key={sceneId} ugm={ugm} />
```

## Interaction contracts

These are the parts of the API consumers most reliably get wrong,
and types cannot express them.

- **Clicks that end a pan are suppressed.** `useElementPointerEvents`
  records the pointer-down point and drops a click whose pointer
  travelled more than `clickDragThreshold` model units (default 4).
  Pass 0 to restore fire-always. Model units, so the threshold
  behaves identically at every zoom.
- **Hit zones.** Structural hits report `zone`: `header`, `body`,
  `border`, `segment`, `port`, `row`, `glyph`. `glyph` is an
  affordance drawn in the header strip and is tested ABOVE the
  border band, so an edge-adjacent glyph stays reachable. Restrict
  navigation to the zone you mean; targeting `body` makes the whole
  box clickable, which readers cannot see.
- **Affordance zones do not move the scene.** A press on
  `zone: "glyph"` starts neither a node drag nor a canvas pan: it
  is an intent to act on that element. Every other zone behaves as
  before. Rows carry glyphs too, reporting the row's own id, so a
  single `zone: "glyph"` rule reaches container contents.
- **Tap slop is in SCREEN pixels, resolved per pointer.** The
  click-suppression threshold defaults to 4px for a fine pointer
  and 12px for a coarse one, taken from the pointer that started
  the gesture. `clickDragThreshold` overrides it per surface; 0
  disables suppression.
- **Init-time-only options.** `interactionOptions`
  (`wheelSensitivity`, `minZoom`, `maxZoom`, `userPanningEnabled`,
  `boxSelectionEnabled`) are constructor options in cytoscape;
  changing them re-initializes the canvas by design.

## Controlling the structural view transform

`StructuralSvgView` manages its own zoom and pan, and will pinch
on touch devices without configuration. To drive it from the host,
persist a viewport, or implement a custom gesture, pass `view` with
`onViewChange`:

```tsx
const [view, setView] = useState<SvgViewTransform | undefined>(saved);

<StructuralSvgView
  input={scene.input}
  geometry={scene.geometry}
  width={w}
  height={h}
  view={view}
  onViewChange={setView}
/>;
```

`onViewChange` fires for every internal change including the
initial fit, so it can be used for persistence alone while leaving
`view` undefined. `pinchZoom={false}` disables the built-in
gesture for hosts implementing their own.

## Per-node styling on structural scenes

`StructuralSvgView` takes `nodeStyles`, a map from element id to
resolved presentational attributes, built with
`overridesToStructuralStyles` from the same `NodeStyleOverride`
model the canvas uses. It is a prop rather than a store
subscription so the view stays pure and the same element can carry
different overrides in different views.

Precedence: `rowSeverities` beats `nodeStyles` beats the theme. A
violation tint is a correctness signal, an override is a
preference, the theme is the default.

Each renderer declares the channels it can APPLY:
`CANVAS_STYLE_CHANNELS` and `STRUCTURAL_STYLE_CHANNELS`.
`NodeStyleEditor` renders only the controls in its target's set and
writes only those channels, so no control is offered whose every
choice would do nothing. Pass `channels` to override the default
for a custom renderer. The structural set is deliberately short:
colour, border colour, border width, opacity. The SVG view draws
no icons and does not redirect labels.

Size is NOT a presentational attribute on a structural scene: node
boxes are placed by a layout and edge routes are computed against
them, so a box that grows after layout overlaps its neighbours and
its routes become wrong. `NodeStyleEditor` therefore reports a size
change through `onGeometryChange(nodeId, size)` for hosts that own
their geometry document and can re-run the layout, and suppresses
the control when no handler is wired.

The editor itself is renderer-neutral: pass a `target` descriptor
({ id, type, label, current }) instead of `ugm` and `nodeId`.

Persistence needs nothing from the toolkit. `NodeStyleOverride[]`
is plain serialisable data, and both the view transform
(`view`/`onViewChange`) and the arrangement
(`dragOffsets`/`onDragOffsetsChange`) are controllable, so a scene
can be saved and restored completely.

`SpecLegend` and `FloatingLegend` both serve structural scenes:
omit `ugm` and pass `elements` descriptors. Auto domains need data, so a structural
caller states its domain explicitly rather than relying on `auto`.

## Settling neighbours around a moved container

Dragging or resizing a compound container can leave it overlapping
unrelated nodes; the layout does not re-run on its own.
`relayoutAroundFixed(cy, { fixed: [id] })` locks the elements the
user placed (and their descendants by default), re-runs the layout
incrementally so everything else settles around them, then
restores the previous lock state, including locks the host had set
itself.

## Styling escape hatch

The `_color` and `_shape` data channels, set through the node
properties spread, are the SUPPORTED deterministic styling path.
They survive whatever the spec-apply pipeline does, so a host that
needs a guaranteed color for a node can set them directly rather
than racing the encoding spec.

Encoding-managed keys (`_ecolor`, `_ewidth`, `_color`, `_icon`,
`_size`) are CLEARED when a spec drops the channel that owns them,
so leaving a mode reverts cleanly.

Stylesheet merge order (later rules win the property): defaults,
curve style, chrome, theme colors, structural theme colors,
ENCODING rules, overlay/dim, YOUR stylesheet, hidden filter. Your
rules beat everything except the visibility filter.

## Structural scenes

Use `StructuralSvgView`. The `structural` prop on `CytoscapeCanvas`
is deprecated and warns in development. See
[structural-patterns.md](./structural-patterns.md) for the five
supported recipes and the behaviors each guarantees.

## Unpublished / vendored consumption

If you are consuming tarballs rather than the registry:

```bash
pnpm pack   # in each package directory
```

`pnpm pack` rewrites `workspace:*` ranges. Because `@g3t/react`
depends on `@g3t/core`, pin both to the same instance in the host's
manifest, or the two packages resolve to different copies and the
theme store silently splits:

```json
{
  "overrides": {
    "@g3t/core": "file:./vendor/g3t-core-1.0.0.tgz"
  }
}
```

## Known limitations

- **The packages are ESM only** as of 2026-08-16. There is no `require`
  condition and no `.cjs` in `dist`. `import` works from every bundler
  (Vite, webpack 5, Rollup, esbuild, Next) and from Node with ESM. A
  Node script using `require("@g3t/core")` must switch to `import` or
  a dynamic `import()`, and Jest running in default CommonJS mode
  needs transform configuration.

  Typed CJS never actually worked: each entry shipped one ESM-flavored
  `.d.ts`, so `require` from a `.cts` raised TS1479 even though the
  runtime file resolved. Publishing both formats was also what made
  the dual-package hazard reachable, and that one is worse than a
  compile error. The exported zustand stores are singletons; a
  dependency tree that reaches a package through `import` on one path
  and `require` on another gets two module instances and therefore two
  stores, so one view subscribes to a store another view is writing
  to, selection stops propagating, and nothing appears in a stack
  trace. It cannot be fixed from inside the library while both formats
  ship.
- `TimelineView` is only importable from `@g3t/react/timeline`, and
  that subpath requires the optional peers `vis-timeline` and
  `vis-data`. Every other entry point resolves without them.
