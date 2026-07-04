/**
 * VA-20 live encoding check: ONE component used twice: SSR'd by the
 * page generator as the no-JS fallback, and mounted live by the
 * inlined client island (va20-island.tsx). Same fixture, same spec,
 * same components: what you interact with is what shipped.
 */
import { useMemo, useState, useRef } from "react";
import { UGM } from "@g3t/core";
import { usePositionPinStore } from "../../packages/react/src/state/position-pin-store";
import { useSelectionStore } from "../../packages/react/src/state/selection-store";
import {
  EncodingSpecPanel,
  EncodingPreview,
} from "../../packages/react/src/interaction/encoding/EncodingSpecPanel";
import {
  serializeEncodingSpec,
  type EncodingSpec,
} from "../../packages/react/src/interaction/encoding/encoding-spec";

export const VA20_SPEC: EncodingSpec = {
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
      scale: {
        kind: "categorical",
        overrides: { Org: "layers", Document: "copy" },
      },
    },
    shape: {
      driver: "types",
      scale: {
        kind: "categorical",
        overrides: { Person: "ellipse", Org: "round-rectangle" },
      },
    },
    label: { driver: "label" },
  },
  edge: {
    width: {
      driver: "weight",
      scale: { kind: "sequential", domain: "auto", range: [1, 6] },
    },
  },
};

export function encodingGraph(): UGM {
  const ugm = new UGM();
  const add = (id: string, type: string, label: string, pagerank: number) =>
    ugm.addNode(id, { types: [type], properties: { label, pagerank } });
  add("p1", "Person", "Aris", 0.04);
  add("p2", "Person", "Bea", 0.2);
  add("o1", "Org", "Helix", 0.9);
  add("d1", "Document", "Survey", 0.01);
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: { weight: 2 } });
  ugm.addEdge("p2", "o1", { type: "worksAt", properties: { weight: 8 } });
  return ugm;
}

export function Va20Live() {
  const [spec, setSpec] = useState<EncodingSpec>(VA20_SPEC);
  // Referentially stable across renders: a fresh UGM identity
  // tells CytoscapeCanvas the GRAPH changed, which re-inits and
  // re-layouts (the round-11 finding: color edits scrambled
  // positions because this fixture rebuilt the graph per render).
  const ugm = useMemo(() => encodingGraph(), []);
  return (
    <div className="va-live">
      <div className="g3t-panel" style={{ minWidth: 0 }}>
        <EncodingSpecPanel
          ugm={ugm}
          spec={spec}
          onChange={setSpec}
          defaultExpanded={["node.color", "node.size"]}
        />
      </div>
      <div className="g3t-panel" style={{ minWidth: 0 }}>
        <p className="va-derived">resolver-driven preview (live)</p>
        <EncodingPreview ugm={ugm} spec={spec} />
        <p className="va-derived" style={{ marginTop: 12 }}>
          spec (live)
        </p>
        <pre className="va-spec" data-testid="va20-spec-json">
          {serializeEncodingSpec(spec)}
        </pre>
      </div>
    </div>
  );
}

// ── VA-21: icon sets (sanitize-by-default) ───────────────────────────

import {
  registerIconSet,
  type IconSetResult,
} from "../../packages/react/src/icons";
import { applyIconMappings } from "../../packages/react/src/interaction/encoding/encoding-spec";

const BRAND_SET = {
  icons: {
    agent: '<circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0114 0"/>',
    building:
      '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
  },
  mappings: {
    driver: "types",
    values: { Person: "agent", Org: "building", Document: "doc" },
  },
};

const HOSTILE_SET = {
  icons: {
    evil: '<path d="M0 0h24" onclick="alert(1)"/>',
    scripty: "<script>alert(1)</script>",
    foreign: "<foreignObject><div>x</div></foreignObject>",
    fine: '<path d="M4 12h16"/>',
  },
};

