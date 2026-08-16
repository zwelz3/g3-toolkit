// The 64b guard regression (owner 2026-07-28): a node whose SPREAD
// properties include a field named "source" must never be
// classified as an edge. Keyed on cytoscape's group field.
import { describe, it, expect, vi } from "vitest";
import { validateAssembledElements } from "./CytoscapeCanvas";

describe("validateAssembledElements", () => {
  it("keeps a node carrying a spread 'source' property, and its edges", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const elements = [
        { group: "nodes", data: { id: "sup.eta" } },
        {
          group: "nodes",
          data: { id: "fac.munich", source: "Logistics", region: "EU" },
        },
        {
          group: "edges",
          data: { id: "e1", source: "sup.eta", target: "fac.munich" },
        },
      ];
      const safe = validateAssembledElements(elements);
      expect(safe).toHaveLength(3);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("still drops a genuinely dangling edge with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const elements = [
        { group: "nodes", data: { id: "a" } },
        { group: "edges", data: { id: "bad", source: "a", target: "ghost" } },
      ];
      const safe = validateAssembledElements(elements);
      expect(safe).toHaveLength(1);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("group-less inputs fall back to source+target presence (view-built data)", () => {
    const elements = [
      { data: { id: "n1" } },
      { data: { id: "n2" } },
      { data: { id: "e", source: "n1", target: "n2" } },
    ];
    expect(validateAssembledElements(elements)).toHaveLength(3);
  });
});
