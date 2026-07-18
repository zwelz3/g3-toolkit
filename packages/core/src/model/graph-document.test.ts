/**
 * Graph document + ELK import oracles (G3L:IOP-001/002).
 */
import { describe, expect, it } from "vitest";
import {
  GRAPH_DOCUMENT_SCHEMA,
  parseGraphDocument,
  serializeGraphDocument,
  toStructuralInput,
  validateGraphDocument,
  type GraphDocument,
} from "./graph-document";
import { importElkJson } from "./elk-import";

const DOC: GraphDocument = {
  version: 1,
  nodes: [
    { id: "sys", label: "System", layoutOptions: { "elk.direction": "DOWN" } },
    {
      id: "sensor",
      parent: "sys",
      label: "Sensor",
      width: 120,
      height: 60,
      ports: [{ id: "sensor.out", side: "EAST" }],
      data: { category: "hw" },
    },
    { id: "cpu", parent: "sys", label: "CPU", width: 140, height: 80 },
  ],
  edges: [
    {
      id: "feed",
      source: "sensor",
      target: "cpu",
      sourcePort: "sensor.out",
      label: "data",
      kind: "association",
    },
  ],
  styleRefs: { sensor: { classes: ["hardware"] } },
};

describe("IOP-001 graph document", () => {
  it("round-trips exactly (the spec's round-trip guarantee)", () => {
    const parsed = parseGraphDocument(serializeGraphDocument(DOC));
    expect("document" in parsed).toBe(true);
    if (!("document" in parsed)) return;
    expect(parsed.document).toEqual(DOC);
    expect(parsed.diagnostics).toEqual([]);
  });

  it("validates: duplicates, unknown parents, cycles, endpoints, foreign ports", () => {
    const bad: GraphDocument = {
      version: 1,
      nodes: [
        { id: "a" },
        { id: "a" },
        { id: "b", parent: "ghost" },
        { id: "c", parent: "d" },
        { id: "d", parent: "c" },
        { id: "e", ports: [{ id: "p1" }] },
      ],
      edges: [
        { id: "x", source: "a", target: "nope" },
        { id: "y", source: "a", target: "e", targetPort: "foreign" },
      ],
    };
    const codes = validateGraphDocument(bad)
      .map((d) => d.code)
      .sort();
    expect(codes).toContain("DUPLICATE_ID");
    expect(codes).toContain("UNKNOWN_PARENT");
    expect(codes).toContain("PARENT_CYCLE");
    expect(codes).toContain("UNKNOWN_ENDPOINT");
    expect(codes).toContain("UNKNOWN_PORT");
  });

  it("rejects junk and wrong versions with an error, not diagnostics", () => {
    expect("error" in parseGraphDocument("not json")).toBe(true);
    expect("error" in parseGraphDocument(JSON.stringify({ version: 2 }))).toBe(
      true,
    );
  });

  it("publishes a schema whose required surface matches the types", () => {
    expect(GRAPH_DOCUMENT_SCHEMA.required).toEqual([
      "version",
      "nodes",
      "edges",
    ]);
    expect(GRAPH_DOCUMENT_SCHEMA.properties.version.const).toBe(1);
  });

  it("projects to structural input honestly: hierarchy flattens WITH diagnostics", () => {
    const { input, diagnostics } = toStructuralInput(DOC);
    expect(input.nodes.map((n) => n.id).sort()).toEqual([
      "cpu",
      "sensor",
      "sys",
    ]);
    const flattened = diagnostics.filter(
      (d) => d.code === "HIERARCHY_FLATTENED",
    );
    expect(flattened.map((d) => d.subject).sort()).toEqual(["cpu", "sensor"]);
    // Ports and edge port refs survive the projection.
    expect(input.nodes.find((n) => n.id === "sensor")?.ports).toEqual([
      { id: "sensor.out", side: "EAST" },
    ]);
    expect(input.edges[0]?.sourcePort).toBe("sensor.out");
  });
});

describe("IOP-002 ELK import", () => {
  const ELK = {
    id: "root",
    children: [
      {
        id: "container",
        labels: [{ text: "Container" }],
        layoutOptions: { "elk.algorithm": "layered" },
        children: [
          {
            id: "leaf",
            labels: [{ text: "Leaf" }],
            width: 80,
            height: 40,
            ports: [
              {
                id: "leaf.p",
                layoutOptions: { "org.eclipse.elk.port.side": "EAST" },
              },
            ],
          },
        ],
      },
      { id: "other", width: 60, height: 30 },
    ],
    edges: [
      {
        id: "e1",
        sources: ["leaf.p"],
        targets: ["other"],
        labels: [{ text: "flows" }],
      },
    ],
  };

  it("imports hierarchy, ports (with sides), labels, and layout options losslessly", () => {
    const { document, diagnostics } = importElkJson(ELK);
    expect(diagnostics).toEqual([]);
    const leaf = document.nodes.find((n) => n.id === "leaf")!;
    expect(leaf.parent).toBe("container");
    expect(leaf.ports).toEqual([{ id: "leaf.p", side: "EAST" }]);
    const container = document.nodes.find((n) => n.id === "container")!;
    expect(container.layoutOptions).toEqual({ "elk.algorithm": "layered" });
    // Port-referencing edge resolves to the owning node + port ref.
    expect(document.edges[0]).toEqual({
      id: "e1",
      source: "leaf",
      target: "other",
      sourcePort: "leaf.p",
      label: "flows",
    });
  });

  it("hyperedges and routing sections are diagnosed, not silently dropped", () => {
    const { diagnostics } = importElkJson({
      id: "root",
      children: [{ id: "a" }, { id: "b" }, { id: "c" }],
      edges: [
        {
          id: "hyper",
          sources: ["a", "b"],
          targets: ["c"],
          sections: [{}],
        },
      ],
    });
    const codes = diagnostics.map((d) => d.code);
    expect(codes.filter((c) => c === "BAD_SHAPE").length).toBe(2);
  });
});
