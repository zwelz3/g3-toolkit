/**
 * Style engine tests (G3L:STY-001..005, STY-012, QLT-006, and the
 * mechanistic PRF-004 proxy).
 *
 * The incremental engine must agree with the pure reference
 * (`resolveStyles`); layer precedence is pinned pairwise; STY-003's
 * silent field gating is asserted as ZERO diagnostics; invalidation
 * budgets are asserted as EVALUATION COUNTS (deterministic, CI-stable)
 * with one loose wall-clock smoke bound. Real time budgets belong to
 * the MR-5 baseline ruling, not to a flaky CI assertion.
 */
import { describe, expect, it } from "vitest";
import {
  resolveStyles,
  StyleEngine,
  type StyleDiagnostic,
  type StyleElement,
  type StyleGraph,
  type StyleRule,
} from "./style-engine";

function collectDiags(): {
  sink: { emit(d: StyleDiagnostic): void };
  all: StyleDiagnostic[];
} {
  const all: StyleDiagnostic[] = [];
  return { sink: { emit: (d) => all.push(d) }, all };
}

const node = (
  id: string,
  data: Record<string, unknown> = {},
  extra: Partial<StyleElement> = {},
): StyleElement => ({ id, kind: "node", data, ...extra });

describe("layer precedence (G3L:STY-001)", () => {
  it("defaults < theme < rules < classes < states < manual overrides", () => {
    const el = node(
      "n1",
      { risk: "high" },
      {
        classes: ["muted"],
        states: ["selected"],
      },
    );
    const engine = new StyleEngine({
      theme: { node: { fill: "theme" } },
      rules: [
        {
          id: "r1",
          selector: { dataHas: ["risk"] },
          attributes: { fill: "rule" },
        },
      ],
      classDefs: { muted: { fill: "class" } },
      stateDefs: { selected: { fill: "state" } },
    });
    engine.load({ elements: [el] });

    // Full stack: manual override wins over everything.
    engine.setOverride("n1", { fill: "manual" });
    expect(engine.get("n1")?.fill).toBe("manual");
    engine.setOverride("n1", null);
    // states beat classes beat rules beat theme.
    expect(engine.get("n1")?.fill).toBe("state");
    engine.setStates("n1", []);
    expect(engine.get("n1")?.fill).toBe("class");
    engine.setClasses("n1", []);
    expect(engine.get("n1")?.fill).toBe("rule");
  });

  it("rules apply in insertion order (later wins)", () => {
    const rules: StyleRule[] = [
      { id: "a", attributes: { fill: "first" } },
      { id: "b", attributes: { fill: "second" } },
    ];
    const out = resolveStyles({ elements: [node("n")] }, { rules });
    expect(out.get("n")?.fill).toBe("second");
  });

  it("theme applies over per-kind defaults; defaults differ by kind", () => {
    const out = resolveStyles(
      {
        elements: [node("n"), { id: "e", kind: "edge", data: {} }],
      },
      { theme: { edge: { stroke: "themed" } } },
    );
    expect(out.get("n")?.shape).toBe("rectangle"); // node default
    expect(out.get("e")?.arrowTarget).toBe("triangle"); // edge default
    expect(out.get("e")?.stroke).toBe("themed");
  });
});

describe("field-presence gating (G3L:STY-003)", () => {
  it("dataHas rules skip absent-field elements silently: zero diagnostics", () => {
    const { sink, all } = collectDiags();
    const engine = new StyleEngine({
      rules: [
        {
          id: "risk-color",
          selector: { dataHas: ["risk"] },
          attributes: { fill: "red" },
        },
      ],
      diagnostics: sink,
    });
    const out = engine.load({
      elements: [node("with", { risk: 1 }), node("without", {})],
    });
    expect(out.get("with")?.fill).toBe("red");
    expect(out.get("without")?.fill).not.toBe("red");
    expect(all).toEqual([]); // the flood is unrepresentable
  });

  it("dataEquals implies presence and equality", () => {
    const out = resolveStyles(
      {
        elements: [
          node("hi", { severity: "high" }),
          node("lo", { severity: "low" }),
          node("none", {}),
        ],
      },
      {
        rules: [
          {
            id: "sev",
            selector: { dataEquals: { severity: "high" } },
            attributes: { halo: { color: "red", width: 4 } },
          },
        ],
      },
    );
    expect(out.get("hi")?.halo).toBeDefined();
    expect(out.get("lo")?.halo).toBeUndefined();
    expect(out.get("none")?.halo).toBeUndefined();
  });
});

