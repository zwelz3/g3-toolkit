/**
 * Encoding spec model (roadmap/design/encoding-controls.md).
 *
 * The grammar: channel <- driver via scale. This module is the data
 * model, resolvers, reserved-channel guard, and (de)serialization;
 * EncodingSpecPanel is a view over it, never its owner.
 *
 * Precedence (low to high): theme defaults -> this spec -> per-node
 * style overrides (NodeStyleEditor, M12) -> reserved-channel owners
 * (selection accent, overlay emphasis, inference dash).
 */

import {
  OKABE_ITO,
  NODE_SHAPES,
  SEQUENTIAL_SCALE,
  DIVERGING_SCALE,
  scaleColor,
  contrastRatioCore,
} from "./palette-bridge";
import type { UGM } from "@g3t/core";

// ── Channels ─────────────────────────────────────────────────────────

export type NodeChannel =
  | "node.color"
  | "node.size"
  | "node.icon"
  | "node.label";
export type EdgeChannel = "edge.color" | "edge.width" | "edge.label";
export type ChannelId = NodeChannel | EdgeChannel;

/** Channels owned elsewhere; mappings onto them are rejected at parse
 *  time. The owner string is the explanation users see. */
export const RESERVED_CHANNELS: Record<string, string> = {
  "effects.accent":
    "selection (theme accent layer: createTheme or token overrides)",
  "effects.halo": "selection (gasket geometry tokens)",
  "edge.dash": "inference encoding (D9: asserted vs inferred)",
  "node.borderWeight":
    "algorithm overlays (specs/03: algorithm subgraph results)",
  "edge.borderWeight":
    "algorithm overlays (specs/03: algorithm subgraph results)",
  "canvas.background": "theme token --g3t-canvas-bg",
  "canvas.grid": "theme token --g3t-border",
};

// ── Scales ───────────────────────────────────────────────────────────

export type PaletteName = "okabe-ito" | "viridis-9" | "diverging-9";

export interface FixedScale<T> {
  kind: "fixed";
  value: T;
}

export interface CategoricalScale<T> {
  kind: "categorical";
  /** Named palette or custom output array, consumed in value order. */
  palette?: PaletteName | T[];
  /** Explicit value order (review 4.4): values listed here take
   *  palette slots by POSITION, independent of the order the data is
   *  encountered, so the same spec yields the same output across
   *  different projections of the same universe (encounter-order
   *  assignment made colors reshuffle per view). Values not in the
   *  domain continue encounter-order assignment after it. */
  domain?: string[];
  /** Per-value pinned outputs; win over palette assignment. */
  overrides?: Record<string, T>;
  /** Output for values with no palette slot and no override. */
  unmapped?: T;
}

export interface SequentialScale {
  kind: "sequential";
  /** "auto" computes [min,max] from the data each resolve pass. */
  domain: "auto" | [number, number];
  /** Color channels: which token ramp. */
  ramp?: "sequential" | "diverging";
  /** Size/width channels: output range in px. */
  range?: [number, number];
}

export type ColorScale =
  | FixedScale<string>
  | CategoricalScale<string>
  | SequentialScale;
export type SizeScale = FixedScale<number> | SequentialScale;
export type IconScale = CategoricalScale<string> | FixedScale<string>;
/** Cytoscape node shape names; categorical defaults cycle NODE_SHAPES
 *  slot-stably (overrides pin without reshuffling, as with color). */
export type ShapeScale = CategoricalScale<string> | FixedScale<string>;

export interface ChannelEncoding<S> {
  /** Attribute key driving the scale; "fixed" scales ignore it. */
  driver?: string;
  scale: S;
}

export interface EncodingSpec {
  version: 1;
  node: {
    color?: ChannelEncoding<ColorScale>;
    size?: ChannelEncoding<SizeScale>;
    icon?: ChannelEncoding<IconScale>;
    shape?: ChannelEncoding<ShapeScale>;
    label?: ChannelEncoding<FixedScale<string>> | { driver: string };
  };
  edge: {
    color?: ChannelEncoding<ColorScale>;
    width?: ChannelEncoding<SizeScale>;
    label?: { driver: string } | undefined;
  };
}

