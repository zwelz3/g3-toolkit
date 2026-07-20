/**
 * Filter the playwright JSON report to failures only (G3L Round 48,
 * owner request): full test-results.json runs to megabytes of
 * passing noise; the upload workflow needs the failures, their
 * errors (ANSI-stripped), and their attachment paths.
 *
 * Usage:
 *   node scripts/filter-e2e-failures.mjs [in] [out]
 * Defaults: test-results.json -> test-results-failures.json
 * Exit code: 0 always (reporting must not mask the test exit code;
 * the npm script sequences it so playwright's code is preserved).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const inPath = process.argv[2] ?? "test-results.json";
const outPath = process.argv[3] ?? "test-results-failures.json";

if (!existsSync(inPath)) {
  console.error(`[filter-e2e-failures] ${inPath} not found; nothing to do.`);
  process.exit(0);
}

// The file may carry a tool banner before the JSON (a recurring
// upload-workflow reality): parse from the first brace.
const raw = readFileSync(inPath, "utf-8");
const start = raw.indexOf("{");
if (start < 0) {
  console.error(`[filter-e2e-failures] no JSON object in ${inPath}.`);
  process.exit(0);
}

/** Strip ANSI escape sequences from report text. */
function stripAnsi(text) {
  return typeof text === "string"
    ? // eslint-disable-next-line no-control-regex
      text.replace(/\u001b\[[0-9;]*m/g, "")
    : text;
}

const report = JSON.parse(raw.slice(start));
const failures = [];

function walk(suites, filePath) {
  for (const s of suites ?? []) {
    const file = s.file ?? filePath;
    walk(s.suites, file);
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        for (const res of t.results ?? []) {
          if (res.status === "passed" || res.status === "skipped") continue;
          failures.push({
            title: spec.title,
            file: spec.file ?? file,
            line: spec.line,
            projectName: t.projectName,
            status: res.status,
            retry: res.retry,
            durationMs: res.duration,
            error: {
              message: stripAnsi(res.error?.message),
              stack: stripAnsi(res.error?.stack)?.split("\n").slice(0, 12),
            },
            stdout: (res.stdout ?? [])
              .map((c) => stripAnsi(c.text ?? ""))
              .filter(Boolean)
              .slice(-10),
            attachments: (res.attachments ?? []).map((a) => ({
              name: a.name,
              path: a.path,
            })),
          });
        }
      }
    }
  }
}
walk(report.suites);

const out = {
  generatedAt: new Date().toISOString(),
  stats: report.stats,
  failureCount: failures.length,
  failures,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(
  `[filter-e2e-failures] ${failures.length} failing result(s) -> ${outPath}` +
    (failures.length === 0 ? " (all green: upload nothing)" : ""),
);