describe("classes and states (G3L:STY-012, STY-005)", () => {
  it("class precedence follows classDef definition order, not element order", () => {
    const out = resolveStyles(
      { elements: [node("n", {}, { classes: ["b", "a"] })] },
      { classDefs: { a: { fill: "A" }, b: { fill: "B" } } },
    );
    expect(out.get("n")?.fill).toBe("B"); // b defined later, wins
  });

  it("state removal restores base styles without touching other layers", () => {
    const engine = new StyleEngine({
      rules: [{ id: "r", attributes: { opacity: 0.5 } }],
      stateDefs: { hover: { opacity: 1 } },
    });
    engine.load({ elements: [node("n")] });
    engine.setStates("n", ["hover"]);
    expect(engine.get("n")?.opacity).toBe(1);
    engine.setStates("n", []);
    expect(engine.get("n")?.opacity).toBe(0.5);
  });

  it("unknown class/state names emit ONE diagnostic each, not per resolve", () => {
    const { sink, all } = collectDiags();
    const engine = new StyleEngine({ diagnostics: sink });
    engine.load({
      elements: [
        node("n1", {}, { classes: ["ghost"] }),
        node("n2", {}, { classes: ["ghost"] }),
      ],
    });
    engine.setClasses("n1", ["ghost"]); // recompute again
    const ghost = all.filter((d) => d.code === "STYLE_UNKNOWN_CLASS");
    expect(ghost).toHaveLength(1);
  });
});

describe("incremental invalidation (G3L:STY-004)", () => {
  const rules: StyleRule[] = [
    {
      id: "risk-fill",
      selector: { dataHas: ["risk"] },
      attributes: (ctx) => ({
        fill: (ctx.element.data["risk"] as number) > 5 ? "red" : "green",
      }),
      dependencies: { data: ["risk"] },
      outputs: ["fill"],
    },
    {
      id: "neighbor-dim",
      attributes: (ctx) => ({
        opacity: ctx.neighbors.some((n) => n.data["faded"] === true) ? 0.3 : 1,
      }),
      dependencies: { data: ["faded"], adjacency: true },
      outputs: ["opacity"],
    },
  ];

  function ring(): StyleGraph {
    const elements = ["a", "b", "c", "d"].map((id) =>
      node(id, { risk: 1, faded: false }),
    );
    const idx = new Map(elements.map((e, i) => [e.id, i]));
    return {
      elements,
      neighbors: (id) => {
        const i = idx.get(id);
        if (i === undefined) return [];
        const n = elements.length;
        const left = elements[(i + n - 1) % n];
        const right = elements[(i + 1) % n];
        return [left, right].filter(Boolean).map((e) => (e as StyleElement).id);
      },
    };
  }

  it("a change to an unmatched field recomputes NOTHING", () => {
    const engine = new StyleEngine({ rules });
    const graph = ring();
    engine.load(graph);
    const r = engine.applyDataChange("a", ["label"]);
    expect(r.recomputed).toEqual([]);
    expect(r.evaluations).toBe(0);
  });

  it("a matched-field change recomputes only that element", () => {
    const engine = new StyleEngine({ rules });
    const graph = ring();
    engine.load(graph);
    const a = graph.elements[0] as StyleElement;
    (a.data as Record<string, unknown>)["risk"] = 9;
    const r = engine.applyDataChange("a", ["risk"]);
    expect(r.recomputed).toEqual(["a"]);
    expect(engine.get("a")?.fill).toBe("red");
    expect(engine.get("b")?.fill).toBe("green");
  });

  it("an adjacency-dependent field change also recomputes the neighbors, and ONLY them", () => {
    const engine = new StyleEngine({ rules });
    const graph = ring();
    engine.load(graph);
    const a = graph.elements[0] as StyleElement;
    (a.data as Record<string, unknown>)["faded"] = true;
    const r = engine.applyDataChange("a", ["faded"]);
    // a itself, plus ring neighbors d and b; c untouched.
    expect([...r.recomputed].sort()).toEqual(["a", "b", "d"]);
    expect(engine.get("b")?.opacity).toBe(0.3);
    expect(engine.get("d")?.opacity).toBe(0.3);
    expect(engine.get("c")?.opacity).toBe(1);
  });

  it("fn rules WITHOUT declared deps degrade to conservative and say so once", () => {
    const { sink, all } = collectDiags();
    const engine = new StyleEngine({
      rules: [{ id: "mystery", attributes: () => ({ fill: "x" }) }],
      diagnostics: sink,
    });
    engine.load({ elements: [node("n")] });
    const r = engine.applyDataChange("n", ["anything"]);
    expect(r.recomputed).toEqual(["n"]); // conservative: any change hits it
    expect(all.filter((d) => d.code === "STYLE_FN_WITHOUT_DEPS")).toHaveLength(
      1,
    );
  });

  it("incremental results agree with the pure reference after changes", () => {
    const engine = new StyleEngine({ rules });
    const graph = ring();
    engine.load(graph);
    const a = graph.elements[0] as StyleElement;
    (a.data as Record<string, unknown>)["risk"] = 9;
    (a.data as Record<string, unknown>)["faded"] = true;
    engine.applyDataChange("a", ["risk", "faded"]);
    const reference = resolveStyles(graph, { rules });
    for (const el of graph.elements) {
      expect(engine.get(el.id)).toEqual(reference.get(el.id));
    }
  });
});

