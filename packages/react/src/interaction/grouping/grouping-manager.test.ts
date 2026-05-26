/**
 * GroupingManager tests:
 *
 * T7: select 5 nodes; group; compound node appears with label; double-click expands.
 * T2: collapse group of 5; badge shows count; double-click expands.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "@g3t/core";
import { GroupingManager } from "./grouping-manager";

function createTestUGM(): UGM {
  const ugm = new UGM();
  for (let i = 0; i < 5; i++) {
    ugm.addNode(`n${i}`, {
      types: ["Person"],
      properties: { name: `Node ${i}` },
    });
  }
  ugm.addNode("other", { types: ["Org"], properties: { name: "Other" } });
  return ugm;
}

describe("GroupingManager: create group (M1.E3.T7)", () => {
  it("creates a compound node with child references", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);

    const groupId = gm.createGroup(
      ["n0", "n1", "n2", "n3", "n4"],
      "Suspect Cluster",
    );

    // Group node exists in UGM
    const groupNode = ugm.getNode(groupId);
    expect(groupNode).toBeDefined();
    expect(groupNode!.properties.name).toBe("Suspect Cluster");
    expect(groupNode!.properties._isGroup).toBe(true);

    // Children have _parent set
    for (let i = 0; i < 5; i++) {
      const child = ugm.getNode(`n${i}`);
      expect(child!.properties._parent).toBe(groupId);
    }

    // Non-grouped node is unaffected
    expect(ugm.getNode("other")!.properties._parent).toBeUndefined();
  });

  it("getChildren returns all child IDs", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);

    const groupId = gm.createGroup(["n0", "n1", "n2"], "Group A");
    const children = gm.getChildren(groupId);

    expect(children).toHaveLength(3);
    expect(children).toContain("n0");
    expect(children).toContain("n1");
    expect(children).toContain("n2");
  });

  it("removeGroup unsets _parent on children and removes group node", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);

    const groupId = gm.createGroup(["n0", "n1"], "Temp");
    gm.removeGroup(groupId);

    expect(ugm.hasNode(groupId)).toBe(false);
    expect(ugm.getNode("n0")!.properties._parent).toBeUndefined();
    expect(ugm.getNode("n1")!.properties._parent).toBeUndefined();
  });

  it("getAllGroups returns all group info", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);

    gm.createGroup(["n0", "n1"], "Group A");
    gm.createGroup(["n2", "n3", "n4"], "Group B");

    const groups = gm.getAllGroups();
    expect(groups).toHaveLength(2);

    const labels = groups.map((g) => g.label).sort();
    expect(labels).toEqual(["Group A", "Group B"]);

    const groupB = groups.find((g) => g.label === "Group B");
    expect(groupB!.childIds).toHaveLength(3);
  });

  it("skips nonexistent child IDs gracefully", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);

    // "missing" doesn't exist in UGM
    const groupId = gm.createGroup(["n0", "missing"], "Partial");
    const children = gm.getChildren(groupId);
    expect(children).toHaveLength(1);
    expect(children).toContain("n0");
  });
});

describe("GroupingManager: expand/collapse (M1.E3.T2)", () => {
  it("toggles collapse state", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);
    const groupId = gm.createGroup(["n0", "n1"], "Group");

    expect(gm.isCollapsed(groupId)).toBe(false);

    const nowCollapsed = gm.toggleCollapse(groupId);
    expect(nowCollapsed).toBe(true);
    expect(gm.isCollapsed(groupId)).toBe(true);

    const nowExpanded = gm.toggleCollapse(groupId);
    expect(nowExpanded).toBe(false);
    expect(gm.isCollapsed(groupId)).toBe(false);
  });

  it("reports collapsed state in getAllGroups", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);
    const groupId = gm.createGroup(["n0", "n1", "n2", "n3", "n4"], "Big Group");

    gm.toggleCollapse(groupId);

    const groups = gm.getAllGroups();
    const group = groups.find((g) => g.groupId === groupId);
    expect(group!.collapsed).toBe(true);
    expect(group!.childIds).toHaveLength(5);
  });

  it("removeGroup clears collapsed state", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);
    const groupId = gm.createGroup(["n0"], "Temp");

    gm.toggleCollapse(groupId);
    gm.removeGroup(groupId);

    expect(gm.isCollapsed(groupId)).toBe(false);
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("GroupingManager: edge cases (audit)", () => {
  it("creates group with empty children array", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);
    const groupId = gm.createGroup([], "Empty Group");

    expect(ugm.hasNode(groupId)).toBe(true);
    expect(gm.getChildren(groupId)).toHaveLength(0);
  });

  it("creates multiple groups with unique IDs", () => {
    const ugm = createTestUGM();
    const gm = new GroupingManager(ugm);
    const g1 = gm.createGroup(["n0"], "A");
    const g2 = gm.createGroup(["n1"], "B");

    expect(g1).not.toBe(g2);
    expect(gm.getAllGroups()).toHaveLength(2);
  });
});
