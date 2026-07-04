# Streaming

**Area:** engineering | **Milestone:** M9
**Owns:** R3.6 (proposed, SHOULD), R7.6 (proposed, SHOULD)
**Design gates:** OQ4 and D7 via
design/working-set-and-performance.md
**Exit criteria of record:** planning/m9-evaluation.md, E9.1

## Current state

Nothing streaming-specific exists. The honest inventory: UGM emits
seven granular mutation events (groundwork), IncrementalLayout handles
small-delta lock-and-place (most of D7's stable mode), and the
adapter types file carries a "planned" note where the StreamAdapter
interface will go. The first status sweep briefly credited R3.6 off
that note; the phantom guard now prevents that, and this file is the
plan that earns the status honestly.

## Work breakdown (priority order)

1. **P1: StreamAdapter interface (R3.6 first clause).** Delta
   contract (`GraphDelta`: addedNodes/addedEdges/removed/updated)
   emitted in batches; transport-agnostic with Kafka, WebSocket, and
   SSE bindings as thin wrappers. The UGM applies deltas through its
   existing mutation API so every view that subscribes to UGM events
   updates without reload (R3.6 second clause comes free if this
   holds; test it explicitly anyway).
2. **P1: Streaming working-set window (R7.6).** 500-node sliding
   window in WorkingSetManager: age-out by arrival order, pin
   exemption, window size configurable per R7.7's admin-override
   rules. This is data-layer logic; no design gate.
3. **P1 (gated on OQ4/D7): Streaming layout controller.** Stable mode
   (freeze layout, animate arrivals into place via IncrementalLayout)
   and live mode (the OQ4-selected incremental algorithm), with the
   user toggle D7 specifies.
4. **P2: Mock stream fixture + demo.** The M9 evaluation's 50-nodes-
   over-10-seconds mock as a committed fixture, wired into a demo
   shell; doubles as the OQ4 benchmark harness input.

## Exit

R3.6 and R7.6 advance to implemented with colocated tests restating
their acceptance criteria (Kafka-topic edges appear within the refresh
interval; window holds at 500 with pins exempt); E9.1's EC-1 and EC-2
pass per planning/m9-evaluation.md.
