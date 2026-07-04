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
 *   dist/style.css            ← extracted CSS (from index entry)
 */

export default defineConfig({
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
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "mjs" : "cjs"}`,
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
    minify: false,
  },
});
