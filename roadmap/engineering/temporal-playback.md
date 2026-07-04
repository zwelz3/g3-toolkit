# Temporal Playback

**Area:** engineering
**Owns:** R2.10 (in-progress, SHOULD; capped: timeline renders,
playback animation absent)

## Current state

TimelineView renders events on the time axis (vis-timeline) and
TemporalRangeFilter/TemporalSlider exist, including play/pause/speed
controls in the slider component. What is missing is the playback
semantics the requirement actually specifies: animating graph
evolution so canvas elements appear and disappear according to time
validity as the clock advances, both in the Timeline view and as a
canvas mode.

## Work breakdown (priority order)

1. **P2: Playback clock.** A controller advancing a time cursor at
   1x/2x/4x against the temporal extent of the loaded UGM, driving
   the existing slider UI; pause/scrub already have UI affordances.
2. **P2: Time-validity filtering on the canvas.** Elements with
   `temporal_start`/`temporal_end` (Qualified Edge metadata and node
   properties) toggle visibility as the cursor passes; reuse the
   ViewFilter mechanism rather than direct Cytoscape manipulation so
   the table and charts stay consistent during playback.
3. **P2: Acceptance fixture.** A 30-day temporal graph fixture; the
   spec acceptance (elements appear/disappear per validity at 1x)
   runs against it.

## Exit

R2.10 advances to implemented with the colocated acceptance test
green and the sync_spec_status.py cap removed in the same PR.
