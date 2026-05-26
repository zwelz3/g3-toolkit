#!/usr/bin/env node
/**
 * Bundle-size budget (P6).
 *
 * For each published package, compute the total ESM dist size and
 * compare against a budget. Fails if any package exceeds its budget.
 *
 * The "total ESM" is the sum of every `.mjs` and `.js` file in the
 * package's `dist/` directory, EXCLUDING `.cjs` (CommonJS) and `.map`
 * (source maps). Shared chunks Rollup extracts during the multi-entry
 * build count.
 *
 * Budgets are unminified bytes; this is intentional because the
 * unminified surface is what consumers actually pull through their own
 * bundlers. Consumers minify in production.
 *
 * Headroom: each budget is set ~25% above the current measured size.
 * If a legitimate change pushes any package over its budget, raise the
 * budget here with a note (in the same commit) explaining why.
 *
 * Exit codes:
 *   0  all packages within budget
 *   1  any package exceeded its budget
 *
 * Sizes recorded against Phase 5/6 baseline of g3-toolkit:
 *   @g3t/core   ≈ 96 KB
 *   @g3t/react  ≈ 165 KB
 *   @g3t/charts ≈ 5.8 KB
 */

import { readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const BUDGETS = {
  core: 120 * 1024, // 120 KB
  react: 200 * 1024, // 200 KB
  charts: 10 * 1024, // 10 KB
};

function dirSize(dir, includeExt) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      total += dirSize(full, includeExt);
    } else {
      if (
        includeExt.some((ext) => entry.endsWith(ext)) &&
        !entry.endsWith(".cjs") &&
        !entry.endsWith(".map") &&
        !entry.endsWith(".d.ts")
      ) {
        total += st.size;
      }
    }
  }
  return total;
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

let failures = 0;

console.log("Bundle-Size Budget");
console.log("==================\n");

for (const [pkg, budget] of Object.entries(BUDGETS)) {
  const dist = resolve(ROOT, "packages", pkg, "dist");
  let total;
  try {
    total = dirSize(dist, [".mjs", ".js"]);
  } catch (err) {
    console.error(`  @g3t/${pkg}: dist/ missing — run pnpm run build:packages first`);
    failures++;
    continue;
  }
  const pct = ((total / budget) * 100).toFixed(0);
  const within = total <= budget;
  const symbol = within ? "✓" : "✗";
  console.log(
    `  ${symbol} @g3t/${pkg}: ${fmt(total)} / ${fmt(budget)} (${pct}%)`,
  );
  if (!within) failures++;
}

if (failures > 0) {
  console.error(
    `\nBundle-size budget exceeded: ${failures} package(s) over budget.`,
  );
  console.error(
    `If the growth is justified, raise the budget in scripts/check-bundle-size.mjs\n` +
      `in the same commit, with a comment explaining why.`,
  );
  process.exit(1);
}
console.log("\nAll packages within budget.");
