/**
 * Coverage gap tests: design tokens, adapter middleware,
 * and selection CSS class verification.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { UGM } from "@core/ugm";
import {
  injectDesignTokens,
  DESIGN_TOKENS,
  DARK_SHADOWS,
} from "@theme/design-tokens";
import { SparqlAdapter } from "@core/adapter/sparql-adapter";
import { CypherAdapter } from "@core/adapter/cypher-adapter";
import type { Middleware } from "@core/middleware";

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
      "src/views/canvas/CytoscapeCanvas.tsx",
      "utf-8",
    );

    // Verify CSS class pattern is used
    expect(source).toContain("g3t-selected");
    expect(source).toContain("addClass");
    expect(source).toContain("removeClass");

    // Verify :selected is NOT used for styling (only read in boxend)
    const styleEntries = source.match(/selector:.*selected/g) ?? [];
    for (const entry of styleEntries) {
      expect(entry).toContain("g3t-selected");
      expect(entry).not.toMatch(/:selected/);
    }
  });

  it("subscription uses addClass/removeClass (not select/unselect)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/views/canvas/CytoscapeCanvas.tsx",
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
