/**
 * EmptyState / ErrorState (B2, design-system roadmap).
 *
 * One anatomy for the moments a view has nothing to show, replacing
 * eight per-view improvisations (hardcoded #888 text in matrix,
 * sankey, tree, diff and others). Copy contract, from the design
 * writing rules: say what this is, why it is empty, and the one
 * action that fills it. Errors say what went wrong and what to do;
 * they do not apologize and they are never vague.
 */

import type { ReactNode } from "react";
import { Icon } from "../../icons";

export interface EmptyStateProps {
  /** One line naming the situation ("No temporal data"). */
  title: string;
  /** Why it is empty and what fills it. */
  description?: string;
  /** Optional single action (a button or link element). */
  action?: ReactNode;
  /** Registry icon name; defaults chosen by variant. */
  icon?: string;
  /** "empty" (informational) or "error" (something failed). */
  variant?: "empty" | "error";
  /** Preserved per-view testid (existing tests reference these). */
  testId?: string;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = "empty",
  testId,
  className,
}: EmptyStateProps) {
  const glyph = icon ?? (variant === "error" ? "error" : "info");
  return (
    <div
      data-testid={testId}
      role={variant === "error" ? "alert" : undefined}
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--g3t-space-2, 8px)",
        padding: "var(--g3t-space-6, 24px)",
        textAlign: "center",
        color: "var(--g3t-text-muted, #888)",
      }}
    >
      <span
        style={{
          color:
            variant === "error"
              ? "var(--g3t-error, #ef4444)"
              : "var(--g3t-text-muted, #888)",
        }}
      >
        <Icon name={glyph} size={20} />
      </span>
      <div
        style={{
          fontWeight: 600,
          fontSize: "var(--g3t-font-md, 13px)",
          color: "var(--g3t-text-secondary, #666)",
        }}
      >
        {title}
      </div>
      {description ? (
        <div style={{ fontSize: "var(--g3t-font-sm, 12px)", maxWidth: 360 }}>
          {description}
        </div>
      ) : null}
      {action ?? null}
    </div>
  );
}
