// Permanent oracle for the 64b guard regression: node data may
// carry a user property literally named "source" (the supply
// model's provenance field); the pre-construction validation must
// classify by the converter's group field, never by data.source.
// The broken discriminator dropped NODES (sup.eta, fac.munich) and
// then their edges as a downstream symptom.
import { describe, it, expect } from "vitest";
import { ugmToCytoscapeElements } from "@g3t/react";
import { buildDigitalThread } from "./model";

describe("element validation guard vs node data named 'source'", () => {
  it("classifies the real supply model with zero false drops", () => {
    const ugm = buildDigitalThread();
    const elements = ugmToCytoscapeElements(ugm, {});
    const isEdge = (el: unknown): boolean =>
      (el as { group?: string }).group === "edges";
    const nodeIds = new Set<string>();
    for (const el of elements) {
      if (isEdge(el)) continue;
      const d = (el as { data?: { id?: string } }).data;
      if (d?.id !== undefined) nodeIds.add(d.id);
    }
    // The two reported casualties are nodes and must classify as such.
    expect(nodeIds.has("sup.eta")).toBe(true);
    expect(nodeIds.has("fac.munich")).toBe(true);
    // And no real edge dangles.
    const dangling = elements.filter((el) => {
      if (!isEdge(el)) return false;
      const d = (el as { data?: { source?: string; target?: string } }).data;
      return (
        d === undefined ||
        !nodeIds.has(String(d.source)) ||
        !nodeIds.has(String(d.target))
      );
    });
    expect(dangling).toEqual([]);
  });
});
