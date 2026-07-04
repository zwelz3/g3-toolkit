# SHACL Views: Shape Graphs and Validation Reports

**Area:** design
**Owns:** no spec requirements; design record for the SHACL shape
view and validation-report visualization requirements, added
2026-06-12 by review direction alongside the UML/ELK custom-view
track (owned in verification/view-acceptance.md).

Two distinct visualization problems share one vocabulary: rendering
the SHAPES GRAPH itself (NodeShapes, property shapes, constraints,
targets), and rendering a VALIDATION REPORT over the data graph. The
design maps both onto machinery the toolkit already has: compound
containment, the encoding grammar, structural overlays, and the
results-not-computation interchange doctrine.

## How containment shapes the shape view

A NodeShape is naturally a CONTAINER (the UML-element look from
containers slice 1: a «NodeShape» stereotype header over the shape's
IRI or label). Its sh:property shapes are the contained items. Two
containment rules matter and both come from SHACL's own structure:

1. **Anonymous (inline) property shapes contain; named/shared shapes
   reference.** Compound nesting must remain a forest, but a named
   PropertyShape can be reused by several NodeShapes. Rule: blank-node
   property shapes render as children INSIDE their owning NodeShape;
   IRI-named property shapes render once, with sh:property drawn as a
   reference edge. The containment derivation generalizes the
   containers-slice-1 mechanism (containment from a designated link
   type, here sh:property restricted to blank-node targets).
2. **Logical constraint operators nest.** sh:and / sh:or / sh:xone /
   sh:not introduce sub-containers carrying a connective badge, with
   member shapes inside; sh:not renders its operand with a negation
   tint. Depth is bounded in practice but a collapse affordance
   (working-set integration) is required for generated shape graphs.

With containers slice 2 (ELK, ports, compartments), property shapes
graduate from child nodes to COMPARTMENT ROWS, the UML-attribute
look: one row per property shape. This is the same compartment
machinery the UML custom views need; SHACL is a second client of it,
not a separate engine. (Round-31 concretion: the API is the
StructuralCompartment/StructuralRow input model and StructuralGeometry
document in design/structural-rendering.md; a NodeShape maps to a
StructuralNode whose property-shape summaries are rows, and per-row
result badges ride on rows being real selectable elements.)

## How properties and constraints render

Each property shape row carries a constraint SUMMARY inline and full
detail on demand (tooltip / Detail Inspector), keeping the canvas
readable:

- **Path:** sh:path rendered compactly (inverse paths with a ^
  prefix; sequence/alternative paths abbreviated with expansion in
  the inspector).
- **Type:** sh:datatype as a literal-type suffix (xsd:string),
  sh:class / sh:node as a typed reference; sh:node additionally
  draws a reference edge to the target shape's container.
- **Cardinality:** sh:minCount/sh:maxCount as the UML-style
  [min..max] suffix ([1..*], [0..1]); absence renders as [0..*].
- **Value constraints** (sh:in, sh:pattern, sh:minInclusive, ...):
  a constraint-count chip on the row; enumeration and pattern detail
  lives in the inspector (canvas text would not survive real shapes).
- **sh:closed:** closed NodeShapes take a solid container border;
  open shapes a dashed one (the existing compound rule gains a
  variant). sh:ignoredProperties listed in the inspector.
- **Severity and deactivation:** shape-level sh:severity tints the
  container border using the theme's semantic colors;
  sh:deactivated shapes render dimmed (the overlay dim class
  reused).
- **Targets:** sh:targetClass / sh:targetNode / sh:targetSubjectsOf
  draw dashed "targets" edges from the shape container to class or
  instance nodes when the data/ontology graph shares the canvas;
  with separate canvases, targets become cross-view highlights (see
  linked views below).

## Validation report visualization

