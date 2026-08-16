/**
 * Query-argument safety for the remote adapters.
 *
 * These tests pin the GENERATED QUERY TEXT, which nothing did before:
 * the adapters could be rewritten to interpolate again and every
 * existing adapter test would still pass, because they all assert on
 * the parsed UGM and mock away the wire. Each case below asserts both
 * halves of the fix: that the hostile value does not appear in the
 * query, and that it does arrive at the endpoint by the safe channel.
 *
 * The payloads are one working escape per dialect, each reproduced
 * against the adapter before the fix.
 */

import { describe, it, expect, vi } from "vitest";
import { SparqlAdapter } from "./sparql-adapter";
import { CypherAdapter } from "./cypher-adapter";
import { GremlinAdapter } from "./gremlin-adapter";
import {
  AdapterArgumentError,
  MAX_TRAVERSAL_DEPTH,
  assertPlainIdentifier,
  assertSafeIri,
  coerceDepth,
} from "./query-safety";

const GREMLIN_PAYLOAD = "x') ; System.exit(1) ; g.V('";
const CYPHER_PAYLOAD = '" RETURN 1 UNION MATCH (n) DETACH DELETE n //';
const SPARQL_PAYLOAD =
  ">} SERVICE <http://169.254.169.254/latest/meta-data/> { ?s ?p ?o } #";

// ── Helpers ─────────────────────────────────────────────────────────

describe("coerceDepth", () => {
  it("floors and clamps into [1, max]", () => {
    expect(coerceDepth(2.9)).toBe(2);
    expect(coerceDepth(0)).toBe(1);
    expect(coerceDepth(-5)).toBe(1);
    expect(coerceDepth(9999)).toBe(MAX_TRAVERSAL_DEPTH);
    expect(coerceDepth(3, 2)).toBe(2);
  });

  it("rejects non-numeric depth rather than silently reading it as 1", () => {
    expect(() => coerceDepth("2 ; DROP")).toThrow(AdapterArgumentError);
    expect(() => coerceDepth(undefined)).toThrow(/finite number/);
    expect(() => coerceDepth(Number.NaN)).toThrow(AdapterArgumentError);
  });

  it("accepts a numeric string, since the JS boundary is untyped", () => {
    expect(coerceDepth("3")).toBe(3);
  });
});

describe("assertPlainIdentifier", () => {
  it("accepts unquoted Cypher identifiers", () => {
    expect(assertPlainIdentifier("KNOWS", "edgeTypes")).toBe("KNOWS");
    expect(assertPlainIdentifier("_works_for2", "edgeTypes")).toBe(
      "_works_for2",
    );
  });

  it("rejects anything that would need quoting or could break out", () => {
    for (const bad of ["KNOWS|*..99]-()-[r", "a`b", "a b", "", "2HOPS", 7]) {
      expect(() => assertPlainIdentifier(bad, "edgeTypes")).toThrow(
        AdapterArgumentError,
      );
    }
  });

  it("names the offending argument on the error", () => {
    try {
      assertPlainIdentifier("a b", "edgeTypes");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as AdapterArgumentError).argument).toBe("edgeTypes");
      expect((e as AdapterArgumentError).code).toBe("UNSAFE_ARGUMENT");
    }
  });
});

describe("assertSafeIri", () => {
  it("accepts absolute IRIs", () => {
    expect(assertSafeIri("http://ex.org/alice", "nodeId")).toBe(
      "http://ex.org/alice",
    );
    expect(assertSafeIri("urn:uuid:1234", "nodeId")).toBe("urn:uuid:1234");
  });

  it("rejects the SERVICE-clause escape", () => {
    expect(() => assertSafeIri(SPARQL_PAYLOAD, "nodeId")).toThrow(
      AdapterArgumentError,
    );
  });

  it("rejects relative references and empty values", () => {
    expect(() => assertSafeIri("/alice", "nodeId")).toThrow(/absolute IRI/);
    expect(() => assertSafeIri("", "nodeId")).toThrow(/non-empty/);
    expect(() => assertSafeIri(null, "nodeId")).toThrow(AdapterArgumentError);
  });

  it("rejects whitespace and control characters", () => {
    expect(() => assertSafeIri("http://ex.org/a b", "nodeId")).toThrow(
      AdapterArgumentError,
    );
    const withNul = `http://ex.org/a${String.fromCharCode(0)}b`;
    expect(() => assertSafeIri(withNul, "nodeId")).toThrow(
      AdapterArgumentError,
    );
  });
});

