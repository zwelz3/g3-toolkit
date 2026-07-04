#!/usr/bin/env node
/**
 * Build-artifact smoke test.
 *
 * Verifies that the built `dist/` files for each package can be
 * imported by Node directly (i.e. via the published `exports` map,
 * no bundler, no jsdom). Catches:
 *   - Missing files in `dist/`
 *   - Imports of bundler-only assets (e.g. CSS side-effects that Node
 *     can't load) in production code paths
 *   - Mismatch between `package.json` `exports.import` and the
 *     actual files Vite emits
 *
 * The Phase 2A audit flagged that `@g3t/react` and `@g3t/charts`
 * could NOT resolve from a Node script because `WorkspaceShell.tsx`
 * did `import "flexlayout-react/style/light.css"`. Phase 3.3 moved
 * WorkspaceShell out to examples/, which unblocked this test.
 *
 * Exit codes:
 *   0  all subpaths in all packages resolved
 *   1  one or more failed (details printed to stderr)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["core", "react", "charts"];
const SKIP_SUBPATHS = new Set(["./package.json", "./style.css"]);

let failures = 0;

for (const pkg of PACKAGES) {
  const pkgJsonPath = resolve(ROOT, "packages", pkg, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  const exportsMap = pkgJson.exports ?? {};

  for (const subpath of Object.keys(exportsMap)) {
    if (SKIP_SUBPATHS.has(subpath)) continue;
    const entry = exportsMap[subpath];
    const importTarget =
      typeof entry === "string" ? entry : (entry.import ?? entry.require);
    if (!importTarget) continue;

    const absPath = resolve(dirname(pkgJsonPath), importTarget);
    const label =
      subpath === "." ? `@g3t/${pkg}` : `@g3t/${pkg}/${subpath.slice(2)}`;

    try {
      // pathToFileURL: dynamic import() requires a file:// URL for
      // absolute paths on Windows (a bare C:\... is rejected with
      // "protocol 'c:'"); Linux tolerates the bare path, which is why
      // CI never caught this. Canonical form works on both.
      const mod = await import(pathToFileURL(absPath).href);
      const named = Object.keys(mod).filter((k) => k !== "default");
      if (named.length === 0) {
        console.error(`  ✗ ${label}: resolved but no named exports`);
        failures++;
      } else {
        console.log(`  ✓ ${label} (${named.length} exports)`);
      }
    } catch (err) {
      console.error(`  ✗ ${label}: ${err.message}`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\nsmoke test failed: ${failures} subpath(s) did not resolve`);
  process.exit(1);
}
console.log("\nsmoke test: all subpaths resolve cleanly via Node");
