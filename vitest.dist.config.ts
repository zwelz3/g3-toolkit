import { defineConfig } from "vitest/config";

/**
 * Dist-artifact tests: these assert on built package output (exports
 * map targets exist and re-export named symbols), so they require
 * `pnpm run build:packages` first. They are deliberately excluded
 * from the default `pnpm test` include set so a fresh clone can run
 * the unit/component suite without building; `pnpm run verify` runs
 * them after the build step (verify:exports).
 */
export default defineConfig({
  test: {
    include: ["tests/dist/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
