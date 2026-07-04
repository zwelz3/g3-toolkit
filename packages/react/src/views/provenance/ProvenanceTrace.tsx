/**
 * ProvenanceTrace: the drill-anywhere lineage panel (originated in the
 * retired flagship demo; demonstrated in the auditor shell).
 *
 * @see specs/01-functional-views.md R1.11 (the provenance-chain
 * acceptance leg; the inspector legs are cited from DetailInspector)
 *
 * Given an ordered provenance chain (a pre-order flattening of the
 * provenance tree, each hop carrying its depth), render it as an indented
 * trail from a derived conclusion down to the raw evidence at the leaf:
 * action -> analytic -> concept -> award -> evaluation. Each hop is
 * clickable, so a viewer can walk the chain or jump to any node. A leaf
 * is either real evidence (the award and its evaluation) or, for an
 * exposed concept, the documented ABSENCE of substantiating evidence,
 * styled distinctly so the gap is as legible as the proof.
 *
 * The component is presentational and reusable for any provenance-bearing
 * graph: the caller supplies the chain (see a builder such as the
 * host's chain builder) and decides what a hop means. Tokens follow
 * the inline-style + CSS-custom-property convention used across
 * @g3t/react.
 */

/** One node in a provenance trail. */
export interface ProvenanceHop {
  /** Graph node / action id this hop refers to. */
  id: string;
  /** Tier label, e.g. "action" | "analytic" | "meaning" | "raw". Free
   *  text so the component is not tied to a fixed tier vocabulary. */
  tier: string;
  /** Short title shown on the hop. */
  label: string;
  /** Optional secondary line (a rating, a driver, a relevance). */
  detail?: string;
  /** Depth from the root (0 = the thing being explained). */
  depth: number;
  /** Parent hop id (for tree reconstruction); absent on the root. */
  parentId?: string;
  /** True when this hop is a leaf (raw evidence or documented absence). */
  leaf?: boolean;
  /** True when this leaf represents MISSING evidence (an exposure/gap):
   *  the trace bottoms out in the absence of proof, not in proof. */
  absence?: boolean;
}

/** Ordered root..leaf(s) pre-order flattening of the provenance tree. */
export type ProvenanceChain = ProvenanceHop[];

export interface ProvenanceTraceProps {
  chain: ProvenanceChain;
  /** Called with a hop id when a hop is activated. */
  onSelectHop?: (id: string) => void;
  /** Currently highlighted hop id. */
  selectedId?: string;
  /** Panel heading. */
  title?: string;
  /** Indent step per depth level, px. Default 16. */
  indentPx?: number;
  testId?: string;
  className?: string;
}

const TIER_TINT: Record<string, string> = {
  action: "var(--g3t-accent-primary, #2563eb)",
  analytic: "var(--g3t-accent-primary, #2563eb)",
  meaning: "var(--g3t-text-secondary, #495564)",
  raw: "var(--g3t-text-muted, #8a97a6)",
  evidence: "var(--g3t-success, #2e7d32)",
};

export function ProvenanceTrace({
  chain,
  onSelectHop,
  selectedId,
  title = "Provenance",
  indentPx = 16,
  testId,
  className,
}: ProvenanceTraceProps) {
  return (
    <div
      data-testid={testId ?? "g3t-provenance-trace"}
      className={className}
      role="tree"
      aria-label={title}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--g3t-space-1, 4px)",
        fontSize: "var(--g3t-font-sm, 12px)",
        color: "var(--g3t-text-secondary, #495564)",
      }}
    >
      {title ? (
        <div
          style={{
            fontWeight: 600,
            fontSize: "var(--g3t-font-md, 13px)",
            color: "var(--g3t-text-primary, #16202c)",
            marginBottom: "var(--g3t-space-1, 4px)",
          }}
        >
          {title}
        </div>
      ) : null}

      {chain.length === 0 ? (
        <div
          data-testid="g3t-provenance-empty"
          style={{ color: "var(--g3t-text-muted, #8a97a6)" }}
        >
          No provenance to show.
        </div>
      ) : (
        chain.map((hop) => {
          const selected = hop.id === selectedId;
          const tint = hop.absence
            ? "var(--g3t-warning, #b45309)"
            : (TIER_TINT[hop.tier] ?? "var(--g3t-text-muted, #8a97a6)");
          return (
            <button
              key={hop.id}
              type="button"
              data-testid="g3t-provenance-hop"
              data-tier={hop.tier}
              data-leaf={hop.leaf ? "true" : undefined}
              data-absence={hop.absence ? "true" : undefined}
              role="treeitem"
              aria-level={hop.depth + 1}
              aria-selected={selected}
              onClick={() => onSelectHop?.(hop.id)}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--g3t-space-2, 8px)",
                marginLeft: hop.depth * indentPx,
                padding: "var(--g3t-space-1, 4px) var(--g3t-space-2, 8px)",
                textAlign: "left",
                cursor: onSelectHop ? "pointer" : "default",
                border: "1px solid",
                borderColor: selected
                  ? "var(--g3t-accent-primary, #2563eb)"
                  : "var(--g3t-border, #dde3ea)",
                borderLeft: `3px solid ${tint}`,
                borderRadius: "var(--g3t-radius-sm, 4px)",
                background: selected
                  ? "var(--g3t-bg-tertiary, #eceff3)"
                  : "var(--g3t-bg-primary, #ffffff)",
                font: "inherit",
                color: "inherit",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: "0 0 auto",
                  fontSize: "var(--g3t-font-xs, 10px)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: tint,
                  minWidth: 58,
                }}
              >
                {hop.absence ? "absence" : hop.tier}
              </span>
              <span style={{ flex: "1 1 auto" }}>
                <span
                  style={{
                    color: "var(--g3t-text-primary, #16202c)",
                    fontWeight: hop.leaf ? 600 : 400,
                  }}
                >
                  {hop.label}
                </span>
                {hop.detail ? (
                  <span
                    style={{
                      color: "var(--g3t-text-muted, #8a97a6)",
                      marginLeft: "var(--g3t-space-2, 8px)",
                    }}
                  >
                    {hop.detail}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
