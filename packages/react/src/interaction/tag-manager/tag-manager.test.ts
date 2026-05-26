/**
 * TagManager tests (M1.E3.T6):
 * Select 3 nodes; tag "Suspect Cluster A"; save; reload; tag persists.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "@g3t/core";
import { TagManager } from "./tag-manager";

function createTestUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["Person"], properties: { name: "Alice" } });
  ugm.addNode("b", { types: ["Person"], properties: { name: "Bob" } });
  ugm.addNode("c", { types: ["Person"], properties: { name: "Charlie" } });
  ugm.addNode("d", { types: ["Org"], properties: { name: "ACME" } });
  return ugm;
}

describe("TagManager (M1.E3.T6)", () => {
  it("adds a tag to selected nodes", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["a", "b", "c"], "Suspect Cluster A");

    expect(tm.getTags("a")).toEqual(["Suspect Cluster A"]);
    expect(tm.getTags("b")).toEqual(["Suspect Cluster A"]);
    expect(tm.getTags("c")).toEqual(["Suspect Cluster A"]);
    expect(tm.getTags("d")).toEqual([]);
  });

  it("does not duplicate tags on same node", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["a"], "VIP");
    tm.addTag(["a"], "VIP");

    expect(tm.getTags("a")).toEqual(["VIP"]);
  });

  it("supports multiple tags per node", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["a"], "Cluster A");
    tm.addTag(["a"], "Priority");

    expect(tm.getTags("a")).toEqual(["Cluster A", "Priority"]);
  });

  it("removes a tag from nodes", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["a", "b"], "Temp");
    tm.removeTag(["a"], "Temp");

    expect(tm.getTags("a")).toEqual([]);
    expect(tm.getTags("b")).toEqual(["Temp"]);
  });

  it("tags persist through UGM serialization round-trip", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["a", "b", "c"], "Suspect Cluster A");

    // Serialize and restore
    const json = ugm.toJSON();
    const restored = UGM.fromJSON(json);
    const tm2 = new TagManager(restored);

    expect(tm2.getTags("a")).toEqual(["Suspect Cluster A"]);
    expect(tm2.getTags("b")).toEqual(["Suspect Cluster A"]);
    expect(tm2.getTags("c")).toEqual(["Suspect Cluster A"]);
  });

  it("getAllTags returns unique sorted tags", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["a"], "Zebra");
    tm.addTag(["b"], "Apple");
    tm.addTag(["c"], "Zebra");

    expect(tm.getAllTags()).toEqual(["Apple", "Zebra"]);
  });

  it("getNodesWithTag finds matching nodes", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["a", "c"], "Important");
    tm.addTag(["b"], "Other");

    const result = tm.getNodesWithTag("Important");
    expect(result).toHaveLength(2);
    expect(result).toContain("a");
    expect(result).toContain("c");
  });

  it("handles nonexistent node gracefully", () => {
    const ugm = createTestUGM();
    const tm = new TagManager(ugm);

    tm.addTag(["nonexistent"], "Tag");
    expect(tm.getTags("nonexistent")).toEqual([]);
  });
});
