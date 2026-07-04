/**
 * SSR build for the visual acceptance page generator
 * (planning/visual-acceptance-1.md). Builds scripts/visual-acceptance
 * against the real workspace source via the same aliases as the demo.
 */
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
  build: {
    ssr: resolve(__dirname, "scripts/visual-acceptance/emit.ts"),
    outDir: "scripts/visual-acceptance/.build",
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "emit.mjs" } },
  },
});
