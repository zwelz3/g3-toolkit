/**
 * Rewrite relative import specifiers in emitted .d.ts files so they
 * resolve under TypeScript's node16/nodenext module resolution.
 *
 * tsc emits declarations with the source's extensionless bundler-style
 * specifiers (`from "./ugm"`). node16 ESM resolution requires explicit
 * extensions, so external consumers on node16 get TS2834/TS2835 from
 * inside our own declarations. This script resolves each relative
 * specifier against the emitted dist/ tree and appends the correct
 * suffix:
 *
 *   ./ugm        → ./ugm/index.js   (directory with index.d.ts)
 *   ./ugm/types  → ./ugm/types.js   (sibling .d.ts)
 *
 * TS maps the .js suffix back to the adjacent .d.ts declaration.
 * Runs as the final step of build:packages.
 *
 * KNOWN LIMITATION (documented in CHANGELOG): typed consumption from
 * CommonJS under node16 (`require("@g3t/core")` in a TS .cts file)
 * still fails with TS1479 because the packages emit a single
 * ESM-flavored .d.ts per entry. Runtime CJS works (verify:smoke).
 * The durable fix is per-entry declaration bundling (.d.ts + .d.cts);
 * tracked in planning/audit-remediation.md.
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPECIFIER = /(from\s+|import\()\s*(["'])(\.{1,2}\/[^"']+)\2/g;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith(".d.ts")) yield p;
  }
}

let rewritten = 0;
for (const pkg of readdirSync(resolve(root, "packages"))) {
  const dist = resolve(root, "packages", pkg, "dist");
  if (!existsSync(dist)) continue;
  for (const file of walk(dist)) {
    const dir = dirname(file);
    let changed = false;
    const out = readFileSync(file, "utf-8").replace(
      SPECIFIER,
      (whole, prefix, quote, spec) => {
        if (/\.(js|mjs|cjs|json|css)$/.test(spec)) return whole;
        const target = resolve(dir, spec);
        let fixed = null;
        if (existsSync(target + ".d.ts")) {
          fixed = spec + ".js";
        } else if (
          existsSync(target) &&
          statSync(target).isDirectory() &&
          existsSync(join(target, "index.d.ts"))
        ) {
          fixed = spec.replace(/\/$/, "") + "/index.js";
        }
        if (!fixed) return whole; // leave unresolvable specifiers untouched
        changed = true;
        return `${prefix}${quote}${fixed}${quote}`;
      },
    );
    if (changed) {
      writeFileSync(file, out);
      rewritten++;
    }
  }
}
console.log(
  `fix-dts-extensions: rewrote specifiers in ${rewritten} declaration file(s)`,
);
