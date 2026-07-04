import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { UGM } from "@g3t/core";
import { NodePropertyInspector } from "./NodePropertyInspector";
import type { PropertyInspectorSpec } from "./property-spec";

/**
 * NodePropertyInspector renders from a property spec, so each property
 * gets the widget the spec assigns (text, number, checkbox, toggle,
 * select, textarea). It runs in "preview" (read-only) or "edit"
 * (interactive) mode, prioritizes Properties above Type and Graph
 * importance, and remembers which sections are collapsed graph-wide:
 * collapse a section, pick a different element, and the same containment
 * is shown. Switch the gallery theme to see accents re-skin.
 */
const SPEC: PropertyInspectorSpec = {
  fields: [
    { key: "name", widget: "text" },
    {
      key: "sector",
      widget: "select",
      options: ["Defense", "Commercial", "Research"],
    },
    { key: "founded", widget: "number" },
    { key: "active", widget: "checkbox", label: "Active" },
    { key: "verified", widget: "toggle", label: "Verified" },
    { key: "notes", widget: "textarea" },
  ],
};

function buildUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("acme", {
    types: ["Organization"],
    properties: {
      name: "Acme Corp",
      sector: "Defense",
      founded: 1991,
      active: true,
      verified: false,
      notes: "Primary systems integrator on program X.",
    },
  });
  ugm.addNode("globex", {
    types: ["Organization"],
    properties: { name: "Globex", sector: "Commercial", active: false },
  });
  ugm.addNode("alice", {
    types: ["Person"],
    properties: { name: "Alice", role: "Engineer", active: true },
  });
  ugm.addNode("bob", {
    types: ["Person"],
    properties: { name: "Bob", role: "Analyst" },
  });
  ugm.addNode("hq", {
    types: ["Location"],
    properties: { name: "Cincinnati HQ" },
  });
  ugm.addEdge("alice", "acme", {
    type: "worksAt",
    properties: { since: 2019 },
    confidence: 0.92,
    asserted: true,
  });
  ugm.addEdge("bob", "acme", { type: "worksAt", confidence: 0.7 });
  ugm.addEdge("acme", "hq", { type: "basedIn", confidence: 0.99 });
  ugm.addEdge("acme", "globex", { type: "partnerOf" });
  return ugm;
}

const meta: Meta<typeof NodePropertyInspector> = {
  title: "Views/NodePropertyInspector",
  component: NodePropertyInspector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Spec-driven node/edge inspector. Properties render with the " +
          "widget the spec assigns (text, number, checkbox, toggle, " +
          "select, textarea) in preview or edit mode; Properties is the " +
          "first, prioritized section. Section collapse is graph-wide.",
      },
    },
  },
  argTypes: {
    ugm: { table: { disable: true } },
    selection: { table: { disable: true } },
    onClose: { table: { disable: true } },
    onPropertyChange: { table: { disable: true } },
    spec: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof NodePropertyInspector>;

const pickBtn = (active: boolean) => ({
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: 4,
  cursor: "pointer",
  border: "1px solid var(--g3t-border)",
  background: active ? "var(--g3t-accent-primary)" : "var(--g3t-bg-primary)",
  color: active ? "#fff" : "var(--g3t-text-primary)",
});

export const Interactive: Story = {
  name: "Interactive (pick + edit)",
  parameters: {
    docs: {
      description: {
        story:
          "Pick an element and flip between edit and preview. Edits write " +
          "back to the UGM. Collapse a section, then pick a different " +
          "element: the same sections stay collapsed (state is graph-wide).",
      },
    },
  },
  render: () => {
    const [ugm] = useState(buildUGM);
    const [, force] = useState(0);
    const [mode, setMode] = useState<"preview" | "edit">("edit");
    const [selection, setSelection] = useState<{
      type: "node" | "edge";
      id: string;
    } | null>({ type: "node", id: "acme" });
    const nodeIds = useMemo(() => ugm.getNodeIds(), [ugm]);
    const edgeIds = useMemo(() => {
      const ids: string[] = [];
      ugm.forEachEdge((id) => ids.push(id));
      return ids;
    }, [ugm]);

    const onPropertyChange = (key: string, value: unknown) => {
      if (selection?.type === "node") {
        ugm.updateNodeProperties(selection.id, { [key]: value });
        force((n) => n + 1);
      }
    };

    return (
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["edit", "preview"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={pickBtn(mode === m)}
              >
                {m}
              </button>
            ))}
          </div>
          <Picker
            label="Nodes"
            ids={nodeIds}
            isActive={(id) => selection?.type === "node" && selection.id === id}
            onPick={(id) => setSelection({ type: "node", id })}
          />
          <Picker
            label="Edges"
            ids={edgeIds}
            isActive={(id) => selection?.type === "edge" && selection.id === id}
            onPick={(id) => setSelection({ type: "edge", id })}
          />
        </div>
        <NodePropertyInspector
          ugm={ugm}
          selection={selection}
          mode={mode}
          spec={SPEC}
          onPropertyChange={onPropertyChange}
          onClose={() => setSelection(null)}
        />
      </div>
    );
  },
};

export const PreviewAndEdit: Story = {
  name: "Preview vs edit (same data)",
  parameters: {
    docs: {
      description: {
        story:
          "The same node in preview (left) and edit (right), sharing one " +
          "UGM. Edits on the right update the preview on the left, showing " +
          "each widget in both states.",
      },
    },
  },
  render: () => {
    const [ugm] = useState(buildUGM);
    const [, force] = useState(0);
    return (
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <NodePropertyInspector
          ugm={ugm}
          selection={{ type: "node", id: "acme" }}
          mode="preview"
          spec={SPEC}
        />
        <NodePropertyInspector
          ugm={ugm}
          selection={{ type: "node", id: "acme" }}
          mode="edit"
          spec={SPEC}
          onPropertyChange={(k, v) => {
            ugm.updateNodeProperties("acme", { [k]: v });
            force((n) => n + 1);
          }}
        />
      </div>
    );
  },
};

export const NoSelection: Story = {
  name: "No selection",
  render: () => {
    const [ugm] = useState(buildUGM);
    return <NodePropertyInspector ugm={ugm} selection={null} />;
  },
};

function Picker({
  label,
  ids,
  isActive,
  onPick,
}: {
  label: string;
  ids: string[];
  isActive: (id: string) => boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "var(--g3t-text-muted)",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 220 }}>
        {ids.map((id) => (
          <button
            key={id}
            onClick={() => onPick(id)}
            style={pickBtn(isActive(id))}
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}
