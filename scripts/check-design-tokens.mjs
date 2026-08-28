#!/usr/bin/env node
/**
 * Design-token gate: every `var(--g3t-*)` reference must resolve to a
 * token something actually defines.
 *
 * CSS custom properties fail silently. A reference to a name nothing
 * emits falls back to its literal (`var(--g3t-accent, #2563eb)`), so
 * the component renders, looks deliberate, and ignores the theme
 * forever. Typecheck, lint, and tests all stay green. Nothing else in
 * the repository can see this class of defect, which is why it needs
 * its own gate rather than a lint rule.
 *
 * The defined set is DERIVED, never maintained by hand:
 *
 *   1. Global emitters. `injectDesignTokens` (core design-tokens.ts)
 *      and `injectCssVariables` (react ThemeManager.ts) are the only
 *      two functions that write tokens to :root. A hand-kept list here
 *      would drift from them within one round.
 *   2. Templated families. `--g3t-seq-${i}` / `--g3t-div-${i}` /
 *      `--g3t-type-${i}` are emitted in a loop, so the emitted names
 *      are not literals. Each becomes a `--g3t-seq-*` prefix.
 *   3. Local definitions. A custom property set on an element (inline
 *      `style={{ "--g3t-toggle-accent": accent }}` or a CSS rule that
 *      declares it) is a real definition scoped to that subtree. These
 *      are NOT global tokens and are NOT theme-driven, but they do
 *      resolve. Treating them as broken is a false positive: the
 *      PropertyField toggle accent is set at PropertyField.tsx and
 *      consumed at PropertyField.css, and works correctly.
 *
 * Exit non-zero on any unresolved reference.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/** Roots to scan for references. dist/ is build output, not source. */
const SCAN_ROOTS = ["packages", "src", "examples"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-types",
  "storybook-static",
  "docs-out",
  ".git",
]);
const SCAN_EXT = /\.(ts|tsx|css|js|jsx|mjs)$/;

/** The two global emitters, in the order a reader should meet them. */
const EMITTERS = [
  "packages/core/src/theme/design-tokens.ts",
  "packages/react/src/theme/ThemeManager.ts",
];

// ── File walk ───────────────────────────────────────────────────────

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(entry)) out.push(full);
  }
  return out;
}

// ── Defined set ─────────────────────────────────────────────────────

