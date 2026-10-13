/**
 * Public-API dist tests (RECONSTRUCTED 2026-07-03).
 *
 * The original file was lost between agent rounds by a packaging step
 * that pruned directories named `dist` and caught this source
 * directory; the received zip lacked it while package.json
 * (verify:exports), vitest.dist.config.ts, and ci.yml all reference
 * it. Rebuilt from that documented contract:
 *
 *   1. Every exports-map resolution target (types / import / require)
 *      of every @g3-toolkit package exists on disk after build:packages.
 *   2. Every built ESM entry re-exports the named symbols its source
 *      barrel exports (the root barrel is compared exhaustively; a
 *      built subpath entry must be a superset of nothing, it is only
 *      required to load and expose at least one export).
 *
 * Requires `pnpm run build:packages` first; runs under verify, not
 * under the default test include (see vitest.dist.config.ts).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const PACKAGES = ["core", "react", "charts"] as const;

interface ExportsEntry {
  types?: string;
  import?: string;
  require?: string;
}

function readManifest(pkg: string): {
  dir: string;
  exports: Record<string, ExportsEntry | string>;
} {
  const dir = resolve(root, "packages", pkg);
  const manifest = JSON.parse(
    readFileSync(resolve(dir, "package.json"), "utf8"),
  ) as { exports: Record<string, ExportsEntry | string> };
  return { dir, exports: manifest.exports };
}

describe("exports-map targets exist on disk", () => {
  for (const pkg of PACKAGES) {
    it(`@g3-toolkit/${pkg}: every types/import/require target exists`, () => {
      const { dir, exports } = readManifest(pkg);
      const missing: string[] = [];
      for (const [subpath, entry] of Object.entries(exports)) {
        const targets =
          typeof entry === "string"
            ? [entry]
            : [entry.types, entry.import, entry.require].filter(
                (t): t is string => Boolean(t),
              );
        for (const t of targets) {
          if (!existsSync(resolve(dir, t))) missing.push(`${subpath} -> ${t}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});

describe("the published format is ESM only", () => {
  // Guards the 2026-08-16 ruling. Re-adding a `require` condition or a
  // cjs build format reinstates the dual-package hazard: the library's
  // integration channel is exported zustand store SINGLETONS, and a
  // consumer reaching a package through both `import` and `require`
  // gets two module instances, so the canvas subscribes to one store
  // while the table writes to the other and selection stops working
  // with nothing in a stack trace. That is not fixable from inside the
  // library while both formats ship, so it is fixed here.
  for (const pkg of PACKAGES) {
    it(`@g3-toolkit/${pkg}: no require condition, no main, no .cjs on disk`, () => {
      const { dir, exports } = readManifest(pkg);
      const manifest = JSON.parse(
        readFileSync(resolve(dir, "package.json"), "utf8"),
      ) as { main?: string };

      const withRequire = Object.entries(exports)
        .filter(
          ([, entry]) => typeof entry !== "string" && entry.require !== undefined,
        )
        .map(([subpath]) => subpath);
      expect(withRequire).toEqual([]);

      // `main` is the CJS entry field; it pointed at dist/index.cjs.
      expect(manifest.main).toBeUndefined();

      const cjs = readdirSync(resolve(dir, "dist"), {
        recursive: true,
      }).filter((f) => typeof f === "string" && f.endsWith(".cjs"));
      expect(cjs).toEqual([]);
    });
  }
});

describe("built root entries re-export the source barrel", () => {
  for (const pkg of PACKAGES) {
    it(`@g3-toolkit/${pkg}: dist/index.mjs exposes every source-barrel named export`, async () => {
      const { dir, exports } = readManifest(pkg);
      const rootEntry = exports["."];
      expect(rootEntry).toBeDefined();
      if (rootEntry === undefined) return;
      const importTarget =
        typeof rootEntry === "string" ? rootEntry : rootEntry.import;
      expect(importTarget).toBeDefined();

      const src = (await import(
        pathToFileURL(resolve(dir, "src", "index.ts")).href
      )) as Record<string, unknown>;
      const dist = (await import(
        pathToFileURL(resolve(dir, String(importTarget))).href
      )) as Record<string, unknown>;

      // Type-only exports vanish at runtime from BOTH sides, so runtime
      // key parity is the right comparison.
      const srcKeys = Object.keys(src).filter((k) => k !== "default");
      const distKeys = new Set(Object.keys(dist));
      const missing = srcKeys.filter((k) => !distKeys.has(k));
      expect(missing).toEqual([]);
      expect(srcKeys.length).toBeGreaterThan(0);
    });
  }
});

describe("the component stylesheet styles g3t elements only", () => {
  // Guards issue #24. dist/style.css once carried a Google Fonts
  // @import, a universal `*` reset and a `body` typography rule, and
  // importing it (the documented first line of every quickstart)
  // restyled every page of the host application: body font swapped to
  // IBM Plex at 13px, list and heading margins zeroed on pages with no
  // graph on them, and a third-party request on load that offline,
  // strict-CSP and air-gapped hosts cannot make. The reset and body
  // rule now ship as the OPT-IN dist/style.base.css. Selector-level
  // checks run on the built file rather than the source so a stray
  // stylesheet imported by any entry (cssCodeSplit is off, so every
  // css import lands in this one file) is caught too.
  const reactDist = resolve(root, "packages", "react", "dist");

  /** Selector lists of every top-level rule, comments and bodies removed. */
  function selectorsOf(css: string): string[] {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors: string[] = [];
    // Walk rule-by-rule: text before a `{` at depth 0 or 1 is a
    // selector list (depth 1 covers rules nested in @media), and
    // braces are tracked so declaration bodies are skipped.
    let depth = 0;
    let buf = "";
    for (const ch of noComments) {
      if (ch === "{") {
        const head = buf.trim();
        if (!head.startsWith("@")) {
          for (const s of head.split(",")) {
            const sel = s.trim();
            if (sel) selectors.push(sel);
          }
        }
        depth++;
        buf = "";
      } else if (ch === "}") {
        depth--;
        buf = "";
      } else if (ch === ";" && depth > 0) {
        buf = "";
      } else {
        buf += ch;
      }
    }
    return selectors;
  }

  it("dist/style.css has no bare body, html or * selector", () => {
    const css = readFileSync(resolve(reactDist, "style.css"), "utf8");
    const bare = selectorsOf(css).filter((sel) =>
      /^(\*|html|body|:root)(\s*::?[\w-]+)?$|^\*\s*,|^(html|body)\s*[\s>+~]/.test(
        sel,
      ),
    );
    // `:root` is allowed only as a token host (custom properties), which
    // the reduced-motion block uses; anything else page-level fails.
    const offenders = bare.filter((sel) => !sel.startsWith(":root"));
    expect(offenders).toEqual([]);
    expect(selectorsOf(css).length).toBeGreaterThan(50);
  });

  /** The stylesheet with comments removed: prose may NAME @import. */
  function codeOf(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  it("dist/style.css does not @import a remote URL", () => {
    const css = codeOf(readFileSync(resolve(reactDist, "style.css"), "utf8"));
    expect(css).not.toMatch(/@import\s+url\(\s*["']?https?:/i);
    expect(css).not.toMatch(/@import\s+["']https?:/i);
    expect(css).not.toMatch(/fonts\.googleapis\.com/);
  });

  it("the page reset ships as the opt-in dist/style.base.css and is exported", () => {
    const base = resolve(reactDist, "style.base.css");
    expect(existsSync(base)).toBe(true);
    const css = readFileSync(base, "utf8");
    // The opt-in file is where the reset and body rule live now; if
    // they vanish from here too, the playground silently loses them.
    const selectors = selectorsOf(css);
    expect(selectors).toContain("*");
    expect(selectors).toContain("body");
    expect(codeOf(css)).not.toMatch(/@import/);

    const { exports } = readManifest("react");
    const entry = exports["./style.base.css"];
    expect(entry).toBeDefined();
    expect(typeof entry === "string" ? entry : entry?.types).toBeDefined();
  });
});

describe("built subpath entries load", () => {
  for (const pkg of PACKAGES) {
    it(`@g3-toolkit/${pkg}: every ESM subpath entry imports and is non-empty`, async () => {
      const { dir, exports } = readManifest(pkg);
      for (const [subpath, entry] of Object.entries(exports)) {
        if (subpath === "." || subpath === "./package.json") continue;
        const importTarget = typeof entry === "string" ? entry : entry.import;
        if (!importTarget || !importTarget.endsWith(".mjs")) continue;
        const mod = (await import(
          pathToFileURL(resolve(dir, importTarget)).href
        )) as Record<string, unknown>;
        expect(
          Object.keys(mod).length,
          `${pkg} ${subpath} exports nothing`,
        ).toBeGreaterThan(0);
      }
    });
  }
});
