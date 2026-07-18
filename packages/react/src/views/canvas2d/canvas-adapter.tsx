/**
 * Canvas 2D adapter component (G3L:RND-004 stage 1; ARC-008).
 *
 * A thin replayer: buildDisplayList (pure, conformance-tested) does
 * all semantic work; this component paints the ops onto a 2D
 * context with devicePixelRatio scaling (the HiDPI down-payment on
 * RND-004; bitmap caching, snapshot transforms, and interaction
 * simplification are stage 2). The op count is exposed as
 * data-g3t-ops for browser assertions.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { hitTestScene } from "@g3t/core";
import type { SceneHit, VisualAttributes } from "@g3t/core";
import {
  useElementPointerEvents,
  type ElementPointerHandlers,
} from "../../interaction/element-pointer-events";
import type { SvgSceneEdge, SvgSceneNode } from "../svg/svg-adapter";
import { buildDisplayList, type DrawOp } from "./display-list";

export interface CanvasAdapterProps extends ElementPointerHandlers<SceneHit> {
  nodes: readonly SvgSceneNode[];
  edges: readonly SvgSceneEdge[];
  resolved: ReadonlyMap<string, VisualAttributes>;
  width: number;
  height: number;
  background?: string;
  "data-testid"?: string;
}

function shapePath(ctx: CanvasRenderingContext2D, op: DrawOp): void {
  if (op.kind !== "shape") return;
  const rx = op.width / 2;
  const ry = op.height / 2;
  ctx.beginPath();
  switch (op.shape) {
    case "rectangle":
      ctx.rect(op.x - rx, op.y - ry, op.width, op.height);
      break;
    case "round-rectangle":
    case "pill": {
      const r = op.shape === "pill" ? ry : Math.min(6, rx, ry);
      ctx.roundRect(op.x - rx, op.y - ry, op.width, op.height, r);
      break;
    }
    case "diamond":
      ctx.moveTo(op.x, op.y - ry);
      ctx.lineTo(op.x + rx, op.y);
      ctx.lineTo(op.x, op.y + ry);
      ctx.lineTo(op.x - rx, op.y);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(op.x, op.y - ry);
      ctx.lineTo(op.x + rx, op.y + ry);
      ctx.lineTo(op.x - rx, op.y + ry);
      ctx.closePath();
      break;
    case "hexagon": {
      const half = rx / 2;
      ctx.moveTo(op.x - half, op.y - ry);
      ctx.lineTo(op.x + half, op.y - ry);
      ctx.lineTo(op.x + rx, op.y);
      ctx.lineTo(op.x + half, op.y + ry);
      ctx.lineTo(op.x - half, op.y + ry);
      ctx.lineTo(op.x - rx, op.y);
      ctx.closePath();
      break;
    }
    default:
      ctx.ellipse(op.x, op.y, rx, ry, 0, 0, 2 * Math.PI);
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  ops: readonly DrawOp[],
  background: string | undefined,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  if (background !== undefined) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  for (const op of ops) {
    switch (op.kind) {
      case "halo": {
        ctx.beginPath();
        ctx.ellipse(op.x, op.y, op.rx, op.ry, 0, 0, 2 * Math.PI);
        ctx.fillStyle = op.color;
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case "shape": {
        shapePath(ctx, op);
        if (op.gradient) {
          const g = ctx.createLinearGradient(
            op.x - op.width / 2,
            op.y,
            op.x + op.width / 2,
            op.y,
          );
          g.addColorStop(0, op.gradient.from);
          g.addColorStop(1, op.gradient.to);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = op.fill;
        }
        if (op.opacity !== undefined) ctx.globalAlpha = op.opacity;
        ctx.fill();
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.strokeWidth;
        ctx.setLineDash(op.dash ? [...op.dash] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        break;
      }
      case "donut-arc": {
        ctx.beginPath();
        ctx.arc(op.cx, op.cy, op.r, op.startAngle, op.endAngle);
        ctx.strokeStyle = op.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      }
      case "glyph": {
        ctx.font = `${op.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#212529";
        ctx.fillText(op.text, op.x, op.y);
        break;
      }
      case "edge": {
        const [p1, p2] = op.points;
        if (!p1 || !p2) break;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        if (op.gradient) {
          const g = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          g.addColorStop(0, op.gradient.from);
          g.addColorStop(1, op.gradient.to);
          ctx.strokeStyle = g;
        } else {
          ctx.strokeStyle = op.stroke;
        }
        ctx.lineWidth = op.width;
        ctx.setLineDash(op.dash ? [...op.dash] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "taper": {
        ctx.beginPath();
        op.points.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        ctx.closePath();
        if (op.gradient) {
          const g = ctx.createLinearGradient(
            op.p1.x,
            op.p1.y,
            op.p2.x,
            op.p2.y,
          );
          g.addColorStop(0, op.gradient.from);
          g.addColorStop(1, op.gradient.to);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = op.fill;
        }
        ctx.fill();
        break;
      }
      case "label": {
        ctx.font = `${op.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        if (op.halo) {
          ctx.strokeStyle = op.halo.color;
          ctx.lineWidth = op.halo.width;
          ctx.strokeText(op.text, op.x, op.y);
        }
        ctx.fillStyle = op.color;
        ctx.fillText(op.text, op.x, op.y);
        break;
      }
    }
  }
}

export function CanvasAdapter({
  nodes,
  edges,
  resolved,
  width,
  height,
  background,
  "data-testid": testId,
  ...pointerHandlers
}: CanvasAdapterProps): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ops = buildDisplayList({ nodes, edges, resolved });
  const hit = useCallback(
    (p: { x: number; y: number }) =>
      hitTestScene({ nodes, edges, resolved }, p),
    [nodes, edges, resolved],
  );
  const toModel = useCallback(
    (client: { x: number; y: number }, el: HTMLCanvasElement) => {
      const r = el.getBoundingClientRect();
      return { x: client.x - r.left, y: client.y - r.top };
    },
    [],
  );
  const pointerProps = useElementPointerEvents<SceneHit, HTMLCanvasElement>(
    hit,
    toModel,
    pointerHandlers,
  );

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr =
      typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, ops, background, width, height);
  });

  return (
    <canvas
      ref={ref}
      {...pointerProps}
      style={{ width, height }}
      data-testid={testId}
      data-g3t-ops={ops.length}
    />
  );
}
