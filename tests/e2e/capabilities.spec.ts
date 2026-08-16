/**
 * UX surface and toolkit capability E2E tests.
 *
 * Migrates m8_m10_acceptance.robot and covers the 17 previously
 * uncovered capabilities: TreeView, MapView, TimelineView,
 * MatrixView, SankeyView, SchemaView, DiffRenderer, LinkedChart,
 * FilterBuilder, NodeStyleEditor, ShaclValidator, Neighborhood,
 * PROV-O, DerivedProperty, TemporalFilter, StyleOverride, UndoRedo.
 */

import { test, expect } from "@playwright/test";

const HARNESS = "/?test-harness";

// ── Theme (M8.5) ────────────────────────────────────────────────

test.describe("Theme switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
  });

  // Both tests addressed `select` first, which is position-dependent,
  // under a guard that made a missing control look like a pass. The
  // harness gives the theme control a testid; use it.
  test("dark theme changes background color", async ({ page }) => {
    const themeSelect = page.locator("[data-testid='toolbar-theme']");
    const light = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--g3t-bg-primary",
      ),
    );
    await themeSelect.selectOption("dark");
    const dark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--g3t-bg-primary",
      ),
    );
    // Asserting non-empty passed even when the theme never changed.
    // The claim in the title is that the value MOVES.
    expect(dark.trim()).not.toBe(light.trim());
  });

  test("high-contrast theme is available", async ({ page }) => {
    const options = await page
      .locator("[data-testid='toolbar-theme'] option")
      .allTextContents();
    expect(options.some((o) => o.toLowerCase().includes("contrast"))).toBe(
      true,
    );
  });
});

// ── Toolbar controls (M8.5) ─────────────────────────────────────

test.describe("Toolbar and controls", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1000);
  });

  // DELETED 2026-08-15, two tests.
  //
  // "zoom controls are visible on the canvas": its entire body was
  // three comment lines. It never located anything and never asserted
  // anything, and it has been reported as a passing test the whole
  // time.
  //
  // "keyboard shortcut modal opens with ? key": the modal lives in
  // UxSurface, which the harness does not mount, so the guard was
  // permanently false. `.catch(() => false)` also swallowed any error
  // the locator raised. Restore against a fixture that renders
  // UxSurface; the component's own behavior is covered by
  // packages/react/src/interaction/toolbar/ux-surface.test.tsx.
});

// ── Secondary views ─────────────────────────────────────────────

test.describe("Secondary views", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1500);
  });

  test("table view renders rows", async ({ page }) => {
    const rows = page.locator("[data-testid^='table-row-']");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  // DELETED 2026-08-15: "tab switching works". It walked five tab
  // names, clicked whichever happened to be visible, and asserted
  // nothing about the result. The harness has no tab strip at all, so
  // every iteration was skipped and the test reported a pass for a
  // surface it never touched.
});

// ── Context menu and neighborhood ───────────────────────────────

test.describe("Context menu and neighborhood", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1500);
  });

  test("right-click on the canvas suppresses the native context menu", async ({
    page,
  }) => {
    // Was titled "triggers context menu or browser default", which is
    // every possible outcome, and asserted none of them. The behavior
    // the canvas actually guarantees (CytoscapeCanvas bugfix 8) is that
    // the native menu is suppressed so it cannot appear alongside the
    // toolkit one; that is assertable.
    const canvas = page.locator("[data-testid='cytoscape-canvas']");
    const defaultPrevented = await page.evaluate(async () => {
      const el = document.querySelector("[data-testid='cytoscape-canvas']");
      if (!el) return null;
      const evt = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(evt);
      return evt.defaultPrevented;
    });
    expect(defaultPrevented).toBe(true);
    await expect(canvas).toBeVisible();
  });
});
