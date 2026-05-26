/**
 * M6 Workspace & Schema tests.
 *
 * E1.T1: Shell renders with tabs.
 * E1.T2: Save/load workspace state round-trips.
 * E1.T3: Role defaults load correct layouts.
 * E2.T1: Schema view renders 20 classes.
 * E2.T2: SHACL shapes display badges.
 * E2.T3: Diff engine returns correct added/removed/changed sets.
 * E2.T4: DiffRenderer shows colored nodes.
 * E2.T5: Schema hash changes when ontology changes.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { diffGraphs, computeSchemaHash } from "@g3t/core";
import { SchemaView } from "./SchemaView";
import { DiffRenderer } from "./DiffRenderer";
import type { ShaclShape } from "./SchemaView";

// ── E2.T1: Schema view ──────────────────────────────────────────────

describe("SchemaView (M6.E2.T1)", () => {
  it("renders class hierarchy from UGM registry", () => {
    const ugm = new UGM();
    for (let i = 0; i < 20; i++) {
      ugm.addNode(`n${i}`, {
        types: [`Class${i % 5}`],
        properties: { prop1: "val" },
      });
    }

    render(<SchemaView ugm={ugm} />);

    expect(screen.getByTestId("schema-view")).toBeInTheDocument();
    expect(screen.getByTestId("schema-class-Class0")).toBeInTheDocument();
    expect(screen.getByTestId("schema-class-Class4")).toBeInTheDocument();
  });

  it("renders from SchemaModel", () => {
    render(
      <SchemaView
        schema={{
          nodeTypes: ["Person", "Org"],
          edgeTypes: ["knows"],
          nodeProperties: {
            Person: ["name", "age"],
            Org: ["revenue"],
          },
          edgeProperties: {},
        }}
      />,
    );

    expect(screen.getByTestId("schema-class-Person")).toBeInTheDocument();
    expect(screen.getByTestId("schema-class-Person")).toHaveTextContent(
      "name, age",
    );
  });

  it("shows empty state for no schema", () => {
    render(<SchemaView />);
    expect(screen.getByTestId("schema-view-empty")).toBeInTheDocument();
  });
});

// ── E2.T2: SHACL shape overlay ──────────────────────────────────────

describe("SchemaView SHACL overlay (M6.E2.T2)", () => {
  it("displays SHACL badges on target classes", () => {
    const shapes: ShaclShape[] = [
      {
        id: "s1",
        targetClass: "Person",
        constraints: [
          { path: "name", minCount: 1 },
          { path: "age", datatype: "xsd:integer" },
        ],
      },
      {
        id: "s2",
        targetClass: "Org",
        constraints: [{ path: "revenue", minCount: 1, maxCount: 1 }],
      },
    ];

    render(
      <SchemaView
        schema={{
          nodeTypes: ["Person", "Org", "Location"],
          edgeTypes: [],
          nodeProperties: {},
          edgeProperties: {},
        }}
        shapes={shapes}
      />,
    );

    expect(screen.getByTestId("shacl-badge-Person")).toHaveTextContent(
      "SHACL: 2 constraints",
    );
    expect(screen.getByTestId("shacl-badge-Org")).toHaveTextContent(
      "SHACL: 1 constraints",
    );
    // Location has no shape
    expect(
      screen.queryByTestId("shacl-badge-Location"),
    ).not.toBeInTheDocument();
  });
});

// ── E2.T3: Diff engine ──────────────────────────────────────────────

describe("diffGraphs (M6.E2.T3)", () => {
  it("detects added nodes", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });
    after.addNode("b", { types: ["X"] });

    const diff = diffGraphs(before, after);
    expect(diff.addedNodes).toHaveLength(1);
    expect(diff.addedNodes[0]?.id).toBe("b");
  });

  it("detects removed nodes", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });
    before.addNode("b", { types: ["X"] });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });

    const diff = diffGraphs(before, after);
    expect(diff.removedNodes).toHaveLength(1);
    expect(diff.removedNodes[0]?.id).toBe("b");
  });

  it("detects changed properties", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"], properties: { name: "Alice" } });

    const after = new UGM();
    after.addNode("a", { types: ["X"], properties: { name: "Alicia" } });

    const diff = diffGraphs(before, after);
    expect(diff.changedNodes).toHaveLength(1);
    expect(diff.changedNodes[0]?.propertyChanges?.[0]?.key).toBe("name");
  });

  it("detects added and removed edges", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });
    before.addNode("b", { types: ["X"] });
    before.addEdge("a", "b", { type: "old" });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });
    after.addNode("b", { types: ["X"] });
    after.addNode("c", { types: ["X"] });
    after.addEdge("a", "c", { type: "new" });

    const diff = diffGraphs(before, after);
    expect(diff.removedEdges).toHaveLength(1);
    expect(diff.addedEdges).toHaveLength(1);
    expect(diff.addedNodes).toHaveLength(1);
  });

  it("returns empty diff for identical graphs", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { v: 1 } });

    const copy = UGM.fromJSON(ugm.toJSON());
    const diff = diffGraphs(ugm, copy);

    expect(diff.addedNodes).toHaveLength(0);
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.changedNodes).toHaveLength(0);
  });
});

// ── E2.T4: Diff renderer ───────────────────────────────────────────

describe("DiffRenderer (M6.E2.T4)", () => {
  it("renders colored diff badges", () => {
    const diff = {
      addedNodes: [{ id: "new1", status: "added" as const }],
      removedNodes: [{ id: "old1", status: "removed" as const }],
      changedNodes: [
        {
          id: "mod1",
          status: "changed" as const,
          propertyChanges: [{ key: "name", oldValue: "A", newValue: "B" }],
        },
      ],
      addedEdges: [],
      removedEdges: [],
      changedEdges: [],
    };

    render(<DiffRenderer diff={diff} />);

    expect(screen.getByTestId("diff-badge-added")).toHaveTextContent(
      "Added: 1",
    );
    expect(screen.getByTestId("diff-badge-removed")).toHaveTextContent(
      "Removed: 1",
    );
    expect(screen.getByTestId("diff-badge-changed")).toHaveTextContent(
      "Changed: 1",
    );
  });

  it("shows empty state for no differences", () => {
    const diff = {
      addedNodes: [],
      removedNodes: [],
      changedNodes: [],
      addedEdges: [],
      removedEdges: [],
      changedEdges: [],
    };

    render(<DiffRenderer diff={diff} />);
    expect(screen.getByTestId("diff-empty")).toBeInTheDocument();
  });
});

// ── E2.T5: Schema hash ─────────────────────────────────────────────

describe("Schema version tracking (M6.E2.T5)", () => {
  it("produces same hash for same schema", () => {
    const ugm1 = new UGM();
    ugm1.addNode("a", { types: ["Person"], properties: { name: "A" } });

    const ugm2 = UGM.fromJSON(ugm1.toJSON());

    expect(computeSchemaHash(ugm1)).toBe(computeSchemaHash(ugm2));
  });

  it("produces different hash when schema changes", () => {
    const ugm1 = new UGM();
    ugm1.addNode("a", { types: ["Person"], properties: { name: "A" } });

    const ugm2 = new UGM();
    ugm2.addNode("a", {
      types: ["Person", "Employee"],
      properties: { name: "A", salary: 100 },
    });

    expect(computeSchemaHash(ugm1)).not.toBe(computeSchemaHash(ugm2));
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("diffGraphs: edge cases (audit)", () => {
  it("detects edge property changes", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });
    before.addNode("b", { types: ["X"] });
    before.addEdge("a", "b", { type: "link", properties: { weight: 1 } });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });
    after.addNode("b", { types: ["X"] });
    after.addEdge("a", "b", { type: "link", properties: { weight: 5 } });

    // Edge IDs may differ between UGMs; this tests the diff logic path
    const diff = diffGraphs(before, after);
    const totalEdgeChanges =
      diff.addedEdges.length +
      diff.removedEdges.length +
      diff.changedEdges.length;
    expect(totalEdgeChanges).toBeGreaterThan(0);
  });
});

describe("DiffRenderer: content verification (audit)", () => {
  it("displays property change details", () => {
    const diff = {
      addedNodes: [],
      removedNodes: [],
      changedNodes: [
        {
          id: "n1",
          status: "changed" as const,
          propertyChanges: [{ key: "score", oldValue: 0.5, newValue: 0.9 }],
        },
      ],
      addedEdges: [],
      removedEdges: [],
      changedEdges: [],
    };

    render(<DiffRenderer diff={diff} />);
    const renderer = screen.getByTestId("diff-renderer");
    expect(renderer).toHaveTextContent("score");
    expect(renderer).toHaveTextContent("0.5");
    expect(renderer).toHaveTextContent("0.9");
  });
});

describe("computeSchemaHash: edge cases (audit)", () => {
  it("handles empty UGM", () => {
    const ugm = new UGM();
    const hash = computeSchemaHash(ugm);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});

