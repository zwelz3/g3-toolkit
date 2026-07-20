# Post-Roadmap Human Actions

Items that are real and worth doing but are deliberately NOT on the
agent-driven roadmap: they need human judgment, taste, or domain
authorship rather than mechanical implementation. Agents should not
schedule these into rounds; surface them to the human and leave them
here until the human picks them up.

## Open

- **Execute the G3L manual-review log (MR-1..MR-6).** G3L rounds now
  track their human/live-review tasks procedurally in
  planning/g3l/manual-review-log.md (MR-1 CLOSED: collapse feature removed by ruling, see planning/expand-collapse-postmortem.md;
  overlay 4k lag gate, overlay parity review, FTO review, PRF baseline
  ruling, label taste check). That log is the single home for such
  items going forward; this entry is the pointer, not the copy.

- **Reconsider global Zustand stores for per-canvas state (multi-canvas
  pages).** The overlay, selection, and pin stores are
  module-level singletons. With one canvas (the production case) this
  is fine, but a page mounting several canvases (the visual-acceptance
  page; conceivably a future split view or comparison UI) shares all
  of that state across every canvas. Round 40 fixed the most visible
  symptom defensively (the overlay effect now ignores overlays that
  reference none of its own elements, so canvases no longer cross-dim),
  but the root design (per-canvas state in a global store) is a smell.
  A cleaner design would scope these stores per canvas instance (e.g.
  a store-provider context, or canvas-id-keyed slices). Not urgent: no
  production single-canvas behavior is affected, and the defensive
  guards hold. Flagged by review 2026-06-12.

- **Improve SHACL fixture-data realism (VA-28).** The shape-view
  demo fixture (va28Shapes in scripts/visual-acceptance/va20-shared.tsx)
  is internally coherent but still reads as synthetic: property sets,
  datatypes, and the Person->Organization reference are illustrative
  rather than drawn from a real shapes graph. A human with a concrete
  domain (a real SHACL shapes file from the MBSE/ontology work) should
  replace it with something authentic, which would also exercise more
  of the rendering (more constraint kinds, more realistic paths and
  cardinalities). Flagged by review 2026-06-12. Not blocking; the
  rendering is correct, the data is just demo-grade. Relatedly, once
  the RDF shapes parser exists (see roadmap/design/shacl-views.md
  coverage matrix), the fixture should load a real .ttl rather than a
  hand-authored ShaclShape[].
