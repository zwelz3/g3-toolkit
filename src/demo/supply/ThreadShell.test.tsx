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
  node?: {
    color?: { driver?: string };
    icon?: { scale?: { overrides?: Record<string, string> } };
  };
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
  hidden: [] as Array<ReadonlySet<string>>,
  calls: [] as Array<{
    driver: string | undefined;
    iconOverrides: Record<string, string> | undefined;
    layout: string | undefined;
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
      layout?: string;
      hidden?: ReadonlySet<string>;
      onReady?: (cy: unknown) => void;
      animate?: boolean;
      menuManager?: CapturedMenu;
    }) => {
      captured.hidden.push(props.hidden ?? new Set());
      let nodes = 0;
      let allClustered = true;
      props.ugm.forEachNode((_id, attrs) => {
        nodes += 1;
        if (attrs.properties.cluster === undefined) allClustered = false;
      });
      captured.calls.push({
        driver: props.encodingSpec?.node?.color?.driver,
        iconOverrides: props.encodingSpec?.node?.icon?.scale?.overrides,
        layout: props.layout,
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
import { useHiddenSuppliersStore } from "./hidden-suppliers-store";
import {
  useOverlayStore,
  useEmphasisStore,
  useSelectionStore,
} from "@g3t/react";

beforeEach(() => {
  captured.calls.length = 0;
  captured.menus.length = 0;
});
afterEach(() => {
  useSelectionStore.getState().selectNodes([]);
  cleanup();
  useHiddenSuppliersStore.getState().reset();
  useEmphasisStore.getState().clear();
});

describe("SupplyThreadShell canvas contract", () => {
  it("starts on the type-driven spec", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    expect(captured.calls.at(-1)?.driver).toBe("types");
  });

  it("materializes cluster labels on every node before the cluster spec reaches the canvas", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("sc-mode-region"));
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
    fireEvent.click(screen.getByTestId("sc-mode-region"));
    expect(container.textContent).not.toContain("(choose a mode)");
  });

  it("context menu: expand REVEALS hidden suppliers (3.8); shortest route selects the path", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    const manager = captured.menus.at(-1);
    expect(manager).toBeDefined();
    const ugm = buildDigitalThread();
    const isSupplier = (id: string) =>
      ugm.getNode(id)?.types.includes("Supplier") === true;
    // A non-supplier node that is supplied by someone: the expansion
    // seed. Its supplier neighbors start hidden.
    const start = ugm
      .getNodeIds()
      .find((id) => !isSupplier(id) && ugm.getNeighbors(id).some(isSupplier));
    expect(start).toBeDefined();
    const neighbor = ugm.getNeighbors(start!).find(isSupplier)!;
    const at = (id: string) => ({
      type: "node",
      id,
      position: { x: 0, y: 0 },
    });

    // Suppliers seed hidden (real expansion, not selection spreading).
    const initialHidden = captured.hidden.at(-1);
    expect(initialHidden?.has(neighbor)).toBe(true);

    // Empty selection: base copy plus expand; route is filtered out.
    let items = manager!.resolve(at(start!));
    expect(items.map((i) => i.label)).toEqual([
      "Copy ID",
      "Expand suppliers (1-hop)",
    ]);

    act(() => {
      items[1]!.action(at(start!));
    });
    // Revealed AND selected.
    expect(captured.hidden.at(-1)?.has(neighbor)).toBe(false);
    const sel = useSelectionStore.getState().selectedNodeIds;
    expect(sel.has(neighbor)).toBe(true);

    // Wired-or-absent: with this node's suppliers revealed, the item
    // no longer appears for it.
    items = manager!.resolve(at(start!));
    expect(items.map((i) => i.label)).not.toContain("Expand suppliers (1-hop)");

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
    // Adjacent nodes: a 1-hop route rendered as an emphasis effect
    // (4.6), never as selection; the status chip offers clear.
    const emphasis = useEmphasisStore.getState();
    expect(emphasis.active).toBe(true);
    expect(emphasis.effectNodeIds.has(start!)).toBe(true);
    expect(emphasis.emphasizedEdgeIds.size).toBe(1);
    expect(screen.getByTestId("route-status").textContent).toContain("1 hop");
    fireEvent.click(screen.getByTestId("clear-route"));
    expect(useEmphasisStore.getState().active).toBe(false);
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
    fireEvent.click(screen.getByTestId("capability-bubble"));
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "Minimap",
    );
  });

  it("renders the gap report and the capability callout", () => {
    const { container } = render(<SupplyThreadShell onBack={() => {}} />);
    expect(container.textContent).toContain("Gaps (");
    fireEvent.click(screen.getByTestId("capability-bubble"));
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "encodingSpec",
    );
  });
});

describe("supply redesign (reviews 5.6-5.9)", () => {
  it("encodes type as icons and lays the DAG out in tiers (5.6)", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    const last = captured.calls.at(-1);
    expect(last?.layout).toBe("breadthfirst");
    expect(last?.iconOverrides?.Supplier).toBe("sc-supplier");
    expect(last?.iconOverrides?.Product).toBe("sc-product");
  });

  it("default state is full strength; dimming is an explicit labeled control (5.7)", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    const box = screen.getByTestId("sc-dim-confidence");
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/merged procurement records/i)).toBeDefined();
  });

  it("consumer-readable rail: legend with grouping radios and defined tier; Provenance renamed (5.8)", () => {
    const { container } = render(<SupplyThreadShell onBack={() => {}} />);
    expect(screen.getByTestId("sc-legend")).toBeDefined();
    expect(screen.getByTestId("sc-mode-tier")).toBeDefined();
    expect(container.textContent).toContain("Tier 1 sells to us directly");
    expect(container.textContent).toContain("Entities per source");
    expect(container.textContent).not.toContain("Provenance");
  });

  it("the gaps panel states its hybrid computation (5.9)", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    const line = screen.getByTestId("sc-gap-provenance").textContent ?? "";
    expect(line).toContain("sole-source");
    expect(line).toContain("SHACL");
  });

  it("gap overlays are INACTIVE by default; chips are the explicit controls (9.10)", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    expect(useOverlayStore.getState().activeIds).toHaveLength(0);
    fireEvent.click(screen.getByTestId("sc-ov-violations"));
    expect(useOverlayStore.getState().activeIds).toContain("gap.violations");
    fireEvent.click(screen.getByTestId("sc-ov-violations"));
    expect(useOverlayStore.getState().activeIds).toHaveLength(0);
  });

  it("the canvas carries a floating legend (12.16)", () => {
    render(<SupplyThreadShell onBack={() => {}} />);
    expect(screen.getByTestId("g3t-floating-legend")).toBeDefined();
  });
});
