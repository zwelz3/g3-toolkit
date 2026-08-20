# Orchestrate: routing quality + dense-scene legibility + dependency independence

Umbrella plan:
https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324

Run order (kb orchestrate runs *.md sorted; README is not a brief —
dispatch the numbered files):

| # | Brief | Depends on | Why this position |
|---|---|---|---|
| 01 | route-nudging | — | Fixes the reported drag-time corridor collapse; exports corridorDemand |
| 02 | smart-routing-everywhere | — | Coverage: routing on all nine examples (parallel-safe with 01) |
| 03 | dummy-chains (LAY-005) | 01 oracle pins | Long-span crossing reduction; activates BK type-1 machinery |
| 04 | corridor-supply | 01 (corridorDemand), 03 | Layout provides the headroom nudging measured |
| 05 | channel-router (PRF-003) | 03, 04 | Construction-time conflict avoidance; deletes the 4px escalation ladder |
| 06 | dense-scene-legibility (pseudo nodes) | 02 | Projection-level hub-burst/bus spreading; haunt adopter lessons folded in |
| 07 | dependency-independence Tier 1+2 | Tier 1 gated on 03-05; Tier 2 free | Clean-room replacement + deletion of dagre/d3/fcose/utility deps |
| 08 | renderer-independence (Tier 3a) | 07 Tier 1 (native layouts), 05 (routing) | Native canvas renderer on RND-004 foundation; cytoscape + fcose deleted at S6 cutover (v2.0.0 breaking: `cy` handle) |
| 09 | widget-independence (Tier 3b) | 08 display-list maturity | echarts, vis-timeline/vis-data, tanstack table, fuse.js, demo n3/jsonld replaced and deleted |
| 10 | long-edge-perimeter | 01 (both touch routeStructuralEdges) | Long skip edges prefer perimeter routes over legal-but-ugly interior corridors (Prune Wall) |
| 11 | cluster-collapse-counts | — | interiorEdgeCount/boundaryEdgeCount on supernodes + count badge + auto-collapse wiring |
| 12 | holon-boundary-projection | — | Portals stay edges; boundary ring + transit glyphs (Jake ruling A30); projectHolonBoundary drill level |
| 13 | holon-rdf12-examples | 12 | Holonic TriG dataset (RDF 1.2 + reified twin) + two worked examples |
| 14 | routing-playback-rewind | 01 (quality.ts overlap) | Deterministic idempotent step playback/rewind in the Routing Lab for per-step routing eval (Jake A30) |

Dispatch mode (Jake ruling A30:q2): ONE AT A TIME — each brief
dispatches only after its predecessor lands and gates green; no
orchestrator batch relaunch. Sanity gate demoted per decision
kb-emit-bb44cd61e3cf (non-converging).

Kept platform (owner-overridable only): react, react-dom, zustand —
they ARE the adopter contract (CLAUDE.md three channels) — plus the
dev-time toolchain (vite, vitest, playwright, storybook, eslint),
which ships no runtime code.

Ground rules binding every brief: techniques from MSAGL/libavoid/ELK/
dagre by published description only, never ported code; no-legacy
(replaced paths deleted in the same PR); oracle metrics pinned before,
asserted after; `pnpm run gates` never piped through tail/head; visual
acceptance stays with Zach on the Pages playground.
