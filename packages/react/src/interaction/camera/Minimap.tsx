/**
 * Minimap: a compact overview of a Cytoscape graph with a draggable
 * viewport indicator.
 *
 * It paints every node position (and faint edges) scaled to fit a small
 * canvas, then draws the current viewport rectangle from `cy.extent()`.
 * Clicking or dragging inside the minimap recenters the main view on the
 * corresponding model-space point (zoom is preserved) via the camera
 * controller's `panToPoint`. Redraws are coalesced to one per animation
 * frame off the canvas `render` event, so pan/zoom/drag/layout all keep
 * the indicator in sync without a per-frame React re-render.
 *
 * The canvas hands its instance back through `onReady(cy)`; capture that
 * into state and pass it here:
 *
 *   const [core, setCore] = useState<Core | null>(null);
 *   <CytoscapeCanvas ugm={ugm} onReady={setCore} />
 *   <Minimap core={core} />
 *
 * jsdom cannot rasterize a canvas, so the drawing is inert under test
 * (the 2D context is absent and guarded); live rendering needs a browser.
 */

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Core, NodeSingular } from "cytoscape";
import { useThemeStore } from "../../theme/ThemeManager";
import { createCameraController } from "./cameraController";
import {
  computeMinimapFrame,
  projectToMinimap,
  type MinimapFrame,
} from "./minimap-frame";
import "./Minimap.css";

