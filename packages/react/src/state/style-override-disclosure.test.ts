// R-13 (register, 2026-08-05): a legend asserting that a colour
// means a class is FALSIFIED the moment a reader repaints one node,
// and there was no supported way to ask which nodes carry manual
// styling. These are the selectors that make it askable.
import { describe, it, expect } from "vitest";
import { UGM } from "@g3t/core";
import {
  overriddenNodeIds,
  overrideScopeSummary,
} from "./style-override-store";

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["Sensor"], properties: {} });
  ugm.addNode("b", { types: ["Sensor"], properties: {} });
  ugm.addNode("c", { types: ["Actuator"], properties: {} });
  return ugm;
}

describe("overriddenNodeIds", () => {
  it("reports node-scoped overrides without needing the graph", () => {
    const ids = overriddenNodeIds([
      { scope: { nodeId: "a" }, color: "#f00" } as never,
    ]);
    expect(ids).toEqual(["a"]);
  });

  it("resolves TYPE-scoped overrides across the graph", () => {
    const ids = overriddenNodeIds(
      [{ scope: { type: "Sensor" }, color: "#f00" } as never],
      graph(),
    );
    expect(new Set(ids)).toEqual(new Set(["a", "b"]));
  });

  it("returns only direct ids when a type scope cannot be resolved", () => {
    const ids = overriddenNodeIds([
      { scope: { type: "Sensor" } } as never,
      { scope: { nodeId: "c" } } as never,
    ]);
    expect(ids).toEqual(["c"]);
  });

  it("summarises scopes for disclosure copy", () => {
    const summary = overrideScopeSummary([
      { scope: { nodeId: "a" } } as never,
      { scope: { type: "Sensor" } } as never,
    ]);
    expect(summary).toEqual({ nodes: 1, types: ["Sensor"] });
  });
});
