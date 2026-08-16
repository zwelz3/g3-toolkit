/**
 * Data adapter tests covering M3 acceptance criteria:
 *
 * E1.T1: TypeScript compiles; interface is exported.
 * E2.T1: SPARQL adapter with mock fetch; query returns UGM.
 * E2.T2: Cypher adapter with mock fetch; query returns UGM.
 * E2.T3: Holonic adapter; 3 holons → UGM with 3 nodes.
 * E2.T4: Holonic portal right-click; menu items registered. (logic only; visual deferred)
 * E3.T1: Ingest PageRank scores; UGM nodes have pagerank property.
 * E3.T2: UGM 100 nodes + CSV 80 rows; 80 nodes have extra properties.
 */

import { describe, it, expect, vi } from "vitest";
import { UGM } from "../ugm";
import { SparqlAdapter } from "./sparql-adapter";
import { CypherAdapter } from "./cypher-adapter";
import { HolonicAdapter } from "./holonic-adapter";
import { GremlinAdapter } from "./gremlin-adapter";
import { RestAdapter } from "./rest-adapter";
import { AdapterArgumentError } from "./query-safety";
import type { HolonicDataset } from "./holonic-adapter";
import { ingestAlgorithmResults } from "../algorithm-adapter";
import { bearerAuth } from "../middleware";

// GremlinAdapter response type (mirrors internal type)
interface GremlinResponse {
  result: { data: unknown };
  status: { code: number; message: string };
}
import { virtualizeRelationalData, parseCSV } from "../relational-virtualizer";

// ── E1.T1: Interface compiles ───────────────────────────────────────

describe("GraphAdapter interface (M3.E1.T1)", () => {
  it("SparqlAdapter implements GraphAdapter", () => {
    const adapter = new SparqlAdapter("http://example.org/sparql", vi.fn());
    expect(adapter.name).toBe("SPARQL Endpoint");
    expect(adapter.id).toBe("sparql");
    expect(typeof adapter.query).toBe("function");
    expect(typeof adapter.expandNeighborhood).toBe("function");
    expect(typeof adapter.getSchema).toBe("function");
    expect(typeof adapter.getNodeProperties).toBe("function");
  });

  it("CypherAdapter implements GraphAdapter", () => {
    const adapter = new CypherAdapter(
      "http://localhost:7474/db/neo4j/tx",
      vi.fn(),
    );
    expect(adapter.id).toBe("cypher");
    expect(typeof adapter.query).toBe("function");
  });

  it("HolonicAdapter implements GraphAdapter", () => {
    const adapter = new HolonicAdapter({ holons: [] });
    expect(adapter.id).toBe("holonic");
    expect(typeof adapter.query).toBe("function");
  });
});

// ── E2.T1: SPARQL adapter ──────────────────────────────────────────

