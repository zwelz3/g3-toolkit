/**
 * Visual acceptance emitter (planning/visual-acceptance-1.md).
 *
 * Renders the page CLIENT-SIDE under jsdom and serializes the result,
 * rather than SSR: zustand v5's React binding serves server renders
 * the store's creation-time snapshot (verified empirically; a
 * pre-render selectNodes() is invisible to renderToStaticMarkup), so
 * a client render is the path where the real components behave as
 * they do in the browser and in the vitest suite.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

async function main(): Promise<void> {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id=root></div></body></html>",
    { pretendToBeVisual: true, url: "http://localhost/" },
  );
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  // Node >=21 exposes globalThis.navigator as a getter-only accessor;
  // redefine rather than assign.
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  g.HTMLElement = dom.window.HTMLElement;
  g.SVGElement = dom.window.SVGElement;
  g.localStorage = dom.window.localStorage;
  g.sessionStorage = dom.window.sessionStorage;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

  // Import React and the page AFTER the DOM globals exist.
  const { createElement: h } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { PageBody, initFixtureState, wrapDocument } = await import("./render");

  initFixtureState();
  const container = dom.window.document.getElementById("root");
  if (!container) throw new Error("jsdom container missing");
  const root = createRoot(container);
  flushSync(() => {
    root.render(h(PageBody));
  });

  // Inline the live-island bundle so the page stays one file; escape
  // any </script> sequences inside the bundle's string literals.
  const island = readFileSync(
    resolve(process.cwd(), "scripts/visual-acceptance/.build/va20-island.js"),
    "utf8",
  ).replace(/<\/script/g, "<\\/script");
  // Replacer FUNCTION, not string: the bundle contains $-sequences
  // ($&, $\`) that String.replace's string form expands as special
  // patterns; the string form pasted the whole page into the script
  // (caught by the size jump and the self-check's phantom matches).
  const html = wrapDocument(container.innerHTML).replace(
    "</body>",
    () => `<script type="module">${island}</script>\n</body>`,
  );

  // Structural self-checks: fail rather than emit a hollow page.
  const REQUIRED: Array<[string, string]> = [
    ["base stylesheet", ".g3t-btn {"],
    ["focus ring rule", ":focus-visible"],
    ["theme switcher component", 'data-testid="g3t-theme-switcher"'],
    ["theme option buttons", "data-theme-option"],
    ["va theme host", 'id="va-theme-root"'],
    ["structural host (va27)", 'id="va27-root"'],
    ["routing host (va31)", 'id="va31-root"'],
    ["island inlined", "VA20_ISLAND_MOUNTED"],
    ["emptystate", "No temporal data"],
    ["emptystate error variant", "Endpoint unreachable"],
    ["skeleton", 'data-testid="g3t-skeleton"'],
    ["searchbar host", 'id="searchbar-root"'],
  ];
  const missing = REQUIRED.filter(([, marker]) => !html.includes(marker));
  if (missing.length > 0) {
    console.error(
      "visual acceptance page failed self-check; missing:",
      missing.map(([name]) => name).join(", "),
    );
    process.exit(1);
  }
  const selectedRows = (html.match(/data-selected="true"/g) ?? []).length;
  console.log(`self-check passed (${selectedRows} selected rows rendered)`);

  const out = resolve(process.cwd(), "scripts/visual-acceptance/dist");
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "visual-acceptance.html"), html);
  console.log(
    `visual-acceptance.html written (${(html.length / 1024).toFixed(1)} KB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
