# Working Sets and Performance

**Area:** design
**Owns:** OQ4 (streaming layout algorithm), OQ7 (working-set limit
values), OQ11 is owned by architecture/holonic-backend.md (referenced
here for the shared aggregation mechanism), D7 (streaming layout
modes, considering)
**Gates:** engineering/streaming.md (algorithm and mode decisions),
verification/view-acceptance.md (limit values are assertion targets).

## OQ7: Are the limit numbers right?

The shipped defaults (canvas 500/2,000, tree 1,000, matrix 200x200,
table 10,000 rows/page, sankey 100 flows, streaming window 500) are
declared initial recommendations; nothing has validated them. The
on-file resolution path stands: profile interaction latency across the
hardware tiers named in the spec (thin client, standard workstation,
analyst desktop) and set each default where latency crosses 100ms on
the minimum tier; publish the hardware matrix.

Two sharpening notes from implementation experience:
- The M0 go/no-go benchmark (500n/2,000e rendering in 305ms headless)
  measured initial render, not interaction latency under load; OQ7
  needs pan/zoom/select latency, which is the limit users feel.
- The 10,000-row table page is itself suspect (the first audit flagged
  it); test it on the thin-client tier first since it is the most
  likely default to move.

Resolution criteria: a benchmark harness (extend the existing
test-harness route) producing the matrix; defaults adjusted in
WorkingSetManager with the matrix committed under research/ as the
evidence; OQ7 closed.

## D7 / OQ4: Streaming layout modes and algorithm

D7 (stable vs live modes, user-togglable) should advance to accepted;
both use cases are documented and the toggle is cheap. OQ4 (which
incremental algorithm powers live mode) is the real question.
Candidates on file: d3-force with alpha decay, incremental Sugiyama
(OGDF-style), custom WebGL force simulation. Constraints: 500-node
streaming window (R7.6 default), 30fps floor, and the
IncrementalLayout module already implements lock-and-minimal-movement
for small deltas, which is most of stable mode.

Resolution criteria: bench d3-force-with-decay against the
IncrementalLayout extension on a 500-node window with the M9 mock
stream (50 nodes over 10 seconds, planning/m9-evaluation.md EC-1);
pick whichever holds 30fps with the smaller dependency surface; WebGL
custom simulation is out of scope unless both fail, consistent with
planning/large-graph-design.md's rejection of renderer replacement.
Decision recorded in specs/09; OQ4 closed; engineering/streaming.md
unblocked.

## Large-graph alignment

planning/large-graph-design.md adopted CollapseByCluster aggregation
plus worker layout with viewport culling. The working-set prompts
(R7.1's "Collapse by community?" suggestion) should route into that
same CollapseByCluster mechanism rather than a parallel one, and the
holarchy aggregation (OQ11) likewise. This file owns keeping the three
consumers pointed at one mechanism; divergence here is how toolkits
grow three half-implementations of grouping.

## Exit

OQ4 and OQ7 closed with committed evidence; D7 accepted; limit
defaults re-asserted in working-set-manager tests at their validated
values (which verification/view-acceptance.md then inherits).
