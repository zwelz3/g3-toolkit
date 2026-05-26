/**
 * TypeMenuProvider: context-sensitive right-click menus (M12.E3.T2).
 *
 * Different menu items based on node type. Adopters register
 * type-specific menu items via the provider interface.
 *
 * Framework-agnostic (D6).
 */

// ── Types ───────────────────────────────────────────────────────────

export interface TypeMenuItem {
  id: string;
  label: string;
  /** Node types this item applies to. Empty = all types. */
  applicableTypes: string[];
  execute: (nodeId: string, nodeType: string) => void;
}

export class TypeMenuProvider {
  private readonly items: TypeMenuItem[] = [];

  /**
   * Register a type-specific menu item.
   */
  register(item: TypeMenuItem): void {
    this.items.push(item);
  }

  /**
   * Get menu items applicable to a specific node type.
   */
  getItemsForType(nodeType: string): TypeMenuItem[] {
    return this.items.filter(
      (item) =>
        item.applicableTypes.length === 0 ||
        item.applicableTypes.includes(nodeType),
    );
  }

  /**
   * Get all registered items.
   */
  getAll(): ReadonlyArray<TypeMenuItem> {
    return this.items;
  }
}

/**
 * Create a TypeMenuProvider with default items for common types.
 */
export function createDefaultTypeMenuProvider(): TypeMenuProvider {
  const provider = new TypeMenuProvider();

  provider.register({
    id: "show-timeline",
    label: "Show Timeline",
    applicableTypes: ["Person", "Event"],
    execute: () => {},
  });

  provider.register({
    id: "show-on-map",
    label: "Show on Map",
    applicableTypes: ["Location"],
    execute: () => {},
  });

  provider.register({
    id: "expand-neighborhood",
    label: "Expand Neighborhood",
    applicableTypes: [],
    execute: () => {},
  });

  provider.register({
    id: "find-paths",
    label: "Find Paths From Here",
    applicableTypes: [],
    execute: () => {},
  });

  return provider;
}
