import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Core } from "cytoscape";
import { UGM } from "@g3t/core";
import {
  GraphToolbar,
  layoutConfig,
  runGraphLayout,
  buildExport,
  buildImageExport,
} from "./GraphToolbar";
import { usePositionPinStore } from "../../state/position-pin-store";

beforeEach(() => {
  // Pin state lives in a global store now (round 17): reset between
  // tests or pin-all bleeds across cases.
  usePositionPinStore.setState({ pinnedIds: [], allPinned: false });
});

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", { types: ["Person"], properties: { name: "Aris" } });
  ugm.addNode("o1", { types: ["Org"], properties: { name: "Helix" } });
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: {} });
  return ugm;
}

function mockCy() {
  const run = vi.fn();
  const cy = {
    layout: vi.fn(() => ({ run })),
    zoom: vi.fn(() => 1),
    fit: vi.fn(),
    animate: vi.fn(),
    png: vi.fn(() => new Blob(["stub-png-bytes"], { type: "image/png" })),
    nodes: vi.fn(() => ({ lock: vi.fn(), unlock: vi.fn() })),
    getElementById: vi.fn(() => ({
      nonempty: () => true,
    })),
  };
  return { cy: cy as unknown as Core, run, raw: cy };
}

const OPTIONS = {
  animate: false,
  animationDuration: 0,
  edgeStyle: "bezier" as const,
  nodeRepulsion: 9000,
  gravity: 0.5,
  edgeLength: 120,
  direction: "TB" as const,
  nodeSeparation: 50,
  rankSeparation: 80,
  spacing: 60,
};

describe("layoutConfig (the cy glue)", () => {
  it("maps force options onto fcose parameters", () => {
    const c = layoutConfig("force", OPTIONS);
    expect(c["name"]).toBe("fcose");
    expect(c["nodeRepulsion"]).toBe(9000);
    expect(c["idealEdgeLength"]).toBe(120);
    expect(c["gravity"]).toBe(0.5);
  });

  it("degrades unbundled hierarchical engines to breadthfirst, visibly", () => {
    expect(layoutConfig("dagre", OPTIONS)["name"]).toBe("breadthfirst");
    expect(layoutConfig("elk", OPTIONS)["name"]).toBe("breadthfirst");
  });

  it("maps simple layouts with spacing factors", () => {
    expect(layoutConfig("grid", OPTIONS)["name"]).toBe("grid");
    expect(layoutConfig("concentric", OPTIONS)["minNodeSpacing"]).toBe(60);
  });
});

describe("runGraphLayout", () => {
  it("runs the mapped layout on cy", () => {
    const { cy, run, raw } = mockCy();
    runGraphLayout(cy, "force", OPTIONS);
    expect(raw.layout).toHaveBeenCalledWith(
      expect.objectContaining({ name: "fcose", nodeRepulsion: 9000 }),
    );
    expect(run).toHaveBeenCalled();
  });

  it("is a no-op without a cy handle", () => {
    expect(() => runGraphLayout(null, "force", OPTIONS)).not.toThrow();
  });

  it("degrades to cose when the layout name throws (fcose unregistered)", () => {
    const run = vi.fn();
    const layout = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("No such layout `fcose`");
      })
      .mockImplementation(() => ({ run }));
    runGraphLayout({ layout } as unknown as Core, "force", OPTIONS);
    expect(layout).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "cose" }),
    );
    expect(run).toHaveBeenCalled();
  });
});

