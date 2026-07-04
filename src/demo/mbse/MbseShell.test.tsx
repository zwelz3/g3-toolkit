/**
 * MbseShell contract test. CytoscapeCanvas is replaced by a stub that
 * records its props, so the shell's side of the canvas contract is
 * asserted headlessly: which structural scene reaches the canvas, and
 * that a diagram switch shows the loading state (a stale scene is never
 * rendered) until the real ELK layout for the NEW diagram resolves.
 * layoutStructural itself runs for real (elkjs is headless-safe; see
 * diagrams.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import type { StructuralGraphInput, StructuralGeometry, UGM } from "@g3t/core";

const captured = vi.hoisted(() => ({
  scenes: [] as Array<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  }>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      structural?: {
        input: StructuralGraphInput;
        geometry: StructuralGeometry;
      };
    }) => {
      if (props.structural) captured.scenes.push(props.structural);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { MbseShell } from "./MbseShell";
import { satelliteModel } from "./model";
import { projectDiagram } from "./diagrams";

beforeEach(() => {
  captured.scenes.length = 0;
});
afterEach(cleanup);

describe("MbseShell canvas contract", () => {
  it("shows the loading state, then hands the BDD projection's layout to the canvas", async () => {
    render(<MbseShell onBack={() => {}} />);
    // Before the async layout resolves the canvas must not mount.
    expect(screen.queryByTestId("canvas-stub")).toBeNull();
    expect(screen.getByText(/Laying out/)).toBeDefined();

    await waitFor(
      () => expect(screen.getByTestId("canvas-stub")).toBeDefined(),
      {
        timeout: 5000,
      },
    );
    const last = captured.scenes.at(-1);
    expect(last).toBeDefined();
    // The scene's input is exactly the pure projection of the default diagram.
    expect(last?.input).toEqual(projectDiagram(satelliteModel, "dg.bdd"));
    expect(Object.keys(last?.geometry.nodes ?? {}).length).toBeGreaterThan(0);
  });

  it("never renders a stale scene across a diagram switch (loading until the new layout lands)", async () => {
    render(<MbseShell onBack={() => {}} />);
    await waitFor(
      () => expect(screen.getByTestId("canvas-stub")).toBeDefined(),
      {
        timeout: 5000,
      },
    );

    fireEvent.click(screen.getByText("SmallSat Internal")); // dg.ibd
    // Synchronously after the switch: the derived stale-scene guard must
    // read as loading (the old BDD scene must not stay on the canvas).
    expect(screen.queryByTestId("canvas-stub")).toBeNull();
    expect(screen.getByText(/Laying out/)).toBeDefined();

    await waitFor(
      () => expect(screen.getByTestId("canvas-stub")).toBeDefined(),
      {
        timeout: 5000,
      },
    );
    expect(captured.scenes.at(-1)?.input).toEqual(
      projectDiagram(satelliteModel, "dg.ibd"),
    );
  });

  it("carries the capability callout in the inspector", async () => {
    render(<MbseShell onBack={() => {}} />);
    expect(screen.getByTestId("capability-callout").textContent).toContain(
      "layoutStructural",
    );
  });
});
