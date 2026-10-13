import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { SpecLegend } from "./SpecLegend";
import type { EncodingSpec } from "./encoding-spec";
import { applyEncodingSpec } from "./spec-apply";
import { CANVAS_CATEGORICAL } from "./palette-bridge";

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", { types: ["Person"], properties: { pagerank: 0.1 } });
  ugm.addNode("o1", { types: ["Org"], properties: { pagerank: 0.9 } });
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: { weight: 3 } });
  return ugm;
}

const SPEC: EncodingSpec = {
  version: 1,
  node: {
    color: {
      driver: "types",
      scale: {
        kind: "categorical",
        palette: "okabe-ito",
        overrides: { Person: "#7a0bc0" },
      },
    },
    size: {
      driver: "pagerank",
      scale: { kind: "sequential", domain: [0, 0.2], range: [14, 34] },
    },
    icon: {
      driver: "types",
      scale: { kind: "categorical", overrides: { Org: "layers" } },
    },
  },
  edge: {
    width: {
      driver: "weight",
      scale: { kind: "sequential", domain: "auto", range: [1, 6] },
    },
  },
};

describe("SpecLegend", () => {
  it("mirrors the spec through the shared resolvers", () => {
    render(<SpecLegend ugm={graph()} spec={SPEC} />);
    const person = screen.getByTestId("legend-color-Person");
    const personSwatch = person.querySelector(
      ".g3t-legend-swatch",
    ) as HTMLElement;
    expect(personSwatch.style.background).toBe("rgb(122, 11, 192)");
    const org = screen.getByTestId("legend-color-Org");
    const orgSwatch = org.querySelector(".g3t-legend-swatch") as HTMLElement;
    expect(orgSwatch.style.background.toLowerCase()).toBe(
      hexToRgb(CANVAS_CATEGORICAL[1] ?? ""),
    );
    expect(screen.getByTestId("legend-size").textContent).toContain("14px");
    expect(screen.getByTestId("legend-size").textContent).toContain("34px");
    expect(
      screen
        .getByTestId("legend-icon-Org")
        .querySelector('[data-testid="g3t-icon-layers"]'),
    ).toBeTruthy();
    expect(screen.queryByTestId("legend-icon-Person")).toBeNull();
    expect(screen.getByTestId("legend-edge-width")).toBeTruthy();
  });

  it("renders the ramp for sequential color", () => {
    const seq: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "pagerank",
          scale: { kind: "sequential", domain: "auto" },
        },
      },
      edge: {},
    };
    render(<SpecLegend ugm={graph()} spec={seq} />);
    expect(
      screen.getByTestId("legend-color-ramp").querySelectorAll("span").length,
    ).toBeGreaterThan(4);
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe("shape section (round 13)", () => {
  it("renders glyph rows through the shape resolver", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        shape: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Person: "diamond" } },
        },
      },
      edge: {},
    };
    render(<SpecLegend ugm={graph()} spec={spec} />);
    const person = screen.getByTestId("legend-shape-Person");
    expect(person.textContent).toContain("(diamond)");
    expect(person.querySelector("polygon")).toBeTruthy();
    // Org auto-cycles to slot 1 (rectangle) despite Person's pin.
    expect(screen.getByTestId("legend-shape-Org").textContent).toContain(
      "(rectangle)",
    );
  });

  it("documents the DEFAULT shape channel when the spec declares none (12.15)", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Alpha"] });
    ugm.addNode("b", { types: ["Beta"] });
    render(
      <SpecLegend
        ugm={ugm}
        spec={{
          version: 1,
          node: {
            color: {
              driver: "types",
              scale: { kind: "categorical", palette: "okabe-ito" },
            },
          },
          edge: {},
        }}
      />,
    );
    // Sorted types cycle shapeForIndex: the legend mirrors the canvas
    // default exactly instead of showing color only.
    expect(screen.getByTestId("legend-shape-Alpha")).toBeDefined();
    expect(screen.getByTestId("legend-shape-Beta")).toBeDefined();
  });
});

describe("R-13: the legend discloses manual overrides", () => {
  it("says nothing when there are none", () => {
    render(<SpecLegend ugm={graph()} spec={SPEC} />);
    expect(screen.queryByTestId("legend-override-notice")).toBeNull();
  });

  it("discloses their presence and offers a reset", () => {
    const onResetOverrides = vi.fn();
    render(
      <SpecLegend
        ugm={graph()}
        spec={SPEC}
        overrides={[{ scope: { nodeId: "n1" } }]}
        onResetOverrides={onResetOverrides}
      />,
    );
    const notice = screen.getByTestId("legend-override-notice");
    expect(notice.textContent).toContain("does not describe");
    fireEvent.click(screen.getByTestId("legend-override-reset"));
    expect(onResetOverrides).toHaveBeenCalledOnce();
  });
});

