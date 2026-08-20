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
    // Every test in this suite is IMPORT-BOUND, not compute-bound: the
    // barrel-parity tests dynamically import each package's TypeScript
    // source barrel (transpiled on the fly) alongside its built dist,
    // and the subpath test imports all 23 entry points. That cost
    // scales with package size, and @g3t/react is by far the largest
    // barrel, so it is the one that tips over first: it crossed
    // vitest's 5000 ms default on ordinary hardware once the
    // 2026-08-17 merge landed, while core and charts still passed.
    //
    // A raise is the right answer rather than a smaller assertion. The
    // 5000 ms was never a claim about correctness, and the thing being
    // measured (does dist re-export every runtime name the source
    // barrel does) is exactly what should NOT be weakened to fit a
    // clock. 60 s is generous but still bounded, so a genuine hang or
    // a pathological import cycle continues to fail rather than
    // running forever.
    testTimeout: 60_000,
  },
});
