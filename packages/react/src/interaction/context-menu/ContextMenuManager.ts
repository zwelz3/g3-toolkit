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
    // Materialize per-target labels so the renderer stays label-dumb.
    const finalize = (item: MenuItem): MenuItem =>
      item.dynamicLabel ? { ...item, label: item.dynamicLabel(target) } : item;

    // Built-in items first
    for (const item of this.builtinItems) {
      if (!item.filter || item.filter(target)) {
        result.push(finalize(item));
      }
    }

    // Plugin items, grouped by pluginId
    for (const [, items] of this.pluginRegistrations) {
      const filtered = items
        .filter((item) => !item.filter || item.filter(target))
        .map(finalize);
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
 * Create a ContextMenuManager with the toolkit's BASE items (R2.1).
 *
 * Contract: base items are either functional or absent; a menu entry
 * that renders and does nothing reads as a broken application (2026
 * demo audit finding: every menuManager-less canvas showed two dead
 * items).
 *
 * - "Copy ID" / "Copy IRI": ALWAYS present and wired by default to
 *   the clipboard. The label follows the element id: ids carrying a
 *   scheme (http://, urn:, mailto:) read "Copy IRI" (the RDF case),
 *   everything else "Copy ID" (the LPG case); override with idLabel.
 *   Pass onCopy to replace the clipboard behavior entirely.
 * - "Inspect properties": present ONLY when onInspect is provided;
 *   the canvas cannot conjure a detail surface into the host layout,
 *   so an unwired Inspect is omitted rather than rendered dead.
 */
export interface DefaultMenuOptions {
  /** Wire "Inspect properties"; omitted from the menu when absent. */
  onInspect?: (target: MenuTarget) => void;
  /** Replace the default clipboard copy. */
  onCopy?: (target: MenuTarget) => void;
  /** Force the copy label; "auto" (default) inspects the id shape. */
  idLabel?: "auto" | "id" | "iri";
}

const IRI_LIKE = /^(https?|urn|mailto|ftp|doi):/i;

function copyLabel(target: MenuTarget, mode: "auto" | "id" | "iri"): string {
  if (mode === "iri") return "Copy IRI";
  if (mode === "id") return "Copy ID";
  return target.id !== undefined &&
    (IRI_LIKE.test(target.id) || target.id.includes("://"))
    ? "Copy IRI"
    : "Copy ID";
}

function defaultCopy(target: MenuTarget): void {
  if (target.id === undefined) return;
  // Clipboard requires a secure context; fall back silently (the menu
  // item still closed the menu, and there is nothing useful to do).
  void navigator.clipboard?.writeText(target.id).catch(() => undefined);
}

export function createDefaultMenuManager(
  options: DefaultMenuOptions = {},
): ContextMenuManager {
  const manager = new ContextMenuManager();
  const idLabel = options.idLabel ?? "auto";

  const items: MenuItem[] = [
    {
      id: "copy-id",
      label: "Copy ID", // resolved per-target below
      dynamicLabel: (target: MenuTarget) => copyLabel(target, idLabel),
      icon: "\ud83d\udccb",
      action: (target) => {
        if (options.onCopy) options.onCopy(target);
        else defaultCopy(target);
      },
      filter: (target) => target.type !== "background",
    },
  ];

  if (options.onInspect) {
    const onInspect = options.onInspect;
    items.unshift({
      id: "inspect-properties",
      label: "Inspect properties",
      icon: "\ud83d\udd0d",
      action: (target) => onInspect(target),
      filter: (target) => target.type !== "background",
    });
  }

  manager.addBuiltinItems(items);
  return manager;
}
