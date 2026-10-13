#!/usr/bin/env node
/**
 * Release gate: an OPTIONAL peer dependency must not be statically
 * imported by any entry point that is not opted in to it.
 *
 * `peerDependenciesMeta.<name>.optional` tells the package manager not
 * to install that peer. Module resolution runs BEFORE tree-shaking, so
 * a bare specifier surviving into a chunk that the root barrel imports
 * makes the very first `import { Anything } from "@g3-toolkit/react"` throw
 * ERR_MODULE_NOT_FOUND for every consumer who took the documented
 * install. Tree-shaking cannot save it: the specifier has to resolve
 * before the bundler ever gets to decide the binding is unused.
 *
 * This is invisible to smoke-test.mjs, which imports dist from inside
 * the workspace, where the optional peers ARE installed because the
 * repo needs them to build and test the opt-in view.
 *
 * The check walks the real emitted import graph (relative specifiers,
 * both ESM and CJS) out of each declared subpath, so it sees shared
 * chunks. A module reachable from two entries gets hoisted into a
 * common chunk, which is exactly how vis-timeline reached the root
 * barrel while appearing to live under views/timeline/.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");

/**
 * Which subpaths are ALLOWED to import which optional peer. Anything
 * absent from this map may import none of them.
 *
 * This list is deliberately hand-maintained: adding a subpath here is
 * the decision to make an adopter install an extra dependency to use
 * it, and that decision should show up in a diff.
 */
const OPT_IN = {
  "@g3-toolkit/react": {
    "vis-timeline": ["./timeline"],
    "vis-data": ["./timeline"],
  },
};

/**
 * REQUIRED peers that every entry point must reach LAZILY, through
 * `import()`, never through a static `import ... from`. The value is
 * the list of subpaths allowed to import the peer statically (a
 * dedicated entry like `./timeline` would go here); empty means none.
 *
 * Different hazard from OPT_IN. These peers ARE installed, so nothing
 * fails to resolve. The cost is weight: echarts is about 1.1 MB
 * minified and its entry registers every chart type as a side effect,
 * so a host bundler cannot shake an unused `import * as echarts`. The
 * two echarts-backed views (StatsPanel, SankeyView) share helpers with
 * CytoscapeCanvas, and rollup hoists a module shared by two entries
 * into one common chunk; while they imported echarts statically, the
 * chunk that exported CytoscapeCanvas carried that import, and a host
 * using only the canvas shipped all of echarts (issue #25: 1.99 MB
 * graph chunk, 855 KB with echarts aliased away). A dynamic import
 * inside the view keeps the public import paths and lets the host
 * code-split echarts into a chunk fetched only when a chart mounts.
 *
 * The walk follows STATIC edges only: a chunk reached through
 * `import()` is itself lazy, so whatever it imports statically is
 * paid only when it loads.
 */
const LAZY_PEERS = {
  "@g3-toolkit/react": {
    echarts: [],
  },
};

const ESM_FROM = /\bfrom\s*["']([^"']+)["']/g;
const ESM_BARE = /\bimport\s*["']([^"']+)["']/g;
const ESM_DYNAMIC = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const CJS_REQUIRE = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

const STATIC_FORMS = [ESM_FROM, ESM_BARE, CJS_REQUIRE];
const ALL_FORMS = [...STATIC_FORMS, ESM_DYNAMIC];

function specifiersIn(text, forms = ALL_FORMS) {
  const out = new Set();
  for (const re of forms) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.add(m[1]);
  }
  return out;
}

/**
 * Every file reachable from `entry` by relative specifier, plus the
 * bare ones. `forms` selects which import forms count as edges:
 * everything for the optional-peer check (an optional peer behind an
 * `import()` still throws the moment it runs), static forms only for
 * the lazy-peer check. `bareBy` records which file carried each bare
 * specifier so a failure can name the chunk.
 */
function reachable(entry, forms = ALL_FORMS) {
  const files = new Set();
  const bare = new Set();
  const bareBy = new Map();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (files.has(file) || !existsSync(file)) continue;
    files.add(file);
    for (const spec of specifiersIn(readFileSync(file, "utf8"), forms)) {
      if (spec.startsWith(".")) queue.push(resolve(dirname(file), spec));
      else {
        bare.add(spec);
        if (!bareBy.has(spec)) bareBy.set(spec, file);
      }
    }
  }
  return { files, bare, bareBy };
}

