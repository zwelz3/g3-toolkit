/**
 * Supply fixture invariants (review item 3.5 acceptance): the
 * centrality-vs-risk scatter rendered empty because no node carried a
 * `risk` property. These pins guarantee fixture edits cannot regress
 * the chart back to empty, and that the risk model stays coherent
 * with the fixture's own concentration-risk narrative.
 */
import { describe, it, expect } from "vitest";
import { buildSupplyNetwork } from "./supply-data";

const ugm = buildSupplyNetwork();

describe("supply fixture risk invariants", () => {
  it("every node carries a bounded numeric risk", () => {
    let count = 0;
    ugm.forEachNode((_id, attrs) => {
      count++;
      const risk = attrs.properties.risk;
      expect(typeof risk).toBe("number");
      expect(risk as number).toBeGreaterThanOrEqual(0);
      expect(risk as number).toBeLessThanOrEqual(100);
    });
    expect(count).toBeGreaterThan(20);
  });

  it("risk has real spread (the scatter shows structure, not a line)", () => {
    const values = new Set<number>();
    ugm.forEachNode((_id, attrs) => {
      values.add(attrs.properties.risk as number);
    });
    expect(values.size).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic across builds", () => {
    const again = buildSupplyNetwork();
    ugm.forEachNode((id, attrs) => {
      expect(again.getNode(id)?.properties.risk).toBe(attrs.properties.risk);
    });
  });

  it("risk propagates downstream: no product is safer than its riskiest input", () => {
    // Follow partOf edges upstream from each Product; the product's
    // risk must be >= every upstream node's risk along those edges.
    const upstreamOf = new Map<string, string[]>();
    ugm.forEachEdge((_eid, attrs, source, target) => {
      if (attrs.type !== "partOf") return;
      const arr = upstreamOf.get(target) ?? [];
      arr.push(source);
      upstreamOf.set(target, arr);
    });
    const riskOf = (id: string) =>
      (ugm.getNode(id)?.properties.risk as number) ?? 0;
    ugm.forEachNode((id, attrs) => {
      if (!attrs.types.includes("Product")) return;
      const stack = [...(upstreamOf.get(id) ?? [])];
      const seen = new Set<string>();
      while (stack.length > 0) {
        const up = stack.pop();
        if (up === undefined || seen.has(up)) continue;
        seen.add(up);
        expect(riskOf(id)).toBeGreaterThanOrEqual(riskOf(up));
        stack.push(...(upstreamOf.get(up) ?? []));
      }
      expect(seen.size).toBeGreaterThan(0);
    });
  });
});
