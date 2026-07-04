/**
 * Camera controller: programmatic, animated viewport
 * control over a Cytoscape instance.
 *
 * The shell needs to fit the whole graph, frame a subgraph, and pan to a
 * node as it narrates the acts, without the demo poking Cytoscape
 * directly in a dozen places. `CytoscapeCanvas` already hands back the
 * instance via `onReady(cy)`; wrap it once with `createCameraController`
 * and call the named moves. A thin, documented wrapper around
 * `cy.animate` / `cy.fit` / `cy.center`, reusable for any canvas.
 *
 * Reduced motion is the caller's decision via the `animate` option (the
 * canvas itself defaults that from the OS preference; pass the same value
 * through). When not animating, the move is applied instantly.
 */

import type { Core, Collection, CollectionReturnValue } from "cytoscape";

export interface CameraOptions {
  /** Fit padding in px. */
  padding?: number;
  /** Animation duration in ms. 0 (or animate:false) applies instantly. */
  duration?: number;
  /** Cytoscape easing name (e.g. "ease-in-out-cubic"). */
  easing?: string;
  /** Animate this move. Default true; pass false for reduced motion. */
  animate?: boolean;
}

export interface CameraDefaults {
  padding?: number;
  duration?: number;
  easing?: string;
}

export interface CameraController {
  /** Zoom-to-subgraph: fit the viewport to the given nodes (and their
   *  edges are not added; pass node ids). Missing ids are ignored; an
   *  empty/all-missing set is a no-op. */
  focusNodes(ids: readonly string[], opts?: CameraOptions): void;
  /** Pan to center a single node WITHOUT changing zoom. No-op if absent. */
  panToNode(id: string, opts?: CameraOptions): void;
  /** Fit the whole graph. */
  frameAll(opts?: CameraOptions): void;
  /** Reset the view (fit the whole graph at the default padding). */
  resetView(opts?: CameraOptions): void;
  /** Pan (WITHOUT changing zoom) so the model-space point (x, y) sits at
   *  the viewport center. The minimap uses this to recenter on a clicked
   *  or dragged location; pass `animate: false` for drag responsiveness. */
  panToPoint(x: number, y: number, opts?: CameraOptions): void;
}

export function createCameraController(
  cy: Core,
  defaults: CameraDefaults = {},
): CameraController {
  const D = {
    padding: defaults.padding ?? 48,
    duration: defaults.duration ?? 500,
    easing: defaults.easing ?? "ease-in-out-cubic",
  };

  const shouldAnimate = (opts?: CameraOptions): boolean => {
    const dur = opts?.duration ?? D.duration;
    return (opts?.animate ?? true) && dur > 0;
  };

  const collect = (ids: readonly string[]): Collection => {
    let coll: Collection = cy.collection();
    for (const id of ids) {
      const el = cy.getElementById(id);
      if (el.nonempty()) coll = coll.union(el);
    }
    return coll;
  };

  const fitTo = (eles: Collection, opts?: CameraOptions): void => {
    const padding = opts?.padding ?? D.padding;
    if (shouldAnimate(opts)) {
      cy.animate({
        fit: { eles, padding },
        duration: opts?.duration ?? D.duration,
        easing: (opts?.easing ??
          D.easing) as import("cytoscape").Css.TransitionTimingFunction,
      });
    } else {
      cy.fit(eles, padding);
    }
  };

  return {
    focusNodes(ids, opts) {
      const coll = collect(ids);
      if (coll.empty()) return;
      fitTo(coll, opts);
    },
    panToNode(id, opts) {
      const el = cy.getElementById(id);
      if (el.empty()) return;
      if (shouldAnimate(opts)) {
        cy.animate({
          center: { eles: el as CollectionReturnValue },
          duration: opts?.duration ?? D.duration,
          easing: (opts?.easing ??
            D.easing) as import("cytoscape").Css.TransitionTimingFunction,
        });
      } else {
        cy.center(el);
      }
    },
    frameAll(opts) {
      fitTo(cy.elements(), opts);
    },
    resetView(opts) {
      fitTo(cy.elements(), opts);
    },
    panToPoint(x, y, opts) {
      // model -> rendered: rendered = model * zoom + pan. To place (x, y)
      // at the viewport center (w/2, h/2) we solve for pan and keep zoom.
      const zoom = cy.zoom();
      const pan = {
        x: cy.width() / 2 - x * zoom,
        y: cy.height() / 2 - y * zoom,
      };
      if (shouldAnimate(opts)) {
        cy.animate({
          pan,
          duration: opts?.duration ?? D.duration,
          easing: (opts?.easing ??
            D.easing) as import("cytoscape").Css.TransitionTimingFunction,
        });
      } else {
        cy.pan(pan);
      }
    },
  };
}
