/**
 * Spec -> canvas patch tests (the application milestone).
 */
import { describe, it, expect } from "vitest";
import { UGM } from "@g3t/core";
import { applyEncodingSpec, glyphStrokeFor } from "./spec-apply";
import type { EncodingSpec } from "./encoding-spec";
import { OKABE_ITO } from "./palette-bridge";

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", {
    types: ["Person"],
    properties: { label: "Aris", pagerank: 0 },
  });
  ugm.addNode("o1", {
    types: ["Org"],
    properties: { label: "Helix", pagerank: 0.2 },
  });
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: { weight: 8 } });
  return ugm;
}

describe("applyEncodingSpec", () => {
  it("patches only the channels the spec claims (precedence by construction)", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "types",
          scale: {
            kind: "categorical",
            palette: "okabe-ito",
            overrides: { Person: "#7a0bc0" },
          },
        },
      },
      edge: {},
    };
    const patch = applyEncodingSpec(spec, graph());
    expect(patch.nodes.get("p1")).toEqual({ _color: "#7a0bc0" });
    expect(patch.nodes.get("o1")).toEqual({ _color: OKABE_ITO[1] });
    // No size/label fields: the legacy defaults keep owning them.
    expect(patch.nodes.get("p1")).not.toHaveProperty("_size");
    expect(patch.edges.size).toBe(0);
  });

  it("rounds node sizes to integers and edge widths to one decimal", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        size: {
          driver: "pagerank",
          scale: { kind: "sequential", domain: [0, 0.2], range: [13, 33] },
        },
      },
      edge: {
        width: {
          driver: "weight",
          scale: { kind: "sequential", domain: [0, 10], range: [1, 6] },
        },
      },
    };
    const patch = applyEncodingSpec(spec, graph());
    expect(patch.nodes.get("p1")?._size).toBe(13);
    expect(patch.nodes.get("o1")?._size).toBe(33);
    expect(patch.edges.values().next().value?._ewidth).toBe(5);
  });

  it("drives labels from any driver, including types and edge type", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: { label: { driver: "types" } },
      edge: { label: { driver: "type" } },
    };
    const patch = applyEncodingSpec(spec, graph());
    expect(patch.nodes.get("p1")?.label).toBe("Person");
    expect(patch.edges.values().next().value?.label).toBe("worksAt");
  });

  it("fixed scales flatten the graph (screenshot use case)", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: { color: { scale: { kind: "fixed", value: "#9aa0a6" } } },
      edge: { color: { scale: { kind: "fixed", value: "#9aa0a6" } } },
    };
    const patch = applyEncodingSpec(spec, graph());
    expect(patch.nodes.get("p1")?._color).toBe("#9aa0a6");
    expect(patch.nodes.get("o1")?._color).toBe("#9aa0a6");
    expect(patch.edges.values().next().value?._ecolor).toBe("#9aa0a6");
  });
});

describe("icon and shape application (round 13)", () => {
  it("emits _icon as an encoded SVG data URI for registered string icons", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        icon: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Org: "layers" } },
        },
      },
      edge: {},
    };
    const patch = applyEncodingSpec(spec, graph());
    const uri = patch.nodes.get("o1")?._icon;
    expect(uri).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(decodeURIComponent(uri ?? "")).toContain('stroke="#ffffff"');
    // Unmapped values produce no field; the channel degrades cleanly.
    expect(patch.nodes.get("p1")).toBeUndefined();
  });

  it("skips unregistered icon names without breaking the patch", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        icon: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Org: "no-such-glyph" } },
        },
        color: { scale: { kind: "fixed", value: "#9aa0a6" } },
      },
      edge: {},
    };
    const patch = applyEncodingSpec(spec, graph());
    expect(patch.nodes.get("o1")).toEqual({ _color: "#9aa0a6" });
  });

  it("passes raw image references (PNG URL / data URI) through untouched", () => {
    const png = "https://example.com/logos/acme.png";
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCA. ".trim();
    const spec: EncodingSpec = {
      version: 1,
      node: {
        icon: {
          driver: "types",
          scale: {
            kind: "categorical",
            overrides: { Org: png, Person: dataUri },
          },
        },
      },
      edge: {},
    };
    const patch = applyEncodingSpec(spec, graph());
    // Raster/image refs are stamped as-is, NOT wrapped in an SVG data
    // URI and NOT recolored.
    expect(patch.nodes.get("o1")?._icon).toBe(png);
    expect(patch.nodes.get("p1")?._icon).toBe(dataUri);
  });

  it("emits _shape slot-stably with overrides pinning, not reshuffling", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        shape: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Person: "diamond" } },
        },
      },
      edge: {},
    };
    const patch = applyEncodingSpec(spec, graph());
    expect(patch.nodes.get("p1")?._shape).toBe("diamond");
    // Org keeps slot 1 of NODE_SHAPES despite Person's pin.
    expect(patch.nodes.get("o1")?._shape).toBe("rectangle");
  });
});

describe("icon rendering fixes (round 19)", () => {
  it("data URIs carry an explicit intrinsic size", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        icon: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Org: "layers" } },
        },
      },
      edge: {},
    };
    const uri = applyEncodingSpec(spec, graph()).nodes.get("o1")?._icon;
    const svg = decodeURIComponent(uri ?? "");
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
  });

  it("picks a dark glyph on light fills and white on dark fills", () => {
    expect(glyphStrokeFor("#F0E442")).toBe("#1a1a1a"); // okabe yellow
    expect(glyphStrokeFor("#56B4E9")).toBe("#1a1a1a"); // okabe light blue
    expect(glyphStrokeFor("#0072B2")).toBe("#ffffff"); // okabe deep blue
    expect(glyphStrokeFor(undefined)).toBe("#ffffff");
  });

  it("threads the resolved node color into the glyph", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          scale: { kind: "fixed", value: "#F0E442" },
        },
        icon: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Org: "layers" } },
        },
      },
      edge: {},
    };
    const uri = applyEncodingSpec(spec, graph()).nodes.get("o1")?._icon;
    expect(decodeURIComponent(uri ?? "")).toContain('stroke="#1a1a1a"');
  });
});