export const DEFAULT_SPEC: EncodingSpec = {
  version: 1,
  node: {
    color: {
      driver: "types",
      scale: { kind: "categorical", palette: "okabe-ito" },
    },
    label: { driver: "label" },
  },
  edge: {},
};

// ── Palette resolution ───────────────────────────────────────────────

function paletteArray(
  p: PaletteName | string[] | undefined,
): readonly string[] {
  if (Array.isArray(p)) return p;
  switch (p) {
    case "viridis-9":
      return SEQUENTIAL_SCALE;
    case "diverging-9":
      return DIVERGING_SCALE;
    case "okabe-ito":
    default:
      return OKABE_ITO;
  }
}

// ── Resolvers ────────────────────────────────────────────────────────

/** Element attrs shape shared by nodes (types[]) and edges (type). */
export interface ElementAttrs {
  types?: string[];
  type?: string;
  properties: Record<string, unknown>;
}

function driverValue(driver: string | undefined, attrs: ElementAttrs): unknown {
  if (!driver) return undefined;
  if (driver === "types") return attrs.types?.[0];
  if (driver === "type" && attrs.type !== undefined) return attrs.type;
  return attrs.properties[driver];
}

function categoricalIndexer(seed?: readonly string[]): (v: string) => number {
  const seen = new Map<string, number>();
  for (const v of seed ?? []) {
    if (!seen.has(v)) seen.set(v, seen.size);
  }
  return (v: string) => {
    let i = seen.get(v);
    if (i === undefined) {
      i = seen.size;
      seen.set(v, i);
    }
    return i;
  };
}

export interface ResolveContext {
  /** Auto domains and categorical value order need the data. */
  ugm: UGM;
}

