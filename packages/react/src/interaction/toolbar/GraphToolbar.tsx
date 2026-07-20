/**
 * GraphToolbar: a single-row, connected toolbar over a live canvas
 * (round 15; rebuilt round 16 after review: the first cut stacked a
 * sidebar-shaped LayoutManager and 32px overlay zoom buttons into a
 * lumpy bar).
 *
 * Anatomy: [search (flex)] [layout select] [options popover] [Run]
 * [Pin all] [zoom - + fit], every control on one 26px line; the
 * force parameters live in a popover with an EXPLICIT "Run layout"
 * commit (no live re-layout while dragging). Motion is not a toolbar
 * concern: layout animation follows prefers-reduced-motion (the
 * engine still runs either way; "animate" means you WATCH the
 * heatup/cooldown, off means you get the result without the motion).
 *
 * Pinning: "Pin all" locks every node position and disables layout
 * runs (controls disabled WITH an explanation, never silently
 * ignored). Per-node pinning is roadmapped
 * (roadmap/design/toolbar-and-layouts.md).
 *
 * Layout runs here are always DELIBERATE: this is the user-invoked
 * re-layout affordance promised in encoding-controls.md when
 * automatic re-layout was ruled out.
 */

import { useCallback, useState } from "react";
import type { Core } from "cytoscape";
import type { UGM } from "@g3t/core";
import { prefersReducedMotion } from "@g3t/core";
import { Icon } from "../../icons";
import {
  exportSubgraphTurtle,
  exportSubgraphJson,
  exportSubgraphCsv,
} from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { SearchBar } from "../search/SearchBar";
import { usePositionPinStore } from "../../state/position-pin-store";
import {
  LAYOUTS,
  DEFAULT_LAYOUT_OPTIONS,
  type LayoutOptions,
} from "../layout-manager/LayoutManager";

/** Map layout ids and options onto a Cytoscape layout config.
 *  Exported for tests. Hierarchical engines not bundled (dagre, elk)
 *  fall back to breadthfirst rather than failing; they are no longer
 *  user-selectable (round-15 review), but external callers passing
 *  those ids still get a sane result. */
/** Pure export assembly (testable without DOM downloads): exports
 *  the SELECTION when one exists, the whole graph otherwise.
 *  @see specs/02-functional-interaction.md R2.11 */
export function buildExport(
  format: "json" | "turtle" | "csv",
  ugm: UGM,
  selectedNodeIds: string[],
): { filename: string; mime: string; content: string } {
  const selection =
    selectedNodeIds.length > 0 ? { nodeIds: selectedNodeIds } : undefined;
  const scope = selection ? "selection" : "graph";
  if (format === "turtle") {
    return {
      filename: `g3t-${scope}.ttl`,
      mime: "text/turtle",
      content: exportSubgraphTurtle(ugm, selection),
    };
  }
  if (format === "csv") {
    return {
      filename: `g3t-${scope}.csv`,
      mime: "text/csv",
      content: exportSubgraphCsv(ugm, selection),
    };
  }
  return {
    filename: `g3t-${scope}.json`,
    mime: "application/json",
    content: exportSubgraphJson(ugm, selection),
  };
}

