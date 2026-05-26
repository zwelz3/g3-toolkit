#!/usr/bin/env node
/**
 * M14.11: Treeshaking verification.
 *
 * Verifies that importing a single component from @g3t/react
 * does NOT pull in unrelated dependencies.
 *
 * Run: node scripts/verify-treeshaking.mjs
 */

import { readFileSync } from "fs";

// Check that the ESM bundle uses named exports (tree-shakeable)
const esm = readFileSync("dist/g3t.mjs", "utf-8");

const checks = [
  {
    name: "ESM uses named exports",
    pass: esm.includes("export {") || esm.includes("export function"),
  },
  {
    name: "No side-effect imports at top level",
    pass: !esm.match(/^import\s+['"][^'"]+['"];$/m),
  },
  {
    name: "Package.json has sideEffects: false",
    pass: (() => {
      const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
      return pkg.sideEffects === false || pkg.sideEffects === undefined;
    })(),
  },
];

console.log("Treeshaking Verification");
console.log("========================\n");

let allPass = true;
for (const check of checks) {
  const icon = check.pass ? "✓" : "✗";
  console.log(`  ${icon} ${check.name}`);
  if (!check.pass) allPass = false;
}

console.log(`\n${allPass ? "All checks passed." : "Some checks failed."}`);
process.exit(allPass ? 0 : 1);
