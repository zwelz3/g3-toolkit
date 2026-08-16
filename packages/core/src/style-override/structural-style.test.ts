// R-12a (round 21): the structural applier, with the precedence
// the request asked to have stated.
import { describe, it, expect } from "vitest";
import { overridesToStructuralStyles } from "./structural-style";
import type { NodeStyleOverride } from "./style-override";

const o = (
  x: Partial<NodeStyleOverride> & { scope: NodeStyleOverride["scope"] },
) => x as NodeStyleOverride;

describe("overridesToStructuralStyles", () => {
  it("maps presentational fields and IGNORES size (layout input)", () => {
    const m = overridesToStructuralStyles([
      o({
        scope: { nodeId: "a" },
        color: "#f00",
        borderColor: "#00f",
        borderWidth: 3,
        opacity: 0.5,
        size: 60,
      }),
    ]);
    expect(m.get("a")).toEqual({
      fill: "#f00",
      stroke: "#00f",
      strokeWidth: 3,
      opacity: 0.5,
    });
    expect(m.get("a")).not.toHaveProperty("size");
  });

  it("resolves TYPE scopes across supplied ids", () => {
    const m = overridesToStructuralStyles(
      [o({ scope: { type: "Sensor" }, color: "#0f0" })],
      (id) => (id === "a" || id === "b" ? ["Sensor"] : ["Other"]),
      ["a", "b", "c"],
    );
    expect(m.get("a")?.fill).toBe("#0f0");
    expect(m.get("b")?.fill).toBe("#0f0");
    expect(m.has("c")).toBe(false);
  });

  it("a node scope beats a type scope for the same element", () => {
    const m = overridesToStructuralStyles(
      [
        o({ scope: { type: "Sensor" }, color: "#0f0" }),
        o({ scope: { nodeId: "a" }, color: "#f00" }),
      ],
      () => ["Sensor"],
      ["a", "b"],
    );
    expect(m.get("a")?.fill).toBe("#f00");
    expect(m.get("b")?.fill).toBe("#0f0");
  });
});
