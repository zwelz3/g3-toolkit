/**
 * Overlay + console-hygiene browser acceptance.
 *
 * Machine-checks the subset of MR-2/MR-3 that a browser can assert
 * without a human eye, plus the console-hygiene class (the
 * mapping-warning flood that once cost 1.7s per redraw was only
 * visible as console noise):
 *
 *  - the SVG overlay exists in MBSE and carries one path per routed
 *    edge in the scene
 *  - pan is TRANSFORM-ONLY: the group transform changes, path `d`
 *    attributes do not (the architectural reason the overlay is
 *    lag-free at 4k; MR-2's premise as an executable invariant)
 *  - shells load and survive interaction with ZERO console errors or
 *    warnings
 *
 * AUTHORED HEADLESSLY (established suite doctrine): first execution
 * is CI or a maintainer's local `pnpm run test:e2e`.
 */
import { test, expect, type Page } from "@playwright/test";

// RETARGETED TO SVG 2026-08-16 (owner ruling). These asserted against
// the Cytoscape canvas and its svg-overlay edge layer. The MBSE shell
// defaults to the SVG renderer and marks Cytoscape deprecated, so the
// invariants are now pinned on the renderer users actually get.
//
// The SVG view's contract: one `[data-ssv-scene]` group carrying the
// whole view transform, `[data-ssv-edge-path="<id>"]` per drawn edge,
// and `[data-ssv-edge-fallback]` marking edges the router skipped.
const SVG = "[data-testid='mbse-structural-svg']";

function collectConsole(page: Page): { text: string; type: string }[] {
  const entries: { text: string; type: string }[] = [];
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      entries.push({ type, text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    entries.push({ type: "pageerror", text: String(err) });
  });
  return entries;
}

async function openMbse(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByText("MBSE Satellite Workbench", { exact: true }).click();
  // No renderer selection: SVG is the default, which is the point.
  await page.waitForSelector(SVG, { timeout: 15000 });
  await page.waitForFunction(() => window.__g3t?.scenes.has("mbse") === true, {
    timeout: 15000,
  });
}

test.describe("overlay structure and pan behavior", () => {
  test("every drawn edge path maps to a routed geometry edge", async ({
    page,
  }) => {
    await openMbse(page);
    const res = await page.evaluate(() => {
      const scene = window.__g3t!.scenes.get("mbse")!;
      const routed = new Set(Object.keys(scene.geometry.edges ?? {}));
      const orphans: string[] = [];
      const empty: string[] = [];
      let paths = 0;
      document.querySelectorAll("[data-ssv-edge-path]").forEach((el) => {
        paths += 1;
        const id = el.getAttribute("data-ssv-edge-path")!;
        if (!routed.has(id)) orphans.push(id);
        if ((el.getAttribute("d") ?? "").trim() === "") empty.push(id);
      });
      return {
        paths,
        orphans,
        empty,
        fallbacks: document.querySelectorAll("[data-ssv-edge-fallback]").length,
      };
    });
    // Equality is not asserted in either direction: the router may skip
    // an edge, and a skipped edge draws a straight fallback rather than
    // vanishing. What must NEVER exist is a drawn path with no routed
    // geometry behind it, or a path with no geometry in it at all.
    expect(res.paths).toBeGreaterThan(0);
    expect(res.orphans).toEqual([]);
    expect(res.empty).toEqual([]);
    // No edge should be falling back on the flagship fixture. This is
    // the assertion that would catch the router silently degrading.
    expect(res.fallbacks).toBe(0);
  });

  test("pan is transform-only: scene transform changes, path geometry does not", async ({
    page,
  }) => {
    await openMbse(page);
    const before = await page.evaluate(() => {
      const scene = document.querySelector("[data-ssv-scene]");
      return {
        transform: scene?.getAttribute("transform") ?? "",
        ds: [...document.querySelectorAll("[data-ssv-edge-path]")].map(
          (p) => p.getAttribute("d") ?? "",
        ),
      };
    });
    // Wheel-zoom rather than drag-pan: a drag from any fixed point
    // can land on a node (the fit fills the pane) and would move the
    // node instead of the viewport. Zoom is a pure viewport op and
    // pins the same invariant: the group transform changes, path
    // geometry does not.
    const svg = page.locator(SVG);
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -240);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .querySelector("[data-ssv-scene]")
                ?.getAttribute("transform") ?? "",
          ),
        { timeout: 5000 },
      )
      .not.toBe(before.transform);
    const after = await page.evaluate(() =>
      [...document.querySelectorAll("[data-ssv-edge-path]")].map(
        (p) => p.getAttribute("d") ?? "",
      ),
    );
    expect(after).toEqual(before.ds);
  });
});

test.describe("console hygiene (zero errors/warnings)", () => {
  test("MBSE loads, switches diagrams, and pans clean", async ({ page }) => {
    const entries = collectConsole(page);
    await openMbse(page);
    await page.getByText("SmallSat Internal").click();
    await page.waitForSelector(SVG, { timeout: 15000 });
    const box = (await page.locator(SVG).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(500);
    expect(
      entries,
      `console output (fix or triage each): ${JSON.stringify(entries)}`,
    ).toEqual([]);
  });

  test("Style Lab loads and drives LOD clean", async ({ page }) => {
    const entries = collectConsole(page);
    await page.goto("/?e2e=1");
    await page.getByText("Style Lab", { exact: true }).click();
    await page.waitForSelector("[data-testid='style-lab-parity-summary']", {
      timeout: 15000,
    });
    await page.getByTestId("style-lab-lod-select").selectOption("3");
    await page.getByTestId("style-lab-lod-select").selectOption("0");
    await page.waitForTimeout(500);
    expect(
      entries,
      `console output (fix or triage each): ${JSON.stringify(entries)}`,
    ).toEqual([]);
  });
});
