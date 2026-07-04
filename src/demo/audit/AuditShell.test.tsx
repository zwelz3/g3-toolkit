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
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: { ugm: UGM; hidden?: ReadonlySet<string> }) => {
      captured.hidden.push(props.hidden);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { AuditShell } from "./AuditShell";
import { buildProvenance } from "./model";
import { provenanceEvents, timeBounds, hiddenForRange } from "./timeline";
import { useSelectionStore } from "@g3t/react";

beforeEach(() => {
  captured.hidden.length = 0;
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
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "hidden prop",
    );
  });

  it("renders the lineage trace for the selected node, absence hop included", () => {
    render(<AuditShell onBack={() => {}} />);
    expect(screen.queryByTestId("g3t-provenance-trace")).toBeNull();
    act(() => {
      useSelectionStore.getState().selectNodes(["ent:legacy"]);
    });
    const trace = screen.getByTestId("g3t-provenance-trace");
    expect(trace.textContent).toContain("Lineage of selection");
    expect(trace.textContent).toContain("No attribution recorded");
  });
});
