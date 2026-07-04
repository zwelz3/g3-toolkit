# Data Layer: Federation and the Algorithm Protocol

**Area:** architecture
**Owns:** R6.2 (proposed, SHOULD)
results (proposed, SHOULD; landscape-sourced, resolves with OQ8)
**Open questions owned:** OQ8 (graph algorithm plugin API surface)

The algorithm-subgraph-overlay requirement graduated in round 26: structure-shaped overlays shipped in round 21 (registry, independent toggles, emphasize/dim via classes, exact restore), and two review passes over the live VA-26 exercised the rendering with only narrative findings: the acceptance behavior is field-verified.

## Scope note

Most data-layer requirements are further along than this file: the
adapter implementations and relational virtualizer exist and are
tracked in verification/data-layer-acceptance.md; streaming is an M9
engineering item (engineering/streaming.md). What remains here is the
structural work with cross-adapter blast radius.

## R6.2: Multi-source federation

Combining multiple GraphAdapter instances in one workspace, with
entity resolution by shared IRI, owl:sameAs, or user-defined key.
Nothing exists; the event bus carries cross-adapter events but
performs no merging (its comment was corrected during the audit
remediation to stop implying otherwise).

Work breakdown (priority order):

1. **P1: FederationManager design.** A federated adapter that
   composes child adapters and merges their UGMs. The hard decisions:
   merge semantics for conflicting property values (last-adapter-wins,
   provenance-tagged multi-value, or per-key policy); identity of
   merged Qualified Edge metadata; whether federation happens eagerly
   (merged UGM) or lazily (overlay resolution at render). Eager
   merging fits the current one-UGM-per-view contract and is the
   recommended starting point.
2. **P1: EntityResolver.** Pluggable key strategies (IRI equality,
   owl:sameAs closure from an RDF source, user-supplied key function).
   owl:sameAs closure requires the RDF adapter to surface sameAs
   triples even under Standard-preset projection; coordinate with
   design/projection-and-encoding.md so the preset does not collapse
   away the identity data federation depends on.
3. **P2: Provenance attribution in merged graphs.** Each property on a
   merged node carries source-adapter attribution surfaced in the
   Detail Inspector; this reuses the Qualified Edge metadata bag (D1)
   rather than inventing a parallel mechanism.

Acceptance (from the spec): a SPARQL source and a Cypher source both
containing "Company X" under a shared IRI federate to a single canvas
node with properties merged from both.

## OQ8: Algorithm plugin API surface

R3.5's AlgorithmResultAdapter ingests results; OQ8 asks for the
contract between optional-install algorithm packages and the visual
encoding layer. The on-file recommendation (node_id/edge_id to
property-map protocols, with a VisualEncoding declaration mapping
property keys to channels) is sound and partially realized:
VisualEncodingManager exists. Remaining work:

1. **P1: Freeze the `AlgorithmResult` protocol** as a published type
   in @g3t/core (it is the prerequisite for any third-party algorithm
   package) and document the property-key conventions the built-in
   views already assume (`pagerank`, `community`, embedding vectors).
   The freeze now includes the structure-shaped result form (R3.9,
   adopted from the capability landscape): edge-set/subgraph results
   (spanning trees, path trees, ego networks, k-cores) registered as
   named overlays, because freezing a property-only protocol and
   amending it one release later is two breaking changes where one
   suffices.
1b. **P2: Overlay rendering (R3.9).** OverlayRegistry plus canvas
   emphasis/de-emphasis styling for the active overlay set, non-
   mutating per the requirement's acceptance criteria; channel
   allocation defers to the D9 table
   (design/projection-and-encoding.md) since overlay emphasis,
   inferred-edge styling, and confidence opacity must coexist.
2. **P2: Reference algorithm package.** A separate
   @g3t/algorithms-reference (or example) wrapping graphology-metrics
   through the frozen protocol, proving the optional-install posture
   (P1, D4) with a real consumer.

## Exit

R6.2 implemented per its acceptance criterion with a two-source
fixture test; OQ8 resolved in specs/10 with the protocol shipped and
a consumer exercising it; design decisions recorded in specs/09.
