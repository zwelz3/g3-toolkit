# Holonic Backend Integration

**Area:** architecture
**Owns:** R5.1 (in-progress, MUST), R5.6 (proposed, SHOULD),
R5.8 (proposed, SHOULD)
**Open questions owned:** OQ10 (holonic-console integration boundary),
OQ11 (large holarchy performance)

## Why this is architecture, not engineering

The shipped HolonicAdapter consumes a hand-rolled in-memory
`HolonicDataset` interface; it has no SPARQL transport and cannot meet
R5.1's acceptance criteria (RdflibBackend and FusekiBackend served
transparently). Closing R5.1 is not "add a fetch call": it requires
deciding how a TypeScript toolkit talks to the `holonic` Python
library's four-graph model. Three candidate shapes, mutually
exclusive:

(a) **SPARQL-direct:** the adapter speaks SPARQL over HTTP to the
    Fuseki dataset that `holonic` manages, reconstructing holon/portal
    structure from the four-graph naming conventions. No Python in the
    loop at runtime; couples the adapter to holonic's graph-naming
    contract.
(b) **Holonic service API:** holonic (or holonic-console) exposes
    holarchy/portal/projection endpoints; the adapter consumes JSON.
    Cleanest contract; requires server-side work outside this repo.
(c) **Hybrid:** topology and membrane validation via a thin service
    API, interior bulk data via SPARQL-direct.

This decision IS OQ10 in practical form: holonic-console will import
`g3_toolkit.holonic`-equivalents (D6 boundary), so whichever shape is
chosen defines the integration boundary that OQ10 defers. Decide them
together, with the W3C Holon Graph CG conventions in view, so the
adapter does not encode a private naming contract the CG later
contradicts.

## Current state

- In-memory mapping (holons → nodes, portals → edges, interior
  projection) implemented and tested; honest scope documented in the
  adapter header after the audit remediation.
- `query()` logs and ignores query strings (documented limitation).
- No Projection-layer triple reading (R5.6) and no multi-interior
  selection or visual distinction (R5.8); single flat interior arrays.
- Membrane validation rendering (R5.5) and portal menus (R5.4) are
  implemented against the in-memory shape and should survive a backend
  swap untouched if the adapter interface holds.

## Work breakdown (priority order)

1. **P0: Backend integration decision (resolves OQ10).** Architecture
   note selecting (a), (b), or (c) with the holonic library
   maintainer's input; defines the graph-naming or API contract and
   the SecurityContext pass-through
   (architecture/security-model.md item 1).
2. **P1: Backend-connected adapter (R5.1).** Implement against the
   chosen contract; both acceptance criteria must hold (RdflibBackend
   for local/test, FusekiBackend over HTTP). The in-memory adapter
   remains as the test double; the public adapter selects backend by
   configuration, which is the "transparently" in R5.1's text.
3. **P1: Real query support.** Retire the query-ignoring behavior:
   SPARQL strings execute against the interior union (or scoped
   interior) per the backend contract.
4. **P2: Per-holon view configuration (R5.6).** Read Projection-layer
   declarations (preferred views, layout, style) and apply via
   WorkspaceManager. Vocabulary for these triples should come from, or
   be proposed to, the Holon Graph CG rather than invented privately.
5. **P2: Multi-interior rendering (R5.8).** Interior-graph selection
   set plus a visual-distinction channel (border color or badge);
   coordinate the channel choice with design/projection-and-encoding.md
   so inferred-edge encoding (D9) and interior attribution do not
   collide on the same visual variable.
6. **P2: Large-holarchy strategy (OQ11).** Apply the 500-node default
   to holarchy rendering with top-level-only aggregation and
   expand-on-click; align with planning/large-graph-design.md
   (CollapseByCluster) rather than building a parallel mechanism.

## Exit

R5.1 implemented with both backend acceptance tests green against a
containerized Fuseki fixture; R5.6/R5.8 implemented per their spec
acceptance criteria; OQ10 and OQ11 resolved in
specs/10-open-questions.md with the decisions recorded in specs/09.
