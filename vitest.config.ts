import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
      include: [
        "src/**/*.test.{ts,tsx}",
        "tests/unit/**/*.test.{ts,tsx}",
        "tests/component/**/*.test.{ts,tsx}",
      ],
      passWithNoTests: true,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx"],
      },
    },
  }),
);
