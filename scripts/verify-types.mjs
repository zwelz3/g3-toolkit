/**
 * Verify that external TypeScript consumers can resolve type
 * declarations for every published package through the exports map.
 *
 * The repo's own typecheck resolves @g3t/* through tsconfig path
 * aliases and verify:smoke only exercises runtime resolution, so
 * neither catches declaration breakage that only consumers see
 * (the v1.0.0-rc audit found exactly that: `types` conditions that
 * never matched, and a build that deleted its own .d.ts output).
 *
 * Strategy: write a scratch consumer inside the repo (so @g3t/*
 * resolve via the pnpm workspace links in node_modules) and
 * typecheck it under the two supported resolution modes:
 *   - node16  (Node ESM consumers)
 *   - bundler (Vite / webpack / Next consumers)
 *
 * Typed CJS consumption (require from .cts) is a documented known
 * limitation pending declaration bundling; it is intentionally not
 * gated here. Runtime CJS is covered by verify:smoke.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, ".verify-types");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// One import per package plus representative subpaths, so a broken
// subpath types target fails the gate even when the root entry works.
writeFileSync(
  resolve(dir, "consumer.tsx"),
  `import { UGM } from "@g3t/core";
import { SparqlAdapter } from "@g3t/core/adapters";
import { ProjectionPipeline } from "@g3t/core/projection";
import { CytoscapeCanvas, TableView } from "@g3t/react";
import { useSelectionStore } from "@g3t/react/state";
import { LinkedChart } from "@g3t/charts";

const ugm: UGM = new UGM();
const adapter = new SparqlAdapter("https://example.org/sparql");
export { ugm, adapter, ProjectionPipeline, CytoscapeCanvas, TableView, useSelectionStore, LinkedChart };
`,
);

const modes = [
  { name: "node16", options: { module: "node16", moduleResolution: "node16" } },
  { name: "bundler", options: { module: "esnext", moduleResolution: "bundler" } },
];

let failed = false;
for (const mode of modes) {
  writeFileSync(
    resolve(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          ...mode.options,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          jsx: "react-jsx",
          types: [],
        },
        files: ["consumer.tsx"],
      },
      null,
      2,
    ),
  );
  try {
    execFileSync(
      resolve(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"),
      ["-p", dir],
      { stdio: "pipe", cwd: root },
    );
    console.log(`  \u2713 consumer types resolve under ${mode.name}`);
  } catch (err) {
    failed = true;
    console.error(`  \u2717 consumer type resolution FAILED under ${mode.name}:`);
    console.error(String(err.stdout ?? err.message));
  }
}

rmSync(dir, { recursive: true, force: true });
if (failed) {
  console.error(
    "verify:types failed. Declarations are unresolvable for external consumers; check exports-map `types` conditions and that build:packages preserved dist/*.d.ts.",
  );
  process.exit(1);
}
console.log("consumer type-resolution check: all packages typed under node16 and bundler");
