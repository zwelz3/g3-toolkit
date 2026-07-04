/**
 * Cross-platform clean of every workspace package's dist/ directory.
 *
 * Needed because the package builds run in two phases that share dist/:
 *   1. `tsc -b` emits declaration files (.d.ts) into dist/
 *   2. `vite build` emits JS bundles into dist/
 * Vite's emptyOutDir is therefore disabled (it was deleting the
 * declarations from phase 1), and this script provides the explicit
 * clean at the start of `build:packages` instead. Plain `rm -rf` is
 * avoided for Windows compatibility.
 */
import { rmSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = resolve(root, "packages");

for (const name of readdirSync(packagesDir)) {
  const dist = resolve(packagesDir, name, "dist");
  if (existsSync(dist)) {
    rmSync(dist, { recursive: true, force: true });
    console.log(`cleaned ${name}/dist`);
  }
}
