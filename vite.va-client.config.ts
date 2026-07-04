/** Browser bundle for the VA-20 live island (inlined into the page). */
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@g3t/core": resolve(__dirname, "packages/core/src"),
      "@g3t/react": resolve(__dirname, "packages/react/src"),
      "@g3t/charts": resolve(__dirname, "packages/charts/src"),
    },
  },
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: "scripts/visual-acceptance/.build",
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      input: resolve(__dirname, "scripts/visual-acceptance/va20-island.tsx"),
      output: {
        format: "es",
        entryFileNames: "va20-island.js",
        inlineDynamicImports: true,
      },
    },
  },
});
