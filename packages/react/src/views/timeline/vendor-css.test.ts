/**
 * Vendored-stylesheet sync test. vis-timeline-vendor.css must be a
 * byte-exact copy of the stylesheet shipped by the installed
 * vis-timeline; when the dependency upgrades, this fails and the fix is
 * re-copying the file (see the import comment in TimelineView.tsx for
 * why it is vendored at all).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("vis-timeline vendored stylesheet", () => {
  it("matches the installed vis-timeline stylesheet byte for byte", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const require = createRequire(
      resolve(here, "..", "..", "..", "package.json"),
    );
    // The vendored copy strips the sourceMappingURL comment (we do not
    // ship the .map, and the dangling reference is build noise), so the
    // comparison strips it from upstream too.
    const stripMap = (css: string) =>
      css.replace(/\/\*# sourceMappingURL=.*?\*\/\s*/g, "").trimEnd();
    const upstream = stripMap(
      readFileSync(
        require.resolve("vis-timeline/styles/vis-timeline-graph2d.css"),
        "utf8",
      ),
    );
    const vendored = stripMap(
      readFileSync(resolve(here, "vis-timeline-vendor.css"), "utf8"),
    );
    expect(vendored).toBe(upstream);
  });
});
