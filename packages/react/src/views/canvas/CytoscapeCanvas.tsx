/**
 * CytoscapeCanvas: React wrapper around Cytoscape.js.
 *
 * Accepts a UGM instance, maps it to Cytoscape elements, and renders
 * with the Okabe-Ito colorblind-safe palette (R7.8).
 *
 * @see specs/01-functional-views.md R1.1
 * @see specs/02-functional-interaction.md R2.1, R2.2
 * @see specs/09-design-decisions.md D2, D3, D9, D13
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import cytoscape, { type Core } from "cytoscape";
import fcose from "cytoscape-fcose";
import type { UGM } from "@g3t/core";
import {
  ContextMenuManager,
  createDefaultMenuManager,
} from "../../interaction/context-menu";
import type { MenuTarget } from "../../interaction/context-menu";
import { ContextMenu } from "../../interaction/context-menu";
import { useSelectionStore } from "../../state/selection-store";
import { ugmToCytoscapeElements } from "./ugm-to-cytoscape";

type CyStylesheet = cytoscape.StylesheetCSS | cytoscape.StylesheetStyle;

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
 * - Edge opacity from confidence (D1)
 * - Edge style: solid if asserted (_asserted=1), dashed if inferred (_asserted=0) (D9)
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
      // Bugfix 6: cartographic halo style - readable on light AND dark
      // backgrounds without per-theme branching
      color: "#e0e0e0",
      "text-outline-color": "#1a1a1a",
      "text-outline-width": 2,
      "text-outline-opacity": 0.8,
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
      // F8: curve-style set dynamically via buildEdgeStyle()
      // Bugfix 21: default to straight - cleaner for the common case of
      // a single edge between two distinct nodes. The selector rule
      // immediately below this one overrides to bezier when the edge
      // is part of a parallel set, a bidirectional pair, or a loop;
      // see ugmToCytoscapeElements which marks _curveStyle per edge.
      "curve-style": "straight",
      "font-size": "8px",
      "text-rotation": "autorotate",
      opacity: "data(_confidence)",
      // F7: Link label styling (Bugfix 6: dark bg readable on dark canvas)
      "text-background-color": "#222",
      "text-background-opacity": 0.7,
      "text-background-padding": "3px",
      "text-border-color": "#555",
      "text-border-width": 1,
      "text-border-opacity": 0.6,
      color: "#ddd",
    } as any,
  },
  {
    // Bugfix 21: bezier override for edges that need the curve.
    // ugmToCytoscapeElements sets _curveStyle = "bezier" for self-loops,
    // parallel multi-edges, and bidirectional pairs.
    selector: 'edge[_curveStyle = "bezier"]',
    style: {
      "curve-style": "bezier",
    } as any,
  },
  {
    selector: "edge[_asserted = 0]",
    style: {
      "line-style": "dashed",
      "line-dash-pattern": [6, 3],
    } as any,
  },
  {
    selector: "node.g3t-selected",
    style: {
      "border-width": 3,
      "border-color": "#2563eb",
    } as any,
  },
  {
    selector: "edge.g3t-selected",
    style: {
      "line-color": "#2563eb",
      "target-arrow-color": "#2563eb",
      width: 3,
    } as any,
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface CytoscapeCanvasProps {
  /** The UGM instance to render. */
  ugm: UGM;
  /** Optional layout name (default: "fcose" if available, else "cose"). */
  layout?: string;
  /** Optional additional stylesheet rules to merge. */
  stylesheet?: CyStylesheet[];
  /** Optional ContextMenuManager. If omitted, a default is created.
   *  Pass a menuManager with callbacks to handle "Inspect properties"
   *  and "Copy IRI" actions. */
  menuManager?: ContextMenuManager;
  /** Callback when the Cytoscape core is ready. */
  onReady?: (cy: Core) => void;
  /** CSS class for the container div. */
  className?: string;
  /** F1: Animate layout transitions. Default true. */
  animate?: boolean;
  /** F1: Animation duration in ms. Default 400. */
  animationDuration?: number;
  /**
   * F8: Edge curve style override. When set, applies the given style
   * to ALL edges regardless of their topology. When NOT set (default),
   * edges auto-select straight vs bezier based on whether the curve
   * is actually needed (see bugfix 21 in ugmToCytoscapeElements):
   * straight for the common single-edge case, bezier for self-loops,
   * parallel multi-edges, and bidirectional pairs.
   */
  edgeStyle?: "bezier" | "straight" | "taxi";
}

