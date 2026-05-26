/**
 * Source-level architectural boundary enforcement (P4).
 *
 * @g3t/core is D6 (framework-agnostic). Its source files MUST NOT
 * import from:
 *   - @g3t/react       (D13: React layer)
 *   - @g3t/charts      (charts package)
 *   - react / react-dom (the framework itself)
 *   - zustand          (state library used by @g3t/react)
 *   - cytoscape        (graph runtime; usage belongs in @g3t/react)
 *   - echarts          (chart runtime; usage belongs in @g3t/charts)
 *
 * Applies to ALL files including tests: integration tests that need
 * @g3t/react components live in @g3t/react's test suite, not here.
 * Phase 4 moved the four pre-existing offenders (adapter.test.ts,
 * style-override/m12.test.tsx, combo/f1-f8.test.tsx, shacl/shacl.test.tsx)
 * into @g3t/react/ alongside the components they exercise.
 *
 * If this test fails, the offending file should either:
 *   (a) move out of @g3t/core (it's not D6), or
 *   (b) refactor away the forbidden import (often: invert the
 *       dependency so the @g3t/react side does the wiring).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_IMPORTS = [
  "@g3t/react",
  "@g3t/charts",
  "react",
  "react-dom",
  "zustand",
  "cytoscape",
  "echarts",
];

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
  throw new Error("Could not locate workspace root");
}

const CORE_SRC = resolve(findWorkspaceRoot(), "packages/core/src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      // The boundary test itself is excluded so it doesn't self-scan;
      // every other source file (including tests) is in scope.
      if (entry === "source-boundary.test.ts") continue;
      // Skip declaration files.
      if (entry.endsWith(".d.ts")) continue;
      out.push(full);
    }
  }
  return out;
}

const IMPORT_RE =
  /(?:from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\))/g;

function importsIn(file: string): string[] {
  const text = readFileSync(file, "utf-8");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(text)) !== null) {
    const src = m[1] ?? m[2];
    if (src) out.push(src);
  }
  return out;
}

function topLevelPackageName(spec: string): string {
  if (spec.startsWith(".")) return ""; // relative — not a package
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return scope && name ? `${scope}/${name}` : scope ?? "";
  }
  return spec.split("/")[0] ?? "";
}

describe("@g3t/core source-level boundary (P4)", () => {
  const files = walk(CORE_SRC);

  it(`scans non-test core source files (sanity: found ${files.length} files)`, () => {
    expect(files.length).toBeGreaterThan(20); // ballpark sanity
  });

  for (const forbidden of FORBIDDEN_IMPORTS) {
    it(`no @g3t/core production source imports "${forbidden}"`, () => {
      const violators: Array<{ file: string; from: string }> = [];
      for (const file of files) {
        for (const spec of importsIn(file)) {
          if (topLevelPackageName(spec) === forbidden) {
            violators.push({
              file: relative(CORE_SRC, file),
              from: spec,
            });
          }
        }
      }
      // Helpful failure message
      if (violators.length > 0) {
        const lines = violators
          .map((v) => `  ${v.file} imports "${v.from}"`)
          .join("\n");
        throw new Error(
          `Boundary violation: @g3t/core source must not import "${forbidden}".\n${lines}`,
        );
      }
      expect(violators).toEqual([]);
    });
  }
});
