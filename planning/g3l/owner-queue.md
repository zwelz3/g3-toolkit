# Owner queue

One entry per item that is blocked on the owner. Each entry states
WHAT is being asked, exactly WHAT TO DO, and WHAT IT UNBLOCKS.
Maintained every round; items leave this file when resolved (their
history stays in the MR log).

Resolved 2026-07-18: MR-4 (owner: approved for non-IP concerns; references removed), react budget (raised to 440, ledgered), WS-D (approved; decisions recorded in the design doc).

Resolved 2026-07-18 (second batch): CI verdict returned (perf job
GREEN: PRF-001 = 159 ms vs 300, 47% margin; e2e 57/58); core 196
RATIFIED; D3b pre-authorized in full (remove elkjs; no external
imports; rebase authority granted). The e2e failure (zero overlay
paths: the straightened-chains contract gap) is FIXED in round 39.

Resolved earlier: see MR log.

## 1. Re-run e2e on the ROUND-40 tree (round 39 was insufficient)

WHAT: Round 39 fixed the converter gate but missed a second root
cause: containers are cy compounds with no drawn position, so the
projection-center lookup failed for every container-attached edge.
Round 40 falls back to geometry-box centers; headless replication
of the exact failing pipeline now yields 5/5 routed edges (was
0/5). Straight talk: round 39's pin used plain nodes and passed
while the browser failed; the pin now uses containers.

WHAT TO DO: Push round 40, re-run e2e locally and in CI. Expect
58/58.

UNBLOCKS: Item 2.

## 2. Browser session: flip ratification + MR-11 round 4 + the parity list

WHAT: Unchanged checklist, on round 40. You mentioned several
rendering-parity issues across the Style Lab and MBSE: bring the
list (screenshots where cheap); each gets a root cause and a
disposition, same as every prior MR-11 finding.

UNBLOCKS: MR-11; D3b proceeds on ratification.

## 3. Scale surface: paste the instrumented switch numbers

WHAT: The scale example runs the UGM/fcose pipeline, NOT
layoutStructural: WS-D never touched its switch path (perspective
in the round-40 conversation). The surface already logs
"[scale] <view> ready in Nms" to the browser console on every
switch: the measurement protocol recorded in the file itself.

WHAT TO DO: Open the scale example, switch clusters -> drill ->
back a few times, paste the console lines. With numbers, the fix
is chosen from: (a) route the surface through the g3t engine with
preset positions (layout collapses to ms and becomes cache-hit on
revisits; aesthetics change from organic to layered: judgment
call), (b) fcose position caching (organic look kept, near-instant
revisits), (c) keep-alive instances across switches (kills
re-ingestion), (d) the WebGL cluster (P2, the real scale
renderer). Not exclusive; (b)+(c) is the conservative pair.

UNBLOCKS: A measured scale round instead of another theory.

---

If an ask here is unclear, say which number; the entry gets
rewritten, not defended.
