/**
 * M11 E2-E3 tests: LinkedChart (component), PropertyFilter,
 * ViewFilter (unit).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UGM } from "@g3t/core";
import {
  evaluateFilter,
  createViewFilter,
  applyViewFilter,
  showOnlySelected,
  hideSelected,
  expandToNHops,
} from "@g3t/core";
import type { FilterGroup, ViewFilter } from "@g3t/core";
import { LinkedChart } from "./LinkedChart";
import { FilterBuilder } from "@g3t/react";
import { createCountByType, createPropertyCorrelation } from "@g3t/core";

// ── Helpers ─────────────────────────────────────────────────────────

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", {
    types: ["Person"],
    properties: { name: "Alice", risk: 0.9 },
  });
  ugm.addNode("p2", {
    types: ["Person"],
    properties: { name: "Bob", risk: 0.3 },
  });
  ugm.addNode("p3", {
    types: ["Person"],
    properties: { name: "Carol", risk: 0.7 },
  });
  ugm.addNode("o1", {
    types: ["Org"],
    properties: { name: "Acme", risk: 0.5 },
  });
  ugm.addNode("o2", {
    types: ["Org"],
    properties: { name: "Globex", risk: 0.8 },
  });
  ugm.addEdge("p1", "o1", { type: "worksAt" });
  ugm.addEdge("p2", "o1", { type: "worksAt" });
  ugm.addEdge("p3", "o2", { type: "worksAt" });
  ugm.addEdge("p1", "p2", { type: "knows" });
  return ugm;
}

// ── PropertyFilter (M11.E3.T1) ──────────────────────────────────────

describe("evaluateFilter", () => {
  it("filters by numeric greater-than", () => {
    const ugm = makeUGM();
    const filter: FilterGroup = {
      logic: "and",
      filters: [{ key: "risk", operator: "gt", value: 0.5 }],
    };
    const result = evaluateFilter(ugm, filter);
    expect(result).toEqual(new Set(["p1", "p3", "o2"]));
  });

  it("filters by string contains", () => {
    const ugm = makeUGM();
    const filter: FilterGroup = {
      logic: "and",
      filters: [{ key: "name", operator: "contains", value: "ob" }],
    };
    const result = evaluateFilter(ugm, filter);
    // "Bob" and "Globex" both contain "ob" (case-insensitive)
    expect(result).toEqual(new Set(["p2", "o2"]));
  });

  it("filters by equality", () => {
    const ugm = makeUGM();
    const filter: FilterGroup = {
      logic: "and",
      filters: [{ key: "name", operator: "eq", value: "Acme" }],
    };
    const result = evaluateFilter(ugm, filter);
    expect(result).toEqual(new Set(["o1"]));
  });

  it("AND combines multiple conditions", () => {
    const ugm = makeUGM();
    const filter: FilterGroup = {
      logic: "and",
      filters: [
        { key: "risk", operator: "gte", value: 0.5 },
        { key: "name", operator: "contains", value: "a" },
      ],
    };
    const result = evaluateFilter(ugm, filter);
    // risk >= 0.5 AND name contains "a": Carol (0.7, "Carol"), Alice (0.9, "Alice" - no lowercase 'a'... wait)
    // "contains" is case-insensitive: Alice has "a", Carol has "a", Acme has "a"
    // risk >= 0.5: p1(0.9), p3(0.7), o1(0.5), o2(0.8)
    // name contains "a": Alice, Carol, Acme (case-insensitive)
    // Intersection: p1, p3, o1
    expect(result).toEqual(new Set(["p1", "p3", "o1"]));
  });

  it("OR combines conditions", () => {
    const ugm = makeUGM();
    const filter: FilterGroup = {
      logic: "or",
      filters: [
        { key: "name", operator: "eq", value: "Alice" },
        { key: "name", operator: "eq", value: "Bob" },
      ],
    };
    const result = evaluateFilter(ugm, filter);
    expect(result).toEqual(new Set(["p1", "p2"]));
  });

  it("exists checks for property presence", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { score: 10 } });
    ugm.addNode("b", { types: ["X"], properties: {} });
    const filter: FilterGroup = {
      logic: "and",
      filters: [{ key: "score", operator: "exists" }],
    };
    expect(evaluateFilter(ugm, filter)).toEqual(new Set(["a"]));
  });

  it("nested filter groups", () => {
    const ugm = makeUGM();
    const filter: FilterGroup = {
      logic: "and",
      filters: [
        { key: "risk", operator: "gt", value: 0.6 },
        {
          logic: "or",
          filters: [
            { key: "name", operator: "eq", value: "Alice" },
            { key: "name", operator: "eq", value: "Globex" },
          ],
        },
      ],
    };
    // risk > 0.6: p1(0.9), p3(0.7), o2(0.8)
    // name = Alice OR Globex: p1, o2
    // AND: p1, o2
    const result = evaluateFilter(ugm, filter);
    expect(result).toEqual(new Set(["p1", "o2"]));
  });

  it("empty filter returns all nodes", () => {
    const ugm = makeUGM();
    const filter: FilterGroup = { logic: "and", filters: [] };
    const result = evaluateFilter(ugm, filter);
    expect(result.size).toBe(5);
  });
});

// ── ViewFilter (M11.E3.T3) ──────────────────────────────────────────

describe("ViewFilter", () => {
  it("createViewFilter returns show-all state", () => {
    const vf = createViewFilter();
    expect(vf.visibleNodeIds).toBeNull();
    expect(vf.hiddenNodeIds.size).toBe(0);
    expect(vf.pinnedNodeIds.size).toBe(0);
  });

  it("applyViewFilter with no restrictions shows all", () => {
    const ugm = makeUGM();
    const { visibleNodes } = applyViewFilter(ugm, createViewFilter());
    expect(visibleNodes).toHaveLength(5);
  });

  it("showOnlySelected hides non-selected nodes", () => {
    const ugm = makeUGM();
    const vf = showOnlySelected(new Set(["p1", "o1"]));
    const { visibleNodes, visibleEdges } = applyViewFilter(ugm, vf);
    expect(visibleNodes).toEqual(["p1", "o1"]);
    expect(visibleEdges.length).toBeGreaterThan(0); // p1→o1 edge
  });

  it("hideSelected removes selected from view", () => {
    const ugm = makeUGM();
    const vf = hideSelected(new Set(["p1"]));
    const { visibleNodes } = applyViewFilter(ugm, vf);
    expect(visibleNodes).not.toContain("p1");
    expect(visibleNodes).toHaveLength(4);
  });

  it("expandToNHops shows correct neighborhood", () => {
    const ugm = makeUGM();
    // p1 connects to: o1, p2 (1-hop)
    const vf = expandToNHops(ugm, "p1", 1);
    const { visibleNodes } = applyViewFilter(ugm, vf);
    expect(visibleNodes).toContain("p1");
    expect(visibleNodes).toContain("o1");
    expect(visibleNodes).toContain("p2");
    expect(visibleNodes).not.toContain("o2"); // 2 hops away
  });

  it("expandToNHops with 2 hops includes transitive neighbors", () => {
    const ugm = makeUGM();
    const vf = expandToNHops(ugm, "p1", 2);
    const { visibleNodes } = applyViewFilter(ugm, vf);
    // p1 1-hop: o1, p2. 2-hop from o1: p2 (already). From p2: o1 (already).
    // In this dense graph, 2 hops doesn't add new nodes beyond 1-hop.
    expect(visibleNodes).toContain("p1");
    expect(visibleNodes).toContain("o1");
    expect(visibleNodes).toContain("p2");
    expect(visibleNodes.length).toBeGreaterThanOrEqual(3);
  });

  it("pinned nodes stay visible despite hide", () => {
    const ugm = makeUGM();
    const vf: ViewFilter = {
      visibleNodeIds: null,
      hiddenNodeIds: new Set(["p1", "p2"]),
      pinnedNodeIds: new Set(["p1"]), // p1 is pinned AND hidden
    };
    const { visibleNodes } = applyViewFilter(ugm, vf);
    expect(visibleNodes).toContain("p1"); // pinned wins
    expect(visibleNodes).not.toContain("p2"); // hidden, not pinned
  });
});

// ── LinkedChart (M11.E2.T1) ─────────────────────────────────────────

describe("LinkedChart", () => {
  it("renders chart container with pipeline ID", () => {
    const ugm = makeUGM();
    const pipeline = createCountByType();

    render(
      <LinkedChart ugm={ugm} pipeline={pipeline} type="bar" height={200} />,
    );

    expect(
      screen.getByTestId("linked-chart-count-by-type"),
    ).toBeInTheDocument();
  });

  it("renders with different chart types", () => {
    const ugm = makeUGM();
    const pipeline = createCountByType();

    const { unmount } = render(
      <LinkedChart ugm={ugm} pipeline={pipeline} type="pie" height={200} />,
    );
    expect(
      screen.getByTestId("linked-chart-count-by-type"),
    ).toBeInTheDocument();
    unmount();
  });
});

// ── FilterBuilder (M11.E3.T2) ───────────────────────────────────────

describe("FilterBuilder", () => {
  it("renders filter builder with initial row", () => {
    const ugm = makeUGM();
    render(<FilterBuilder ugm={ugm} onApply={vi.fn()} />);
    expect(screen.getByTestId("filter-builder")).toBeInTheDocument();
    expect(screen.getByTestId("filter-apply")).toBeInTheDocument();
  });

  it("adds a filter row", async () => {
    const ugm = makeUGM();
    render(<FilterBuilder ugm={ugm} onApply={vi.fn()} />);

    const addBtn = screen.getByTestId("filter-add-row");
    await userEvent.click(addBtn);

    // Should have 2 rows now (initial + added)
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(4); // 2 rows x 2 selects each
  });

  it("apply calls onApply with matching node IDs", async () => {
    const ugm = makeUGM();
    const onApply = vi.fn();
    render(<FilterBuilder ugm={ugm} onApply={onApply} />);

    // Click Apply with no filters set (should return all nodes)
    await userEvent.click(screen.getByTestId("filter-apply"));
    expect(onApply).toHaveBeenCalledOnce();
    const result = onApply.mock.calls[0]?.[0] as Set<string>;
    expect(result.size).toBe(5);
  });
});

// ── Option builders (coverage gap found 2026-08-16) ─────────────────
//
// The two LinkedChart tests above assert that a container renders. They
// say nothing about what is IN the chart, and buildBarOptions,
// buildScatterOptions, buildLineOptions, buildPieOptions and
// buildParallelOptions are the bulk of this package: they were the
// reason charts sat at 35.3% statements and 12.5% branches while the
// rest of core was at 84% or better.
//
// The builders are module-private, correctly: exporting them to test
// them would widen the published surface. They are reached through the
// component instead, by capturing the `option` prop handed to
// echarts-for-react. ECharts renders to canvas and jsdom has no
// getContext, so the mock is required regardless.

const capturedOptions: Record<string, unknown>[] = [];

vi.mock("echarts-for-react", () => ({
  default: (props: { option: Record<string, unknown> }) => {
    capturedOptions.push(props.option);
    return null;
  },
}));

/**
 * Render with a pipeline whose DATA SHAPE matches the chart type and
 * return the option object the chart was handed.
 *
 * The pairing is not cosmetic: buildOptions casts (`data as
 * ScatterData`) rather than validating, so a categorical pipeline on a
 * scatter chart throws inside the builder on a missing `.map`. That is
 * a programmer error rather than a supported input, so it is recorded
 * here rather than asserted as behavior; validating the shape at the
 * cast would be a real improvement and is not this commit's job.
 */
