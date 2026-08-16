/**
 * Context-action bus: framework-agnostic pub/sub carrying menu intents
 * from the action registry to whatever executes them (M10.5.E3.T2).
 *
 * NOT A FOURTH INTEGRATION CHANNEL. Ruled 2026-08-15. The three
 * channels in ARCHITECTURE.md stay as they are: exported stores, props and
 * callbacks, versioned JSON documents. State OBSERVATION belongs to
 * the store channel, which already exposes every state type and is
 * what a host should subscribe to for selection, theme, filter or
 * layout changes.
 *
 * What this bus does is narrower and real: `registerToolkitActions`
 * emits a `context:*` intent when a menu item fires, and
 * `wireCytoscapeContextActions` (or a host's own handler) executes it.
 * The toolkit cannot execute those itself without deciding a host's
 * navigation, panel and styling behavior, so the intent is published
 * and the host rules on it. Every event below has at least one
 * emitter and at least one consumer in the tree.
 *
 * THIRTEEN EVENT TYPES WERE REMOVED HERE, also 2026-08-15:
 * node:selected, node:deselected, edge:selected, selection:cleared,
 * node:hovered, node:doubleClicked, node:rightClicked, filter:changed,
 * theme:changed, layout:changed, query:executed, encoding:changed,
 * ugm:changed. Nothing in the tree ever emitted any of them. The
 * header on this file used to claim "the selection store, theme store,
 * and other internal stores emit to this bus", and no store ever did:
 * a host subscribing to `node:selected` waited forever and had no way
 * to tell that from a graph where nothing was selected. Their absence
 * is the honest state. Adding one back means wiring an emitter in the
 * same commit; a declared event with no emitter is a promise the
 * library cannot keep.
 *
 * Framework-agnostic (D6).
 */

// ── Event Types ─────────────────────────────────────────────────────

/**
 * Context-menu intents. Payloads are the minimum a handler needs to
 * act; a handler that needs more reads it from the UGM it already
 * holds.
 */
export interface G3tEvents {
  "context:viewNeighbors": { nodeId: string; hops: number };
  /** Review 4.11: a host wires this to an inspector panel. */
  "context:inspect": { nodeId: string };
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
 * Shared bus instance.
 *
 * @deprecated Construct your own with `new G3tEventBus()` and pass it
 * to `registerToolkitActions` and `wireCytoscapeContextActions`. Both
 * take the bus as a parameter and neither reaches for this singleton;
 * the wiring guide's example builds its own. Warning-first per
 * RELEASE.md: this stays through 1.x and is a candidate for removal at
 * the next major.
 *
 * THE HAZARD. A module-level instance is only a singleton within one
 * module instance. Two copies of `@g3t/core` in a dependency tree, or
 * one host reaching it through `import` while another path reaches it
 * through `require`, produce two buses. The emitter holds one and the
 * subscriber holds the other, so menu items go dead with no error and
 * nothing in a stack trace to point at. This is the same shape as the
 * store-identity hazard, and it is why the toolkit's own APIs take the
 * bus explicitly rather than importing it: an instance you passed in
 * is an instance you can be sure of.
 */
export const eventBus = new G3tEventBus();
