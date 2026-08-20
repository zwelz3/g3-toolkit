---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 13: holon + RDF 1.2 worked examples

Owner ask (Jake, A29): "develop a holon and RDF 1.2 examples."

## Grounding

- Holonic side: `HolonicAdapter` in-memory model (see brief 12's
  verified inventory). Existing RDF machinery in this branch:
  SparqlAdapter, projection pipeline (reificationCollapse in
  projection/transforms.ts), the bio shell's rdf.ts/sparql.ts.
- RDF 1.2 side: triple-terms support was shipped on branch
  `feat/rdf-1.2-triple-terms` (3 commits, PR zwelz3/g3-toolkit#4,
  base fable-updates) — it is NOT on this branch. Any example that
  needs actual `<< s p o >>` parsing either lives on that branch or
  gates on the PR merge. Examples that only need reified/annotated
  edges can ship here using the existing reificationCollapse path.

## Work (two examples, one dataset)

**Dataset: a holonic system-of-systems in TriG.** A small (~30
triple) satellite-constellation holarchy: 3 holons (Ground, Sat-A,
Sat-B), each with an interior graph, portals between them, and RDF
1.2 triple-term annotations on the portal assertions — confidence,
provenance (prov:wasDerivedFrom), and effective-time. Same content
twice: `examples/holonic-rdf12/data/constellation.trig` (RDF 1.2
triple terms — the forward-looking form) and
`constellation-reified.ttl` (standard reification — parseable
today). Keep the mapping between the two documented inline; this
doubles as a migration example for adopters.

**Example 1 — holon drill with annotated portals.** A wiring example
(examples/wiring/ twin + guide section) that loads the reified
Turtle through the projection pipeline: reificationCollapse folds
each annotation onto its portal edge as `_confidence`/`_source`
properties, feeding the existing `edge[_confidence]` opacity channel
(already field-scoped per CLAUDE.md). Renders the holarchy via
HolonicAdapter; drill-in shows a holon interior.

**Example 2 — RDF 1.2 triple-term walkthrough (doc-first).** A
documented example in docs/ showing the SAME graph in 1.2 syntax and
what changes for the adopter when #4 merges: the parser accepts
`<< s p o >>` directly and the reification-collapse step disappears.
Verify the .trig parses with pyoxigraph 0.5.9 (the only local parser
that reads triple-terms; rdflib fails at the annotation syntax) and
record the command in the doc.

## Constraints

- No new runtime dependencies; examples use existing adapters and
  transforms only.
- The .trig file is data + docs until the RDF 1.2 branch merges — do
  not add a parser or fork logic into core here.
- Wiring snippets must be CI-executable twins (CLAUDE.md channel
  rule); the doc-first example is exempt but its pyoxigraph check
  gets recorded with date + version.

## Acceptance

- `pnpm run gates` green including the new wiring twin.
- constellation.trig verified parseable by pyoxigraph (command +
  output in the doc); constellation-reified.ttl round-trips through
  the projection pipeline in the twin test.
- Portal confidence visibly drives edge opacity in the example.

## Rollback

Pure additive examples + docs; single revert.