describe("R-13.3 (round 21): one legend serves both renderers", () => {
  it("renders from element descriptors when there is no UGM", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "type",
          scale: {
            kind: "categorical",
            overrides: { Block: "#ff0000", Port: "#00ff00" },
          },
        },
      },
      edge: {},
    };
    render(
      <SpecLegend
        spec={spec}
        elements={[
          { id: "a", type: "Block" },
          { id: "b", type: "Port" },
        ]}
      />,
    );
    const legend = screen.getByTestId("g3t-spec-legend");
    expect(legend.textContent).toContain("Block");
    expect(legend.textContent).toContain("Port");
  });

  // The elements path had a single-render test only, and that gap let a
  // real staleness defect ship: the row memos read `elements` but omitted
  // it from their dependencies, so on the ugm-less path (where `elements`
  // is the ONLY data source) the legend computed once and then described
  // a scene that no longer existed. A legend that silently stops tracking
  // its input is worse than no legend.
  it("recomputes rows when the element list changes", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "type",
          scale: {
            kind: "categorical",
            overrides: { Block: "#ff0000", Port: "#00ff00", Bus: "#0000ff" },
          },
        },
      },
      edge: {},
    };
    const { rerender } = render(
      <SpecLegend spec={spec} elements={[{ id: "a", type: "Block" }]} />,
    );
    expect(screen.getByTestId("g3t-spec-legend").textContent).toContain(
      "Block",
    );
    rerender(<SpecLegend spec={spec} elements={[{ id: "b", type: "Bus" }]} />);
    const legend = screen.getByTestId("g3t-spec-legend");
    expect(legend.textContent).toContain("Bus");
    expect(legend.textContent).not.toContain("Block");
  });
});

