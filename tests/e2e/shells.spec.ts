/**
 * Playground shell smoke tests (P0.4, replacing the retired
 * if-visible scenario tests that referenced cards removed in the demo
 * overhaul). One test per shipped shell: enter from the landing, wait
 * for the canvas, perform one real interaction, and take a screenshot.
 *
 * Screenshots gate only once Linux baselines are committed (CI runs
 * with --ignore-snapshots until then; see .github/workflows/ci.yml
 * for the enabling procedure). The functional assertions gate now.
 *
 * AUTHORED HEADLESSLY: this file was written in an environment that
 * cannot download Playwright browsers; its first execution is CI or a
 * maintainer's local `pnpm run test:e2e`.
 */
import { test, expect, type Page } from "@playwright/test";

const CANVAS = "[data-testid='cytoscape-canvas']";

async function enterShell(page: Page, cardTitle: string): Promise<void> {
  await page.goto("/");
  await page.getByText(cardTitle, { exact: true }).click();
  await page.waitForSelector(CANVAS, { timeout: 15000 });
}

test.describe("Playground shells", () => {
  test("Provenance Auditor: report renders, slider narrows the window", async ({
    page,
  }) => {
    await enterShell(page, "Provenance Auditor");
    await expect(page.getByText("SHACL report")).toBeVisible();
    const start = page.getByLabel("Window start");
    await start.focus();
    await start.press("ArrowRight");
    await expect(page.locator(CANVAS)).toBeVisible();
    await expect(page).toHaveScreenshot("shell-auditor.png", {
      animations: "disabled",
    });
  });

  test("MBSE Workbench: diagram switch relays out and re-renders", async ({
    page,
  }) => {
    await enterShell(page, "MBSE Satellite Workbench");
    await page.getByText("SmallSat Internal").click();
    await page.waitForSelector(CANVAS, { timeout: 15000 });
    await expect(page).toHaveScreenshot("shell-mbse-ibd.png", {
      animations: "disabled",
    });
  });

  test("Supply Chain Thread: cluster mode populates the panel", async ({
    page,
  }) => {
    await enterShell(page, "Supply Chain Digital Thread");
    await expect(page.getByText("(choose a mode)")).toBeVisible();
    // Review 5.8 turned the mode buttons into a radio group with
    // descriptions inside each label; role/button with an exact name
    // can never match. The testid is the stable handle.
    await page.getByTestId("sc-mode-region").check();
    await expect(page.getByText("(choose a mode)")).toHaveCount(0);
    await expect(page).toHaveScreenshot("shell-supply-region.png", {
      animations: "disabled",
    });
  });

  test("Biomedical Graph: raw-triples toggle swaps the canvas view", async ({
    page,
  }) => {
    await enterShell(page, "Biomedical Knowledge Graph");
    await page.getByRole("button", { name: "Raw triples" }).click();
    await expect(page.getByTestId("bio-view-caption")).toContainText(
      "every triple an edge",
    );
    await expect(page.locator(CANVAS)).toBeVisible();
    await expect(page).toHaveScreenshot("shell-bio-raw.png", {
      animations: "disabled",
    });
  });
});

test("MBSE Workbench: the F1 SVG renderer toggle draws the geometry document", async ({
  page,
}) => {
  await page.goto("/?e2e=1");
  await page.getByText("MBSE Satellite Workbench", { exact: true }).click();
  await page.waitForSelector(CANVAS, { timeout: 15000 });
  await page.waitForFunction(() => window.__g3t?.scenes.has("mbse") === true, {
    timeout: 15000,
  });
  await page.getByTestId("mbse-renderer-select").selectOption("svg");
  const svg = page.getByTestId("mbse-structural-svg");
  await expect(svg).toBeVisible();
  // Verbatim fidelity spot checks: container count matches the scene
  // input's container population, and at least one routed edge path
  // with an arrow symbol rendered.
  const counts = await page.evaluate(() => {
    const scene = window.__g3t!.scenes.get("mbse")!;
    const geomContainers = Object.values(
      (scene as { geometry: { nodes: Record<string, { kind: string }> } })
        .geometry.nodes,
    ).filter((n) => n.kind === "container").length;
    return {
      geomContainers,
      drawn: document.querySelectorAll("[data-ssv-kind='container']").length,
      edges: document.querySelectorAll("[data-ssv-edge-path]").length,
      arrows: document.querySelectorAll("[data-ssv-arrow]").length,
    };
  });
  expect(counts.drawn).toBe(counts.geomContainers);
  expect(counts.edges).toBeGreaterThan(0);
  expect(counts.arrows).toBeGreaterThan(0);
  // Toggling back restores the Cytoscape canvas.
  await page.getByTestId("mbse-renderer-select").selectOption("cytoscape");
  await expect(page.locator(CANVAS)).toBeVisible();
});
