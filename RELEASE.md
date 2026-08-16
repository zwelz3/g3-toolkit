# Releasing g3-toolkit

## What the tag does

`.github/workflows/publish.yml` fires on `v*` tags. It installs
frozen, runs the FULL `pnpm run gates` (typecheck, lint, verify, test,
and the three Python spec gates), runs the release preflight, then
publishes in peer-dependency order (core, react, charts) with npm
provenance. `pnpm --filter ... publish` rewrites `workspace:*` ranges
to real versions, so nothing needs hand-editing before the tag.

## Rehearse it first

The release path is only correct if it has been run. Trigger
`Publish Packages` from the Actions tab with `dry_run` left on: every
step executes, including all three publishes, against `--dry-run`. A
manual dispatch with `dry_run` turned OFF fails immediately by design,
so the rehearsal cannot become an accidental release. Do this before
the first tag of any version.

## Why a publish cannot be rolled back, and what stands in for one

npm has no transactions and does not allow republishing a version.
Three sequential publishes therefore have two windows in which a
failure leaves a partial version triple: `@g3t/core` out at 1.2.3,
`@g3t/react` not, and no way to complete the set under that number.
The only repair is to bump all four manifests and re-tag.

There is no rollback to add, so the mitigation is to move every check
that CAN fail in front of the first publish. That is
`scripts/check-release-preflight.mjs`, which asserts the tag and all
four manifests name the same version, that none of the three
`package@version` pairs already exists on the registry, and that the
working tree is clean. The registry check is the one that matters
most: after a partial publish it fails BEFORE the first publish
instead of after it.

Each package's `prepack` runs `scripts/check-dist-fresh.mjs`, which
refuses to build a tarball whose `dist` is missing a file the manifest
promises, or is older than `src`. That closes the hollow-tarball case,
including for a publish run by hand from a laptop.

`--no-git-checks` stays on the publish commands, and is not a bypass:
a tag build is a detached HEAD, where pnpm's branch check cannot pass
on any input. The preflight is its replacement and is stricter, since
it also covers version agreement and registry state, which pnpm never
checked.

## Before tagging

1. Versions agree. Root and all three packages carry the release
   version; `pnpm install --lockfile-only` has been run so the
   lockfile matches. The README title states the same version.
2. `pnpm run gates` is green: typecheck, lint, verify, test, and
   the spec gates. `verify` includes `verify:package` (every entry
   point in every package's exports map exists after a build, and
   files[] claims nothing absent), `verify:types` (consumer type
   resolution under node16 AND bundler), `verify:consumer-cost` (what
   an adopter's bundle grows by per import, as distinct from
   `verify:bundle`, which budgets the package's publish weight),
   `verify:archive` (ARCHIVE.md's per-symbol status still matches the
   published surface), `verify:smoke` (runtime
   subpath resolution through Node), `verify:peers` (no optional
   peer is statically reachable from an entry point that is not
   documented as requiring it), and `verify:snippets` (every README
   code block typechecks as written).
3. `NPM_TOKEN` is present in repository secrets.
4. CHANGELOG has an entry for the version.
5. `node scripts/check-release-preflight.mjs` is green locally. It is
   the same script the workflow runs, so a failure here is a failure
   you get to fix for free. Outside CI it skips only the tag check,
   since there is no tag yet.
6. The dry run described above has been executed on this commit.

## After tagging

Verify the published artifact from outside the monorepo rather
than trusting the build:

```bash
mkdir /tmp/g3t-consumer && cd /tmp/g3t-consumer
pnpm init && pnpm add @g3t/core @g3t/react react react-dom \
  cytoscape cytoscape-fcose zustand graphology echarts
```

That list is the REQUIRED peer set and nothing more. `echarts` is on
it because the stats view is reachable from the root barrel; a recipe
that omits a required peer fails on its first import, which is
exactly the class of break this step exists to catch. Do NOT add
`vis-timeline` or `vis-data` here: they are optional peers, and the
point of the check is that the documented install resolves without
them.

Then confirm, in a scratch file:

- `import "@g3t/react/style.css"` compiles and the tokens land on
  `:root` (the canvas warns in dev when they do not).
- `import { CytoscapeCanvas } from "@g3t/react"` resolves with
  types under the consumer's own `moduleResolution`.
- Every other subpath resolves too: `@g3t/react/views`, `/controls`,
  `/state`, `/theme`, `/a11y`, `/icons`. None of them may need an
  optional peer.
- `import { TimelineView } from "@g3t/react/timeline"` fails with
  `ERR_MODULE_NOT_FOUND` for `vis-timeline`, then succeeds after
  `pnpm add vis-timeline vis-data`. Both directions matter: the
  first proves the optional peers are still isolated, the second
  proves the subpath is not merely unreachable.

`verify:peers` checks the same property against the emitted import
graph on every build, so this step is a confirmation rather than the
primary defense.

## Version policy

Semantic versioning applies to exported components, props, and
core types from 1.0.0. Explicitly outside it: exact layout pixel
positions, route shape beyond the invariants documented in
docs/structural-patterns.md, and anything reached by deep import
past the exports map. Deprecations ship warning-first and are
removed no earlier than the next major; the current deprecation
is `CytoscapeCanvas`'s `structural` prop.
