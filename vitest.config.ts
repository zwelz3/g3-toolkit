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
      // 6000, up from vitest's 5000 default (2026-08-28). ScaleSurface's
      // "drills into a cluster from the rail and returns" timed out at
      // 5000ms in a full-suite run and passed in isolation at 7.15s for
      // the whole file, so it sits just under the ceiling when the suite
      // is competing for the machine. Set GLOBALLY rather than behind
      // `process.env.CI`: the flake surfaced on a dev box, not in CI,
      // and a CI-only value reintroduces exactly the local/CI
      // divergence that .pixi lint scope and the playwright browser
      // install each cost a round to remove. If a test needs more than
      // this, the test is doing too much and gets its own timeout
      // argument.
      testTimeout: 6000,
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
