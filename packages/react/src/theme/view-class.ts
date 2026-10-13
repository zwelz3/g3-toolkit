/**
 * The shared view root class (issue #45).
 *
 * Issue #24 scoped the toolkit typography to `g3t-` classes so that
 * `style.css` never restyles the host page. That left a gap: the
 * chrome atoms carry `g3t-*` classes, but many views render an
 * unclassed, inline-styled root (the canvas wrapper, the inspectors,
 * the encoding panel, the tree and schema views), and a root with no
 * class inherits the HOST font, size and ink when the host imports
 * only `style.css`. So every exported view and panel root composes
 * `g3t-view` into its class list, and `g3t-base.css` carries the
 * toolkit face, size, line-height and ink on `.g3t-view` (children
 * inherit; inline sizes on children still win). The host's own
 * `className` stays first so selectors on it keep working, and the
 * toolkit's own root class (`g3t-table`, `g3t-minimap`) stays ahead
 * of this one for the same reason.
 */

/** The class every view root carries; style the toolkit's text through it. */
export const VIEW_CLASS = "g3t-view";

/**
 * Compose a view root's class list: the given classes, in order, with
 * `g3t-view` appended. Falsy parts are dropped so an absent `className`
 * prop yields `"g3t-view"` alone.
 */
export function viewClass(
  ...parts: ReadonlyArray<string | false | null | undefined>
): string {
  const kept: string[] = [];
  for (const p of parts) {
    if (typeof p === "string" && p.trim() !== "" && p !== VIEW_CLASS) {
      kept.push(p.trim());
    }
  }
  kept.push(VIEW_CLASS);
  return kept.join(" ");
}
