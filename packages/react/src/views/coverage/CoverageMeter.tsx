/**
 * CoverageMeter: a two-strength coverage visualization (originated in
 * the retired flagship demo; demonstrated in examples/decision-dashboards).
 *
 * One horizontal meter per concept, showing a SOLID bar (the value you
 * can defend) behind a GHOST bar (the value you could claim), with the
 * delta between them (the EXPOSURE) highlighted. It reads at a glance as
 * "how much of this requirement can we prove, versus how much would we
 * assert" : the moment a viewer sees the ghost run past the solid on a
 * required concept, they understand the overclaim.
 *
 * Reusable beyond the demo: any target-vs-actual or claimed-vs-proven
 * pair maps onto it. The component is presentational and dependency-light
 * (React only); the consumer supplies already-normalized coverages and
 * decides reduced-motion via the `animate` prop, so the meter has no
 * opinion about data sourcing or motion policy.
 *
 * Tokens follow the inline-style + CSS-custom-property convention used
 * across @g3t/react; the per-state colors fall back to hardcoded hex when
 * a brand theme has not defined the semantic token.
 */

import { useEffect, useState } from "react";

/** The three honest states a required concept resolves to (see the
 *  originating analytic). Drives the meter's accent. "neutral" is the
 *  generic target-vs-actual case with no state semantics. */
export type CoverageState = "discriminator" | "exposed" | "gap" | "neutral";

export interface CoverageMeterProps {
  /** Concept (or metric) name shown beside the meter. */
  label: string;
  /** Substantiated coverage, 0..1 (the solid bar; the defensible floor). */
  substantiated: number;
  /** Claimable coverage, 0..1 (the ghost bar; the performative ceiling).
   *  Clamped to be at least `substantiated` so the exposure never reads
   *  negative. */
  claimable: number;
  /** Honest state; selects the accent color. Defaults to "neutral". */
  state?: CoverageState;
  /** Render the percentage values at the right. Default true. */
  showValues?: boolean;
  /** Animate the fill on mount. The consumer passes its reduced-motion
   *  decision here; the meter does not consult matchMedia itself.
   *  Default true. */
  animate?: boolean;
  /** Track height in px. Default 14. */
  height?: number;
  testId?: string;
  className?: string;
}

const ACCENTS: Record<CoverageState, { solid: string; ghost: string }> = {
  // Provable strength: a confident positive accent.
  discriminator: {
    solid: "var(--g3t-success, #2e7d32)",
    ghost: "var(--g3t-success-muted, rgba(46, 125, 50, 0.28))",
  },
  // Claim outruns proof: the warning accent, the exposure made visible.
  exposed: {
    solid: "var(--g3t-warning, #b45309)",
    ghost: "var(--g3t-warning-muted, rgba(180, 83, 9, 0.28))",
  },
  // Neither provable nor credibly claimable: the danger accent.
  gap: {
    solid: "var(--g3t-error, #c62828)",
    ghost: "var(--g3t-error-muted, rgba(198, 40, 40, 0.26))",
  },
  // Generic target-vs-actual.
  neutral: {
    solid: "var(--g3t-accent-primary, #2563eb)",
    ghost: "var(--g3t-accent-muted, rgba(37, 99, 235, 0.26))",
  },
};

