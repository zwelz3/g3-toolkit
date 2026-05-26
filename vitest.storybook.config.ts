import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// Storybook+browser tests.
//
// Requires Playwright Chromium installed:
//   pnpm exec playwright install chromium
//
// Run via: pnpm run test:storybook
// (Not included in the default `pnpm test` so contributors without
// Playwright can still run the unit test suite.)
export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      storybookTest({
        configDir: path.join(dirname, ".storybook"),
      }),
    ],
    test: {
      name: "storybook",
      browser: {
        enabled: true,
        headless: true,
        provider: playwright({}),
        instances: [{ browser: "chromium" }],
      },
    },
  }),
);
