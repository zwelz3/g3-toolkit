/**
 * Scale demo route-flash regression (brief 18).
 *
 * Owner reported the deployed Scale demo flashing on cluster mount and
 * on the return-from-drill path. Root cause was in the CytoscapeCanvas
 * routeEdges gate: the layoutstop handler always deferred by
 * animationDuration+16ms (=416ms), reading the canvas `animate` prop
 * instead of the effective layout-config animate value. The Scale demo
 * sets `layoutOptions.animate: false` for its cached-positions return
 * path, but the canvas prop stays `true` (via `!reducedMotion`), so the
 * gate deferred and edges painted as straight beziers for ~416ms before
 * snapping to their routed polylines - the flash.
 *
 * The fix routes synchronously at layoutstop when the effective animate
 * is `false` or `"end"` (both mean positions are settled at layoutstop),
 * and skips the prop-change effect's immediate route pass until at
 * least one layoutstop has fired (so an initial fresh-fcose mount does
 * not paint routes based on random pre-layout positions).
 *
 * This spec asserts the observable contract: shortly after the canvas
 * signals ready, the visible edges carry `_segDist` bypass data (the
 * routed-polyline stamp). If the fix regresses, the 416ms delay would
 * make this assertion fail without a matching `waitForTimeout`.
 *
 * AUTHORED HEADLESSLY: first execution is CI or a maintainer's local
 * `pnpm run test:e2e`.
 */
import { test, expect, type Page } from "@playwright/test";

const CANVAS = "[data-testid='cytoscape-canvas']";
const SCALE_CARD_TITLE = "Scale";

async function openScale(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByText(SCALE_CARD_TITLE, { exact: true }).click();
  await page.waitForSelector(CANVAS, { timeout: 20000 });
  await page.waitForFunction(
    () => window.__g3t?.canvases.has("scale") === true,
    { timeout: 20000 },
  );
}

/** True once at least one visible edge has the `_segDist` bypass. */
async function edgesRouted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const cy = window.__g3t!.canvases.get("scale")!;
    let anyRouted = false;
    cy.edges().forEach((e) => {
      if (e.data("_segDist") !== undefined) anyRouted = true;
    });
    return anyRouted;
  });
}

test("Scale clusters view routes edges synchronously after layoutstop (no route-flash on mount)", async ({
  page,
}) => {
  await openScale(page);
  // The clusters view uses fcose animate:"end" on first visit;
  // layoutstop fires after animation completes and routing must run
  // in the same tick, not on a 416ms setTimeout. Poll up to 2s
  // (allowing fcose compute + the animation itself), but the fix
  // means the routing itself is not adding a further deferred delay.
  await page.waitForFunction(
    () => {
      const cy = window.__g3t?.canvases.get("scale");
      if (!cy) return false;
      let anyRouted = false;
      cy.edges().forEach((e) => {
        if (e.data("_segDist") !== undefined) anyRouted = true;
      });
      return anyRouted;
    },
    { timeout: 5000 },
  );
  expect(await edgesRouted(page)).toBe(true);
});

test("Scale return-from-drill path applies routes without a bezier flash (cached positions, animate:false)", async ({
  page,
}) => {
  await openScale(page);
  // Wait for initial routing to settle.
  await page.waitForFunction(
    () => {
      const cy = window.__g3t?.canvases.get("scale");
      if (!cy) return false;
      let routed = false;
      cy.edges().forEach((e) => {
        if (e.data("_segDist") !== undefined) routed = true;
      });
      return routed;
    },
    { timeout: 5000 },
  );

  // Drill into the first supernode via the rail.
  const railButtons = page.locator("aside button").filter({ hasText: /·/ });
  await railButtons.first().click();
  await page.waitForFunction(
    () => {
      const cy = window.__g3t?.canvases.get("scale");
      return cy != null && cy.nodes().length > 50;
    },
    { timeout: 10000 },
  );

  // Return to clusters.
  await page.getByRole("button", { name: /Back to clusters/ }).click();
  // The cached-positions preset path applies with animate:false.
  // With the fix, routing fires synchronously at layoutstop; without
  // it, we would see straight beziers for ~416ms then a snap. Sample
  // at 100ms after canvas ready to catch the flash window that would
  // exist under the regression.
  await page.waitForFunction(
    () => {
      const cy = window.__g3t?.canvases.get("scale");
      return cy != null && cy.nodes().length < 100;
    },
    { timeout: 10000 },
  );
  // 100ms is comfortably inside the pre-fix 416ms bezier window but
  // gives cytoscape/preset a frame or two to emit layoutstop.
  await page.waitForTimeout(100);
  expect(await edgesRouted(page)).toBe(true);
});
