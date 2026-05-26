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
    emptyOutDir: true,
    target: "es2022",
    minify: false,
  },
});
