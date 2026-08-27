#!/usr/bin/env node
/**
 * Gate: every version-bearing file in the repository agrees with the
 * root manifest.
 *
 * The root `package.json` version is the source of truth. Four
 * manifests carry it because they are published as a set; two more
 * files carry it because they describe the project to humans, and
 * those two are the reason this script exists.
 *
 * Before v1.0.0, `pixi.toml` had drifted to `1.0.0-rc.2` and
 * `docs/source/conf.py` to `0.1.0` / `0.8.5`, which is not only three
 * minors behind but internally inconsistent: `version` and `release`
 * did not agree with each other, so the rendered docs would have
 * carried a version string nobody chose. Both were corrected by hand
 * during release prep and RELEASE.md step 1 now names them, but a
 * sentence in a checklist is the control that had already failed. The
 * 1.0.0 postmortem carried this forward as still-ungated drift.
 *
 * Three properties, in the order they matter:
 *
 * 1. NO VACUOUS PASS. A registered file whose version field cannot be
 *    located is a FAILURE, not a skip. A gate that quietly stops
 *    checking is worse than no gate, because it also displaces the
 *    human check that would otherwise still be happening. Prettier and
 *    editors reflow anchors; this repository has been bitten by silent
 *    no-ops enough times that the rule is written into CLAUDE.md.
 * 2. NO UNREGISTERED VERSION-BEARING FILE. The registry below is
 *    hand-maintained, so it can go stale exactly the way the values
 *    did. The sweep at the end reads the tracked file list and fails on
 *    any candidate carrying a version-looking assignment that is not
 *    registered here. That is what keeps a future `CITATION.cff` or
 *    second pixi environment from joining the set unnoticed.
 * 3. RUN CONTINUOUSLY, NOT ONLY AT RELEASE. This runs first in
 *    `verify` (it needs no build, so it fails in milliseconds rather
 *    than after fifteen build-dependent steps) and again from
 *    `check-release-preflight.mjs`, which keeps the release path
 *    self-contained rather than dependent on `verify` having been run.
 *
 * Usage:
 *   node scripts/check-version-sync.mjs            # check, exit 1 on drift
 *   node scripts/check-version-sync.mjs --write    # rewrite targets to
 *                                                  # the root version
 *
 * `--write` covers every target EXCEPT the root manifest, which is the
 * source: bump that by hand, run this with `--write`, then
 * `pnpm install --lockfile-only`. The manual step that introduced the
 * drift is the one being removed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Files that carry the project version, and how to read and rewrite the
 * field in each. `publishable` marks the three manifests the release
 * preflight also needs by name.
 *
 * Adding a file here is the fix when the sweep flags one. Do not add a
 * file to SWEEP_EXEMPT instead unless the version it carries genuinely
 * is not the project's (a fixture, a vendored third-party config).
 */
const TARGETS = [
  { file: "package.json", field: "version", kind: "json", source: true },
  {
    file: "packages/core/package.json",
    field: "version",
    kind: "json",
    publishable: true,
  },
  {
    file: "packages/react/package.json",
    field: "version",
    kind: "json",
    publishable: true,
  },
  {
    file: "packages/charts/package.json",
    field: "version",
    kind: "json",
    publishable: true,
  },
  // pixi is the Python-side entry point and the first file a
  // contributor arriving through the docs toolchain reads.
  { file: "pixi.toml", field: "version", kind: "toml", section: "project" },
  // Sphinx renders `release` into the page furniture of a public
  // artifact. Both fields are checked; they had disagreed.
  { file: "docs/source/conf.py", field: "version", kind: "python" },
  { file: "docs/source/conf.py", field: "release", kind: "python" },
];

/**
 * Kinds of tracked file that could plausibly carry a project version
 * outside the manifests. Deliberately narrow: this is a staleness guard
 * on TARGETS, not a general-purpose scanner, and a noisy sweep would be
 * turned off within a round.
 */
const SWEEP_PATTERNS = [
  /\.toml$/,
  /\.cff$/,
  /(?:^|\/)conf\.py$/,
  /(?:^|\/)\.zenodo\.json$/,
];

/** Candidate files whose version assignment is not the project's. */
const SWEEP_EXEMPT = new Set();

