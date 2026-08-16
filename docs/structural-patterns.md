# Structural rendering patterns

Owner directive 2026-07-28 (#3): the supported structural
visualization patterns, each as a copy-paste recipe with the
component mount and the behaviors the toolkit GUARANTEES for it.
Every guarantee named here is executable: the pattern oracle suite
(packages/core/src/layout/g3t-engine/structural-patterns.test.ts)
runs each recipe end-to-end and asserts the invariants, so a
regression in any pattern fails CI, not a review.

The renderer for all patterns is StructuralSvgView (the cytoscape
structural path is deprecated as of 2026-07-28). The standard
mount, sized by the host:

    const scene = useStructuralLayout(input, { direction });
    <StructuralSvgView
      input={scene.input}
      geometry={scene.geometry}
      width={w}
      height={h}
    />

## Pattern 1: flat blocks with labeled edges (BDD-shaped)

Input: nodes with explicit width/height (or header + rows), edges
with labels, no ports, no containment.

    { nodes: [{ id, width, height }...],
      edges: [{ id, source, target, label }...] }

Guarantees: routes never pass through non-endpoint blocks (dense
corridors DETOUR around the band rather than surrendering);
near-aligned pairs collapse to a straight line, offset pairs take
a two-bend Z at most; overlapping drops route out the open side
from an exposed border stretch; edge labels anchor at the target
end, off the wire, in the opposite quadrant from port labels.

Header features apply here too: `glyphs` draws the affordance
inside the box's own top corner (a plain node has no header strip)
and reports `zone: "glyph"` exactly as on containers, and
`headerLines={2}` splits the stereotype onto its own line above
the name. The two node kinds render the same features from the
same props; nothing is container-only.

## Pattern 2: containment (header + compartments)

Input: nodes with a header and compartments of rows.

    { nodes: [{ id, header: { stereotype, name },
                compartments: [{ id, title, rows: [...] }] }],
      edges: [...] }

Guarantees: the container derives its size from the shared row
width and stacked row heights; the width estimate TAPERS on long
rows (sentence-length text does not inflate the box); the header
strip is reserved; row dividers render.

## Pattern 3: blocks with ports (IBD-shaped)

Input: nodes declaring ports with sides; edges attach by port id.

    { nodes: [{ id, width, height,
                ports: [{ id, side: "WEST" }...] }],
      edges: [{ id, source, target, sourcePort, targetPort }] }

Guarantees: ports render on their declared sides (source ports
default flow-forward, target ports flow-backward when no side is
forced); a side GROWS to fit its declared ports (port pitch 20,
side margin 24), and box-edge fans get a degree-based floor;
port-to-port routes straighten when the shared line stays within
both ports' own bodies (anchors stay ON the port, off-center);
port labels sit outside beside the port, clear of the wire and of
edge labels.

## Pattern 4: containment WITH ports (the combined recipe)

Input: pattern 2's containers carrying pattern 3's ports.

Guarantees: all of patterns 2 and 3 simultaneously: derived
sizing honors BOTH the row content and the per-side port demand
(whichever is larger wins); routing, straightening, and label
placement behave identically to the simpler patterns. This is the
"render containment with ports using g3t" recipe.

## Pattern 5: mixed port/box bindings (parametric-shaped)

Input: value blocks with an output port bound to a constraint
block's parameter ports; or bare boxes bound to ports.

Guarantees: MIXED pairs (one port, one box) straighten by sliding
the BOX anchor to the declared port's tangent; ports never move.

## What is deliberately NOT guaranteed

Exact pixel positions (layout is deterministic but its constants
may be tuned); route SHAPE beyond the invariants above (a clear
route may re-shape between versions as the router improves);
cytoscape-structural behaviors (deprecated).
