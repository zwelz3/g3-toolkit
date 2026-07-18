/**
 * AuditShell contract test. CytoscapeCanvas is replaced by a stub that
 * records the `hidden` prop, so the wiring that item 3 exists for (the
 * dual-range slider filters the GRAPH, not just the timeline) is asserted
 * headlessly: moving the window start must deliver to the canvas exactly
 * the node-id set hiddenForRange computes for that window. The expected
 * set is computed from a fresh buildProvenance() (deterministic ids), so
 * the assertion pins the wiring, not the (separately tested) function.
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

const captured = vi.hoisted(() => ({
  hidden: [] as Array<ReadonlySet<string> | undefined>,
  menuManagers: [] as Array<{
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
  }>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      hidden?: ReadonlySet<string>;
      menuManager?: (typeof captured.menuManagers)[number];
    }) => {
      captured.hidden.push(props.hidden);
      if (props.menuManager) captured.menuManagers.push(props.menuManager);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { AuditShell } from "./AuditShell";
import { buildProvenance } from "./model";
import { provenanceEvents, timeBounds, hiddenForRange } from "./timeline";
import { useSelectionStore, useOverlayStore } from "@g3t/react";

beforeEach(() => {
  captured.hidden.length = 0;
  captured.menuManagers.length = 0;
});
afterEach(() => {
  useSelectionStore.getState().selectNodes([]);
  cleanup();
});

const sorted = (s: ReadonlySet<string> | undefined) => [...(s ?? [])].sort();

describe("AuditShell slider-to-graph wiring", () => {
  it("hides nothing over the full window", () => {
    render(<AuditShell onBack={() => {}} />);
    expect(sorted(captured.hidden.at(-1))).toEqual([]);
  });

  it("feeds hiddenForRange for the narrowed window into the canvas hidden prop", () => {
    const ugm = buildProvenance();
    const events = provenanceEvents(ugm);
    const bounds = timeBounds(events);
    // Pick, deterministically, a window start that actually hides nodes;
    // the fixture seeds early events, so one must exist.
    const start = events
      .map((e) => e.time)
      .find((t) => hiddenForRange(ugm, t, bounds.max).size > 0);
    expect(start).toBeDefined();
    const expected = sorted(hiddenForRange(ugm, start ?? 0, bounds.max));

    render(<AuditShell onBack={() => {}} />);
    fireEvent.change(screen.getByLabelText("Window start"), {
      target: { value: String(start) },
    });

    expect(sorted(captured.hidden.at(-1))).toEqual(expected);
  });

  it("renders the seeded SHACL findings and the capability callout", () => {
    const { container } = render(<AuditShell onBack={() => {}} />);
    expect(container.textContent).toContain("SHACL report");
    expect(container.textContent).toContain("violations");
    fireEvent.click(screen.getByTestId("capability-bubble"));
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "hidden prop",
    );
  });

  it("menu labels do what they say: properties -> inspector, lineage -> trace (6.1)", () => {
    render(<AuditShell onBack={() => {}} />);
    const manager = captured.menuManagers.at(-1);
    expect(manager).toBeDefined();
    const target = {
      type: "node" as const,
      id: "ent:legacy",
      position: { x: 0, y: 0 },
    };
    const items = manager!.resolve(target);
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Inspect properties");
    expect(labels).toContain("Inspect lineage");
    // Properties opens the floating inspector, not the trace.
    act(() => {
      items.find((i) => i.label === "Inspect properties")!.action(target);
    });
    expect(screen.getByTestId("au-inspector")).toBeDefined();
    expect(screen.queryByTestId("g3t-provenance-trace")).toBeNull();
    // Lineage sets the explicit trace root.
    act(() => {
      items.find((i) => i.label === "Inspect lineage")!.action(target);
    });
    // The title lives in the FloatingPanel header (9.23 fold); the
    // trace body carries the chain.
    const panel = screen.getByTestId("au-lineage");
    expect(panel.textContent).toContain("Lineage: Legacy spec");
    expect(panel.textContent).toContain("No attribution recorded");
  });

  it("lineage is not offered on Agents; the trace root survives selection changes (6.1)", () => {
    render(<AuditShell onBack={() => {}} />);
    const manager = captured.menuManagers.at(-1)!;
    const agentItems = manager.resolve({
      type: "node",
      id: "agent:alice",
      position: { x: 0, y: 0 },
    });
    expect(agentItems.map((i) => i.label)).not.toContain("Inspect lineage");
    // Open a trace, then change selection: the tree must NOT re-root
    // (the reviewed collapse-on-click was selection-driven rerooting).
    const entityTarget = {
      type: "node" as const,
      id: "ent:release",
      position: { x: 0, y: 0 },
    };
    act(() => {
      manager
        .resolve(entityTarget)
        .find((i) => i.label === "Inspect lineage")!
        .action(entityTarget);
    });
    const before = screen.getByTestId("g3t-provenance-trace").textContent;
    act(() => {
      useSelectionStore.getState().selectNodes(["agent:alice"]);
    });
    expect(screen.getByTestId("g3t-provenance-trace").textContent).toBe(before);
    // Close clears it.
    fireEvent.click(screen.getByTestId("au-trace-close"));
    expect(screen.queryByTestId("g3t-provenance-trace")).toBeNull();
  });

  it("overlays are INACTIVE by default; the chips are the explicit controls (6.2)", () => {
    render(<AuditShell onBack={() => {}} />);
    expect(useOverlayStore.getState().activeIds).toHaveLength(0);
    fireEvent.click(screen.getByTestId("au-ov-violations"));
    expect(useOverlayStore.getState().activeIds).toContain("prov.violations");
    fireEvent.click(screen.getByTestId("au-ov-violations"));
    expect(useOverlayStore.getState().activeIds).toHaveLength(0);
  });

  it("play sweeps the window end forward and pauses (6.3)", () => {
    vi.useFakeTimers();
    try {
      render(<AuditShell onBack={() => {}} />);
      // Playing from a full window rewinds the end to the start first.
      fireEvent.click(screen.getByTestId("au-play"));
      const readEnd = () =>
        screen.getByText("Time window").parentElement?.textContent ?? "";
      const atRewind = readEnd();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(readEnd()).not.toBe(atRewind);
      fireEvent.click(screen.getByTestId("au-play"));
    } finally {
      vi.useRealTimers();
    }
  });
});