// ── Gremlin: values move into bindings ──────────────────────────────

/** Capture the request bodies a GremlinAdapter would send. */
function gremlinSpy(): { adapter: GremlinAdapter; bodies: () => unknown[] } {
  const sent: string[] = [];
  const adapter = new GremlinAdapter({ endpoint: "http://test/gremlin" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (adapter as any).fetcher = vi.fn(async (req: { body: string }) => {
    sent.push(req.body);
    return {
      status: 200,
      ok: true,
      headers: {},
      body: JSON.stringify({
        result: { data: [] },
        status: { code: 200, message: "OK" },
      }),
    };
  });
  return { adapter, bodies: () => sent.map((b) => JSON.parse(b)) };
}

describe("GremlinAdapter query construction", () => {
  it("binds nodeId and depth instead of interpolating them", async () => {
    const { adapter, bodies } = gremlinSpy();
    await adapter.expandNeighborhood(GREMLIN_PAYLOAD, 2);

    const body = bodies()[0] as {
      gremlin: string;
      bindings: Record<string, unknown>;
    };
    expect(body.gremlin).not.toContain(GREMLIN_PAYLOAD);
    expect(body.gremlin).not.toContain("System.exit");
    expect(body.gremlin).toContain("g.V(nodeId)");
    expect(body.gremlin).toContain(".times(depth)");
    expect(body.bindings.nodeId).toBe(GREMLIN_PAYLOAD);
    expect(body.bindings.depth).toBe(2);
  });

  it("binds each edge type under a generated name", async () => {
    const { adapter, bodies } = gremlinSpy();
    await adapter.expandNeighborhood("v1", 1, ["knows", "') ; evil ; ('"]);

    const body = bodies()[0] as {
      gremlin: string;
      bindings: Record<string, unknown>;
    };
    expect(body.gremlin).toContain(".hasLabel(edgeType0,edgeType1)");
    expect(body.gremlin).not.toContain("evil");
    expect(body.bindings.edgeType0).toBe("knows");
    expect(body.bindings.edgeType1).toBe("') ; evil ; ('");
  });

  it("omits the label filter for an empty edgeTypes array", async () => {
    const { adapter, bodies } = gremlinSpy();
    await adapter.expandNeighborhood("v1", 1, []);
    const body = bodies()[0] as { gremlin: string };
    expect(body.gremlin).not.toContain("hasLabel");
  });

  it("binds nodeId in getNodeProperties", async () => {
    const { adapter, bodies } = gremlinSpy();
    await adapter.getNodeProperties(GREMLIN_PAYLOAD);

    const body = bodies()[0] as {
      gremlin: string;
      bindings: Record<string, unknown>;
    };
    expect(body.gremlin).toBe("g.V(nodeId).elementMap()");
    expect(body.bindings.nodeId).toBe(GREMLIN_PAYLOAD);
  });
});

// ── Cypher: parameters are actually sent ────────────────────────────

/** Capture the statements a CypherAdapter would send. */
function cypherSpy(): {
  adapter: CypherAdapter;
  statements: () => Array<{
    statement: string;
    parameters?: Record<string, unknown>;
  }>;
} {
  const sent: string[] = [];
  const mockFetch = vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(init.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [], errors: [] }),
    };
  });
  const adapter = new CypherAdapter(
    "http://test/tx/commit",
    mockFetch as unknown as typeof fetch,
  );
  return {
    adapter,
    statements: () =>
      sent.flatMap(
        (b) =>
          (
            JSON.parse(b) as {
              statements: Array<{
                statement: string;
                parameters?: Record<string, unknown>;
              }>;
            }
          ).statements,
      ),
  };
}

