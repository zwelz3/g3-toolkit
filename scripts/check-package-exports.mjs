#!/usr/bin/env node
/**
 * Release gate: every publishable package's declared entry points
 * must EXIST in dist after a build, and the files[] list must cover
 * what the exports map points at.
 *
 * Motivated by the upstream P1 that "types are declared but not
 * emitted": a package whose types field points at a file the tarball
 * lacks type-checks fine in this repo and breaks every consumer. The
 * only way that stays fixed is a gate.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");
const failures = [];
let checked = 0;

function checkTarget(pkgDir, pkgName, label, rel) {
  if (typeof rel !== "string" || !rel.startsWith("./")) return;
  checked += 1;
  const abs = join(pkgDir, rel);
  if (!existsSync(abs)) {
    failures.push(`${pkgName}: ${label} -> ${rel} does not exist after build`);
  }
}

function walkExports(pkgDir, pkgName, node, path) {
  if (typeof node === "string") {
    checkTarget(pkgDir, pkgName, `exports${path}`, node);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      walkExports(pkgDir, pkgName, value, `${path}[${key}]`);
    }
  }
}

for (const dir of readdirSync(packagesDir)) {
  const pkgDir = join(packagesDir, dir);
  const manifestPath = join(pkgDir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (pkg.private === true) continue;

  for (const field of ["main", "module", "types"]) {
    if (pkg[field]) checkTarget(pkgDir, pkg.name, field, pkg[field]);
  }
  if (pkg.exports) walkExports(pkgDir, pkg.name, pkg.exports, "");

  // files[] must ship dist and the legal/readme set the field claims.
  const files = pkg.files ?? [];
  if (!files.includes("dist")) {
    failures.push(`${pkg.name}: files[] does not include "dist"`);
  }
  for (const claimed of files) {
    if (claimed === "dist") continue;
    if (!existsSync(join(pkgDir, claimed))) {
      failures.push(`${pkg.name}: files[] claims ${claimed}, which is absent`);
    }
  }
  // A types entry with no emitted declarations anywhere is the exact
  // upstream failure; catch it even if index.d.ts happens to exist.
  if (pkg.types) {
    const distDir = join(pkgDir, "dist");
    const hasDecls =
      existsSync(distDir) &&
      readdirSync(distDir, { recursive: true }).some(
        (f) => typeof f === "string" && f.endsWith(".d.ts"),
      );
    if (!hasDecls) {
      failures.push(`${pkg.name}: types declared but no .d.ts emitted in dist`);
    }
  }
}

if (failures.length > 0) {
  console.error("Package export check FAILED:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Package exports: ${checked} entry points verified, all present.`);
