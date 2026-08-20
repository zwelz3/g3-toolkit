---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 11: auto-collapse with node + path counts on the collapsed node

Owner ask (Jake, A29): "does this have auto collapse with a number of
nodes and # paths in it — if not add it."

## What exists (verified 2026-08-14 against collapse-by-cluster.ts)

`collapseByCluster` (packages/core/src/scale/collapse-by-cluster.ts)
already auto-collapses: above `threshold` (default 2000 nodes) it
Louvain-groups nodes into supernodes. Each supernode carries
`memberCount`, `typeBreakdown`, `dominantType` properties; aggregated
cluster-links carry `weight` = number of underlying inter-cluster
edges. `buildSubgraph` is the drill-in half. The label deliberately
excludes the count (double-render bug, see clusterLabel comment).

## What is missing (the actual gap)

1. **Interior edge count**: no property records how many edges live
   INSIDE a supernode. The edge-aggregation loop (step 5) already
   visits every edge and computes `superOf` for both ends; when
   `a === b` it `continue`s — that discard IS the interior count.
2. **Visible counts on the canvas**: nothing renders "N nodes / M
   edges" on a collapsed node in any view. memberCount is only used
   as a size channel in the scale demo.
3. **Wired auto-collapse**: collapseByCluster is called only by the
   scale demo surface. Adopters get no documented one-liner.

## Work

1. **Core** — in `collapseByCluster` step 5, when `a === b`
   increment an `interiorEdgeCount` per supernode; set it as a
   supernode property next to `memberCount`. Also emit
   `boundaryEdgeCount` (edges with exactly one end inside) — free
   from the same loop, and it is the "# paths in/out" number an
   analyst actually asks for. Update the CollapseResult docstring.
2. **Rendering** — count badge, projection-level not renderer-level
   (keeps brief-08 renderer independence intact): a small pure helper
   `clusterBadgeText(attrs)` → `"12 nodes · 34 links"` exported from
   the scale module, plus a documented label-template snippet showing
   how to compose it into the Cytoscape label via the existing style
   channels. Do NOT bake counts into `name` (regression guarded by
   the clusterLabel comment).
3. **Wiring** — wiring-guide section "Auto-collapse at scale":
   threshold, counts badge, drill-in via buildSubgraph, with an
   executable twin in examples/wiring/ (CI-run, per CLAUDE.md
   channel rule).
4. **Tests** — interior/boundary counts on a planted-partition
   fixture (collapse-by-cluster.test.ts already builds one with
   mulberry32); badge text pure-function test; wiring twin.

## Acceptance

- `collapseByCluster` supernodes expose memberCount,
  interiorEdgeCount, boundaryEdgeCount; sums reconcile: for each
  supernode, interior + boundary edges partition its members' edge
  incidences; global sum of interiorEdgeCount + sum of link weights +
  sum shared boundary = total edge count (state the exact invariant
  in the test).
- Scale demo shows the badge on collapsed nodes.
- `pnpm run gates` green; bundle ledger unchanged or rationale added.

## Rollback

Properties are additive; badge helper is a new export. Revert = one
commit revert, no consumer breaks.
