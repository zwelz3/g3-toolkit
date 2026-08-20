#!/usr/bin/env node
/**
 * Consumer-cost budget: what an adopter's bundle actually grows by.
 *
 * `check-bundle-size.mjs` sums every emitted file in a package's
 * `dist/`. That is PUBLISH WEIGHT, and for a package declaring
 * `sideEffects: false` it is not what any consumer downloads. Measured
 * 2026-08-15 against the built packages: a consumer importing only
 * `UGM` pulls a bundle with zero layout code in it (no dagre, no elk,
 * no quadtree, no force simulation), while one importing the layout
 * engines pulls all of it. Layout costs 106 KB with its own
 * dependencies bundled, or 35 KB of first-party code by the measure
 * below, and exactly nothing when it is not referenced.
 *
 * That measurement retired a standing recommendation. The bundle
 * ledger had been proposing, across four budget raises, that layout be
 * extracted into a separate `@g3t/layout` package to "bring core back
 * under its original envelope". It would have moved the publish-weight
 * number without changing any adopter's cost, while adding a fourth
 * tarball and a fourth publish to a release sequence that already has
 * two unrecoverable failure windows. Tree-shaking was already doing the
 * job the extraction was proposed to do.
 *
 * So this file budgets the number that means something. Each scenario
 * is an import a real adopter writes, bundled with rollup through
 * vite's API (the same bundler that emits the packages, so the
 * measurement matches the artifact rather than approximating it).
 *
 * ## What is counted
 *
 * FIRST-PARTY bytes only. Bare specifiers other than `@g3t/*` are
 * marked external, because `graphology`, `cytoscape` and React are
 * costs the adopter has already accepted and their weight would swamp
 * the signal: a 200 KB graphology baseline makes a 3 KB first-party
 * regression invisible. `@g3t/*` is aliased to the built dist rather
 * than externalized, so a react scenario correctly pays for the core
 * code it pulls in.
 *
 * Cross-check: `check-bundle-size.mjs` still runs and still budgets
 * publish weight. Keep both. Total dist catches things this cannot,
 * like an accidental `node_modules` inclusion or a dependency swap,
 * and it catches them cheaply.
 *
 * ## Budgets
 *
 * Set from the measured value with headroom stated per line. Raising
 * one needs the same treatment as the other ledger: a note, in the
 * same commit, saying what grew and why. A raise here is more serious
 * than a raise there, because this number is somebody's page load.
 *
 * Exit codes:
 *   0  every scenario within budget
 *   1  any scenario over, or a scenario failed to build
 */
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORE = join(ROOT, "packages/core/dist/index.mjs");
const REACT = join(ROOT, "packages/react/dist/index.mjs");

/**
 * One scenario per import an adopter actually writes.
 *
 * `budget` is bytes. The comment on each says what it is defending.
 */
