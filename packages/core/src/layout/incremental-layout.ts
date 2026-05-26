/**
 * F2: Adaptive/incremental layout.
 *
 * When nodes are added or removed, existing nodes move only
 * as much as necessary. Avoids full relayout disorientation.
 *
 * Framework-agnostic (D6).
 */

export interface Position {
  x: number;
  y: number;
}

export interface IncrementalLayoutOptions {
  /** Animation duration in ms. Default 400. */
  animationDuration?: number;
  /** Lock nodes beyond this distance from changed nodes. Default: Infinity (lock all). */
  lockRadius?: number;
}

/**
 * Compute an incremental layout update.
 *
 * @param previousPositions - Map of nodeId → position from the last layout
 * @param currentIds - Set of node IDs in the current graph
 * @param previousIds - Set of node IDs in the previous graph
 * @returns Instructions for the layout engine
 */
export function computeIncrementalUpdate(
  previousPositions: Map<string, Position>,
  currentIds: Set<string>,
  previousIds: Set<string>,
): {
  mode: "full" | "incremental" | "none";
  addedIds: string[];
  removedIds: string[];
  lockedIds: string[];
  reason: string;
} {
  const added = [...currentIds].filter((id) => !previousIds.has(id));
  const removed = [...previousIds].filter((id) => !currentIds.has(id));

  // No change
  if (added.length === 0 && removed.length === 0) {
    return {
      mode: "none",
      addedIds: [],
      removedIds: [],
      lockedIds: [],
      reason: "No changes detected",
    };
  }

  // Small change (< 30% of graph): incremental layout
  const changeRatio =
    (added.length + removed.length) / Math.max(currentIds.size, 1);
  if (changeRatio < 0.4) {
    const lockedIds = [...currentIds].filter(
      (id) => !added.includes(id) && previousPositions.has(id),
    );
    return {
      mode: "incremental",
      addedIds: added,
      removedIds: removed,
      lockedIds,
      reason: `Small change (${(changeRatio * 100).toFixed(0)}%): lock ${lockedIds.length} existing nodes`,
    };
  }

  // Large change: full relayout
  return {
    mode: "full",
    addedIds: added,
    removedIds: removed,
    lockedIds: [],
    reason: `Large change (${(changeRatio * 100).toFixed(0)}%): full relayout`,
  };
}

/**
 * Apply incremental layout to a Cytoscape instance.
 *
 * Locks existing nodes in place, runs layout only on new nodes,
 * then unlocks all.
 */
export function applyIncrementalLayout(
  cy: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  update: ReturnType<typeof computeIncrementalUpdate>,
  options?: IncrementalLayoutOptions,
): void {
  const duration = options?.animationDuration ?? 400;

  if (update.mode === "none") return;

  if (update.mode === "full") {
    cy.layout({
      name: cy.options().layout?.name ?? "cose",
      animate: true,
      animationDuration: duration,
    }).run();
    return;
  }

  // Incremental: lock existing, layout new, unlock
  for (const id of update.lockedIds) {
    const node = cy.getElementById(id);
    if (node.length > 0) node.lock();
  }

  // Position new nodes near the center of the graph
  const bb = cy.extent();
  const centerX = (bb.x1 + bb.x2) / 2;
  const centerY = (bb.y1 + bb.y2) / 2;

  for (const id of update.addedIds) {
    const node = cy.getElementById(id);
    if (node.length > 0) {
      node.position({
        x: centerX + (Math.random() - 0.5) * 100,
        y: centerY + (Math.random() - 0.5) * 100,
      });
    }
  }

  // Run layout (only affects unlocked nodes)
  cy.layout({
    name: cy.options().layout?.name ?? "cose",
    animate: true,
    animationDuration: duration,
    fit: false, // don't re-fit; keep viewport stable
  }).run();

  // Unlock after animation completes
  setTimeout(() => {
    for (const id of update.lockedIds) {
      const node = cy.getElementById(id);
      if (node.length > 0) node.unlock();
    }
  }, duration + 50);
}

/**
 * Capture current positions from Cytoscape for next comparison.
 */
export function capturePositions(
  cy: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Map<string, Position> {
  const positions = new Map<string, Position>();
  cy.nodes().forEach((node: any) => {
    const pos = node.position();
    positions.set(node.id(), { x: pos.x, y: pos.y });
  });
  return positions;
}

// ── Class wrapper (P3.1) ────────────────────────────────────────────

/**
 * Stateful incremental layout manager (P3.1).
 *
 * Holds the previous node positions and ID set so callers can apply
 * incremental updates each time the graph changes without manually
 * tracking the previous state. Internally delegates to the three
 * functions above.
 *
 * @example
 *   const layout = new IncrementalLayout({ animationDuration: 300 });
 *   layout.captureFrom(cy);
 *   // ... graph mutates ...
 *   layout.apply(cy, newNodeIds);
 */
export class IncrementalLayout {
  private positions: Map<string, Position> = new Map();
  private previousIds: Set<string> = new Set();

  constructor(public options: IncrementalLayoutOptions = {}) {}

  /** Snapshot the current positions and node-ID set from a Cytoscape instance. */
  captureFrom(cy: any /* eslint-disable-line @typescript-eslint/no-explicit-any */): void {
    this.positions = capturePositions(cy);
    this.previousIds = new Set(this.positions.keys());
  }

  /**
   * Compute the diff against the captured snapshot and apply it to the
   * given Cytoscape instance. After this returns the captured state is
   * NOT updated — call `captureFrom(cy)` again before the next call.
   */
  apply(cy: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, currentIds: Set<string>): void {
    const update = computeIncrementalUpdate(
      this.positions,
      currentIds,
      this.previousIds,
    );
    applyIncrementalLayout(cy, update, this.options);
  }
}
