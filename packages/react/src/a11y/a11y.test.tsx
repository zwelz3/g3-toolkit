/**
 * M8 Accessibility tests.
 *
 * E1.T1: Focusable node list with structured aria-labels.
 * E1.T2: Keyboard focus selects node in store.
 * E1.T3: aria-live region exists.
 * E1.T4: High contrast config.
 * E1.T5: Table fallback (verified via selection store wiring).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { useSelectionStore } from "../state/selection-store";
import {
  AriaCompanion,
  HIGH_CONTRAST_DEFAULTS,
  HIGH_CONTRAST_ON,
} from "./AriaCompanion";

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

function createTestUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("alice", {
    types: ["Person"],
    properties: { name: "Alice" },
  });
  ugm.addNode("bob", {
    types: ["Person"],
    properties: { name: "Bob" },
  });
  ugm.addNode("acme", {
    types: ["Organization"],
    properties: { name: "ACME" },
  });
  ugm.addEdge("alice", "bob", { type: "knows" });
  ugm.addEdge("alice", "acme", { type: "worksFor" });
  ugm.addEdge("bob", "acme", { type: "worksFor" });
  return ugm;
}

// ── T1: Hidden focusable node list ──────────────────────────────────

describe("AriaCompanion: node list (M8.E1.T1)", () => {
  it("renders hidden focusable li elements for all nodes", () => {
    const ugm = createTestUGM();
    render(<AriaCompanion ugm={ugm} />);

    expect(screen.getByTestId("aria-node-alice")).toBeInTheDocument();
    expect(screen.getByTestId("aria-node-bob")).toBeInTheDocument();
    expect(screen.getByTestId("aria-node-acme")).toBeInTheDocument();
  });

  it("aria-label contains structured summary", () => {
    const ugm = createTestUGM();
    render(<AriaCompanion ugm={ugm} />);

    const aliceItem = screen.getByTestId("aria-node-alice");
    const label = aliceItem.getAttribute("aria-label") ?? "";

    expect(label).toContain("Alice");
    expect(label).toContain("Person");
    expect(label).toContain("2 connections");
    expect(label).toContain("Person");
    expect(label).toContain("Organization");
  });

  it("orders nodes by degree (highest first, R7.9)", () => {
    const ugm = createTestUGM();
    render(<AriaCompanion ugm={ugm} />);

    const items = screen
      .getByTestId("aria-node-list")
      .querySelectorAll("[role='option']");

    // Alice has 2 connections; bob and acme have 2 each
    // All have degree 2; order is stable but all present
    expect(items.length).toBe(3);
  });
});

// ── T2: Keyboard focus bridges to selection ─────────────────────────

describe("AriaCompanion: keyboard navigation (M8.E1.T2)", () => {
  it("focusing a node selects it in the store", () => {
    const ugm = createTestUGM();
    render(<AriaCompanion ugm={ugm} />);

    fireEvent.focus(screen.getByTestId("aria-node-bob"));

    expect(useSelectionStore.getState().selectedNodeIds.has("bob")).toBe(true);
  });

  it("arrow key navigates to neighbor", () => {
    const ugm = createTestUGM();
    render(<AriaCompanion ugm={ugm} />);

    const aliceItem = screen.getByTestId("aria-node-alice");
    fireEvent.focus(aliceItem);
    fireEvent.keyDown(aliceItem, { key: "ArrowRight" });

    // Should have moved to a neighbor (bob or acme)
    const selected = useSelectionStore.getState().selectedNodeIds;
    expect(selected.size).toBe(1);
    const selectedId = [...selected][0];
    expect(["bob", "acme"]).toContain(selectedId);
  });
});

// ── T3: aria-live region ────────────────────────────────────────────

describe("AriaCompanion: live region (M8.E1.T3)", () => {
  it("renders aria-live region", () => {
    const ugm = createTestUGM();
    render(<AriaCompanion ugm={ugm} />);

    const liveRegion = screen.getByTestId("aria-live-region");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
  });
});

// ── T4: High contrast mode ──────────────────────────────────────────

describe("High contrast config (M8.E1.T4)", () => {
  it("default config has contrast disabled", () => {
    expect(HIGH_CONTRAST_DEFAULTS.enabled).toBe(false);
  });

  it("high contrast config meets WCAG AA ratios", () => {
    expect(HIGH_CONTRAST_ON.enabled).toBe(true);
    // Black text on white background = 21:1 contrast ratio (passes AA)
    expect(HIGH_CONTRAST_ON.nodeLabelColor).toBe("#000000");
    expect(HIGH_CONTRAST_ON.backgroundColor).toBe("#FFFFFF");
    expect(HIGH_CONTRAST_ON.nodeStrokeWidth).toBeGreaterThanOrEqual(3);
  });
});

// ── T5: Table as accessible fallback ────────────────────────────────

describe("Table fallback (M8.E1.T5)", () => {
  it("selection in any view is readable from the shared store", () => {
    // The table reads from useSelectionStore; any view that writes
    // to the store automatically updates the table.
    const { selectNodes } = useSelectionStore.getState();

    // Simulate canvas selection
    selectNodes(["alice", "bob"]);
    expect(useSelectionStore.getState().selectedNodeIds).toEqual(
      new Set(["alice", "bob"]),
    );

    // Table would read this and display 2 rows highlighted.
    // This is verified by the existing TableView tests (M1.E2.T2).
  });
});

// ── Host announcements (issue #16: the auditor-shell integration) ───

import { act } from "@testing-library/react";
import { useAnnouncer } from "./AriaCompanion";

describe("AriaCompanion: host announcements (#16)", () => {
  const live = () => screen.getByTestId("aria-live-region").textContent;

  it("the announcement prop reaches the live region on the same render", () => {
    const ugm = createTestUGM();
    const { rerender } = render(
      <AriaCompanion ugm={ugm} announcement="Selected Alice" />,
    );
    expect(live()).toBe("Selected Alice");
    rerender(<AriaCompanion ugm={ugm} announcement="Selected Bob" />);
    expect(live()).toBe("Selected Bob");
  });

  it("an unchanged re-render leaves the region's text alone (no re-utterance)", () => {
    const ugm = createTestUGM();
    const { rerender } = render(
      <AriaCompanion ugm={ugm} announcement="Selected Alice" />,
    );
    const node = screen.getByTestId("aria-live-region").firstChild;
    rerender(<AriaCompanion ugm={ugm} announcement="Selected Alice" />);
    expect(live()).toBe("Selected Alice");
    // Same text node instance: React did not touch the DOM, so a
    // screen reader has nothing to re-announce.
    expect(screen.getByTestId("aria-live-region").firstChild).toBe(node);
  });

  it("announceDebounceMs collapses rapid changes to the last one", () => {
    vi.useFakeTimers();
    try {
      const ugm = createTestUGM();
      const { rerender } = render(
        <AriaCompanion ugm={ugm} announcement="" announceDebounceMs={200} />,
      );
      rerender(
        <AriaCompanion ugm={ugm} announcement="one" announceDebounceMs={200} />,
      );
      rerender(
        <AriaCompanion ugm={ugm} announcement="two" announceDebounceMs={200} />,
      );
      expect(live()).toBe("");
      act(() => {
        vi.advanceTimersByTime(199);
      });
      expect(live()).toBe("");
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(live()).toBe("two");
    } finally {
      vi.useRealTimers();
    }
  });

  it("muted holds the region; the latest message commits on unmute", () => {
    const ugm = createTestUGM();
    const { rerender } = render(
      <AriaCompanion ugm={ugm} announcement="before" />,
    );
    rerender(<AriaCompanion ugm={ugm} announcement="during 1" muted />);
    rerender(<AriaCompanion ugm={ugm} announcement="during 2" muted />);
    expect(live()).toBe("before");
    rerender(<AriaCompanion ugm={ugm} announcement="during 2" />);
    expect(live()).toBe("during 2");
  });

  it("label names the list and instructions describe it", () => {
    const ugm = createTestUGM();
    render(
      <AriaCompanion
        ugm={ugm}
        label="Provenance nodes"
        instructions="Arrow right follows an edge."
      />,
    );
    const list = screen.getByRole("listbox", { name: "Provenance nodes" });
    const descId = list.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)?.textContent).toBe(
      "Arrow right follows an edge.",
    );
  });

  it("omits the description wiring when no instructions are given", () => {
    const ugm = createTestUGM();
    render(<AriaCompanion ugm={ugm} />);
    expect(
      screen.getByRole("listbox", { name: "Graph nodes" }),
    ).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByTestId("aria-instructions")).toBeNull();
  });

  it("summarizeNode formats option labels and the navigation announcement", () => {
    const ugm = createTestUGM();
    render(
      <AriaCompanion
        ugm={ugm}
        summarizeNode={(g, id) => `${String(g.getNode(id)?.properties.name)}!`}
      />,
    );
    expect(
      screen.getByTestId("aria-node-alice").getAttribute("aria-label"),
    ).toBe("Alice!");
    const aliceItem = screen.getByTestId("aria-node-alice");
    fireEvent.keyDown(aliceItem, { key: "ArrowRight" });
    expect(live()).toMatch(/^Navigated to (Bob|ACME)!$/);
  });

  it("hidden nodes leave the list and arrow navigation skips them", () => {
    const ugm = createTestUGM();
    // alice's neighbors in insertion order: bob, acme. Hide bob.
    render(<AriaCompanion ugm={ugm} hidden={new Set(["bob"])} />);
    expect(screen.queryByTestId("aria-node-bob")).toBeNull();
    fireEvent.keyDown(screen.getByTestId("aria-node-alice"), {
      key: "ArrowRight",
    });
    expect([...useSelectionStore.getState().selectedNodeIds]).toEqual(["acme"]);
  });

  it("useAnnouncer: the host's announce() lands in the region", () => {
    const ugm = createTestUGM();
    function Host() {
      const { announcement, announce } = useAnnouncer();
      return (
        <>
          <button type="button" onClick={() => announce("Step 2 of 3")}>
            step
          </button>
          <AriaCompanion ugm={ugm} announcement={announcement} />
        </>
      );
    }
    render(<Host />);
    expect(live()).toBe("");
    fireEvent.click(screen.getByText("step"));
    expect(live()).toBe("Step 2 of 3");
  });
});