Doctrine unchanged: REPORTS, NOT VALIDATION. Conformance checking
runs wherever it runs best (pyshacl, Jena shacl, a CI gate, or the
deliberately lightweight in-core validator that already exists in
packages/core/src/shacl). The toolkit consumes a versioned report
document, the same pattern as algorithm results:

    { "version": 1,
      "conforms": false,
      "source": "pyshacl 0.30",            // provenance, optional
      "results": [{
        "focusNode": "<node id or IRI>",
        "path": "<property path string>",  // optional
        "severity": "violation" | "warning" | "info",
        "sourceShape": "<shape id or IRI>",
        "message": "...",
        "value": "..."                     // optional offending value
      }] }

A small adapter maps the in-core ShaclValidationResult[] into this
document; external RDF reports (sh:ValidationReport) convert via a
host-side script this slice, with a JSON-LD parser as a later slice.

The rendering reuses three existing mechanisms directly:

1. **Severity tiers as structural overlays.** Loading a report
   registers up to three named overlays (violations, warnings,
   infos) over the focus nodes, independently toggleable with the
   established union/dim semantics; emphasis colors come from the
   theme's semantic tokens (error, warning, accentMuted), extending
   themeColorRules with severity-tier overlay classes. Deactivating
   everything restores exactly, by construction.
2. **Counts and severity as encoding drivers.** Per focus node the
   adapter ingests _shacl_resultCount and _shacl_maxSeverity as
   properties; the spec drives size from the count or color from the
   severity through the ordinary grammar, legend included. This is
   the clustering-is-a-driver doctrine applied to conformance.
3. **Paths as edge emphasis.** Where sh:resultPath names a direct
   property, the corresponding edges from the focus node join the
   overlay's edge set, so path-level problems read as highlighted
   relationships, not just marked nodes.

Constraint structure influences the report view in one more place:
when BOTH views are open, results cross-link. Selecting a result
highlights the focus node in the data canvas AND the source shape's
container (down to the property-shape row once compartments exist)
in the shape canvas; selecting a shape filters the report to its
results. This linked-views behavior is the acceptance bar that makes
the pair genuinely useful for ontology work rather than two
disconnected pictures.

## SHACL coverage: what the rendering carries today vs the spec

VA-28 review (round 38) asked that we "cover the SHACL specification."
That is a large, separable effort spanning the validator, a real RDF
shapes PARSER (which does not exist yet; shapes are hand-authored
ShaclShape objects today), and the rendering. Being explicit about the
boundary so it is not mistaken for complete:

RENDERED TODAY (from the lightweight in-core ShaclPropertyConstraint):
sh:path (simple predicate only), sh:datatype (mapped from 5 keywords:
string/number/boolean/date/uri, NOT arbitrary datatype IRIs),
sh:minCount/sh:maxCount (the [min..max] suffix), and as a
constraint-count chip: sh:pattern, sh:in, sh:minInclusive,
sh:maxInclusive. Shape level: sh:closed (solid/dashed border),
sh:ignoredProperties (model only), the «NodeShape» header, and
caller-supplied sh:node-style reference edges (now labeled with the
property path).

NOT YET MODELED OR RENDERED (the spec gap, follow-on work):
- Constraint components: sh:class, sh:node (as a parsed property, not
  a side-channel reference map), sh:nodeKind, sh:hasValue,
  sh:minLength/sh:maxLength, sh:minExclusive/sh:maxExclusive,
  sh:lessThan(OrEquals), sh:languageIn, sh:uniqueLang, sh:equals,
  sh:disjoint, sh:qualifiedValueShape.
- Logical operators: sh:and/sh:or/sh:xone/sh:not (the nested
  sub-container design in "How containment shapes the shape view"
  above is unbuilt).
- Path expressions beyond a simple predicate: sequence, alternative,
  inverse (^), zero-or-more.
- Shape metadata: sh:severity (border tint), sh:deactivated (dim),
  sh:order (row ordering), sh:group, sh:name/sh:description on
  property shapes, sh:message.
- Targets: sh:targetClass/sh:targetNode/sh:targetSubjectsOf/
  sh:targetObjectsOf as dashed target edges (needs the data/ontology
  graph on canvas or cross-view highlighting).
