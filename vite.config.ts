import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8"),
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  // JS Self-Profiling (G3L scale diagnosis): the scale surface
  // samples the main thread during view switches and prints the top
  // self-time functions; the API requires this document policy.
  server: { headers: { "Document-Policy": "js-profiling" } },
  preview: { headers: { "Document-Policy": "js-profiling" } },
  resolve: {
    alias: {
      "@g3t/core": resolve(__dirname, "packages/core/src"),
      "@g3t/react": resolve(__dirname, "packages/react/src"),
      "@g3t/charts": resolve(__dirname, "packages/charts/src"),
    },
  },
});