/** The runtime entry files a subpath resolves to, relative to the package. */
function runtimeEntries(target) {
  const entries = [];
  if (typeof target === "object" && target !== null) {
    for (const key of ["import", "require", "default"]) {
      const value = target[key];
      if (typeof value === "string" && /\.(mjs|cjs|js)$/.test(value)) {
        entries.push(value);
      }
    }
  }
  return entries;
}

function matches(spec, pkgName) {
  return spec === pkgName || spec.startsWith(`${pkgName}/`);
}

const failures = [];
let checkedEntries = 0;
let checkedPeers = 0;
let checkedLazy = 0;

for (const dir of readdirSync(packagesDir)) {
  const pkgDir = join(packagesDir, dir);
  const manifestPath = join(pkgDir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (pkg.private === true) continue;

  const optional = Object.entries(pkg.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta?.optional === true)
    .map(([name]) => name);
  const lazy = LAZY_PEERS[pkg.name] ?? {};
  const lazyPeers = Object.keys(lazy);
  if (optional.length === 0 && lazyPeers.length === 0) continue;
  checkedPeers += optional.length;
  checkedLazy += lazyPeers.length;

  const optIn = OPT_IN[pkg.name] ?? {};
  // An opt-in entry naming a subpath the manifest does not export is a
  // stale allowance, and a stale allowance is how this regresses.
  for (const [peer, subpaths] of Object.entries(optIn)) {
    if (!optional.includes(peer)) {
      failures.push(
        `${pkg.name}: opt-in list names ${peer}, which is not an optional peer`,
      );
    }
    for (const subpath of subpaths) {
      if (!(subpath in (pkg.exports ?? {}))) {
        failures.push(
          `${pkg.name}: opt-in list names ${subpath}, which the exports map does not declare`,
        );
      }
    }
  }
  // Same staleness rule for the lazy list: the peer must be a declared
  // peer (a lazily loaded module that nothing installs is a runtime
  // throw), and every allowance must name a real subpath.
  for (const [peer, subpaths] of Object.entries(lazy)) {
    if (!(peer in (pkg.peerDependencies ?? {}))) {
      failures.push(
        `${pkg.name}: lazy-peer list names ${peer}, which is not a declared peer`,
      );
    }
    for (const subpath of subpaths) {
      if (!(subpath in (pkg.exports ?? {}))) {
        failures.push(
          `${pkg.name}: lazy-peer list names ${subpath}, which the exports map does not declare`,
        );
      }
    }
  }

  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    if (subpath === "./package.json") continue;
    for (const rel of runtimeEntries(target)) {
      const abs = join(pkgDir, rel);
      if (!existsSync(abs)) continue; // check-package-exports owns absence
      checkedEntries += 1;
      const { bare } = reachable(abs);
      for (const peer of optional) {
        const allowed = optIn[peer] ?? [];
        if (allowed.includes(subpath)) continue;
        const hit = [...bare].find((spec) => matches(spec, peer));
        if (hit) {
          failures.push(
            `${pkg.name} "${subpath}" (${relative(root, abs)}) statically imports "${hit}", ` +
              `an optional peer. A consumer who did not install ${peer} cannot load this entry point. ` +
              `Move the importing module behind a subpath listed in OPT_IN, or make ${peer} required.`,
          );
        }
      }
      if (lazyPeers.length === 0) continue;
      const staticReach = reachable(abs, STATIC_FORMS);
      for (const peer of lazyPeers) {
        if (lazy[peer].includes(subpath)) continue;
        const hit = [...staticReach.bare].find((spec) => matches(spec, peer));
        if (hit) {
          const carrier = relative(root, staticReach.bareBy.get(hit));
          failures.push(
            `${pkg.name} "${subpath}" (${relative(root, abs)}) statically reaches "${hit}" ` +
              `through ${carrier}. ${peer} must be loaded with import() so a host that never ` +
              `mounts a chart does not bundle it; a static import in a shared chunk is paid by ` +
              `every consumer of that chunk. Load it lazily inside the view, or give the view ` +
              `its own entry and list that subpath in LAZY_PEERS.`,
          );
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Optional-peer check FAILED:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `Optional peers: ${checkedPeers} optional peer(s), ${checkedLazy} lazy peer(s), ` +
    `${checkedEntries} entry point(s) walked, no unguarded static import.`,
);
