# PRF-001 measurement (sharpened 2026-07-12)

Owner-approved plan: harden the "~40x over target" round-24 finding
before the WS-D design doc is built on it. Matrix source:
tests/perf/prf001-matrix.perf.test.ts (G3T_PERF_MATRIX=1). Numbers
below are from the build container (NOT the ruled CI baseline;
re-run the matrix in CI for the ruling numbers; the RATIOS are the
transferable signal).

## Results (R1 fixture: 500 nodes / 800 edges / 120 compartment containers)

| Measurement | ms | Notes |
| --- | --- | --- |
| cold-default | 16,427 | first layout in process, elkjs init included |
| warm-default | 12,632 | median of 3 fresh-input runs |
| assembly-only | 4.3 | buildStructuralElkGraph (our code) |
| warm-polyline | 12,418 | edgeRouting: POLYLINE |
| warm-place-simple | 14,045 | nodePlacement: SIMPLE |
| warm-place-linear | 18,522 | nodePlacement: LINEAR_SEGMENTS |
| warm-cross-interactive | 3,605 | crossingMinimization: INTERACTIVE |
| warm-cheap-combo | 2,204 | POLYLINE + SIMPLE + INTERACTIVE |

## Interpretation

1. **The caveats resolve against elkjs.** Warm cost is 12.6 s, so
   initialization explains only ~3.8 s of the cold number; the
   finding was not a cold-start artifact. Assembly is 4.3 ms: the
   cost is 99.97% inside elk.layout, not our pipeline.
2. **Crossing minimization dominates.** LAYER_SWEEP accounts for
   roughly 9 of the 12.6 warm seconds (the INTERACTIVE variant, which
   skips real minimization, runs 3.5x faster). Edge routing and node
   placement are immaterial by comparison.
3. **Even maximally detuned, elkjs misses the target.** The cheap
   combo (accepting unminimized crossings) is 2.2 s on this
   container; grant CI a generous 3x and it lands ~2.5x over the
   300 ms budget WITH degraded quality. The default-quality path is
   an order of magnitude over on any plausible machine.
4. **Sketch-mode re-layouts are already in the fast class.** Sketch
   runs switch the layered strategies to INTERACTIVE, so same-graph
   re-layouts cost ~3.6 s-class, not 12.6 s-class, on this fixture.
   LAY-020's local mode avoids the global pass entirely for local
   changes, which is why it precedes the WS-D build.

## Consequence for WS-D

The design doc's performance case is now specific: the in-house
layered engine wins or loses PRF-001 primarily on its crossing-
minimization strategy (cheap barycenter/median sweeps with early
exit, incrementality across frames, and worker placement), not on
routing or placement. Budget attention accordingly.
