import { defineConfig } from "vite";
import { resolve } from "path";
import { externalsFromPackageJson } from "../../scripts/vite-externals.mjs";

const external = externalsFromPackageJson(resolve(__dirname, "package.json"));

/**
 * Multi-entry library build (P2.4).
 *
 * Each subpath in the package's exports map gets its own bundle so consumers
 * can `import { X } from "@g3t/core/layout"` and tree-shake the rest. The
 * dist/ layout matches the exports map declared in package.json:
 *
 *   dist/index.mjs                ← "." (ESM only)
 *   dist/adapters.mjs             ← ./adapters
 *   dist/middleware.mjs           ← ./middleware
 *   dist/events.mjs               ← ./events
 *   dist/projection.mjs           ← ./projection
 *   dist/pipeline.mjs             ← ./pipeline
 *   dist/shacl.mjs                ← ./shacl
 *   dist/diff.mjs                 ← ./diff
 *   dist/layout.mjs               ← ./layout
 *   dist/algorithms.mjs           ← ./algorithms (source dir name: algorithm-adapter)
 */

export default defineConfig({
  // (G3L Round 49) The esbuild whitespace-only minify trio that
  // lived here triggered vite 8's "esbuild options ignored" warning
  // AND was still partially shaping the dist: removing it switched
  // to FULL default minification (core 187.3 -> 146.0 KB, react
  // 425.9 -> 357.1). Sourcemaps ship, so full minify is strictly
  // better than readable identifiers; the bundle budgets were
  // REBASED to this measurement basis in the same commit (ledger).
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        adapters: resolve(__dirname, "src/adapter/index.ts"),
        middleware: resolve(__dirname, "src/middleware/index.ts"),
        events: resolve(__dirname, "src/event-bus/index.ts"),
        projection: resolve(__dirname, "src/projection/index.ts"),
        pipeline: resolve(__dirname, "src/pipeline/index.ts"),
        shacl: resolve(__dirname, "src/shacl/index.ts"),
        diff: resolve(__dirname, "src/diff/index.ts"),
        layout: resolve(__dirname, "src/layout/index.ts"),
        algorithms: resolve(__dirname, "src/algorithm-adapter/index.ts"),
        // Added in P3.2 reclassification (formerly part of @g3t/react)
        "undo-redo": resolve(__dirname, "src/undo-redo/index.ts"),
        theme: resolve(__dirname, "src/theme/index.ts"),
        "path-analysis": resolve(__dirname, "src/path-analysis/index.ts"),
        // Shipped but explicitly outside the semver contract. See the
        // docblock in src/internal/index.ts before adding anything here.
        internal: resolve(__dirname, "src/internal/index.ts"),
      },
      // ESM-ONLY as of 2026-08-16. The `cjs` format and
      // the `require` conditions went together. Reasons, in order of
      // weight: the library's primary integration channel is exported
      // zustand store SINGLETONS, and a consumer whose tree reaches a
      // package through `import` on one path and `require` on another
      // gets two module instances and therefore two stores, so the
      // canvas subscribes to one while the table writes to the other
      // and selection silently stops working with nothing in a stack
      // trace. That hazard cannot be fixed from inside the library
      // while both formats ship. Typed CJS never worked anyway (one
      // ESM-flavored .d.ts per entry, so `require` from a .cts raised
      // TS1479), and no consumer, example, doc snippet or test in this
      // repository requires a @g3t package. Dropping it also removes
      // 44% of emitted runtime JS.
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.mjs`,
    },
    rollupOptions: {
      external,
    },
    outDir: "dist",
    sourcemap: true,
    emptyOutDir: false,
    target: "es2022",
    // Comment-stripping pass (2026-07-11 dead-code round): source
    // comments were ~14% of shipped dist bytes and are not consumer
    // surface (sourcemaps still ship for debugging). Identifiers,
    // syntax, and code layout are preserved; measured effect on this
    // vite version is comments-only. Recovered ~44 KB across the
    // three packages against unchanged budgets.
    minify: "esbuild",
  },
});
