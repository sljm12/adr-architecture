/** Small, framework-independent session history for immutable domain snapshots. */
export class BoundedHistory<T> {
  private entries: T[] = [];
  private cursor = -1;
  constructor(private readonly limit = 100) {}
  reset(value: T): T { this.entries = [value]; this.cursor = 0; return value; }
  push(value: T): T { this.entries = [...this.entries.slice(0, this.cursor + 1), value].slice(-this.limit); this.cursor = this.entries.length - 1; return value; }
  undo(): T | undefined { return this.cursor <= 0 ? undefined : this.entries[--this.cursor]; }
  redo(): T | undefined { return this.cursor >= this.entries.length - 1 ? undefined : this.entries[++this.cursor]; }
  get canUndo(): boolean { return this.cursor > 0; }
  get canRedo(): boolean { return this.cursor >= 0 && this.cursor < this.entries.length - 1; }
}
