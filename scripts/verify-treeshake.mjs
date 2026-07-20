#!/usr/bin/env node
/**
 * Treeshaking verification (per-package, P6).
 *
 * Verifies for each published package:
 *   1. The ESM bundle (`dist/index.mjs`) exists and is non-empty.
 *   2. It uses named exports (treeshakable form).
 *   3. The package.json `sideEffects` field is set explicitly:
 *      - `false` for pure-code packages (@g3t/core, @g3t/charts)
 *      - `["*.css"]` for packages that ship CSS as a side-effect
 *        (@g3t/react)
 *   4. The bundle has no top-level bare side-effect imports of
 *      external packages other than CSS (would break treeshaking
 *      under most bundlers).
 *
 * Previously this script targeted the legacy monolithic
 * `dist/g3t.mjs` bundle. After Phase 2's per-package split that
 * file no longer exists; this script now walks each package's
 * own dist/.
 *
 * Exit codes:
 *   0  all checks pass
 *   1  any check fails
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGE_RULES = {
  core: { sideEffects: false },
  react: { sideEffects: ["*.css"] },
  charts: { sideEffects: false },
};

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

let failures = 0;

console.log("Treeshaking Verification (per-package)");
console.log("=======================================\n");

for (const [pkg, rules] of Object.entries(PACKAGE_RULES)) {
  console.log(`@g3t/${pkg}:`);

  const pkgJsonPath = resolve(ROOT, "packages", pkg, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

  // 1. sideEffects declared correctly
  const sideEffectsOk = deepEqual(pkgJson.sideEffects, rules.sideEffects);
  console.log(
    `  ${sideEffectsOk ? "✓" : "✗"} sideEffects = ${JSON.stringify(pkgJson.sideEffects)}` +
      (sideEffectsOk ? "" : ` (expected ${JSON.stringify(rules.sideEffects)})`),
  );
  if (!sideEffectsOk) failures++;

  // 2. dist/index.mjs exists
  const mjsPath = resolve(ROOT, "packages", pkg, "dist/index.mjs");
  const mjsExists = existsSync(mjsPath);
  console.log(`  ${mjsExists ? "✓" : "✗"} dist/index.mjs exists`);
  if (!mjsExists) {
    failures++;
    console.log("");
    continue;
  }

  const mjs = readFileSync(mjsPath, "utf-8");

  // 3. Uses named exports
  const usesNamedExports =
    /\bexport\s*\{/.test(mjs) ||
    /\bexport\s+(function|class|const|let|var)\b/.test(mjs);
  console.log(
    `  ${usesNamedExports ? "✓" : "✗"} uses named exports (treeshakable)`,
  );
  if (!usesNamedExports) failures++;

  // 4. No bare side-effect imports of external (non-CSS) packages.
  // Pattern: `import "<bare-specifier>";` at start of a line, not
  // relative, not CSS.
  const sideEffectImports = mjs.match(/^import\s+["']([^"']+)["'];?$/gm) ?? [];
  const externalSideEffects = sideEffectImports
    .map((l) => l.match(/^import\s+["']([^"']+)["'];?$/)?.[1])
    .filter(
      (spec) =>
        spec &&
        !spec.startsWith(".") &&
        !spec.endsWith(".css") &&
        !spec.endsWith(".scss"),
    );
  if (externalSideEffects.length === 0) {
    console.log(`  ✓ no top-level external side-effect imports`);
  } else {
    console.log(
      `  ✗ external side-effect imports found: ${externalSideEffects.join(", ")}`,
    );
    failures++;
  }

  console.log("");
}

if (failures > 0) {
  console.error(`Treeshake verification failed: ${failures} check(s)`);
  process.exit(1);
}
console.log("All treeshake checks passed.");
