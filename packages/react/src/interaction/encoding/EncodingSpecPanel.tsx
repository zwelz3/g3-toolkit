/**
 * EncodingSpecPanel: the tier-1/tier-2 surface over the encoding spec
 * (roadmap/design/encoding-controls.md). One row per channel:
 * [channel] [driver] [mapping chip]; the chip expands the editor for
 * that scale only. The panel is a view over the spec; every change
 * emits a whole new spec through onChange.
 *
 * EncodingPreview renders sample elements THROUGH THE RESOLVERS, so
 * what it shows is what the canvas will compute: the preview is
 * proof, not illustration.
 */

import { useMemo, useState, type ReactElement } from "react";
import type { UGM } from "@g3t/core";
import { Icon } from "../../icons";
import { listIcons } from "../../icons";
import {
  makeColorResolver,
  makeIconResolver,
  makeSizeResolver,
  warnOnCustomPalette,
  type ColorScale,
  type EncodingSpec,
  type ElementAttrs,
  type PaletteName,
} from "./encoding-spec";
import { glyphStrokeFor } from "./spec-apply";
import { OKABE_ITO, NODE_SHAPES, SEQUENTIAL_SCALE } from "./palette-bridge";

// ── Shared bits ──────────────────────────────────────────────────────

function propertyKeys(ugm: UGM, target: "node" | "edge"): string[] {
  const keys = new Set<string>();
  const visit = (attrs: { properties: Record<string, unknown> }) =>
    Object.keys(attrs.properties).forEach((k) => keys.add(k));
  if (target === "node") ugm.forEachNode((_id, a) => visit(a));
  else ugm.forEachEdge((_id, a) => visit(a));
  return [...keys].sort();
}

function distinctDriverValues(
  ugm: UGM,
  driver: string | undefined,
  target: "node" | "edge",
): string[] {
  if (!driver) return [];
  const out = new Set<string>();
  const visit = (attrs: ElementAttrs) => {
    const v =
      driver === "types"
        ? attrs.types?.[0]
        : driver === "type" && attrs.type !== undefined
          ? attrs.type
          : attrs.properties[driver];
    if (v !== undefined && v !== null) out.add(String(v));
  };
  if (target === "node") ugm.forEachNode((_id, a) => visit(a));
  else
    ugm.forEachEdge((_id, a) =>
      visit({ ...a, properties: a.properties } as ElementAttrs),
    );
  return [...out];
}

/** Sample attrs that exercise DRIVER with value v, whatever the
 *  driver is (the round-8 chip assumed types and went blank for
 *  label/pagerank drivers). */
function sampleAttrsFor(driver: string | undefined, v: string): ElementAttrs {
  if (driver === "types") return { types: [v], properties: {} };
  if (driver === "type") return { type: v, properties: {} };
  return { types: [], properties: driver ? { [driver]: coerce(v) } : {} };
}

function coerce(v: string): unknown {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : v;
}

/** Is a driver numeric over this data? Drives the categorical-vs-
 *  sequential default when the user changes a color driver. */
function propertyKind(
  ugm: UGM,
  key: string,
  target: "node" | "edge",
): "numeric" | "categorical" {
  let numeric = 0;
  let other = 0;
  const visit = (attrs: ElementAttrs) => {
    const v =
      key === "types"
        ? attrs.types?.[0]
        : key === "type"
          ? attrs.type
          : attrs.properties[key];
    if (v === undefined || v === null) return;
    if (typeof v === "number" && isFinite(v)) numeric++;
    else other++;
  };
  if (target === "node") ugm.forEachNode((_id, a) => visit(a));
  else ugm.forEachEdge((_id, a) => visit(a as ElementAttrs));
  return numeric > 0 && other === 0 ? "numeric" : "categorical";
}

/** Live canvas background for contrast checks; falls back to white
 *  where the token is unavailable (SSR, bare jsdom). */
function liveCanvasBg(): string {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function")
    return "#ffffff";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--g3t-canvas-bg")
    .trim();
  return v || "#ffffff";
}

function chipStrip(colors: readonly (string | undefined)[]): ReactElement {
  return (
    <span className="g3t-enc-chipstrip" aria-hidden="true">
      {colors.slice(0, 6).map((c, i) => (
        <span key={i} style={{ background: c ?? "transparent" }} />
      ))}
    </span>
  );
}

