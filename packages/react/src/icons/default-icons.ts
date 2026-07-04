/**
 * Default icon set (B1, design-system roadmap).
 *
 * 24 stroke-based glyphs on a 24x24 grid, 1.75 stroke, round caps and
 * joins, drawn for legibility at the toolkit's working sizes (14-16px).
 * Color is always `currentColor`; size comes from the consumer.
 * This set replaces the Unicode glyphs (▶ ▼ ✓ ✗ × ⏸) that rendered
 * platform-dependently and could not be themed or sized.
 *
 * Names are semantic (what it means), not pictorial (what it draws),
 * so a registry swap to a brand set keeps call sites meaningful.
 */

/** SVG path/element markup per icon, sans the outer <svg>. */
export const DEFAULT_ICON_PATHS: Record<string, string> = {
  // Disclosure and direction
  "chevron-right": '<path d="M9 5l7 7-7 7"/>',
  "chevron-down": '<path d="M5 9l7 7 7-7"/>',
  "chevron-up": '<path d="M5 15l7-7 7 7"/>',
  "chevron-left": '<path d="M15 5l-7 7 7 7"/>',
  "sort-asc": '<path d="M12 5v14M6 11l6-6 6 6"/>',
  "sort-desc": '<path d="M12 5v14M6 13l6 6 6-6"/>',

  // Status
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  warning:
    '<path d="M12 4L2.5 20h19L12 4z"/><path d="M12 10v5"/><circle cx="12" cy="17.6" r="0.4"/>',
  error:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.4" r="0.4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="0.4"/>',

  // Actions
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/>',
  pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 15v6"/>',
  play: '<path d="M7 4.5l13 7.5-13 7.5v-15z"/>',
  pause: '<path d="M7.5 5v14M16.5 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.03-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001.03-1.56V3a2 2 0 114 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9c.26.63.88 1.03 1.56 1.03H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51.97z"/>',
  refresh: '<path d="M20 12a8 8 0 11-2.34-5.66M20 4v5h-5"/>',

  // Structure
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 018 0V11"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  "external-link":
    '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h6"/>',
};

export type DefaultIconName = keyof typeof DEFAULT_ICON_PATHS;
