/**
 * B3 density variants (design-system roadmap): compact reduces row
 * and header padding for thin-client analyst deployments.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { TableView } from "./TableView";

function smallGraph(): UGM {
  const ugm = new UGM();
  ugm.addNode("d1", { types: ["T"], properties: { label: "Row one" } });
  return ugm;
}

describe("TableView density (B3)", () => {
  it("defaults to comfortable padding", () => {
    render(<TableView ugm={smallGraph()} />);
    const cell = screen
      .getByTestId("table-row-d1")
      .querySelector("td") as HTMLElement;
    expect(cell.style.padding).toBe("4px 8px");
  });

  it("compact reduces cell padding", () => {
    render(<TableView ugm={smallGraph()} density="compact" />);
    const cell = screen
      .getByTestId("table-row-d1")
      .querySelector("td") as HTMLElement;
    expect(cell.style.padding).toBe("2px 6px");
  });
});
