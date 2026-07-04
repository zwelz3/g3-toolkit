/**
 * Icon (B1, design-system roadmap).
 *
 * Renders a registry icon at a token-friendly size with a strict
 * accessibility contract:
 *   - with `label`: role="img" + aria-label (standalone icon, e.g. an
 *     icon-only button's content);
 *   - without `label`: aria-hidden (decorative; adjacent text carries
 *     the meaning, e.g. a sort arrow beside a column header).
 * The Unicode glyphs this replaces were at least read by screen
 * readers (often badly); the SVGs must be deliberate about it.
 */

import { getIcon } from "./registry";

export interface IconProps {
  /** Semantic registry name (e.g. "chevron-down", "check"). */
  name: string;
  /** Square size in px. Default 16 (the toolkit's working size). */
  size?: number;
  /** Accessible name. Omit when adjacent text already labels it. */
  label?: string;
  className?: string;
  /** Stroke width override; the set is drawn at 1.75. */
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 16,
  label,
  className,
  strokeWidth = 1.75,
}: IconProps) {
  const renderer = getIcon(name);
  if (!renderer) {
    // Unregistered names render nothing rather than a broken box, but
    // are loud in development: a missing icon is a build-time mistake.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`g3t Icon: no icon registered for "${name}"`);
    }
    return null;
  }

  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);

  if (renderer.kind === "component") {
    const Custom = renderer.Component;
    return (
      <Custom
        width={size}
        height={size}
        className={className}
        data-testid={`g3t-icon-${name}`}
        {...a11y}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-testid={`g3t-icon-${name}`}
      {...a11y}
      // Registry markup is first-party path data (or the adopter's
      // own), not user input; this is the standard mechanism for
      // string-defined SVG content.
      dangerouslySetInnerHTML={{ __html: renderer.markup }}
    />
  );
}
