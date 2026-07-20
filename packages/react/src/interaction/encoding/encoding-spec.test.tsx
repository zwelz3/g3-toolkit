/**
 * Encoding spec model tests (roadmap/design/encoding-controls.md).
 * Each block maps to a numbered use case in the design doc's
 * acceptance list.
 */
import { describe, it, expect, vi } from "vitest";
import { UGM } from "@g3t/core";
import {
  applyIconMappings,
  categoricalColorMap,
  DEFAULT_SPEC,
  fromLegacyConfig,
  makeColorResolver,
  makeIconResolver,
  makeShapeResolver,
  makeSizeResolver,
  parseEncodingSpec,
  ReservedChannelError,
  serializeEncodingSpec,
  warnOnCustomPalette,
  type EncodingSpec,
} from "./encoding-spec";
import { OKABE_ITO } from "./palette-bridge";
import { DEFAULT_ENCODING } from "./VisualEncoding";

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", {
    types: ["Person"],
    properties: { label: "Aris", pagerank: 0.05 },
  });
  ugm.addNode("p2", {
    types: ["Person"],
    properties: { label: "Bea", pagerank: 0.2 },
  });
  ugm.addNode("o1", {
    types: ["Org"],
    properties: { label: "Helix", pagerank: 0.9 },
  });
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: { weight: 2 } });
  ugm.addEdge("p2", "o1", { type: "knows", properties: { weight: 8 } });
  return ugm;
}

describe("encoding spec resolvers", () => {
  it("UC1: categorical color with a per-value override", () => {
    const resolve = makeColorResolver(
      {
        driver: "types",
        scale: {
          kind: "categorical",
          palette: "okabe-ito",
          overrides: { Person: "#7a0bc0" },
        },
      },
      { ugm: graph() },
    );
    expect(resolve({ types: ["Person"], properties: {} })).toBe("#7a0bc0");
    // Org takes its palette slot in first-seen order, unaffected.
    expect(resolve({ types: ["Org"], properties: {} })).toBe(OKABE_ITO[1]);
  });

  it("UC2: sequential size with a manual domain clamp", () => {
    const resolve = makeSizeResolver(
      {
        driver: "pagerank",
        scale: { kind: "sequential", domain: [0, 0.2], range: [10, 30] },
      },
      { ugm: graph() },
    );
    expect(resolve({ types: ["Person"], properties: { pagerank: 0 } })).toBe(
      10,
    );
    expect(resolve({ types: ["Person"], properties: { pagerank: 0.2 } })).toBe(
      30,
    );
    // The 0.9 hub clamps to the top instead of flattening the rest.
    expect(resolve({ types: ["Org"], properties: { pagerank: 0.9 } })).toBe(30);
  });

  it("UC2b: auto domain derives from the data", () => {
    const resolve = makeSizeResolver(
      {
        driver: "pagerank",
        scale: { kind: "sequential", domain: "auto", range: [0, 100] },
      },
      { ugm: graph() },
    );
    expect(resolve({ types: [], properties: { pagerank: 0.05 } })).toBe(0);
    expect(resolve({ types: [], properties: { pagerank: 0.9 } })).toBe(100);
  });

  it("UC3: categorical icons resolve registry names", () => {
    const resolve = makeIconResolver({
      driver: "types",
      scale: {
        kind: "categorical",
        overrides: { Person: "pin", Org: "layers" },
        unmapped: "info",
      },
    });
    expect(resolve({ types: ["Person"], properties: {} })).toBe("pin");
    expect(resolve({ types: ["Document"], properties: {} })).toBe("info");
  });

  it("UC4: edge color by top-level type; width by weight", () => {
    const color = makeColorResolver(
      { driver: "type", scale: { kind: "categorical", palette: "okabe-ito" } },
      { ugm: graph() },
      "edge",
    );
    expect(color({ type: "worksAt", properties: {} })).toBe(OKABE_ITO[0]);
    expect(color({ type: "knows", properties: {} })).toBe(OKABE_ITO[1]);
    const width = makeSizeResolver(
      {
        driver: "weight",
        scale: { kind: "sequential", domain: "auto", range: [1, 6] },
      },
      { ugm: graph() },
      "edge",
    );
    expect(width({ properties: { weight: 2 } })).toBe(1);
    expect(width({ properties: { weight: 8 } })).toBe(6);
  });

  it("UC5: fixed scales flatten everything to one value", () => {
    const resolve = makeColorResolver(
      { scale: { kind: "fixed", value: "#9aa0a6" } },
      { ugm: graph() },
    );
    expect(resolve({ types: ["Person"], properties: {} })).toBe("#9aa0a6");
    expect(resolve({ types: ["Org"], properties: {} })).toBe("#9aa0a6");
  });

  it("sequential color maps onto the viridis ramp", () => {
    const resolve = makeColorResolver(
      { driver: "pagerank", scale: { kind: "sequential", domain: [0, 1] } },
      { ugm: graph() },
    );
    const low = resolve({ types: [], properties: { pagerank: 0 } });
    const high = resolve({ types: [], properties: { pagerank: 1 } });
    expect(low).toBe("#440154");
    expect(high).toBe("#fffbcd");
  });
});

