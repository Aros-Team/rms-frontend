/**
 * Bounded snapshot history.
 *
 * Snapshot-based history keeps every editor transition simple: a stroke, move,
 * delete or resize pushes one immutable layout and undo/redo swaps references.
 * It is deliberately framework-agnostic.
 */
export class EditorHistory<T> {
  private readonly undoStack: T[] = [];
  private readonly redoStack: T[] = [];

  /**
   * @param maxEntries maximum number of undo steps kept
   */
  constructor(private readonly maxEntries = 50) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Records the state before a change and invalidates redo. */
  push(snapshot: T): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /** Swaps the current state for the previous one. */
  undo(current: T): T | null {
    const previous = this.undoStack.pop();
    if (previous === undefined) return null;
    this.redoStack.push(current);
    return previous;
  }

  /** Reapplies the last undone state. */
  redo(current: T): T | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(current);
    return next;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
