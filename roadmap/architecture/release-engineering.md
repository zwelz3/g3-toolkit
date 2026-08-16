# Release Engineering

**Area:** architecture
**Owns:** no spec requirements (platform debt with release-claim
impact; sourced from the audit remediation's known limitations and
queued work)

## Items (priority order)

1. **RESOLVED 2026-08-16: published ESM only.** `require("@g3t/*")`
   from a TS `.cts` raised TS1479 because each entry shipped one
   ESM-flavored `.d.ts`. The fix considered here was paired
   `.d.ts`/`.d.cts` emission via api-extractor or vite-plugin-dts.
   That branch was REJECTED: it doubles declaration emit and needs a
   drift gate, and it fixes the compile error while making the real
   problem worse. TS1479 was the only thing preventing a TypeScript
   consumer from mixing formats and duplicating the exported zustand
   store singletons, which is an undebuggable selection failure rather
   than a build error. Dropping the `require` condition and the cjs
   format removes the hazard at its source and 44% of emitted runtime
   JS with it. Cost accepted: Node `require` consumers move to
   `import`, and Jest-in-CJS needs transform config. Guarded by an
   ESM-only assertion in `tests/dist/public-api.test.ts`.
2. **P1: Playwright screenshot baselines.** The CI e2e job gates
   functional assertions with --ignore-snapshots because no Linux
   baselines are committed. Bootstrap per the inline ci.yml
   instructions (--update-snapshots on ubuntu, commit
   tests/e2e/__screenshots__/, remove the flag). Until then, visual
   regression is unguarded.
3. **P1: Templatize STATUS.md numbers.** (Retargeted round 31:
   planning/status.md was archived to planning/milestone-history.md;
   the live numbers now sit in STATUS.md and the roadmap/CLAUDE.md
   index header.) Test counts, the requirement rollup, and the
   ownership-index header are hand-maintained snapshots; audits and
   the round-31 consolidation have now caught them drifting FOUR
   ways (the latest: user stories conflated into the proposed
   count). Generate from scripts/workspace-stats.mjs and the
   spec-status counts that scripts/sync_spec_status.py already
   computes; hand-written prose stays, numbers do not.
4. **P2: Demo overhaul Phase 4 (polish).** Per
   planning/demo-overhaul-spec.md; Phases 1-3 shipped (7 scenario
   cards, 5 custom shells).
5. **P2: Declaration maps in published tarballs.** dist .d.ts.map
   files reference src/ paths excluded from the tarball, so go-to-
   definition dead-ends for consumers. Either ship src in `files` or
   drop declarationMap for publish builds.

## Exit

Item 1 closes when verify:types passes a node16 CJS consumer and the
CHANGELOG known-limitation entry is removed. Items 2-3 close when the
respective gates run un-flagged in CI and status.md carries a
generated-on stamp. No spec statuses change from this file.