const SCENARIOS = [
  {
    id: "core-ugm",
    label: "UGM only",
    // The data-model-only consumer: builds a graph, renders it with
    // something else entirely. The floor for anything using this
    // library at all, so growth here is paid by every single adopter.
    // Measured 4.8 KB. Budget 6.0 KB: tight on purpose, because every
    // adopter pays this one and it should be hard to grow quietly.
    budget: 6 * 1024,
    code: `import { UGM } from "@g3t/core";\nexport const g = new UGM();\n`,
  },
  {
    id: "core-adapter",
    label: "UGM + SparqlAdapter",
    // The README quickstart's core half.
    // Measured 11.3 KB.
    budget: 13 * 1024,
    code:
      `import { UGM, SparqlAdapter } from "@g3t/core";\n` +
      `export const g = new UGM();\n` +
      `export const a = new SparqlAdapter("http://x");\n`,
  },
  {
    id: "core-layout",
    label: "UGM + layout engines",
    // The scenario that retired the @g3t/layout extraction. If this
    // ever collapses toward core-ugm, tree-shaking broke; if core-ugm
    // ever climbs toward this, something made layout unconditionally
    // reachable and THAT is the regression the extraction was aimed at.
    // Measured 46.1 KB, of which roughly 35 KB is the layout engines.
    // RAISED 52 -> 69 KB, 2026-08-17 (merge of the ai-agent-guide
    // routing arc). Measured 66.0 KB. G3tLayeredLayout now pulls the
    // whole g3t routing chain that arc built: g3t-routing (the A*
    // obstacle router plus the VR-10 travel-band collision fix),
    // g3t-nudging, g3t-dummy-chain, g3t-channel-router and
    // g3t-fallback-classifier. That is roughly 20 KB of new first-party
    // compute reachable from naming a layout engine, and it is
    // reachable because it IS the layout engine: the router is not an
    // optional add-on to G3tLayeredLayout, it is how that engine emits
    // edge geometry. Splitting it back out would mean a layout that
    // returns node boxes and no routes, which is not the product.
    // RAISED 69 -> 76 KB, 2026-08-20 (post-merge routing hardening:
    // crossing-aware relayout seeded untangle, nudging second arms-only
    // pass for K(n,n) storms, grazeTolerance inset on the crossing
    // decision). Measured 72.9 KB. All additions live inside
    // g3t-nudging and route-scene-edges, both reachable only from
    // G3tLayeredLayout. core-ugm held at 4.8 KB confirming no leak.
    // Headroom 3.1 KB.
    budget: 76 * 1024,
    code:
      `import { UGM, ForceLayout, G3tLayeredLayout } from "@g3t/core";\n` +
      `export const g = new UGM();\n` +
      `export const l = [ForceLayout, G3tLayeredLayout];\n`,
  },
  {
    id: "core-all",
    label: "@g3t/core root barrel",
    // Worst case for core: an adopter who imports the barrel and uses
    // everything. Close to publish weight by construction.
    // Measured 141.3 KB.
    // RAISED 155 -> 182 KB, 2026-08-17 (merge of the ai-agent-guide
    // feature arc). Measured 178.9 KB. This scenario is `export * from
    // "@g3t/core"`, so it prices the barrel with nothing shaken out,
    // and the arc added routing (see core-layout above), FDEB edge
    // bundling, projection pseudo-nodes, RDF 1.2 hyperarc projection
    // and scene-edge routing. +37.6 KB, tracking the publish-weight
    // raise in check-bundle-size.mjs (163.8 -> 206.3) as it should.
    // RAISED 182 -> 194 KB, 2026-08-20 (post-merge routing hardening,
    // same additions as core-layout above). Measured 189.4 KB.
    // Headroom 4.6 KB.
    //
    // Read this number as the CEILING, not as what an adopter pays.
    // Every one of those additions is a named export in a
    // `sideEffects: false` package, so an adopter who does not import
    // bundleEdges pays nothing for it; the two scenarios above are the
    // honest readings for real import shapes, and both moved far less.
    // This line existing is the reason the @g3t/layout extraction was
    // retired rather than reinstated when the routing arc landed.
    budget: 194 * 1024,
    code: `export * from "@g3t/core";\n`,
  },
  {
    id: "react-canvas",
    label: "CytoscapeCanvas",
    // The documented quickstart's view half, and the single most
    // common react import. Externals are peers the adopter installs;
    // what is counted is g3t's own code, core's included.
    // Measured 81.4 KB, core's contribution included.
    // RAISED 92 -> 98 KB, 2026-08-20. Measured 94.6 KB. Growth from
    // RoutingControlStrip shared component (brief 26 demo coherence)
    // landing in CytoscapeCanvas's dependency tree, and from the
    // nudging/relayout additions visible in core-layout above.
    // Headroom 3.4 KB.
    budget: 98 * 1024,
    code: `export { CytoscapeCanvas } from "@g3t/react";\n`,
  },
];

/** Sum every emitted file in a directory. */
function dirBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    total += st.isDirectory() ? dirBytes(full) : st.size;
  }
  return total;
}

function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

let build;
try {
  ({ build } = await import("vite"));
} catch (cause) {
  console.error(
    `check-consumer-cost: could not load vite (${cause.message}). This gate ` +
      `bundles with the same rollup that emits the packages; without it the ` +
      `measurement would not match the artifact, so it fails rather than skips.`,
  );
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "g3t-consumer-cost-"));
const results = [];

try {
  for (const scenario of SCENARIOS) {
    const entry = join(work, `${scenario.id}.js`);
    writeFileSync(entry, scenario.code);
    const outDir = join(work, `out-${scenario.id}`);

    await build({
      logLevel: "error",
      configFile: false,
      // Exclude the project's publicDir (favicon images etc.) so dirBytes
      // counts only emitted JS. Without this, vite copies public/ into every
      // outDir and inflates every scenario by the same constant offset.
      publicDir: false,
      resolve: {
        alias: [
          { find: /^@g3t\/core$/, replacement: CORE },
          { find: /^@g3t\/react$/, replacement: REACT },
        ],
      },
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        write: true,
        lib: { entry, formats: ["es"], fileName: scenario.id },
        rollupOptions: {
          // Everything the adopter already installs is external. What
          // remains is g3t's own bytes, which is the thing this repo
          // controls and the thing a regression would show up in.
          external: (id) =>
            !id.startsWith(".") && !isAbsolute(id) && !id.startsWith("@g3t/"),
        },
      },
    });

    results.push({ ...scenario, measured: dirBytes(outDir) });
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("Consumer Cost (first-party bytes per import)");
console.log("===========================================\n");

let failures = 0;
for (const r of results) {
  const pct = ((r.measured / r.budget) * 100).toFixed(0);
  const within = r.measured <= r.budget;
  if (!within) failures++;
  console.log(
    `  ${within ? "✓" : "✗"} ${r.label.padEnd(24)} ${fmt(r.measured).padStart(9)} / ${fmt(r.budget).padStart(9)} (${pct}%)`,
  );
}

if (failures > 0) {
  console.error(
    `\nConsumer-cost budget exceeded: ${failures} scenario(s) over budget.\n` +
      `This is what an adopter's bundle grows by, so a raise needs a written\n` +
      `reason in the SCENARIOS table in the same commit, the same as the\n` +
      `publish-weight ledger in check-bundle-size.mjs.`,
  );
  process.exit(1);
}

console.log("\nAll scenarios within budget.");