describe("SparqlAdapter (M3.E2.T1)", () => {
  it("parses SPARQL SELECT results into UGM nodes and edges", async () => {
    const mockResponse = {
      results: {
        bindings: [
          {
            s: { type: "uri" as const, value: "http://ex.org/alice" },
            p: { type: "uri" as const, value: "http://ex.org/knows" },
            o: { type: "uri" as const, value: "http://ex.org/bob" },
          },
          {
            s: { type: "uri" as const, value: "http://ex.org/alice" },
            p: { type: "uri" as const, value: "http://ex.org/name" },
            o: { type: "literal" as const, value: "Alice" },
          },
        ],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const adapter = new SparqlAdapter(
      "http://test/sparql",
      mockFetch as unknown as typeof fetch,
    );
    const ugm = await adapter.query("SELECT ?s ?p ?o WHERE { ?s ?p ?o }");

    expect(ugm.nodeCount).toBe(2); // alice, bob
    expect(ugm.edgeCount).toBe(1); // alice knows bob
    expect(ugm.getNode("http://ex.org/alice")?.properties.name).toBe("Alice");
  });

  it("throws on HTTP error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const adapter = new SparqlAdapter(
      "http://test/sparql",
      mockFetch as unknown as typeof fetch,
    );
    await expect(adapter.query("BAD QUERY")).rejects.toThrow(
      "SPARQL query failed",
    );
  });

  // RDF 1.2 triple-term ingestion — PROV-O fold from kb graphs surfaces
  // as `{ type: "triple", value: { subject, predicate, object } }` per
  // the SPARQL 1.2 JSON results format. Regression: the pre-fix branch
  // stringified the triple-term object to "[object Object]".
  it("ingests an RDF 1.2 triple-term object without corruption", async () => {
    const mockResponse = {
      results: {
        bindings: [
          {
            s: {
              type: "uri" as const,
              value: "https://forge.example/kb/Plan/orch-scaffold-abc",
            },
            p: {
              type: "uri" as const,
              value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#typeAssertion",
            },
            o: {
              type: "triple" as const,
              value: {
                subject: {
                  type: "uri" as const,
                  value: "https://forge.example/kb/Plan/orch-scaffold-abc",
                },
                predicate: {
                  type: "uri" as const,
                  value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                object: {
                  type: "uri" as const,
                  value: "https://forge.example/kb/Plan",
                },
              },
            },
          },
        ],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const adapter = new SparqlAdapter(
      "http://test/sparql",
      mockFetch as unknown as typeof fetch,
    );
    const ugm = await adapter.query(
      "SELECT ?s ?p ?o WHERE { ?s ?p ?o . << ?s rdf:type ?o >> ?p ?o }",
    );

    const subject = "https://forge.example/kb/Plan/orch-scaffold-abc";
    const node = ugm.getNode(subject);
    expect(node).toBeDefined();

    const stored = node?.properties.typeAssertion as
      | { subject: unknown; predicate: unknown; object: unknown }
      | undefined;
    expect(stored).toBeDefined();
    // Never store the object as the "[object Object]" stringification.
    // Serialize before scanning: String() on any structured object is itself
    // "[object Object]", so it can only pass the intended check for a value the
    // code has already flattened. JSON.stringify inspects the stored shape.
    expect(JSON.stringify(stored)).not.toContain("[object Object]");
    expect(stored?.subject).toEqual({ type: "uri", value: subject });
    expect(stored?.predicate).toEqual({
      type: "uri",
      value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    });
    expect(stored?.object).toEqual({
      type: "uri",
      value: "https://forge.example/kb/Plan",
    });
  });

  it("preserves nested triple terms recursively", async () => {
    const inner = {
      subject: {
        type: "uri" as const,
        value: "https://forge.example/kb/inner-s",
      },
      predicate: {
        type: "uri" as const,
        value: "https://forge.example/kb/inner-p",
      },
      object: { type: "literal" as const, value: "inner-o" },
    };
    const mockResponse = {
      results: {
        bindings: [
          {
            s: {
              type: "uri" as const,
              value: "https://forge.example/kb/outer-s",
            },
            p: {
              type: "uri" as const,
              value: "https://forge.example/kb/wraps",
            },
            o: {
              type: "triple" as const,
              value: {
                subject: {
                  type: "uri" as const,
                  value: "https://forge.example/kb/mid-s",
                },
                predicate: {
                  type: "uri" as const,
                  value: "https://forge.example/kb/mid-p",
                },
                object: { type: "triple" as const, value: inner },
              },
            },
          },
        ],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const adapter = new SparqlAdapter(
      "http://test/sparql",
      mockFetch as unknown as typeof fetch,
    );
    const ugm = await adapter.query("SELECT ?s ?p ?o WHERE { ?s ?p ?o }");

    const outer = ugm.getNode("https://forge.example/kb/outer-s");
    const wraps = outer?.properties.wraps as
      | { subject: unknown; predicate: unknown; object: unknown }
      | undefined;
    expect(wraps).toBeDefined();
    const nestedObject = wraps?.object as {
      type: string;
      value: { subject: unknown; predicate: unknown; object: unknown };
    };
    expect(nestedObject.type).toBe("triple");
    expect(nestedObject.value.subject).toEqual({
      type: "uri",
      value: "https://forge.example/kb/inner-s",
    });
    expect(nestedObject.value.object).toEqual({
      type: "literal",
      value: "inner-o",
    });
  });
});

// ── E2.T2: Cypher adapter ──────────────────────────────────────────

describe("CypherAdapter (M3.E2.T2)", () => {
  it("parses Neo4j graph results into UGM", async () => {
    const mockResponse = {
      results: [
        {
          columns: ["n", "r", "m"],
          data: [
            {
              row: [],
              graph: {
                nodes: [
                  {
                    id: "1",
                    labels: ["Person"],
                    properties: { name: "Alice" },
                  },
                  { id: "2", labels: ["Person"], properties: { name: "Bob" } },
                ],
                relationships: [
                  {
                    id: "r1",
                    type: "KNOWS",
                    startNode: "1",
                    endNode: "2",
                    properties: { since: 2020 },
                  },
                ],
              },
            },
          ],
        },
      ],
      errors: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const adapter = new CypherAdapter(
      "http://test:7474/db/neo4j/tx",
      mockFetch as unknown as typeof fetch,
    );
    const ugm = await adapter.query("MATCH (n)-[r]->(m) RETURN n, r, m");

    expect(ugm.nodeCount).toBe(2);
    expect(ugm.edgeCount).toBe(1);
    expect(ugm.getNode("1")?.types).toContain("Person");
    expect(ugm.getNode("1")?.properties.name).toBe("Alice");
  });

  it("throws on Cypher error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          errors: [{ code: "Neo.ClientError", message: "Syntax error" }],
        }),
    });

    const adapter = new CypherAdapter(
      "http://test:7474/db/neo4j/tx",
      mockFetch as unknown as typeof fetch,
    );
    await expect(adapter.query("BAD CYPHER")).rejects.toThrow("Cypher error");
  });
});

// ── E2.T3: Holonic adapter ─────────────────────────────────────────

describe("HolonicAdapter (M3.E2.T3)", () => {
  const dataset: HolonicDataset = {
    holons: [
      {
        id: "holon-1",
        label: "Intelligence Cell A",
        types: ["IntelCell"],
        properties: { classification: "SECRET" },
        interiorNodes: [
          { id: "sig-1", types: ["Signal"], properties: { source: "SIGINT" } },
          { id: "sig-2", types: ["Signal"], properties: { source: "HUMINT" } },
        ],
        interiorEdges: [
          { source: "sig-1", target: "sig-2", type: "corroborates" },
        ],
        portals: [
          {
            id: "portal-1",
            label: "shared-entities",
            sourceHolonId: "holon-1",
            targetHolonId: "holon-2",
          },
        ],
      },
      {
        id: "holon-2",
        label: "Intelligence Cell B",
        types: ["IntelCell"],
        properties: { classification: "TOP SECRET" },
        portals: [],
        interiorNodes: [],
      },
      {
        id: "holon-3",
        label: "Fusion Center",
        types: ["FusionCenter"],
        properties: {},
        portals: [
          {
            id: "portal-2",
            label: "feeds",
            sourceHolonId: "holon-3",
            targetHolonId: "holon-1",
          },
        ],
      },
    ],
  };

  it("projects 3 holons to UGM with 3 nodes", async () => {
    const adapter = new HolonicAdapter(dataset);
    const ugm = await adapter.query("");

    expect(ugm.nodeCount).toBe(3);
    expect(ugm.getNode("holon-1")?.types).toContain("_Holon");
    expect(ugm.getNode("holon-1")?.properties._isHolon).toBe(true);
  });

  it("creates edges from portals", async () => {
    const adapter = new HolonicAdapter(dataset);
    const ugm = await adapter.query("");

    expect(ugm.edgeCount).toBe(2); // portal-1 + portal-2
  });

  it("projects holon interior on expandNeighborhood", async () => {
    const adapter = new HolonicAdapter(dataset);
    const interior = await adapter.expandNeighborhood("holon-1", 1);

    expect(interior.nodeCount).toBe(2); // sig-1, sig-2
    expect(interior.edgeCount).toBe(1); // corroborates
  });

  it("returns empty UGM for unknown holon", async () => {
    const adapter = new HolonicAdapter(dataset);
    const result = await adapter.expandNeighborhood("nonexistent", 1);
    expect(result.nodeCount).toBe(0);
  });
});

// ── The depth contract: honored or rejected, never ignored ─────────

describe("expandNeighborhood depth contract", () => {
  const holonicDataset: HolonicDataset = {
    holons: [
      {
        id: "holon-1",
        label: "One",
        types: ["Holon"],
        properties: {},
        interiorNodes: [{ id: "i-1", types: ["X"], properties: {} }],
        interiorEdges: [],
        portals: [],
      },
    ],
  };

  // A depth an adapter cannot express must not reach the wire. Each
  // rejecting adapter is given a fetch that fails the test if called,
  // so "rejected before the request" is asserted rather than assumed.
  const failIfCalled = async (): Promise<never> => {
    throw new Error("no request should be issued for a rejected depth");
  };

  it("HolonicAdapter honors depth 1", async () => {
    const adapter = new HolonicAdapter(holonicDataset);
    const result = await adapter.expandNeighborhood("holon-1", 1);
    expect(result.nodeCount).toBe(1);
  });

  it("HolonicAdapter rejects a depth above 1 with AdapterArgumentError", async () => {
    const adapter = new HolonicAdapter(holonicDataset);
    await expect(adapter.expandNeighborhood("holon-1", 2)).rejects.toThrow(
      AdapterArgumentError,
    );
    await expect(
      adapter.expandNeighborhood("holon-1", 2),
    ).rejects.toMatchObject({ argument: "depth", code: "UNSAFE_ARGUMENT" });
  });

  it("RestAdapter rejects a depth above 1 without issuing a request", async () => {
    const adapter = new RestAdapter({
      url: "https://example.org/graph",
      mapResponse: () => ({ nodes: [], edges: [] }),
      middleware: [() => failIfCalled()],
    });
    await expect(adapter.expandNeighborhood("n1", 3)).rejects.toMatchObject({
      argument: "depth",
    });
  });

  it("rejects a non-finite depth everywhere it is accepted", async () => {
    const holonic = new HolonicAdapter(holonicDataset);
    await expect(
      holonic.expandNeighborhood("holon-1", Number.NaN),
    ).rejects.toThrow(AdapterArgumentError);
  });
});

// ── E3.T1: AlgorithmResultAdapter ──────────────────────────────────

describe("ingestAlgorithmResults (M3.E3.T1)", () => {
  it("merges PageRank scores into UGM nodes", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "A" } });
    ugm.addNode("b", { types: ["X"], properties: { name: "B" } });
    ugm.addNode("c", { types: ["X"], properties: { name: "C" } });

    const results = new Map<string, Record<string, unknown>>([
      ["a", { pagerank: 0.95, community: 1 }],
      ["b", { pagerank: 0.32, community: 1 }],
      ["c", { pagerank: 0.01, community: 2 }],
    ]);

    ingestAlgorithmResults(ugm, results);

    expect(ugm.getNode("a")?.properties.pagerank).toBe(0.95);
    expect(ugm.getNode("b")?.properties.community).toBe(1);
    expect(ugm.getNode("c")?.properties.pagerank).toBe(0.01);
  });

  it("skips nodes not in UGM", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    const results = new Map([["missing", { score: 1 }]]);
    ingestAlgorithmResults(ugm, results);

    expect(ugm.getNode("a")?.properties.score).toBeUndefined();
  });

  it("reports matched versus supplied counts", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });

    const report = ingestAlgorithmResults(
      ugm,
      new Map([
        ["a", { score: 1 }],
        ["b", { score: 2 }],
        ["missing", { score: 3 }],
      ]),
    );

    expect(report).toEqual({ supplied: 3, matched: 2, unmatched: 1 });
  });

  it("reports zero matches for a wholesale id-convention mismatch", () => {
    // The failure the report exists for: results computed against
    // full IRIs, a UGM keyed by local names. Every merge is a no-op
    // and nothing else in the call says so.
    const ugm = new UGM();
    ugm.addNode("Sensor", { types: ["X"] });

    const report = ingestAlgorithmResults(
      ugm,
      new Map([["http://example.org/Sensor", { pagerank: 0.9 }]]),
    );

    expect(report).toEqual({ supplied: 1, matched: 0, unmatched: 1 });
  });
});