function numericDomain(
  ugm: UGM,
  driver: string,
  target: "node" | "edge",
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  const visit = (attrs: { properties: Record<string, unknown> }) => {
    const v = attrs.properties[driver];
    if (typeof v === "number" && isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  };
  if (target === "node") ugm.forEachNode((_id, attrs) => visit(attrs));
  else ugm.forEachEdge((_id, attrs) => visit(attrs));
  if (min === Infinity) return [0, 1];
  if (min === max) return [min, max + 1];
  return [min, max];
}

function normalize(v: number, [lo, hi]: [number, number]): number {
  return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
}

/** Build a resolver for one color channel over the current data. */
export function makeColorResolver(
  enc: ChannelEncoding<ColorScale> | undefined,
  ctx: ResolveContext,
  target: "node" | "edge" = "node",
): (attrs: ElementAttrs) => string | undefined {
  if (!enc) return () => undefined;
  const { scale, driver } = enc;
  if (scale.kind === "fixed") return () => scale.value;
  if (scale.kind === "categorical") {
    const palette = paletteArray(scale.palette);
    const index = categoricalIndexer(scale.domain);
    return (attrs) => {
      const raw = driverValue(driver, attrs);
      if (raw === undefined || raw === null) return scale.unmapped;
      const key = String(raw);
      // Consume the slot BEFORE checking overrides: a pinned value
      // shadows its palette color but keeps its position, so pinning
      // one value never reshuffles every other value's hue.
      const slot = index(key);
      const pinned = scale.overrides?.[key];
      if (pinned !== undefined) return pinned;
      return slot < palette.length
        ? palette[slot]
        : (scale.unmapped ?? palette[slot % palette.length]);
    };
  }
  // sequential
  const dom =
    scale.domain === "auto"
      ? numericDomain(ctx.ugm, driver ?? "", target)
      : scale.domain;
  const ramp = scale.ramp === "diverging" ? DIVERGING_SCALE : SEQUENTIAL_SCALE;
  return (attrs) => {
    const v = driverValue(driver, attrs);
    if (typeof v !== "number" || !isFinite(v)) return undefined;
    return scaleColor(normalize(v, dom), ramp);
  };
}

/**
 * Map each distinct value of the node color channel's driver to the
 * color the encoding assigns it, in data insertion order (the same
 * order makeColorResolver consumes palette slots). Useful for keeping
 * auxiliary UI (legends, the FacetFilter swatches) consistent with the
 * canvas. Returns an empty map for non-categorical color channels.
 */
export function categoricalColorMap(
  spec: EncodingSpec,
  ugm: UGM,
): Map<string, string> {
  const out = new Map<string, string>();
  const enc = spec.node.color;
  if (!enc || enc.scale.kind !== "categorical") return out;
  const resolve = makeColorResolver(enc, { ugm });
  const driver = enc.driver;
  const seen = new Set<string>();
  // Domain values lead, in domain order, so legends and swatch UIs
  // render a stable sequence regardless of data traversal order.
  for (const key of enc.scale.domain ?? []) {
    if (seen.has(key)) continue;
    seen.add(key);
    const sample: ElementAttrs =
      driver === "types"
        ? { types: [key], properties: {} }
        : { types: [], properties: { [driver ?? ""]: key } };
    const color = resolve(sample);
    if (color) out.set(key, color);
  }
  ugm.forEachNode((_id, attrs) => {
    const raw =
      driver === "types"
        ? attrs.types[0]
        : (attrs.properties as Record<string, unknown>)[driver ?? ""];
    if (raw === undefined || raw === null) return;
    const key = String(raw);
    if (seen.has(key)) return;
    seen.add(key);
    const sample: ElementAttrs =
      driver === "types"
        ? { types: [key], properties: {} }
        : { types: [], properties: { [driver ?? ""]: raw } };
    const color = resolve(sample);
    if (color) out.set(key, color);
  });
  return out;
}
export function makeSizeResolver(
  enc: ChannelEncoding<SizeScale> | undefined,
  ctx: ResolveContext,
  target: "node" | "edge" = "node",
): (attrs: ElementAttrs) => number | undefined {
  if (!enc) return () => undefined;
  const { scale, driver } = enc;
  if (scale.kind === "fixed") return () => scale.value;
  const dom =
    scale.domain === "auto"
      ? numericDomain(ctx.ugm, driver ?? "", target)
      : scale.domain;
  const [outLo, outHi] = scale.range ?? [4, 32];
  return (attrs) => {
    const v = driverValue(driver, attrs);
    if (typeof v !== "number" || !isFinite(v)) return undefined;
    return outLo + normalize(v, dom) * (outHi - outLo);
  };
}

/** Build a resolver for the icon channel (registry icon names). */
export function makeIconResolver(
  enc: ChannelEncoding<IconScale> | undefined,
): (attrs: ElementAttrs) => string | undefined {
  if (!enc) return () => undefined;
  const { scale, driver } = enc;
  if (scale.kind === "fixed") return () => scale.value;
  return (attrs) => {
    const raw = driverValue(driver, attrs);
    if (raw === undefined || raw === null) return scale.unmapped;
    return scale.overrides?.[String(raw)] ?? scale.unmapped;
  };
}

/** Build a resolver for the shape channel. Mirrors color's
 *  categorical semantics: slot-stable over NODE_SHAPES; overrides
 *  shadow their slot without reordering anyone else. */
export function makeShapeResolver(
  enc: ChannelEncoding<ShapeScale> | undefined,
): (attrs: ElementAttrs) => string | undefined {
  if (!enc) return () => undefined;
  const { scale, driver } = enc;
  if (scale.kind === "fixed") return () => scale.value;
  const palette: readonly string[] = Array.isArray(scale.palette)
    ? scale.palette
    : NODE_SHAPES;
  const index = categoricalIndexer(scale.domain);
  return (attrs) => {
    const raw = driverValue(driver, attrs);
    if (raw === undefined || raw === null) return scale.unmapped;
    const key = String(raw);
    const slot = index(key);
    const pinned = scale.overrides?.[key];
    if (pinned !== undefined) return pinned;
    return palette[slot % palette.length];
  };
}

// ── Validation, serialization, warnings ──────────────────────────────

export class ReservedChannelError extends Error {
  constructor(channel: string) {
    super(
      `Channel "${channel}" is reserved: it is owned by ${RESERVED_CHANNELS[channel]} and cannot be attribute-mapped (see roadmap/design/encoding-controls.md).`,
    );
    this.name = "ReservedChannelError";
  }
}

export function serializeEncodingSpec(spec: EncodingSpec): string {
  return JSON.stringify(spec, null, 2);
}

/** Parse + validate. Rejects unknown versions and reserved channels. */
export function parseEncodingSpec(json: string): EncodingSpec {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw["version"] !== 1) {
    throw new Error(
      `Unsupported encoding spec version: ${String(raw["version"])}`,
    );
  }
  for (const target of ["node", "edge", "effects", "canvas"] as const) {
    const block = raw[target];
    if (block && typeof block === "object") {
      for (const prop of Object.keys(block)) {
        const channel = `${target}.${prop}`;
        if (channel in RESERVED_CHANNELS) {
          throw new ReservedChannelError(channel);
        }
      }
    }
  }
  return raw as unknown as EncodingSpec;
}

