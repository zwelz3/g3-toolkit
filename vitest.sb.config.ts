import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@g3t/core": resolve(__dirname, "packages/core/src"),
      "@g3t/react": resolve(__dirname, "packages/react/src"),
      "@g3t/charts": resolve(__dirname, "packages/charts/src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["scripts/storybook-static/**/*.smoke.test.tsx"],
  },
});
