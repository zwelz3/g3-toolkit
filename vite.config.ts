import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  // JS Self-Profiling (G3L scale diagnosis): the scale surface
  // samples the main thread during view switches and prints the top
  // self-time functions; the API requires this document policy.
  server: {
    host: true,        // 0.0.0.0, reachable from the forwarder
    headers: { "Document-Policy": "js-profiling" },
  },
  preview: { headers: { "Document-Policy": "js-profiling" } },
  resolve: {
    alias: {
      "@g3-toolkit/core": resolve(__dirname, "packages/core/src"),
      "@g3-toolkit/react": resolve(__dirname, "packages/react/src"),
      "@g3-toolkit/charts": resolve(__dirname, "packages/charts/src"),
    },
  },
});
