import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { externalsFromPackageJson } from "../../scripts/vite-externals.mjs";

const external = externalsFromPackageJson(resolve(__dirname, "package.json"));

export default defineConfig({
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: true,
  },
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
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
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