/**
 * Warn (never block) when a CUSTOM categorical palette departs from
 * the safe defaults: low contrast against the canvas background, plus
 * a CVD note since the named palettes are colorblind-safe and a custom
 * array may not be. The createTheme posture, applied to encodings.
 */
export function warnOnCustomPalette(
  palette: string[],
  canvasBg: string,
): string[] {
  const warnings: string[] = [];
  const low = palette
    .map((c) => ({ c, r: contrastRatioCore(c, canvasBg) }))
    .filter(({ r }) => r !== null && r < 1.6)
    .map(({ c, r }) => `${c} (${(r as number).toFixed(2)}:1)`);
  if (low.length > 0) {
    warnings.push(`Low contrast against canvas background: ${low.join(", ")}`);
  }
  warnings.push(
    "Custom palettes are not checked for color-vision safety; the named palettes (okabe-ito, viridis-9) are colorblind-safe (R7.8).",
  );
  return warnings;
}

// ── Legacy adapter ───────────────────────────────────────────────────

import type { EncodingConfig } from "./VisualEncoding";

/** Lossless lift of the flat EncodingConfig into the spec grammar. */
export function fromLegacyConfig(config: EncodingConfig): EncodingSpec {
  const spec: EncodingSpec = {
    version: 1,
    node: { label: { driver: config.nodeLabelProperty } },
    edge: { label: { driver: config.edgeLabelProperty } },
  };
  if (config.nodeColorProperty) {
    spec.node.color = {
      driver: config.nodeColorProperty,
      scale: { kind: "categorical", palette: "okabe-ito" },
    };
  }
  if (config.nodeSizeProperty) {
    spec.node.size = {
      driver: config.nodeSizeProperty,
      scale: {
        kind: "sequential",
        domain: "auto",
        range: config.nodeSizeRange,
      },
    };
  }
  if (config.edgeWidthProperty) {
    spec.edge.width = {
      driver: config.edgeWidthProperty,
      scale: {
        kind: "sequential",
        domain: "auto",
        range: config.edgeWidthRange,
      },
    };
  }
  return spec;
}

/**
 * Apply an icon set's pre-mappings to the node.icon channel: merges
 * value -> icon overrides onto any existing icon mapping (set wins on
 * collision; existing driver wins unless the channel was empty).
 * Returns a NEW spec; the input is untouched.
 */
export function applyIconMappings(
  spec: EncodingSpec,
  mappings: { driver: string; values: Record<string, string> },
): EncodingSpec {
  const existing =
    spec.node.icon?.scale.kind === "categorical"
      ? (spec.node.icon.scale.overrides ?? {})
      : {};
  return {
    ...spec,
    node: {
      ...spec.node,
      icon: {
        driver: spec.node.icon?.driver ?? mappings.driver,
        scale: {
          kind: "categorical",
          overrides: { ...existing, ...mappings.values },
        },
      },
    },
  };
}
