/**
 * ContextMenuManager: manages registered menu items and resolves
 * which items to show for a given right-click target.
 *
 * Framework-agnostic (D6). The React menu component consumes
 * the resolved item list from this manager.
 *
 * @see specs/02-functional-interaction.md R2.1, R2.3
 * @see specs/09-design-decisions.md D3
 */

import type { MenuItem, MenuTarget } from "./types";

export class ContextMenuManager {
  /** Built-in items (always present unless filtered). */
  private readonly builtinItems: MenuItem[] = [];

  /** Plugin-registered items, keyed by pluginId. */
  private readonly pluginRegistrations = new Map<string, MenuItem[]>();

  /** Register built-in menu items (called once at init). */
  addBuiltinItems(items: MenuItem[]): void {
    this.builtinItems.push(...items);
  }

  /**
   * Register plugin-contributed menu items (R2.3, C42).
   * Items appear in a "Plugins" group in the menu.
   * Call with the same pluginId to replace previous registration.
   */
  register(pluginId: string, items: MenuItem[]): void {
    this.pluginRegistrations.set(pluginId, items);
  }

  /** Unregister a plugin's menu items. */
  unregister(pluginId: string): void {
    this.pluginRegistrations.delete(pluginId);
  }

  /**
   * Resolve which menu items to show for the given target.
   * Applies each item's filter function; items whose filter
   * returns false are excluded.
   */
  resolve(target: MenuTarget): MenuItem[] {
    const result: MenuItem[] = [];

    // Built-in items first
    for (const item of this.builtinItems) {
      if (!item.filter || item.filter(target)) {
        result.push(item);
      }
    }

    // Plugin items, grouped by pluginId
    for (const [, items] of this.pluginRegistrations) {
      const filtered = items.filter(
        (item) => !item.filter || item.filter(target),
      );
      if (filtered.length > 0) {
        // Add separator before plugin group
        const first = filtered[0];
        if (result.length > 0 && first) {
          filtered[0] = { ...first, separator: true };
        }
        result.push(...filtered);
      }
    }

    return result;
  }

  /** Get all registered plugin IDs. */
  getRegisteredPlugins(): string[] {
    return [...this.pluginRegistrations.keys()];
  }
}

/**
 * Create a ContextMenuManager with the default built-in items
 * for the g3-toolkit (R2.1).
 *
 * Default items:
 * - "Inspect properties" (nodes and edges)
 * - "Copy IRI" (nodes and edges)
 */
export function createDefaultMenuManager(
  callbacks: {
    onInspect?: (target: MenuTarget) => void;
    onCopyIRI?: (target: MenuTarget) => void;
  } = {},
): ContextMenuManager {
  const manager = new ContextMenuManager();

  manager.addBuiltinItems([
    {
      id: "inspect-properties",
      label: "Inspect properties",
      icon: "🔍",
      action: (target) => callbacks.onInspect?.(target),
      filter: (target) => target.type !== "background",
    },
    {
      id: "copy-iri",
      label: "Copy IRI",
      icon: "📋",
      action: (target) => {
        if (target.id) {
          callbacks.onCopyIRI?.(target);
        }
      },
      filter: (target) => target.type !== "background",
    },
  ]);

  return manager;
}
