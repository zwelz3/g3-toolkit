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
import { createCountByType } from "@g3t/core";

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
