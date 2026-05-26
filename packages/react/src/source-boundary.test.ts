/**
 * Source-level architectural boundary enforcement for @g3t/react (P4).
 *
 * @g3t/react is the UI layer (D13). It may consume @g3t/core but must
 * NOT import from @g3t/charts (which is downstream of @g3t/react).
 *
 * Storybook story files (*.stories.tsx) are exempt: stories are
 * documentation/demos that can show how the layered packages compose,
 * even when that means a story in @g3t/react demonstrates @g3t/charts
 * usage.
 *
 * Test files (*.test.ts, *.test.tsx) are also exempt for the same
 * reason as the @g3t/core boundary test (see source-boundary.test.ts).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_IMPORTS = ["@g3t/charts"];

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

const REACT_SRC = resolve(findWorkspaceRoot(), "packages/react/src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry.endsWith(".stories.tsx") || entry.endsWith(".stories.ts"))
        continue;
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
  if (spec.startsWith(".")) return "";
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return scope && name ? `${scope}/${name}` : (scope ?? "");
  }
  return spec.split("/")[0] ?? "";
}

describe("@g3t/react source-level boundary (P4)", () => {
  const files = walk(REACT_SRC);

  it(`scans non-test, non-story react source files (sanity: found ${files.length} files)`, () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const forbidden of FORBIDDEN_IMPORTS) {
    it(`no @g3t/react production source imports "${forbidden}"`, () => {
      const violators: Array<{ file: string; from: string }> = [];
      for (const file of files) {
        for (const spec of importsIn(file)) {
          if (topLevelPackageName(spec) === forbidden) {
            violators.push({
              file: relative(REACT_SRC, file),
              from: spec,
            });
          }
        }
      }
      if (violators.length > 0) {
        const lines = violators
          .map((v) => `  ${v.file} imports "${v.from}"`)
          .join("\n");
        throw new Error(
          `Boundary violation: @g3t/react production source must not import "${forbidden}".\n${lines}`,
        );
      }
      expect(violators).toEqual([]);
    });
  }
});