- Blank-node vs IRI property-shape distinction (named shapes render
  once and are referenced; the lightweight model has no node identity
  for property shapes).

SEQUENCING: full coverage needs the RDF shapes parser first (so
sh:node, paths, and logical operators are real structure rather than
hand-authored), then the validator extensions, then the rendering of
each. The rendering layer is ready to receive them: the row formatter
and the StructuralDecorations channel extend without structural
change. This is multi-slice follow-on work, not a single round.

The ELK structural-rendering group (Group A in STATUS.md) lands
BEFORE the compartment-dependent slices here, by design: the
compartment API is built once for UML and consumed here unchanged.

1. (B1, no ELK dependency) Report document contract + adapter from
   the in-core validator + severity-tier overlays + count/severity
   drivers (almost entirely wiring of shipped machinery). SHIPPED
   round 39 (R1.17 in-progress): the versioned ShaclReportDocument,
   reportFromValidationResults adapter, severityOverlays (one
   toggleable overlay per non-empty tier over focus nodes, with
   optional path-edge emphasis), shaclResultDrivers
   (_shacl_resultCount/_shacl_maxSeverity for the encoding grammar),
   and the report-filtering helpers; VA-29 demonstrates it over the
   data graph. DEVIATION from this record's phrasing: severity COLOR
   comes from the encoding driver (_shacl_maxSeverity through the
   ordinary grammar, legend included) rather than dedicated per-tier
   overlay classes. Rationale: the union overlay-membership rule
   collapses tier identity, so per-tier overlay color would fork that
   machinery; the driver path reuses the legend and restyle semantics
   and is the "clustering-is-a-driver" doctrine the report section
   already prescribes (mechanism 2). The overlays still provide
   independent per-tier toggling and dim/emphasis (mechanism 1).
   REMAINING for full R1.17: the inspector result-detail listing
   (message/source shape/path/value) and the shape-view cross-link
   (which is B4).
2. (B2, no ELK dependency) Shape view slice 1 on current containers:
   NodeShape containers, blank-node property shapes as children with
   path/type/cardinality labels, reference and target edges,
   closed/open border variants. SUBSUMED INTO B3 (round 37): because
   Group A shipped first, the shape view was built directly on
   COMPARTMENTS rather than plain child nodes, so there was no
   child-node intermediate to migrate. Closed/open borders and
   reference edges landed here.
3. (B3, consumes Group A) Compartment upgrade: property shapes as
   rows through the SAME compartment API the UML views use; per-row
   result badges from loaded reports. SHIPPED round 37 (the
   appropriate-reuse milestone): shaclShapesToStructural produces the
   identical StructuralGraphInput; shaclRowSeverities badges exact
   property rows; the canvas StructuralDecorations arg carries
   closed/open and severity. What remains for full R1.16: the
   lightweight in-core model has no blank-node-vs-IRI property-shape
   distinction and no sh:node/sh:target structure, so reference edges
   are caller-supplied and target edges are unbuilt; a richer shapes
   parse is the follow-on.
4. (B4) Linked shape-and-data views: cross-highlighting and report
   filtering. SHIPPED round 44 (the linked-views acceptance bar that
   completes R1.17's pair): shacl-links (resultTargets,
   resultSelectionIds, resultDetail, resultsForFocusNode) plus the
   already-shipped resultsForShape. Selecting a result feeds
   resultSelectionIds to the shared selection store, which highlights
   the focus node (data canvas) and the source shape container + the
   offending property-shape row (shape canvas) in every subscribed
   canvas at once: pure selection-store reuse, no new linking
   machinery. VA-30 demonstrates the three-panel linked view.
   resultDetail shapes a result for an inspector; the one remaining
   R1.17 item is wiring that into the production DetailInspector
   component (the shaping is built and tested, the component does not
   yet render it).
5. (B4 continued) Logical-operator nesting with collapse; JSON-LD
   report parsing.
