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
  layouts: [] as Array<string | undefined>,
  pieCounts: [] as number[],
  structurals: [] as Array<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  }>,
  decorations: [] as Array<{
    closedContainers?: Set<string>;
    rowSeverities?: Map<string, string>;
  }>,
  domains: [] as string[][],
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      ugm: UGM;
      layout?: string;
      structural?: {
        input: StructuralGraphInput;
        geometry: StructuralGeometry;
      };
      structuralDecorations?: {
        closedContainers?: Set<string>;
        rowSeverities?: Map<string, string>;
      };
      encodingSpec?: {
        node: {
          color?: { scale: { kind: string; domain?: string[] } };
        };
      };
    }) => {
      captured.counts.push(props.ugm.getNodeIds().length);
      captured.layouts.push(props.layout);
      let pies = 0;
      props.ugm.forEachNode((_id, attrs) => {
        if (attrs.properties._pie1Color !== undefined) pies += 1;
      });
      captured.pieCounts.push(pies);
      if (props.structural) captured.structurals.push(props.structural);
      if (props.structuralDecorations)
        captured.decorations.push(props.structuralDecorations);
      if (props.encodingSpec?.node.color?.scale.domain)
        captured.domains.push(props.encodingSpec.node.color.scale.domain);
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
    // Graph chrome (review 4.1): the toolbar mounts on graph views.
    expect(screen.getByTestId("g3t-graph-toolbar")).toBeTruthy();
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

  it("runs SPARQL presets and renders bindings via the toolkit grid (5.19)", () => {
    render(<OntologyShell onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("ow-view-sparql"));
    fireEvent.click(screen.getByTestId("ow-run-sparql"));
    const grid = screen.getByTestId("ow-sparql-grid");
    // The default preset selects all owl:Class declarations (22 in
    // the seed); 9.28 sets 20-row pages, so page one shows exactly 20
    // and pagination carries the rest.
    const rows = grid.querySelectorAll("[data-testid^='table-row-']");
    expect(rows.length).toBe(20);
    // Adapter rows are inert: clicking one must not write ordinal ids
    // into the shared selection store (a live canvas renders it).
    fireEvent.click(rows[0] as HTMLElement);
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
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

    // The delta panel (4.5) explains the toggle regardless of its
    // position: aquila2's hasSubsystem violation resolves under
    // inference; gsAlpha's callSign violation is introduced by it.
    const delta = screen.getByTestId("ow-validation-delta").textContent ?? "";
    expect(delta).toContain("Aquila-2");
    expect(delta).toContain("RESOLVED");
    expect(delta).toContain("GS Alpha");
    expect(delta).toContain("INTRODUCED");
  });

  it("gives instance views one stable color domain plus a shortened-label legend (4.4/4.3)", () => {
    render(<OntologyShell onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("ow-view-instances"));
    const first = captured.domains.at(-1);
    expect(first).toBeDefined();
    expect(first).toContain("http://example.org/sat#Satellite");
    expect(screen.getByTestId("g3t-spec-legend")).toBeTruthy();
    expect(
      screen.getByTestId("legend-color-http://example.org/sat#Satellite")
        .textContent,
    ).toContain("ex:Satellite");

    // The neighborhood view over a different projection carries the
    // SAME domain: colors cannot reshuffle between views.
    fireEvent.click(screen.getByTestId("ow-tab-individuals"));
    fireEvent.click(screen.getByTestId("ow-entity-ex:aquila1"));
    fireEvent.click(screen.getByTestId("ow-view-neighborhood"));
    const second = captured.domains.at(-1);
    expect(second).toEqual(first);
  });

  it("hierarchy layout switches to fcose under inference (5.17)", () => {
    render(<OntologyShell onBack={() => {}} />);
    expect(captured.layouts.at(-1)).toBe("breadthfirst");
    fireEvent.click(screen.getByTestId("ow-inference-toggle"));
    expect(captured.layouts.at(-1)).toBe("fcose");
  });

  it("inferred multi-type instances carry split-ring pie data (5.21)", () => {
    render(<OntologyShell onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("ow-inference-toggle"));
    fireEvent.click(screen.getByText("Instances"));
    // The seed with inference materializes 17 multi-type individuals
    // (subclass and equivalence entailment); at least SOME must reach
    // the canvas with stamped slices, or the ring is silently inert.
    expect(captured.pieCounts.at(-1)).toBeGreaterThan(0);
  });

  it("the grid declares an explicit row template (5.16 regression guard)", () => {
    render(<OntologyShell onBack={() => {}} />);
    // jsdom does no layout, so the viewport-fill bug itself is
    // browser-only; this guards the FIX (the explicit row template)
    // against being refactored away.
    expect(screen.getByTestId("ow-grid").style.gridTemplateRows).toContain(
      "minmax(0, 1fr)",
    );
    // 12.3: the frame's children wrapper must BE a flex container or
    // the grid's flex:1 is inert and height falls back to content
    // (the reviewed 60% fill).
    expect(screen.getByTestId("ow-grid").parentElement?.style.display).toBe(
      "flex",
    );
  });

  it("the right rail is sectioned: entity card always, SHACL card on the shapes tab (5.20)", () => {
    render(<OntologyShell onBack={() => {}} />);
    expect(screen.getByTestId("ow-rail-entity")).toBeDefined();
    expect(screen.queryByTestId("ow-rail-shacl")).toBeNull();
    fireEvent.click(screen.getByText("SHACL shapes"));
    expect(screen.getByTestId("ow-rail-shacl")).toBeDefined();
  });

  it("the entity dock persists across tabs, collapses, and selects on row click (5.18)", () => {
    render(<OntologyShell onBack={() => undefined} />);
    // Visible on the default (hierarchy) tab, not only on instances;
    // 9.28: starts COLLAPSED (header only), expand is explicit.
    const dock = screen.getByTestId("ow-entity-dock");
    expect(dock).toBeDefined();
    expect(dock.querySelector("[data-testid^='table-row-']")).toBeNull();
    fireEvent.click(screen.getByTestId("ow-dock-toggle"));
    const row = dock.querySelector("[data-testid^='table-row-']");
    expect(row).not.toBeNull();
    fireEvent.click(row as HTMLElement);
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(1);
    // Collapse hides the grid, keeps the header.
    fireEvent.click(screen.getByTestId("ow-dock-toggle"));
    expect(dock.querySelector("[data-testid^='table-row-']")).toBeNull();
  });
});
