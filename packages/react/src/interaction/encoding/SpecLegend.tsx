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

/** R-13.3: an element descriptor, the same shape NodeStyleTarget
 *  uses, so one legend can serve a UGM-backed canvas and a
 *  structural scene. */
export interface LegendElement {
  id: string;
  type?: string;
  label?: string;
  properties?: Record<string, unknown>;
}

function distinctValues(
  ugm: UGM | undefined,
  driver: string | undefined,
  target: "node" | "edge",
  elements?: readonly LegendElement[],
): string[] {
  if (!driver) return [];
  const out = new Set<string>();
  const visit = (attrs: ElementAttrs) => {
    if (driver === "types") {
      // LR-49 (owner review 2026-07-22): collect EVERY membership,
      // not just the primary type. Inference adds supertypes as
      // secondary types, and the 5.21 multi-type rings render those
      // memberships as visible slices: a slice on screen must have a
      // legend row.
      for (const t of attrs.types ?? []) out.add(String(t));
      return;
    }
    const v =
      driver === "type" && attrs.type !== undefined
        ? attrs.type
        : attrs.properties[driver];
    if (v !== undefined && v !== null) out.add(String(v));
  };
  if (ugm !== undefined) {
    if (target === "node") ugm.forEachNode((_id, a) => visit(a));
    else ugm.forEachEdge((_id, a) => visit(a as ElementAttrs));
  } else if (target === "node") {
    // R-13.3 (round 21, 2026-08-05): a structural scene has no UGM,
    // so one legend serves both renderers from the same descriptor
    // list R-12b introduced. Hand-writing a second legend is the
    // answer every previous round established as wrong.
    for (const el of elements ?? []) {
      visit({
        ...(el.type !== undefined ? { types: [el.type], type: el.type } : {}),
        properties: el.properties ?? {},
      } as ElementAttrs);
    }
  }
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
  /** R-13 (register, 2026-08-05): the manual style overrides in
   *  scope. The legend asserts that a colour means a class; a
   *  reader repainting one node makes that assertion FALSE, and
   *  the legend had no way to know. Passing them lets it disclose
   *  rather than mislead. */
  overrides?: readonly { scope: { nodeId: string } | { type: string } }[];
  /** Shown as a reset control beside the disclosure. */
  onResetOverrides?: () => void;
  /** Omit when rendering for a structural scene and pass
   *  `elements` instead (R-13.3). */
  ugm?: UGM;
  /** R-13.3: element descriptors for renderers without a UGM. */
  elements?: readonly LegendElement[];
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
        // G5 v2 (owner screenshot 2026-07-28): grown to the diamond's
        // 11-span so the square reads the same visual weight.
        <rect x="1.5" y="1.5" width="11" height="11" {...common} />
      ) : shape === "round-rectangle" || shape === "roundrectangle" ? (
        <rect x="1.5" y="1.5" width="11" height="11" rx="3" {...common} />
      ) : shape === "star" ? (
        // G5 v2: star and barrel had NO branch and fell to the
        // dashed-circle default (the screenshot's mystery glyphs).
        <polygon
          points="7,1 8.6,5.2 13,5.4 9.6,8.2 10.8,12.5 7,10 3.2,12.5 4.4,8.2 1,5.4 5.4,5.2"
          {...common}
        />
      ) : shape === "barrel" ? (
        <path
          d="M 2.5 3.5 Q 7 1.8 11.5 3.5 L 11.5 10.5 Q 7 12.2 2.5 10.5 Z"
          {...common}
        />
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
  elements,
  overrides,
  onResetOverrides,
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
  // VR-2 follow-up (owner verification 2026-07-28): the edge COLOR
  // channel had no legend representation at all, so
  // color-by-confidence painted the graph while the legend said
  // nothing about it.
  const edgeColorEnc = spec.edge.color;

  // 12.15: when the spec declares NO shape encoding, the canvas still
  // assigns shapes (buildTypeVisualMap: sorted types cycled through
  // shapeForIndex). The legend's job is decoding the canvas, so it
  // documents that DEFAULT channel rather than showing color only;
  // rows reproduce the exact same sort + cycle. Skipped when all
  // nodes would share one shape (no information).
  const defaultShapeRows = useMemo(() => {
    if (shapeEnc !== undefined) return [];
    const types = new Set<string>();
    if (ugm !== undefined) {
      ugm.forEachNode((_id, attrs) => {
        const t = attrs.types[0];
        if (t) types.add(t);
      });
    } else {
      for (const el of elements ?? []) {
        if (el.type !== undefined) types.add(el.type);
      }
    }
    if (types.size < 2) return [];
    return [...types]
      .sort()
      .map((value, i) => ({ value, shape: shapeForIndex(i) as string }));
  }, [shapeEnc, ugm]);

  const shapeRows = useMemo(() => {
    if (shapeEnc?.scale.kind !== "categorical") return [];
    const resolve = makeShapeResolver(shapeEnc);
    return orderByDomain(
      distinctValues(ugm, shapeEnc.driver, "node", elements),
      shapeEnc.scale.domain,
    )
      .map((v) => ({ value: v, shape: resolve(sampleFor(shapeEnc.driver, v)) }))
      .filter(
        (r): r is { value: string; shape: string } => r.shape !== undefined,
      );
  }, [shapeEnc, ugm]);

  const colorRows = useMemo(() => {
    if (colorEnc?.scale.kind !== "categorical") return [];
    const resolve = makeColorResolver(
      colorEnc,
      ugm !== undefined ? { ugm } : {},
    );
    return orderByDomain(
      distinctValues(ugm, colorEnc.driver, "node", elements),
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
      distinctValues(ugm, iconEnc.driver, "node", elements),
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

  // R-13: the disclosure. A legend that keeps asserting a rule the
  // reader has locally broken is worse than one that admits it.
  const overrideCount = overrides?.length ?? 0;
  return (
    <div className={className} data-testid="g3t-spec-legend">
      {overrideCount > 0 && (
        <div
          data-testid="legend-override-notice"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            marginBottom: 6,
            fontSize: 11,
            color: "var(--g3t-text-muted, #868e96)",
          }}
        >
          <span>
            {overrideCount === 1
              ? "1 manual style override is active; the key below does not describe it."
              : `${overrideCount} manual style overrides are active; the key below does not describe them.`}
          </span>
          {onResetOverrides !== undefined && (
            <button
              type="button"
              data-testid="legend-override-reset"
              className="g3t-btn"
              onClick={onResetOverrides}
              style={{ fontSize: 11, padding: "1px 6px" }}
            >
              Reset
            </button>
          )}
        </div>
      )}
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

          {edgeColorEnc?.scale.kind === "categorical" &&
          edgeColorEnc.scale.overrides ? (
            <section>
              <div className="g3t-legend-title">
                edge color: <code>{edgeColorEnc.driver}</code>
              </div>
              {Object.entries(edgeColorEnc.scale.overrides).map(
                ([value, color]) => (
                  <div
                    className="g3t-legend-row"
                    key={value}
                    data-testid={`legend-edge-color-${value}`}
                  >
                    <span
                      className="g3t-legend-line"
                      style={{ height: 3, background: String(color) }}
                    />{" "}
                    {display(value)}
                  </div>
                ),
              )}
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
