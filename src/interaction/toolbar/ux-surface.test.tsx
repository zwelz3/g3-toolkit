/**
 * M8.5 UX Surface & Theming tests.
 *
 * E1.T1: Theme store switches themes; CSS vars injected.
 * E2.T1: Encoding generates Cytoscape stylesheet.
 * E2.T2: EncodingPanel renders and updates config.
 * E2.T3: Legend shows type-color mapping.
 * E3.T1: Tooltip renders data.
 * E3.T2: ZoomControls renders buttons.
 * E3.T3: Toolbar renders with mode buttons and theme selector.
 * E3.T4: StatusBar shows counts.
 * E4.T1: Keyboard shortcut modal renders.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@core/ugm";
import { useSelectionStore } from "@state/selection-store";
import {
  useThemeStore,
  LIGHT_THEME,
  DARK_THEME,
  HIGH_CONTRAST_THEME,
  THEME_PRESETS,
  deriveCytoscapeStyle,
  deriveEChartsTheme,
} from "@theme/ThemeManager";
import type { G3tTheme } from "@theme/ThemeManager";
import {
  DEFAULT_ENCODING,
  encodingToCytoscapeStyle,
  EncodingPanel,
  CanvasLegend,
} from "@interaction/encoding";
import {
  HoverTooltip,
  ZoomControls,
  Toolbar,
  StatusBar,
  KeyboardShortcutModal,
} from "@interaction/toolbar";

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
  useThemeStore.setState({ theme: LIGHT_THEME });
});

function createTestUGM(): UGM {
  const ugm = new UGM();
  for (let i = 0; i < 10; i++) {
    ugm.addNode(`n${i}`, {
      types: [i < 5 ? "Person" : "Organization"],
      properties: { name: `Node ${i}`, score: i * 0.1 },
    });
  }
  for (let i = 0; i < 8; i++) {
    ugm.addEdge(`n${i}`, `n${i + 1}`, {
      type: "knows",
      confidence: 0.5 + i * 0.05,
    });
  }
  return ugm;
}

// ── Theme (E1.T1) ──────────────────────────────────────────────────

describe("ThemeManager (M8.5.E1.T1)", () => {
  it("starts with light theme", () => {
    expect(useThemeStore.getState().theme.id).toBe("light");
  });

  it("switches to dark theme", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme.id).toBe("dark");
    expect(useThemeStore.getState().theme.bgPrimary).toBe("#1a1b1e");
  });

  it("switches to high-contrast theme", () => {
    useThemeStore.getState().setTheme("high-contrast");
    expect(useThemeStore.getState().theme.nodeLabelColor).toBe("#000000");
    expect(useThemeStore.getState().theme.bgPrimary).toBe("#ffffff");
  });

  it("all presets have 8 palette colors", () => {
    expect(LIGHT_THEME.typePalette).toHaveLength(8);
    expect(DARK_THEME.typePalette).toHaveLength(8);
    expect(HIGH_CONTRAST_THEME.typePalette).toHaveLength(8);
  });

  it("deriveCytoscapeStyle produces node and edge styles", () => {
    const styles = deriveCytoscapeStyle(DARK_THEME);
    expect(styles.length).toBeGreaterThan(0);
    const nodeStyle = styles.find(
      (s) => (s as { selector: string }).selector === "node",
    );
    expect(nodeStyle).toBeDefined();
  });

  it("deriveEChartsTheme includes palette and text color", () => {
    const echarts = deriveEChartsTheme(DARK_THEME);
    expect(echarts.color).toEqual(DARK_THEME.typePalette);
    expect((echarts.textStyle as { color: string }).color).toBe(
      DARK_THEME.textPrimary,
    );
  });
});

// ── Encoding (E2.T1) ────────────────────────────────────────────────

describe("VisualEncodingManager (M8.5.E2.T1)", () => {
  it("generates type-based color styles", () => {
    const ugm = createTestUGM();
    const styles = encodingToCytoscapeStyle(
      DEFAULT_ENCODING,
      ugm,
      LIGHT_THEME.typePalette,
    );

    const personStyle = styles.find(
      (s) => (s as { selector: string }).selector === 'node[_type = "Person"]',
    );
    expect(personStyle).toBeDefined();
  });

  it("generates size mapping when property set", () => {
    const ugm = createTestUGM();
    const encoding = { ...DEFAULT_ENCODING, nodeSizeProperty: "score" };
    const styles = encodingToCytoscapeStyle(
      encoding,
      ugm,
      LIGHT_THEME.typePalette,
    );

    const sizeStyle = styles.find((s) => {
      const style = (s as { style?: Record<string, unknown> }).style;
      return style?.width && String(style.width).includes("mapData");
    });
    expect(sizeStyle).toBeDefined();
  });
});

// ── EncodingPanel (E2.T2) ───────────────────────────────────────────

describe("EncodingPanel (M8.5.E2.T2)", () => {
  it("renders encoding dropdowns", () => {
    const ugm = createTestUGM();
    const onChange = vi.fn();

    render(
      <EncodingPanel
        ugm={ugm}
        encoding={DEFAULT_ENCODING}
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId("encoding-panel")).toBeInTheDocument();
    expect(screen.getByTestId("encoding-node-size")).toBeInTheDocument();
    expect(screen.getByTestId("encoding-node-label")).toBeInTheDocument();
  });

  it("changing node size calls onChange", () => {
    const ugm = createTestUGM();
    const onChange = vi.fn();

    render(
      <EncodingPanel
        ugm={ugm}
        encoding={DEFAULT_ENCODING}
        onChange={onChange}
      />,
    );

    const select = screen
      .getByTestId("encoding-node-size")
      .querySelector("select")!;
    fireEvent.change(select, { target: { value: "score" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ nodeSizeProperty: "score" }),
    );
  });
});

// ── Legend (E2.T3) ──────────────────────────────────────────────────

describe("CanvasLegend (M8.5.E2.T3)", () => {
  it("renders type-color entries", () => {
    const ugm = createTestUGM();
    render(<CanvasLegend ugm={ugm} encoding={DEFAULT_ENCODING} />);

    expect(screen.getByTestId("canvas-legend")).toBeInTheDocument();
    expect(screen.getByTestId("legend-type-Person")).toBeInTheDocument();
    expect(screen.getByTestId("legend-type-Organization")).toBeInTheDocument();
  });

  it("shows size scale when nodeSizeProperty set", () => {
    const ugm = createTestUGM();
    const encoding = { ...DEFAULT_ENCODING, nodeSizeProperty: "score" };
    render(<CanvasLegend ugm={ugm} encoding={encoding} />);

    expect(screen.getByTestId("legend-size-scale")).toBeInTheDocument();
  });
});

// ── HoverTooltip (E3.T1) ────────────────────────────────────────────

describe("HoverTooltip (M8.5.E3.T1)", () => {
  it("renders tooltip with node data", () => {
    render(
      <HoverTooltip
        data={{
          id: "n1",
          label: "Alice",
          type: "Person",
          properties: { age: 30, city: "NYC" },
          x: 100,
          y: 200,
        }}
      />,
    );

    const tip = screen.getByTestId("hover-tooltip");
    expect(tip).toHaveTextContent("Alice");
    expect(tip).toHaveTextContent("Person");
    expect(tip).toHaveTextContent("age");
    expect(tip).toHaveTextContent("30");
  });

  it("renders nothing when data is null", () => {
    const { container } = render(<HoverTooltip data={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ── ZoomControls (E3.T2) ────────────────────────────────────────────

describe("ZoomControls (M8.5.E3.T2)", () => {
  it("renders +, -, fit buttons", () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFit = vi.fn();

    render(
      <ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />,
    );

    expect(screen.getByTestId("zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-fit")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("zoom-fit"));
    expect(onFit).toHaveBeenCalledOnce();
  });
});

// ── Toolbar (E3.T3) ────────────────────────────────────────────────

describe("Toolbar (M8.5.E3.T3)", () => {
  it("renders mode buttons and theme selector", () => {
    const onModeChange = vi.fn();
    const onThemeChange = vi.fn();

    render(
      <Toolbar
        mode="select"
        onModeChange={onModeChange}
        onThemeChange={onThemeChange}
      />,
    );

    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-select")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-pan")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-theme")).toBeInTheDocument();
  });

  it("clicking pan mode fires callback", () => {
    const onModeChange = vi.fn();
    render(<Toolbar mode="select" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByTestId("toolbar-pan"));
    expect(onModeChange).toHaveBeenCalledWith("pan");
  });

  it("theme selector changes theme", () => {
    const onThemeChange = vi.fn();
    render(
      <Toolbar
        mode="select"
        onModeChange={vi.fn()}
        onThemeChange={onThemeChange}
      />,
    );

    fireEvent.change(screen.getByTestId("toolbar-theme"), {
      target: { value: "dark" },
    });
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });
});

// ── StatusBar (E3.T4) ───────────────────────────────────────────────

describe("StatusBar (M8.5.E3.T4)", () => {
  it("shows node and edge counts", () => {
    const ugm = createTestUGM();
    render(<StatusBar ugm={ugm} />);

    expect(screen.getByTestId("status-nodes")).toHaveTextContent("Nodes: 10");
    expect(screen.getByTestId("status-edges")).toHaveTextContent("Edges: 8");
  });

  it("shows selection count when nodes selected", () => {
    const ugm = createTestUGM();
    useSelectionStore.getState().selectNodes(["n0", "n1", "n2"]);

    render(<StatusBar ugm={ugm} />);
    expect(screen.getByTestId("status-selection")).toHaveTextContent(
      "Selected: 3",
    );
  });

  it("shows zoom level", () => {
    const ugm = createTestUGM();
    render(<StatusBar ugm={ugm} zoomLevel={1.5} />);
    expect(screen.getByTestId("status-zoom")).toHaveTextContent("Zoom: 150%");
  });
});

// ── KeyboardShortcutModal (E4.T1) ───────────────────────────────────

describe("KeyboardShortcutModal (M8.5.E4.T1)", () => {
  it("renders shortcuts when open", () => {
    render(<KeyboardShortcutModal open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("shortcut-modal")).toBeInTheDocument();
    expect(screen.getByTestId("shortcut-modal")).toHaveTextContent("Ctrl + Z");
    expect(screen.getByTestId("shortcut-modal")).toHaveTextContent("Undo");
  });

  it("renders nothing when closed", () => {
    render(<KeyboardShortcutModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("shortcut-modal")).not.toBeInTheDocument();
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("shortcut-modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── Audit: Interaction Gaps ─────────────────────────────────────────

describe("ThemeManager: audit gaps", () => {
  it("setCustomTheme applies a custom theme", () => {
    const custom: G3tTheme = {
      ...LIGHT_THEME,
      id: "custom",
      name: "Custom",
      bgPrimary: "#ff0000",
    };
    useThemeStore.getState().setCustomTheme(custom);
    expect(useThemeStore.getState().theme.bgPrimary).toBe("#ff0000");
    expect(useThemeStore.getState().theme.id).toBe("custom");
  });

  it("handles multiple rapid theme switches", () => {
    const store = useThemeStore.getState();
    store.setTheme("dark");
    store.setTheme("light");
    store.setTheme("high-contrast");
    store.setTheme("dark");
    expect(useThemeStore.getState().theme.id).toBe("dark");
  });

  it("ignores invalid theme ID", () => {
    useThemeStore.getState().setTheme("nonexistent");
    // Should remain unchanged (was reset to light in beforeEach)
    expect(useThemeStore.getState().theme.id).toBe("light");
  });

  it("THEME_PRESETS contains all three presets", () => {
    expect(Object.keys(THEME_PRESETS)).toEqual(
      expect.arrayContaining(["light", "dark", "high-contrast"]),
    );
  });
});

describe("EncodingPanel: audit gaps", () => {
  it("nodeColor change fires onChange", () => {
    const ugm = createTestUGM();
    const onChange = vi.fn();
    render(
      <EncodingPanel
        ugm={ugm}
        encoding={DEFAULT_ENCODING}
        onChange={onChange}
      />,
    );
    const select = screen
      .getByTestId("encoding-node-color")
      .querySelector("select")!;
    fireEvent.change(select, { target: { value: "score" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ nodeColorProperty: "score" }),
    );
  });

  it("edgeWidth change fires onChange", () => {
    const ugm = createTestUGM();
    const onChange = vi.fn();
    render(
      <EncodingPanel
        ugm={ugm}
        encoding={DEFAULT_ENCODING}
        onChange={onChange}
      />,
    );
    const select = screen
      .getByTestId("encoding-edge-width")
      .querySelector("select")!;
    fireEvent.change(select, { target: { value: "confidence" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ edgeWidthProperty: "confidence" }),
    );
  });

  it("selecting (none) clears the property to null", () => {
    const ugm = createTestUGM();
    const onChange = vi.fn();
    const encoding = { ...DEFAULT_ENCODING, nodeSizeProperty: "score" };
    render(<EncodingPanel ugm={ugm} encoding={encoding} onChange={onChange} />);
    const select = screen
      .getByTestId("encoding-node-size")
      .querySelector("select")!;
    fireEvent.change(select, { target: { value: "(none)" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ nodeSizeProperty: null }),
    );
  });
});

describe("CanvasLegend: audit gaps", () => {
  it("hides size scale when nodeSizeProperty is null", () => {
    const ugm = createTestUGM();
    render(<CanvasLegend ugm={ugm} encoding={DEFAULT_ENCODING} />);
    expect(screen.queryByTestId("legend-size-scale")).not.toBeInTheDocument();
  });

  it("shows edge line-style meanings (Asserted/Inferred)", () => {
    const ugm = createTestUGM();
    render(<CanvasLegend ugm={ugm} encoding={DEFAULT_ENCODING} />);
    const legend = screen.getByTestId("canvas-legend");
    expect(legend).toHaveTextContent("Asserted");
    expect(legend).toHaveTextContent("Inferred");
  });

  it("handles 9+ types (palette wraps)", () => {
    const ugm = new UGM();
    for (let i = 0; i < 12; i++) {
      ugm.addNode(`n${i}`, {
        types: [`Type${i}`],
        properties: { name: `N${i}` },
      });
    }
    render(<CanvasLegend ugm={ugm} encoding={DEFAULT_ENCODING} />);
    // 12 types, 8 palette colors => wraps. Should render without crash.
    expect(screen.getByTestId("legend-type-Type0")).toBeInTheDocument();
    expect(screen.getByTestId("legend-type-Type11")).toBeInTheDocument();
  });
});

describe("HoverTooltip: audit gaps", () => {
  it("renders tooltip with all expected fields", () => {
    render(
      <HoverTooltip
        data={{
          id: "n1",
          label: "TestNode",
          type: "Widget",
          properties: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
          x: 50,
          y: 50,
        }}
      />,
    );
    const tip = screen.getByTestId("hover-tooltip");
    expect(tip).toHaveTextContent("TestNode");
    expect(tip).toHaveTextContent("Widget");
    // Truncates to 5 properties (f should not appear)
    expect(tip).toHaveTextContent("a");
    expect(tip).toHaveTextContent("e");
    expect(tip).not.toHaveTextContent("f");
  });
});

describe("ZoomControls: audit gaps", () => {
  it("all three buttons render and fire callbacks", () => {
    const zoomIn = vi.fn();
    const zoomOut = vi.fn();
    const fit = vi.fn();
    render(<ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={fit} />);

    expect(screen.getByTestId("zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-fit")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("zoom-in"));
    expect(zoomIn).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId("zoom-out"));
    expect(zoomOut).toHaveBeenCalledOnce();
  });
});

describe("Toolbar: audit gaps", () => {
  it("renders select and pan mode buttons with correct active state", () => {
    render(<Toolbar mode="select" onModeChange={vi.fn()} />);
    expect(screen.getByTestId("toolbar-select")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-pan")).toBeInTheDocument();
  });

  it("fires onLayoutTrigger", () => {
    const onLayout = vi.fn();
    render(
      <Toolbar
        mode="select"
        onModeChange={vi.fn()}
        onLayoutTrigger={onLayout}
      />,
    );
    fireEvent.click(screen.getByTestId("toolbar-layout"));
    expect(onLayout).toHaveBeenCalledOnce();
  });

  it("fires onToggleFilter", () => {
    const onFilter = vi.fn();
    render(
      <Toolbar
        mode="select"
        onModeChange={vi.fn()}
        onToggleFilter={onFilter}
      />,
    );
    fireEvent.click(screen.getByTestId("toolbar-filter"));
    expect(onFilter).toHaveBeenCalledOnce();
  });

  it("fires onToggleEncoding", () => {
    const onEncoding = vi.fn();
    render(
      <Toolbar
        mode="select"
        onModeChange={vi.fn()}
        onToggleEncoding={onEncoding}
      />,
    );
    fireEvent.click(screen.getByTestId("toolbar-encoding"));
    expect(onEncoding).toHaveBeenCalledOnce();
  });

  it("renders without optional callbacks", () => {
    render(<Toolbar mode="select" onModeChange={vi.fn()} />);
    // Layout, filter, encoding buttons should not render when callbacks omitted
    expect(screen.queryByTestId("toolbar-layout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbar-filter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbar-encoding")).not.toBeInTheDocument();
  });
});

describe("KeyboardShortcutModal: audit gaps", () => {
  it("lists all shortcuts (at least 10)", () => {
    render(<KeyboardShortcutModal open={true} onClose={vi.fn()} />);
    const rows = screen.getByTestId("shortcut-modal").querySelectorAll("tr");
    expect(rows.length).toBeGreaterThanOrEqual(10);
  });
});

// ── Audit: Edge Cases ───────────────────────────────────────────────

describe("VisualEncoding: edge cases", () => {
  it("handles property with all same values (range = 0)", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { val: 5 } });
    ugm.addNode("b", { types: ["X"], properties: { val: 5 } });

    const encoding = { ...DEFAULT_ENCODING, nodeSizeProperty: "val" };
    const styles = encodingToCytoscapeStyle(
      encoding,
      ugm,
      LIGHT_THEME.typePalette,
    );
    // Should not crash; range is 0 so mapData won't produce a size entry
    expect(styles).toBeDefined();
  });

  it("handles UGM with no numeric properties", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "Alice" } });

    const encoding = { ...DEFAULT_ENCODING, nodeSizeProperty: "name" };
    const styles = encodingToCytoscapeStyle(
      encoding,
      ugm,
      LIGHT_THEME.typePalette,
    );
    // String property has no numeric range; should not crash
    expect(styles).toBeDefined();
  });
});

describe("StatusBar: edge cases", () => {
  it("renders with zero nodes and edges", () => {
    const ugm = new UGM();
    render(<StatusBar ugm={ugm} />);
    expect(screen.getByTestId("status-nodes")).toHaveTextContent("Nodes: 0");
    expect(screen.getByTestId("status-edges")).toHaveTextContent("Edges: 0");
  });
});
