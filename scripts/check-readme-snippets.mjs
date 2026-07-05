/**
 * Typecheck the fenced ts/tsx code blocks in the README files.
 *
 * The v1.0.0-rc audit found that both quickstart examples were broken
 * as written (wrong SparqlAdapter constructor shape, missing React
 * imports, getters called as methods). Front-door snippets that fail
 * immediately are disproportionately costly to adoption, so they are
 * now gated: every ```ts / ```tsx block in the listed READMEs must
 * typecheck against the real package types.
 *
 * Resolution: snippets are written into a scratch dir inside the repo
 * so @g3t/* resolve through the pnpm workspace links (the same path
 * an external consumer exercises via the exports map). Requires
 * build:packages to have run; `verify` orders this correctly.
 *
 * Escape hatch: blocks tagged ```ts no-check (or ```tsx no-check)
 * are skipped, for intentionally illustrative fragments.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const READMES = [
  "README.md",
  "packages/core/README.md",
  "packages/react/README.md",
  "packages/charts/README.md",
];

const FENCE = /```(tsx?)([^\n`]*)\n([\s\S]*?)```/g;
const dir = resolve(root, ".verify-snippets");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const files = [];
for (const readme of READMES) {
  const text = readFileSync(resolve(root, readme), "utf-8");
  let i = 0;
  for (const match of text.matchAll(FENCE)) {
    const [, lang, info, body] = match;
    i++;
    if (/\bno-check\b/.test(info)) continue;
    const name = `${readme.replace(/[\/.]/g, "_")}_${i}.${lang}`;
    // Wrap in a module scope; allow snippets that are component bodies.
    writeFileSync(resolve(dir, name), body);
    files.push(name);
  }
}

if (files.length === 0) {
  console.log("check-readme-snippets: no ts/tsx blocks found");
  process.exit(0);
}

writeFileSync(
  resolve(dir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        jsx: "react-jsx",
        types: [],
        // Snippets are fragments, not applications:
        noUnusedLocals: false,
        allowUnreachableCode: true,
      },
      files,
    },
    null,
    2,
  ),
);

try {
  // Spawn node with TypeScript's JS entry instead of the .bin shim:
  // patched Node (CVE-2024-27980) throws EINVAL when spawning .cmd/.bat
  // on Windows without a shell, and a shell brings quoting hazards;
  // node + tsc.js is shell-free and identical on every platform.
  execFileSync(
    process.execPath,
    [
      createRequire(resolve(root, "package.json")).resolve(
        "typescript/lib/tsc.js",
      ),
      "-p",
      dir,
    ],
    { stdio: "pipe", cwd: root },
  );
  console.log(
    `check-readme-snippets: ${files.length} snippet(s) typecheck cleanly`,
  );
  rmSync(dir, { recursive: true, force: true });
} catch (err) {
  console.error("README snippet typecheck FAILED:");
  console.error(String(err.stdout ?? err.message));
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
