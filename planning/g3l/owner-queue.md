# Owner queue

One entry per item that is blocked on the owner. Each entry states
WHAT is being asked, exactly WHAT TO DO, and WHAT IT UNBLOCKS.
Maintained every round; items leave this file when resolved (their
history stays in the MR log).

Resolved 2026-07-18: MR-4 (owner: approved for non-IP concerns; references removed), react budget (raised to 440, ledgered), WS-D (approved; decisions recorded in the design doc).
Resolved 2026-07-12 (rulings executed, entries removed): T2
(ARCHIVE, done: see packages/core/ARCHIVE.md), MR-9 (CLOSED,
"largely stable"), MR-5 (RULED: CI baseline; remaining work is an
engineering harness, not an owner item).

---

## 1. WS-D design review: the in-house layered engine

**What:** the WS-D design doc is written
(planning/g3l/ws-d-design.md) against the sharpened PRF-001 numbers
and the spec's LAY-001..006 mandates. The build starts on your
approval; D1 (flat-graph skeleton + conformance harness) is the
first stage.
**What to do:** read the doc (ten minutes). The two decisions
explicitly left open for you: (a) does @g3t/route become its own
package or a module of @g3t/layout at extraction; (b) the
deprecation window for core re-exports (one minor version or two).
A plain "approved, (a) X, (b) Y" suffices; pushback on the crossing
budget cap or the phase budgets is equally welcome.
**Unblocks:** the WS-D build (D1).

## 2. MR-11 re-review: F1 SVG adapter after the background fix

**What:** your first look found the pane unreviewable on white; it
now inherits the dark shell exactly like the cy panes, with
dark-readable label ink.
**What to do:** open the Style Lab; compare the three panes (same
positions, same attributes). Check: decorations render only in pane
three (halo, pulse, glyphs, donut, taper, gradient); the LOD
dropdown drives panes two and three identically; the pulse animates
and respects your OS reduced-motion setting. Reply with a verdict
and any taste notes.
**Unblocks:** F1 continuation (structural views through the adapter)
with settled visual direction.

---

If an ask here is unclear, say which number; the entry gets
rewritten, not defended.
