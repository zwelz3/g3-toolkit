#!/usr/bin/env node
/**
 * Release gate: a workspace SIBLING must stay an external of the package
 * that imports it, never get compiled into its dist.
 *
 * This exists because of 683e40e (2026-08-28). That commit reordered
 * `packages/react/package.json` and dropped one line,
 * `"@g3-toolkit/core": "workspace:^"`, from `dependencies`. Nothing in
 * any build file names that entry: `scripts/vite-externals.mjs` DERIVES
 * the rollup externals from the manifest. So deleting the line
 * un-externalized core, and the `resolve.alias` in
 * `packages/react/vite.config.ts` that points `@g3-toolkit/core` at
 * `../core/src` compiled the whole of core into react's dist. React went
 * from 388.5 KB to 651.7 KB.
 *
 * Nothing failed loudly. The alias resolves without the workspace link,
 * so typecheck, the unit suite, the export gates and the smoke test all
 * stayed green; `check-bundle-size.mjs` was the only gate that noticed,
 * and only because the weight happened to cross a budget. That is too
 * thin a thread: the same mistake in `charts`, whose vite config carries
 * the same alias shape, would have moved a much smaller number.
 *
 * Weight is the symptom. The defect is duplication: a host that installs
 * `@g3-toolkit/core` alongside `@g3-toolkit/react` receives two copies
 * of the exported zustand store singletons, so the canvas subscribes to
 * one while the table writes to the other and selection silently stops
 * propagating. That is the same two-instance hazard the ESM-only ruling
 * (see packages/*\/vite.config.ts and tests/dist/public-api.test.ts)
 * exists to prevent, arriving by a different route.
 *
 * TWO checks, because they fail at different times:
 *
 * 1. ALIAS IMPLIES DECLARATION (static, no build needed). Every
 *    `@g3-toolkit/*` alias key in a package's vite config must appear in
 *    that package's dependencies, peerDependencies or
 *    optionalDependencies. This is the exact edit 683e40e made, caught
 *    at the manifest rather than 260 KB later.
 * 2. NO SIBLING SOURCE IN DIST (empirical). No emitted sourcemap may
 *    carry a source file that resolves inside another workspace
 *    package. This catches inlining however it arrives, including
 *    routes that do not go through the alias at all.
 *
 * NO VACUOUS PASS, the rule this repository keeps relearning: a dist
 * with no sourcemaps cannot be checked, so it FAILS rather than passing
 * quietly, and a vite config that mentions `alias` but yields no
 * extractable keys FAILS as a stale extractor.
 *
 * Exit codes:
 *   0  every sibling external
 *   1  a sibling is inlined, undeclared, or unverifiable
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");

/** `"@g3-toolkit/core": resolve(...)` in a vite config's alias block. */
const ALIAS_KEY = /["'](@g3-toolkit\/[a-z0-9-]+)["']\s*:/g;

/** Every workspace package: published name -> absolute directory. */
const workspace = new Map();
for (const entry of readdirSync(packagesDir)) {
  const manifestPath = join(packagesDir, entry, "package.json");
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  workspace.set(pkg.name, join(packagesDir, entry));
}

function mapFilesIn(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...mapFilesIn(full));
    else if (entry.endsWith(".mjs.map") || entry.endsWith(".js.map")) {
      out.push(full);
    }
  }
  return out;
}

const failures = [];
let checkedAliases = 0;
let checkedMaps = 0;

for (const [name, pkgDir] of workspace) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  if (pkg.private === true) continue;

  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);

  // 1. Alias implies declaration.
  const configPath = join(pkgDir, "vite.config.ts");
  if (existsSync(configPath)) {
    const config = readFileSync(configPath, "utf8");
    ALIAS_KEY.lastIndex = 0;
    const keys = [...config.matchAll(ALIAS_KEY)].map((m) => m[1]);
    if (config.includes("alias") && keys.length === 0) {
      failures.push(
        `${name}: vite.config.ts has an \`alias\` block but no extractable ` +
          `"@g3-toolkit/*" key. The config's shape changed; the ALIAS_KEY ` +
          `pattern in scripts/check-sibling-externals.mjs needs updating. ` +
          `Failing rather than skipping.`,
      );
    }
    for (const key of keys) {
      if (!workspace.has(key)) continue;
      checkedAliases += 1;
      if (!declared.has(key)) {
        failures.push(
          `${name}: vite.config.ts aliases "${key}" to its source, but the ` +
            `manifest does not declare it. Externals are derived from the ` +
            `manifest (scripts/vite-externals.mjs), so this build inlines ` +
            `all of ${key} instead of importing it. Restore it to ` +
            `dependencies or peerDependencies.`,
        );
      }
    }
  }

  // 2. No sibling source in dist.
  const dist = join(pkgDir, "dist");
  if (!existsSync(dist)) continue; // check-package-exports owns absence
  const maps = mapFilesIn(dist);
  if (maps.length === 0) {
    failures.push(
      `${name}: dist/ has no sourcemaps, so sibling inlining cannot be ` +
        `verified. Restore \`sourcemap: true\` in its vite config, or this ` +
        `gate is decorative.`,
    );
    continue;
  }
  for (const mapPath of maps) {
    checkedMaps += 1;
    const sources = JSON.parse(readFileSync(mapPath, "utf8")).sources ?? [];
    for (const source of sources) {
      if (typeof source !== "string") continue;
      const abs = resolve(dirname(mapPath), source);
      for (const [sibling, siblingDir] of workspace) {
        if (sibling === name) continue;
        if (!abs.startsWith(siblingDir + "/")) continue;
        failures.push(
          `${name}: ${relative(root, mapPath)} contains ${sibling} source ` +
            `(${relative(root, abs)}). The sibling is being compiled in ` +
            `rather than imported, which ships a duplicate copy of its ` +
            `module state to every consumer that installs both.`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Sibling-externals check FAILED:");
  // One line per distinct message: a single inlined package produces one
  // finding per chunk otherwise, and 200 identical lines bury the cause.
  for (const f of [...new Set(failures)].slice(0, 20))
    console.error(`  ✗ ${f}`);
  const extra = new Set(failures).size - 20;
  if (extra > 0) console.error(`  ... and ${extra} more`);
  process.exit(1);
}
console.log(
  `Sibling externals: ${checkedAliases} alias(es) declared, ` +
    `${checkedMaps} sourcemap(s) walked, no sibling source inlined.`,
);