export function CytoscapeCanvas({
  ugm,
  layout,
  stylesheet,
  menuManager,
  onReady,
  className,
  animate = true,
  animationDuration = 400,
  edgeStyle,
}: CytoscapeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Context menu state
  const [menuState, setMenuState] = useState<{
    target: MenuTarget;
    items: ReturnType<ContextMenuManager["resolve"]>;
  } | null>(null);

  // Create menu manager once (stable across renders).
  // Parent can provide a custom manager via menuManager prop to
  // add inspect/copy callbacks; the default has no-op actions.
  const [manager] = useState(() => menuManager ?? createDefaultMenuManager());

  // Bugfix 3: stash callbacks/objects in refs so the initCytoscape
  // identity stays stable across renders. Without these, every parent
  // render produces new `onReady` and `stylesheet` props, which would
  // re-create initCytoscape, which would re-fire the useEffect, which
  // would destroy + rebuild the Cytoscape instance — a jitter loop.
  const onReadyRef = useRef(onReady);
  // eslint-disable-next-line react-hooks/refs
  onReadyRef.current = onReady;
  const stylesheetRef = useRef(stylesheet);
  // eslint-disable-next-line react-hooks/refs
  stylesheetRef.current = stylesheet;

  const initCytoscape = useCallback((): (() => void) | undefined => {
    if (!containerRef.current) return undefined;

    // Clean up previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    ensureFcose();

    const elements = ugmToCytoscapeElements(ugm);
    // Bugfix 2: scatter initial positions so Cytoscape doesn't briefly
    // see every node at (0, 0) before layout runs. The "invalid endpoints"
    // warning fires when edges connect nodes occupying the same point.
    for (const el of elements) {
      if (el.group === "nodes" && !el.position) {
        el.position = {
          x: Math.random() * 600 - 300,
          y: Math.random() * 400 - 200,
        };
      }
    }

    // F8: Map edgeStyle prop to Cytoscape curve-style.
    // Bugfix 21: when edgeStyle is undefined (the new default), DON'T
    // emit a global override - the per-edge _curveStyle in the data
    // does the right thing via the selector rules in DEFAULT_STYLESHEET.
    // The override only kicks in when the consumer explicitly forces
    // a style for all edges.
    const mergedStylesheet: CyStylesheet[] = [...DEFAULT_STYLESHEET];
    if (edgeStyle !== undefined) {
      const curveStyle =
        edgeStyle === "taxi"
          ? "taxi"
          : edgeStyle === "straight"
            ? "straight-triangle"
            : "unbundled-bezier";
      mergedStylesheet.push({
        selector: "edge",
        style: {
          "curve-style": curveStyle,
          ...(edgeStyle === "taxi"
            ? { "taxi-direction": "auto", "taxi-turn": "50px" }
            : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
    }
    // Bugfix 3: read from ref (see comment near onReadyRef above)
    if (stylesheetRef.current) {
      mergedStylesheet.push(...stylesheetRef.current);
    }

    const layoutName = layout ?? (fcoseRegistered ? "fcose" : "cose");

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: mergedStylesheet,
      // Bugfix 14: enable scroll-wheel zoom + drag-pan explicitly.
      // These are Cytoscape defaults but stating them defensively
      // here makes the behavior intentional in case someone sets
      // these elsewhere via cy.userZoomingEnabled() / etc.
      userZoomingEnabled: true,
      userPanningEnabled: true,
      // wheelSensitivity intentionally LEFT at cytoscape's default to
      // avoid the "wheelSensitivity not recommended" warning. Override
      // via cy.wheelSensitivity() after onReady if needed for trackpads.
      boxSelectionEnabled: true, // lasso multi-select (M1.E3.T3)
      layout: {
        name: layoutName,
        animate,
        animationDuration,
        // Layout tuning for better spread
        ...(layoutName === "cose"
          ? {
              idealEdgeLength: 80,
              nodeRepulsion: 8000,
              gravity: 0.25,
              edgeElasticity: 100,
            }
          : {}),
        ...(layoutName === "fcose"
          ? {
              idealEdgeLength: 100,
              nodeRepulsion: 10000,
              gravity: 0.2,
              gravityRange: 1.5,
            }
          : {}),
      } as cytoscape.LayoutOptions,
    });

    // Wire right-click context menu (R2.1, R2.2, D3)
    // Bugfix 8: suppress the browser's native contextmenu so it doesn't
    // appear alongside our custom menu. Cytoscape's `cxttap` fires on
    // right-mouse-up but does NOT preventDefault — without this listener
    // both menus show.
    const suppressNativeContextMenu = (e: MouseEvent) => e.preventDefault();
    containerRef.current.addEventListener(
      "contextmenu",
      suppressNativeContextMenu,
    );

    cy.on("cxttap", "node", (evt) => {
      const node = evt.target;
      const pos = evt.renderedPosition ?? evt.position;
      const rect = containerRef.current?.getBoundingClientRect();
      const target: MenuTarget = {
        type: "node",
        id: node.id(),
        position: {
          x: (rect?.left ?? 0) + pos.x,
          y: (rect?.top ?? 0) + pos.y,
        },
        data: node.data(),
      };
      const items = manager.resolve(target);
      if (items.length > 0) {
        setMenuState({ target, items });
      }
    });

    cy.on("cxttap", "edge", (evt) => {
      const edge = evt.target;
      const pos = evt.renderedPosition ?? evt.position;
      const rect = containerRef.current?.getBoundingClientRect();
      const target: MenuTarget = {
        type: "edge",
        id: edge.id(),
        position: {
          x: (rect?.left ?? 0) + pos.x,
          y: (rect?.top ?? 0) + pos.y,
        },
        data: edge.data(),
      };
      const items = manager.resolve(target);
      if (items.length > 0) {
        setMenuState({ target, items });
      }
    });

    // Background right-click
    cy.on("cxttap", (evt) => {
      if (evt.target === cy) {
        const pos = evt.renderedPosition ?? evt.position;
        const rect = containerRef.current?.getBoundingClientRect();
        const target: MenuTarget = {
          type: "background",
          position: {
            x: (rect?.left ?? 0) + pos.x,
            y: (rect?.top ?? 0) + pos.y,
          },
        };
        const items = manager.resolve(target);
        if (items.length > 0) {
          setMenuState({ target, items });
        }
      }
    });

    // Close menu on left-click anywhere
    cy.on("tap", () => {
      setMenuState(null);
    });

    // Wire selection store to canvas (M1.E1.T2)
    //
    // Architecture: ONE-WAY data flow, no feedback loops.
    // - User actions (tap, box-select) → write to Zustand store
    // - Store changes → apply CSS class "g3t-selected" (NOT cy.select())
    // - cy.select()/unselect() are NEVER called, so no Cytoscape
    //   selection events fire, eliminating bidirectional sync races.
    const {
      selectNodes,
      selectEdges,
      clearSelection,
      addNodesToSelection,
      toggleNodeSelection,
    } = useSelectionStore.getState();

    // Node tap: single-select, ctrl-toggle, shift-add
    cy.on("tap", "node", (evt) => {
      const nodeId = evt.target.id();
      if (evt.originalEvent.ctrlKey || evt.originalEvent.metaKey) {
        toggleNodeSelection(nodeId);
      } else if (evt.originalEvent.shiftKey) {
        addNodesToSelection([nodeId]);
      } else {
        selectNodes([nodeId]);
      }
    });

    cy.on("tap", "edge", (evt) => {
      selectEdges([evt.target.id()]);
    });

    // Background tap clears selection
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        clearSelection();
      }
    });

    // Lasso (box) selection: read Cytoscape's internal :selected
    // state and push to the store. We never write BACK to :selected;
    // visual highlighting uses the .g3t-selected CSS class instead.
    cy.on("boxend", () => {
      const boxedNodes = cy.nodes(":selected").map((n) => n.id());
      // Clear Cytoscape's internal selection (we use classes, not :selected)
      cy.elements().unselect();
      if (boxedNodes.length > 0) {
        selectNodes(boxedNodes);
      }
    });

    // Subscribe to selection store; sync visual state via CSS classes.
    // addClass/removeClass do NOT fire selection events, so no loop.
    const unsub = useSelectionStore.subscribe((state) => {
      cy.batch(() => {
        cy.elements().removeClass("g3t-selected");
        for (const id of state.selectedNodeIds) {
          const el = cy.getElementById(id);
          if (el.length > 0) el.addClass("g3t-selected");
        }
        for (const id of state.selectedEdgeIds) {
          const el = cy.getElementById(id);
          if (el.length > 0) el.addClass("g3t-selected");
        }
      });
    });

    cyRef.current = cy;
    // Bugfix 3: read from ref (see comment near onReadyRef above)
    onReadyRef.current?.(cy);

    // Return cleanup: unsubscribe store + remove the native-contextmenu
    // listener (Bugfix 8). The container survives across cy rebuilds, so
    // we'd accumulate listeners without explicit removal.
    const container = containerRef.current;
    return () => {
      unsub();
      container.removeEventListener("contextmenu", suppressNativeContextMenu);
    };
    // Bugfix 3: dep array is data + config only. `stylesheet`, `onReady`,
    // and `manager` previously appeared here, but their identity changes
    // every parent render — those are now read from refs or treated as
    // stable. eslint correctly notices the missing deps; we suppress
    // because we know they are stable-by-ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ugm, layout, edgeStyle, animate, animationDuration]);

  useEffect(() => {
    const unsub = initCytoscape();
    return () => {
      unsub?.();
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [initCytoscape]);

  // Bugfix 16: belt-and-suspenders contextmenu suppression. We already
  // attach a native contextmenu listener inside initCytoscape (bugfix
  // 8), but a user reported the OS menu STILL appearing behind ours -
  // probably because the native listener was being cleaned up around
  // re-renders, or because the event was firing on an element that
  // didn't propagate to the container ref for whatever reason. React's
  // synthetic onContextMenu runs at the document level and is
  // guaranteed to fire as long as the div is mounted; it's also
  // simpler than managing native listener lifecycle. We keep BOTH
  // because:
  //   - Native listener catches contextmenu events fired on
  //     descendants that React's synthetic system might miss (e.g.
  //     events on dynamically inserted canvases inside cytoscape).
  //   - React handler covers anything the native handler doesn't.
  const suppressContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onContextMenu={suppressContextMenu}
    >
      <div
        ref={containerRef}
        className={className}
        style={{ width: "100%", height: "100%", minHeight: 400 }}
        data-testid="cytoscape-canvas"
        onContextMenu={suppressContextMenu}
      />
      {menuState && (
        <ContextMenu
          items={menuState.items}
          target={menuState.target}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  );
}
