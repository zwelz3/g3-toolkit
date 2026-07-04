/**
 * Skeleton (B2 completion, design-system roadmap).
 *
 * The loading half of the empty/loading/error pattern: a shimmer
 * placeholder for adapter-bound content. Shimmer is driven by the
 * motion tokens and disabled entirely under prefers-reduced-motion
 * (a static block; the rule lives in g3t-base.css with the other
 * motion handling).
 */

export interface SkeletonProps {
  /** "text" renders line bars; "block" a filled rectangle. */
  variant?: "text" | "block";
  /** Line count for the text variant. */
  lines?: number;
  /** Block height (block variant), e.g. 120 or "8rem". */
  height?: number | string;
  width?: number | string;
  className?: string;
}

export function Skeleton({
  variant = "text",
  lines = 3,
  height = 96,
  width = "100%",
  className,
}: SkeletonProps) {
  if (variant === "block") {
    return (
      <div
        data-testid="g3t-skeleton"
        aria-hidden="true"
        className={`g3t-skeleton ${className ?? ""}`}
        style={{ height, width }}
      />
    );
  }
  return (
    <div data-testid="g3t-skeleton" aria-hidden="true" className={className}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="g3t-skeleton"
          style={{
            height: "0.75em",
            width: i === lines - 1 ? "60%" : "100%",
            marginBottom: "0.5em",
          }}
        />
      ))}
    </div>
  );
}
