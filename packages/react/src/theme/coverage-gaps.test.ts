/**
 * Coverage gap tests: design tokens, adapter middleware,
 * and selection CSS class verification.
 */

import { describe, it, expect, vi } from "vitest";
import { injectDesignTokens, DESIGN_TOKENS, DARK_SHADOWS } from "@g3t/core";
import { SparqlAdapter } from "@g3t/core";
import { CypherAdapter } from "@g3t/core";
import type { Middleware } from "@g3t/core";

// ── Design Tokens (M8.5) ───────────────────────────────────────────

describe("injectDesignTokens", () => {
  it("injects font family CSS variable", () => {
    injectDesignTokens(false);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--g3t-font")).toBe(
      DESIGN_TOKENS.fontFamily,
    );
  });

  it("injects spacing variables", () => {
    injectDesignTokens(false);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--g3t-space-4")).toBe("16px");
  });

  it("injects radius variables", () => {
    injectDesignTokens(false);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--g3t-radius-md")).toBe("6px");
  });

  it("uses standard shadows for light mode", () => {
    injectDesignTokens(false);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--g3t-shadow-sm")).toBe(
      DESIGN_TOKENS.shadowSm,
    );
  });

  it("uses darker shadows for dark mode", () => {
    injectDesignTokens(true);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--g3t-shadow-sm")).toBe(
      DARK_SHADOWS.shadowSm,
    );
  });

  it("injects transition variables", () => {
    injectDesignTokens(false);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--g3t-transition-fast")).toBe(
      "120ms ease",
    );
  });
});

// ── SPARQL Adapter with Middleware ───────────────────────────────────

describe("SparqlAdapter with middleware option", () => {
  it("applies middleware to SPARQL requests", async () => {
    const log: string[] = [];
    const loggingMiddleware: Middleware = async (req, next) => {
      log.push(`${req.method} ${req.url}`);
      return next(req);
    };

    const mockResponse = {
      results: {
        bindings: [
          {
            s: { type: "uri" as const, value: "http://example.org/a" },
            p: { type: "uri" as const, value: "http://example.org/name" },
            o: { type: "literal" as const, value: "Alice" },
          },
        ],
      },
    };

    // Use the middleware option (3rd parameter)
    const adapter = new SparqlAdapter("http://example.org/sparql", undefined, {
      middleware: [
        loggingMiddleware,
        // Mock the actual fetch at the end of the chain
        async (_req, _next) => ({
          status: 200,
          ok: true,
          body: JSON.stringify(mockResponse),
          headers: {},
        }),
      ],
    });

    const ugm = await adapter.query("SELECT ?s ?p ?o WHERE { ?s ?p ?o }");
    expect(ugm.nodeCount).toBeGreaterThan(0);
    expect(log).toHaveLength(1);
    expect(log[0]).toContain("POST");
  });
});

// ── Cypher Adapter with Middleware ───────────────────────────────────

describe("CypherAdapter with middleware option", () => {
  it("applies middleware to Cypher requests", async () => {
    const capturedHeaders: Record<string, string>[] = [];
    const headerCapture: Middleware = async (req, next) => {
      capturedHeaders.push({ ...req.headers });
      return next(req);
    };

    const mockResponse = {
      results: [
        {
          columns: ["n"],
          data: [
            {
              row: [{}],
              graph: {
                nodes: [
                  { id: "1", labels: ["Person"], properties: { name: "Bob" } },
                ],
                relationships: [],
              },
            },
          ],
        },
      ],
      errors: [],
    };

    const adapter = new CypherAdapter(
      "http://neo4j:7474/db/neo4j/tx/commit",
      undefined,
      undefined,
      {
        middleware: [
          headerCapture,
          async (_req, _next) => ({
            status: 200,
            ok: true,
            body: JSON.stringify(mockResponse),
            headers: {},
          }),
        ],
      },
    );

    const ugm = await adapter.query("MATCH (n) RETURN n LIMIT 1");
    expect(ugm.nodeCount).toBe(1);
    expect(capturedHeaders).toHaveLength(1);
    expect(capturedHeaders[0]?.["Content-Type"]).toBe("application/json");
  });
});

// ── Selection CSS Class (.g3t-selected) ─────────────────────────────

