#!/usr/bin/env node
/**
 * Keep `packages/core/ARCHIVE.md` honest about what actually ships.
 *
 * ARCHIVE.md records symbols removed from the ROOT barrel
 * (`packages/core/src/index.ts`) under an "archive, don't delete"
 * ruling. For a year that was read as "removed from the API", and it is
 * not the same thing: `@g3t/core` publishes thirteen subpaths, and a
 * symbol dropped from the root barrel is still public if any subpath
 * barrel exports it. When this check was first written, 27 of the 38
 * listed symbols shipped from a subpath, including every one of the
 * middleware, SHACL-report, pipeline-registry and incremental-layout
 * clusters.
 *
 * So the document now carries a status per symbol, and this script is
 * what stops that status drifting. It cross-references every symbol in
 * the cluster table against `api-surface.json`, which is the golden
 * record of what each entry point exports, and fails when the two
 * disagree.
 *
 * That direction matters. Re-exporting an archived symbol is a
 * deliberate act and a fine one; silently leaving a document that says
 * it is gone is what this prevents. CLAUDE.md's standing rule applies:
 * when a hand-maintained number disagrees with a gate script, the
 * script is right, so fix the document rather than this file.
 *
 * Exit codes:
 *   0  ARCHIVE.md's statuses match the published surface
 *   1  at least one symbol's status is wrong
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const archivePath = join(root, "packages/core/ARCHIVE.md");
const surfacePath = join(root, "api-surface.json");

for (const p of [archivePath, surfacePath]) {
  if (!existsSync(p)) {
    console.error(`check-archive-accuracy: ${p} does not exist.`);
    process.exit(1);
  }
}

const md = readFileSync(archivePath, "utf8");
const surface = JSON.parse(readFileSync(surfacePath, "utf8"));

/** Entry points that export `symbol`, by name. */
function entriesExporting(symbol) {
  const out = [];
  for (const [entry, value] of Object.entries(surface)) {
    const exports = Array.isArray(value) ? value : (value.exports ?? []);
    if (exports.includes(symbol)) out.push(entry);
  }
  return out;
}

/**
 * Rows of the status table: `| symbol | cluster | status | where |`.
 * Status is SHIPS or ABSENT; `where` is the entry list for SHIPS.
 */
const rows = [];
for (const line of md.split("\n")) {
  if (!line.startsWith("| `")) continue;
  const cells = line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  if (cells.length < 4) continue;
  const symbol = cells[0].replace(/`/g, "");
  const status = cells[2].toUpperCase();
  if (status !== "SHIPS" && status !== "ABSENT") continue;
  // Split into a SET rather than substring-matching the cell. Entry
  // names nest (`@g3t/core` is a prefix of `@g3t/core/adapters`), so
  // `cell.includes(entry)` reports a row listing only the subpath as
  // covering the root too. That bug shipped in the first draft of this
  // script and was caught by negative-testing the row that has both.
  const where = new Set(
    cells[3]
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e && e !== "-"),
  );
  rows.push({ symbol, status, where });
}

if (rows.length === 0) {
  console.error(
    "check-archive-accuracy: no status rows found in ARCHIVE.md. The table " +
      "must have rows shaped `| \\`symbol\\` | cluster | SHIPS/ABSENT | where |`. " +
      "Failing rather than passing vacuously: a check that reads nothing " +
      "reports the same green as a check that read everything.",
  );
  process.exit(1);
}

const failures = [];
for (const { symbol, status, where } of rows) {
  const actual = entriesExporting(symbol);
  if (status === "ABSENT" && actual.length > 0) {
    failures.push(
      `${symbol} is marked ABSENT but ships from ${actual.join(", ")}. ` +
        `Either the re-export was intended (update ARCHIVE.md) or it was ` +
        `not (drop it from the barrel).`,
    );
    continue;
  }
  if (status === "SHIPS") {
    if (actual.length === 0) {
      failures.push(
        `${symbol} is marked SHIPS but no entry point exports it. If it was ` +
          `deliberately withdrawn, mark it ABSENT.`,
      );
      continue;
    }
    const listed = [...where].sort().join(", ");
    const missing = actual.filter((e) => !where.has(e));
    const extra = [...where].filter((e) => !actual.includes(e));
    if (missing.length > 0) {
      failures.push(
        `${symbol} ships from ${actual.join(", ")} but ARCHIVE.md lists ` +
          `"${listed}". Missing: ${missing.join(", ")}.`,
      );
    }
    if (extra.length > 0) {
      failures.push(
        `${symbol} does NOT ship from ${extra.join(", ")}, but ARCHIVE.md ` +
          `lists it there.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("ARCHIVE.md disagrees with the published surface:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    `\n${failures.length} of ${rows.length} rows are wrong. api-surface.json ` +
      `is the record of what ships; ARCHIVE.md is the prose about it, so the ` +
      `prose is what changes.`,
  );
  process.exit(1);
}

const shipping = rows.filter((r) => r.status === "SHIPS").length;
console.log(
  `ARCHIVE.md accurate: ${rows.length} symbols checked, ${shipping} ship ` +
    `from a subpath, ${rows.length - shipping} genuinely absent.`,
);