// ── Channel row ──────────────────────────────────────────────────────

interface RowProps {
  channel: string;
  driverOptions: string[];
  driver: string | undefined;
  onDriver: (d: string | undefined) => void;
  chip: ReactElement | string;
  editor: ReactElement | null;
  defaultExpanded?: boolean;
  themeDelegated?: string;
}

function ChannelRow({
  channel,
  driverOptions,
  driver,
  onDriver,
  chip,
  editor,
  defaultExpanded = false,
  themeDelegated,
}: RowProps) {
  const [open, setOpen] = useState(defaultExpanded);
  if (themeDelegated) {
    return (
      <div className="g3t-enc-row" data-testid={`enc-row-${channel}`}>
        <span className="g3t-enc-channel">{channel}</span>
        <span className="g3t-enc-delegated">
          theme: {themeDelegated} (edit via theme / accent layer)
        </span>
      </div>
    );
  }
  return (
    <div data-testid={`enc-row-${channel}`}>
      <div className="g3t-enc-row">
        <span className="g3t-enc-channel">{channel}</span>
        <select
          className="g3t-select"
          aria-label={`${channel} driver`}
          value={driver ?? "(none)"}
          onChange={(e) =>
            onDriver(e.target.value === "(none)" ? undefined : e.target.value)
          }
        >
          <option>(none)</option>
          <option>fixed</option>
          {driverOptions.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <button
          className="g3t-btn g3t-btn-ghost g3t-enc-chip"
          data-testid={`enc-chip-${channel}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          disabled={!editor}
        >
          {chip}
          {editor ? (
            <Icon name={open ? "chevron-up" : "chevron-down"} size={10} />
          ) : null}
        </button>
      </div>
      {open && editor ? (
        <div
          className="g3t-panel-section-content g3t-enc-editor"
          data-testid={`enc-editor-${channel}`}
        >
          {editor}
        </div>
      ) : null}
    </div>
  );
}

// ── Mapping editors (tier 2) ─────────────────────────────────────────

function CategoricalColorEditor({
  values,
  scale,
  canvasBg,
  onChange,
}: {
  values: string[];
  scale: Extract<ColorScale, { kind: "categorical" }>;
  canvasBg: string;
  onChange: (s: ColorScale) => void;
}) {
  const isCustom = Array.isArray(scale.palette);
  const palette: readonly string[] = isCustom
    ? (scale.palette as string[])
    : scale.palette === "viridis-9"
      ? SEQUENTIAL_SCALE
      : OKABE_ITO;
  // The colors the user actually SEES per value: this is what the
  // warnings evaluate (round-8 bug: warnings checked the stale
  // palette array, so they never cleared as colors changed).
  const effective = values.map(
    (v, i) => scale.overrides?.[v] ?? palette[i % palette.length] ?? "#000000",
  );
  const SAFE = new Set(
    [...OKABE_ITO, ...SEQUENTIAL_SCALE].map((c) => c.toLowerCase()),
  );
  const customWarnings = effective.every((c) => SAFE.has(c.toLowerCase()))
    ? []
    : warnOnCustomPalette(effective, canvasBg);
  const resolve = (v: string, i: number) => effective[i] ?? "#000000";
  return (
    <div>
      <label className="g3t-enc-field">
        palette
        <select
          className="g3t-select"
          value={
            Array.isArray(scale.palette)
              ? "custom"
              : (scale.palette ?? "okabe-ito")
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") {
              // Fold the EFFECTIVE colors into the array (visual
              // continuity) and clear overrides: in custom mode the
              // pickers edit array slots, one source of truth.
              onChange({ kind: "categorical", palette: [...effective] });
            } else {
              onChange({ ...scale, palette: v as PaletteName });
            }
          }}
        >
          <option value="okabe-ito">okabe-ito (CVD-safe)</option>
          <option value="viridis-9">viridis-9 (CVD-safe)</option>
          <option value="custom">custom…</option>
        </select>
      </label>
      {values.map((v, i) => (
        // div, not label: native label click-forwarding made the WHOLE
        // row a picker trigger, so "clicking outside" the open picker
        // often landed back inside the label and re-opened it
        // (round-18 finding 1). Only the swatch opens the picker now.
        <div key={v} className="g3t-enc-field" data-testid={`enc-value-${v}`}>
          <span className="g3t-enc-valuename">{v}</span>
          <input
            type="color"
            aria-label={`Color for ${v}`}
            value={resolve(v, i)}
            onChange={(e) => {
              if (isCustom) {
                const next = [...(scale.palette as string[])];
                while (next.length <= i) next.push("#999999");
                next[i] = e.target.value;
                onChange({ kind: "categorical", palette: next });
              } else {
                onChange({
                  ...scale,
                  overrides: { ...scale.overrides, [v]: e.target.value },
                });
              }
            }}
          />
          {!isCustom && scale.overrides?.[v] ? (
            <button
              className="g3t-btn g3t-btn-ghost"
              onClick={() => {
                const next = Object.fromEntries(
                  Object.entries(scale.overrides ?? {}).filter(
                    ([k]) => k !== v,
                  ),
                );
                onChange({ ...scale, overrides: next });
              }}
            >
              reset
            </button>
          ) : null}
        </div>
      ))}
      {customWarnings.map((w) => (
        <div key={w} className="g3t-enc-warning" role="status">
          <Icon name="warning" size={11} /> {w}
        </div>
      ))}
    </div>
  );
}

function FixedNumberEditor({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="g3t-enc-field">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={`Fixed ${label}`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        className="g3t-input"
        aria-label={`Fixed ${label} value`}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      px
    </label>
  );
}

function RangeEditor({
  domain,
  range,
  onChange,
}: {
  domain: "auto" | [number, number];
  range: [number, number];
  onChange: (
    domain: "auto" | [number, number],
    range: [number, number],
  ) => void;
}) {
  const manual = domain !== "auto";
  return (
    <div>
      <label className="g3t-enc-field">
        size
        <input
          type="number"
          className="g3t-input"
          aria-label="Minimum output"
          value={range[0]}
          onChange={(e) => onChange(domain, [Number(e.target.value), range[1]])}
        />
        to
        <input
          type="number"
          className="g3t-input"
          aria-label="Maximum output"
          value={range[1]}
          onChange={(e) => onChange(domain, [range[0], Number(e.target.value)])}
        />
        px
      </label>
      <label className="g3t-enc-field">
        domain
        <select
          className="g3t-select"
          value={manual ? "manual" : "auto"}
          onChange={(e) =>
            onChange(e.target.value === "auto" ? "auto" : [0, 1], range)
          }
        >
          <option value="auto">auto (from data)</option>
          <option value="manual">manual clamp</option>
        </select>
        {manual ? (
          <>
            <input
              type="number"
              className="g3t-input"
              aria-label="Domain minimum"
              value={(domain as [number, number])[0]}
              onChange={(e) =>
                onChange(
                  [Number(e.target.value), (domain as [number, number])[1]],
                  range,
                )
              }
            />
            to
            <input
              type="number"
              className="g3t-input"
              aria-label="Domain maximum"
              value={(domain as [number, number])[1]}
              onChange={(e) =>
                onChange(
                  [(domain as [number, number])[0], Number(e.target.value)],
                  range,
                )
              }
            />
          </>
        ) : null}
      </label>
    </div>
  );
}

function IconMapEditor({
  values,
  overrides,
  onChange,
}: {
  values: string[];
  overrides: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const names = listIcons();
  return (
    <div>
      {values.map((v) => (
        <label key={v} className="g3t-enc-field" data-testid={`enc-icon-${v}`}>
          <span className="g3t-enc-valuename">{v}</span>
          <select
            className="g3t-select"
            aria-label={`Icon for ${v}`}
            value={overrides[v] ?? "(none)"}
            onChange={(e) => {
              const next =
                e.target.value === "(none)"
                  ? Object.fromEntries(
                      Object.entries(overrides).filter(([k]) => k !== v),
                    )
                  : { ...overrides, [v]: e.target.value };
              onChange(next);
            }}
          >
            <option>(none)</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          {overrides[v] ? <Icon name={overrides[v] ?? ""} size={12} /> : null}
        </label>
      ))}
    </div>
  );
}

function ShapeMapEditor({
  values,
  overrides,
  onChange,
}: {
  values: string[];
  overrides: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div>
      {values.map((v) => (
        <label key={v} className="g3t-enc-field" data-testid={`enc-shape-${v}`}>
          <span className="g3t-enc-valuename">{v}</span>
          <select
            className="g3t-select"
            aria-label={`Shape for ${v}`}
            value={overrides[v] ?? "(auto)"}
            onChange={(e) => {
              const next =
                e.target.value === "(auto)"
                  ? Object.fromEntries(
                      Object.entries(overrides).filter(([k]) => k !== v),
                    )
                  : { ...overrides, [v]: e.target.value };
              onChange(next);
            }}
          >
            <option>(auto)</option>
            {NODE_SHAPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

// ── The panel ────────────────────────────────────────────────────────

export interface EncodingSpecPanelProps {
  ugm: UGM;
  spec: EncodingSpec;
  onChange: (spec: EncodingSpec) => void;
  /** Canvas background for palette contrast warnings; defaults to the
   *  live --g3t-canvas-bg token. */
  canvasBg?: string;
  /** Rows expanded on mount (acceptance-page states). */
  defaultExpanded?: string[];
  className?: string;
}

export function EncodingSpecPanel({
  ugm,
  spec,
  onChange,
  canvasBg,
  defaultExpanded = [],
  className,
}: EncodingSpecPanelProps) {
  const bg = canvasBg ?? liveCanvasBg();
  const nodeProps = useMemo(
    () => ["types", ...propertyKeys(ugm, "node")],
    [ugm],
  );
  const edgeProps = useMemo(
    () => ["type", ...propertyKeys(ugm, "edge")],
    [ugm],
  );
  const colorValues = distinctDriverValues(
    ugm,
    spec.node.color?.driver,
    "node",
  );
  const iconValues = distinctDriverValues(ugm, spec.node.icon?.driver, "node");

  const set = (mut: (draft: EncodingSpec) => void) => {
    const draft: EncodingSpec = JSON.parse(JSON.stringify(spec));
    mut(draft);
    onChange(draft);
  };

  const colorEnc = spec.node.color;
  // One resolver for the whole strip: creating it per value (the
  // round-9 form) gave every value a fresh categorical indexer, so
  // everything landed on slot 0 and the strip collapsed to one color.
  const chipResolver =
    colorEnc?.scale.kind === "categorical"
      ? makeColorResolver(colorEnc, { ugm })
      : null;
  const colorChip =
    colorEnc?.scale.kind === "categorical" && chipResolver
      ? chipStrip(
          colorValues.map((v) =>
            chipResolver(sampleAttrsFor(colorEnc.driver, v)),
          ),
        )
      : colorEnc?.scale.kind === "sequential"
        ? chipStrip(SEQUENTIAL_SCALE.filter((_, i) => i % 2 === 0))
        : colorEnc?.scale.kind === "fixed"
          ? chipStrip([colorEnc.scale.value])
          : "theme default";

  const sizeEnc = spec.node.size;
  const sizeChip =
    sizeEnc?.scale.kind === "sequential"
      ? `${sizeEnc.scale.range?.[0] ?? 4}\u2013${sizeEnc.scale.range?.[1] ?? 32}px`
      : sizeEnc?.scale.kind === "fixed"
        ? `${sizeEnc.scale.value}px`
        : "theme default";

  return (
    <div className={className} data-testid="encoding-spec-panel">
      <div className="g3t-panel-section-header" style={{ cursor: "default" }}>
        Visual Encoding
      </div>

      <ChannelRow
        channel="node.color"
        driverOptions={nodeProps}
        driver={
          colorEnc?.driver ??
          (colorEnc?.scale.kind === "fixed" ? "fixed" : undefined)
        }
        onDriver={(d) =>
          set((s) => {
            if (!d) delete s.node.color;
            else if (d === "fixed")
              s.node.color = { scale: { kind: "fixed", value: "#9aa0a6" } };
            else
              s.node.color = {
                driver: d,
                scale:
                  propertyKind(ugm, d, "node") === "numeric"
                    ? { kind: "sequential", domain: "auto" }
                    : s.node.color?.scale.kind === "categorical"
                      ? s.node.color.scale
                      : { kind: "categorical", palette: "okabe-ito" },
              };
          })
        }
        chip={colorChip}
        defaultExpanded={defaultExpanded.includes("node.color")}
        editor={
          colorEnc?.scale.kind === "categorical" ? (
            <CategoricalColorEditor
              values={colorValues}
              scale={colorEnc.scale}
              canvasBg={bg}
              onChange={(scale) =>
                set((s) => {
                  s.node.color = { driver: colorEnc.driver, scale };
                })
              }
            />
          ) : colorEnc?.scale.kind === "fixed" ? (
            <div className="g3t-enc-field">
              <span className="g3t-enc-valuename">color</span>
              <input
                type="color"
                aria-label="Fixed node color"
                value={colorEnc.scale.value}
                onChange={(e) =>
                  set((s) => {
                    s.node.color = {
                      scale: { kind: "fixed", value: e.target.value },
                    };
                  })
                }
              />
            </div>
          ) : null
        }
      />

      <ChannelRow
        channel="node.size"
        driverOptions={nodeProps}
        driver={
          sizeEnc?.driver ??
          (sizeEnc?.scale.kind === "fixed" ? "fixed" : undefined)
        }
        onDriver={(d) =>
          set((s) => {
            if (!d) delete s.node.size;
            else if (d === "fixed")
              s.node.size = { scale: { kind: "fixed", value: 18 } };
            else
              s.node.size = {
                driver: d,
                scale: { kind: "sequential", domain: "auto", range: [8, 32] },
              };
          })
        }
        chip={sizeChip}
        defaultExpanded={defaultExpanded.includes("node.size")}
        editor={
          sizeEnc?.scale.kind === "fixed" ? (
            <FixedNumberEditor
              label="size"
              value={sizeEnc.scale.value}
              min={4}
              max={64}
              onChange={(value) =>
                set((s) => {
                  s.node.size = { scale: { kind: "fixed", value } };
                })
              }
            />
          ) : sizeEnc?.scale.kind === "sequential" ? (
            <RangeEditor
              domain={sizeEnc.scale.domain}
              range={sizeEnc.scale.range ?? [8, 32]}
              onChange={(domain, range) =>
                set((s) => {
                  s.node.size = {
                    driver: sizeEnc.driver,
                    scale: { kind: "sequential", domain, range },
                  };
                })
              }
            />
          ) : null
        }
      />

      <ChannelRow
        channel="node.icon"
        driverOptions={nodeProps}
        driver={spec.node.icon?.driver}
        onDriver={(d) =>
          set((s) => {
            if (!d || d === "fixed") delete s.node.icon;
            else
              s.node.icon = {
                driver: d,
                scale: { kind: "categorical", overrides: {} },
              };
          })
        }
        chip={
          spec.node.icon?.scale.kind === "categorical"
            ? `${Object.keys(spec.node.icon.scale.overrides ?? {}).length} mapped`
            : "none"
        }
        defaultExpanded={defaultExpanded.includes("node.icon")}
        editor={
          spec.node.icon?.scale.kind === "categorical" ? (
            <IconMapEditor
              values={iconValues}
              overrides={spec.node.icon.scale.overrides ?? {}}
              onChange={(overrides) =>
                set((s) => {
                  s.node.icon = {
                    driver: spec.node.icon?.driver,
                    scale: { kind: "categorical", overrides },
                  };
                })
              }
            />
          ) : null
        }
      />

      <ChannelRow
        channel="node.shape"
        driverOptions={nodeProps}
        driver={
          spec.node.shape?.driver ??
          (spec.node.shape?.scale.kind === "fixed" ? "fixed" : undefined)
        }
        onDriver={(d) =>
          set((s) => {
            if (!d) delete s.node.shape;
            // Round-18 finding 4: "fixed" used to fall through to
            // None. Fixed is a legitimate shape mode (one shape for
            // every node), mirroring node.size's fixed handling.
            else if (d === "fixed")
              s.node.shape = { scale: { kind: "fixed", value: "ellipse" } };
            else
              s.node.shape = {
                driver: d,
                scale: { kind: "categorical", overrides: {} },
              };
          })
        }
        chip={
          spec.node.shape?.scale.kind === "categorical"
            ? `${Object.keys(spec.node.shape.scale.overrides ?? {}).length} pinned, rest auto-cycle`
            : spec.node.shape?.scale.kind === "fixed"
              ? spec.node.shape.scale.value
              : "paired default"
        }
        defaultExpanded={defaultExpanded.includes("node.shape")}
        editor={
          spec.node.shape?.scale.kind === "categorical" ? (
            <div>
              {spec.node.color?.driver !== undefined &&
              spec.node.shape.driver !== spec.node.color.driver ? (
                <div className="g3t-enc-warning" role="status">
                  <Icon name="warning" size={11} /> shape and color drive from
                  different attributes; the paired-redundancy default (shape
                  backs up hue for color-vision safety) is broken. Intentional
                  dual-channel use only: see encoding-controls.md.
                </div>
              ) : null}
              <ShapeMapEditor
                values={distinctDriverValues(
                  ugm,
                  spec.node.shape.driver,
                  "node",
                )}
                overrides={spec.node.shape.scale.overrides ?? {}}
                onChange={(overrides) =>
                  set((s) => {
                    s.node.shape = {
                      driver: spec.node.shape?.driver,
                      scale: { kind: "categorical", overrides },
                    };
                  })
                }
              />
            </div>
          ) : spec.node.shape?.scale.kind === "fixed" ? (
            <div className="g3t-enc-field">
              <span className="g3t-enc-valuename">shape</span>
              <select
                className="g3t-select"
                aria-label="Fixed node shape"
                value={spec.node.shape.scale.value}
                onChange={(e) =>
                  set((s) => {
                    s.node.shape = {
                      scale: { kind: "fixed", value: e.target.value },
                    };
                  })
                }
              >
                {NODE_SHAPES.map((sh) => (
                  <option key={sh}>{sh}</option>
                ))}
              </select>
            </div>
          ) : null
        }
      />

      <ChannelRow
        channel="node.label"
        driverOptions={nodeProps}
        driver={(spec.node.label as { driver?: string } | undefined)?.driver}
        onDriver={(d) =>
          set((s) => {
            if (!d || d === "fixed") delete s.node.label;
            else s.node.label = { driver: d };
          })
        }
        chip={
          (spec.node.label as { driver?: string } | undefined)?.driver
            ? `Aa ${(spec.node.label as { driver: string }).driver}`
            : "off"
        }
        editor={null}
      />

      <ChannelRow
        channel="edge.color"
        driverOptions={edgeProps}
        driver={
          spec.edge.color?.driver ??
          (spec.edge.color?.scale.kind === "fixed" ? "fixed" : undefined)
        }
        onDriver={(d) =>
          set((s) => {
            if (!d) delete s.edge.color;
            else if (d === "fixed")
              s.edge.color = { scale: { kind: "fixed", value: "#9aa0a6" } };
            else
              s.edge.color = {
                driver: d,
                scale: { kind: "categorical", palette: "okabe-ito" },
              };
          })
        }
        chip={
          spec.edge.color?.scale.kind === "categorical"
            ? chipStrip(
                (() => {
                  const r = makeColorResolver(spec.edge.color, { ugm }, "edge");
                  return distinctDriverValues(
                    ugm,
                    spec.edge.color.driver,
                    "edge",
                  ).map((v) => r(sampleAttrsFor(spec.edge.color?.driver, v)));
                })(),
              )
            : spec.edge.color?.scale.kind === "fixed"
              ? chipStrip([spec.edge.color.scale.value])
              : "theme default"
        }
        defaultExpanded={defaultExpanded.includes("edge.color")}
        editor={
          spec.edge.color?.scale.kind === "categorical" ? (
            <CategoricalColorEditor
              values={distinctDriverValues(ugm, spec.edge.color.driver, "edge")}
              scale={spec.edge.color.scale}
              canvasBg={bg}
              onChange={(scale) =>
                set((s) => {
                  s.edge.color = { driver: spec.edge.color?.driver, scale };
                })
              }
            />
          ) : spec.edge.color?.scale.kind === "fixed" ? (
            <label className="g3t-enc-field">
              color
              <input
                type="color"
                aria-label="Fixed edge color"
                value={spec.edge.color.scale.value}
                onChange={(e) =>
                  set((s) => {
                    s.edge.color = {
                      scale: { kind: "fixed", value: e.target.value },
                    };
                  })
                }
              />
            </label>
          ) : null
        }
      />

      <ChannelRow
        channel="edge.width"
        driverOptions={edgeProps}
        driver={
          spec.edge.width?.driver ??
          (spec.edge.width?.scale.kind === "fixed" ? "fixed" : undefined)
        }
        onDriver={(d) =>
          set((s) => {
            if (!d) delete s.edge.width;
            else if (d === "fixed")
              s.edge.width = { scale: { kind: "fixed", value: 2 } };
            else
              s.edge.width = {
                driver: d,
                scale: { kind: "sequential", domain: "auto", range: [1, 6] },
              };
          })
        }
        chip={
          spec.edge.width?.scale.kind === "sequential"
            ? `${spec.edge.width.scale.range?.[0] ?? 1}\u2013${spec.edge.width.scale.range?.[1] ?? 6}px`
            : spec.edge.width?.scale.kind === "fixed"
              ? `${spec.edge.width.scale.value}px`
              : "theme default"
        }
        defaultExpanded={defaultExpanded.includes("edge.width")}
        editor={
          spec.edge.width?.scale.kind === "fixed" ? (
            <FixedNumberEditor
              label="width"
              value={spec.edge.width.scale.value}
              min={1}
              max={12}
              onChange={(value) =>
                set((s) => {
                  s.edge.width = { scale: { kind: "fixed", value } };
                })
              }
            />
          ) : spec.edge.width?.scale.kind === "sequential" ? (
            <RangeEditor
              domain={spec.edge.width.scale.domain}
              range={spec.edge.width.scale.range ?? [1, 6]}
              onChange={(domain, range) =>
                set((s) => {
                  s.edge.width = {
                    driver: spec.edge.width?.driver,
                    scale: { kind: "sequential", domain, range },
                  };
                })
              }
            />
          ) : null
        }
      />

      {/* Reserved/theme-delegated rows: visible so the mental model is
          complete; edited where themes are edited. */}
      <ChannelRow
        channel="effects.accent"
        driverOptions={[]}
        driver={undefined}
        onDriver={() => {}}
        chip=""
        editor={null}
        themeDelegated="selection accent (reserved)"
      />
      <ChannelRow
        channel="canvas.background"
        driverOptions={[]}
        driver={undefined}
        onDriver={() => {}}
        chip=""
        editor={null}
        themeDelegated="--g3t-canvas-bg"
      />
    </div>
  );
}

// ── Preview: proof, not illustration ─────────────────────────────────

export interface EncodingPreviewProps {
  ugm: UGM;
  spec: EncodingSpec;
  /** Sample node attrs to render; defaults to one per distinct type. */
  samples?: ElementAttrs[];
  className?: string;
}

export function EncodingPreview({
  ugm,
  spec,
  samples,
  className,
}: EncodingPreviewProps) {
  const color = makeColorResolver(spec.node.color, { ugm });
  const size = makeSizeResolver(spec.node.size, { ugm });
  const icon = makeIconResolver(spec.node.icon);
  const labelDriver = (spec.node.label as { driver?: string } | undefined)
    ?.driver;

  const items: ElementAttrs[] = useMemo(() => {
    if (samples) return samples;
    // Default to REAL node attrs so every channel's driver has its
    // actual values (the round-8 default fabricated types-only attrs
    // and broke for label/pagerank drivers).
    const out: ElementAttrs[] = [];
    ugm.forEachNode((_id, attrs) => {
      if (out.length < 4) out.push(attrs);
    });
    return out;
  }, [samples, ugm]);

  return (
    <div className={className} data-testid="encoding-preview">
      {items.map((attrs, i) => {
        const d = Math.round(size(attrs) ?? 18);
        const fill = color(attrs) ?? "var(--g3t-type-0)";
        const glyph = icon(attrs);
        const label = labelDriver
          ? String(
              labelDriver === "types"
                ? attrs.types?.[0]
                : (attrs.properties[labelDriver] ?? ""),
            )
          : "";
        return (
          <span
            key={i}
            className="g3t-enc-sample"
            data-testid={`enc-sample-${i}`}
          >
            <span
              className="g3t-enc-samplenode"
              style={{ width: d, height: d, background: fill }}
              data-size={d}
            >
              {glyph ? (
                <span style={{ color: glyphStrokeFor(fill) }}>
                  <Icon name={glyph} size={Math.max(8, Math.round(d * 0.55))} />
                </span>
              ) : null}
            </span>
            {label ? (
              <span className="g3t-enc-samplelabel">{label}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
