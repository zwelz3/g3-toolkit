<!--
The PR process is in CONTRIBUTING.md. This template is the short form.
Delete any section that does not apply rather than writing "n/a".
-->

## What was wrong

<!-- The defect or the gap, not the diff. A reviewer who reads only
this should understand why the change exists. -->

## What this does about it

<!-- The approach, and any decision a reader would otherwise have to
reverse-engineer from the code. If you considered an alternative and
rejected it, one sentence on why saves the next person the trip. -->

## Verification

<!-- What you ran and what it said. If a gate is red for an
environmental reason, say which and why it is not the code. -->

- [ ] `pnpm run gates` is green. That trio of `pnpm test`,
      `pnpm typecheck` and `pnpm lint` is a strict subset of CI and
      skips `verify` and the spec gates, which is where build,
      export-map and documentation breakage shows up.
- [ ] New behavior has tests, and a failure mode was reproduced before
      the fix where that was possible.
- [ ] CHANGELOG.md has an entry under the current version's dated
      heading (the changelog has no `[Unreleased]` section).

## Surface and budget

<!-- Delete this whole section if the PR changes neither. -->

- [ ] Public exports changed: `api-surface.json` regenerated with
      `node scripts/check-api-surface.mjs --update` and the diff is
      reviewable as the record of what changed.
- [ ] Bundle budget raised: the ledger comment in
      `scripts/check-bundle-size.mjs` says why, in the same commit, and
      a sourcemap audit confirmed the growth is first-party.
