import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { UGM } from "@core/ugm";
import {
  Toolbar,
  ZoomControls,
  StatusBar,
  HoverTooltip,
  KeyboardShortcutModal,
} from "@interaction/toolbar";
import {
  EncodingPanel,
  CanvasLegend,
  DEFAULT_ENCODING,
} from "@interaction/encoding";
import type { EncodingConfig } from "@interaction/encoding";
import type { CanvasMode } from "@interaction/toolbar";

// ── Shared test UGM ─────────────────────────────────────────────────

function makeUGM() {
  const ugm = new UGM();
  const types = ["Person", "Organization", "Location", "Event"];
  for (let i = 0; i < 20; i++) {
    ugm.addNode(`n${i}`, {
      types: [types[i % 4]!],
      properties: { name: `Node ${i}`, score: +(i * 0.05).toFixed(2) },
    });
  }
  for (let i = 0; i < 15; i++) {
    ugm.addEdge(`n${i}`, `n${(i + 3) % 20}`, {
      type: "related",
      confidence: 0.7,
    });
  }
  return ugm;
}

// ── Toolbar ─────────────────────────────────────────────────────────

const toolbarMeta: Meta<typeof Toolbar> = {
  title: "UX Surface/Toolbar",
  component: Toolbar,
  tags: ["autodocs"],
};
export default toolbarMeta;

export const Default: StoryObj<typeof Toolbar> = {
  render: () => {
    const [mode, setMode] = useState<CanvasMode>("select");
    return (
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        onLayoutTrigger={() => alert("Layout triggered")}
        onToggleFilter={() => alert("Filter toggled")}
        onToggleEncoding={() => alert("Encoding toggled")}
        onThemeChange={(id) => alert(`Theme: ${id}`)}
      />
    );
  },
};

export const MinimalToolbar: StoryObj<typeof Toolbar> = {
  render: () => {
    const [mode, setMode] = useState<CanvasMode>("select");
    return <Toolbar mode={mode} onModeChange={setMode} />;
  },
};

// ── ZoomControls ────────────────────────────────────────────────────

export const Zoom: StoryObj = {
  name: "ZoomControls",
  render: () => (
    <ZoomControls
      onZoomIn={() => alert("Zoom in")}
      onZoomOut={() => alert("Zoom out")}
      onFit={() => alert("Fit")}
    />
  ),
};

// ── StatusBar ───────────────────────────────────────────────────────

export const Status: StoryObj = {
  name: "StatusBar",
  render: () => <StatusBar ugm={makeUGM()} zoomLevel={1.25} />,
};

// ── HoverTooltip ────────────────────────────────────────────────────

export const Tooltip: StoryObj = {
  name: "HoverTooltip",
  render: () => (
    <HoverTooltip
      data={{
        id: "n0",
        label: "Alice Johnson",
        type: "Person",
        properties: { age: 34, city: "Chicago", role: "Analyst", score: 0.87 },
        x: 100,
        y: 100,
      }}
    />
  ),
};

// ── KeyboardShortcutModal ───────────────────────────────────────────

export const Shortcuts: StoryObj = {
  name: "KeyboardShortcutModal",
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open shortcuts (?)</button>
        <KeyboardShortcutModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
};

// ── LayoutSwitcher ──────────────────────────────────────────────────

import { LayoutSwitcher } from "@interaction/layout-switcher";

export const LayoutSwitch: StoryObj = {
  name: "LayoutSwitcher",
  render: () => (
    <LayoutSwitcher
      engines={[
        {
          id: "force",
          name: "Force-Directed",
          compute: async () => new Map(),
        },
        {
          id: "dagre",
          name: "Dagre",
          compute: async () => new Map(),
        },
      ]}
      activeId="force"
      onSwitch={(id: string) => console.log("Switch to:", id)}
    />
  ),
};
