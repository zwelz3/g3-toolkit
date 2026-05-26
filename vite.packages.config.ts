/**
 * Per-package Vite build configs.
 *
 * Run: npm run build:packages
 *
 * Produces:
 *   dist/core/g3t-core.mjs + .cjs
 *   dist/react/g3t-react.mjs + .cjs
 *   dist/charts/g3t-charts.mjs + .cjs
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const alias = {
  "@core": resolve(__dirname, "src/core"),
  "@views": resolve(__dirname, "src/views"),
  "@state": resolve(__dirname, "src/state"),
  "@interaction": resolve(__dirname, "src/interaction"),
  "@a11y": resolve(__dirname, "src/a11y"),
  "@theme": resolve(__dirname, "src/theme"),
};

// Common externals (never bundled)
const COMMON_EXTERNAL = [
  "react", "react-dom", "react/jsx-runtime",
];

// ── @g3t/core ───────────────────────────────────────────────────

export const coreConfig = defineConfig({
  plugins: [],
  resolve: { alias },
  build: {
    lib: {
      entry: resolve(__dirname, "src/core-entry.ts"),
      name: "g3tCore",
      formats: ["es", "cjs"],
      fileName: (f) => `g3t-core.${f === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        ...COMMON_EXTERNAL,
        "graphology", "graphology-types",
        "expr-eval", "simple-statistics", "crossfilter2",
        "d3-force", "d3-hierarchy", "@dagrejs/dagre", "elkjs",
      ],
    },
    outDir: "dist/core",
    sourcemap: true,
    emptyOutDir: true,
  },
});

// ── @g3t/react ──────────────────────────────────────────────────

export const reactConfig = defineConfig({
  plugins: [react()],
  resolve: { alias },
  build: {
    lib: {
      entry: resolve(__dirname, "src/react-entry.ts"),
      name: "g3tReact",
      formats: ["es", "cjs"],
      fileName: (f) => `g3t-react.${f === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        ...COMMON_EXTERNAL,
        "cytoscape", "zustand", "zustand/middleware",
        "@tanstack/react-table", "fuse.js",
        "vis-data", "vis-timeline", "flexlayout-react",
        "graphology", "graphology-types",
        "expr-eval", "simple-statistics", "crossfilter2",
        "d3-force", "d3-hierarchy", "@dagrejs/dagre", "elkjs",
        // Core is a peer dep
        "@g3t/core",
      ],
    },
    outDir: "dist/react",
    sourcemap: true,
    emptyOutDir: true,
  },
});

// ── @g3t/charts ─────────────────────────────────────────────────

export const chartsConfig = defineConfig({
  plugins: [react()],
  resolve: { alias },
  build: {
    lib: {
      entry: resolve(__dirname, "src/charts-entry.ts"),
      name: "g3tCharts",
      formats: ["es", "cjs"],
      fileName: (f) => `g3t-charts.${f === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        ...COMMON_EXTERNAL,
        "echarts", "echarts-for-react",
        "zustand", "zustand/middleware",
        "graphology", "graphology-types",
        "@g3t/core", "@g3t/react",
      ],
    },
    outDir: "dist/charts",
    sourcemap: true,
    emptyOutDir: true,
  },
});

// Default export is the monolithic build (backward compatible)
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
});
