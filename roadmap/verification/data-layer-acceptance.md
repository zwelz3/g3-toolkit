# Data Layer Acceptance

**Area:** verification
**Owns:** R3.7 virtualized-source visualization affordances
(in-progress: modules exist without colocated requirement-cited
tests)

The algorithm-adapter requirement graduated in round 21: the adapter
gained the interchange contract, edge ingestion, and colocated
tests, and the StatsPanel histogram half had existed since M5.

## Items (priority order)

1. **DONE (round 21), formerly owned here:** the algorithm-adapter module ingests result maps;
   the spec acceptance is end-to-end (CSV of PageRank scores keyed by
   node ID loads, nodes carry `pagerank`, the stats panel renders the
   histogram). Test the ingestion half colocated here; the rendering
   half joins R1.8's acceptance (verification/view-acceptance.md item
   5) so neither test silently assumes the other. Protocol-freeze
   work is separate (architecture/data-layer.md, OQ8).
2. **P1 R3.7 (RESCOPED 2026-06-12, visualization-only):** nodes
   carrying virtualization provenance (source system, table, key)
   show a visible source indication on the canvas and full
   provenance in the Detail Inspector and tooltip: the Stardog
   pattern. The previous data-join reading and the connector
   generalization were removed from the roadmap (requirement
   deferred); the relational-virtualizer module stays as host-side
   utility code. Former item: tabular join to UGM by node ID/IRI with virtualized
   columns appearing in the Table view and supplementary properties in
   the Inspector. Fixture: a transactions table keyed by entity IRI
   per the spec acceptance.
3. **P1 R6.1:** R3.7's transport generalization (SQL-over-HTTP or
   JDBC/ODBC-shaped result sets). The virtualizer is
   transport-agnostic by design; the acceptance test feeds it a
   Postgres-shaped result fixture. If genuine JDBC/ODBC connectivity
   (vs accepting their result shape) is judged in scope, that is an
   engineering item to split out; the requirement text supports the
   narrower reading and the test should pin which reading we claim.

## Exit

Each advances to implemented on its colocated acceptance test; the
R6.1 scope reading is recorded in the test's header comment and, if
narrowed, reflected in the spec text via a clarifying edit rather
than left ambiguous.
