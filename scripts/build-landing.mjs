/**
 * Keep the Pages landing page's playground description honest.
 *
 * `docs:build` copies `docs/landing.html` to `docs-out/index.html`, so
 * that card is the first description of the product a stranger reads.
 * It was hand-maintained, and it drifted: it named a "data science" and
 * a "healthcare" shell that no longer exist while omitting five that
 * do, so the sentence matched no build of the app.
 *
 * The surface list is now generated from the demo sources between the
 * SURFACES markers in the HTML. `--update` rewrites the file; the
 * default is a check that fails when the committed HTML no longer
 * matches the sources, which is what `verify:landing` runs.
 *
 * Two source facts feed it. `DemoLanding.tsx` owns the titles and the
 * dev/prod visibility gate; `Demo.tsx`'s SHELL_MAP owns which ids
 * actually resolve to a shell. Both are read with asserted anchors, so
 * a rename upstream fails here loudly instead of emitting a quietly
 * short list.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(resolve(root, rel), "utf-8");

const fail = (msg) => {
  console.error(`build-landing: ${msg}`);
  process.exit(1);
};

/** Slice a top-level literal's body, or die naming the anchor. */
function literalBody(source, anchor, close, where) {
  const start = source.indexOf(anchor);
  if (start === -1) fail(`anchor not found in ${where}: ${anchor}`);
  const from = start + anchor.length;
  const end = source.indexOf(close, from);
  if (end === -1) fail(`unterminated literal after ${anchor} in ${where}`);
  return source.slice(from, end);
}

const landingSrc = read("src/demo/DemoLanding.tsx");
const demoSrc = read("src/demo/Demo.tsx");

/** `{ id, title }` in declaration order. */
function surfaces(anchor) {
  const body = literalBody(
    landingSrc,
    anchor,
    "\n];",
    "src/demo/DemoLanding.tsx",
  );
  const found = [
    ...body.matchAll(/\bid:\s*"([^"]+)",\s*\n\s*title:\s*"([^"]+)"/g),
  ];
  if (found.length === 0) fail(`no id/title pairs under ${anchor}`);
  return found.map(([, id, title]) => ({ id, title }));
}

const scenarios = surfaces("export const SCENARIOS: Scenario[] = [");
const capabilities = surfaces(
  "export const CAPABILITY_SURFACES: Scenario[] = [",
);
const all = [...scenarios, ...capabilities];

// Which ids resolve to a shell. A surface card with no SHELL_MAP entry
// sends the visitor back to the landing (Demo.tsx's unknown-id
// fallback), so it must not be advertised here.
const shellMap = literalBody(
  demoSrc,
  "const SHELL_MAP: Record<string, ShellLoader> = {",
  "\n};",
  "src/demo/Demo.tsx",
);
// Exactly two spaces of indent: the entries are loader arrows now, and
// the `default:` inside each one sits deeper. Prettier owns this file's
// indentation, so the depth is stable.
const shellIds = new Set(
  [...shellMap.matchAll(/^ {2}"?([\w-]+)"?:/gm)].map(([, id]) => id),
);
if (shellIds.size === 0) fail("no entries parsed out of SHELL_MAP");

const unshelled = all.filter((s) => !shellIds.has(s.id));
if (unshelled.length > 0) {
  fail(
    `surface(s) with no SHELL_MAP entry: ${unshelled.map((s) => s.id).join(", ")}`,
  );
}
const uncarded = [...shellIds].filter((id) => !all.some((s) => s.id === id));
if (uncarded.length > 0) {
  fail(`SHELL_MAP entr(ies) no card offers: ${uncarded.join(", ")}`);
}

