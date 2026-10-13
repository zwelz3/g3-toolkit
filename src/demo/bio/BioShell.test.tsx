/**
 * BioShell contract test. CytoscapeCanvas is stubbed; everything else is
 * real (the curated SPARQL executor, the ontology explorer, the
 * dependency-free chart). Asserted headlessly: the default query renders
 * bindings at mount, editing to an invalid query surfaces the structured
 * error (not a crash), re-running a valid query recovers, and the
 * production-engine notice plus capability callout carry the adoption
 * narrative. The two canvas review opt-ins are pinned on the stub's
 * props: the Labels control switches `labelCollision` on the SAME
 * scene, and the Explore view grows the drawn ugm as a superset with
 * stable edge ids under `graphUpdate="additive"`, with Reset returning
 * to the seed.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import type { UGM } from "@g3-toolkit/core";

interface CanvasCall {
  nodeIds: string[];
  edgeIds: string[];
  labelCollision: string | undefined;
  graphUpdate: string | undefined;
}
const canvasCalls = vi.hoisted(() => ({
  nodeCounts: [] as number[],
  props: [] as CanvasCall[],
}));
const lastCall = (): CanvasCall => {
  const c = canvasCalls.props.at(-1);
  if (!c) throw new Error("canvas never rendered");
  return c;
};

vi.mock("@g3-toolkit/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3-toolkit/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      labelCollision?: string;
      graphUpdate?: string;
    }) => {
      canvasCalls.nodeCounts.push(props.ugm.getNodeIds().length);
      const edgeIds: string[] = [];
      props.ugm.forEachEdge((id) => edgeIds.push(id));
      canvasCalls.props.push({
        nodeIds: props.ugm.getNodeIds(),
        edgeIds,
        labelCollision: props.labelCollision,
        graphUpdate: props.graphUpdate,
      });
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { BioShell } from "./BioShell";
import { useSelectionStore } from "@g3-toolkit/react";
import { EX } from "./rdf";

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

  it("carries the production-engine notice and the capability callout", () => {
    const { container } = render(<BioShell onBack={() => {}} />);
    expect(container.textContent).toContain("curated in-browser executor");
    fireEvent.click(screen.getByTestId("capability-bubble"));
    const callout = screen.getByTestId("capability-callout").textContent;
    expect(callout).toContain("rdfToUgm");
    // The two review opt-ins name their mechanism and guide anchor.
    expect(callout).toContain("labelCollision");
    expect(callout).toContain('graphUpdate="additive"');
  });
});

describe("BioShell canvas review opt-ins", () => {
  it("defaults labelCollision to shorten; the Labels control switches the prop on the same scene", () => {
    render(<BioShell onBack={() => {}} />);
    const before = lastCall();
    expect(before.labelCollision).toBe("shorten");
    const labels = screen.getByRole("group", { name: "Labels" });
    const btn = (name: string) =>
      Array.from(labels.querySelectorAll("button")).find(
        (b) => b.textContent === name,
      ) as HTMLButtonElement;
    fireEvent.click(btn("All"));
    expect(lastCall().labelCollision).toBe("none");
    fireEvent.click(btn("Hide"));
    expect(lastCall().labelCollision).toBe("hide");
    fireEvent.click(btn("Shorten"));
    expect(lastCall().labelCollision).toBe("shorten");
    // A restyle pass: the ugm handed to the canvas is the same scene.
    expect(lastCall().nodeIds).toEqual(before.nodeIds);
    expect(btn("Shorten").className).toContain("active");
  });

  it("the Explore view grows the drawn ugm as a superset with stable edge ids under additive updates, and Reset returns to the seed", () => {
    render(<BioShell onBack={() => {}} />);
    // Projected and raw stay on the rebuild path.
    expect(lastCall().graphUpdate).toBe("rebuild");
    fireEvent.click(screen.getByRole("button", { name: "Explore" }));
    const seed = lastCall();
    expect(seed.graphUpdate).toBe("additive");
    expect(seed.nodeIds).toEqual([
      EX + "BreastCancer",
      EX + "LungCancer",
      EX + "Alzheimer",
    ]);
    expect(seed.edgeIds).toEqual([]);
    expect(screen.getByTestId("bio-view-caption").textContent).toContain(
      "3 of",
    );
    const expand = screen.getByRole("button", {
      name: "Expand selected",
    }) as HTMLButtonElement;
    const reset = screen.getByRole("button", {
      name: "Reset",
    }) as HTMLButtonElement;
    // Nothing selected: Expand has nothing to add; the seed is drawn.
    expect(expand.disabled).toBe(true);
    expect(reset.disabled).toBe(true);

    act(() => {
      useSelectionStore.getState().selectNodes([EX + "BreastCancer"]);
    });
    expect(expand.disabled).toBe(false);
    fireEvent.click(expand);
    const step1 = lastCall();
    expect(step1.graphUpdate).toBe("additive");
    for (const id of seed.nodeIds) expect(step1.nodeIds).toContain(id);
    expect(step1.nodeIds.length).toBe(seed.nodeIds.length + 3);
    expect(step1.edgeIds.length).toBeGreaterThan(0);
    // The same node again adds nothing: Expand disables rather than
    // handing the canvas an identical ugm under a new identity.
    expect(expand.disabled).toBe(true);

    act(() => {
      useSelectionStore.getState().selectNodes([EX + "TP53"]);
    });
    fireEvent.click(expand);
    const step2 = lastCall();
    for (const id of step1.nodeIds) expect(step2.nodeIds).toContain(id);
    expect(step2.nodeIds.length).toBeGreaterThan(step1.nodeIds.length);
    // Stable edge ids: every edge drawn in step 1 keeps its id in step 2.
    for (const id of step1.edgeIds) expect(step2.edgeIds).toContain(id);
    expect(step2.edgeIds.length).toBeGreaterThan(step1.edgeIds.length);
    expect(screen.getByTestId("bio-view-caption").textContent).toContain(
      `${step2.nodeIds.length} of`,
    );

    fireEvent.click(reset);
    expect(lastCall().nodeIds).toEqual(seed.nodeIds);
    expect(reset.disabled).toBe(true);

    // Leaving Explore hands the canvas the full projection on the
    // rebuild path again.
    fireEvent.click(screen.getByRole("button", { name: "Projected" }));
    expect(lastCall().graphUpdate).toBe("rebuild");
    expect(lastCall().nodeIds.length).toBeGreaterThan(step2.nodeIds.length);
  });
});
