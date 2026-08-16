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
 *
 * Placeholders: a snippet stands for code an adopter writes, so it
 * names things the adopter owns (`ugm`, `cy`, `orgSettings`) without
 * declaring them. Those names are declared as `any` in a generated
 * ambient file, PLACEHOLDERS below. Toolkit symbols are deliberately
 * NOT in that list: a snippet that uses one must import it, which is
 * what makes a removed or renamed export fail this gate. Adding a
 * toolkit name to PLACEHOLDERS would defeat the check, so do not.
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
  // The wiring guide is the adopter surface, so its snippets rot the
  // same way the quickstarts did: it carried working recipes for a
  // collapse API that had been removed by ruling months earlier, and
  // nothing failed. Its executable twins in examples/wiring/src/ run
  // under the test gate, but nothing ties a fence to a twin, so a
  // snippet added without one was unchecked. This gate covers the
  // fences themselves.
  "docs/wiring-guide.md",
];

const FENCE = /```(tsx?)([^\n`]*)\n([\s\S]*?)```/g;

/**
 * The Pages landing page is HTML, not markdown, and its Quick Start is
 * a stranger's literal first copy-paste, so it belongs in this gate for
 * the same reason the READMEs do. Opt a `<pre>` in by tagging it
 * `data-snippet="ts"` or `data-snippet="tsx"`; the bash blocks stay
 * out. This catches a snippet that no longer compiles. It does NOT
 * catch a missing side-effect import: the stylesheet line that page was
 * shipped without compiles fine either way, and no typechecker can tell
 * you the views will render unstyled.
 */
const HTML_FILES = ["docs/landing.html"];
const HTML_SNIPPET = /<pre data-snippet="(tsx?)">([\s\S]*?)<\/pre>/g;
const unhtml = (s) =>
  s
    // Comment spans are presentation, not code.
    .replace(/<\/?span[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Last: an escaped ampersand must not re-introduce another entity.
    .replace(/&amp;/g, "&");

/**
 * Names the docs use for things the ADOPTER owns: their graph, their
 * Cytoscape handle, their settings, their router, their components.
 * Host-side only. See the header note before adding anything here.
 */
const PLACEHOLDERS = {
  // The adopter's graph. Typed for real, not `any`: the snippets call
  // methods on it, and those calls are worth checking.
  ugm: "UGM",
  shapeUgm: "UGM",
  big: "UGM",
  // Everything else is the adopter's own code and has no toolkit type.
  caseId: "any",
  cy: "any",
  DossierLookup: "any",
  initialSpec: "any",
  logError: "any",
  navigate: "any",
  orgSettings: "any",
  processEngine: "any",
  rdfGraph: "any",
  result: "any",
  riskViewSpec: "any",
  saved: "any",
  saveToCase: "any",
  seededRng: "any",
  selectedIds: "any",
  selection: "any",
  setSpec: "any",
  shapes: "any",
  spec: "any",
  validationResults: "any",
};
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
    const name = `${readme.replace(/[/.]/g, "_")}_${i}.${lang}`;
    // Wrap in a module scope; allow snippets that are component bodies.
    writeFileSync(resolve(dir, name), body);
    files.push(name);
  }
}

for (const page of HTML_FILES) {
  const text = readFileSync(resolve(root, page), "utf-8");
  let i = 0;
  let found = 0;
  for (const [, lang, body] of text.matchAll(HTML_SNIPPET)) {
    i++;
    found++;
    const name = `${page.replace(/[/.]/g, "_")}_${i}.${lang}`;
    writeFileSync(resolve(dir, name), unhtml(body));
    files.push(name);
  }
  // A renamed attribute would silently drop the page from the gate.
  if (found === 0) {
    console.error(`check-readme-snippets: no data-snippet blocks in ${page}`);
    process.exit(1);
  }
}

if (files.length === 0) {
  console.log("check-readme-snippets: no ts/tsx blocks found");
  process.exit(0);
}

// Ambient host-side placeholders. `any` on purpose: the point is not
// to typecheck the adopter's own values, it is to keep an undeclared
// TOOLKIT symbol from hiding among them.
writeFileSync(
  resolve(dir, "_placeholders.d.ts"),
  [
    'import type { UGM } from "@g3t/core";',
    "declare global {",
    ...Object.entries(PLACEHOLDERS).map(
      ([name, type]) => `  const ${name}: ${type};`,
    ),
    "}",
    "export {};",
    "",
  ].join("\n"),
);
const snippetCount = files.length;
files.push("_placeholders.d.ts");

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
    `check-readme-snippets: ${snippetCount} snippet(s) typecheck cleanly`,
  );
  rmSync(dir, { recursive: true, force: true });
} catch (err) {
  console.error("README snippet typecheck FAILED:");
  console.error(String(err.stdout ?? err.message));
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