// The dev/prod gate, asserted rather than assumed: Pages serves a
// production build, so a dev-only surface must not be promised here,
// and a prod-only one must not be silently dropped from the sentence.
const GATES = [
  {
    id: "scale",
    line: `if (id === "scale") return !import.meta.env.DEV;`,
    in: "prod",
  },
  {
    id: "style-lab",
    line: `if (id === "style-lab") return import.meta.env.DEV;`,
    in: "dev",
  },
  {
    id: "routing-explain",
    line: `if (id === "routing-explain") return import.meta.env.DEV;`,
    in: "dev",
  },
];
for (const gate of GATES) {
  if (!landingSrc.includes(gate.line)) {
    fail(
      `visibility gate for "${gate.id}" changed shape; re-read surfaceVisibleHere and update GATES here`,
    );
  }
}
const devOnly = new Set(GATES.filter((g) => g.in === "dev").map((g) => g.id));
const deployed = all.filter((s) => !devOnly.has(s.id));

const COUNT_WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];
const count = COUNT_WORDS[deployed.length] ?? String(deployed.length);
const titles = deployed.map((s) => s.title).join(", ");

// Both halves of the dev/prod difference, which was documented nowhere
// a visitor could see it. Someone who reads this page and then clones
// the repo gets a different set of surfaces, and should know why.
const titlesFor = (where) =>
  GATES.filter((g) => g.in === where)
    .map((g) => all.find((s) => s.id === g.id)?.title ?? g.id)
    .join(" and ");
const gated = [
  titlesFor("dev") && `${titlesFor("dev")} is dev-only`,
  titlesFor("prod") && `${titlesFor("prod")} is deployment-only`,
]
  .filter(Boolean)
  .join(" and ");

const sentence = [
  `${count} surfaces driving the graph canvas: ${titles}.`,
  ...(gated
    ? [`${gated}, so <code>pnpm run dev</code> shows a different set.`]
    : []),
].join(" ");

// Wrapped and indented to sit inside the card's <p> without standing
// out from the hand-written prose around it.
const INDENT = " ".repeat(12);
const lines = [];
for (const word of sentence.split(" ")) {
  if (lines.length === 0 || `${lines.at(-1)} ${word}`.length > 78) {
    lines.push(INDENT + word);
  } else {
    lines[lines.length - 1] += ` ${word}`;
  }
}
const generated = lines.join("\n");

const BEGIN = "<!-- SURFACES:BEGIN generated by scripts/build-landing.mjs -->";
const END = "<!-- SURFACES:END -->";
const htmlPath = "docs/landing.html";
const html = read(htmlPath);

// Every `blob/main/...` link must name a path that exists here. The
// page shipped a 404 into a tree that had been untracked months
// earlier, and a landing page is the one surface where nobody who
// could fix a dead link is the one clicking it.
const REPO_LINK =
  /href="https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/main\/([^"]*)"/g;
const dead = [...html.matchAll(REPO_LINK)]
  .map(([, path]) => path)
  .filter((path) => path !== "" && !existsSync(resolve(root, path)));
if (dead.length > 0) {
  fail(`${htmlPath} links to path(s) absent from the repo: ${dead.join(", ")}`);
}
const begin = html.indexOf(BEGIN);
const end = html.indexOf(END);
if (begin === -1 || end === -1 || end < begin) {
  fail(`marker pair not found in ${htmlPath}; expected ${BEGIN} ... ${END}`);
}
const next =
  html.slice(0, begin + BEGIN.length) +
  "\n" +
  generated +
  "\n            " +
  html.slice(end);

if (next === html) {
  console.log(
    `build-landing: ${htmlPath} matches the demo sources (${deployed.length} deployed surface(s))`,
  );
  process.exit(0);
}
if (process.argv.includes("--update")) {
  writeFileSync(resolve(root, htmlPath), next);
  console.log(`build-landing: rewrote ${htmlPath}`);
  process.exit(0);
}
console.error(
  `${htmlPath} no longer matches the demo sources. Expected between the SURFACES markers:\n\n${generated}\n\nRun: node scripts/build-landing.mjs --update`,
);
process.exit(1);
