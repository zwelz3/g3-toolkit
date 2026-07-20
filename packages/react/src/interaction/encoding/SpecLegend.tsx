/**
 * SpecLegend: the legend as a read-only mirror of the encoding spec
 * (tier 1 of roadmap/design/encoding-controls.md, rendered for the
 * canvas's audience instead of the panel's). Every swatch, glyph, and
 * size dot comes through the SAME resolvers the canvas patch uses, so
 * legend and canvas cannot disagree.
 *
 * The legacy CanvasLegend (EncodingConfig) remains for the demo
 * shells until their migration; new surfaces should use this one.
 */

import { useMemo, useState } from "react";
import type { UGM } from "@g3t/core";
import { Icon } from "../../icons";
import { shapeForIndex } from "../../views/canvas/palette";
import {
  makeColorResolver,
  makeIconResolver,
  makeShapeResolver,
  makeSizeResolver,
  type ElementAttrs,
  type EncodingSpec,
} from "./encoding-spec";
import { SEQUENTIAL_SCALE, DIVERGING_SCALE } from "./palette-bridge";

function distinctValues(
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
  else ugm.forEachEdge((_id, a) => visit(a as ElementAttrs));
  return [...out];
}

function sampleFor(driver: string | undefined, v: string): ElementAttrs {
  if (driver === "types") return { types: [v], properties: {} };
  if (driver === "type") return { type: v, properties: {} };
  const n = Number(v);
  return {
    types: [],
    properties: driver
      ? { [driver]: v.trim() !== "" && Number.isFinite(n) ? n : v }
      : {},
  };
}

export interface SpecLegendProps {
  ugm: UGM;
  spec: EncodingSpec;
  /** When true, render a header with a collapse/expand toggle so the
   *  legend can be tucked away (it can otherwise cover the canvas). */
  collapsible?: boolean;
  /** Initial collapsed state when collapsible (default false = open). */
  defaultCollapsed?: boolean;
  /** Header label shown when collapsible (default "Legend"). */
  title?: string;
  /** Display transform for categorical values (e.g. shorten IRIs to
   *  prefixed names). Affects labels only; resolution keys are raw. */
  labelFor?: (value: string) => string;
  className?: string;
}

/** Tiny glyphs for the standard shapes; names fall back to text. */
function ShapeGlyph({ shape }: { shape: string }) {
  const stroke = "var(--g3t-text-secondary)";
  const common = { fill: "none", stroke, strokeWidth: 1.4 } as const;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {shape === "ellipse" ? (
        <circle cx="7" cy="7" r="5" {...common} />
      ) : shape === "rectangle" ? (
        <rect x="2" y="3" width="10" height="8" {...common} />
      ) : shape === "round-rectangle" ? (
        <rect x="2" y="3" width="10" height="8" rx="2.5" {...common} />
      ) : shape === "diamond" ? (
        <polygon points="7,1.5 12.5,7 7,12.5 1.5,7" {...common} />
      ) : shape === "triangle" ? (
        <polygon points="7,2 12.5,12 1.5,12" {...common} />
      ) : shape === "hexagon" ? (
        <polygon points="4,2.5 10,2.5 13,7 10,11.5 4,11.5 1,7" {...common} />
      ) : (
        <circle cx="7" cy="7" r="5" {...common} strokeDasharray="2 2" />
      )}
    </svg>
  );
}

/** Order categorical values by explicit domain position first (review
 *  4.4: stable legend order), data-discovered extras after. */
function orderByDomain(
  values: string[],
  domain: readonly string[] | undefined,
): string[] {
  if (!domain || domain.length === 0) return values;
  const pos = new Map(domain.map((v, i) => [v, i]));
  const inDomain = values
    .filter((v) => pos.has(v))
    .sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
  const extras = values.filter((v) => !pos.has(v));
  return [...inDomain, ...extras];
}

