/**
 * Verify that importing a single component doesn't pull in everything.
 * Run: node scripts/verify-treeshake.mjs
 */
import { readFileSync } from "fs";

const bundle = readFileSync("dist/g3t.mjs", "utf-8");
const sizeKB = Math.round(bundle.length / 1024);

console.log(`Full bundle: ${sizeKB} KB`);
console.log("");

// Check that major deps are externalized
const checks = [
  { name: "react", pattern: /from ["']react["']/, expected: "externalized" },
  { name: "cytoscape", pattern: /from ["']cytoscape["']/, expected: "externalized" },
  { name: "echarts", pattern: /from ["']echarts["']/, expected: "externalized" },
  { name: "zustand", pattern: /from ["']zustand["']/, expected: "externalized" },
];

for (const { name, pattern, expected } of checks) {
  const found = pattern.test(bundle);
  const status = found ? "IMPORT REF (externalized)" : "BUNDLED or unused";
  const ok = expected === "externalized" ? found : !found;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: ${status}`);
}

// Check mathjs is NOT in the bundle
if (bundle.includes("mathjs") || bundle.includes("typed-function")) {
  console.log("  ✗ mathjs: STILL IN BUNDLE (should be removed)");
} else {
  console.log("  ✓ mathjs: not present (removed)");
}

console.log("\nBundle analysis: dist/bundle-analysis.html");
