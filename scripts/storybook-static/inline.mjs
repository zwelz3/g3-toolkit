/**
 * Inlines the built gallery bundle into a single self-contained HTML,
 * mirroring the visual-acceptance emitter. Escapes </script> in the
 * bundle's string literals so the page is not truncated, and runs a
 * self-check so a hollow build fails loudly instead of shipping.
 *
 * Vite extracts CSS imported by components (component stylesheets,
 * vis-timeline, etc.) into a separate asset. We inline that asset as a
 * real <style> in <head>; without it the page only carries the base CSS
 * the gallery injects at runtime, so component CSS (the temporal slider,
 * timeline theming, themed date fields, ...) never applies.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";

const buildDir = resolve(process.cwd(), "scripts/storybook-static/.build");

const js = readFileSync(join(buildDir, "gallery.js"), "utf8").replace(
  /<\/script/g,
  "<\\/script",
);

function collectCss(dir) {
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out += collectCss(full);
    else if (entry.name.endsWith(".css")) out += readFileSync(full, "utf8") + "\n";
  }
  return out;
}
const css = collectCss(buildDir).replace(/<\/style/g, "<\\/style");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>g3-toolkit stories (static gallery)</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`;

// Self-check: the bundle must carry recognizable gallery + story content,
// and the extracted component CSS must have been inlined (guards against
// the regression where only runtime-injected base CSS shipped).
const markers = ["g3-toolkit stories", "G3T_STORY_GALLERY_MOUNTED"];
const missing = markers.filter((m) => !html.includes(m));
if (!css.includes(".g3t-temporal-slider")) {
  missing.push("component CSS (.g3t-temporal-slider not inlined)");
}
if (missing.length > 0) {
  console.error(
    "storybook-static self-check failed; missing:",
    missing.join(", "),
  );
  process.exit(1);
}

const out = resolve(process.cwd(), "scripts/storybook-static/dist");
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "storybook-static.html"), html);
console.log(
  `storybook-static.html written (${(html.length / 1024).toFixed(1)} KB; CSS ${(css.length / 1024).toFixed(1)} KB)`,
);