describe("GraphToolbar (rebuilt, round 16)", () => {
  it("renders the single-row anatomy", () => {
    const { cy } = mockCy();
    render(<GraphToolbar ugm={graph()} cy={cy} />);
    expect(screen.getByTestId("g3t-graph-toolbar")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search nodes…")).toBeTruthy();
    expect(screen.getByLabelText("Layout")).toBeTruthy();
    expect(screen.getByTestId("toolbar-fit")).toBeTruthy();
  });

  it("options popover edits locally; Run layout commits the values", () => {
    const { cy, raw } = mockCy();
    render(<GraphToolbar ugm={graph()} cy={cy} />);
    fireEvent.click(screen.getByLabelText("Layout options"));
    fireEvent.change(screen.getByLabelText("Repulsion"), {
      target: { value: "12000" },
    });
    // Owner 2026-07-28: the popover Run button is gone; edits apply
    // live (debounced). The toolbar Re-run stays for explicit runs.
    fireEvent.click(screen.getByTestId("toolbar-rerun"));
    expect(raw.layout).toHaveBeenCalledWith(
      expect.objectContaining({ name: "fcose", nodeRepulsion: 12000 }),
    );
  });

  it("layout select runs immediately; Pin all disables runs with explanation", () => {
    const { cy, raw } = mockCy();
    render(<GraphToolbar ugm={graph()} cy={cy} />);
    fireEvent.change(screen.getByLabelText("Layout"), {
      target: { value: "grid" },
    });
    expect(raw.layout).toHaveBeenCalledWith(
      expect.objectContaining({ name: "grid" }),
    );
    fireEvent.click(screen.getByTestId("toolbar-pin-all"));
    const select = screen.getByLabelText("Layout") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.title).toContain("pinned");
    expect(
      screen.getByTestId("toolbar-pin-all").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      (screen.getByTestId("toolbar-rerun") as HTMLButtonElement).disabled,
    ).toBe(true);
    // Store-backed: the flag is the whole-graph pin, and releasing it
    // returns to (does not clear) the per-node pin set.
    usePositionPinStore.getState().pin("p1");
    fireEvent.click(screen.getByTestId("toolbar-pin-all"));
    const s = usePositionPinStore.getState();
    expect(s.allPinned).toBe(false);
    expect(s.pinnedIds).toEqual(["p1"]);
  });

  it("zoom and fit drive cy", () => {
    const { cy, raw } = mockCy();
    render(<GraphToolbar ugm={graph()} cy={cy} />);
    fireEvent.click(screen.getByTestId("toolbar-zoom-in"));
    expect(raw.zoom).toHaveBeenCalledWith(1.25);
    fireEvent.click(screen.getByTestId("toolbar-fit"));
    expect(raw.fit).toHaveBeenCalledWith(undefined, 40);
  });

  it("typing only filters; the camera moves on an explicit pick (12.9)", () => {
    const { cy, raw } = mockCy();
    render(<GraphToolbar ugm={graph()} cy={cy} />);
    fireEvent.change(screen.getByPlaceholderText("Search nodes…"), {
      target: { value: "Helix" },
    });
    // No camera movement while typing (the reviewed view-jump).
    expect(raw.animate).not.toHaveBeenCalled();
    // Enter picks the highlighted result and centers IT.
    fireEvent.keyDown(screen.getByPlaceholderText("Search nodes…"), {
      key: "Enter",
    });
    expect(raw.animate).toHaveBeenCalled();
  });
});

describe("shuffle (round 19)", () => {
  it("re-runs force with randomize: true; Re-run stays incremental", () => {
    const { cy, raw } = mockCy();
    render(<GraphToolbar ugm={graph()} cy={cy} />);
    fireEvent.click(screen.getByTestId("toolbar-shuffle"));
    expect(raw.layout).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "fcose", randomize: true }),
    );
    fireEvent.click(screen.getByTestId("toolbar-rerun"));
    expect(raw.layout).toHaveBeenLastCalledWith(
      expect.objectContaining({ randomize: false }),
    );
  });

  it("disables for non-force layouts with an explanation", () => {
    const { cy } = mockCy();
    render(<GraphToolbar ugm={graph()} cy={cy} />);
    fireEvent.change(screen.getByLabelText("Layout"), {
      target: { value: "grid" },
    });
    const btn = screen.getByTestId("toolbar-shuffle") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain("force");
  });
});