/** Literal emissions: setProperty("--g3t-foo", <source expr>) */
const RE_EMIT_LITERAL =
  /setProperty\(\s*["'`](--g3t-[a-z0-9-]+)["'`]\s*,\s*([^)]*?)\s*\)/gi;
/** Templated emissions: setProperty(`--g3t-seq-${i}`, ...) */
const RE_EMIT_TEMPLATE = /setProperty\(\s*`(--g3t-[a-z0-9-]*)\$\{/gi;

const globalTokens = new Set();
const globalPrefixes = new Set();
/** name -> { source, emitter } for the generated reference table. */
const tokenSource = new Map();

for (const rel of EMITTERS) {
  const abs = join(ROOT, rel);
  let src;
  try {
    src = readFileSync(abs, "utf-8");
  } catch {
    console.error(`check-design-tokens: emitter not found: ${rel}`);
    console.error(
      "  The gate derives its token set from this file. If it moved, " +
        "update EMITTERS rather than hand-listing tokens.",
    );
    process.exit(2);
  }
  // Assert the anchor exists: a refactor that renames setProperty or
  // routes injection through a helper would silently empty the defined
  // set and turn this gate green-by-vacuum.
  if (!RE_EMIT_LITERAL.test(src)) {
    console.error(
      `check-design-tokens: no setProperty("--g3t-*") calls found in ${rel}.`,
    );
    console.error(
      "  Refusing to run with an empty token set (that would pass everything).",
    );
    process.exit(2);
  }
  RE_EMIT_LITERAL.lastIndex = 0;

  for (const m of src.matchAll(RE_EMIT_LITERAL)) {
    globalTokens.add(m[1]);
    tokenSource.set(m[1], {
      source: m[2].replace(/\s+/g, " ").trim(),
      emitter: rel,
    });
  }
  for (const m of src.matchAll(RE_EMIT_TEMPLATE)) {
    globalPrefixes.add(m[1]);
    tokenSource.set(`${m[1]}*`, { source: "indexed scale", emitter: rel });
  }
}

// ── Local definitions (element-scoped custom properties) ────────────

/** JS/TSX object key: "--g3t-toggle-accent": value */
const RE_LOCAL_JS = /["'`](--g3t-[a-z0-9-]+)["'`]\s*:/gi;
/** CSS declaration: --g3t-foo: value (after var() uses are stripped) */
const RE_LOCAL_CSS = /(--g3t-[a-z0-9-]+)\s*:/gi;
/** Any reference: var(--g3t-foo ...) */
const RE_REF = /var\(\s*(--g3t-[a-z0-9-]+)/gi;

const files = SCAN_ROOTS.flatMap((r) => walk(join(ROOT, r)));

const localTokens = new Set();
/** name -> [{file, line}] */
const references = new Map();

for (const abs of files) {
  const src = readFileSync(abs, "utf-8");
  const rel = relative(ROOT, abs);
  const isCss = abs.endsWith(".css");

  // Strip var() uses before hunting declarations, so `var(--g3t-x)`
  // is never mistaken for a definition of --g3t-x.
  const withoutRefs = src.replace(/var\(\s*--g3t-[a-z0-9-]+/gi, "var(");
  const localRe = isCss ? RE_LOCAL_CSS : RE_LOCAL_JS;
  localRe.lastIndex = 0;
  for (const m of withoutRefs.matchAll(localRe)) localTokens.add(m[1]);

  // Collect references with line numbers.
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    RE_REF.lastIndex = 0;
    for (const m of lines[i].matchAll(RE_REF)) {
      const name = m[1];
      if (!references.has(name)) references.set(name, []);
      references.get(name).push({ file: rel, line: i + 1 });
    }
  }
}

// ── Resolve ─────────────────────────────────────────────────────────

function isDefined(name) {
  if (globalTokens.has(name)) return true;
  if (localTokens.has(name)) return true;
  for (const prefix of globalPrefixes) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}

const unresolved = [];
for (const [name, sites] of references) {
  if (isDefined(name)) continue;
  for (const site of sites) unresolved.push({ name, ...site });
}

unresolved.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

// ── Generated reference table ───────────────────────────────────────

/**
 * The vocabulary is undiscoverable without this. A consumer writing a
 * shell against plausible-but-absent names (`--g3t-color-bg`,
 * `--g3t-font-sans`) gets a surface that renders correctly, looks
 * deliberate, and ignores the theme, with every gate green. So the
 * table is generated from the emitters and drift-checked here rather
 * than hand-maintained.
 */
const DOC_PATH = "docs/design-tokens.md";
const GROUPS = [
  ["Color: surfaces and text", /^--g3t-(bg|border|text|canvas)/],
  [
    "Color: accent and semantic",
    /^--g3t-(accent|success|warning|error|selection-highlight|color-scheme)/,
  ],
  ["Color: graph elements", /^--g3t-(node|edge)/],
  ["Color: data scales", /^--g3t-(seq|div|type)-/],
  ["Typography", /^--g3t-(font|line-height)/],
  ["Spacing", /^--g3t-space-/],
  ["Radii", /^--g3t-radius-/],
  ["Shadows", /^--g3t-shadow-/],
  ["Motion", /^--g3t-(transition|ease)/],
  [
    "Focus and selection geometry",
    /^--g3t-(focus-ring|selection-|deemphasized)/,
  ],
  ["Layering", /^--g3t-z-/],
];

function renderDoc() {
  const all = [...globalTokens, ...[...globalPrefixes].map((p) => `${p}*`)];
  const claimed = new Set();
  const sections = [];

  for (const [title, re] of GROUPS) {
    const names = all.filter((n) => re.test(n)).sort();
    if (names.length === 0) continue;
    names.forEach((n) => claimed.add(n));
    const rows = names
      .map((n) => {
        const info = tokenSource.get(n) ?? { source: "" };
        return `| \`${n}\` | ${info.source} |`;
      })
      .join("\n");
    sections.push(
      `### ${title}\n\n| Token | Value source |\n| --- | --- |\n${rows}`,
    );
  }

  const rest = all.filter((n) => !claimed.has(n)).sort();
  if (rest.length > 0) {
    const rows = rest
      .map((n) => `| \`${n}\` | ${(tokenSource.get(n) ?? {}).source ?? ""} |`)
      .join("\n");
    sections.push(
      `### Other\n\n| Token | Value source |\n| --- | --- |\n${rows}`,
    );
  }

  return `<!-- GENERATED by scripts/check-design-tokens.mjs. Do not edit by hand. -->
# Design tokens

Every CSS custom property the toolkit emits to \`:root\`. This is the
whole vocabulary; a \`var(--g3t-*)\` name that is not on this list
resolves to nothing and silently falls back to its literal, which is
why \`pnpm run verify:tokens\` fails the build on one.

Two functions emit these, and this table is generated from them:

- \`injectDesignTokens()\` (\`@g3-toolkit/core\`) for the spatial,
  typographic, and scale constants. Call once at startup.
- \`injectCssVariables()\` (\`@g3-toolkit/react\`, via \`useThemeStore\`)
  for everything that changes with the active theme.

Values in the "source" column name the constant or theme field
supplying them, not the literal, since the theme-driven half changes
per theme.

## Guarantees

- **Names are stable within a major.** Treat them as public API.
- **Theme-driven tokens change at runtime.** Read them through
  \`var()\`; do not snapshot them into JS.
- \`--g3t-success-muted\`, \`--g3t-warning-muted\`, and
  \`--g3t-error-muted\` are optional on \`G3tTheme\`. A custom theme may
  omit them, in which case they are not emitted at all and your
  \`var()\` fallback applies. Always pass a fallback for these three.
- **Element-scoped properties are not tokens.** A component may set a
  custom property on its own subtree (\`--g3t-toggle-accent\` on
  \`PropertyField\`). Those are implementation detail, not vocabulary,
  and are absent from this table by design.

${sections.join("\n\n")}
`;
}

const generated = renderDoc();
const docAbs = join(ROOT, DOC_PATH);

if (process.argv.includes("--write-docs")) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(docAbs, generated, "utf-8");
  console.log(`check-design-tokens: wrote ${DOC_PATH}`);
}

let docDrifted = false;
try {
  if (readFileSync(docAbs, "utf-8") !== generated) docDrifted = true;
} catch {
  docDrifted = true;
}

// ── Report ──────────────────────────────────────────────────────────

const definedCount = globalTokens.size + globalPrefixes.size;
console.log(
  `check-design-tokens: ${definedCount} global tokens ` +
    `(${globalPrefixes.size} templated), ${localTokens.size} element-scoped, ` +
    `${references.size} distinct names referenced across ${files.length} files.`,
);

if (docDrifted) {
  console.error(
    `\ncheck-design-tokens: ${DOC_PATH} is out of sync with the emitters.\n` +
      "  Regenerate it:  node scripts/check-design-tokens.mjs --write-docs\n",
  );
}

if (unresolved.length === 0 && !docDrifted) {
  console.log("check-design-tokens: OK, every reference resolves.");
  process.exit(0);
}
if (unresolved.length === 0) process.exit(1);

console.error(
  `\ncheck-design-tokens: ${unresolved.length} reference(s) resolve to nothing:\n`,
);
const width = Math.max(...unresolved.map((u) => `${u.file}:${u.line}`.length));
for (const u of unresolved) {
  console.error(`  ${`${u.file}:${u.line}`.padEnd(width)}  ${u.name}`);
}
console.error(
  "\nEach falls back to its literal, so it renders but ignores the theme.\n" +
    "Fix by pointing at an emitted token, or by emitting the missing one\n" +
    "from injectDesignTokens / injectCssVariables.\n",
);
process.exit(1);