describe("CypherAdapter query construction", () => {
  it("sends a parameters object, so $nodeId is not inert", async () => {
    const { adapter, statements } = cypherSpy();
    await adapter.expandNeighborhood(CYPHER_PAYLOAD, 2);

    const [stmt] = statements();
    expect(stmt!.statement).not.toContain("DETACH DELETE");
    expect(stmt!.statement).toContain("$nodeId");
    expect(stmt!.parameters).toEqual({ nodeId: CYPHER_PAYLOAD });
  });

  it("parameterizes getNodeProperties instead of quoting the id", async () => {
    const { adapter, statements } = cypherSpy();
    await adapter.getNodeProperties(CYPHER_PAYLOAD);

    const [stmt] = statements();
    expect(stmt!.statement).not.toContain(CYPHER_PAYLOAD);
    expect(stmt!.statement).toContain("n.id = $nodeId");
    expect(stmt!.parameters).toEqual({ nodeId: CYPHER_PAYLOAD });
  });

  it("clamps depth into the property-path bound", async () => {
    const { adapter, statements } = cypherSpy();
    await adapter.expandNeighborhood("n1", 9999);
    expect(statements()[0]!.statement).toContain(
      `*1..${MAX_TRAVERSAL_DEPTH}]-(m)`,
    );
  });

  it("rejects a relationship type that is not a bare identifier", async () => {
    const { adapter, statements } = cypherSpy();
    await expect(
      adapter.expandNeighborhood("n1", 1, ["KNOWS|*..99]-()-[r"]),
    ).rejects.toThrow(AdapterArgumentError);
    expect(statements()).toHaveLength(0);
  });

  it("interpolates a validated relationship type", async () => {
    const { adapter, statements } = cypherSpy();
    await adapter.expandNeighborhood("n1", 1, ["KNOWS", "WORKS_FOR"]);
    expect(statements()[0]!.statement).toContain("[r:KNOWS|WORKS_FOR*1..1]");
  });
});

// ── SPARQL: hostile IRIs never reach the endpoint ───────────────────

/** Capture the query text a SparqlAdapter would send. */
function sparqlSpy(): { adapter: SparqlAdapter; queries: () => string[] } {
  const sent: string[] = [];
  const mockFetch = vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(init.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: { bindings: [] } }),
    };
  });
  const adapter = new SparqlAdapter(
    "http://test/sparql",
    mockFetch as unknown as typeof fetch,
  );
  return { adapter, queries: () => sent };
}

describe("SparqlAdapter query construction", () => {
  it("rejects the SERVICE-clause payload before sending anything", async () => {
    const { adapter, queries } = sparqlSpy();
    await expect(adapter.expandNeighborhood(SPARQL_PAYLOAD, 1)).rejects.toThrow(
      AdapterArgumentError,
    );
    expect(queries()).toHaveLength(0);
  });

  it("rejects the payload in getNodeProperties too", async () => {
    const { adapter, queries } = sparqlSpy();
    await expect(adapter.getNodeProperties(SPARQL_PAYLOAD)).rejects.toThrow(
      AdapterArgumentError,
    );
    expect(queries()).toHaveLength(0);
  });

  it("rejects a hostile edge type", async () => {
    const { adapter, queries } = sparqlSpy();
    await expect(
      adapter.expandNeighborhood("http://ex.org/a", 1, [
        "http://ex.org/p> . ?x ?y ?z . #",
      ]),
    ).rejects.toThrow(AdapterArgumentError);
    expect(queries()).toHaveLength(0);
  });

  it("passes a valid IRI through and clamps the path quantifier", async () => {
    const { adapter, queries } = sparqlSpy();
    await adapter.expandNeighborhood("http://ex.org/alice", 9999);

    const q = queries()[0]!;
    expect(q).toContain("<http://ex.org/alice>");
    expect(q).toContain(`?p{1,${MAX_TRAVERSAL_DEPTH}}`);
  });

  it("keeps the single-hop path expression at depth 1", async () => {
    const { adapter, queries } = sparqlSpy();
    await adapter.expandNeighborhood("http://ex.org/alice", 1);
    expect(queries()[0]!).toContain("(?p) ?neighbor");
  });
});
