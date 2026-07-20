/**
 * Production-bundle smoke (G3L Round 47).
 *
 * Born from an owner finding: the graph toolbar was broken in
 * `pnpm preview` while every gate ran source or dev builds, so
 * production-only breakage was structurally invisible. The e2e
 * server now builds and serves the REAL bundle (playwright.config),
 * and this spec walks EVERY landing example asserting the mount
 * arrives and the console stays clean: the automated core of the
 * owner's manual acceptance pass. It is a smoke layer, not a
 * behavior suite: each example's behaviors stay in their own specs.
 */
import { expect, test, type Page } from "@playwright/test";

const EXAMPLES: { title: string; toolbar: boolean }[] = [
  { title: "Analytics Dashboard", toolbar: false },
  { title: "Scale", toolbar: true },
  { title: "Style Lab", toolbar: false },
  { title: "Ontology Workbench", toolbar: true },
  { title: "Provenance Auditor", toolbar: false },
  { title: "MBSE Satellite Workbench", toolbar: false },
  { title: "Biomedical Knowledge Graph", toolbar: false },
  { title: "Supply Chain Digital Thread", toolbar: false },
];

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

for (const ex of EXAMPLES) {
  test(`production smoke: ${ex.title} mounts clean`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?e2e=1");
    const card = page.getByText(ex.title, { exact: true }).first();
    await expect(card).toBeVisible();
    await card.click();
    // Any canvas-bearing surface: give the mount a beat, then assert
    // SOMETHING rendered beyond the landing (the back affordance is
    // universal across shells).
    // The back affordance varies by shell ("← Scenarios",
    // "← All demos", plain "Back"): the union is the contract.
    await expect(
      page.getByText(/Scenarios|Back|All demos/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    if (ex.toolbar) {
      // The graph toolbar's universal anatomy: the search box.
      await expect(
        page.locator(".g3t-graph-toolbar-search").first(),
      ).toBeVisible({ timeout: 15_000 });
    }
    // Settle briefly so late module errors surface.
    await page.waitForTimeout(750);
    expect(errors, `${ex.title} should mount without errors`).toEqual([]);
  });
}
