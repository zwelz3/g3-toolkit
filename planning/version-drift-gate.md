# Version-drift gate (2026-08-27)

Closes postmortem item 3 of 4 from the 1.0.0 release: version drift in
files outside the four manifests was ungated.

## The gap

`pixi.toml` and `docs/source/conf.py` both carry the project version.
Both had drifted by the time v1.0.0 was tagged: `1.0.0-rc.2` in pixi,
and `0.1.0` / `0.8.5` in `conf.py`, where the two Sphinx fields did not
agree with each other either. They were corrected by hand in `63e3de0`
and RELEASE.md step 1 was updated to name them, which left the control
as a sentence in a checklist. That is the control that had already
failed once.

Nothing else in the repository reads a version string. The preflight
compares the four manifests only, and correctly so at the time: it was
scoped to the failure it could cause, a partial version triple on npm.
`verify`'s fifteen steps read exports, types, bundle weight and
snippets, never a version. `pixi.toml` is parsed by no script here, and
`conf.py` is executed only by Sphinx, which renders whatever it finds.

## Ruling: gate the whole set, not just the two files

The postmortem said "extending the preflight is the obvious next
hardening". Extending the preflight ALONE would have been the wrong
shape, for two reasons:

1. The preflight runs at tag time and on demand. Drift introduced in an
   ordinary PR would still sit undetected until the release, which is
   the moment with the least slack in it.
2. The two named files are a snapshot of the set, not the set. Nothing
   would stop a `CITATION.cff` or a second pixi environment from
   joining it, and nothing would notice RELEASE.md step 1 going stale
   alongside.

So: one script, `scripts/check-version-sync.mjs`, with the root
`package.json` as the source of truth, called from BOTH `verify` (first
step, before the build, because it needs no build) and the preflight
(which imports `checkVersionSync` rather than keeping its own manifest
loop). Two call sites, one definition of the file set. The preflight
still owns the three checks that are genuinely release-only: tag
agreement, registry state, clean tree.

## Design notes worth keeping

**Missing anchor is a failure, not a skip.** If a registered file
exists but its version field cannot be located, the gate goes red and
says the extractor needs updating. The alternative, skipping, turns
green on a file shape change and simultaneously removes the human check
that RELEASE.md used to require. This repository has paid for silent
no-ops repeatedly, which is why the rule is in CLAUDE.md.

**The registry gets its own staleness guard.** `TARGETS` is
hand-maintained, so it can rot exactly the way the values did. The
sweep reads `git ls-files`, filters to the kinds of file that could
plausibly carry a project version (`.toml`, `.cff`, `conf.py`,
`.zenodo.json`), and fails on any that carries a version assignment and
is not registered. `SWEEP_EXEMPT` exists for the case where the version
genuinely is not the project's, and is currently empty. An unrunnable
sweep (no git) is a failure, on the same reasoning the preflight uses
for an unanswered registry.

**Section-scoped TOML matching.** The `pixi.toml` matcher consumes the
`[project]` header and refuses to cross the next `[table]` boundary, so
a `version` key elsewhere in the file cannot be matched when the
registered one is absent. Without that, deleting `[project].version`
could silently start checking some other table's key.

**`--write` targets everything except the source.** Bump the root
manifest by hand, then `--write` propagates to the other six fields and
prints the `pnpm install --lockfile-only` reminder. The rewrite splices
the captured value between a captured prefix and suffix, so it cannot
reformat the line, and it exits non-zero if any anchor is missing
rather than writing a partial set.

## Verification

Gate self-tested red, per the CLAUDE.md doctrine that a quiet gate
should be disbelieved until it has been seen to fail:

| Injected fault | Result |
| --- | --- |
| `pixi.toml` version to `1.0.0-rc.2` | red, names file, field, found, expected |
| `conf.py` `release` to `0.8.5`, `version` left correct | red on `release` alone |
| `pixi.toml` version line deleted | red on the missing anchor, not green |
| unregistered tracked `CITATION.cff` with `version: 0.4.2` | red from the sweep |
| root bumped to 1.1.0, then `--write` | six fields rewritten, recheck green |

The preflight was run offline (`SKIP_REGISTRY=1`) with `pixi.toml`
drifted and reported the version failure alongside its own dirty-tree
failure, confirming the delegation reaches the release path.

## Not done here

- The lockfile is not gated. `--write` prints the
  `pnpm install --lockfile-only` reminder rather than running it,
  because the gate should not mutate the dependency graph.
- The sweep covers file KINDS, not all content. A version string
  embedded in prose (STATUS.md, a README) is out of scope by design;
  the README's version string was already removed in `efc7b1c` in
  favour of registry-reading badges, which is the better fix for prose.
- Postmortem items 1, 2 and 4 remain open: `--dry-run` never
  authenticates, the preflight's tag-agreement check is skipped on
  every `workflow_dispatch`, and scope availability should be checked
  at the start of packaging work.
