/**
 * Stamp the Pages landing page with the current version, commit, and build
 * time, then write it to the deploy output.
 *
 * `docs:build` used to copy `docs/landing.html` to `docs-out/index.html`
 * verbatim, so the deployed page carried no build identity and a stranger
 * (or a reviewer) could not tell which commit the live site was serving.
 * This replaces that copy: the footer in `docs/landing.html` holds
 * `__VERSION__`, `__BUILD_SHA__`, and `__BUILD_DATE__` placeholders, and this
 * script substitutes them on every deploy. The source file keeps the
 * placeholders (it is a template, never the served artifact), so nothing to
 * commit drifts per build.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const version = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf-8"),
).version;

let sha = "nogit";
try {
  sha = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
} catch {
  // Not a git checkout (e.g. an extracted tarball); leave the sentinel.
}

const buildDate =
  new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";

const src = resolve(root, "docs/landing.html");
const out = resolve(root, "docs-out/index.html");

let html = readFileSync(src, "utf-8");
for (const [token, value] of [
  ["__VERSION__", version],
  ["__BUILD_SHA__", sha],
  ["__BUILD_DATE__", buildDate],
]) {
  if (!html.includes(token)) {
    console.error(`stamp-landing: placeholder ${token} not found in ${src}`);
    process.exit(1);
  }
  html = html.replaceAll(token, value);
}

writeFileSync(out, html);
console.log(
  `stamp-landing: wrote ${out} (V${version} · ${sha} · ${buildDate})`,
);
