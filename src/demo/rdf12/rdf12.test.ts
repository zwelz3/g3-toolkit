/**
 * Fixture check for the demo's RDF 1.2 constellation. The two
 * projections are pinned in packages/core/src/projection/hyperarc.test.ts;
 * this file asserts the demo dataset drives both renders without a
 * silent skip (e.g., a row lost to a shape the render cannot express).
 */
import { describe, it, expect } from "vitest";
import {
  projectTripleTermsAsEdges,
  projectTripleTermsAsHyperarcs,
  STAR_EDGE_TYPE,
  RDF_STATEMENT_FLAG,
} from "@g3t/core";
import { RDF12_ROWS, tripleLabel } from "./rdf12";

describe("constellation fixture", () => {
  it("has at least one nested annotation for the pedagogical toggle", () => {
    const nested = RDF12_ROWS.filter(
      (r) => r.stmt.value.subject.type === "triple",
    );
    expect(nested.length).toBeGreaterThanOrEqual(1);
  });

  it("hyperarc render produces one _Statement per unique quoted triple", () => {
    const ugm = projectTripleTermsAsHyperarcs(RDF12_ROWS);
    const stmts = ugm
      .getNodeIds()
      .filter((id) => ugm.getNode(id)?.types.includes("_Statement"));
    // Four base facts (mass/orbit/band/portal), the outer review, and
    // the inner (mass, confidence 0.9) triple the review references = 6.
    expect(stmts.length).toBe(6);
    for (const s of stmts) {
      expect(ugm.getNode(s)?.properties[RDF_STATEMENT_FLAG]).toBe(true);
    }
  });

  it("edge render emits one star edge per annotation row", () => {
    const ugm = projectTripleTermsAsEdges(RDF12_ROWS);
    let stars = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.type === STAR_EDGE_TYPE) stars++;
    });
    expect(stars).toBe(RDF12_ROWS.length);
  });

  it("renders a quoted triple as « s p o »", () => {
    const first = RDF12_ROWS[0];
    if (!first) throw new Error("fixture empty");
    const label = tripleLabel(first.stmt.value);
    expect(label).toContain("«");
    expect(label).toContain("aquila1");
    expect(label).toContain("hasMass");
  });
});
