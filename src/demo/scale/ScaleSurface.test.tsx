/**
 * ScaleSurface contract test (canvas stubbed; the pure stages carry
 * their own budgets in @g3t/core). Pins: the canvas receives the
 * supernode graph first (small), drilling via the rail swaps it for
 * the induced member subgraph (exactly the community size), selecting
 * a supernode on the canvas drills the same way, and back restores
 * the cluster view. Rendering at scale stays browser-verified.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import type { UGM } from "@g3t/core";

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
  counts: [] as number[],
  menus: [] as CapturedMenu[],
  colorDrivers: [] as Array<string | undefined>,
  animate: [] as Array<boolean | undefined>,
  layoutOptions: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      menuManager?: CapturedMenu;
      encodingSpec?: { node?: { color?: { driver?: string } } };
      layoutOptions?: Record<string, unknown>;
      animate?: boolean;
    }) => {
      captured.counts.push(props.ugm.getNodeIds().length);
      captured.animate.push(props.animate);
      captured.colorDrivers.push(props.encodingSpec?.node?.color?.driver);
      captured.layoutOptions.push(props.layoutOptions);
      if (props.menuManager) captured.menus.push(props.menuManager);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { ScaleSurface } from "./ScaleSurface";
import { COMMUNITIES, COMMUNITY_SIZE } from "./generate";
import { useSelectionStore } from "@g3t/react";

afterEach(() => {
  useSelectionStore.getState().selectNodes([]);
  cleanup();
});

describe("ScaleSurface", () => {
  it("renders supernodes, not the 8,000-node graph", () => {
    render(<ScaleSurface onBack={() => {}} />);
    expect(screen.getByTestId("g3t-graph-toolbar")).toBeTruthy();
    const first = captured.counts.at(-1) ?? 0;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(200);
    expect(screen.getByTestId("scale-status").textContent).toContain(
      "8,000 nodes",
    );
    expect(screen.getByTestId("scale-status").textContent).toContain(
      "measured live",
    );
  });

  it("drills into a cluster from the rail and returns", () => {
    render(<ScaleSurface onBack={() => {}} />);
    const clusterButtons = screen
      .getAllByRole("button")
      .filter((b) => /\(\d+\)/.test(b.textContent ?? ""));
    expect(clusterButtons.length).toBeGreaterThan(1);
    const target = clusterButtons[0] as HTMLElement;
    // Louvain approximately recovers the planted partition (bridge
    // nodes can migrate), so the contract is agreement, not the
    // planted size: the drilled canvas count equals the clicked rail
    // entry's own member count.
    const declared = Number(
      /\((\d+)\)\s*$/.exec(target.textContent ?? "")?.[1],
    );
    fireEvent.click(target);

    const drilled = captured.counts.at(-1) ?? 0;
    expect(drilled).toBe(declared);
    expect(drilled).toBeGreaterThan(COMMUNITY_SIZE * 0.75);
    expect(drilled).toBeLessThan(COMMUNITY_SIZE * 1.3);
    expect(screen.getByTestId("scale-status").textContent).toContain(
      `Showing ${drilled} of 8,000`,
    );

    fireEvent.click(screen.getByRole("button", { name: /Back to clusters/ }));
    const back = captured.counts.at(-1) ?? 0;
    expect(back).toBeLessThanOrEqual(200);
    expect(back).toBeGreaterThan(1);
  });

  it("context menu: base copy plus the registered drill item, which drills", () => {
    render(<ScaleSurface onBack={() => {}} />);
    const manager = captured.menus.at(-1);
    expect(manager).toBeDefined();
    const target = {
      type: "node",
      id: "cluster:c0",
      position: { x: 0, y: 0 },
    };
    const items = manager!.resolve(target);
    // Built-ins first (functional copy; no dead Inspect), then the
    // app-registered action.
    expect(items.map((i) => i.label)).toEqual([
      "Copy ID",
      "Drill into cluster",
    ]);
    fireEvent.click(screen.getByTestId("canvas-stub")); // no-op; keeps RTL happy
    act(() => {
      items[1]!.action(target);
    });
    expect(screen.getByTestId("scale-status").textContent).toContain("Showing");
    expect(captured.counts.at(-1) ?? 0).toBeLessThan(8000);
    expect(captured.counts.at(-1) ?? 0).toBeGreaterThan(1);
  });

  it("drills when a supernode is selected on the canvas", () => {
    render(<ScaleSurface onBack={() => {}} />);
    // Find a real supernode id from the rail's first button label by
    // selecting via the store with a known member key shape instead:
    // the surface treats any selected id present in the member map as
    // a drill request.
    act(() => {
      // cluster ids are cluster:cN; c0 exists for the seeded graph
      useSelectionStore.getState().selectNodes(["cluster:c0"]);
    });
    const drilled = captured.counts.at(-1) ?? 0;
    expect(drilled).toBeGreaterThan(1);
    expect(drilled).toBeLessThanOrEqual(COMMUNITY_SIZE * COMMUNITIES);
    expect(screen.getByTestId("scale-status").textContent).toContain("Showing");
  });

  it("supernode labels are unique and the rail explains Louvain (5.12)", () => {
    render(<ScaleSurface onBack={() => {}} />);
    expect(screen.getByTestId("scale-cluster-explainer").textContent).toMatch(
      /Louvain/,
    );
    const rows = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => t.includes("cluster around"));
    expect(rows.length).toBeGreaterThan(1);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("the color toggle swaps the driver to dominantType and back (5.14)", () => {
    render(<ScaleSurface onBack={() => {}} />);
    expect(captured.colorDrivers.at(-1)).toBe("types");
    fireEvent.click(screen.getByTestId("scale-color-toggle"));
    expect(captured.colorDrivers.at(-1)).toBe("dominantType");
    fireEvent.click(screen.getByTestId("scale-color-toggle"));
    expect(captured.colorDrivers.at(-1)).toBe("types");
  });

  it("views carry distinct spacing tuning; drill reverts dominant coloring (5.11/5.14)", () => {
    render(<ScaleSurface onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("scale-color-toggle"));
    const clusterOpts = captured.layoutOptions.at(-1);
    expect(clusterOpts?.padding).toBe(60);
    // 9.8 experiment pin: end-mode layout animation (fcose's
    // animate:true renders every tick; that presented as drill lag).
    expect(clusterOpts?.animate).toBe("end");
    const drillRow = screen
      .getAllByRole("button")
      .find((b) => (b.textContent ?? "").includes("cluster around"));
    expect(drillRow).toBeDefined();
    fireEvent.click(drillRow as HTMLElement);
    // Member nodes carry no dominantType: the drill view colors by
    // type regardless of the toggle.
    expect(captured.colorDrivers.at(-1)).toBe("types");
    expect(captured.layoutOptions.at(-1)?.padding).toBe(50);
    // Review 5.13: the drill layout run IS the loading affordance;
    // the animation flag must reach the canvas (jsdom reports no
    // reduced-motion preference, so it is true here). The canvas
    // honors it per-layout; reduced motion flips it via the hook.
    expect(captured.animate.at(-1)).toBe(true);
  });
});
