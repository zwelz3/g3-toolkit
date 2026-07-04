/**
 * Public-API dist tests (RECONSTRUCTED 2026-07-03).
 *
 * The original file was lost between agent rounds by a packaging step
 * that pruned directories named `dist` and caught this source
 * directory; the received zip lacked it while package.json
 * (verify:exports), vitest.dist.config.ts, and ci.yml all reference
 * it. Rebuilt from that documented contract:
 *
 *   1. Every exports-map resolution target (types / import / require)
 *      of every @g3t package exists on disk after build:packages.
 *   2. Every built ESM entry re-exports the named symbols its source
 *      barrel exports (the root barrel is compared exhaustively; a
 *      built subpath entry must be a superset of nothing, it is only
 *      required to load and expose at least one export).
 *
 * Requires `pnpm run build:packages` first; runs under verify, not
 * under the default test include (see vitest.dist.config.ts).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const PACKAGES = ["core", "react", "charts"] as const;

interface ExportsEntry {
  types?: string;
  import?: string;
  require?: string;
}

function readManifest(pkg: string): {
  dir: string;
  exports: Record<string, ExportsEntry | string>;
} {
  const dir = resolve(root, "packages", pkg);
  const manifest = JSON.parse(
    readFileSync(resolve(dir, "package.json"), "utf8"),
  ) as { exports: Record<string, ExportsEntry | string> };
  return { dir, exports: manifest.exports };
}

describe("exports-map targets exist on disk", () => {
  for (const pkg of PACKAGES) {
    it(`@g3t/${pkg}: every types/import/require target exists`, () => {
      const { dir, exports } = readManifest(pkg);
      const missing: string[] = [];
      for (const [subpath, entry] of Object.entries(exports)) {
        const targets =
          typeof entry === "string"
            ? [entry]
            : [entry.types, entry.import, entry.require].filter(
                (t): t is string => Boolean(t),
              );
        for (const t of targets) {
          if (!existsSync(resolve(dir, t))) missing.push(`${subpath} -> ${t}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});

describe("built root entries re-export the source barrel", () => {
  for (const pkg of PACKAGES) {
    it(`@g3t/${pkg}: dist/index.mjs exposes every source-barrel named export`, async () => {
      const { dir, exports } = readManifest(pkg);
      const rootEntry = exports["."];
      expect(rootEntry).toBeDefined();
      if (rootEntry === undefined) return;
      const importTarget =
        typeof rootEntry === "string" ? rootEntry : rootEntry.import;
      expect(importTarget).toBeDefined();

      const src = (await import(
        pathToFileURL(resolve(dir, "src", "index.ts")).href
      )) as Record<string, unknown>;
      const dist = (await import(
        pathToFileURL(resolve(dir, String(importTarget))).href
      )) as Record<string, unknown>;

      // Type-only exports vanish at runtime from BOTH sides, so runtime
      // key parity is the right comparison.
      const srcKeys = Object.keys(src).filter((k) => k !== "default");
      const distKeys = new Set(Object.keys(dist));
      const missing = srcKeys.filter((k) => !distKeys.has(k));
      expect(missing).toEqual([]);
      expect(srcKeys.length).toBeGreaterThan(0);
    });
  }
});

describe("built subpath entries load", () => {
  for (const pkg of PACKAGES) {
    it(`@g3t/${pkg}: every ESM subpath entry imports and is non-empty`, async () => {
      const { dir, exports } = readManifest(pkg);
      for (const [subpath, entry] of Object.entries(exports)) {
        if (subpath === "." || subpath === "./package.json") continue;
        const importTarget = typeof entry === "string" ? entry : entry.import;
        if (!importTarget || !importTarget.endsWith(".mjs")) continue;
        const mod = (await import(
          pathToFileURL(resolve(dir, importTarget)).href
        )) as Record<string, unknown>;
        expect(
          Object.keys(mod).length,
          `${pkg} ${subpath} exports nothing`,
        ).toBeGreaterThan(0);
      }
    });
  }
});
