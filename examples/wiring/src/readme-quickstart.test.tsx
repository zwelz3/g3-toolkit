/**
 * README quickstart, executed (P1.2).
 *
 * The "Minimal Integration (15 lines)" snippet in README.md already
 * typechecks under verify:snippets; this test additionally RUNS it:
 * the component below is the snippet VERBATIM (update both together;
 * the point is that the front door cannot rot). The SPARQL endpoint is
 * a stubbed global fetch returning a standard SELECT ?s ?p ?o JSON
 * result, so SparqlAdapter's real parsing executes; cytoscape is
 * mocked at the module level (the va26 pattern) so the REAL
 * CytoscapeCanvas mounts in jsdom.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("cytoscape", () => {
  const eles = { forEach: vi.fn(), length: 0, remove: vi.fn() };
  const cy = {
    layout: vi.fn(() => ({ run: vi.fn() })),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    batch: vi.fn((fn: () => void) => fn()),
    nodes: vi.fn(() => eles),
    edges: vi.fn(() => eles),
    elements: vi.fn(() => eles),
    add: vi.fn(),
    getElementById: vi.fn(() => ({
      nonempty: (): boolean => false,
      length: 0,
    })),
    style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
    zoom: vi.fn(() => 1),
    pan: vi.fn(),
    fit: vi.fn(),
    resize: vi.fn(),
    container: vi.fn(() => null),
    scratch: vi.fn(),
  };
  const factory = vi.fn(() => cy);
  (factory as unknown as Record<string, unknown>).use = vi.fn();
  return { default: factory };
});

// ── The README snippet, verbatim ─────────────────────────────────────
import { useEffect, useState } from "react";
import { UGM, SparqlAdapter } from "@g3t/core";
import { CytoscapeCanvas, TableView } from "@g3t/react";

function MyGraphPage() {
  const [ugm, setUgm] = useState<UGM | null>(null);

  useEffect(() => {
    new SparqlAdapter("/sparql")
      .query("SELECT * WHERE { ?s ?p ?o } LIMIT 200")
      .then(setUgm);
  }, []);

  if (!ugm) return <div>Loading...</div>;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        height: "100vh",
      }}
    >
      <CytoscapeCanvas ugm={ugm} />
      <TableView ugm={ugm} pageSize={20} />
    </div>
  );
}
// ── End verbatim snippet ─────────────────────────────────────────────

const SPARQL_JSON = {
  results: {
    bindings: [
      {
        s: { type: "uri", value: "http://ex.org/alice" },
        p: { type: "uri", value: "http://ex.org/knows" },
        o: { type: "uri", value: "http://ex.org/bob" },
      },
      {
        s: { type: "uri", value: "http://ex.org/alice" },
        p: { type: "uri", value: "http://ex.org/name" },
        o: { type: "literal", value: "Alice" },
      },
    ],
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(SPARQL_JSON),
      json: async () => SPARQL_JSON,
    })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("README quickstart (runtime twin)", () => {
  it("loads from the SPARQL endpoint and renders canvas plus table rows", async () => {
    const { container } = render(<MyGraphPage />);
    expect(screen.getByText("Loading...")).toBeDefined();

    await waitFor(() =>
      expect(
        container.querySelector("[data-testid='table-view']"),
      ).not.toBeNull(),
    );
    // The adapter's parsing produced real nodes; the table shows them.
    expect(container.textContent).toContain("alice");
    expect(container.textContent).toContain("bob");
    expect(
      container.querySelector("[data-testid='cytoscape-canvas']"),
    ).not.toBeNull();
  });
});