describe("export (R2.11 slice, round 26)", () => {
  it("buildExport honors the selection and falls back to whole graph", () => {
    const ugm = graph();
    const sel = buildExport("turtle", ugm, ["p1", "o1"]);
    expect(sel.filename).toBe("g3t-selection.ttl");
    expect(sel.content).toContain("g3t:node-p1 g3t:rel-worksAt g3t:node-o1 .");
    const all = buildExport("json", ugm, []);
    expect(all.filename).toBe("g3t-graph.json");
    expect(JSON.parse(all.content).nodes).toHaveLength(2);
  });

  it("buildImageExport delegates to cy.png(blob) and names the artifact", () => {
    const { cy, raw } = mockCy();
    const art = buildImageExport(cy, { full: true, scale: 3, bg: "#fff" });
    expect(raw.png).toHaveBeenCalledWith({
      output: "blob",
      full: true,
      scale: 3,
      bg: "#fff",
    });
    expect(art.filename).toBe("g3t-graph.png");
    expect(art.mime).toBe("image/png");
    expect(art.blob).toBeInstanceOf(Blob);
  });

  it("buildImageExport defaults to full graph at 2x", () => {
    const { cy, raw } = mockCy();
    buildImageExport(cy);
    expect(raw.png).toHaveBeenCalledWith({
      output: "blob",
      full: true,
      scale: 2,
      bg: undefined,
    });
  });

  it("Image (PNG) menu entry renders and drives buildImageExport with a revoked object URL", () => {
    const { cy, raw } = mockCy();
    const created: string[] = [];
    const revoked: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => {
      const u = `blob:mock-${created.length}-${b.size}`;
      created.push(u);
      return u;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn((u: string) => {
      revoked.push(u);
    }) as typeof URL.revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    try {
      render(<GraphToolbar ugm={graph()} cy={cy} />);
      fireEvent.click(screen.getByTestId("toolbar-export"));
      const btn = screen.getByTestId("export-png");
      expect(btn.textContent).toBe("Image (PNG)");
      fireEvent.click(btn);
      expect(raw.png).toHaveBeenCalledWith({
        output: "blob",
        full: true,
        scale: 2,
        bg: undefined,
      });
      expect(clickSpy).toHaveBeenCalled();
      expect(created).toHaveLength(1);
      expect(revoked).toEqual(created);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it("treats a destroyed instance as absent: search cannot crash a stale handle (9.9)", () => {
    const dead = {
      destroyed: () => true,
      getElementById: vi.fn(),
      animate: vi.fn(),
      zoom: vi.fn(),
      fit: vi.fn(),
    } as unknown as Core;
    render(<GraphToolbar ugm={graph()} cy={dead} />);
    const input = screen.getByPlaceholderText("Search nodes…");
    fireEvent.change(input, { target: { value: "a" } });
    // No cy operation may reach the destroyed instance.
    expect(
      (dead as unknown as { getElementById: ReturnType<typeof vi.fn> })
        .getElementById,
    ).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("toolbar-fit"));
    expect(
      (dead as unknown as { fit: ReturnType<typeof vi.fn> }).fit,
    ).not.toHaveBeenCalled();
  });
});

describe("VR-4: option edits apply LIVE (debounced, incremental)", () => {
  it("dragging Spacing re-runs the current layout after the debounce", async () => {
    vi.useFakeTimers();
    try {
      const { cy, raw } = mockCy();
      render(<GraphToolbar ugm={graph()} cy={cy} />);
      fireEvent.click(screen.getByLabelText("Layout options"));
      const slider = screen.getByLabelText("Edge length");
      const before = raw.layout.mock.calls.length;
      fireEvent.change(slider, { target: { value: "140" } });
      expect(raw.layout.mock.calls.length).toBe(before); // debounced
      await vi.advanceTimersByTimeAsync(350);
      expect(raw.layout.mock.calls.length).toBe(before + 1);
      const config = (raw.layout.mock.calls as unknown[][]).at(
        -1,
      )?.[0] as Record<string, unknown>;
      // Default layout is force: the slider must reach fcose's
      // idealEdgeLength with the NEW value.
      expect(config.name).toBe("fcose");
      expect(config.idealEdgeLength).toBe(140);
      expect(config.randomize).toBe(false); // incremental: mental map holds
    } finally {
      vi.useRealTimers();
    }
  });

  it("VR-5: initialLayout drives the dropdown and hierarchy consumes BOTH sliders", async () => {
    vi.useFakeTimers();
    try {
      const { cy, raw } = mockCy();
      render(<GraphToolbar ugm={graph()} cy={cy} initialLayout="hierarchy" />);
      const select = screen.getByLabelText("Layout") as HTMLSelectElement;
      expect(select.value).toBe("hierarchy");
      fireEvent.click(screen.getByLabelText("Layout options"));
      fireEvent.change(screen.getByLabelText("Spacing"), {
        target: { value: "120" },
      });
      await vi.advanceTimersByTimeAsync(350);
      const config = (raw.layout.mock.calls as unknown[][]).at(
        -1,
      )?.[0] as Record<string, unknown>;
      expect(config.name).toBe("breadthfirst");
      // rankSeparation default 80 (factor 1) x spacing 120/60 = 2.
      expect(config.spacingFactor).toBeCloseTo(2, 5);
    } finally {
      vi.useRealTimers();
    }
  });
});
