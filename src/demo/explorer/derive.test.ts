/**
 * Model Explorer derivations. The load-bearing contract is the first
 * describe block: a class's map slot never moves when zoom level, lens,
 * notation or labels change, because the map's geometry is computed once
 * and every view change only redraws inside the slots (the stability
 * rule; the removed expand/collapse feature re-laid out on a detail
 * change and failed four browser reviews).
 */
import { describe, it, expect } from "vitest";
import {
  PROFILES,
  SAMPLE_ARRANGEMENT,
  SAMPLE_TRACE,
  cloneOptions,
  type ExplorerOptions,
} from "./model";
import {
  buildClassView,
  classBox,
  computeMapLayout,
  entityGeometry,
  mapLevel,
  moduleGraphInput,
  rowContent,
  selectionSummary,
  status,
  type MapLayout,
} from "./derive";

const doc = SAMPLE_TRACE;
const opts = (
  id: keyof typeof PROFILES,
  patch: Partial<ExplorerOptions> = {},
) => ({
  ...cloneOptions(PROFILES[id].opts),
  ...patch,
});
const prop = (cls: string, key: string) => {
  const p = doc.classes
    .find((c) => c.id === cls)
    ?.props.find((q) => q.key === key);
  if (!p) throw new Error(`no ${cls}.${key}`);
  return p;
};

describe("map geometry is fixed across every view change", () => {
  let layout: MapLayout;
  it("lays the modules out once with the toolkit", async () => {
    layout = await computeMapLayout(doc);
    expect(layout.mods.map((m) => m.name).sort()).toEqual([
      "Ground",
      "Link analysis",
      "Operations",
      "Payload",
      "Spacecraft",
      "Spectrum",
    ]);
    expect(Object.keys(layout.slots)).toHaveLength(doc.classes.length);
  });

  it("orders modules within a layer by the saved arrangement", async () => {
    const arranged = await computeMapLayout(doc, SAMPLE_ARRANGEMENT);
    const y = (name: string) =>
      arranged.mods.find((m) => m.name === name)?.y ?? NaN;
    expect(y("Spacecraft")).toBeLessThan(y("Link analysis"));
    expect(y("Link analysis")).toBeLessThan(y("Operations"));
    expect(y("Spectrum")).toBeLessThan(y("Ground"));
  });

  it("follows relation flow: sources left of Payload, targets right of it", () => {
    const x = (name: string) =>
      layout.mods.find((m) => m.name === name)?.x ?? NaN;
    expect(x("Operations")).toBeLessThan(x("Payload"));
    expect(x("Spacecraft")).toBeLessThan(x("Payload"));
    expect(x("Spectrum")).toBeGreaterThan(x("Payload"));
    expect(x("Ground")).toBeGreaterThan(x("Payload"));
  });

  it("never overlaps two modules", () => {
    const ms = layout.mods;
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) {
        const a = ms[i]!;
        const b = ms[j]!;
        const apart =
          a.x + a.w <= b.x ||
          b.x + b.w <= a.x ||
          a.y + a.h <= b.y ||
          b.y + b.h <= a.y;
        expect(apart, `${a.name} overlaps ${b.name}`).toBe(true);
      }
  });

  it("draws every class centred in the same slot at every level, lens and notation", () => {
    const variants: Partial<ExplorerOptions>[] = [
      {},
      { lens: "concept" },
      { lens: "realization" },
      { lens: "combined", label: "iri" },
      { notation: "api", data: "fixture" },
      { notation: "onto", label: "rust" },
    ];
    for (const cls of Object.keys(layout.slots)) {
      const slot = layout.slots[cls]!;
      for (const v of variants)
        for (const lod of [1, 2, 3] as const) {
          const b = classBox(doc, layout, cls, lod, opts("sys", v));
          expect(b.x + b.w / 2).toBeCloseTo(slot.cx, 6);
          expect(b.y + b.h / 2).toBeCloseTo(slot.cy, 6);
          // The drawn box fits inside its slot's height at every level.
          expect(b.h).toBeLessThanOrEqual(slot.h);
        }
    }
  });
});

