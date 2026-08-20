---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
supersedes_note: refines brief 13 (13-holon-rdf12-examples-brief.md) with current ground truth — the RDF 1.2 parser is now LIVE on this branch, so this is a real rendered demo, not doc-first.
---

# Brief 14: RDF 1.2 triple terms as hyperarcs — a separate holon demo

Owner ask (Jake, A79): "yes [build the RDF 1.2 demo], look at hyperarcs,
and build separate holon."

## Ground truth (verified this session, not brief-13's stale assumption)

Brief 13 assumed RDF 1.2 parsing was gated behind PR #4 on another
branch. That is NO LONGER TRUE — it is live on THIS branch:

- `packages/core/src/adapter/sparql-adapter.ts` parses RDF 1.2 triple
  terms today (`RdfTerm` union has a `triple` variant; `TripleTerm`
  interface; `tripleTermToValue` recurses losslessly). Commits
  1a9555a / 97df361 / d96546d.
- BUT triple terms never become graph STRUCTURE. In `bindingsToUGM`:
  - a triple-typed SUBJECT is SKIPPED outright (line 235: "a
    triple-typed subject would need its own reification handling —
    out of scope here");
  - a triple-typed OBJECT is stored as a serialized PROPERTY on the
    subject node (lines 256–262), never drawn.
  So `<< s p o >>` round-trips into data but renders as nothing.

- "Hyperarcs" as a first-class concept DO NOT EXIST in the toolkit.
  The only "hyper" in the tree is `elk-import.ts`, where multi-endpoint
  hyperedges are explicitly REDUCED to their first two endpoints with a
  BAD_SHAPE diagnostic (line 108) because "the document's edge model is
  binary." The UGM edge model is source→target binary; there is no
  n-ary edge primitive.

- Reference machinery already present: `reificationCollapse`
  (projection/transforms.ts:212) folds classic rdf:Statement reification
  INTO edge metadata — the exact inverse of what we want. It is the
  model for statement↔edge projection.

- Demo architecture (Demo.tsx + DemoLanding.tsx): a scenario = an entry
  in `SCENARIOS` or `CAPABILITY_SURFACES` (id/title/subtitle/…/tags) +
  a lazy shell in `SHELL_MAP`. The existing holon demo is a TAB inside
  `OntologyShell`, not its own scenario. "Separate" per the owner ask =
  its own top-level card + shell.

## Prior art studied (owner ask A80: omni7 + haunt g-xplore RDF* tab)

**omni7 = the MODEL of a hyperarc.** omni7 models a hyperarc as an
RDF-star **quoted triple** `<< s p o >>` that carries folds. Verified in
`onyx-aperture/omni7/src/rdfstar_io.py` — its own probe sample is
`<< ex:A ex:r ex:B >> ex:role "P" .` (a quoted triple as SUBJECT carrying
a role). Per the Loom/OmniArc doctrine the four dimensions are: Dim1 base
triple, Dim2 structural fold (quoted-triple with role/state/topology),
Dim3 PROV-O epistemology, Dim4 federation. So a hyperarc = the base
triple PLUS its quoted-triple metadata layers; "semantic arcs are
superedge-only" (the quoted triple IS the superedge).

**GOTCHA carried from omni7 (rdfstar_io.py:8-19):** RDF-star **1.1**
`<< s p o >>` vs RDF **1.2** triple-terms `<<( s p o )>>` /
`_:b rdf:reifies <<( )>>` are different on-disk syntaxes, and GraphDB
10.x + stain/jena-fuseki **REJECT the 1.2 form on ingest (HTTP 400)**.
omni7 pins pyoxigraph==0.3.22 to keep classic `<< >>` round-tripping.
=> Author `constellation.trig` in classic 1.1 `<< >>`; document the 1.2
`<<( )>>` form as forward syntax with the pyoxigraph-0.5 note. (Our g3
SparqlAdapter parses the SPARQL-JSON `triple` binding shape, which is
independent of file syntax — but the dataset file still matters if ever
ingested.)

**haunt g-xplore RDF* tab = the RENDER — and it contradicts my A79
default.** `haunt/web/src/pages/studio/GraphExplore.tsx` (the "Load
RDF-star" button, line 520) → `applyStarAnnotations`
(`haunt/web/src/lib/g3Adapter.ts:273`) renders each annotated quoted
triple as a **qualified dashed edge** (`type:'star'`, `asserted:false`,
label `annP=annO`) between the quoted subject and object — a self-edge
on the subject when the object is a literal or off-canvas. Built on the
SAME @g3t/core UGM + CytoscapeCanvas we target, so it ports directly.
Critically, its own comment (g3Adapter.ts:265) records that it
**abandoned an earlier synthetic star-anchor NODES approach** in favor
of edges — evidence AGAINST my A79 pseudo-node default for dense graphs.

## Resolved rendering (dual view — the toggle IS the pedagogy)

Ship BOTH renders behind a toggle; each is correct for a different job:

1. **Asserted (haunt-style qualified edge):** the quoted triple as a
   dashed edge, label = the annotation. Low clutter; the proven default
   for annotations whose subject+object are both real nodes.
2. **Hyperarc / holon (pseudo-node):** the quoted triple reified to a
   diamond statement-node (`_rdfStatement:true`) with binary arcs
   statement→subject / statement→object, meta-assertions attached to the
   node, drill-in opening the s/p/o interior. This is the ONLY view that
   survives **nesting** (`<< << … >> p o >>` — an edge cannot have an
   edge as an endpoint, a node can) and multi-annotation, and it is
   holon-shaped (statement = boundary, s/p/o = interior).

Default the demo to the hyperarc view (it teaches what a triple term
IS); the toggle drops to the haunt edge view to show the density
tradeoff. Confidence (Dim3 fold) drives `edge[_confidence]` /
`node[_confidence]` opacity in both.

## Work

1. **Core: two hyperarc projections (pure, testable, additive).**
   New `packages/core/src/projection/hyperarc.ts` with BOTH renders:
   - `projectTripleTermsAsEdges(dataset) -> UGM` (haunt-style qualified
     dashed edges; self-edge fallback for literal/off-canvas objects);
   - `projectTripleTermsAsHyperarcs(dataset) -> UGM` (diamond statement
     pseudo-nodes + s/o arcs + meta fold; nested `<< << … >> p o >>`
     recurse — the render that survives nesting).
   Do NOT mutate `bindingsToUGM`'s existing binary behavior (adapter
   tests depend on it) — both are opt-in projections.

2. **Data: one dataset, two encodings.** `constellation.trig` (RDF 1.2
   `<< >>` triple terms — forward form) and `constellation-reified.ttl`
   (standard reification — the migration twin). ~30 triples: a small
   satellite constellation with confidence/provenance/effective-time
   meta-assertions on the inter-holon portal edges.

3. **Demo: a separate scenario.** New card in `CAPABILITY_SURFACES`
   (id `rdf12-hyperarcs`) + `src/demo/rdf12/Rdf12Shell.tsx` +
   `SHELL_MAP` entry. An **Asserted | Hyperarc** view toggle over the
   two projections (default Hyperarc). Meta-confidence drives the
   `[_confidence]`-scoped opacity channel in both; clicking a statement
   in the Hyperarc view drills to its s/p/o interior (holon framing).

4. **Wiring guide + CI twin.** A `docs/wiring-guide.md` section with a
   CI-executable twin in `examples/wiring/` (channel rule), showing an
   adopter the hyperarc projection call.

## Constraints

- No new runtime dependencies. Reuse UGM, projection, existing style
  channels. Mirror haunt's `type:'star'` / `asserted:false` dashed-edge
  convention for the Asserted view so the two codebases stay legible to
  each other.
- Author `constellation.trig` in classic RDF-star **1.1** `<< >>` (the
  ingest-safe form per omni7); document the 1.2 `<<( )>>` triple-term
  form as forward syntax only. Do not emit 1.2 triple-term syntax into a
  file meant to load into Fuseki/GraphDB.
- No-legacy: add the hyperarc projection alongside; do not fork or
  weaken `bindingsToUGM`.
- Data-mapped style props stay on `[field]`-scoped selectors
  (`node[_rdfStatement]`, `edge[_confidence]`) per CLAUDE.md — never a
  bare `node`/`edge` rule (per-frame Cytoscape warning flood).
- Same-graph camera/position stability holds (CLAUDE.md doctrine).

## Acceptance

- `pnpm run gates` green (typecheck && lint && verify && test),
  including the new wiring twin and a `hyperarc.test.ts` unit oracle
  (statement node count, arc endpoints, meta fold, nested recursion).
- `constellation.trig` verified parseable by pyoxigraph 0.5.9 (command +
  output recorded in the doc, with date/version); `-reified.ttl`
  round-trips the projection pipeline in the twin.
- Statement hyperarcs render as pseudo-nodes; confidence visibly drives
  opacity; drill-in opens the s/p/o interior.
- New scenario is a landing-page card reachable in the playground.

## Rollback

Additive: new files + two array entries + one guide section. Single
revert.
