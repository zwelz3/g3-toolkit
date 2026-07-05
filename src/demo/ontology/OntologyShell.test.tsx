/**
 * OntologyShell contract test (canvas stubbed per the demo-shell
 * convention). Pins: the browser rails render the seeded ontology,
 * the details rail hides inferred axioms until the toggle enables
 * them, SPARQL presets execute over the store's graph, and the SHACL
 * view hands a laid-out structural graph (real ELK, async) plus
 * closed/severity decorations to the canvas.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import type { UGM, StructuralGraphInput, StructuralGeometry } from "@g3t/core";

const captured = vi.hoisted(() => ({
  counts: [] as number[],
  structurals: [] as Array<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  }>,
  decorations: [] as Array<{
    closedContainers?: Set<string>;
    rowSeverities?: Map<string, string>;
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
      structuralDecorations?: {
        closedContainers?: Set<string>;
        rowSeverities?: Map<string, string>;
      };
    }) => {
      captured.counts.push(props.ugm.getNodeIds().length);
      if (props.structural) captured.structurals.push(props.structural);
      if (props.structuralDecorations)
        captured.decorations.push(props.structuralDecorations);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { OntologyShell } from "./OntologyShell";
import { useSelectionStore } from "@g3t/react";

afterEach(() => {
  // OntologyShell subscribes to the selection store directly, so the
  // store must be reset AFTER unmount or the reset re-renders the
  // still-mounted shell outside act().
  cleanup();
  useSelectionStore.getState().selectNodes([]);
});

describe("OntologyShell", () => {
  it("renders the class tree with Artifact as a root and all view tabs", () => {
    render(<OntologyShell onBack={() => undefined} />);
    expect(screen.getByTestId("ow-class-tree")).toBeTruthy();
    expect(screen.getByTestId("ow-entity-ex:Artifact")).toBeTruthy();
    for (const t of [
      "hierarchy",
      "neighborhood",
      "instances",
      "shapes",
      "sparql",
    ]) {
      expect(screen.getByTestId(`ow-view-${t}`)).toBeTruthy();
    }
    // The hierarchy canvas received the class graph, not an empty UGM.
    expect(captured.counts.some((c) => c >= 22)).toBe(true);
  });

  it("hides inferred axioms until the toggle enables them, then chips them", () => {
    render(<OntologyShell onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("ow-tab-individuals"));
    fireEvent.click(screen.getByTestId("ow-entity-ex:aquila2"));

    const assertedTexts = screen
      .getAllByTestId("ow-axiom")
      .map((el) => el.textContent ?? "");
    expect(assertedTexts.some((t) => t.includes("a ex:Satellite"))).toBe(true);
    expect(assertedTexts.some((t) => t.includes("a ex:Spacecraft"))).toBe(
      false,
    );

    fireEvent.click(screen.getByTestId("ow-inference-toggle"));
    const withInferred = screen.getAllByTestId("ow-axiom");
    const spacecraft = withInferred.find((el) =>
      (el.textContent ?? "").includes("a ex:Spacecraft"),
    );
    expect(spacecraft).toBeTruthy();
    expect(spacecraft?.getAttribute("data-inferred")).toBe("true");
    expect(screen.getAllByTestId("ow-inferred-chip").length).toBeGreaterThan(0);
  });

  it("runs SPARQL presets over the graph and renders bindings", () => {
    render(<OntologyShell onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("ow-view-sparql"));
    fireEvent.click(screen.getByTestId("ow-run-sparql"));
    const rows = screen.getAllByTestId("ow-sparql-row");
    // The default preset selects all owl:Class declarations.
    expect(rows.length).toBeGreaterThanOrEqual(22);
  });

  it("hands the laid-out SHACL structural graph and decorations to the canvas", async () => {
    render(<OntologyShell onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("ow-view-shapes"));
    await waitFor(
      () => {
        expect(captured.structurals.length).toBeGreaterThan(0);
      },
      { timeout: 10000 },
    );
    const s = captured.structurals[0];
    expect(s?.input.nodes.map((n) => n.id)).toContain(
      "http://example.org/sat#SatelliteShape",
    );
    expect(s?.geometry).toBeTruthy();
    const d = captured.decorations.find(
      (x) => x.closedContainers !== undefined,
    );
    expect(
      d?.closedContainers?.has("http://example.org/sat#GroundStationShape"),
    ).toBe(true);
    expect(screen.getByTestId("ow-shacl-note")).toBeTruthy();
  });
});