const pct = (v: number): string => `${Math.round(clamp01(v) * 100)}%`;

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function CoverageMeter({
  label,
  substantiated,
  claimable,
  state = "neutral",
  showValues = true,
  animate = true,
  height = 14,
  testId,
  className,
}: CoverageMeterProps) {
  const sub = clamp01(substantiated);
  // The ghost never falls behind the solid; the exposure is sub..claim.
  const claim = Math.max(sub, clamp01(claimable));
  const exposure = Number((claim - sub).toFixed(3));
  const accent = ACCENTS[state];

  // Mount animation: grow from 0 to target. When `animate` is false the
  // fills sit at their target immediately (no transition), which is also
  // what a reduced-motion consumer asks for. `grown` only ever records
  // that the post-mount frame has fired; the at-target decision is
  // DERIVED (grown || !animate), so no synchronous setState is needed
  // when `animate` is (or becomes) false.
  const [grown, setGrown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);
  const atTarget = grown || !animate;

  const transition = animate
    ? "width 600ms cubic-bezier(0.22, 1, 0.36, 1)"
    : "none";
  const solidWidth = atTarget ? pct(sub) : "0%";
  const ghostWidth = atTarget ? pct(claim) : "0%";

  const ariaLabel =
    `${label}: ${pct(sub)} substantiated, ${pct(claim)} claimable` +
    (exposure > 0 ? `, ${pct(exposure)} exposed` : "") +
    (state !== "neutral" ? ` (${state})` : "");

  return (
    <div
      data-testid={testId ?? "g3t-coverage-meter"}
      data-state={state}
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--g3t-space-3, 12px)",
        fontSize: "var(--g3t-font-sm, 12px)",
        color: "var(--g3t-text-secondary, #666)",
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          minWidth: 132,
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "var(--g3t-text-primary, #1a1a1a)",
        }}
        title={label}
      >
        {label}
      </div>

      <div
        data-testid="g3t-coverage-track"
        style={{
          position: "relative",
          flex: "1 1 auto",
          height,
          background: "var(--g3t-bg-tertiary, #eceff3)",
          borderRadius: "var(--g3t-radius-sm, 4px)",
          overflow: "hidden",
        }}
      >
        {/* Ghost (claimable) behind. */}
        <div
          data-testid="g3t-coverage-ghost"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: ghostWidth,
            background: accent.ghost,
            transition,
          }}
        />
        {/* Exposure band: the claimable run-past, drawn from the solid's
            edge to the ghost's edge so the overclaim is literally the
            highlighted strip. Rendered only when there is exposure. */}
        {exposure > 0 ? (
          <div
            data-testid="g3t-coverage-exposure"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: solidWidth,
              width: atTarget ? pct(exposure) : "0%",
              backgroundImage: `repeating-linear-gradient(45deg, ${accent.solid} 0, ${accent.solid} 2px, transparent 2px, transparent 5px)`,
              opacity: 0.55,
              transition: animate
                ? "left 600ms cubic-bezier(0.22, 1, 0.36, 1), width 600ms cubic-bezier(0.22, 1, 0.36, 1)"
                : "none",
            }}
          />
        ) : null}
        {/* Solid (substantiated) in front. */}
        <div
          data-testid="g3t-coverage-solid"
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: solidWidth,
            background: accent.solid,
            borderRadius: "var(--g3t-radius-sm, 4px)",
            transition,
          }}
        />
      </div>

      {showValues ? (
        <div
          data-testid="g3t-coverage-values"
          style={{
            flex: "0 0 auto",
            minWidth: 92,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ color: "var(--g3t-text-primary, #1a1a1a)" }}>
            {pct(sub)}
          </span>
          <span style={{ color: "var(--g3t-text-muted, #888)" }}>
            {" / "}
            {pct(claim)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export interface CoverageMeterRow {
  label: string;
  substantiated: number;
  claimable: number;
  state?: CoverageState;
}

export interface CoverageMeterListProps {
  rows: CoverageMeterRow[];
  showValues?: boolean;
  animate?: boolean;
  height?: number;
  /** Stagger each row's mount animation by this many ms. Default 0. */
  staggerMs?: number;
  testId?: string;
  className?: string;
}

/** A stacked set of meters: the Act II "two bars per requirement" table
 *  as one component. Thin wrapper; the row is the unit of reuse. */
export function CoverageMeterList({
  rows,
  showValues = true,
  animate = true,
  height,
  staggerMs = 0,
  testId,
  className,
}: CoverageMeterListProps) {
  return (
    <div
      data-testid={testId ?? "g3t-coverage-meter-list"}
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--g3t-space-2, 8px)",
      }}
    >
      {rows.map((r, i) => (
        <StaggeredMeter
          key={`${r.label}-${i}`}
          row={r}
          showValues={showValues}
          animate={animate}
          height={height}
          delayMs={animate ? staggerMs * i : 0}
        />
      ))}
    </div>
  );
}

function StaggeredMeter({
  row,
  showValues,
  animate,
  height,
  delayMs,
}: {
  row: CoverageMeterRow;
  showValues: boolean;
  animate: boolean;
  height?: number;
  delayMs: number;
}) {
  const [ready, setReady] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const id = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return (
    <CoverageMeter
      label={row.label}
      substantiated={row.substantiated}
      claimable={row.claimable}
      state={row.state}
      showValues={showValues}
      animate={animate && ready}
      {...(height === undefined ? {} : { height })}
    />
  );
}