export interface MinimapProps {
  /** The Cytoscape instance from the canvas `onReady` callback. While
   *  null the minimap renders a disabled placeholder. */
  core: Core | null;
  /** Minimap width in CSS px. Default 200. */
  width?: number;
  /** Minimap height in CSS px. Default 140. */
  height?: number;
  /** Inner padding around the scaled graph in px. Default 10. */
  padding?: number;
  /** Drawn node dot radius in px. Default 2. */
  nodeRadius?: number;
  /** Optional predicate selecting which TOP-LEVEL nodes are drawn. Use it
   *  to hide rendering-only nodes (for example structural ports). Children
   *  of a compound parent are never drawn individually regardless; the
   *  parent is collapsed to a single rectangle. */
  nodeFilter?: (node: NodeSingular) => boolean;
  /** Accessible label for the minimap region. */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

const scheduleFrame = (cb: () => void): number => {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    return window.requestAnimationFrame(() => cb());
  }
  return setTimeout(cb, 16) as unknown as number;
};
const cancelFrame = (id: number): void => {
  if (typeof window !== "undefined" && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
};

export function Minimap({
  core,
  width = 200,
  height = 140,
  padding = 10,
  nodeRadius = 2,
  nodeFilter,
  ariaLabel = "Graph minimap",
  className,
  style,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<MinimapFrame | null>(null);
  const draggingRef = useRef(false);
  // Held in a ref so an unstable inline predicate does not re-subscribe the
  // render listener each render; it is read on the next paint.
  const nodeFilterRef = useRef(nodeFilter);
  useEffect(() => {
    nodeFilterRef.current = nodeFilter;
  }, [nodeFilter]);
  const theme = useThemeStore((s) => s.theme);
  const controller = useMemo(
    () => (core ? createCameraController(core) : null),
    [core],
  );

  useEffect(() => {
    const cy = core;
    const canvas = canvasRef.current;
    if (!cy || !canvas) return undefined;
    if (cy.destroyed()) return undefined;

    const paint = () => {
      if (cy.destroyed()) return; // instance torn down before this frame.
      const ctx = canvas.getContext("2d");
      if (!ctx) return; // jsdom / no 2D context: nothing to draw.
      const dpr =
        (typeof window !== "undefined" && window.devicePixelRatio) || 1;
      if (canvas.width !== Math.round(width * dpr)) {
        canvas.width = Math.round(width * dpr);
      }
      if (canvas.height !== Math.round(height * dpr)) {
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = theme.bgSecondary;
      ctx.fillRect(0, 0, width, height);

      const nodes = cy.nodes();
      if (nodes.length === 0) {
        transformRef.current = null;
        return;
      }

      // Frame to the union of the graph bounding box and the current
      // viewport, so the viewed area (including the white space around the
      // graph) is captured rather than the viewport clipping at the edge.
      // Zoomed in (viewport inside the graph) the union is the graph box, so
      // the overview is unchanged. Geometry lives in minimap-frame.ts.
      const frame = computeMinimapFrame(
        cy.elements().boundingBox(),
        cy.extent(),
        width,
        height,
        padding,
      );
      const { scale } = frame;
      const tx = (mx: number) => frame.offsetX + (mx - frame.frameX1) * scale;
      const ty = (my: number) => frame.offsetY + (my - frame.frameY1) * scale;
      transformRef.current = frame;

      // Outermost ancestor of a node, so compound children collapse onto
      // their container's single mark.
      const topOf = (n: NodeSingular): NodeSingular => {
        let cur: NodeSingular = n;
        let par = cur.parent();
        while (par.length > 0) {
          const next = par[0];
          if (!next) break;
          cur = next;
          par = cur.parent();
        }
        return cur;
      };

      // Edges between distinct top-level ancestors; an edge wholly inside
      // one container collapses to a point and is skipped.
      ctx.strokeStyle = theme.edgeColor;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.5;
      cy.edges().forEach((e) => {
        const s = topOf(e.source());
        const t = topOf(e.target());
        if (s.id() === t.id()) return;
        const sp = s.position();
        const tp = t.position();
        ctx.beginPath();
        ctx.moveTo(tx(sp.x), ty(sp.y));
        ctx.lineTo(tx(tp.x), ty(tp.y));
        ctx.stroke();
      });

      // One mark per top-level node: a rectangle for a compound container,
      // a dot for a leaf. Child rows and ports never draw on their own.
      const filter = nodeFilterRef.current;
      cy.nodes(":orphan").forEach((n) => {
        if (filter && !filter(n)) return;
        if (n.isParent()) {
          const nb = n.boundingBox();
          const x = tx(nb.x1);
          const y = ty(nb.y1);
          const w = nb.w * scale;
          const h = nb.h * scale;
          ctx.fillStyle = theme.nodeStroke;
          ctx.globalAlpha = 0.12;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = theme.nodeStroke;
          ctx.lineWidth = 0.75;
          ctx.strokeRect(x, y, w, h);
        } else {
          const p = n.position();
          ctx.globalAlpha = 1;
          ctx.fillStyle = theme.nodeStroke;
          ctx.beginPath();
          ctx.arc(tx(p.x), ty(p.y), nodeRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      // Viewport indicator. Because the frame is the graph-union-viewport,
      // this rectangle stays within the minimap when zoomed or panned out
      // (the graph shrinks into the surrounding white space) instead of
      // clipping at the canvas edge.
      const ext = cy.extent();
      const vTopLeft = projectToMinimap(frame, ext.x1, ext.y1);
      const vBotRight = projectToMinimap(frame, ext.x2, ext.y2);
      const vx = vTopLeft.x;
      const vy = vTopLeft.y;
      const vw = vBotRight.x - vTopLeft.x;
      const vh = vBotRight.y - vTopLeft.y;
      ctx.fillStyle = theme.accentPrimary;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(vx, vy, vw, vh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = theme.accentPrimary;
      ctx.lineWidth = 1;
      ctx.strokeRect(vx, vy, vw, vh);
    };

    let raf = 0;
    const schedule = () => {
      if (!raf) {
        raf = scheduleFrame(() => {
          raf = 0;
          paint();
        });
      }
    };

    schedule();
    cy.on("render", schedule);
    return () => {
      if (!cy.destroyed()) cy.off("render", schedule);
      if (raf) cancelFrame(raf);
    };
  }, [core, theme, width, height, padding, nodeRadius]);

  const panFromEvent = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const tf = transformRef.current;
    if (!controller || !canvas || !tf) return;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const mx = tf.frameX1 + (px - tf.offsetX) / tf.scale;
    const my = tf.frameY1 + (py - tf.offsetY) / tf.scale;
    controller.panToPoint(mx, my, { animate: false });
  };

  const disabled = !core;

  return (
    <div
      className={["g3t-minimap", className].filter(Boolean).join(" ")}
      style={{ width, height, ...style }}
      data-testid="minimap"
      data-disabled={disabled || undefined}
      role="group"
      aria-label={ariaLabel}
    >
      <canvas
        ref={canvasRef}
        className="g3t-minimap-canvas"
        style={{ width, height }}
        aria-hidden="true"
        onPointerDown={(e) => {
          if (disabled) return;
          draggingRef.current = true;
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          panFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) panFromEvent(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      />
    </div>
  );
}
