#!/usr/bin/env node
/**
 * Derive workspace stats so docs don't drift from reality.
 *
 * Prints to stdout, e.g.:
 *   {
 *     "requirements": 72,
 *     "specFiles": 12,
 *     "testFilesByPackage": {
 *       "core": 14,
 *       "react": 35,
 *       "charts": 1
 *     },
 *     "subpathsByPackage": {
 *       "core": 12,
 *       "react": 5,
 *       "charts": 0
 *     }
 *   }
 *
 * Use cases:
 *   - CI can grep for hardcoded numbers (e.g. "556 unit tests") and fail
 *     if they don't match the derived counts.
 *   - Pre-commit hook can run this and update PROGRESS.md "current
 *     state" lines.
 *
 * The script is intentionally read-only and dependency-free (just Node
 * built-ins). It can run before `pnpm install` if needed.
 */

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, predicate) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist")
      continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(entry, full)) out.push(full);
  }
  return out;
}

function countUniqueRIds() {
  const specFiles = walk(join(ROOT, "specs"), (n) => n.endsWith(".md"));
  const ids = new Set();
  for (const f of specFiles) {
    const text = readFileSync(f, "utf-8");
    for (const m of text.matchAll(/\bR\d+\.\d+\b/g)) ids.add(m[0]);
  }
  return { requirements: ids.size, specFiles: specFiles.length };
}

function countTestFiles() {
  const out = {};
  for (const pkg of ["core", "react", "charts"]) {
    const pkgDir = join(ROOT, "packages", pkg, "src");
    let count = 0;
    try {
      count = walk(pkgDir, (n) =>
        n.endsWith(".test.ts") || n.endsWith(".test.tsx"),
      ).length;
    } catch {
      count = 0;
    }
    out[pkg] = count;
  }
  return out;
}

function countSubpaths() {
  const out = {};
  for (const pkg of ["core", "react", "charts"]) {
    const pkgJson = join(ROOT, "packages", pkg, "package.json");
    const exports = JSON.parse(readFileSync(pkgJson, "utf-8")).exports ?? {};
    // Don't count ".", "./package.json", or "./style.css"
    const count = Object.keys(exports).filter(
      (k) => k !== "." && k !== "./package.json" && k !== "./style.css",
    ).length;
    out[pkg] = count;
  }
  return out;
}

const { requirements, specFiles } = countUniqueRIds();
const result = {
  requirements,
  specFiles,
  testFilesByPackage: countTestFiles(),
  subpathsByPackage: countSubpaths(),
};

console.log(JSON.stringify(result, null, 2));
