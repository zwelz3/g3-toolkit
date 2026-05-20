/**
 * DetailInspector tests covering E0.5 acceptance criteria:
 *
 * T1: Render node properties; render edge with confidence; nested object expands.
 * T2: Inspect node A; inspect node B; inspector updates.
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@core/ugm";
import { DetailInspector } from "./DetailInspector";

function createTestUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("alice", {
    types: ["Person", "Analyst"],
    properties: { name: "Alice", age: 30, nested: { deep: true } },
  });
  ugm.addNode("bob", {
    types: ["Person"],
    properties: { name: "Bob", score: 0.95 },
  });
  ugm.addEdge("alice", "bob", {
    type: "knows",
    properties: { since: 2020 },
    confidence: 0.9,
    provenance_iri: "urn:source:42",
    asserted: true,
  });
  return ugm;
}

// ── T1: Detail panel rendering ──────────────────────────────────────

describe("DetailInspector: node properties (M0.E5.T1)", () => {
  it("shows empty state when no selection", () => {
    const ugm = createTestUGM();
    render(<DetailInspector ugm={ugm} selection={null} />);

    expect(screen.getByTestId("detail-inspector")).toBeInTheDocument();
    expect(screen.getByText(/right-click/i)).toBeInTheDocument();
  });

  it("renders node types and properties", () => {
    const ugm = createTestUGM();
    render(
      <DetailInspector ugm={ugm} selection={{ type: "node", id: "alice" }} />,
    );

    expect(screen.getByText("Node: alice")).toBeInTheDocument();
    expect(screen.getByText(/Person, Analyst/)).toBeInTheDocument();
    expect(screen.getByTestId("prop-name")).toHaveTextContent("Alice");
    expect(screen.getByTestId("prop-age")).toHaveTextContent("30");
  });

  it("renders nested object properties", () => {
    const ugm = createTestUGM();
    render(
      <DetailInspector ugm={ugm} selection={{ type: "node", id: "alice" }} />,
    );

    // Nested object renders as JSON
    expect(screen.getByTestId("prop-nested")).toHaveTextContent(
      '{"deep":true}',
    );
  });

  it("renders edge with Qualified Edge metadata", () => {
    const ugm = createTestUGM();

    // Find the edge ID
    let edgeId = "";
    ugm.forEachEdge((id) => {
      edgeId = id;
    });

    render(
      <DetailInspector ugm={ugm} selection={{ type: "edge", id: edgeId }} />,
    );

    expect(screen.getByText(/alice → bob/)).toBeInTheDocument();
    expect(screen.getByTestId("prop-Type")).toHaveTextContent("knows");
    expect(screen.getByTestId("prop-since")).toHaveTextContent("2020");
    // Qualified Edge metadata section
    expect(screen.getByTestId("prop-confidence")).toHaveTextContent("0.9");
    expect(screen.getByTestId("prop-provenance_iri")).toHaveTextContent(
      "urn:source:42",
    );
    expect(screen.getByTestId("prop-asserted")).toHaveTextContent("true");
  });

  it("collapses/expands property sections", () => {
    const ugm = createTestUGM();
    render(
      <DetailInspector ugm={ugm} selection={{ type: "node", id: "alice" }} />,
    );

    const propertiesSection = screen.getByTestId("section-Properties");
    expect(screen.getByTestId("prop-name")).toBeInTheDocument();

    // Collapse
    fireEvent.click(propertiesSection);
    expect(screen.queryByTestId("prop-name")).not.toBeInTheDocument();

    // Expand
    fireEvent.click(propertiesSection);
    expect(screen.getByTestId("prop-name")).toBeInTheDocument();
  });
});

// ── T2: Inspector updates on selection change ───────────────────────

describe("DetailInspector: selection change (M0.E5.T2)", () => {
  it("updates when selection changes from alice to bob", () => {
    const ugm = createTestUGM();

    const { rerender } = render(
      <DetailInspector ugm={ugm} selection={{ type: "node", id: "alice" }} />,
    );

    expect(screen.getByText("Node: alice")).toBeInTheDocument();
    expect(screen.getByTestId("prop-name")).toHaveTextContent("Alice");

    // Change selection to bob
    rerender(
      <DetailInspector ugm={ugm} selection={{ type: "node", id: "bob" }} />,
    );

    expect(screen.getByText("Node: bob")).toBeInTheDocument();
    expect(screen.getByTestId("prop-name")).toHaveTextContent("Bob");
  });

  it("shows not-found for deleted nodes", () => {
    const ugm = createTestUGM();

    render(
      <DetailInspector
        ugm={ugm}
        selection={{ type: "node", id: "nonexistent" }}
      />,
    );

    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });
});

// ── Audit additions ─────────────────────────────────────────────────

describe("DetailInspector: edge cases (audit)", () => {
  it("renders edge without metadata section when meta is empty", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addEdge("a", "b", { type: "plain-link" });

    let edgeId = "";
    ugm.forEachEdge((id) => {
      edgeId = id;
    });

    render(
      <DetailInspector ugm={ugm} selection={{ type: "edge", id: edgeId }} />,
    );

    expect(screen.getByTestId("prop-Type")).toHaveTextContent("plain-link");
    // No "Qualified Edge Metadata" section should appear
    expect(
      screen.queryByTestId("section-Qualified Edge Metadata"),
    ).not.toBeInTheDocument();
  });
});
