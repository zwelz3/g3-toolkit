/**
 * Static story-gallery build (a Storybook equivalent), using the same
 * source-alias approach as the visual-acceptance build.
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
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: "scripts/storybook-static/.build",
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      input: resolve(__dirname, "scripts/storybook-static/main.tsx"),
      output: {
        format: "es",
        entryFileNames: "gallery.js",
        inlineDynamicImports: true,
      },
    },
  },
});
