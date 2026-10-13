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
  within,
} from "@testing-library/react";
import type { UGM } from "@g3-toolkit/core";

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

vi.mock("@g3-toolkit/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3-toolkit/react")>();
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
import {
  provenanceEvents,
  timeBounds,
  hiddenForRange,
  provenanceReport,
} from "./timeline";
import { provenanceShapes } from "./shapes";
import { provenanceChainFor } from "./chain";
import { describeSelection } from "./announce";
import { useSelectionStore, useOverlayStore } from "@g3-toolkit/react";

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

/**
 * Issue #16: what the screen-reader live region receives. Debounce is
 * 300 ms on the companion, so each case advances fake timers past it;
 * the expected strings are computed from a fresh fixture through the
 * same pure formatters, and literal fragments pin the wording.
 */
describe("AuditShell screen-reader narration (#16)", () => {
  const live = () => screen.getByTestId("aria-live-region").textContent;
  const settle = () =>
    act(() => {
      vi.advanceTimersByTime(300);
    });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the canvas region and describes it as decorative with the way to the list", () => {
    render(<AuditShell onBack={() => {}} />);
    const region = screen.getByRole("main", { name: "Provenance graph" });
    const descId = region.getAttribute("aria-describedby");
    expect(descId).toBe("au-canvas-instructions");
    expect(document.getElementById(descId!)?.textContent).toContain(
      "decorative for assistive technology",
    );
    const list = screen.getByRole("listbox", { name: "Provenance nodes" });
    expect(
      document.getElementById(list.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toContain("follows a provenance edge");
  });

  it("announces the selection with directed PROV-O edge counts and SHACL standing", () => {
    const ugm = buildProvenance();
    const report = provenanceReport(ugm, provenanceShapes);
    render(<AuditShell onBack={() => {}} />);
    expect(live()).toBe("");
    act(() => {
      useSelectionStore.getState().selectNodes(["ent:release"]);
    });
    // Debounced: nothing until the window elapses.
    expect(live()).toBe("");
    settle();
    expect(live()).toBe(describeSelection(ugm, "ent:release", report));
    expect(live()).toContain("Signed approval, Entity");
    expect(live()).toMatch(/\d+ incoming and \d+ outgoing provenance edges/);
    expect(live()).toContain("no SHACL findings");
  });

  it("clicking a SHACL finding announces the count and worst severity", () => {
    render(<AuditShell onBack={() => {}} />);
    // Hazard log is the planted missing-generation-time violation.
    fireEvent.click(screen.getAllByText("Hazard log")[0]!);
    settle();
    expect(live()).toContain("Hazard log, Entity");
    expect(live()).toMatch(/\d+ SHACL findings?, worst severity violation/);
  });

  it("announces the lineage step when a trace opens and when a hop is clicked", () => {
    render(<AuditShell onBack={() => {}} />);
    const manager = captured.menuManagers.at(-1)!;
    const target = {
      type: "node" as const,
      id: "ent:release",
      position: { x: 0, y: 0 },
    };
    act(() => {
      manager
        .resolve(target)
        .find((i) => i.label === "Inspect lineage")!
        .action(target);
    });
    settle();
    const chain = provenanceChainFor(buildProvenance(), "ent:release");
    expect(live()).toContain(`Lineage step 1 of ${chain.length}: Signed approval`);
    // Advance: click the second hop in the trace.
    const second = chain[1]!;
    fireEvent.click(
      within(screen.getByTestId("g3t-provenance-trace")).getByText(
        second.label,
      ),
    );
    settle();
    expect(live()).toContain(
      `Lineage step 2 of ${chain.length}: ${second.label}, via ${second.detail}`,
    );
  });

  it("an unchanged re-render and a same-node re-selection do not re-announce", () => {
    const { rerender } = render(<AuditShell onBack={() => {}} />);
    act(() => {
      useSelectionStore.getState().selectNodes(["agent:alice"]);
    });
    settle();
    const text = live();
    expect(text).toContain("Alice Chen, Agent");
    const node = screen.getByTestId("aria-live-region").firstChild;
    rerender(<AuditShell onBack={() => {}} />);
    act(() => {
      useSelectionStore.getState().selectNodes(["agent:alice"]);
    });
    settle();
    expect(live()).toBe(text);
    // Same DOM text node: nothing for a screen reader to re-utter.
    expect(screen.getByTestId("aria-live-region").firstChild).toBe(node);
  });

  it("a window move announces the window once; play mutes until it stops", () => {
    const ugm = buildProvenance();
    const events = provenanceEvents(ugm);
    const bounds = timeBounds(events);
    render(<AuditShell onBack={() => {}} />);
    const start = events
      .map((e) => e.time)
      .find((t) => hiddenForRange(ugm, t, bounds.max).size > 0)!;
    fireEvent.change(screen.getByLabelText("Window start"), {
      target: { value: String(start) },
    });
    settle();
    expect(live()).toContain("Time window");
    const hiddenCount = hiddenForRange(ugm, start, bounds.max).size;
    expect(live()).toContain(
      `${hiddenCount} node${hiddenCount === 1 ? "" : "s"} hidden`,
    );
    const afterMove = live();
    // Play: the sweep advances the end every 250 ms; the region holds.
    fireEvent.click(screen.getByTestId("au-play"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(live()).toBe(afterMove);
    // Pause: the latest window commits after the debounce.
    fireEvent.click(screen.getByTestId("au-play"));
    settle();
    expect(live()).not.toBe(afterMove);
    expect(live()).toContain("Time window");
  });

  it("the companion list mirrors the canvas hidden set", () => {
    const ugm = buildProvenance();
    const events = provenanceEvents(ugm);
    const bounds = timeBounds(events);
    render(<AuditShell onBack={() => {}} />);
    const start = events
      .map((e) => e.time)
      .find((t) => hiddenForRange(ugm, t, bounds.max).size > 0)!;
    const hiddenId = [...hiddenForRange(ugm, start, bounds.max)][0]!;
    expect(screen.getByTestId(`aria-node-${hiddenId}`)).toBeDefined();
    fireEvent.change(screen.getByLabelText("Window start"), {
      target: { value: String(start) },
    });
    expect(screen.queryByTestId(`aria-node-${hiddenId}`)).toBeNull();
  });
});
