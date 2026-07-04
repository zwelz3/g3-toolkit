import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { UGM } from "@g3t/core";
import {
  Toolbar,
  ZoomControls,
  StatusBar,
  HoverTooltip,
  KeyboardShortcutModal,
} from "../../interaction/toolbar";
import {} from "../../interaction/encoding";
import type { CanvasMode } from "../../interaction/toolbar";

// ── Shared test UGM ─────────────────────────────────────────────────

function makeUGM() {
  const ugm = new UGM();
  const types = ["Person", "Organization", "Location", "Event"];
  for (let i = 0; i < 20; i++) {
    ugm.addNode(`n${i}`, {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

export const Status: StoryObj<typeof StatusBar> = {
  name: "StatusBar",
  argTypes: {
    zoomLevel: {
      control: { type: "number", min: 0.1, max: 4, step: 0.05 },
      description: "Current zoom factor; rendered as a percentage.",
    },
  },
  args: { zoomLevel: 1.25 },
  parameters: {
    docs: {
      description: {
        story:
          "Read-only status footer: node and edge counts from the UGM plus " +
          "the current zoom percentage. The inline zoom slider appears only " +
          "when both `zoomLevel` and `onZoomChange` are provided.",
      },
    },
  },
  render: (args) => <StatusBar ugm={makeUGM()} zoomLevel={args.zoomLevel} />,
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

import { LayoutSwitcher } from "../../interaction/layout-switcher";

export const LayoutSwitch: StoryObj<typeof LayoutSwitcher> = {
  name: "LayoutSwitcher",
  argTypes: {
    activeId: {
      control: { type: "select" },
      options: ["force", "dagre"],
      description: "Id of the engine shown as active in the dropdown.",
    },
  },
  args: { activeId: "force" },
  parameters: {
    docs: {
      description: {
        story:
          "Dropdown for choosing among registered layout engines. Selecting " +
          "an engine calls `onSwitch(engineId)`; the host runs that engine " +
          "and updates `activeId`.",
      },
    },
  },
  render: (args) => (
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
      activeId={args.activeId}
      onSwitch={(id: string) => console.log("Switch to:", id)}
    />
  ),
};
