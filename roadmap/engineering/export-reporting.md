# Export and Reporting

**Area:** engineering | **Milestone:** M10
**Owns:** R2.11 (in-progress, MUST; capped by acceptance criteria)
**Design/architecture gates:** OQ13 resolution and the export
enforcement component, both via architecture/security-model.md
**Exit criteria of record:** planning/m10-evaluation.md

## Current state (why R2.11 is capped at in-progress)

What exists is serialization, not export: style-override and workspace
state round-trip as JSON. The requirement's substance is absent: no
subgraph export in any interchange format (JSON-LD, Turtle, CSV), no
PNG/SVG capture, no structured report generation. The first status
sweep credited R2.11 off the serializer comment; corrected, capped,
and planned here.

## Work breakdown (priority order)

1. **P1: ExportManager with subgraph serializers.** Selected-elements
   subgraph (nodes, inter-edges, properties, Qualified Edge metadata)
   to Turtle and JSON-LD via round-tripping the projection: UGM back
   to triples is the inverse of the ProjectionPipeline's collapses,
   and reification/RDF-star choices on the way out must mirror the
   Provenance-Preserving preset so re-import is lossless where the
   source was RDF. CSV as the flat fallback (nodes table, edges
   table). Spec acceptance: 50 selected nodes export to valid Turtle
   containing those nodes, properties, and inter-edges.
2. **P1: Image capture.** PNG via Cytoscape's native export; SVG where
   the renderer supports it (document the raster-only fallback if
   not). Viewport vs full-graph extent as an option.
3. **P1 (gated): Access-control enforcement (R8.4 integration).** The
   export path consumes the authorization boundary and the OQ13
   resolution from architecture/security-model.md; until that lands,
   ExportManager ships behind a flag in deployments without a
   SecurityContext, and the README for the module says exactly that
   rather than implying enforcement exists.
4. **P2: Structured report generation.** Selected-elements report
   (entity summaries, provenance chains, annotations) to Markdown
   first; richer formats only on demand. Workspace-state export
   already exists and folds in unchanged.

## Exit

R2.11 advances to implemented when the Turtle/JSON-LD/CSV/PNG paths
pass colocated acceptance tests (including a Turtle re-import
round-trip on an RDF-sourced fixture) and the sync_spec_status.py cap
is removed; the R8.4 gate is tracked in security-model and does not
block R2.11's own closure, but the flag stays until it lands.