function optionFor(
  type: string,
  pipeline: Parameters<
    typeof LinkedChart
  >[0]["pipeline"] = createCountByType() as never,
): Record<string, unknown> {
  capturedOptions.length = 0;
  const { unmount } = render(
    <LinkedChart
      ugm={makeUGM()}
      pipeline={pipeline}
      type={type as "bar"}
      height={200}
    />,
  );
  const last = capturedOptions[capturedOptions.length - 1];
  unmount();
  expect(last).toBeDefined();
  return last!;
}

describe("LinkedChart option builders", () => {
  it("bar builds a category axis and a bar series", () => {
    const o = optionFor("bar");
    expect((o.series as { type: string }[])[0]!.type).toBe("bar");
    expect((o.xAxis as { type: string }).type).toBe("category");
  });

  it("pie builds a pie series with no axes", () => {
    const o = optionFor("pie");
    expect((o.series as { type: string }[])[0]!.type).toBe("pie");
    expect(o.xAxis).toBeUndefined();
    expect(o.yAxis).toBeUndefined();
  });

  it("scatter and line build their own series types", () => {
    const scatter = optionFor(
      "scatter",
      createPropertyCorrelation("risk", "risk") as never,
    );
    expect((scatter.series as { type: string }[])[0]!.type).toBe("scatter");

    // A minimal TimeSeriesData pipeline built here rather than
    // createActivityTimeline, which was withdrawn from the public
    // surface: a test importing a withdrawn symbol would quietly
    // reinstate a dependency on it.
    const timeline = {
      id: "test-timeline",
      name: "Test Timeline",
      query: () => ({
        series: [
          { time: 1, value: 2, nodeIds: ["p1", "p2"] },
          { time: 2, value: 1, nodeIds: ["p3"] },
        ],
      }),
      reverseMap: () => [],
    };
    const line = optionFor("line", timeline as never);
    expect((line.series as { type: string }[])[0]!.type).toBe("line");
  });

  it("an unknown chart type yields an empty option rather than throwing", () => {
    // The `default:` arm of buildOptions. A bad type must not take down
    // a host's render, matching setTheme's warn-do-not-throw posture.
    expect(optionFor("treemap")).toEqual({});
  });

  it("axis and label colors are concrete values, never CSS var() strings", () => {
    // ECharts draws to canvas and cannot resolve custom properties: a
    // var(--g3t-*) string is an invalid fill and silently falls back to
    // a fixed default, which is how the axes stopped following dark
    // mode. This asserts the fix stays fixed.
    const vars = JSON.stringify(optionFor("bar")).match(/var\(--[^)]*\)/g);
    expect(vars).toBeNull();
  });
});
