/**
 * Declarative LOD schedule (G3L:STY-010/011): which element FEATURES
 * render at which zoom and visible-element count, expressed as DATA
 * (serializable, themable per surface), replacing incident-driven
 * visibility hacks.
 *
 * Operational model, deliberately decoupled from per-element style
 * resolution (G3L:STY-011): `resolveLod(schedule, context)` runs ONCE
 * per zoom/viewport change and yields feature flags; adapters combine
 * those flags with each element's VisualAttributes (`applyLod`), so a
 * pan/zoom frame never re-resolves styles (G3L:PRF-005).
 *
 * Tier selection: tiers are ordered coarse-first; the FIRST tier whose
 * condition holds wins; when none holds, tier 0 (full detail) applies.
 * A condition holds when zoom <= maxZoom (if set) OR visibleElements
 * >= minVisibleElements (if set): either density signal is sufficient
 * to coarsen, matching the two documented commercial schemes (the
 * count-based desktop-Cytoscape scheme and the zoom-based yFiles/CI
 * scheme) unified as one schedule.
 */

import type { VisualAttributes } from "./visual-attributes";

export interface LodFeatureFlags {
  nodeLabels: boolean;
  edgeLabels: boolean;
  glyphs: boolean;
  halos: boolean;
  donuts: boolean;
  icons: boolean;
  edges: boolean;
}

export interface LodTier {
  /** 0 = full detail; higher = coarser. */
  tier: number;
  /** Condition: holds when zoom <= maxZoom OR visible >= count. */
  when: { maxZoom?: number; minVisibleElements?: number };
  /** Features DISABLED at this tier (unlisted features stay on). */
  hide: readonly (keyof LodFeatureFlags)[];
}

export interface LodSchedule {
  /** Ordered coarse-first; first matching tier wins. */
  tiers: readonly LodTier[];
}

export interface LodContext {
  zoom: number;
  visibleElements: number;
}

export interface ResolvedLod {
  tier: number;
  features: LodFeatureFlags;
}

const ALL_ON: LodFeatureFlags = {
  nodeLabels: true,
  edgeLabels: true,
  glyphs: true,
  halos: true,
  donuts: true,
  icons: true,
  edges: true,
};

/**
 * The shipped default, grounded in the documented schemes: labels
 * fade first (below the zoom where a caption drops under ~6 device
 * px, or past a few hundred visible elements), decorations next,
 * icons and edges last at hairball scale.
 */
export const DEFAULT_LOD_SCHEDULE: LodSchedule = {
  tiers: [
    {
      tier: 3,
      when: { maxZoom: 0.15, minVisibleElements: 4000 },
      hide: [
        "nodeLabels",
        "edgeLabels",
        "glyphs",
        "halos",
        "donuts",
        "icons",
        "edges",
      ],
    },
    {
      tier: 2,
      when: { maxZoom: 0.35, minVisibleElements: 1000 },
      hide: ["nodeLabels", "edgeLabels", "glyphs", "halos", "donuts", "icons"],
    },
    {
      tier: 1,
      when: { maxZoom: 0.65, minVisibleElements: 200 },
      hide: ["edgeLabels", "glyphs", "donuts"],
    },
  ],
};

/** Resolve the schedule for a zoom/viewport context. Pure; run once
 *  per context change, never per element (G3L:STY-011). */
export function resolveLod(
  schedule: LodSchedule,
  context: LodContext,
): ResolvedLod {
  for (const tier of schedule.tiers) {
    const zoomHit =
      tier.when.maxZoom !== undefined && context.zoom <= tier.when.maxZoom;
    const countHit =
      tier.when.minVisibleElements !== undefined &&
      context.visibleElements >= tier.when.minVisibleElements;
    if (zoomHit || countHit) {
      const features = { ...ALL_ON };
      for (const f of tier.hide) features[f] = false;
      return { tier: tier.tier, features };
    }
  }
  return { tier: 0, features: { ...ALL_ON } };
}

/**
 * Combine resolved LOD flags with one element's attributes: the pure
 * per-element combinator adapters apply at draw time. Returns the
 * input object untouched when the tier is 0 (the hot-path common
 * case allocates nothing).
 */
export function applyLod(
  attrs: Readonly<VisualAttributes>,
  lod: ResolvedLod,
  kind: "node" | "edge",
): VisualAttributes {
  if (lod.tier === 0) return attrs;
  const f = lod.features;
  const out: VisualAttributes = { ...attrs, lodTier: lod.tier };
  if (kind === "node") {
    if (!f.nodeLabels) out.labelVisible = false;
    if (!f.glyphs) out.glyphs = undefined;
    if (!f.halos) out.halo = undefined;
    if (!f.donuts) out.donut = undefined;
    if (!f.icons) out.icon = undefined;
  } else {
    if (!f.edgeLabels) out.labelVisible = false;
    if (!f.edges) out.opacity = 0;
  }
  return out;
}
