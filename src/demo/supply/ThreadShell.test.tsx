/**
 * SupplyThreadShell contract test. CytoscapeCanvas is replaced by a stub
 * that snapshots, AT RENDER TIME, whether every node already carries the
 * materialized `cluster` property alongside the spec it received. That
 * asserts the ingest-before-restyle ordering the spec memo guarantees
 * (the refactor away from setState-in-effect), which a low-level
 * cytoscape mock could not express.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import type { UGM } from "@g3t/core";

interface SpecShape {
  node?: { color?: { driver?: string } };
}

type CapturedMenu = {
  resolve: (t: {
    type: string;
    id?: string;
    position: { x: number; y: number };
  }) => Array<{
    label: string;
    action: (t: {
      type: string;
      id?: string;
      position: { x: number; y: number };
    }) => void;
  }>;
};
const captured = vi.hoisted(() => ({
  menus: [] as CapturedMenu[],
  calls: [] as Array<{
    driver: string | undefined;
    allClustered: boolean;
    nodes: number;
    hasOnReady: boolean;
    animate: boolean | undefined;
  }>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      encodingSpec?: SpecShape;
      onReady?: (cy: unknown) => void;
      animate?: boolean;
      menuManager?: CapturedMenu;
    }) => {
      let nodes = 0;
      let allClustered = true;
      props.ugm.forEachNode((_id, attrs) => {
        nodes += 1;
        if (attrs.properties.cluster === undefined) allClustered = false;
      });
      captured.calls.push({
        driver: props.encodingSpec?.node?.color?.driver,
        allClustered,
        nodes,
        hasOnReady: typeof props.onReady === "function",
        animate: props.animate,
      });
      if (props.menuManager) captured.menus.push(props.menuManager);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { SupplyThreadShell } from "./ThreadShell";
import { buildDigitalThread } from "./model";
import { useSelectionStore } from "@g3t/react";

beforeEach(() => {
  captured.calls.length = 0;
  captured.menus.length = 0;
});
afterEach(() => {
  useSelectionStore.getState().selectNodes([]);
  cleanup();
});

describe("SupplyThreadShell canvas contract", () => {
  it("starts on the type-driven spec", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    expect(captured.calls.at(-1)?.driver).toBe("types");
  });

  it("materializes cluster labels on every node before the cluster spec reaches the canvas", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Region" }));
    const last = captured.calls.at(-1);
    expect(last?.driver).toBe("cluster");
    expect(last?.nodes).toBeGreaterThan(0);
    // The ordering claim: at the render that delivered the cluster spec,
    // ingest had already labeled every node.
    expect(last?.allClustered).toBe(true);
  });

  it("populates the clusters panel once a mode is chosen", () => {
    const { container } = render(<SupplyThreadShell onBack={() => {}} />);
    expect(container.textContent).toContain("(choose a mode)");
    fireEvent.click(screen.getByRole("button", { name: "Region" }));
    expect(container.textContent).not.toContain("(choose a mode)");
  });

  it("context menu: expand grows the selection; shortest route selects the path", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    const manager = captured.menus.at(-1);
    expect(manager).toBeDefined();
    const ugm = buildDigitalThread();
    // Pick a node with at least one neighbor, and one of its neighbors.
    const start = ugm
      .getNodeIds()
      .find((id) => ugm.getNeighbors(id).length > 0);
    expect(start).toBeDefined();
    const neighbor = ugm.getNeighbors(start!)[0]!;
    const at = (id: string) => ({
      type: "node",
      id,
      position: { x: 0, y: 0 },
    });

    // Empty selection: base copy plus expand; route is filtered out.
    let items = manager!.resolve(at(start!));
    expect(items.map((i) => i.label)).toEqual([
      "Copy ID",
      "Expand suppliers (1-hop)",
    ]);

    act(() => {
      items[1]!.action(at(start!));
    });
    const sel = useSelectionStore.getState().selectedNodeIds;
    expect(sel.has(neighbor)).toBe(true);

    // With exactly one OTHER node selected, the route item appears.
    act(() => {
      useSelectionStore.getState().selectNodes([neighbor]);
    });
    items = manager!.resolve(at(start!));
    expect(items.map((i) => i.label)).toContain("Shortest route to selected");
    act(() => {
      items
        .find((i) => i.label === "Shortest route to selected")!
        .action(at(start!));
    });
    // Adjacent nodes: a 1-hop route, selected and reported.
    expect(useSelectionStore.getState().selectedNodeIds.has(start!)).toBe(true);
    expect(screen.getByTestId("route-status").textContent).toContain("1 hop");
  });

  it("mounts the Minimap over the canvas, placeholder until the core arrives", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    // The shell hands the canvas an onReady to capture the core...
    expect(captured.calls.at(-1)?.hasOnReady).toBe(true);
    // Reduced-motion wiring: jsdom has no matchMedia, so the hook
    // reports full motion and the shell passes animate={true}.
    expect(captured.calls.at(-1)?.animate).toBe(true);
    // ...and the Minimap renders its disabled placeholder meanwhile
    // (the stubbed canvas never delivers a core in jsdom).
    expect(screen.getByTestId("minimap")).toBeDefined();
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "Minimap",
    );
  });

  it("renders the gap report and the capability callout", () => {
    const { container } = render(<SupplyThreadShell onBack={() => {}} />);
    expect(container.textContent).toContain("Gaps (");
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "encodingSpec",
    );
  });
});