describe("R2-scale mechanistic budgets (PRF-004 proxy)", () => {
  it("full resolve is linear in matches; a single change costs a bounded sliver", () => {
    const N = 5000;
    const E = 10000;
    const elements: StyleElement[] = [];
    for (let i = 0; i < N; i++) {
      elements.push(
        node(`n${i}`, { risk: i % 10, category: i % 5 === 0 ? "hub" : "leaf" }),
      );
    }
    for (let i = 0; i < E; i++) {
      elements.push({ id: `e${i}`, kind: "edge", data: { weight: i % 7 } });
    }
    const rules: StyleRule[] = [
      {
        id: "risk",
        selector: { kind: "node", dataHas: ["risk"] },
        attributes: (ctx) => ({
          fill: (ctx.element.data["risk"] as number) > 5 ? "red" : "green",
        }),
        dependencies: { data: ["risk"] },
        outputs: ["fill"],
      },
      {
        id: "hubs",
        selector: { kind: "node", dataEquals: { category: "hub" } },
        attributes: { halo: { color: "gold", width: 3 } },
        outputs: ["halo"],
      },
      {
        id: "weight",
        selector: { kind: "edge", dataHas: ["weight"] },
        attributes: (ctx) => ({
          strokeWidth: 1 + (ctx.element.data["weight"] as number) / 7,
        }),
        dependencies: { data: ["weight"] },
        outputs: ["strokeWidth"],
      },
    ];
    const engine = new StyleEngine({ rules });
    const t0 = performance.now();
    engine.load({ elements });
    const loadMs = performance.now() - t0;
    const loadEvals = engine.stats().evaluations;
    // Matches: every node hits "risk" (5000) + hubs (1000); every edge
    // hits "weight" (10000). 16000 total evaluations, exactly.
    expect(loadEvals).toBe(16000);
    // Loose wall-clock smoke only (PRF-004's 100ms target is MR-5's
    // baseline to freeze, not a CI assertion): catch pathology, not
    // variance.
    expect(loadMs).toBeLessThan(1000);

    // One element's matched field changes: evaluations bounded by that
    // element's applicable rules (2 for a hub node), zero fan-out.
    const target = elements[0] as StyleElement;
    (target.data as Record<string, unknown>)["risk"] = 9;
    const r = engine.applyDataChange("n0", ["risk"]);
    expect(r.recomputed).toEqual(["n0"]);
    expect(r.evaluations).toBeLessThanOrEqual(2);

    // One element's UNMATCHED field changes: zero everything.
    const r2 = engine.applyDataChange("n1", ["notes"]);
    expect(r2.evaluations).toBe(0);
  });
});