describe("detail level comes from the core LOD schedule", () => {
  it("maps zoom to Modules, Classes, Properties, Full detail", () => {
    expect(mapLevel(0.3).level).toBe(0);
    expect(mapLevel(0.5).level).toBe(1);
    expect(mapLevel(0.9).level).toBe(2);
    expect(mapLevel(1.2).level).toBe(3);
  });
  it("shows relation labels only from the Properties level in", () => {
    expect(mapLevel(0.5).edgeLabels).toBe(false);
    expect(mapLevel(0.9).edgeLabels).toBe(true);
    expect(mapLevel(1.6).edgeLabels).toBe(true);
  });
});

describe("trace status per property", () => {
  it("separates full trace, gaps, conflicts and internal fields", () => {
    expect(status(prop("Transponder", "instantaneousBandwidth"))).toBe("ok");
    expect(status(prop("Transponder", "saturationFlux"))).toBe("gap");
    expect(status(prop("Transponder", "legacyMode"))).toBe("gap");
    expect(status(prop("Transponder", "band"))).toBe("conflict");
    expect(status(prop("Transponder", "cache_epoch"))).toBe("internal");
  });
});

describe("class view", () => {
  it("counts what the systems-engineer defaults hide (internal and inherited)", () => {
    const v = buildClassView(doc, "Transponder", opts("sys"));
    expect(v.counts.Internal).toBe(1);
    expect(v.counts.Inherited).toBe(2);
    expect(v.hidden).toBe(3);
    expect(v.traceCounts).toEqual({ all: 9, gaps: 3, conflicts: 1 });
  });

  it("puts a property with no concept in Unclassified", () => {
    const v = buildClassView(doc, "Transponder", opts("ke"));
    const legacy = v.visible.find((p) => p.key === "legacyMode");
    expect(legacy && legacy.pattern).toBeNull();
    expect(v.counts.Unclassified).toBe(1);
  });

  it("renders a SysML value-property line in the contract lens", () => {
    const p = {
      ...prop("Transponder", "instantaneousBandwidth"),
      inherited: false,
    };
    const r = rowContent(doc, p, opts("sys"), "Transponder");
    expect(r.name).toBe("instantaneousBandwidth : Real [1] {> 0, unit = MHz}");
  });

  it("marks the rejected write on the failing row", () => {
    const p = {
      ...prop("Transponder", "instantaneousBandwidth"),
      inherited: false,
    };
    const r = rowContent(
      doc,
      p,
      opts("app", { data: "rejected" }),
      "Transponder",
    );
    expect(r.val).toEqual({ t: "-5", bad: true });
  });
});

describe("entity view template", () => {
  it("groups incoming relations past three behind one stub", () => {
    const v = buildClassView(doc, "Transponder", opts("sys"));
    const g = entityGeometry(doc, v, opts("sys"), 1000, false);
    const groups = g.stubs.filter((s) => s.group);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.n).toBe(3);
    expect(groups[0]?.label.sub).toBe("Operations");
    const expanded = entityGeometry(doc, v, opts("sys"), 1000, true);
    expect(expanded.stubs.filter((s) => s.dir === "in")).toHaveLength(5);
  });

  it("places the superclass above, parts below, references right, incoming left", () => {
    const v = buildClassView(doc, "Transponder", opts("sys"));
    const g = entityGeometry(doc, v, opts("sys"), 1000, false);
    const { x, y, w, h } = g.box;
    for (const s of g.stubs) {
      if (s.dir === "sup") expect(s.y + g.stubH).toBeLessThanOrEqual(y);
      if (s.dir === "part") expect(s.y).toBeGreaterThanOrEqual(y + h);
      if (s.dir === "out") expect(s.x).toBeGreaterThanOrEqual(x + w);
      if (s.dir === "in" || s.group)
        expect(s.x + g.stubW).toBeLessThanOrEqual(x);
    }
  });
});

describe("selections of several classes", () => {
  it("reports direct relations and shared neighbours", () => {
    expect(selectionSummary(doc, ["Satellite", "LinkBudget"])).toEqual({
      among: [],
      shared: ["Transponder"],
    });
    const s = selectionSummary(doc, ["Transponder", "Channel"]);
    expect(s.among.map((r) => r.key)).toEqual(["hasChannel"]);
    expect(s.shared).toEqual(["FrequencyPlan"]);
  });

  it("feeds the toolkit layout one edge per related module pair", () => {
    const g = moduleGraphInput(doc);
    expect(g.nodes).toHaveLength(6);
    const keys = g.edges.map((e) => [e.source, e.target].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
