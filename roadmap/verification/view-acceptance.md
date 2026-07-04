# Secondary View Acceptance

**Area:** verification
**Owns:** R1.2 Timeline, R1.3 Geospatial, R1.4 Matrix, R1.6 Tree,
R1.8 Stats, R1.16 SHACL shape view, R1.17 SHACL report visualization

The five view requirements are in-progress (code exists; acceptance
unproven). The two SHACL requirements were proposed 2026-06-12;
design in roadmap/design/shacl-views.md.

The Sankey view was removed from the roadmap by review direction
(2026-06-12; requirement deferred). The partial SankeyView code
remains in the tree but carries no roadmap commitment.

## Why these are verification items, not engineering items

All six views render and are exercised by shared test files
(views/secondary-views.test.tsx, views/m7-charts.test.tsx), but no
colocated test cites the requirement IDs or restates their acceptance
criteria, so the status policy holds them at in-progress. The honest
expectation is that verification will find functional gaps (it did
for R2.10: the timeline renders, playback does not); when it does,
the gap gets scoped here and the status stays put until the
acceptance test passes. Marking a view done because a component
mounts is exactly the optics-over-evidence pattern the remediation
removed.

## Work breakdown (priority order; MUSTs before SHOULDs)

1. **P1 R1.2 Timeline:** acceptance test for brush-drag filtering the
   linked canvas to the selected temporal range. Cross-view wiring
   exists (TemporalRangeFilter + selection store); the test must prove
   the specific Given/When/Then. Playback (the requirement's scrub and
   animation clause) overlaps engineering/temporal-playback.md; the
   brush-filter acceptance closes R1.2 as written, with playback
   tracked under R2.10.
2. **P1 R1.3 Geospatial:** acceptance for lat/lon nodes rendering at
   geographic positions on a tiled basemap. Verify the basemap claim
   specifically (MapView renders markers and geo-edges; whether a tile
   layer is present is exactly the kind of assumption to test, not
   assert). Region drawing, measurement, and annotation are in the
   requirement text: expect gaps; scope them here when found.
3. **P1 R1.4 Matrix: verification executed (matrix-acceptance.test).**
   Verified: co-occurrence counts with a monotonic gradient (now on
   the viridis tokens) and a truncation notice replacing the previous
   silent slice. Two gaps found and scoped, R1.4 stays in-progress:
   (a) no type-pair selection input ("for two selected node types" in
   the acceptance text); (b) R7.3's aggregation/pagination is
   truncation-with-notice, not aggregation. Closing work: a
   `typeFilter` prop (pair or subset) and aggregate-remainder-into-
   "other" beyond maxSize; the gap test in the acceptance file flips
   when the prop lands.
4. **P1 R1.6 Tree:** 5,000-node containment fixture; first two levels
   render, deeper levels lazy-load on expand (R7.2 boundary asserted
   in the same test).
5. **P2 R1.8 Stats panel:** pagerank-property fixture renders a
   histogram with brush-to-select propagating to the selection store.
6. **REMOVED FROM ROADMAP (2026-06-12), formerly Sankey:** supply-chain fixture renders proportional flows
   between categories; R7.5's 100-flow aggregation asserted alongside.

## Exit

Each requirement advances to implemented when a colocated test citing
its ID restates its spec acceptance and passes; discovered functional
gaps are added to this file as scoped sub-items rather than waved
through.

7. **P2 R1.16 SHACL shape view:** closed NodeShape with three
   blank-node property shapes renders as a solid-bordered container
   with path/type/cardinality item rows; named shapes draw reference
   edges. Slice plan in roadmap/design/shacl-views.md.
8. **P2 R1.17 SHACL report visualization:** a three-focus-node
   report renders violation and warning tiers as toggleable
   emphasis overlays with counts available as spec drivers and
   messages in the inspector; the adapter accepts the in-core
   validator's results and the documented external-report shape.
