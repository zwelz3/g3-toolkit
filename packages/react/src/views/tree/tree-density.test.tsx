/** B3 density on TreeView. */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { TreeView } from "./TreeView";

function containmentGraph(): UGM {
  const ugm = new UGM();
  ugm.addNode("root", { types: ["System"], properties: { label: "Root" } });
  ugm.addNode("child", { types: ["Part"], properties: { label: "Child" } });
  ugm.addEdge("root", "child", { type: "contains", properties: {} });
  return ugm;
}

describe("TreeView density (B3)", () => {
  it("compact tightens row padding", () => {
    const { container } = render(
      <TreeView ugm={containmentGraph()} rootId="root" density="compact" />,
    );
    // Label text is split across spans; assert the row style directly.
    const compactRows = container.querySelectorAll(
      '[style*="padding: 0px 6px"]',
    );
    expect(compactRows.length).toBeGreaterThan(0);
    const comfortable = render(
      <TreeView ugm={containmentGraph()} rootId="root" />,
    ).container.querySelectorAll('[style*="padding: 2px 8px"]');
    expect(comfortable.length).toBeGreaterThan(0);
  });
});