describe("encoding spec serialization and guards", () => {
  it("UC6: spec round-trips through JSON", () => {
    const spec: EncodingSpec = {
      ...DEFAULT_SPEC,
      node: {
        ...DEFAULT_SPEC.node,
        size: {
          driver: "pagerank",
          scale: { kind: "sequential", domain: [0, 0.2], range: [10, 30] },
        },
      },
    };
    expect(parseEncodingSpec(serializeEncodingSpec(spec))).toEqual(spec);
  });

  it("UC7: reserved channels are rejected with the owner named", () => {
    const hostile = `{"version":1,"node":{},"edge":{},"effects":{"accent":{"driver":"confidence"}}}`;
    expect(() => parseEncodingSpec(hostile)).toThrowError(ReservedChannelError);
    expect(() => parseEncodingSpec(hostile)).toThrowError(/selection/);
  });

  it("rejects unknown versions", () => {
    expect(() => parseEncodingSpec(`{"version":2}`)).toThrowError(/version/);
  });

  it("legacy EncodingConfig lifts losslessly", () => {
    const spec = fromLegacyConfig({
      ...DEFAULT_ENCODING,
      nodeColorProperty: "types",
      nodeSizeProperty: "pagerank",
    });
    expect(spec.node.color?.driver).toBe("types");
    expect(spec.node.size?.scale.kind).toBe("sequential");
    expect(spec.node.label).toEqual({
      driver: DEFAULT_ENCODING.nodeLabelProperty,
    });
  });

  it("custom palettes warn on low contrast and CVD, never block", () => {
    const warnings = warnOnCustomPalette(["#fefefe", "#0072b2"], "#ffffff");
    expect(warnings.some((w) => w.includes("#fefefe"))).toBe(true);
    expect(warnings.some((w) => w.includes("color-vision"))).toBe(true);
    // Sound palette: only the CVD note remains.
    expect(warnOnCustomPalette(["#0072b2"], "#ffffff")).toHaveLength(1);
  });

  it("vi import smoke (kept for parity with sibling suites)", () => {
    expect(vi.isMockFunction(vi.fn())).toBe(true);
  });
});

describe("applyIconMappings", () => {
  it("merges set pre-mappings into the icon channel without mutating input", () => {
    const before = JSON.parse(JSON.stringify(DEFAULT_SPEC)) as EncodingSpec;
    const after = applyIconMappings(before, {
      driver: "types",
      values: { Person: "agent" },
    });
    expect(after.node.icon).toEqual({
      driver: "types",
      scale: { kind: "categorical", overrides: { Person: "agent" } },
    });
    expect(before.node.icon).toBeUndefined();
  });
});

