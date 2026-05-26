/**
 * Context menu type definitions.
 *
 * The types and manager logic are framework-agnostic (D6).
 * The React component that renders the menu lives separately.
 *
 * @see specs/02-functional-interaction.md R2.1, R2.2, R2.3
 * @see specs/09-design-decisions.md D3
 */

/** The kind of element that was right-clicked. */
export type MenuTargetType = "node" | "edge" | "background";

/** Context about the right-click target. */
export interface MenuTarget {
  type: MenuTargetType;
  /** Element ID (undefined for background clicks). */
  id?: string;
  /** Screen coordinates of the click. */
  position: { x: number; y: number };
  /** Arbitrary data the target element carries (node/edge attributes). */
  data?: Record<string, unknown>;
}

/** A single menu item. */
export interface MenuItem {
  /** Unique identifier for this item. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional icon (CSS class or emoji). */
  icon?: string;
  /** Action to invoke when clicked. */
  action: (target: MenuTarget) => void;
  /**
   * Optional filter: if provided, the item only appears when
   * filter returns true for the current target.
   */
  filter?: (target: MenuTarget) => boolean;
  /** Optional submenu items. */
  submenu?: MenuItem[];
  /** If true, show a separator line before this item. */
  separator?: boolean;
}

/** Registration record for plugin-contributed menu items. */
export interface MenuRegistration {
  pluginId: string;
  items: MenuItem[];
}
