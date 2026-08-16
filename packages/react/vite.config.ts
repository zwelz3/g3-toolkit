import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { externalsFromPackageJson } from "../../scripts/vite-externals.mjs";

const external = externalsFromPackageJson(resolve(__dirname, "package.json"));

/**
 * Multi-entry library build (P2.4).
 *
 *   dist/index.{mjs,cjs}      ← main
 *   dist/views.{mjs,cjs}      ← ./views
 *   dist/controls.{mjs,cjs}   ← ./controls (source dir name: interaction)
 *   dist/state.{mjs,cjs}      ← ./state
 *   dist/theme.{mjs,cjs}      ← ./theme
 *   dist/a11y.{mjs,cjs}       ← ./a11y
 *   dist/timeline.{mjs,cjs}   ← ./timeline (opt-in; see below)
 *   dist/style.css            ← extracted CSS (from index entry)
 *
 * `timeline` is its own entry for a packaging reason, not an
 * organisational one. TimelineView statically imports vis-timeline and
 * vis-data, which are OPTIONAL peers, and rollup will hoist a module
 * shared by two entries into a common chunk. While it was reachable from
 * both `index` and `views` it landed in a chunk both of those imported,
 * so `import "@g3t/react"` failed to resolve for anyone who took the
 * documented install. A dedicated entry keeps the bare specifiers behind
 * a subpath nobody reaches by accident. scripts/check-optional-peers.mjs
 * fails the build if they leak back out.
 */

export default defineConfig({
  // (G3L Round 49) The esbuild whitespace-only minify trio that
  // lived here triggered vite 8's "esbuild options ignored" warning
  // AND was still partially shaping the dist: removing it switched
  // to FULL default minification (core 187.3 -> 146.0 KB, react
  // 425.9 -> 357.1). Sourcemaps ship, so full minify is strictly
  // better than readable identifiers; the bundle budgets were
  // REBASED to this measurement basis in the same commit (ledger).
  plugins: [react()],
  resolve: {
    alias: {
      "@g3t/core": resolve(__dirname, "../core/src"),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        views: resolve(__dirname, "src/views/index.ts"),
        controls: resolve(__dirname, "src/interaction/index.ts"),
        state: resolve(__dirname, "src/state/index.ts"),
        theme: resolve(__dirname, "src/theme/index.ts"),
        a11y: resolve(__dirname, "src/a11y/index.ts"),
        icons: resolve(__dirname, "src/icons/index.ts"),
        timeline: resolve(__dirname, "src/views/timeline/index.ts"),
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
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "ReactJSXRuntime",
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "style.css";
          }
          return "[name][extname]";
        },
      },
    },
    cssCodeSplit: false,
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
