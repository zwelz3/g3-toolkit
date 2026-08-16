#!/usr/bin/env node
/**
 * Release gate: the published runtime API surface is a GOLDEN FILE.
 *
 * Motivated by a 2026-08 review: 35 core symbols ship only via
 * subpaths, nine of them internal helpers made public by accident.
 * Root cause: every existing gate checks the surface in ONE direction.
 * `verify:package` asserts declared entries exist, `verify:exports`
 * asserts dist is a SUPERSET of the source barrel, and `verify:smoke`
 * asserts each subpath imports non-empty. None of them can notice a
 * symbol ARRIVING, so the namespace could only ever widen.
 *
 * Note that the star-export mechanism usually blamed for this holds
 * for @g3t/react but NOT for @g3t/core. Core's sub-barrels are
 * explicit named lists, so helpers
 * like `localPart`, `cardinalitySuffix` and `estimateTextSize` were
 * typed into an export list by hand: deliberate keystrokes whose intent
 * is worth revisiting, not a star-export accident. React's barrels do
 * use `export *` (60 of them), which is how `stampMultiTypePies`,
 * `MAX_SLICES` and `coerceWidgetValue` reached the root entry without
 * anyone naming them. This gate covers both cases because it compares
 * the resolved surface, not the source syntax.
 *
 * This gate closes the loop: the full set of runtime exports for every
 * exports-map entry is committed to api-surface.json, and any
 * difference fails. Widening the public namespace now costs a
 * reviewable line in a diff, which is the point. After 1.0.0 a REMOVAL
 * is a breaking change, so the removed side of a diff is the louder
 * one.
 *
 * Scope: runtime (value) exports only. Type-only exports are erased at
 * runtime and are not visible to `import()`; type reachability has its
 * own gate in check-type-reachability.mjs. A type promoted to a value
 * (or vice versa) shows up here as an add/remove pair.
 *
 * Usage:
 *   node scripts/check-api-surface.mjs            # verify, exit 1 on diff
 *   node scripts/check-api-surface.mjs --update   # rewrite the snapshot
 *
 * Requires a prior build: it imports from dist/, the same artifacts a
 * consumer resolves.
 *
 * Exit codes:
 *   0  surface matches the snapshot
 *   1  surface differs, snapshot missing, or an entry failed to import
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = resolve(ROOT, "api-surface.json");
const PACKAGES = ["core", "react", "charts"];
const SKIP_SUBPATHS = new Set(["./package.json", "./style.css"]);
const UPDATE = process.argv.includes("--update");

/** Enumerate the sorted runtime export names of every exports-map entry. */
async function collectSurface() {
  const surface = {};
  const failures = [];

  for (const pkg of PACKAGES) {
    const pkgJsonPath = resolve(ROOT, "packages", pkg, "package.json");
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    const exportsMap = pkgJson.exports ?? {};

    for (const subpath of Object.keys(exportsMap)) {
      if (SKIP_SUBPATHS.has(subpath)) continue;
      const entry = exportsMap[subpath];
      const importTarget =
        typeof entry === "string" ? entry : (entry.import ?? entry.require);
      if (!importTarget) continue;

      const absPath = resolve(dirname(pkgJsonPath), importTarget);
      const label =
        subpath === "." ? `@g3t/${pkg}` : `@g3t/${pkg}/${subpath.slice(2)}`;

      try {
        // pathToFileURL for the same reason smoke-test.mjs uses it: a
        // bare absolute path is rejected by import() on Windows.
        const mod = await import(pathToFileURL(absPath).href);
        surface[label] = Object.keys(mod)
          .filter((k) => k !== "default")
          .sort();
      } catch (err) {
        failures.push(`${label}: ${err.message}`);
      }
    }
  }

  return { surface, failures };
}

function diffEntry(before, after) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter((k) => !b.has(k)),
    removed: before.filter((k) => !a.has(k)),
  };
}

const { surface, failures } = await collectSurface();

if (failures.length > 0) {
  console.error("api surface: entries failed to import\n");
  for (const f of failures) console.error(`  x ${f}`);
  console.error("\nRun `pnpm run build:packages` first.");
  process.exit(1);
}

if (UPDATE) {
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(surface, null, 2) + "\n");
  const total = Object.values(surface).reduce((n, v) => n + v.length, 0);
  console.log(
    `api surface: wrote ${Object.keys(surface).length} entries, ${total} exports`,
  );
  process.exit(0);
}

if (!existsSync(SNAPSHOT_PATH)) {
  console.error(
    "api surface: api-surface.json is missing.\n" +
      "Generate it with `node scripts/check-api-surface.mjs --update` and commit it.",
  );
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
const entries = [
  ...new Set([...Object.keys(snapshot), ...Object.keys(surface)]),
].sort();

let changed = 0;
for (const label of entries) {
  const before = snapshot[label];
  const after = surface[label];

  if (before === undefined) {
    console.error(`\n+ ENTRY ADDED  ${label} (${after.length} exports)`);
    changed++;
    continue;
  }
  if (after === undefined) {
    console.error(`\n- ENTRY REMOVED  ${label} (was ${before.length} exports)`);
    changed++;
    continue;
  }

  const { added, removed } = diffEntry(before, after);
  if (added.length === 0 && removed.length === 0) continue;
  changed++;
  console.error(`\n${label}`);
  for (const k of removed) console.error(`  - ${k}`);
  for (const k of added) console.error(`  + ${k}`);
}

if (changed > 0) {
  console.error(
    `\napi surface: ${changed} entr${changed === 1 ? "y" : "ies"} changed.\n` +
      "A `+` widens the published namespace: confirm the symbol is meant to be\n" +
      "public API, not an internal helper that happens to carry `export`.\n" +
      "A `-` is a BREAKING change once 1.0.0 is published.\n" +
      "If the change is intended, re-run with --update and commit the snapshot.",
  );
  process.exit(1);
}

const total = Object.values(surface).reduce((n, v) => n + v.length, 0);
console.log(
  `api surface: unchanged (${entries.length} entries, ${total} exports)`,
);
