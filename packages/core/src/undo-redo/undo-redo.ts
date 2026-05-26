/**
 * Undo/redo stack for graph operations (M7.E0.T3, R2.14).
 *
 * Records UGM snapshots on each mutating operation. Ctrl+Z undoes;
 * Ctrl+Shift+Z redoes. Configurable stack depth.
 *
 * Framework-agnostic (D6).
 */

import { UGM, type SerializedUGM } from "../ugm";

export interface UndoRedoOptions {
  /** Maximum number of undo steps (default 50). */
  maxDepth?: number;
}

export class UndoRedoStack {
  private undoStack: SerializedUGM[] = [];
  private redoStack: SerializedUGM[] = [];
  private readonly maxDepth: number;

  constructor(options?: UndoRedoOptions) {
    this.maxDepth = options?.maxDepth ?? 50;
  }

  /** Record the current UGM state before a mutation. */
  push(ugm: UGM): void {
    this.undoStack.push(ugm.toJSON());
    // Trim to max depth
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // New action clears redo stack
    this.redoStack = [];
  }

  /** Undo: restore the previous state. Returns the restored UGM or null. */
  undo(currentUgm: UGM): UGM | null {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return null;

    // Save current state to redo stack
    this.redoStack.push(currentUgm.toJSON());

    return UGM.fromJSON(snapshot);
  }

  /** Redo: restore the next state. Returns the restored UGM or null. */
  redo(currentUgm: UGM): UGM | null {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return null;

    // Save current state to undo stack
    this.undoStack.push(currentUgm.toJSON());

    return UGM.fromJSON(snapshot);
  }

  /** Check if undo is available. */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Check if redo is available. */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Number of undo steps available. */
  get undoCount(): number {
    return this.undoStack.length;
  }

  /** Number of redo steps available. */
  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Clear both stacks. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
