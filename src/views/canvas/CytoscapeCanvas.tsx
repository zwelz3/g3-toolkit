/**
 * CytoscapeCanvas: React wrapper around Cytoscape.js.
 *
 * Accepts a UGM instance, maps it to Cytoscape elements, and renders
 * with the Okabe-Ito colorblind-safe palette (R7.8).
 *
 * @see specs/01-functional-views.md R1.1
 * @see specs/09-design-decisions.md D2, D9, D13
 */

import { useRef, useEffect, useCallback } from "react";
import cytoscape, { type Core } from "cytoscape";

type CyStylesheet = cytoscape.StylesheetCSS | cytoscape.StylesheetStyle;
import fcose from "cytoscape-fcose";
import type { UGM } from "@core/ugm";
import { ugmToCytoscapeElements } from "./ugm-to-cytoscape";

// Register fcose layout extension (once, at module load)
let fcoseRegistered = false;

function ensureFcose(): void {
  if (fcoseRegistered) return;
  try {
    cytoscape.use(fcose);
    fcoseRegistered = true;
  } catch {
    // fcose registration failed; fall back to built-in layouts
  }
}

/**
 * Default Cytoscape stylesheet.
 *
 * Visual encoding rules:
 * - Node shape and color from palette (types[0] index)
 * - Node label from properties.name or id
 * - Node size from properties.size or default 30
 * - Edge color from type (future: type-indexed palette)
 * - Edge opacity from confidence (D1)
 * - Edge style: solid if asserted, dashed if inferred (D9)
 * - Directed edges get arrowheads
 */
/* eslint-disable @typescript-eslint/no-explicit-any --
   Cytoscape's TS types don't accept "data(x)" strings for shape/opacity
   even though they work at runtime. We cast style objects to any. */
const DEFAULT_STYLESHEET: CyStylesheet[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": "data(_color)",
      shape: "data(_shape)",
      width: "data(_size)",
      height: "data(_size)",
      "text-valign": "bottom",
      "text-halign": "center",
      "font-size": "10px",
      "text-margin-y": 4,
      "min-zoomed-font-size": 8,
      color: "#333",
    } as any,
  },
  {
    selector: "edge",
    style: {
      label: "data(label)",
      width: 2,
      "line-color": "#888",
      "target-arrow-color": "#888",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "font-size": "8px",
      "text-rotation": "autorotate",
      opacity: "data(_confidence)",
    } as any,
  },
  {
    selector: "edge[_asserted = false]",
    style: {
      "line-style": "dashed",
      "line-dash-pattern": [6, 3],
    } as any,
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#2563eb",
    },
  },
  {
    selector: "edge:selected",
    style: {
      "line-color": "#2563eb",
      "target-arrow-color": "#2563eb",
      width: 3,
    },
  },
];

export interface CytoscapeCanvasProps {
  /** The UGM instance to render. */
  ugm: UGM;
  /** Optional layout name (default: "fcose" if available, else "cose"). */
  layout?: string;
  /** Optional additional stylesheet rules to merge. */
  stylesheet?: CyStylesheet[];
  /** Callback when the Cytoscape core is ready. */
  onReady?: (cy: Core) => void;
  /** CSS class for the container div. */
  className?: string;
}

export function CytoscapeCanvas({
  ugm,
  layout,
  stylesheet,
  onReady,
  className,
}: CytoscapeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const initCytoscape = useCallback(() => {
    if (!containerRef.current) return;

    // Clean up previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    ensureFcose();

    const elements = ugmToCytoscapeElements(ugm);
    const mergedStylesheet = stylesheet
      ? [...DEFAULT_STYLESHEET, ...stylesheet]
      : DEFAULT_STYLESHEET;

    const layoutName = layout ?? (fcoseRegistered ? "fcose" : "cose");

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: mergedStylesheet,
      layout: {
        name: layoutName,
        animate: false,
      } as cytoscape.LayoutOptions,
    });

    cyRef.current = cy;
    onReady?.(cy);
  }, [ugm, layout, stylesheet, onReady]);

  useEffect(() => {
    initCytoscape();
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [initCytoscape]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 400 }}
      data-testid="cytoscape-canvas"
    />
  );
}