// ── E3.T2: Relational data virtualization ──────────────────────────

describe("virtualizeRelationalData (M3.E3.T2)", () => {
  it("merges 80 matching rows into UGM with 100 nodes", () => {
    const ugm = new UGM();
    for (let i = 0; i < 100; i++) {
      ugm.addNode(`n${i}`, { types: ["X"], properties: { name: `Node ${i}` } });
    }

    const data: Record<string, unknown>[] = [];
    for (let i = 0; i < 80; i++) {
      data.push({
        id: `n${i}`,
        revenue: i * 1000,
        region: i % 2 === 0 ? "East" : "West",
      });
    }

    const matchCount = virtualizeRelationalData(ugm, data);
    expect(matchCount).toBe(80);

    // Check merged properties
    expect(ugm.getNode("n0")?.properties.revenue).toBe(0);
    expect(ugm.getNode("n79")?.properties.region).toBe("West");

    // Unmatched nodes don't get extra properties
    expect(ugm.getNode("n99")?.properties.revenue).toBeUndefined();
  });

  it("uses custom key field", () => {
    const ugm = new UGM();
    ugm.addNode("alice", { types: ["Person"] });

    const data = [{ nodeId: "alice", score: 0.99 }];
    const matchCount = virtualizeRelationalData(ugm, data, {
      keyField: "nodeId",
    });

    expect(matchCount).toBe(1);
    expect(ugm.getNode("alice")?.properties.score).toBe(0.99);
  });
});

