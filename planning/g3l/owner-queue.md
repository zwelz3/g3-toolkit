# Owner queue

One entry per item that is blocked on the owner. Each entry states
WHAT is being asked, exactly WHAT TO DO, and WHAT IT UNBLOCKS.
Maintained every round; items leave this file when resolved (their
history stays in the MR log).

Resolved 2026-07-18: MR-4 (owner: approved for non-IP concerns; references removed), react budget (raised to 440, ledgered), WS-D (approved; decisions recorded in the design doc).

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

## 1. Scale: two ten-second experiments (confirm the named cause)

WHAT: Your profile named the freeze: getArrayKind /
addValueToProperties = React DEV-BUILD performance-track prop
serialization, scaling with MODEL size (clusters embeds all 8,000
memberships), which is why the smaller view froze longer.

WHAT TO DO: (a) reproduce the switch with DevTools CLOSED: is the
freeze gone or drastically shorter? (b) pnpm build && pnpm preview,
reproduce there (the profiling header is wired for preview too).
Reply with both observations. Prediction: production is clean and
the freeze is a dev-environment artifact; if (a)/(b) disagree with
that, the profile block from the preview run picks the next move.

UNBLOCKS: Either closure-with-a-recorded-caveat (dev-mode note in
the scale surface) or a targeted prop-shape fix.

## 2. The layout/routing quality list (post-flip rounds)

WHAT: You flagged "a large number of bugs in the layout algorithms
and routing" incoming. That is the expected post-flip work and the
engine is now the only one, so every fix lands where it stays.

WHAT TO DO: Send the list in any form (screenshots welcome); items
get root-caused and dispositioned individually, MR-style.

UNBLOCKS: The quality rounds.

## 3. Nothing else blocks engineering

D3b part 2 (ARC-009 extraction: @g3t/layout, vocabulary rename,
fresh measured budgets) is pre-authorized and proceeds next round
without owner input.

---

If an ask here is unclear, say which number; the entry gets
rewritten, not defended.
