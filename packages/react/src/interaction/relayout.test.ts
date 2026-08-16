// R-7: neighbours settle around a moved container; the fixed
// elements do not move, and locks are restored exactly.
import { describe, it, expect } from "vitest";
import cytoscape from "cytoscape";
import { relayoutAroundFixed } from "./relayout";

function scene() {
  return cytoscape({
    headless: true,
    elements: [
      { group: "nodes", data: { id: "sys" } },
      { group: "nodes", data: { id: "a", parent: "sys" } },
      { group: "nodes", data: { id: "b", parent: "sys" } },
      { group: "nodes", data: { id: "far" } },
      { group: "edges", data: { id: "e", source: "a", target: "far" } },
    ],
  });
}

describe("relayoutAroundFixed", () => {
  it("holds the fixed container and its descendants in place", async () => {
    const cy = scene();
    cy.getElementById("sys").position({ x: 100, y: 100 });
    cy.getElementById("a").position({ x: 80, y: 90 });
    const before = { ...cy.getElementById("a").position() };
    await relayoutAroundFixed(cy, { fixed: ["sys"], name: "grid" });
    expect(cy.getElementById("a").position()).toEqual(before);
  });

  it("lets unfixed neighbours move", async () => {
    const cy = scene();
    cy.getElementById("far").position({ x: 0, y: 0 });
    const before = { ...cy.getElementById("far").position() };
    await relayoutAroundFixed(cy, { fixed: ["sys"], name: "grid" });
    expect(cy.getElementById("far").position()).not.toEqual(before);
  });

  it("restores prior lock state, including elements the host had locked", async () => {
    const cy = scene();
    cy.getElementById("far").lock();
    await relayoutAroundFixed(cy, { fixed: ["sys"], name: "grid" });
    expect(cy.getElementById("sys").locked()).toBe(false);
    expect(cy.getElementById("a").locked()).toBe(false);
    // The host's own lock survives the call.
    expect(cy.getElementById("far").locked()).toBe(true);
  });

  it("is a no-op when nothing matches, and does not throw on a destroyed core", async () => {
    const cy = scene();
    await expect(
      relayoutAroundFixed(cy, { fixed: ["nope"], name: "grid" }),
    ).resolves.toBeUndefined();
    cy.destroy();
    await expect(
      relayoutAroundFixed(cy, { fixed: ["sys"], name: "grid" }),
    ).resolves.toBeUndefined();
  });
});