describe("parseCSV (M3.E3.T2)", () => {
  it("parses CSV with headers into row objects", () => {
    const csv = `id,name,score
n1,Alice,0.95
n2,Bob,0.32`;

    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: "n1", name: "Alice", score: 0.95 });
    expect(rows[1]).toEqual({ id: "n2", name: "Bob", score: 0.32 });
  });

  it("handles quoted fields with commas", () => {
    const csv = `id,description
n1,"Hello, World"`;

    const rows = parseCSV(csv);
    expect(rows[0]?.description).toBe("Hello, World");
  });

  it("returns empty array for header-only CSV", () => {
    expect(parseCSV("id,name")).toEqual([]);
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("CypherAdapter: additional methods (audit)", () => {
  it("getSchema returns node type labels", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              columns: ["label"],
              data: [{ row: ["Person"] }, { row: ["Organization"] }],
            },
          ],
          errors: [],
        }),
    });
    const adapter = new CypherAdapter(
      "http://test/tx",
      mockFetch as unknown as typeof fetch,
    );
    const schema = await adapter.getSchema();
    expect(schema.nodeTypes).toContain("Person");
    expect(schema.nodeTypes).toContain("Organization");
  });

  it("getNodeProperties returns properties map", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              columns: ["props"],
              data: [{ row: [{ name: "Alice", age: 30 }] }],
            },
          ],
          errors: [],
        }),
    });
    const adapter = new CypherAdapter(
      "http://test/tx",
      mockFetch as unknown as typeof fetch,
    );
    const props = await adapter.getNodeProperties("1");
    expect(props.name).toBe("Alice");
    expect(props.age).toBe(30);
  });
});