export function SpecLegend({
  ugm,
  spec,
  collapsible = false,
  defaultCollapsed = false,
  title = "Legend",
  labelFor,
  className,
}: SpecLegendProps) {
  const display = labelFor ?? ((v: string) => v);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const colorEnc = spec.node.color;
  const sizeEnc = spec.node.size;
  const iconEnc = spec.node.icon;
  const shapeEnc = spec.node.shape;
  const edgeWidthEnc = spec.edge.width;

  // 12.15: when the spec declares NO shape encoding, the canvas still
  // assigns shapes (buildTypeVisualMap: sorted types cycled through
  // shapeForIndex). The legend's job is decoding the canvas, so it
  // documents that DEFAULT channel rather than showing color only;
  // rows reproduce the exact same sort + cycle. Skipped when all
  // nodes would share one shape (no information).
  const defaultShapeRows = useMemo(() => {
    if (shapeEnc !== undefined) return [];
    const types = new Set<string>();
    ugm.forEachNode((_id, attrs) => {
      const t = attrs.types[0];
      if (t) types.add(t);
    });
    if (types.size < 2) return [];
    return [...types]
      .sort()
      .map((value, i) => ({ value, shape: shapeForIndex(i) as string }));
  }, [shapeEnc, ugm]);

  const shapeRows = useMemo(() => {
    if (shapeEnc?.scale.kind !== "categorical") return [];
    const resolve = makeShapeResolver(shapeEnc);
    return orderByDomain(
      distinctValues(ugm, shapeEnc.driver, "node"),
      shapeEnc.scale.domain,
    )
      .map((v) => ({ value: v, shape: resolve(sampleFor(shapeEnc.driver, v)) }))
      .filter(
        (r): r is { value: string; shape: string } => r.shape !== undefined,
      );
  }, [shapeEnc, ugm]);

  const colorRows = useMemo(() => {
    if (colorEnc?.scale.kind !== "categorical") return [];
    const resolve = makeColorResolver(colorEnc, { ugm });
    return orderByDomain(
      distinctValues(ugm, colorEnc.driver, "node"),
      colorEnc.scale.domain,
    ).map((v) => ({
      value: v,
      color: resolve(sampleFor(colorEnc.driver, v)),
    }));
  }, [colorEnc, ugm]);

  const iconRows = useMemo(() => {
    if (iconEnc?.scale.kind !== "categorical") return [];
    const resolve = makeIconResolver(iconEnc);
    return orderByDomain(
      distinctValues(ugm, iconEnc.driver, "node"),
      iconEnc.scale.domain,
    )
      .map((v) => ({ value: v, icon: resolve(sampleFor(iconEnc.driver, v)) }))
      .filter(
        (r): r is { value: string; icon: string } => r.icon !== undefined,
      );
  }, [iconEnc, ugm]);

  const sizeRow = useMemo(() => {
    if (sizeEnc?.scale.kind !== "sequential") return null;
    const resolve = makeSizeResolver(sizeEnc, { ugm });
    const dom = sizeEnc.scale.domain === "auto" ? null : sizeEnc.scale.domain;
    const [lo, hi] = sizeEnc.scale.range ?? [4, 32];
    return { lo, hi, domain: dom, driver: sizeEnc.driver, resolve };
  }, [sizeEnc, ugm]);

  return (
    <div className={className} data-testid="g3t-spec-legend">
      {collapsible && (
        <button
          type="button"
          data-testid="legend-collapse-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="g3t-legend-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            font: "inherit",
            color: "inherit",
            padding: "2px 0",
            fontWeight: 600,
          }}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={12} />
          {title}
        </button>
      )}
      {!collapsed && (
        <>
          {colorEnc?.scale.kind === "categorical" && colorRows.length > 0 ? (
            <section>
              <div className="g3t-legend-title">
                color: <code>{colorEnc.driver}</code>
              </div>
              {colorRows.map((r) => (
                <div
                  key={r.value}
                  className="g3t-legend-row"
                  data-testid={`legend-color-${r.value}`}
                >
                  <span
                    className="g3t-legend-swatch"
                    style={{ background: r.color }}
                  />
                  {display(r.value)}
                </div>
              ))}
            </section>
          ) : null}

          {colorEnc?.scale.kind === "sequential" ? (
            <section>
              <div className="g3t-legend-title">
                color: <code>{colorEnc.driver}</code> (ramp)
              </div>
              <div className="g3t-legend-ramp" data-testid="legend-color-ramp">
                {(colorEnc.scale.ramp === "diverging"
                  ? DIVERGING_SCALE
                  : SEQUENTIAL_SCALE
                ).map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
            </section>
          ) : null}

          {sizeRow ? (
            <section>
              <div className="g3t-legend-title">
                size: <code>{sizeRow.driver}</code>
                {sizeRow.domain
                  ? ` (domain ${sizeRow.domain[0]}\u2013${sizeRow.domain[1]})`
                  : " (auto domain)"}
              </div>
              <div className="g3t-legend-row" data-testid="legend-size">
                <span
                  className="g3t-legend-dot"
                  style={{ width: sizeRow.lo, height: sizeRow.lo }}
                />
                {sizeRow.lo}px
                <span
                  className="g3t-legend-dot"
                  style={{ width: sizeRow.hi, height: sizeRow.hi }}
                />
                {sizeRow.hi}px
              </div>
            </section>
          ) : null}

          {shapeRows.length > 0 || defaultShapeRows.length > 0 ? (
            <section>
              <div className="g3t-legend-title">
                shape: <code>{shapeEnc?.driver ?? "types (default)"}</code>
              </div>
              {(shapeRows.length > 0 ? shapeRows : defaultShapeRows).map(
                (r) => (
                  <div
                    key={r.value}
                    className="g3t-legend-row"
                    data-testid={`legend-shape-${r.value}`}
                  >
                    <ShapeGlyph shape={r.shape} /> {display(r.value)}
                    <span className="g3t-legend-shapename">({r.shape})</span>
                  </div>
                ),
              )}
            </section>
          ) : null}

          {iconRows.length > 0 ? (
            <section>
              <div className="g3t-legend-title">
                icon: <code>{iconEnc?.driver}</code>
              </div>
              {iconRows.map((r) => (
                <div
                  key={r.value}
                  className="g3t-legend-row"
                  data-testid={`legend-icon-${r.value}`}
                >
                  <Icon name={r.icon} size={12} /> {display(r.value)}
                </div>
              ))}
            </section>
          ) : null}

          {edgeWidthEnc?.scale.kind === "sequential" ? (
            <section>
              <div className="g3t-legend-title">
                edge width: <code>{edgeWidthEnc.driver}</code>
              </div>
              <div className="g3t-legend-row" data-testid="legend-edge-width">
                <span
                  className="g3t-legend-line"
                  style={{ height: edgeWidthEnc.scale.range?.[0] ?? 1 }}
                />
                <span
                  className="g3t-legend-line"
                  style={{ height: edgeWidthEnc.scale.range?.[1] ?? 6 }}
                />
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
