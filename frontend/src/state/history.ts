/** Small, framework-independent session history for immutable domain snapshots. */
export class BoundedHistory<T> {
  private entries: T[] = [];
  private cursor = -1;
  constructor(private readonly limit = 100) {}
  reset(value: T): T { this.entries = [value]; this.cursor = 0; return value; }
  push(value: T): T { this.entries = [...this.entries.slice(0, this.cursor + 1), value].slice(-this.limit); this.cursor = this.entries.length - 1; return value; }
  undo(): T | undefined { return this.cursor <= 0 ? undefined : this.entries[--this.cursor]; }
  redo(): T | undefined { return this.cursor >= this.entries.length - 1 ? undefined : this.entries[++this.cursor]; }
  peekUndo(): T | undefined { return this.canUndo ? this.entries[this.cursor - 1] : undefined; }
  peekRedo(): T | undefined { return this.canRedo ? this.entries[this.cursor + 1] : undefined; }
  /** Reconcile derived metadata without recording another authored edit. */
  map(transform: (value: T) => T): void { this.entries = this.entries.map(transform); }
  snapshot(): { entries: T[]; cursor: number } { return structuredClone({ entries: this.entries, cursor: this.cursor }); }
  restore(snapshot: { entries: T[]; cursor: number }): T { this.entries = structuredClone(snapshot.entries); this.cursor = snapshot.cursor; return this.entries[this.cursor]; }
  get canUndo(): boolean { return this.cursor > 0; }
  get canRedo(): boolean { return this.cursor >= 0 && this.cursor < this.entries.length - 1; }
}
