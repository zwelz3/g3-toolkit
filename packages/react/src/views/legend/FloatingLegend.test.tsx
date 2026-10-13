/**
 * FloatingLegend prop forwarding.
 *
 * Until 2026-08-27 this component passed `collapsible` as a bare
 * literal and forwarded no `defaultCollapsed`, so a floating legend
 * could not start collapsed even though SpecLegend supports it. At up
 * to 240px wide over a canvas that is a real cost, and the only
 * workaround was to drop FloatingLegend and place a SpecLegend by
 * hand. These tests pin the forwarding.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { FloatingLegend } from "./FloatingLegend";
import { DEFAULT_SPEC } from "../../interaction/encoding/encoding-spec";

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["Asset"], properties: { name: "Pump" } });
  ugm.addNode("b", { types: ["Sensor"], properties: { name: "Flow" } });
  return ugm;
}

const spec = DEFAULT_SPEC;

describe("FloatingLegend collapse forwarding", () => {
  it("renders collapsible and expanded by default", () => {
    render(<FloatingLegend ugm={graph()} spec={spec} />);
    expect(screen.getByTestId("g3t-floating-legend")).toBeInTheDocument();
    expect(screen.getByTestId("legend-collapse-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getAllByText(/Asset/).length).toBeGreaterThan(0);
  });

  it("starts collapsed when asked", () => {
    render(<FloatingLegend ugm={graph()} spec={spec} defaultCollapsed />);
    // The card and its toggle still mount; the legend body does not.
    expect(screen.getByTestId("g3t-floating-legend")).toBeInTheDocument();
    expect(screen.getByTestId("legend-collapse-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryAllByText(/Asset/)).toHaveLength(0);
  });

  it("can drop the collapse affordance entirely", () => {
    render(<FloatingLegend ugm={graph()} spec={spec} collapsible={false} />);
    // Non-collapsible means always open, with no toggle to close it.
    expect(
      screen.queryByTestId("legend-collapse-toggle"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/Asset/).length).toBeGreaterThan(0);
  });
});

describe("FloatingLegend forwards the #38 wording props", () => {
  it("passes sectionTitle and the channel-aware labelFor through", () => {
    const ugm = graph();
    ugm.addEdge("a", "b", { type: "feeds" });
    const sectionTitle = vi.fn((channel: string) =>
      channel === "edge.color" ? "Relation" : "Node type",
    );
    const labelFor = vi.fn((value: string, channel: string) =>
      channel === "edge.color" ? value.toUpperCase() : value,
    );
    render(
      <FloatingLegend
        ugm={ugm}
        spec={{
          version: 1,
          node: {
            color: {
              driver: "types",
              scale: { kind: "categorical", palette: "okabe-ito" },
            },
          },
          edge: {
            color: {
              driver: "type",
              scale: { kind: "categorical", palette: "okabe-ito" },
            },
          },
        }}
        sectionTitle={sectionTitle}
        labelFor={labelFor}
      />,
    );
    const titles = Array.from(
      document.querySelectorAll(".g3t-legend-title"),
    ).map((el) => el.textContent);
    expect(titles).toContain("Node type");
    expect(titles).toContain("Relation");
    expect(screen.getByTestId("legend-edge-color-feeds").textContent).toContain(
      "FEEDS",
    );
    expect(labelFor).toHaveBeenCalledWith("Asset", "node.color");
    expect(sectionTitle).toHaveBeenCalledWith("edge.color", "type");
  });
});
