#!/usr/bin/env node
/**
 * Release gate: everything that must be true before the FIRST of three
 * publishes runs, checked while a failure is still free.
 *
 * npm publishes are not transactional and a published version can
 * never be replaced. Three sequential publishes therefore have two
 * failure windows, and a failure in either leaves a partially
 * published version triple that cannot be repaired in place: the only
 * way out is a version bump. The mitigation is not a rollback, which
 * does not exist. It is to move every check that CAN fail in front of
 * the first publish, so the window between publish one and publish
 * three contains nothing but network calls.
 *
 * Checks:
 *
 * 1. The tag and all four manifests agree on the version. A tag of
 *    `v1.0.1` against manifests reading `1.0.0` publishes 1.0.0 a
 *    second time, which npm rejects on the FIRST package, or worse
 *    succeeds because 1.0.0 was never published and now the tag lies.
 * 2. Every publishable manifest carries the same version as the root.
 *    They are published as a set and their `workspace:*` ranges are
 *    rewritten to each other at publish time.
 * 3. No package@version already exists on the registry. This is the
 *    check that turns a mid-run failure into a pre-run failure: if a
 *    previous attempt got two of three out, this fails before the
 *    first publish instead of after it.
 * 4. The working tree is clean. `pnpm publish --no-git-checks` is
 *    required in CI because a tag build is a detached HEAD, and pnpm's
 *    own branch check cannot pass there. Bypassing pnpm's checks means
 *    owning them: this is the replacement, and it is stricter, because
 *    it also covers the registry and the version agreement that pnpm
 *    never looked at.
 *
 * Run from the repo root. Set SKIP_REGISTRY=1 to run checks 1, 2 and 4
 * offline (check 3 needs the network).
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const PUBLISHABLE = ["core", "react", "charts"];

const failures = [];
const notes = [];

function readManifest(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const rootPkg = readManifest(join(root, "package.json"));
const version = rootPkg.version;

// 1. Tag agreement. GITHUB_REF is `refs/tags/v1.2.3` on a tag build.
// Outside CI there is no tag to check, which is not a failure: this
// script is also useful as a local pre-flight.
const ref = process.env.GITHUB_REF ?? "";
const tagMatch = /^refs\/tags\/v?(.+)$/.exec(ref);
if (tagMatch) {
  const tagVersion = tagMatch[1];
  if (tagVersion !== version) {
    failures.push(
      `tag v${tagVersion} does not match the root manifest version ${version}. ` +
        `Publishing would ship ${version} under a tag that names ${tagVersion}.`,
    );
  } else {
    notes.push(`tag v${tagVersion} matches the root manifest`);
  }
} else {
  notes.push("no tag in GITHUB_REF, skipping the tag-agreement check");
}

// 2. All four manifests agree.
const targets = [];
for (const dir of PUBLISHABLE) {
  const path = join(root, "packages", dir, "package.json");
  if (!existsSync(path)) {
    failures.push(`packages/${dir}/package.json does not exist`);
    continue;
  }
  const pkg = readManifest(path);
  if (pkg.version !== version) {
    failures.push(
      `${pkg.name} is at ${pkg.version} but the root manifest is at ${version}. ` +
        `The three packages are published as a set and cross-depend by version.`,
    );
  }
  targets.push({ name: pkg.name, version: pkg.version });
}
if (targets.length === PUBLISHABLE.length) {
  notes.push(`${targets.length} manifests at ${version}`);
}

// 3. Nothing is already on the registry.
if (process.env.SKIP_REGISTRY === "1") {
  notes.push("SKIP_REGISTRY=1, registry check skipped");
} else {
  for (const { name, version: v } of targets) {
    let published;
    try {
      published = execFileSync("npm", ["view", `${name}@${v}`, "version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch (err) {
      // `npm view` exits non-zero for an unpublished version, which is
      // the outcome we want. Distinguish that from a network or auth
      // failure, which must NOT read as "safe to publish".
      const stderr = String(err.stderr ?? "");
      if (/E404|is not in this registry|No match/i.test(stderr)) continue;
      failures.push(
        `could not determine whether ${name}@${v} is already published: ` +
          `${stderr.trim() || err.message}. Treating this as a failure on ` +
          `purpose; an unanswered registry is not an answer.`,
      );
      continue;
    }
    if (published) {
      failures.push(
        `${name}@${v} is ALREADY published. npm does not allow republishing a ` +
          `version, so this release cannot complete as specified. Bump the ` +
          `version across all four manifests and re-tag.`,
      );
    }
  }
  if (targets.length > 0) notes.push("registry checked for all three packages");
}

// 4. Clean working tree.
try {
  const status = execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim();
  if (status) {
    failures.push(
      `the working tree is dirty, so the tarball would not match the tagged ` +
        `commit:\n${status}`,
    );
  } else {
    notes.push("working tree clean");
  }
} catch (err) {
  failures.push(`could not run git status: ${err.message}`);
}

if (failures.length > 0) {
  console.error("Release preflight FAILED:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Release preflight: ${notes.join("; ")}.`);