export function Va21IconSets() {
  const [spec, setSpec] = useState<EncodingSpec>(VA20_SPEC);
  const [loaded, setLoaded] = useState<IconSetResult | null>(null);
  const [report, setReport] = useState<IconSetResult | null>(null);
  // Referentially stable across renders: a fresh UGM identity
  // tells CytoscapeCanvas the GRAPH changed, which re-inits and
  // re-layouts (the round-11 finding: color edits scrambled
  // positions because this fixture rebuilt the graph per render).
  const ugm = useMemo(() => encodingGraph(), []);
  return (
    <div>
      <div className="va-row">
        <button
          className="g3t-btn"
          onClick={() => {
            if (loaded) return;
            const result = registerIconSet(BRAND_SET);
            setLoaded(result);
            if (result.mappings)
              setSpec(applyIconMappings(spec, result.mappings));
          }}
          disabled={loaded !== null}
        >
          Load brand icon set (sanitized)
        </button>
        <button
          className="g3t-btn"
          onClick={() => {
            if (!loaded) return;
            loaded.unregister();
            setLoaded(null);
            setSpec(VA20_SPEC);
          }}
          disabled={loaded === null}
        >
          Unload
        </button>
        <button
          className="g3t-btn"
          onClick={() => {
            const r = registerIconSet(HOSTILE_SET);
            r.unregister();
            setReport(r);
          }}
        >
          Try hostile set
        </button>
      </div>
      <EncodingPreview ugm={ugm} spec={spec} />
      {report ? (
        <div data-testid="va21-report">
          <p className="va-derived">
            sanitizer: registered [{report.registered.join(", ")}]; rejected{" "}
            {report.rejected.length} with reasons:
          </p>
          <ul className="va-reasons">
            {report.rejected.map((r, i) => (
              <li key={i}>
                <code>{r.icon}</code>: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ── VA-22: the full loop: panel -> canvas -> legend ──────────────────

import { CytoscapeCanvas } from "../../packages/react/src/views/canvas/CytoscapeCanvas";
import { SpecLegend } from "../../packages/react/src/interaction/encoding/SpecLegend";
import { SpecPort } from "../../packages/react/src/interaction/encoding/SpecPort";
import { useStyleOverrideStore } from "../../packages/react/src/state/style-override-store";

export function Va22CanvasLoop({ live = false }: { live?: boolean }) {
  const [spec, setSpec] = useState<EncodingSpec>(VA20_SPEC);
  // Referentially stable across renders: a fresh UGM identity
  // tells CytoscapeCanvas the GRAPH changed, which re-inits and
  // re-layouts (the round-11 finding: color edits scrambled
  // positions because this fixture rebuilt the graph per render).
  const ugm = useMemo(() => encodingGraph(), []);
  return (
    <div className="va-loop">
      <div className="g3t-panel" style={{ minWidth: 0 }}>
        <EncodingSpecPanel
          ugm={ugm}
          spec={spec}
          onChange={setSpec}
          defaultExpanded={["node.color"]}
        />
      </div>
      <div className="g3t-panel va-loop-canvas" style={{ minWidth: 0 }}>
        {live ? (
          <CytoscapeCanvas
            ugm={ugm}
            encodingSpec={spec}
            className="va-canvas-host"
          />
        ) : (
          <p className="va-derived">
            canvas mounts in the browser (Cytoscape cannot initialize in the
            generator's jsdom); if this text persists after load, the island
            failed.
          </p>
        )}
      </div>
      <div className="g3t-panel" style={{ minWidth: 0 }}>
        <p className="va-derived">legend (same resolvers as the canvas)</p>
        <SpecLegend ugm={ugm} spec={spec} />
        <p className="va-derived" style={{ marginTop: 10 }}>
          instance overrides (M12: the layer ABOVE the spec)
        </p>
        <div className="va-row">
          <button
            className="g3t-btn"
            onClick={() =>
              useStyleOverrideStore.getState().add({
                scope: { nodeId: "o1" },
                color: "#d4a017",
                borderColor: "#8a6a00",
                borderWidth: 3,
              })
            }
          >
            Pin Helix gold
          </button>
          <button
            className="g3t-btn g3t-btn-ghost"
            onClick={() => useStyleOverrideStore.getState().clear()}
          >
            Clear overrides
          </button>
        </div>
        <p className="va-derived" style={{ marginTop: 10 }}>
          spec JSON (tier 3: edit and apply)
        </p>
        <SpecPort spec={spec} onApply={setSpec} />
      </div>
    </div>
  );
}

// ── VA-23: graph toolbar (search, layouts, force controls) ──────────

import type { Core } from "cytoscape";
import { GraphToolbar } from "../../packages/react/src/interaction/toolbar/GraphToolbar";
import { ContextMenu } from "../../packages/react/src/interaction/context-menu/ContextMenu";

function toolbarGraph(): UGM {
  const ugm = new UGM();
  const teams: Array<[string, string[]]> = [
    ["Helix", ["Aris", "Bea", "Caro", "Druv"]],
    ["Quanta", ["Edda", "Finn", "Gus"]],
    ["Mistral", ["Hana", "Ivo", "Juno", "Kit", "Lior"]],
  ];
  for (const [org, people] of teams) {
    ugm.addNode(org, { types: ["Org"], properties: { name: org } });
    for (const person of people) {
      ugm.addNode(person, {
        types: ["Person"],
        properties: { name: person },
      });
      ugm.addEdge(person, org, { type: "worksAt", properties: {} });
    }
  }
  ugm.addEdge("Helix", "Quanta", { type: "partner", properties: {} });
  ugm.addEdge("Quanta", "Mistral", { type: "partner", properties: {} });
  return ugm;
}

export function Va23Toolbar({ live = false }: { live?: boolean }) {
  const ugm = useMemo(() => toolbarGraph(), []);
  const [cy, setCy] = useState<Core | null>(null);
  // Round-26 finding 2: the full toolkit action set was noise here.
  // A host registers exactly the actions it wants (the wiring-guide
  // pattern); this curated trio is the whole menu.
  const liveMenu = useMemo(() => {
    const m = new ContextMenuManager();
    m.register("va23", [
      {
        id: "pin-toggle",
        label: "Pin / unpin position",
        filter: (target) => target.type === "node",
        action: (target) => {
          if (target.id) usePositionPinStore.getState().toggle(target.id);
        },
      },
      {
        id: "select",
        label: "Select node",
        filter: (target) => target.type === "node",
        action: (target) => {
          if (target.id) useSelectionStore.getState().selectNodes([target.id]);
        },
      },
      {
        id: "center",
        label: "Center here",
        filter: (target) => target.type === "node",
        action: (target) => {
          const c = cyRef.current;
          const ele = target.id ? c?.getElementById(target.id) : undefined;
          if (ele && ele.nonempty()) {
            c?.animate({ center: { eles: ele }, zoom: 1.4 }, { duration: 200 });
          }
        },
      },
    ]);
    return m;
  }, []);
  const cyRef = useRef<Core | null>(null);
  // Static, always-open menu sample: theme compliance is reviewable
  // without hunting for a right-click (round-15 finding 1).
  // The wrapper carries transform: translate(0,0), which makes it the
  // CONTAINING BLOCK for the menu's position:fixed (round-18 finding
  // 2: without it the sample escaped to the viewport's top-left and
  // floated there persistently). Items fire real actions; the wiring
  // line below proves the plumbing (round-18 finding 3).
  const [lastAction, setLastAction] = useState<string | null>(null);
  const menuSample = (
    <div
      style={{
        position: "relative",
        transform: "translate(0, 0)",
        height: 152,
        marginTop: 8,
        overflow: "hidden",
      }}
      data-testid="va23-menu-sample"
    >
      <p className="va-derived">
        context menu chrome (right-click also works on the live canvas);
        clicking an item updates the wiring line below
      </p>
      <ContextMenu
        items={[
          {
            id: "inspect",
            label: "Inspect properties",
            action: () => setLastAction("Inspect properties"),
          },
          {
            id: "copy-iri",
            label: "Copy IRI",
            action: () => setLastAction("Copy IRI"),
          },
          {
            id: "pin",
            label: "Pin / unpin position",
            action: () => setLastAction("Pin / unpin position"),
            separator: true,
          },
        ]}
        target={{ kind: "node", id: "o1", position: { x: 18, y: 44 } } as never}
        onClose={() => {}}
      />
      <p className="va-derived" data-testid="va23-menu-wiring">
        wiring check:{" "}
        {lastAction ? `"${lastAction}" fired` : "no action fired yet"}
      </p>
    </div>
  );
  return (
    <div className="g3t-panel" style={{ minWidth: 0, padding: 0 }}>
      <GraphToolbar ugm={ugm} cy={cy} />
      {live ? (
        <CytoscapeCanvas
          ugm={ugm}
          className="va-canvas-host"
          menuManager={liveMenu}
          onReady={(c) => {
            cyRef.current = c;
            setCy(c);
          }}
        />
      ) : (
        <p className="va-derived" style={{ padding: 12 }}>
          canvas mounts in the browser (Cytoscape cannot initialize in the
          generator's jsdom); if this text persists after load, the island
          failed.
        </p>
      )}
      {menuSample}
    </div>
  );
}

// ── VA-24: compound containers + per-node pinning ────────────────────

import { ContextMenuManager } from "../../packages/react/src/interaction/context-menu/ContextMenuManager";
import type { ContainmentOptions } from "../../packages/react/src/views/canvas/ugm-to-cytoscape";

function va24Graph(): UGM {
  const ugm = new UGM();
  const block = (id: string, name: string) =>
    ugm.addNode(id, { types: ["Block"], properties: { name } });
  const part = (id: string, name: string) =>
    ugm.addNode(id, { types: ["Part"], properties: { name } });
  block("sys", "Surveyor System");
  block("nav", "Navigation");
  block("pwr", "Power");
  part("imu", "IMU");
  part("gps", "GPS Rx");
  part("bat", "Battery");
  part("pdu", "PDU");
  const contains = (parent: string, child: string) =>
    ugm.addEdge(parent, child, { type: "contains", properties: {} });
  contains("sys", "nav");
  contains("sys", "pwr");
  contains("nav", "imu");
  contains("nav", "gps");
  contains("pwr", "bat");
  contains("pwr", "pdu");
  ugm.addEdge("pdu", "imu", { type: "powers", properties: {} });
  ugm.addEdge("pdu", "gps", { type: "powers", properties: {} });
  ugm.addEdge("gps", "imu", { type: "feeds", properties: {} });
  return ugm;
}

const VA24_CONTAINMENT: ContainmentOptions = {
  edgeType: "contains",
  direction: "parentToChild",
};

export function Va24Containers({ live = false }: { live?: boolean }) {
  const ugm = useMemo(() => va24Graph(), []);
  const [cy, setCy] = useState<Core | null>(null);
  // Minimal, purpose-built menu (round-18 finding 6: the full
  // toolkit action set is way too much for an acceptance example).
  // Two items: the one under test, and one wiring proof.
  const menuManager = useMemo(() => {
    const manager = new ContextMenuManager();
    manager.register("va24", [
      {
        id: "pin-position",
        label: "Pin / unpin position",
        icon: "\u{1F4CC}",
        filter: (target) => target.type === "node",
        action: (target) => {
          if (target.id) usePositionPinStore.getState().toggle(target.id);
        },
      },
      {
        id: "select",
        label: "Select (wiring check)",
        filter: (target) => target.type === "node",
        action: (target) => {
          if (target.id) useSelectionStore.getState().selectNodes([target.id]);
        },
      },
    ]);
    return manager;
  }, []);
  return (
    <div className="g3t-panel" style={{ minWidth: 0, padding: 0 }}>
      <GraphToolbar ugm={ugm} cy={cy} />
      {live ? (
        <CytoscapeCanvas
          ugm={ugm}
          containment={VA24_CONTAINMENT}
          menuManager={menuManager}
          className="va-canvas-host"
          onReady={setCy}
        />
      ) : (
        <p className="va-derived" style={{ padding: 12 }}>
          canvas mounts in the browser (Cytoscape cannot initialize in the
          generator's jsdom); if this text persists after load, the island
          failed.
        </p>
      )}
    </div>
  );
}

// ── VA-25: workspace durability (capture / restore) ─────────────────

import {
  captureWorkspace,
  applyWorkspace,
  serializeWorkspace,
  parseWorkspace,
} from "../../packages/react/src/interaction/workspace/workspace";

export function Va25Workspace({ live = false }: { live?: boolean }) {
  const ugm = useMemo(() => encodingGraph(), []);
  const [cy, setCy] = useState<Core | null>(null);
  const [spec, setSpec] = useState<EncodingSpec>(VA20_SPEC);
  const [snapshotJson, setSnapshotJson] = useState<string | null>(null);
  const [status, setStatus] = useState("no snapshot yet");
  return (
    <div className="g3t-panel" style={{ minWidth: 0, padding: 0 }}>
      <GraphToolbar ugm={ugm} cy={cy} />
      {live ? (
        <CytoscapeCanvas
          ugm={ugm}
          encodingSpec={spec}
          className="va-canvas-host"
          onReady={setCy}
        />
      ) : (
        <p className="va-derived" style={{ padding: 12 }}>
          canvas mounts in the browser (Cytoscape cannot initialize in the
          generator's jsdom); if this text persists after load, the island
          failed.
        </p>
      )}
      <div style={{ padding: 12 }}>
        <div className="va-row">
          <button
            className="g3t-btn"
            data-testid="va25-save"
            onClick={() => {
              const snap = captureWorkspace({ cy, spec });
              setSnapshotJson(serializeWorkspace(snap));
              setStatus(
                `captured ${Object.keys(snap.positions).length} positions, ` +
                  `${snap.pinnedIds.length} pins, theme "${snap.themeId}"`,
              );
            }}
          >
            Capture workspace
          </button>
          <button
            className="g3t-btn g3t-btn-ghost"
            data-testid="va25-restore"
            disabled={snapshotJson === null}
            onClick={() => {
              if (!snapshotJson) return;
              try {
                applyWorkspace(parseWorkspace(snapshotJson), { cy, setSpec });
                setStatus("restored");
              } catch (e) {
                setStatus(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Restore
          </button>
        </div>
        <p className="va-derived" data-testid="va25-status">
          {status}
        </p>
        {snapshotJson ? (
          <textarea
            className="g3t-input g3t-spec-port-text"
            aria-label="Workspace snapshot JSON"
            readOnly
            value={snapshotJson}
            style={{ minHeight: 120 }}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── VA-26: algorithm overlays + results-as-drivers ───────────────────

import { AlgorithmPanel } from "../../packages/react/src/interaction/algorithms/AlgorithmPanel";

/** Three DISCONNECTED subsystems plus a spare: connected components
 *  has something real to find (round-25 finding 3: the previous
 *  fixture was fully connected, so components returned one community
 *  and "color by component" painted everything a single okabe slot:
 *  technically correct, narratively dead). Degree variance is built
 *  in: PDU and the flight computer are integration hotspots. */
export function va26Graph(): UGM {
  const ugm = new UGM();
  const add = (id: string) =>
    ugm.addNode(id, { types: ["Component"], properties: { name: id } });
  // Power subsystem (star around PDU)
  for (const id of ["Battery", "SolarArray", "PDU", "Harness", "Bus"]) add(id);
  ugm.addEdge("Battery", "PDU", { type: "feeds", properties: {} });
  ugm.addEdge("SolarArray", "PDU", { type: "feeds", properties: {} });
  ugm.addEdge("PDU", "Harness", { type: "feeds", properties: {} });
  ugm.addEdge("PDU", "Bus", { type: "feeds", properties: {} });
  // Comms subsystem (chain)
  for (const id of ["Antenna", "Radio", "Modem"]) add(id);
  ugm.addEdge("Antenna", "Radio", { type: "links", properties: {} });
  ugm.addEdge("Radio", "Modem", { type: "links", properties: {} });
  // GNC subsystem (hub on the flight computer)
  for (const id of ["IMU", "StarTracker", "FlightComputer", "RWA"]) add(id);
  ugm.addEdge("IMU", "FlightComputer", { type: "senses", properties: {} });
  ugm.addEdge("StarTracker", "FlightComputer", {
    type: "senses",
    properties: {},
  });
  ugm.addEdge("FlightComputer", "RWA", { type: "commands", properties: {} });
  // Unintegrated spare: its own component, degree zero.
  add("SpareUnit");
  return ugm;
}

const VA26_SAMPLE_DOC = JSON.stringify(
  {
    version: 1,
    kind: "overlay",
    algorithm: "graphblas.bfs_tree (power chain)",
    overlay: {
      id: "critical-power",
      label: "Critical power path (external analysis)",
      nodeIds: ["Battery", "PDU", "Bus"],
      edgeIds: [],
    },
  },
  null,
  2,
);

export function Va26Algorithms({ live = false }: { live?: boolean }) {
  const ugm = useMemo(() => va26Graph(), []);
  const [cy, setCy] = useState<Core | null>(null);
  const [spec, setSpec] = useState<EncodingSpec>({
    version: 1,
    node: { label: { driver: "label" } },
    edge: {},
  });
  // Round-25 finding 3: runners must have VISIBLE consequences. The
  // panel reports which property keys it wrote; the shell wires them
  // straight into the encoding spec: components drive color, degree
  // drives size, and the legend follows. This is the host-side
  // pattern the wiring guide documents (results as drivers).
  const wireResult = (_summary: string, keys?: string[]) => {
    if (!keys || keys.length === 0) return;
    setSpec((prev) => {
      const node = { ...prev.node };
      if (keys.includes("_component")) {
        node.color = {
          driver: "_component",
          scale: { kind: "categorical", palette: "okabe-ito" },
        };
      }
      if (keys.includes("_degree")) {
        node.size = {
          driver: "_degree",
          scale: { kind: "sequential", domain: "auto", range: [18, 46] },
        };
      }
      return { ...prev, node };
    });
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gap: 12,
        minWidth: 0,
        alignItems: "start",
      }}
    >
      <div className="g3t-panel va26-left">
        <AlgorithmPanel
          ugm={ugm}
          initialJson={VA26_SAMPLE_DOC}
          onIngested={wireResult}
        />
        <div className="g3t-panel-section-header" style={{ marginTop: 10 }}>
          results as drivers (auto-wired): legend follows
        </div>
        <SpecLegend ugm={ugm} spec={spec} />
      </div>
      <div className="g3t-panel va26-right" style={{ padding: 0 }}>
        <GraphToolbar ugm={ugm} cy={cy} />
        {live ? (
          <CytoscapeCanvas
            ugm={ugm}
            encodingSpec={spec}
            className="va-canvas-host"
            onReady={setCy}
          />
        ) : (
          <p className="va-derived" style={{ padding: 12 }}>
            canvas mounts in the browser (Cytoscape cannot initialize in the
            generator's jsdom); if this text persists after load, the island
            failed.
          </p>
        )}
      </div>
    </div>
  );
}

// ── VA-27: structural rendering (ELK compartments + ports) ──────────

import { useEffect } from "react";
import {
  layoutStructural,
  compartmentKey,
  type StructuralGraphInput,
  type StructuralGeometry,
} from "@g3t/core";
import {
  useCompartmentCollapseStore,
  collapsedCompartmentSet,
} from "../../packages/react/src/state/compartment-collapse-store";
import { registerCompartmentCollapseActions } from "../../packages/react/src/interaction/context-menu/compartment-collapse-menu";

/** The «Block»/part fixture, compartment edition: three blocks with
 *  typed compartments and boundary ports, plus a plain note node, in
 *  a small DAG so ELK layered's quality is itself reviewable (the
 *  dagre verdict's visual surface). Port sides follow the flow
 *  direction (round-32 review: EAST/WEST ports under a DOWN layout
 *  made the port-to-port routing ugly). */
export function va27StructuralInput(
  direction: "RIGHT" | "DOWN" = "RIGHT",
): StructuralGraphInput {
  const out = direction === "RIGHT" ? "EAST" : "SOUTH";
  const inn = direction === "RIGHT" ? "WEST" : "NORTH";
  return {
    nodes: [
      {
        id: "Sensor",
        header: { stereotype: "Block", name: "Sensor" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [
              {
                id: "Sensor.calibrationDate",
                text: "calibrationDate : xsd:date [1..1]",
              },
              { id: "Sensor.accuracy", text: "accuracy : xsd:double [0..1]" },
              {
                id: "Sensor.operatingTemp",
                text: "operatingTemp : xsd:double [1..*]",
              },
            ],
          },
          {
            id: "operations",
            title: "operations",
            rows: [
              {
                id: "Sensor.calibrate",
                text: "calibrate() : ValidationReport",
              },
            ],
          },
        ],
        ports: [{ id: "Sensor.out", side: out }],
      },
      {
        id: "Lens",
        header: { stereotype: "Block", name: "Lens" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [
              {
                id: "Lens.focalLength",
                text: "focalLength : xsd:double [1..1]",
              },
              { id: "Lens.aperture", text: "aperture : xsd:double [1..1]" },
            ],
          },
        ],
        ports: [
          { id: "Lens.in", side: inn },
          { id: "Lens.out", side: out },
        ],
      },
      {
        id: "FlightComputer",
        header: { stereotype: "Block", name: "FlightComputer" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [
              {
                id: "FlightComputer.firmware",
                text: "firmware : xsd:string [1..1]",
              },
            ],
          },
        ],
        ports: [{ id: "FlightComputer.in", side: inn }],
      },
      { id: "CalibrationNote", width: 130, height: 44 },
    ],
    edges: [
      {
        id: "feeds",
        source: "Sensor",
        target: "Lens",
        sourcePort: "Sensor.out",
        targetPort: "Lens.in",
        label: "optical",
        kind: "association",
      },
      {
        id: "streams",
        source: "Lens",
        target: "FlightComputer",
        sourcePort: "Lens.out",
        targetPort: "FlightComputer.in",
        label: "frames",
        kind: "association",
      },
      // A3 UML edge vocabulary: FlightComputer is COMPOSED OF the
      // Sensor (filled diamond at the FlightComputer/whole end); the
      // Lens GENERALIZES to FlightComputer here only to show the
      // hollow triangle; CalibrationNote is a DEPENDENCY (dashed).
      {
        id: "composes",
        source: "FlightComputer",
        target: "Sensor",
        kind: "composition",
      },
      {
        id: "generalizes",
        source: "Lens",
        target: "FlightComputer",
        kind: "generalization",
      },
      {
        id: "annotates",
        source: "CalibrationNote",
        target: "Sensor",
        kind: "dependency",
      },
    ],
  };
}

export function Va27Structural({ live = false }: { live?: boolean }) {
  const [direction, setDirection] = useState<"RIGHT" | "DOWN">("RIGHT");
  const input = useMemo(() => va27StructuralInput(direction), [direction]);
  // Row ids double as UGM node ids: the id-matching pattern that
  // lights up selection/inspector machinery with zero extra wiring.
  const ugm = useMemo(() => {
    const g = new UGM();
    for (const n of input.nodes) {
      g.addNode(n.id, { types: ["Block"] });
      for (const c of n.compartments ?? [])
        for (const r of c.rows)
          g.addNode(r.id, {
            types: ["Property"],
            properties: { declaredIn: n.id, summary: r.text },
          });
    }
    return g;
  }, [input]);
  const [scene, setScene] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);
  const [selectedRow, setSelectedRow] = useState<string>("");
  // Collapse state lives in the toolkit store (the canvas slice). The
  // RIGHT-CLICK menu is the per-container surface; the one button is
  // the component-config surface (a global default a host would set).
  const [collapsedKeys, setCollapsedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!live) return;
    setCollapsedKeys(useCompartmentCollapseStore.getState().collapsedKeys);
    return useCompartmentCollapseStore.subscribe((s) =>
      setCollapsedKeys(s.collapsedKeys),
    );
  }, [live]);

  const menuManager = useMemo(() => {
    const m = new ContextMenuManager();
    registerCompartmentCollapseActions(m);
    return m;
  }, []);

  const toggleAllOperations = () => {
    const keys = input.nodes
      .flatMap((n) =>
        (n.compartments ?? []).map((c) => compartmentKey(n.id, c.id)),
      )
      .filter((k) => k.endsWith("::operations"));
    useCompartmentCollapseStore.getState().toggleAll(keys);
  };

  // A container reads as collapsed (▸ glyph) only when ALL of its
  // compartments are in the collapsed set; otherwise it is expanded (▾).
  const collapsedContainers = useMemo(() => {
    const set = new Set<string>();
    for (const n of input.nodes) {
      const comps = n.compartments ?? [];
      if (
        comps.length > 0 &&
        comps.every((c) => collapsedKeys.includes(compartmentKey(n.id, c.id)))
      ) {
        set.add(n.id);
      }
    }
    return set;
  }, [input, collapsedKeys]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    void layoutStructural(input, {
      direction,
      collapsedCompartments: collapsedCompartmentSet(collapsedKeys),
    }).then((geometry) => {
      if (!cancelled) setScene({ input, geometry });
    });
    return () => {
      cancelled = true;
    };
  }, [live, input, direction, collapsedKeys]);

  useEffect(() => {
    if (!live) return;
    return useSelectionStore.subscribe((s) => {
      const ids = [...s.selectedNodeIds];
      setSelectedRow(ids.length === 1 ? (ids[0] ?? "") : "");
    });
  }, [live]);

  return (
    <div className="g3t-panel" style={{ minWidth: 0, padding: 0 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "6px 10px",
        }}
      >
        <button
          className="g3t-button"
          onClick={() =>
            setDirection((d) => (d === "RIGHT" ? "DOWN" : "RIGHT"))
          }
        >
          Re-layout {direction === "RIGHT" ? "\u2193 DOWN" : "\u2192 RIGHT"}
        </button>
        <button className="g3t-button" onClick={toggleAllOperations}>
          Toggle ALL operations (config surface)
        </button>
        <span className="va-derived" style={{ fontSize: 12 }}>
          {selectedRow
            ? `selected row: ${selectedRow}`
            : "click a row to select; right-click a container or tap its +/\u2212 chip to collapse"}
        </span>
      </div>
      {live && scene ? (
        <CytoscapeCanvas
          ugm={ugm}
          structural={scene}
          structuralDecorations={{ collapsedContainers }}
          menuManager={menuManager}
          onCompartmentToggle={(id, cids) =>
            useCompartmentCollapseStore
              .getState()
              .toggleAll(cids.map((c) => compartmentKey(id, c)))
          }
          className="va-canvas-host"
        />
      ) : (
        <p className="va-derived" style={{ padding: 12 }}>
          canvas mounts in the browser (Cytoscape cannot initialize in the
          generator's jsdom); if this text persists after load, the island
          failed.
        </p>
      )}
    </div>
  );
}

// ── VA-28: SHACL shape view through the compartment API (B3) ────────

import {
  shaclShapesToStructural,
  shaclRowSeverities,
  closedShapeIds,
  type ShaclShape,
  type ShaclValidationResult,
} from "@g3t/core";
import type { StructuralDecorations } from "../../packages/react/src/views/canvas/structural-to-cytoscape";

/** A small shapes graph: one closed shape, one open, with a
 *  reference between them, exercising the SHACL->structural map. */
function va28Shapes(): ShaclShape[] {
  return [
    {
      id: "PersonShape",
      targetClass: "Person",
      name: "Person",
      closed: true,
      properties: [
        { path: "name", datatype: "string", minCount: 1, maxCount: 1 },
        { path: "age", datatype: "number", minInclusive: 0 },
        { path: "email", datatype: "string", pattern: "^.+@.+$", minCount: 0 },
        { path: "worksFor", datatype: "uri", minCount: 1, maxCount: 1 },
      ],
    },
    {
      id: "OrgShape",
      targetClass: "Org",
      name: "Organization",
      properties: [
        { path: "legalName", datatype: "string", minCount: 1, maxCount: 1 },
        { path: "taxId", datatype: "string", pattern: "^[0-9-]+$" },
      ],
    },
  ];
}

/** A report marking two property rows: a violation and a warning. */
function va28Report(): ShaclValidationResult[] {
  return [
    {
      nodeId: "person-1",
      shapeId: "PersonShape",
      shapeName: "Person",
      targetClass: "Person",
      valid: false,
      violations: [
        {
          path: "name",
          message: "missing required name",
          severity: "violation",
        },
        { path: "age", message: "age below 0", severity: "warning" },
      ],
    },
  ];
}

export function Va28ShaclShapes({ live = false }: { live?: boolean }) {
  const shapes = useMemo(() => va28Shapes(), []);
  const input = useMemo(
    () =>
      shaclShapesToStructural(shapes, {
        references: { "PersonShape::worksFor": "OrgShape" },
      }),
    [shapes],
  );
  const ugm = useMemo(() => {
    const g = new UGM();
    for (const n of input.nodes) {
      g.addNode(n.id, { types: ["NodeShape"] });
      for (const c of n.compartments ?? [])
        for (const r of c.rows) g.addNode(r.id, { types: ["PropertyShape"] });
    }
    return g;
  }, [input]);
  const [showReport, setShowReport] = useState(false);
  const [scene, setScene] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);

  const decorations: StructuralDecorations = useMemo(
    () => ({
      closedContainers: closedShapeIds(shapes),
      rowSeverities: showReport ? shaclRowSeverities(va28Report()) : undefined,
    }),
    [shapes, showReport],
  );

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    void layoutStructural(input, { direction: "RIGHT" }).then((geometry) => {
      if (!cancelled) setScene({ input, geometry });
    });
    return () => {
      cancelled = true;
    };
  }, [live, input]);

  return (
    <div className="g3t-panel" style={{ minWidth: 0, padding: 0 }}>
      <div style={{ display: "flex", gap: 8, padding: "6px 10px" }}>
        <button className="g3t-button" onClick={() => setShowReport((v) => !v)}>
          {showReport ? "Hide validation report" : "Load validation report"}
        </button>
        <span className="va-derived" style={{ fontSize: 12 }}>
          PersonShape is closed (solid); Organization open (dashed); the report
          badges the name (violation) and age (warning) rows.
        </span>
      </div>
      {live && scene ? (
        <CytoscapeCanvas
          ugm={ugm}
          structural={scene}
          structuralDecorations={decorations}
          className="va-canvas-host"
        />
      ) : (
        <p className="va-derived" style={{ padding: 12 }}>
          canvas mounts in the browser; if this text persists, the island
          failed.
        </p>
      )}
    </div>
  );
}

// ── VA-29: SHACL validation report over the data graph (B1) ─────────

import {
  validateShacl,
  reportFromValidationResults,
  severityOverlays,
  shaclResultDrivers,
  ingestAlgorithmResults,
} from "@g3t/core";
import { useOverlayStore } from "../../packages/react/src/state/overlay-store";

/** Shapes targeting the satellite Components, written so validation
 *  produces ALL THREE severity tiers (round 40 review): partNumber
 *  missing is a violation (red); serialFormat pattern mismatch is a
 *  warning (amber); reviewStatus carries sh:severity Info, so a
 *  missing review is an info result (blue). */
function va29Shapes(): ShaclShape[] {
  return [
    {
      id: "ComponentShape",
      targetClass: "Component",
      name: "Component",
      properties: [
        { path: "name", datatype: "string", minCount: 1 },
        // Required identifier: absent on most -> VIOLATION.
        { path: "partNumber", datatype: "string", minCount: 1 },
        // Format rule: present-but-malformed -> WARNING (sh:pattern).
        { path: "serial", datatype: "string", pattern: "^SN-[0-9]{4}$" },
        // Governance: missing review -> INFO (sh:severity override).
        {
          path: "reviewStatus",
          datatype: "string",
          minCount: 1,
          severity: "info",
        },
      ],
    },
  ];
}

export function Va29ShaclReport({ live = false }: { live?: boolean }) {
  // Reuse the algorithm fixture's satellite graph; seed properties so
  // the report is a realistic MIX of all three tiers, not uniform:
  // - PDU/FlightComputer have partNumber (clears their violation)
  // - PDU has a malformed serial (warning); Bus has a valid one
  // - only PDU has been reviewed; everything else trips the info rule
  const ugm = useMemo(() => {
    const g = va26Graph();
    g.updateNodeProperties("PDU", {
      partNumber: "PDU-001",
      serial: "BADSERIAL",
      reviewStatus: "approved",
    });
    g.updateNodeProperties("FlightComputer", { partNumber: "FC-7" });
    g.updateNodeProperties("Bus", { serial: "SN-0042" });
    return g;
  }, []);

  const report = useMemo(() => {
    const results = validateShacl(ugm, va29Shapes());
    return reportFromValidationResults(results);
  }, [ugm]);

  const [cy, setCy] = useState<Core | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [spec, setSpec] = useState<EncodingSpec>({
    version: 1,
    node: { label: { driver: "label" } },
    edge: {},
  });

  const overlayIds = useMemo(
    () => severityOverlays(report).map((o) => o.id),
    [report],
  );

  const loadReport = () => {
    // Mechanism 1: severity tiers as overlays (toggleable, dimming).
    for (const overlay of severityOverlays(report)) {
      useOverlayStore.getState().register(overlay, true);
    }
    // Mechanism 2: count/severity as encoding drivers.
    ingestAlgorithmResults(ugm, shaclResultDrivers(report));
    setSpec((prev) => ({
      ...prev,
      node: {
        ...prev.node,
        color: {
          driver: "_shacl_maxSeverity",
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
        size: {
          driver: "_shacl_resultCount",
          scale: { kind: "sequential", domain: "auto", range: [20, 44] },
        },
      },
    }));
    setLoaded(true);
  };

  const clearReport = () => {
    for (const id of overlayIds) useOverlayStore.getState().unregister(id);
    setSpec({
      version: 1,
      node: { label: { driver: "label" } },
      edge: {},
    });
    setLoaded(false);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gap: 12,
        minWidth: 0,
        alignItems: "start",
      }}
    >
      <div className="g3t-panel va26-left">
        <div className="g3t-panel-section-header">SHACL report (B1)</div>
        <p className="va-derived" style={{ fontSize: 12, padding: "0 8px" }}>
          ComponentShape requires name (present) and partNumber (only PDU and
          FlightComputer have one), so most Components carry a violation.{" "}
          {report.results.length} results,{" "}
          {report.conforms ? "conforms" : "does not conform"}.
        </p>
        <div style={{ display: "flex", gap: 8, padding: 8 }}>
          {!loaded ? (
            <button className="g3t-button" onClick={loadReport}>
              Load validation report
            </button>
          ) : (
            <button className="g3t-button" onClick={clearReport}>
              Clear report
            </button>
          )}
        </div>
        {loaded ? (
          <>
            <div className="g3t-panel-section-header" style={{ marginTop: 10 }}>
              severity tiers (toggle each); color/size driven by the report
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                padding: "0 8px 8px",
              }}
            >
              {overlayIds.map((id) => (
                <button
                  key={id}
                  className="g3t-button"
                  onClick={() => useOverlayStore.getState().toggle(id)}
                >
                  toggle {id.replace("shacl-", "")}
                </button>
              ))}
            </div>
            <SpecLegend ugm={ugm} spec={spec} />
          </>
        ) : null}
      </div>
      <div className="g3t-panel va26-right" style={{ padding: 0 }}>
        <GraphToolbar ugm={ugm} cy={cy} />
        {live ? (
          <CytoscapeCanvas
            ugm={ugm}
            encodingSpec={spec}
            className="va-canvas-host"
            onReady={setCy}
          />
        ) : (
          <p className="va-derived" style={{ padding: 12 }}>
            canvas mounts in the browser; if this text persists, the island
            failed.
          </p>
        )}
      </div>
    </div>
  );
}

// ── VA-30: linked SHACL shape + data views (B4) ─────────────────────

import {
  reportFromValidationResults as reportFromResults30,
  resultSelectionIds,
  resultDetail,
  type ShaclReportResult,
} from "@g3t/core";

/** Reuse the VA-29 component shapes + data so the report is real, and
 *  show the shape canvas and data canvas side by side, linked through
 *  the selection store. Selecting a result row selects the focus node
 *  (data canvas) AND the source shape container + property row (shape
 *  canvas) at once. */
export function Va30LinkedShacl({ live = false }: { live?: boolean }) {
  // Data graph + report (same fixture family as VA-29).
  const dataUgm = useMemo(() => {
    const g = va26Graph();
    g.updateNodeProperties("PDU", {
      partNumber: "PDU-001",
      serial: "BADSERIAL",
      reviewStatus: "approved",
    });
    g.updateNodeProperties("FlightComputer", { partNumber: "FC-7" });
    g.updateNodeProperties("Bus", { serial: "SN-0042" });
    return g;
  }, []);
  const report = useMemo(
    () => reportFromResults30(validateShacl(dataUgm, va29Shapes())),
    [dataUgm],
  );

  // Shape view over the SAME shapes, so result -> shape row links land.
  const shapeInput = useMemo(() => shaclShapesToStructural(va29Shapes()), []);
  const shapeUgm = useMemo(() => {
    const g = new UGM();
    for (const n of shapeInput.nodes) {
      g.addNode(n.id, { types: ["NodeShape"] });
      for (const c of n.compartments ?? [])
        for (const r of c.rows) g.addNode(r.id, { types: ["PropertyShape"] });
    }
    return g;
  }, [shapeInput]);
  const [shapeScene, setShapeScene] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    void layoutStructural(shapeInput, { direction: "DOWN" }).then(
      (geometry) => {
        if (!cancelled) setShapeScene({ input: shapeInput, geometry });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [live, shapeInput]);

  const [selectedResult, setSelectedResult] = useState<number | null>(null);

  const selectResult = (i: number) => {
    const result = report.results[i];
    if (!result) return;
    setSelectedResult(i);
    // Cross-link: select focus node + shape container + property row
    // across BOTH canvases through the shared selection store.
    useSelectionStore.getState().selectNodes(resultSelectionIds(result));
  };

  const sevColor: Record<ShaclReportResult["severity"], string> = {
    violation: "#e03131",
    warning: "#f08c00",
    info: "#1c7ed6",
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 1fr",
          gap: 10,
          alignItems: "start",
        }}
      >
        <div className="g3t-panel" style={{ padding: 8 }}>
          <div className="g3t-panel-section-header">
            validation results ({report.results.length})
          </div>
          <p className="va-derived" style={{ fontSize: 11 }}>
            click a result: it selects the focus node (data, right) AND the
            source shape + property row (shape, middle) at once.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {report.results.map((r, i) => {
              const d = resultDetail(r);
              return (
                <button
                  key={`${r.focusNode}-${r.path ?? "node"}-${i}`}
                  className="g3t-button"
                  style={{
                    textAlign: "left",
                    borderLeft: `4px solid ${sevColor[r.severity]}`,
                    fontWeight: selectedResult === i ? 700 : 400,
                  }}
                  onClick={() => selectResult(i)}
                >
                  {d.focusNode}
                  {d.path ? ` · ${d.path}` : ""}
                  <br />
                  <span className="va-derived" style={{ fontSize: 10 }}>
                    {d.severity}
                    {d.sourceShape ? ` · ${d.sourceShape}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="g3t-panel" style={{ padding: 0 }}>
          <div className="g3t-panel-section-header">shape view</div>
          {live && shapeScene ? (
            <CytoscapeCanvas
              ugm={shapeUgm}
              structural={shapeScene}
              structuralDecorations={{
                closedContainers: closedShapeIds(va29Shapes()),
                rowSeverities: shaclRowSeverities(
                  validateShacl(dataUgm, va29Shapes()),
                ),
              }}
              className="va-canvas-host"
            />
          ) : (
            <p className="va-derived" style={{ padding: 12 }}>
              shape canvas mounts in the browser.
            </p>
          )}
        </div>
        <div className="g3t-panel" style={{ padding: 0 }}>
          <div className="g3t-panel-section-header">data view</div>
          {live ? (
            <CytoscapeCanvas ugm={dataUgm} className="va-canvas-host" />
          ) : (
            <p className="va-derived" style={{ padding: 12 }}>
              data canvas mounts in the browser.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── VA-31: obstacle-aware edge routing (segments vs taxi) ────────────

/** A layered chain (Source -> Relay -> Sink) with SKIP edges that must
 *  pass the Relay block sitting between their endpoints, plus a
 *  body-attached note edge. Under taxi (routeEdges:false) the skip
 *  edges head straight across and cut through/behind Relay; under the
 *  ELK route (routeEdges:true, the new default path) they bend around
 *  it. Forward (bypass) AND backward (ack) skips are both present:
 *  backward routes are where a basis or perpendicular-sign error in the
 *  projection would show worst. The chain edges (feed/drain) align the
 *  three blocks so the detour is pronounced. */
export function va31RoutingInput(): StructuralGraphInput {
  return {
    nodes: [
      {
        id: "Source",
        header: { stereotype: "Block", name: "Source" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [{ id: "Source.rate", text: "rate : xsd:double [1..1]" }],
          },
        ],
        ports: [{ id: "Source.out", side: "EAST" }],
      },
      {
        id: "Relay",
        header: { stereotype: "Block", name: "Relay" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [
              { id: "Relay.gain", text: "gain : xsd:double [1..1]" },
              { id: "Relay.buffer", text: "buffer : xsd:int [0..1]" },
            ],
          },
        ],
        ports: [
          { id: "Relay.in", side: "WEST" },
          { id: "Relay.out", side: "EAST" },
        ],
      },
      {
        id: "Sink",
        header: { stereotype: "Block", name: "Sink" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [{ id: "Sink.capacity", text: "capacity : xsd:int [1..1]" }],
          },
        ],
        ports: [{ id: "Sink.in", side: "WEST" }],
      },
      { id: "Annotation", width: 140, height: 44 },
    ],
    edges: [
      // Adjacent hops (declared port to declared port).
      {
        id: "feed",
        source: "Source",
        target: "Relay",
        sourcePort: "Source.out",
        targetPort: "Relay.in",
        label: "feed",
      },
      {
        id: "drain",
        source: "Relay",
        target: "Sink",
        sourcePort: "Relay.out",
        targetPort: "Sink.in",
        label: "drain",
      },
      // Forward SKIP (body ends -> synth ports): must clear the Relay
      // block sitting between Source and Sink.
      { id: "bypass", source: "Source", target: "Sink", label: "bypass" },
      // Backward SKIP, against the flow: also clears Relay.
      { id: "ack", source: "Sink", target: "Source", label: "ack" },
      // Body edge from the note (no ports): dependency to Relay.
      { id: "note", source: "Annotation", target: "Relay", kind: "dependency" },
    ],
  };
}

export function Va31Routing({ live = false }: { live?: boolean }) {
  const input = useMemo(() => va31RoutingInput(), []);
  const ugm = useMemo(() => {
    const g = new UGM();
    for (const n of input.nodes) {
      g.addNode(n.id, { types: ["Block"] });
      for (const c of n.compartments ?? [])
        for (const r of c.rows)
          g.addNode(r.id, { types: ["Property"], properties: {} });
    }
    return g;
  }, [input]);

  const [taxi, setTaxi] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);
  const [routed, setRouted] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    // Same fixture, two layouts: one without ELK routes (Cytoscape taxi
    // fallback) and one with them (the segments path under test).
    void layoutStructural(input, {
      direction: "RIGHT",
      routeEdges: false,
    }).then((geometry) => {
      if (!cancelled) setTaxi({ input, geometry });
    });
    void layoutStructural(input, {
      direction: "RIGHT",
      routeEdges: true,
    }).then((geometry) => {
      if (!cancelled) setRouted({ input, geometry });
    });
    return () => {
      cancelled = true;
    };
  }, [live, input]);

  // auto-fit: side by side on a wide screen, stacked full-width on a
  // phone (each column wants >= 320px, so a ~360px viewport shows one).
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 12,
        minWidth: 0,
        alignItems: "start",
      }}
    >
      <div className="g3t-panel" style={{ minWidth: 0, padding: 0 }}>
        <div className="g3t-panel-section-header">
          before: taxi (routeEdges: false)
        </div>
        {live && taxi ? (
          // Fixed-height wrapper: pins the canvas so its inline
          // height:100% + minHeight:400 cannot drive a resize-observer
          // growth loop in this grid (the round-24/26 VA-26 lesson,
          // applied per canvas: constant height by construction).
          <div style={{ height: 400, overflow: "hidden" }}>
            <CytoscapeCanvas
              ugm={ugm}
              structural={taxi}
              className="va-canvas-host"
            />
          </div>
        ) : (
          <p className="va-derived" style={{ padding: 12 }}>
            canvas mounts in the browser; if this text persists, the island
            failed.
          </p>
        )}
      </div>
      <div className="g3t-panel" style={{ minWidth: 0, padding: 0 }}>
        <div className="g3t-panel-section-header">
          after: routed (segments, default)
        </div>
        {live && routed ? (
          <div style={{ height: 400, overflow: "hidden" }}>
            <CytoscapeCanvas
              ugm={ugm}
              structural={routed}
              className="va-canvas-host"
            />
          </div>
        ) : (
          <p className="va-derived" style={{ padding: 12 }}>
            canvas mounts in the browser; if this text persists, the island
            failed.
          </p>
        )}
      </div>
    </div>
  );
}
