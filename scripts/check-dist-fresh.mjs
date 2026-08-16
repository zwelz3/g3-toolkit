#!/usr/bin/env node
/**
 * Pack-time guard: refuse to build a tarball whose dist is missing or
 * older than the source it claims to be built from.
 *
 * Wired as each publishable package's `prepack`, so it runs for
 * `pnpm pack` and `pnpm publish` alike, including a publish run by
 * hand from a laptop that never went near CI. Without it the failure
 * is silent and permanent: npm accepts a tarball with an empty or
 * stale `dist`, the version can never be republished, and the first
 * report comes from an adopter whose import resolves to nothing.
 *
 * Two checks, both cheap:
 *
 * 1. EVERY file the manifest promises exists. That means `main`,
 *    `module`, `types`, and every `types`/`import`/`require`/`default`
 *    target in the exports map. `verify:package` asserts the same
 *    thing, but only in the repo and only when someone runs the gate;
 *    this asserts it in the artifact, at the moment it is sealed.
 *
 * 2. No source file is newer than the newest emitted file. This is
 *    the stale-dist case: a build ran, then someone edited `src/`, and
 *    the tarball ships the previous build. mtime is a blunt instrument
 *    but it is the right blunt instrument here, because the failure it
 *    catches is precisely "you forgot to rebuild".
 *
 * Runs from the package directory (npm sets cwd for lifecycle
 * scripts), and reads that package's own manifest.
 *
 * The published manifest carries a `prepack` pointing at `../../`,
 * which is outside the tarball. That is fine and is not worth working
 * around: `prepack` runs for pack and publish only, never for install,
 * so the only way a consumer reaches it is by running `npm pack`
 * inside `node_modules`.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const pkgDir = process.cwd();
const manifestPath = join(pkgDir, "package.json");

if (!existsSync(manifestPath)) {
  console.error(
    `check-dist-fresh: no package.json in ${pkgDir}. This script must run ` +
      `from a package directory (it is a prepack hook).`,
  );
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));

/** Every path the manifest promises a consumer will find. */
function promisedPaths(manifest) {
  const out = new Set();
  for (const key of ["main", "module", "types"]) {
    if (typeof manifest[key] === "string") out.add(manifest[key]);
  }
  const walk = (node) => {
    if (typeof node === "string") {
      // Subpath VALUES are paths; subpath KEYS ("./views") are not.
      if (node.startsWith("./")) out.add(node);
      return;
    }
    if (node && typeof node === "object")
      for (const v of Object.values(node)) walk(v);
  };
  walk(manifest.exports ?? {});
  return [...out];
}

const missing = promisedPaths(pkg).filter(
  (p) => !existsSync(resolve(pkgDir, p)),
);

if (missing.length > 0) {
  console.error(
    `check-dist-fresh: ${pkg.name} would ship a hollow tarball. ` +
      `${missing.length} file(s) named in the manifest do not exist:`,
  );
  for (const m of missing) console.error(`  ✗ ${m}`);
  console.error(`Run \`pnpm run build:packages\` from the repo root first.`);
  process.exit(1);
}

/** Newest mtime under a directory, or 0 if it does not exist. */
function newestMtime(dir, skip = () => false) {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (skip(full, entry)) continue;
    const t = entry.isDirectory()
      ? newestMtime(full, skip)
      : statSync(full).mtimeMs;
    if (t > newest) newest = t;
  }
  return newest;
}

const srcDir = join(pkgDir, "src");
const distDir = join(pkgDir, "dist");

// Tests and stories are not inputs to the bundle, so editing one does
// not make dist stale. Excluding them keeps the guard from crying wolf
// on the most common edit in the tree.
const isNotBuildInput = (full) => /\.(test|stories)\.[tj]sx?$/.test(full);

const newestSrc = newestMtime(srcDir, isNotBuildInput);
const newestDist = newestMtime(distDir);

if (newestSrc > 0 && newestSrc > newestDist) {
  const drift = Math.round((newestSrc - newestDist) / 1000);
  console.error(
    `check-dist-fresh: ${pkg.name} has a STALE dist. Source is ${drift}s ` +
      `newer than the newest emitted file, so this tarball would ship the ` +
      `previous build. Run \`pnpm run build:packages\` from the repo root.`,
  );
  process.exit(1);
}

console.log(
  `check-dist-fresh: ${pkg.name} dist is present and newer than src.`,
);
