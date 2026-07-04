/**
 * The MBSE workbench shell: a Cameo-style layout where the containment tree
 * (model browser) drives a linked diagram canvas. Selecting a diagram in the
 * tree projects its typed view (projectDiagram) and lays it out for the
 * structural renderer, so the same graph engine renders a BDD, an IBD (parts
 * + ports + connectors), a parametric, or a requirement breakdown depending
 * on what the author put on the diagram. The right inspector explains the
 * open diagram's notation, so the view reads as a modeling tool rather than a
 * generic graph.
 */
import { useEffect, useMemo, useState } from "react";
import { CytoscapeCanvas } from "@g3t/react";
import {
  layoutStructural,
  UGM,
  type StructuralGeometry,
  type StructuralGraphInput,
} from "@g3t/core";
import { satelliteModel } from "./model";
import { projectDiagram } from "./diagrams";
import { ContainmentTree } from "./ContainmentTree";
import type { DiagramType } from "./model";
import { MBSE_STYLES } from "./styles";
import { CapabilityCallout } from "../components/CapabilityCallout";
import { usePrefersReducedMotion } from "../components/usePrefersReducedMotion";

const DIRECTION: Record<DiagramType, "DOWN" | "RIGHT"> = {
  bdd: "DOWN",
  req: "DOWN",
  ibd: "RIGHT",
  par: "RIGHT",
};

const NOTATION: Record<
  DiagramType,
  { title: string; blurb: string; legend: { mark: string; text: string }[] }
> = {
  bdd: {
    title: "Block Definition Diagram",
    blurb:
      "Blocks and their structural relationships. Value properties sit in the values compartment; composition shows the system decomposed into subsystems.",
    legend: [
      { mark: "\u25C6\u2500", text: "composition (whole owns part)" },
      { mark: "\u25C7\u2500", text: "aggregation (shared)" },
      { mark: "\u2500\u25B7", text: "generalization" },
    ],
  },
  ibd: {
    title: "Internal Block Diagram",
    blurb:
      "The internal wiring of a block: parts (role : Type) connected through their ports. Power distribution, data path, and RF downlink are separate connector flows.",
    legend: [
      { mark: "\u25A0", text: "port (typed flow point)" },
      { mark: "\u2500\u2500", text: "connector between part ports" },
    ],
  },
  par: {
    title: "Parametric Diagram",
    blurb:
      "A constraint block binds engineering values to its parameters. The equation holds across the model; here solar array power and payload draw feed the power margin.",
    legend: [
      { mark: "{ }", text: "constraint equation" },
      { mark: "\u25A0", text: "parameter port" },
    ],
  },
  req: {
    title: "Requirement Diagram",
    blurb:
      "The mission requirement broken into leaves, with the subsystem blocks that satisfy each one. Containment shows the breakdown; satisfy links trace to design.",
    legend: [
      { mark: "\u25C6\u2500", text: "containment (parent/child)" },
      {
        mark: "\u2504\u25B7",
        text: "\u00ABsatisfy\u00BB (block \u2192 requirement)",
      },
    ],
  },
};

export function MbseShell({ onBack }: { onBack: () => void }) {
  // Structural mode renders the laid-out scene, not the UGM projection, but
  // the canvas prop is required and must be referentially stable; an empty
  // graph is the right identity here (the diagram drives everything).
  const [ugm] = useState(() => new UGM());
  const [diagramId, setDiagramId] = useState("dg.bdd");
  const diagram = satelliteModel.diagrams[diagramId];
  const type: DiagramType = diagram?.type ?? "bdd";

  const input: StructuralGraphInput = useMemo(
    () => projectDiagram(satelliteModel, diagramId),
    [diagramId],
  );

  const reducedMotion = usePrefersReducedMotion();
  const [laidOut, setLaidOut] = useState<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void layoutStructural(input, { direction: DIRECTION[type] }).then(
      (geometry) => {
        if (!cancelled) setLaidOut({ input, geometry });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [input, type]);

  // Render only a scene laid out for the CURRENT input; a stale scene from
  // the previous diagram reads as loading. This derives what the old
  // synchronous setScene(null) reset expressed, without setState-in-effect
  // (input is useMemo'd on diagramId, so identity comparison is sound).
  const scene = laidOut && laidOut.input === input ? laidOut : null;

  const notation = NOTATION[type];

  return (
    <div className="mbse-shell">
      <style>{MBSE_STYLES}</style>

      <header className="mbse-topbar">
        <button type="button" className="mbse-back" onClick={onBack}>
          {"\u2190"} Scenarios
        </button>
        <div className="mbse-wordmark">
          <b>SysML Workbench</b>
          <span>satellite model</span>
        </div>
        <div className="mbse-diagram-title">
          <span className={`mbse-diagram-badge mbse-badge-${type}`}>
            {type.toUpperCase()}
          </span>
          {diagram?.name ?? ""}
        </div>
      </header>

      <div className="mbse-body">
        <aside className="mbse-browser">
          <div className="mbse-panel-head">Model Browser</div>
          <ContainmentTree
            model={satelliteModel}
            activeDiagramId={diagramId}
            onOpenDiagram={setDiagramId}
          />
        </aside>

        <main className="mbse-canvas-wrap">
          {scene ? (
            <CytoscapeCanvas
              ugm={ugm}
              structural={scene}
              animate={!reducedMotion}
            />
          ) : (
            <div className="mbse-empty">
              Laying out {diagram?.name ?? "diagram"}
              {"\u2026"}
            </div>
          )}
        </main>

        <aside className="mbse-inspector">
          <div className="mbse-panel-head">Diagram</div>
          <div className="mbse-insp-section">
            <div className="mbse-insp-title">{notation.title}</div>
            <div className="mbse-insp-text">{notation.blurb}</div>
          </div>
          <div className="mbse-panel-head">Notation</div>
          <div className="mbse-insp-section">
            {notation.legend.map((l) => (
              <div className="mbse-legend-row" key={l.text}>
                <span className="mbse-legend-mark mbse-mono">{l.mark}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
          <div className="mbse-panel-head">Contents</div>
          <div className="mbse-insp-section mbse-insp-text">
            <div>
              <span className="mbse-count">{input.nodes.length}</span> elements
            </div>
            <div>
              <span className="mbse-count">{input.edges.length}</span>{" "}
              relationships
            </div>
          </div>
          <CapabilityCallout
            accent="#f97316"
            items={[
              {
                mechanism: "layoutStructural",
                anchor: "lay-out-a-structural-uml-style-view",
                how: "lays out each diagram with ELK, emitting obstacle-aware edge routes.",
              },
              {
                mechanism: "CytoscapeCanvas structural",
                anchor: "lay-out-a-structural-uml-style-view",
                how: "renders blocks with headers, compartments, and ports from the laid-out scene.",
              },
              {
                mechanism: "projectDiagram (pure)",
                how: "projects one SysML model into four typed diagram views, tested headlessly.",
              },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