describe("HolonicAdapter: additional methods (audit)", () => {
  const dataset: HolonicDataset = {
    holons: [
      {
        id: "h1",
        label: "Cell A",
        types: ["IntelCell", "Active"],
        properties: { classification: "SECRET" },
        portals: [],
        interiorNodes: [],
      },
      {
        id: "h2",
        label: "Cell B",
        types: ["IntelCell"],
        properties: { classification: "TS" },
        portals: [],
      },
    ],
  };

  it("getSchema returns holon types and portal labels", async () => {
    const adapter = new HolonicAdapter(dataset);
    const schema = await adapter.getSchema();
    expect(schema.nodeTypes).toContain("IntelCell");
    expect(schema.nodeTypes).toContain("Active");
  });

  it("getNodeProperties returns holon properties", async () => {
    const adapter = new HolonicAdapter(dataset);
    const props = await adapter.getNodeProperties("h1");
    expect(props.classification).toBe("SECRET");
  });

  it("getNodeProperties returns empty for unknown holon", async () => {
    const adapter = new HolonicAdapter(dataset);
    const props = await adapter.getNodeProperties("nonexistent");
    expect(Object.keys(props)).toHaveLength(0);
  });
});

describe("ingestAlgorithmResults: edge cases (audit)", () => {
  it("handles empty results map", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ingestAlgorithmResults(ugm, new Map());
    // No error; no properties changed
    expect(Object.keys(ugm.getNode("a")!.properties)).toHaveLength(0);
  });
});

describe("virtualizeRelationalData: edge cases (audit)", () => {
  it("returns 0 when no rows match", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    const data = [{ id: "nonexistent", value: 42 }];
    const count = virtualizeRelationalData(ugm, data);
    expect(count).toBe(0);
  });

  it("handles empty data array", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    const count = virtualizeRelationalData(ugm, []);
    expect(count).toBe(0);
  });
});

describe("parseCSV: edge cases (audit)", () => {
  it("auto-converts numeric values", () => {
    const rows = parseCSV("id,score\nn1,42.5");
    expect(rows[0]!.score).toBe(42.5);
    expect(typeof rows[0]!.score).toBe("number");
  });

  it("preserves non-numeric strings", () => {
    const rows = parseCSV("id,name\nn1,Alice");
    expect(rows[0]!.name).toBe("Alice");
    expect(typeof rows[0]!.name).toBe("string");
  });

  it("handles empty string", () => {
    expect(parseCSV("")).toEqual([]);
  });
});

