/**
 * Layout engine abstraction (M2.E1.T1).
 *
 * Defines a common interface for all layout algorithms. Each engine
 * takes a UGM and produces a position map. Pinned nodes are passed
 * as constraints; the engine must honor them.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/02-functional-interaction.md R2.9
 */

import type { UGM } from "../ugm";

/** 2D position for a node. */
export interface Position {
  x: number;
  y: number;
}

/** Options common to all layout engines. */
export interface LayoutOptions {
  /** Nodes whose positions are fixed. The engine must not move them. */
  pinned?: Map<string, Position>;
  /** Whether to animate the transition (engines may ignore if unsupported). */
  animate?: boolean;
}

/** Result of a layout computation. */
export type LayoutResult = Map<string, Position>;

/**
 * Interface that all layout engines implement.
 * Engines are stateless; each call to compute() is independent.
 */
export interface LayoutEngine {
  /** Human-readable name for the UI (e.g., "Force-Directed"). */
  readonly name: string;
  /** Short identifier (e.g., "force", "hierarchical", "dagre"). */
  readonly id: string;
  /**
   * Compute positions for all nodes in the UGM.
   * Pinned nodes must appear in the result at their pinned positions.
   */
  compute(ugm: UGM, options?: LayoutOptions): Promise<LayoutResult>;
}
