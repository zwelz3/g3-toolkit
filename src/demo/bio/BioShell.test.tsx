/**
 * BioShell contract test. CytoscapeCanvas is stubbed; everything else is
 * real (the curated SPARQL executor, the ontology explorer, the
 * dependency-free chart). Asserted headlessly: the default query renders
 * bindings at mount, editing to an invalid query surfaces the structured
 * error (not a crash), re-running a valid query recovers, and the
 * production-engine notice plus capability callout carry the adoption
 * narrative.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { UGM } from "@g3t/core";

const canvasCalls = vi.hoisted(() => ({
  nodeCounts: [] as number[],
  stylesheets: [] as unknown[],
  routeRefreshSignal: [] as Array<number | undefined>,
  relayoutSignal: [] as Array<number | undefined>,
  edgeClickIsolate: [] as Array<boolean | undefined>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      stylesheet?: unknown;
      routeRefreshSignal?: number;
      relayoutSignal?: number;
      edgeClickIsolate?: boolean;
    }) => {
      canvasCalls.nodeCounts.push(props.ugm.getNodeIds().length);
      canvasCalls.stylesheets.push(props.stylesheet);
      canvasCalls.routeRefreshSignal.push(props.routeRefreshSignal);
      canvasCalls.relayoutSignal.push(props.relayoutSignal);
      canvasCalls.edgeClickIsolate.push(props.edgeClickIsolate);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { BioShell } from "./BioShell";
import { useSelectionStore } from "@g3t/react";

afterEach(() => {
  useSelectionStore.getState().selectNodes([]);
  cleanup();
  canvasCalls.routeRefreshSignal.length = 0;
  canvasCalls.relayoutSignal.length = 0;
  canvasCalls.edgeClickIsolate.length = 0;
});

describe("BioShell SPARQL workbench", () => {
  it("runs the first default query at mount and renders bindings", () => {
    const { container } = render(<BioShell onBack={() => {}} />);
    const table = container.querySelector("table.bio-results");
    expect(table).not.toBeNull();
    expect(table?.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });

  it("surfaces a structured error for an invalid query and recovers on a valid one", () => {
    const { container } = render(<BioShell onBack={() => {}} />);
    const editor = container.querySelector("textarea.bio-editor");
    expect(editor).not.toBeNull();
    const valid = (editor as HTMLTextAreaElement).value;

    fireEvent.change(editor as HTMLTextAreaElement, {
      target: { value: "SELECT WHERE {" },
    });
    // 9.28: edits auto-run; the Run button is removed.
    expect(container.textContent).toContain("Query error:");
    expect(container.querySelector("table.bio-results")).toBeNull();

    fireEvent.change(editor as HTMLTextAreaElement, {
      target: { value: valid },
    });
    expect(container.textContent).not.toContain("Query error:");
    expect(container.querySelector("table.bio-results")).not.toBeNull();
  });

  it("swaps the canvas to the raw triple view and back (projection story)", () => {
    render(<BioShell onBack={() => {}} />);
    const projectedCount = canvasCalls.nodeCounts.at(-1);
    expect(screen.getByTestId("bio-view-caption").textContent).toContain(
      "standard projection",
    );
    fireEvent.click(screen.getByRole("button", { name: "Raw triples" }));
    const rawCount = canvasCalls.nodeCounts.at(-1);
    expect(screen.getByTestId("bio-view-caption").textContent).toContain(
      "every triple an edge",
    );
    // The raw view is strictly larger: literals and rdf:type are nodes.
    expect(rawCount ?? 0).toBeGreaterThan(projectedCount ?? 0);
    fireEvent.click(screen.getByRole("button", { name: "Projected" }));
    expect(canvasCalls.nodeCounts.at(-1)).toBe(projectedCount);
  });

  it("wraps labels by default and the switch toggles the wrap rule off", () => {
    render(<BioShell onBack={() => {}} />);
    const last = () =>
      canvasCalls.stylesheets.at(-1) as
        | { selector: string; style: Record<string, string> }[]
        | undefined;
    // Default ON: one node[label]-scoped wrap rule (restyle channel).
    const rules = last();
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.selector).toBe("node[label]");
    expect(rules?.[0]?.style["text-wrap"]).toBe("wrap");
    const toggle = screen.getByTestId("bio-wrap-toggle");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    // OFF must actually disable wrap (text-wrap: none), not merely
    // fall back to the canvas base rule's default 110px wrap.
    fireEvent.click(toggle);
    expect(last()?.[0]?.style["text-wrap"]).toBe("none");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(last()?.[0]?.style["text-wrap"]).toBe("wrap");
  });

  it("carries the production-engine notice and the capability callout", () => {
    const { container } = render(<BioShell onBack={() => {}} />);
    expect(container.textContent).toContain("curated in-browser executor");
    fireEvent.click(screen.getByTestId("capability-bubble"));
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "rdfToUgm",
    );
  });

  it("refresh-routes / re-layout buttons bump their signal props; edge isolate is on", () => {
    render(<BioShell onBack={() => {}} />);
    const startRoute = canvasCalls.routeRefreshSignal.at(-1) ?? 0;
    const startRelayout = canvasCalls.relayoutSignal.at(-1) ?? 0;
    expect(canvasCalls.edgeClickIsolate.at(-1)).toBe(true);
    fireEvent.click(screen.getByTestId("bio-refresh-routes"));
    expect(canvasCalls.routeRefreshSignal.at(-1)).toBe(startRoute + 1);
    fireEvent.click(screen.getByTestId("bio-relayout"));
    expect(canvasCalls.relayoutSignal.at(-1)).toBe(startRelayout + 1);
  });
});
