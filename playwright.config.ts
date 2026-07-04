import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  // {platform} keeps per-OS baselines separate: a Windows-generated
  // baseline can never be compared (and fail) against Linux CI renders.
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{platform}/{arg}{ext}",
  fullyParallel: false, // sequential for deterministic screenshots
  forbidOnly: !!process.env.CI,
  // One local retry absorbs dev-server cold-start flake (first request
  // compiles the whole playground); CI keeps two.
  retries: process.env.CI ? 2 : 1,
  workers: 1, // single worker for screenshot consistency
  // Screenshot ARCHITECTURE: baselines are platform-specific (font
  // rendering alone guarantees Windows/macOS runs never match Linux
  // baselines), so snapshot comparisons are OFF for local runs by
  // default and belong to Linux CI once baselines are committed there
  // (generation flow documented in .github/workflows/ci.yml). Opt in
  // locally with PW_SNAPSHOTS=1 (e.g. to regenerate on a Linux box).
  ignoreSnapshots: !process.env.CI && process.env.PW_SNAPSHOTS !== "1",
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
    // Machine-readable results for agent rounds and CI triage.
    ["json", { outputFile: "test-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Consistent viewport for screenshot baselines
    viewport: { width: 1280, height: 800 },
    // Suppress CSS transitions/animations app-wide for stability.
    contextOptions: { reducedMotion: "reduce" },
    actionTimeout: 10000,
  },
  expect: {
    toHaveScreenshot: {
      // 2%: anti-aliasing and sub-pixel text noise on same-platform
      // reruns; anything beyond that is a real visual change.
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    // Cold vite start compiling the playground can exceed 30s.
    timeout: 120000,
  },
});