describe("Canvas selection uses .g3t-selected CSS class", () => {
  it("stylesheet uses .g3t-selected selector (not :selected)", async () => {
    // Read the CytoscapeCanvas source to verify the architecture
    const fs = await import("fs");
    const source = fs.readFileSync(
      "packages/react/src/views/canvas/CytoscapeCanvas.tsx",
      "utf-8",
    );

    // Verify CSS class pattern is used
    expect(source).toContain("g3t-selected");
    expect(source).toContain("addClass");
    expect(source).toContain("removeClass");

    // Verify :selected is NOT used for styling (the box-selection sync
    // clears it; see box-selection-sync.ts)
    const styleEntries = source.match(/selector:.*selected/g) ?? [];
    for (const entry of styleEntries) {
      expect(entry).toContain("g3t-selected");
      expect(entry).not.toMatch(/:selected/);
    }
  });

  it("subscription uses addClass/removeClass (not select/unselect)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "packages/react/src/views/canvas/CytoscapeCanvas.tsx",
      "utf-8",
    );

    // The subscription should use addClass, not cy.select()
    const subscribeBlock = source.split("useSelectionStore.subscribe")[1] ?? "";
    expect(subscribeBlock).toContain("addClass");
    expect(subscribeBlock).toContain("removeClass");

    // cy.select() should NOT appear in the subscription
    // (it should only appear in comments)
    const subscribeLines = subscribeBlock.split("\n").slice(0, 20);
    const nonCommentLines = subscribeLines.filter(
      (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"),
    );
    const joinedNonComment = nonCommentLines.join(" ");
    expect(joinedNonComment).not.toMatch(/\.select\(\)/);
  });
});

// ── Design-system quality floor (design-system roadmap, A-tier) ─────

import { SEQUENTIAL_SCALE, DIVERGING_SCALE, scaleColor } from "@g3t/core";

describe("data scale tokens", () => {
  it("injects sequential and diverging scale variables", () => {
    injectDesignTokens();
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--g3t-seq-0")).toBe(SEQUENTIAL_SCALE[0]);
    expect(root.getPropertyValue("--g3t-seq-8")).toBe(SEQUENTIAL_SCALE[8]);
    expect(root.getPropertyValue("--g3t-div-4")).toBe(DIVERGING_SCALE[4]);
  });

  it("injects focus-ring and z-index tokens", () => {
    injectDesignTokens();
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--g3t-focus-ring-width")).toBe("2px");
    expect(root.getPropertyValue("--g3t-z-tooltip")).toBe("1200");
  });

  it("scaleColor clamps and maps endpoints", () => {
    expect(scaleColor(0)).toBe(SEQUENTIAL_SCALE[0]);
    expect(scaleColor(1)).toBe(SEQUENTIAL_SCALE[8]);
    expect(scaleColor(-5)).toBe(SEQUENTIAL_SCALE[0]);
    expect(scaleColor(Number.NaN)).toBe(SEQUENTIAL_SCALE[0]);
    expect(scaleColor(0.5, DIVERGING_SCALE)).toBe(DIVERGING_SCALE[4]);
  });
});

// ── A2: reduced motion reaches JS-driven animation ──────────────────

import { prefersReducedMotion } from "@g3t/core";
import { deriveEChartsTheme, LIGHT_THEME } from "./ThemeManager";

describe("prefersReducedMotion", () => {
  it("is false when matchMedia is unavailable (SSR-safe)", () => {
    const original = window.matchMedia;
    // @ts-expect-error simulate environment without matchMedia
    delete window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
    window.matchMedia = original;
  });

  it("reflects the media query and reaches the ECharts theme", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
    expect(deriveEChartsTheme(LIGHT_THEME).animation).toBe(false);
    window.matchMedia = original;
    expect(deriveEChartsTheme(LIGHT_THEME).animation).toBe(
      !prefersReducedMotion(),
    );
  });
});

// ── C1 gasket halo (visual round-4 fix) ─────────────────────────────

import { deriveCytoscapeStyle } from "./ThemeManager";

describe("selection gasket halo", () => {
  it("selected nodes use an offset outline, not a border swap", () => {
    const styles = deriveCytoscapeStyle(LIGHT_THEME) as Array<{
      selector: string;
      style: Record<string, unknown>;
    }>;
    const sel = styles.find((s) => s.selector === "node.g3t-selected");
    expect(sel?.style["outline-color"]).toBe(LIGHT_THEME.accentPrimary);
    expect(sel?.style["outline-width"]).toBe(3);
    expect(sel?.style["outline-offset"]).toBe(2);
    // The node's own border is untouched by selection (no fill/border
    // recoloring; the double-ring border-style is retired).
    expect(sel?.style["border-style"]).toBeUndefined();
    expect(sel?.style["border-color"]).toBeUndefined();
  });
});

// ── createTheme (customization layer 1) ─────────────────────────────

import { createTheme, contrastRatio } from "./ThemeManager";

describe("createTheme", () => {
  it("computes WCAG ratios correctly", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 1);
    expect(contrastRatio("rgba(0,0,0,0.5)", "#fff")).toBeNull();
  });

  it("merges over the light base and stays silent for sound themes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = createTheme({
      id: "brand",
      name: "Brand",
      accentPrimary: "#7a0bc0",
    });
    expect(t.bgPrimary).toBe(LIGHT_THEME.bgPrimary);
    expect(t.accentPrimary).toBe("#7a0bc0");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns (without blocking) on low-contrast pairs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = createTheme({
      id: "pale",
      name: "Pale",
      accentPrimary: "#dddddd",
    });
    expect(t.accentPrimary).toBe("#dddddd");
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      "accentPrimary/bgPrimary",
    );
    warn.mockRestore();
  });
});
