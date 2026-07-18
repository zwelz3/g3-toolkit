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

## 1. Re-run e2e on the ROUND-43 tree

WHAT: Round 43 removes the drag path's last dependencies on real-cy
values (padded compound bbox endpoints and dimensions): the exact
class of browser-only divergence the failures kept exposing. The
e2e's choreography now runs headlessly against a HOSTILE cy fake
and passes only through the carried truth. Expect 58/58; the
screenshot's SmallSat-on-Payload overlap is the spec's own drop
position (legitimate), and its routes should now be clean around
it.

WHAT TO DO: Push round 43; e2e local + CI; failures: attach the
retry trace.zip (that workflow is working well).

UNBLOCKS: Item 2.

## 2. Browser session: flip ratification + MR-11 round 4 + the parity list

WHAT: Unchanged checklist. Watch specifically: edges orthogonal at
first paint AND during drags, endpoints ON the drawn borders (not
floating slightly off: that was the padded-bbox skew).

UNBLOCKS: MR-11; D3b on ratification.

## 3. Scale: one more paste (the watch now covers the freeze window)

WHAT: Your paste named the first-visit costs (drill extraction
~710 ms + fcose ~1145 ms) and clusters returns are fixed. The
freeze you hit AFTER settled was invisible because the longtask
watch disconnected at settled; it now runs 15 s past settlement
and logs "longtask-watch off (15s quiet)" when it retires.

WHAT TO DO: Reproduce the freeze; paste everything including any
longtask lines AFTER "settled(idle)" and whether the "watch off"
line appears before or after interactivity returns.

UNBLOCKS: The named fix for the post-settle freeze.

---

If an ask here is unclear, say which number; the entry gets
rewritten, not defended.