describe("issue #38: the legend speaks to the canvas's audience", () => {
  function typedGraph(): UGM {
    const ugm = new UGM();
    ugm.addNode("p1", { types: ["Person"], properties: { pagerank: 0.1 } });
    ugm.addNode("o1", { types: ["Org"], properties: { pagerank: 0.9 } });
    ugm.addEdge("p1", "o1", { type: "worksAt", properties: { weight: 3 } });
    ugm.addEdge("o1", "p1", { type: "employs", properties: { weight: 1 } });
    return ugm;
  }

  const FULL: EncodingSpec = {
    version: 1,
    node: {
      color: {
        driver: "types",
        scale: { kind: "categorical", palette: "okabe-ito" },
      },
      size: {
        driver: "pagerank",
        scale: { kind: "sequential", domain: [0, 1], range: [10, 30] },
      },
      icon: {
        driver: "types",
        scale: { kind: "categorical", overrides: { Org: "layers" } },
      },
    },
    edge: {
      color: {
        driver: "type",
        scale: { kind: "categorical", palette: "okabe-ito" },
      },
      width: {
        driver: "weight",
        scale: { kind: "sequential", domain: "auto", range: [1, 6] },
      },
    },
  };

  function titles(): string[] {
    return Array.from(document.querySelectorAll(".g3t-legend-title")).map(
      (el) => el.textContent ?? "",
    );
  }

  it("prints the driver in code by default (unchanged wording)", () => {
    render(<SpecLegend ugm={typedGraph()} spec={FULL} />);
    expect(titles()).toEqual([
      "color: types",
      "size: pagerank (domain 0–1)",
      "shape: types (default)",
      "icon: types",
      "edge color: type",
      "edge width: weight",
    ]);
    const code = document.querySelector(".g3t-legend-title code");
    expect(code?.textContent).toBe("types");
  });

  it("applies sectionTitle to every section heading", () => {
    const sectionTitle = vi.fn(
      (channel: string, driver: string) => `${channel}|${driver}`,
    );
    render(
      <SpecLegend ugm={typedGraph()} spec={FULL} sectionTitle={sectionTitle} />,
    );
    // The size domain qualifier describes the scale, not the channel,
    // so it stays appended after the host's words.
    expect(titles()).toEqual([
      "node.color|types",
      "node.size|pagerank (domain 0–1)",
      "node.shape|types",
      "node.icon|types",
      "edge.color|type",
      "edge.width|weight",
    ]);
    // No encoding internals leak around the host's wording.
    expect(document.querySelector(".g3t-legend-title code")).toBeNull();
  });

  it("names the sequential color section through sectionTitle too", () => {
    const seq: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "pagerank",
          scale: { kind: "sequential", domain: "auto" },
        },
      },
      edge: {},
    };
    render(
      <SpecLegend
        ugm={typedGraph()}
        spec={seq}
        sectionTitle={() => "Importance"}
      />,
    );
    expect(titles()[0]).toBe("Importance (ramp)");
  });

  it("hands labelFor the section channel so node and edge labels can differ", () => {
    const labelFor = vi.fn((value: string, channel: string) =>
      channel === "edge.color" ? `rel:${value}` : `node:${value}`,
    );
    render(<SpecLegend ugm={typedGraph()} spec={FULL} labelFor={labelFor} />);
    expect(screen.getByTestId("legend-color-Person").textContent).toContain(
      "node:Person",
    );
    expect(
      screen.getByTestId("legend-edge-color-worksAt").textContent,
    ).toContain("rel:worksAt");
    expect(labelFor).toHaveBeenCalledWith("Person", "node.color");
    expect(labelFor).toHaveBeenCalledWith("Org", "node.shape");
    expect(labelFor).toHaveBeenCalledWith("Org", "node.icon");
    expect(labelFor).toHaveBeenCalledWith("worksAt", "edge.color");
  });

  it("keeps a one-argument labelFor working (backward compatible)", () => {
    const shorten = (v: string) => v.slice(0, 3);
    render(<SpecLegend ugm={typedGraph()} spec={FULL} labelFor={shorten} />);
    expect(screen.getByTestId("legend-color-Person").textContent).toContain(
      "Per",
    );
    expect(
      screen.getByTestId("legend-edge-color-employs").textContent,
    ).toContain("emp");
  });

  it("derives edge color rows from the data when the scale has no overrides, matching the canvas", () => {
    const ugm = typedGraph();
    render(<SpecLegend ugm={ugm} spec={FULL} />);
    // One row per distinct relation type, in edge traversal order.
    const rows = Array.from(
      document.querySelectorAll('[data-testid^="legend-edge-color-"]'),
    ).map((el) => el.getAttribute("data-testid"));
    expect(rows).toEqual([
      "legend-edge-color-worksAt",
      "legend-edge-color-employs",
    ]);
    // The swatch is the color the canvas patch paints that edge with:
    // same resolver, same palette slot.
    const patch = applyEncodingSpec(FULL, ugm);
    const painted = new Map<string, string>();
    ugm.forEachEdge((id, attrs) => {
      painted.set(String(attrs.type), patch.edges.get(id)?._ecolor ?? "");
    });
    for (const type of ["worksAt", "employs"]) {
      const line = screen
        .getByTestId(`legend-edge-color-${type}`)
        .querySelector(".g3t-legend-line") as HTMLElement;
      expect(line.style.background).toBe(hexToRgb(painted.get(type) ?? ""));
    }
    expect(painted.get("worksAt")).not.toBe(painted.get("employs"));
  });

  it("orders edge color rows by the explicit domain and honours overrides", () => {
    const spec: EncodingSpec = {
      ...FULL,
      edge: {
        color: {
          driver: "type",
          scale: {
            kind: "categorical",
            palette: "okabe-ito",
            domain: ["employs", "worksAt"],
            overrides: { worksAt: "#123456" },
          },
        },
      },
    };
    render(<SpecLegend ugm={typedGraph()} spec={spec} />);
    const rows = Array.from(
      document.querySelectorAll('[data-testid^="legend-edge-color-"]'),
    ).map((el) => el.getAttribute("data-testid"));
    expect(rows).toEqual([
      "legend-edge-color-employs",
      "legend-edge-color-worksAt",
    ]);
    const pinned = screen
      .getByTestId("legend-edge-color-worksAt")
      .querySelector(".g3t-legend-line") as HTMLElement;
    expect(pinned.style.background).toBe("rgb(18, 52, 86)");
  });

  it("falls back to the domain and override keys when there is no UGM to walk", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {},
      edge: {
        color: {
          driver: "type",
          scale: {
            kind: "categorical",
            palette: "okabe-ito",
            domain: ["flows"],
            overrides: { blocks: "#ff0000" },
          },
        },
      },
    };
    render(<SpecLegend spec={spec} elements={[{ id: "a", type: "Block" }]} />);
    expect(screen.getByTestId("legend-edge-color-flows")).toBeTruthy();
    expect(screen.getByTestId("legend-edge-color-blocks")).toBeTruthy();
  });

  it("renders no edge color section when the data has no driver values", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["A"] });
    render(<SpecLegend ugm={ugm} spec={FULL} />);
    expect(
      document.querySelector('[data-testid^="legend-edge-color-"]'),
    ).toBeNull();
    expect(titles()).not.toContain("edge color: type");
  });
});
