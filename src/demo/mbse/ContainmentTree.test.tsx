import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContainmentTree } from "./ContainmentTree";
import { satelliteModel } from "./model";

describe("ContainmentTree", () => {
  it("renders packages, elements, and diagram rows from the model", () => {
    render(
      <ContainmentTree
        model={satelliteModel}
        activeDiagramId={null}
        onOpenDiagram={() => {}}
      />,
    );
    expect(screen.getByText("Satellite System")).toBeTruthy();
    expect(screen.getByText("Structure")).toBeTruthy();
    expect(screen.getByText("PowerSubsystem")).toBeTruthy();
    expect(screen.getByText("SmallSat Structure")).toBeTruthy();
    // diagram type badges are present
    expect(screen.getAllByText("BDD").length).toBeGreaterThan(0);
    expect(screen.getByText("IBD")).toBeTruthy();
    expect(screen.getByText("PAR")).toBeTruthy();
  });

  it("invokes onOpenDiagram with the diagram id when a diagram row is clicked", () => {
    const onOpen = vi.fn();
    render(
      <ContainmentTree
        model={satelliteModel}
        activeDiagramId={null}
        onOpenDiagram={onOpen}
      />,
    );
    fireEvent.click(screen.getByText("Power Budget"));
    expect(onOpen).toHaveBeenCalledWith("dg.par");
  });

  it("marks the active diagram row", () => {
    const { container } = render(
      <ContainmentTree
        model={satelliteModel}
        activeDiagramId="dg.ibd"
        onOpenDiagram={() => {}}
      />,
    );
    const active = container.querySelector(".mbse-tree-diagram.is-active");
    expect(active?.textContent).toContain("SmallSat Internal");
  });

  it("collapses a package when its row is toggled", () => {
    const { container } = render(
      <ContainmentTree
        model={satelliteModel}
        activeDiagramId={null}
        onOpenDiagram={() => {}}
      />,
    );
    // "Mission" (a requirement element) is visible while its package is open
    expect(screen.getByText("Mission")).toBeTruthy();
    // find the Requirements PACKAGE row (not the same-named diagram) and collapse it
    const pkgRow = Array.from(
      container.querySelectorAll("button.mbse-tree-pkg"),
    ).find((el) => el.textContent?.includes("Requirements"));
    expect(pkgRow).toBeTruthy();
    if (pkgRow) fireEvent.click(pkgRow);
    expect(screen.queryByText("Mission")).toBeNull();
  });
});