// ── GremlinAdapter (M10.5.E2.T3) ───────────────────────────────────

describe("GremlinAdapter (M10.5.E2.T3)", () => {
  it("implements GraphAdapter interface", () => {
    const adapter = new GremlinAdapter({
      endpoint: "http://localhost:8182/gremlin",
    });
    expect(adapter.id).toBe("gremlin");
    expect(adapter.name).toContain("Gremlin");
    expect(typeof adapter.query).toBe("function");
    expect(typeof adapter.expandNeighborhood).toBe("function");
    expect(typeof adapter.getSchema).toBe("function");
    expect(typeof adapter.getNodeProperties).toBe("function");
  });

  it("parses Gremlin vertex results into UGM", async () => {
    const mockResponse: GremlinResponse = {
      result: {
        data: [
          {
            id: "v1",
            label: "Person",
            properties: {
              name: [{ value: "Alice" }],
              age: [{ value: 30 }],
            },
          },
          {
            id: "v2",
            label: "Company",
            properties: {
              name: [{ value: "Acme" }],
            },
          },
        ],
      },
      status: { code: 200, message: "OK" },
    };

    // const mockFetch = vi.fn().mockResolvedValue({
    //   ok: true,
    //   status: 200,
    //   json: () => Promise.resolve(mockResponse),
    //   text: () => Promise.resolve(JSON.stringify(mockResponse)),
    // });

    const adapter = new GremlinAdapter({
      endpoint: "http://localhost:8182/gremlin",
      middleware: [],
    });

    // Override the internal fetcher for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter as any).fetcher = vi.fn(async () => ({
      status: 200,
      ok: true,
      body: JSON.stringify(mockResponse),
      headers: {},
    }));

    const ugm = await adapter.query("g.V().limit(2)");
    expect(ugm.nodeCount).toBe(2);
    expect(ugm.getNode("v1")?.properties.name).toBe("Alice");
    expect(ugm.getNode("v2")?.types[0]).toBe("Company");
  });

  it("parses Gremlin edge results into UGM", async () => {
    const mockResponse: GremlinResponse = {
      result: {
        data: [
          {
            id: "e1",
            label: "worksAt",
            outV: "v1",
            inV: "v2",
            outVLabel: "Person",
            inVLabel: "Company",
          },
        ],
      },
      status: { code: 200, message: "OK" },
    };

    const adapter = new GremlinAdapter({
      endpoint: "http://localhost:8182/gremlin",
    });

    (
      adapter as unknown as { fetcher: (req: unknown) => Promise<unknown> }
    ).fetcher = vi.fn(async () => ({
      status: 200,
      ok: true,
      body: JSON.stringify(mockResponse),
      headers: {},
    }));

    const ugm = await adapter.query("g.E().limit(1)");
    expect(ugm.nodeCount).toBe(2); // endpoints created
    expect(ugm.edgeCount).toBe(1);
  });

  it("handles elementMap results", async () => {
    const mockResponse: GremlinResponse = {
      result: {
        data: [
          { id: "v1", label: "Person", name: "Alice", age: 30 },
          { id: "v2", label: "Place", name: "Berlin" },
        ],
      },
      status: { code: 200, message: "OK" },
    };

    const adapter = new GremlinAdapter({
      endpoint: "http://localhost:8182/gremlin",
    });

    (
      adapter as unknown as { fetcher: (req: unknown) => Promise<unknown> }
    ).fetcher = vi.fn(async () => ({
      status: 200,
      ok: true,
      body: JSON.stringify(mockResponse),
      headers: {},
    }));

    const ugm = await adapter.query("g.V().elementMap()");
    expect(ugm.nodeCount).toBe(2);
    expect(ugm.getNode("v1")?.properties.name).toBe("Alice");
    expect(ugm.getNode("v1")?.properties.age).toBe(30);
  });

  it("accepts middleware for auth", () => {
    const adapter = new GremlinAdapter({
      endpoint: "http://neptune.cluster:8182/gremlin",
      middleware: [bearerAuth(() => "iam-token")],
    });
    expect(adapter.name).toContain("neptune");
  });
});