describe("categoricalColorMap (FacetFilter swatch consistency)", () => {
  it("maps each type to the same color the resolver assigns", () => {
    const ugm = graph();
    const spec: EncodingSpec = {
      ...DEFAULT_SPEC,
      node: {
        ...DEFAULT_SPEC.node,
        color: {
          driver: "types",
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
      },
    };
    const map = categoricalColorMap(spec, ugm);
    const resolve = makeColorResolver(spec.node.color, { ugm });
    // Person appears first (insertion order), Org second.
    expect(map.get("Person")).toBe(
      resolve({ types: ["Person"], properties: {} }),
    );
    expect(map.get("Org")).toBe(resolve({ types: ["Org"], properties: {} }));
    // And those are the first two Okabe-Ito slots, in order.
    expect(map.get("Person")).toBe(OKABE_ITO[0]);
    expect(map.get("Org")).toBe(OKABE_ITO[1]);
  });

  it("returns an empty map for a non-categorical color channel", () => {
    const ugm = graph();
    const spec: EncodingSpec = {
      ...DEFAULT_SPEC,
      node: {
        ...DEFAULT_SPEC.node,
        color: {
          driver: "pagerank",
          scale: { kind: "sequential", domain: "auto", ramp: "sequential" },
        },
      },
    };
    expect(categoricalColorMap(spec, ugm).size).toBe(0);
  });
});

describe("categorical domain stability (review 4.4)", () => {
  const specWithDomain = (domain: string[]): EncodingSpec => ({
    version: 1,
    node: {
      color: {
        driver: "types",
        scale: { kind: "categorical", palette: "okabe-ito", domain },
      },
      shape: {
        driver: "types",
        scale: { kind: "categorical", domain },
      },
    },
    edge: {},
  });

  function ugmInOrder(types: string[]): UGM {
    const g = new UGM();
    types.forEach((t, i) => g.addNode(`n${i}`, { types: [t] }));
    return g;
  }

  it("same spec, reversed data order: identical colors and shapes per value", () => {
    const domain = ["Alpha", "Beta", "Gamma", "Delta"];
    const spec = specWithDomain(domain);
    const forward = ugmInOrder(domain);
    const reversed = ugmInOrder([...domain].reverse());

    const colorF = categoricalColorMap(spec, forward);
    const colorR = categoricalColorMap(spec, reversed);
    for (const v of domain) {
      expect(colorR.get(v)).toBe(colorF.get(v));
    }

    const shapeEnc = spec.node.shape;
    const resolveF = makeShapeResolver(shapeEnc);
    const resolveR = makeShapeResolver(shapeEnc);
    // Encounter in reversed order first; domain seeding must make the
    // encounter order irrelevant.
    for (const v of [...domain].reverse())
      resolveR({ types: [v], properties: {} });
    for (const v of domain) {
      expect(resolveR({ types: [v], properties: {} })).toBe(
        resolveF({ types: [v], properties: {} }),
      );
    }
  });

  it("without a domain, encounter order still assigns (unchanged legacy behavior)", () => {
    const spec = specWithDomain([]);
    if (spec.node.color?.scale.kind === "categorical") {
      delete spec.node.color.scale.domain;
    }
    const a = categoricalColorMap(spec, ugmInOrder(["X", "Y"]));
    const b = categoricalColorMap(spec, ugmInOrder(["Y", "X"]));
    expect(a.get("X")).toBe(b.get("Y"));
  });

  it("out-of-domain values assign after the domain and never steal domain slots", () => {
    const spec = specWithDomain(["A", "B"]);
    const withExtra = categoricalColorMap(spec, ugmInOrder(["Zed", "A", "B"]));
    const domainOnly = categoricalColorMap(spec, ugmInOrder(["A", "B"]));
    expect(withExtra.get("A")).toBe(domainOnly.get("A"));
    expect(withExtra.get("B")).toBe(domainOnly.get("B"));
    expect(withExtra.get("Zed")).toBeDefined();
    expect(withExtra.get("Zed")).not.toBe(withExtra.get("A"));
    expect(withExtra.get("Zed")).not.toBe(withExtra.get("B"));
  });

  it("categoricalColorMap lists domain values first, in domain order", () => {
    const spec = specWithDomain(["B", "A"]);
    const map = categoricalColorMap(spec, ugmInOrder(["Extra", "A", "B"]));
    expect([...map.keys()]).toEqual(["B", "A", "Extra"]);
  });
});
