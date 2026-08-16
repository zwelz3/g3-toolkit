import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Default vitest config: jsdom unit/component tests only.
//
// The storybook integration (which uses @vitest/browser-playwright and
// requires `pnpm exec playwright install chromium`) lives in
// vitest.storybook.config.ts instead. Run that separately via
// `pnpm run test:storybook`. Keeping them split means contributors
// without Playwright installed can still run `pnpm test` to verify
// their changes.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // passWithNoTests REMOVED 2026-08-15. It made an empty run green,
      // so a glob that matched nothing (see the include list below) read
      // as a pass. A run with no tests is a broken invocation.
      globals: true,
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
      // tests/component/** was in this list and the directory has never
      // existed. Component tests live beside their source under
      // packages/*/src. Add a path here when a directory backs it.
      include: [
        "src/**/*.test.{ts,tsx}",
        "packages/*/src/**/*.test.{ts,tsx}",
        "examples/*/src/**/*.test.{ts,tsx}",
        "tests/unit/**/*.test.{ts,tsx}",
        "tests/perf/**/*.perf.test.{ts,tsx}",
      ],
      coverage: {
        provider: "v8",
        // Phase-2 paths: coverage now includes the published packages
        // and the demo source, not the legacy src/ tree.
        include: ["packages/*/src/**/*.{ts,tsx}"],
        exclude: [
          "packages/*/src/**/*.test.{ts,tsx}",
          "packages/*/src/**/*.stories.{ts,tsx}",
        ],
      },
    },
  }),
);