const SWEEP_ASSIGNMENT =
  /^[ \t]*(?:__)?(version|release)(?:__)?[ \t]*[=:][ \t]*["']?v?\d+\.\d+\.\d+/m;

function readTarget(root, target) {
  const abs = join(root, target.file);
  if (!existsSync(abs)) {
    return { error: `${target.file} does not exist` };
  }
  const text = readFileSync(abs, "utf8");
  const match = matcherFor(target).exec(text);
  if (!match) {
    return {
      error:
        `${target.file}: could not locate the \`${target.field}\` field. ` +
        `The file's shape changed; the extractor in ` +
        `scripts/check-version-sync.mjs needs updating. Failing rather ` +
        `than skipping: a check that silently stops checking also ` +
        `removes the human check it replaced.`,
    };
  }
  return { text, match, found: match[2] };
}

/**
 * Every matcher captures the assignment in three groups: prefix, value,
 * suffix. `--write` splices group 2, so a rewrite cannot reformat the
 * surrounding line.
 */
function matcherFor(target) {
  switch (target.kind) {
    case "json":
      // Two-space indent pins this to a top-level key under the
      // repository's prettier config, so a nested `"version"` inside
      // dependencies cannot be matched first.
      return new RegExp(`(^  "${target.field}": ")([^"]*)(")`, "m");
    case "toml":
      // Scoped to `target.section`: the table header is consumed, and
      // `(?!^\[)` stops the scan at the next one. Without that, deleting
      // `[project].version` would silently start matching a `version`
      // key in some later table instead of failing.
      return new RegExp(
        `(\\[${target.section}\\]\\n(?:(?!^\\[)[\\s\\S])*?^${target.field}[ \\t]*=[ \\t]*")([^"]*)(")`,
        "m",
      );
    case "python":
      return new RegExp(
        `(^${target.field}[ \\t]*=[ \\t]*["'])([^"']*)(["'])`,
        "m",
      );
    default:
      throw new Error(`unknown target kind: ${target.kind}`);
  }
}

/**
 * Check every registered target against the root manifest version.
 *
 * Returns `{ version, publishable, failures, notes }`. The caller
 * decides what to do with failures; `check-release-preflight.mjs`
 * merges them into its own list so a release reports every problem at
 * once rather than one per run.
 */
export function checkVersionSync({ root = scriptRoot } = {}) {
  const failures = [];
  const notes = [];
  const publishable = [];

  const source = TARGETS.find((t) => t.source);
  const rootRead = readTarget(root, source);
  if (rootRead.error) {
    return { version: null, publishable, failures: [rootRead.error], notes };
  }
  const version = JSON.parse(
    readFileSync(join(root, source.file), "utf8"),
  ).version;
  if (typeof version !== "string" || !SEMVER.test(version)) {
    failures.push(
      `the root manifest version is ${JSON.stringify(version)}, which is not ` +
        `a semantic version. Every other file is derived from it, so a typo ` +
        `here propagates rather than failing.`,
    );
    return { version, publishable, failures, notes };
  }

  for (const target of TARGETS) {
    if (target.source) continue;
    const read = readTarget(root, target);
    if (read.error) {
      failures.push(read.error);
      continue;
    }
    if (read.found !== version) {
      failures.push(
        `${target.file}: \`${target.field}\` is ${read.found} but the root ` +
          `manifest is at ${version}.`,
      );
    }
    if (target.publishable) {
      const pkg = JSON.parse(readFileSync(join(root, target.file), "utf8"));
      publishable.push({
        name: pkg.name,
        version: pkg.version,
        file: target.file,
      });
    }
  }

  if (failures.length === 0) {
    notes.push(
      `${TARGETS.length} version fields across ` +
        `${new Set(TARGETS.map((t) => t.file)).size} files at ${version}`,
    );
  }

  failures.push(...sweep(root));
  return { version, publishable, failures, notes };
}

/**
 * Staleness guard on TARGETS: any tracked candidate file that carries a
 * version-looking assignment and is not registered above is a failure.
 * Without this, the registry rots exactly the way the values it guards
 * already did once.
 */
function sweep(root) {
  const registered = new Set(TARGETS.map((t) => t.file));
  let tracked;
  try {
    tracked = execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean);
  } catch (err) {
    return [
      `could not list tracked files to sweep for unregistered version ` +
        `strings: ${err.message}. Treating this as a failure on purpose; an ` +
        `unrun sweep is not a clean sweep.`,
    ];
  }

  const found = [];
  for (const file of tracked) {
    if (registered.has(file) || SWEEP_EXEMPT.has(file)) continue;
    if (!SWEEP_PATTERNS.some((p) => p.test(file))) continue;
    const abs = join(root, file);
    if (!existsSync(abs)) continue; // tracked but deleted in the worktree
    if (SWEEP_ASSIGNMENT.test(readFileSync(abs, "utf8"))) {
      found.push(
        `${file} carries a version assignment but is not registered in ` +
          `scripts/check-version-sync.mjs, so nothing keeps it in step with ` +
          `the root manifest. Add it to TARGETS (or to SWEEP_EXEMPT if the ` +
          `version it carries is not the project's), and to RELEASE.md if a ` +
          `human has to touch it.`,
      );
    }
  }
  return found;
}

/** Rewrite every non-source target to the root manifest version. */
function write(root) {
  const version = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ).version;
  const changed = [];
  for (const target of TARGETS) {
    if (target.source) continue;
    const read = readTarget(root, target);
    if (read.error) {
      console.error(`Version sync --write FAILED:\n  ✗ ${read.error}`);
      process.exit(1);
    }
    if (read.found === version) continue;
    const [whole, prefix, , suffix] = read.match;
    const next =
      read.text.slice(0, read.match.index) +
      `${prefix}${version}${suffix}` +
      read.text.slice(read.match.index + whole.length);
    writeFileSync(join(root, target.file), next);
    changed.push(`${target.file}:${target.field} ${read.found} -> ${version}`);
  }
  if (changed.length === 0) {
    console.log(`Version sync: already at ${version}, nothing to write.`);
    return;
  }
  for (const line of changed) console.log(`  ${line}`);
  console.log(
    `Version sync: ${changed.length} field(s) written to ${version}. ` +
      `Run \`pnpm install --lockfile-only\` so the lockfile agrees.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--write")) {
    write(scriptRoot);
    process.exit(0);
  }
  const { failures, notes } = checkVersionSync();
  if (failures.length > 0) {
    console.error("Version sync FAILED:");
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error(
      "  Fix: bump the root package.json, then " +
        "`node scripts/check-version-sync.mjs --write`.",
    );
    process.exit(1);
  }
  console.log(`Version sync: ${notes.join("; ")}; sweep found nothing loose.`);
}
