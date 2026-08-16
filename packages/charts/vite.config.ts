import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { externalsFromPackageJson } from "../../scripts/vite-externals.mjs";

const external = externalsFromPackageJson(resolve(__dirname, "package.json"));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@g3t/core": resolve(__dirname, "../core/src"),
      "@g3t/react": resolve(__dirname, "../react/src"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "g3tCharts",
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
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external,
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "ReactJSXRuntime",
          echarts: "echarts",
        },
      },
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
