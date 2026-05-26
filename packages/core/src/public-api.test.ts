/**
 * Public-API consistency test (P4.3).
 *
 * For every subpath declared in package.json's `exports` map, verify
 * that the published `dist/` artifact:
 *   1. resolves at runtime (the file Node would actually load),
 *   2. exports at least one named symbol (i.e. isn't a dead-empty entry).
 *
 * This catches the kind of "documented but missing" drift the audit
 * found in P3.1 — subpaths that exist in the manifest but no longer
 * map to real code, or barrels that lose all their exports during
 * refactoring.
 *
 * Implementation note: we read the `.import` (ESM) target out of each
 * exports entry and import it by absolute path. This bypasses Vitest's
 * own resolver and exercises exactly what a consumer doing
 * `import "@g3t/<pkg>/<subpath>"` from a Node project would get,
 * including the source-dir-to-subpath name divergence (`adapters`
 * ↔ `adapter/`, `events` ↔ `event-bus/`, `algorithms` ↔
 * `algorithm-adapter/`, `controls` ↔ `interaction/`).
 *
 * Requires `pnpm run build:packages` to have been run first; vitest
 * does that as part of the workspace setup, but if running this file
 * in isolation, build the packages first.
 *
 * NOT covered here (yet): per-symbol shape checks against `.d.ts`
 * declarations. That would require running tsc/api-extractor as a
 * separate step; this lighter check is the start.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface ExportEntry {
  import?: string;
  require?: string;
  types?: string;
}

type ExportsValue = string | ExportEntry;

function loadExports(pkgPath: string): Record<string, ExportsValue> {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.exports ?? {};
}

const SKIP = new Set([
  "./package.json", // not a JS module
  "./style.css", // CSS asset, not importable as JS
]);

function importTarget(entry: ExportsValue): string | null {
  if (typeof entry === "string") return entry;
  return entry.import ?? entry.require ?? null;
}

/**
 * Find the workspace root by walking up from this test file until we
 * see `pnpm-workspace.yaml`. Robust to running from the root or from
 * a single package's directory.
 */
function findWorkspaceRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate workspace root (pnpm-workspace.yaml)");
}

const WORKSPACE_ROOT = findWorkspaceRoot();

describe("public-API consistency: every declared subpath resolves (P4.3)", () => {
  for (const pkgName of ["core", "react", "charts"] as const) {
    const pkgPath = resolve(WORKSPACE_ROOT, `packages/${pkgName}/package.json`);
    const pkgDir = dirname(pkgPath);
    const exportsMap = loadExports(pkgPath);

    for (const subpath of Object.keys(exportsMap)) {
      if (SKIP.has(subpath)) continue;

      const target = importTarget(exportsMap[subpath]!);
      if (!target) continue;
      const absPath = resolve(pkgDir, target);

      // Build the consumer-visible specifier just for the test label.
      const label =
        subpath === "."
          ? `@g3t/${pkgName}`
          : `@g3t/${pkgName}/${subpath.slice(2)}`;

      it(`${label} resolves and exports ≥1 named symbol`, async () => {
        // First: the file referenced by the exports map must exist.
        expect(
          existsSync(absPath),
          `${label} declares ${target} in exports map but the file is missing — run pnpm run build:packages`,
        ).toBe(true);

        // Second: import it and verify it has named exports.
        const mod = await import(absPath);
        const namedKeys = Object.keys(mod).filter((k) => k !== "default");
        expect(
          namedKeys.length,
          `${label} resolved but exported nothing named`,
        ).toBeGreaterThan(0);
      });
    }
  }
});
