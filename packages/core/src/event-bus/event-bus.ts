/**
 * Event bus: framework-agnostic pub/sub for toolkit events (M10.5.E3.T2).
 *
 * Allows adopters to observe toolkit state changes without depending
 * on Zustand. The selection store, theme store, and other internal
 * stores emit to this bus.
 *
 * Framework-agnostic (D6).
 */

// ── Event Types ─────────────────────────────────────────────────────

export interface G3tEvents {
  "node:selected": { nodeIds: string[] };
  "node:deselected": { nodeIds: string[] };
  "edge:selected": { edgeIds: string[] };
  "selection:cleared": Record<string, never>;
  "node:hovered": { nodeId: string | null };
  "node:doubleClicked": { nodeId: string };
  "node:rightClicked": { nodeId: string; x: number; y: number };
  "filter:changed": { visibleNodeIds: string[] | null };
  "theme:changed": { themeId: string };
  "layout:changed": { layoutId: string };
  "query:executed": { query: string; nodeCount: number };
  "encoding:changed": { property: string; channel: string };
  "ugm:changed": { nodeCount: number; edgeCount: number };
  // Context menu action events (M12/M13)
  "context:viewNeighbors": { nodeId: string; hops: number };
  "context:viewSubgraph": { nodeIds: string[] };
  "context:findPath": { sourceId: string; targetId: string };
  "context:editAppearance": { nodeId: string };
  "context:pinNodes": { nodeIds: string[] };
  "context:hideNodes": { nodeIds: string[] };
  "context:focusNode": { nodeId: string; hops: number };
}

export type G3tEventName = keyof G3tEvents;

type EventHandler<T> = (data: T) => void;

// ── Event Bus ───────────────────────────────────────────────────────

// Groundwork for R6.2 multi-source federation (not yet implemented):
// the bus carries cross-adapter events, but federation and entity
// resolution do not exist; tracked as proposed in specs/06.
export class G3tEventBus {
  private readonly handlers = new Map<string, Set<EventHandler<unknown>>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends G3tEventName>(
    event: K,
    handler: EventHandler<G3tEvents[K]>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    set.add(handler as EventHandler<unknown>);

    return () => {
      set.delete(handler as EventHandler<unknown>);
      if (set.size === 0) this.handlers.delete(event);
    };
  }

  /**
   * Subscribe to an event for a single firing.
   */
  once<K extends G3tEventName>(
    event: K,
    handler: EventHandler<G3tEvents[K]>,
  ): () => void {
    const unsub = this.on(event, (data) => {
      unsub();
      handler(data);
    });
    return unsub;
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<K extends G3tEventName>(event: K, data: G3tEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[g3t] Event handler error for "${event}":`, err);
      }
    }
  }

  /**
   * Remove all handlers for an event (or all events).
   */
  off(event?: G3tEventName): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Number of active subscriptions (for debugging).
   */
  get listenerCount(): number {
    let count = 0;
    for (const set of this.handlers.values()) {
      count += set.size;
    }
    return count;
  }
}

/**
 * Singleton event bus instance.
 * Adopters can import this or create their own via `new G3tEventBus()`.
 */
export const eventBus = new G3tEventBus();
