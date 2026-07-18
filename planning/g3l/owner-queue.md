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

## 1. Re-run e2e on the round-39 tree (the one failing spec)

WHAT: The zero-overlay-paths bug is fixed (2-point g3t routes now
earn the routed class; converter-level regression pin added). One
spec should flip red -> green; expect 58/58.

WHAT TO DO: Usual routine on the round-39 tree; upload the JSON.
CI e2e should also go green on the same push.

UNBLOCKS: Item 2.

## 2. Browser session: ratify the flip + MR-11 round 4

WHAT/WHAT TO DO: unchanged from the previous entry (the full
checklist stands); now on the round-39 tree, where the MBSE overlay
draws edges again. Reply "flip ratified, MR-11 pass" or the list.

UNBLOCKS: MR-11 closes; D3b (elkjs removal + ARC-009 extraction,
already pre-authorized) proceeds on ratification.

---

If an ask here is unclear, say which number; the entry gets
rewritten, not defended.
