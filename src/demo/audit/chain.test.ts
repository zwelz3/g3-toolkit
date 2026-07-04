import { describe, it, expect } from "vitest";
import { buildProvenance } from "./model";
import { provenanceChainFor } from "./chain";

describe("provenanceChainFor", () => {
  const ugm = buildProvenance();

  it("returns the root at depth 0 followed by a pre-order descent", () => {
    const chain = provenanceChainFor(ugm, "ent:release");
    expect(chain[0]?.id).toBe("ent:release");
    expect(chain[0]?.depth).toBe(0);
    expect(chain[0]?.parentId).toBeUndefined();
    expect(chain.length).toBeGreaterThan(1);
    // Every non-root hop points at an earlier hop (pre-order property).
    const seen = new Set<string>([chain[0]?.id ?? ""]);
    for (const hop of chain.slice(1)) {
      expect(hop.parentId).toBeDefined();
      expect(seen.has(hop.parentId ?? "")).toBe(true);
      seen.add(hop.id);
    }
  });

  it("labels hops from the model and carries the traversed edge type as detail", () => {
    const chain = provenanceChainFor(ugm, "ent:release");
    const viaTypes = new Set(chain.slice(1).map((h) => h.detail));
    // The release entity's history must include at least generation.
    expect(viaTypes.has("wasGeneratedBy")).toBe(true);
    for (const hop of chain) {
      expect(hop.label.length).toBeGreaterThan(0);
      expect(hop.tier.length).toBeGreaterThan(0);
    }
  });

  it("ends an unattributed entity in an absence hop (the SHACL story)", () => {
    const chain = provenanceChainFor(ugm, "ent:legacy");
    const absence = chain.find((h) => h.absence === true);
    expect(absence).toBeDefined();
    expect(absence?.parentId).toBe("ent:legacy");
    expect(absence?.leaf).toBe(true);
    expect(absence?.tier).toBe("gap");
  });

  it("is depth-bounded and cycle-safe", () => {
    const chain = provenanceChainFor(ugm, "ent:release");
    expect(Math.max(...chain.map((h) => h.depth))).toBeLessThanOrEqual(4);
    const ids = chain.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns an empty chain for an unknown node", () => {
    expect(provenanceChainFor(ugm, "nope")).toEqual([]);
  });
});
