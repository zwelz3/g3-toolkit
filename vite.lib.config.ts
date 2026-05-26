/**
 * Vite library build configuration.
 *
 * Produces ESM + CJS bundles with TypeScript declarations.
 * Run: npm run build:lib
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: "dist/bundle-analysis.html", gzipSize: true, template: "treemap" }),
  ],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@views": resolve(__dirname, "src/views"),
      "@state": resolve(__dirname, "src/state"),
      "@interaction": resolve(__dirname, "src/interaction"),
      "@a11y": resolve(__dirname, "src/a11y"),
      "@theme": resolve(__dirname, "src/theme"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "g3t",
      formats: ["es", "cjs"],
      fileName: (format) => `g3t.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      // Externalize peer dependencies (not bundled)
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "cytoscape",
        "echarts",
        "echarts-for-react",
        "vis-timeline",
        "graphology",
        "graphology-types",
        "zustand",
        "zustand/middleware",
        "@tanstack/react-table",
        "flexlayout-react",
        "d3-force",
        "d3-hierarchy",
        "@dagrejs/dagre",
        "elkjs",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          cytoscape: "cytoscape",
          echarts: "echarts",
          graphology: "Graphology",
          zustand: "zustand",
        },
      },
    },
    outDir: "dist",
    sourcemap: true,
  },
});

// Bundle analysis (run with ANALYZE=1 npm run build:lib)
// import { visualizer } from "rollup-plugin-visualizer";
// Add to plugins: visualizer({ filename: "dist/bundle-analysis.html", open: false })
