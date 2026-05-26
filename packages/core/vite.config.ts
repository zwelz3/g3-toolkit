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
 *   dist/index.{mjs,cjs}        ← main
 *   dist/adapters.{mjs,cjs}     ← ./adapters
 *   dist/middleware.{mjs,cjs}   ← ./middleware
 *   dist/events.{mjs,cjs}       ← ./events
 *   dist/projection.{mjs,cjs}   ← ./projection
 *   dist/pipeline.{mjs,cjs}     ← ./pipeline
 *   dist/shacl.{mjs,cjs}        ← ./shacl
 *   dist/diff.{mjs,cjs}         ← ./diff
 *   dist/layout.{mjs,cjs}       ← ./layout
 *   dist/algorithms.{mjs,cjs}   ← ./algorithms (source dir name: algorithm-adapter)
 */

export default defineConfig({
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
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external,
    },
    outDir: "dist",
    sourcemap: true,
    emptyOutDir: true,
    target: "es2022",
    minify: false,
  },
});