function triggerDownload(filename: string, href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function layoutConfig(
  layoutId: string,
  options: LayoutOptions,
  randomize = false,
): Record<string, unknown> {
  const animate = options.animate && !prefersReducedMotion();
  const base = {
    animate,
    animationDuration: options.animationDuration,
    fit: true,
    padding: 40,
  };
  switch (layoutId) {
    case "force":
      return {
        ...base,
        name: "fcose",
        quality: "default",
        nodeRepulsion: options.nodeRepulsion,
        idealEdgeLength: options.edgeLength,
        gravity: options.gravity,
        // Incremental by default (preserves the mental map); shuffle
        // is the deliberate escape hatch when incremental convergence
        // traps the layout in a bad local minimum (round-16 audit
        // disposition 5, shipped round 19).
        randomize,
      };
    case "hierarchy":
    case "dagre":
    case "elk":
      return {
        ...base,
        name: "breadthfirst",
        directed: true,
        spacingFactor: Math.max(0.5, options.rankSeparation / 80),
      };
    case "circle":
      return { ...base, name: "circle", spacingFactor: options.spacing / 60 };
    case "grid":
      return { ...base, name: "grid", spacingFactor: options.spacing / 60 };
    case "concentric":
      return { ...base, name: "concentric", minNodeSpacing: options.spacing };
    default:
      return { ...base, name: "fcose" };
  }
}

/** Run a layout deliberately. No-op without a cy handle; degrades
 *  fcose to cose when the extension is unregistered in a host. */
export function runGraphLayout(
  cy: Core | null,
  layoutId: string,
  options: LayoutOptions,
  randomize = false,
): void {
  if (!cy) return;
  let config = layoutConfig(layoutId, options, randomize);
  try {
    cy.layout(config as never).run();
  } catch {
    config = { ...config, name: "cose" };
    cy.layout(config as never).run();
  }
}

export interface GraphToolbarProps {
  ugm: UGM;
  /** From CytoscapeCanvas onReady; null until the canvas mounts. */
  cy: Core | null;
  className?: string;
}

export function GraphToolbar({
  ugm,
  cy: cyProp,
  className,
}: GraphToolbarProps) {
  // 9.9: shells hand the toolbar a live-instance handle that can go
  // STALE between a canvas unmount and its successor's onReady (the
  // workbench's instances -> neighborhood swap is the reproduced
  // case; search then animated a destroyed instance and crashed the
  // view). A destroyed instance is treated as absent: every control
  // no-ops until a live handle arrives, instead of the shell having
  // to reset on every swap path.
  const cy =
    cyProp !== null &&
    (typeof cyProp.destroyed !== "function" || !cyProp.destroyed())
      ? cyProp
      : null;
  const [layoutId, setLayoutId] = useState("force");
  const [options, setOptions] = useState<LayoutOptions>(DEFAULT_LAYOUT_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const pinned = usePositionPinStore((s) => s.allPinned);
  const setAllPinned = usePositionPinStore((s) => s.setAllPinned);

  const run = useCallback(
    (id: string, opts: LayoutOptions) => runGraphLayout(cy, id, opts),
    [cy],
  );

  // 12.9: typing only filters; the camera moves on an EXPLICIT pick,
  // centering the picked node (not the first match).
  const handlePick = useCallback(
    (id: string) => {
      if (!cy) return;
      const ele = cy.getElementById(id);
      if (ele.nonempty()) {
        cy.animate(
          { center: { eles: ele }, zoom: Math.max(cy.zoom(), 1.2) },
          { duration: prefersReducedMotion() ? 0 : 250 },
        );
      }
    },
    [cy],
  );

  // Locking is the canvas pin effect's job (single source of truth:
  // the pin store); the toolbar only flips the whole-graph flag.
  // Releasing returns to the per-node pin set by construction.
  const togglePin = useCallback(
    () => setAllPinned(!pinned),
    [pinned, setAllPinned],
  );

  const pinTitle = pinned
    ? "All node positions are pinned; layout runs are disabled until unpinned"
    : "Pin every node position (disables layout runs)";

  const isForce = LAYOUTS.find((l) => l.id === layoutId)?.group === "force";

  return (
    <div
      className={`g3t-graph-toolbar ${className ?? ""}`}
      data-testid="g3t-graph-toolbar"
    >
      <SearchBar
        ugm={ugm}
        onSearchChange={() => undefined}
        onPick={handlePick}
        placeholder="Search nodes…"
        className="g3t-graph-toolbar-search"
      />

      <div className="g3t-graph-toolbar-group">
        <select
          className="g3t-select"
          aria-label="Layout"
          value={layoutId}
          disabled={pinned}
          title={pinned ? pinTitle : undefined}
          onChange={(e) => {
            setLayoutId(e.target.value);
            run(e.target.value, options);
          }}
        >
          {LAYOUTS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="g3t-graph-toolbar-popover-host">
          <button
            className="g3t-btn g3t-btn-ghost"
            aria-expanded={optionsOpen}
            aria-label="Layout options"
            disabled={pinned}
            title={pinned ? pinTitle : "Layout options"}
            onClick={() => setOptionsOpen(!optionsOpen)}
          >
            <Icon name="settings" size={12} />
          </button>
          {optionsOpen ? (
            <div
              className="g3t-graph-toolbar-popover"
              data-testid="toolbar-layout-options"
            >
              {isForce ? (
                <>
                  <PopoverSlider
                    label="Repulsion"
                    value={options.nodeRepulsion}
                    min={1000}
                    max={20000}
                    step={500}
                    onChange={(nodeRepulsion) =>
                      setOptions({ ...options, nodeRepulsion })
                    }
                  />
                  <PopoverSlider
                    label="Edge length"
                    value={options.edgeLength}
                    min={20}
                    max={300}
                    step={10}
                    onChange={(edgeLength) =>
                      setOptions({ ...options, edgeLength })
                    }
                  />
                  <PopoverSlider
                    label="Gravity"
                    value={options.gravity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(gravity) => setOptions({ ...options, gravity })}
                  />
                </>
              ) : (
                <PopoverSlider
                  label="Spacing"
                  value={options.spacing}
                  min={20}
                  max={200}
                  step={10}
                  onChange={(spacing) => setOptions({ ...options, spacing })}
                />
              )}
              <button
                className="g3t-btn"
                data-testid="toolbar-run-layout"
                onClick={() => run(layoutId, options)}
              >
                Run layout
              </button>
            </div>
          ) : null}
        </div>

        <button
          className="g3t-btn g3t-btn-ghost"
          data-testid="toolbar-rerun"
          disabled={pinned}
          title={pinned ? pinTitle : "Re-run the current layout"}
          onClick={() => run(layoutId, options)}
        >
          <Icon name="refresh" size={12} /> Re-run
        </button>

        <button
          className="g3t-btn g3t-btn-ghost"
          data-testid="toolbar-shuffle"
          disabled={pinned || !isForce}
          title={
            pinned
              ? pinTitle
              : isForce
                ? "Re-run the force layout from randomized positions (escape a bad local minimum)"
                : "Shuffle applies to force layouts"
          }
          onClick={() => runGraphLayout(cy, layoutId, options, true)}
        >
          Shuffle
        </button>

        <div style={{ position: "relative" }}>
          <button
            className="g3t-btn g3t-btn-ghost"
            data-testid="toolbar-export"
            aria-expanded={exportOpen}
            title="Export the selection (or the whole graph) as data or image"
            onClick={() => setExportOpen(!exportOpen)}
          >
            Export{" "}
            <Icon name={exportOpen ? "chevron-up" : "chevron-down"} size={10} />
          </button>
          {exportOpen ? (
            <div
              className="g3t-menu"
              role="menu"
              style={{ position: "absolute", top: "100%", left: 0, zIndex: 30 }}
            >
              {(["json", "turtle", "csv"] as const).map((format) => (
                <button
                  key={format}
                  className="g3t-menu-item"
                  data-testid={`export-${format}`}
                  role="menuitem"
                  onClick={() => {
                    const { filename, mime, content } = buildExport(
                      format,
                      ugm,
                      [...useSelectionStore.getState().selectedNodeIds],
                    );
                    const url = URL.createObjectURL(
                      new Blob([content], { type: mime }),
                    );
                    triggerDownload(filename, url);
                    URL.revokeObjectURL(url);
                    setExportOpen(false);
                  }}
                >
                  {format === "json"
                    ? "JSON (subgraph)"
                    : format === "turtle"
                      ? "Turtle (RDF)"
                      : "CSV (tables)"}
                </button>
              ))}
              <button
                className="g3t-menu-item"
                data-testid="export-png"
                role="menuitem"
                onClick={() => {
                  if (!cy) return;
                  triggerDownload(
                    "g3t-canvas.png",
                    cy.png({ full: true, scale: 2 }),
                  );
                  setExportOpen(false);
                }}
              >
                PNG (canvas, 2x)
              </button>
            </div>
          ) : null}
        </div>

        <button
          className="g3t-btn g3t-btn-ghost"
          data-testid="toolbar-pin-all"
          aria-pressed={pinned}
          title={pinTitle}
          onClick={togglePin}
        >
          <Icon name="lock" size={12} /> Pin all
        </button>
      </div>

      <div className="g3t-graph-toolbar-group" role="group" aria-label="Zoom">
        <button
          className="g3t-btn g3t-btn-ghost"
          data-testid="toolbar-zoom-out"
          aria-label="Zoom out"
          onClick={() => cy?.zoom(cy.zoom() * 0.8)}
        >
          −
        </button>
        <button
          className="g3t-btn g3t-btn-ghost"
          data-testid="toolbar-zoom-in"
          aria-label="Zoom in"
          onClick={() => cy?.zoom(cy.zoom() * 1.25)}
        >
          +
        </button>
        <button
          className="g3t-btn g3t-btn-ghost"
          data-testid="toolbar-fit"
          onClick={() => cy?.fit(undefined, 40)}
        >
          Fit
        </button>
      </div>
    </div>
  );
}

function PopoverSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="g3t-enc-field">
      <span className="g3t-enc-valuename">{label}</span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span>{value}</span>
    </label>
  );
}
