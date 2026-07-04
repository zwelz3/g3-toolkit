# Release Engineering

**Area:** architecture
**Owns:** no spec requirements (platform debt with release-claim
impact; sourced from the audit remediation's known limitations and
queued work)

## Items (priority order)

1. **P0: Typed CommonJS consumption.** `require("@g3t/*")` from a TS
   .cts file under node16 fails with TS1479: the packages emit one
   ESM-flavored .d.ts per entry. Runtime CJS works (verify:smoke);
   typing does not. Durable fix is per-entry declaration bundling
   emitting paired .d.ts/.d.cts (api-extractor or vite-plugin-dts
   rollup), which would also retire scripts/fix-dts-extensions.mjs.
   When fixed, extend scripts/verify-types.mjs with a CJS-mode
   consumer so the gate proves it. P0 because the packages claim dual
   ESM/CJS in their exports maps; until then the claim is half-true
   and documented as such in the CHANGELOG.
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
