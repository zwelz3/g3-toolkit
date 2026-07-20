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
  // baselines), and none are committed yet, so snapshot comparisons
  // are OPT-IN everywhere (PW_SNAPSHOTS=1). This policy lives HERE,
  // not as a CI flag: pnpm forwards `--` literally, so
  // `pnpm run test:e2e -- --ignore-snapshots` handed playwright a
  // positional regex and matched zero tests. ENABLEMENT (Phase 2):
  // generate Linux baselines (CI or a Linux box, PW_SNAPSHOTS=1 with
  // --update-snapshots), commit tests/e2e/__screenshots__, then change
  // this line to: !process.env.CI && process.env.PW_SNAPSHOTS !== "1"
  ignoreSnapshots: process.env.PW_SNAPSHOTS !== "1",
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
    // Machine-readable results for agent rounds and CI triage.
    ["json", { outputFile: "test-results.json" }],
  ],
  use: {
    // PRODUCTION bundle under test (G3L Round 47): the owner found
    // the graph toolbar broken in `pnpm preview` while every gate
    // (1,354 unit + 58 e2e) ran source or dev builds: production
    // breakage was structurally invisible. e2e now builds and serves
    // the REAL bundle; the dev server is what `pnpm run dev` is for.
    baseURL: "http://localhost:4173",
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
    command: "pnpm run build && pnpm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    // Cold vite start compiling the playground can exceed 30s.
    timeout: 120000,
  },
});
