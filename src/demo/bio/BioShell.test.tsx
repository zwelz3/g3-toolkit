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

const canvasCalls = vi.hoisted(() => ({ nodeCounts: [] as number[] }));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: { ugm: UGM }) => {
      canvasCalls.nodeCounts.push(props.ugm.getNodeIds().length);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { BioShell } from "./BioShell";
import { useSelectionStore } from "@g3t/react";

afterEach(() => {
  useSelectionStore.getState().selectNodes([]);
  cleanup();
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
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
    expect(container.textContent).toContain("Query error:");
    expect(container.querySelector("table.bio-results")).toBeNull();

    fireEvent.change(editor as HTMLTextAreaElement, {
      target: { value: valid },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
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

  it("carries the production-engine notice and the capability callout", () => {
    const { container } = render(<BioShell onBack={() => {}} />);
    expect(container.textContent).toContain("curated in-browser executor");
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "rdfToUgm",
    );
  });
});
