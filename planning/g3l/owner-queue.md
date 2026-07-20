# Owner queue

One entry per item that is blocked on the owner. Each entry states
WHAT is being asked, exactly WHAT TO DO, and WHAT IT UNBLOCKS.
Maintained every round; items leave this file when resolved (their
history stays in the MR log).

Resolved 2026-07-18: MR-4 (owner: approved for non-IP concerns; references removed), react budget (raised to 440, ledgered), WS-D (approved; decisions recorded in the design doc).

Resolved 2026-07-20 (sixth batch): round-47 e2e triaged (3
failures: one round-45 expectation miss of mine, two smoke-spec
guesses; all fixed). Scale smoke GREEN in production.

Resolved 2026-07-19 (fifth batch): scale freeze RULED dev-only
(production clean; our DevTools-amplification sub-claim was wrong
and is corrected). The toolbar-in-preview finding produced the
round-47 systemic fix: e2e now tests the production bundle.

Resolved 2026-07-20 (sixth batch): round-47 e2e triaged (3
failures: one round-45 expectation miss of mine, two smoke-spec
guesses; all fixed). Scale smoke GREEN in production.

Resolved 2026-07-19 (fifth batch): scale experiments returned:
PRODUCTION CLEAN, dev lags with DevTools closed: verdict closed as
dev-build-only (React dev instrumentation), recorded in the
surface.

Resolved 2026-07-19 (fourth batch): flip ratified in substance
("parity is achieved"); MR-11 round 4 closed; D3b part 1 EXECUTED
(elkjs removed). The scale freeze is NAMED from the owner's
profile paste (React dev-build prop serialization).

Resolved 2026-07-18 (third batch): e2e 58/58 local + CI (the
drag/routing arc: rounds 39-43, closed).

Resolved 2026-07-18 (second batch): CI verdict returned (perf job
GREEN: PRF-001 = 159 ms vs 300, 47% margin; e2e 57/58); core 196
RATIFIED; D3b pre-authorized in full (remove elkjs; no external
imports; rebase authority granted). The e2e failure (zero overlay
paths: the straightened-chains contract gap) is FIXED in round 39.

Resolved earlier: see MR log.

## 1. Re-run e2e on round 48 (expect 66/66), using the new digest

WHAT TO DO: Usual routine, then `pnpm run e2e:failures` and upload
test-results-failures.json instead of the full report (validated
on your round-47 file: megabytes -> ~3 KB). On green it writes an
all-green stub: nothing to upload.

## 2. The toolbar symptom, if it persists

WHAT: On round 47, Scale's smoke test passed (toolbar mounts
console-clean in production) and the switcher lists all four
engines. If what you saw was the engine option renamed
(Hierarchical (ELK) -> Layered (g3t)): that is the round-45
removal, working as ruled. If something else is broken, describe
the symptom (which example, which control, what happens vs
expected) and it gets a round.

## 3. Finish the cut-off question ("Ok, so should we add the...")

Still standing from two messages ago.

---

D3b part 2 (extraction) proceeds once item 2 is dispositioned.

If an ask here is unclear, say which number; the entry gets
rewritten, not defended.
