import { describe, expect, it } from 'vitest';
import { BoundedHistory } from '../src/state/history';

describe('diagram history', () => {
  it('undoes, redoes, truncates redo after an edit, and resets when the diagram changes', () => {
    const history = new BoundedHistory<{ id: string; name: string; unrelated: string }>(3);
    history.reset({ id: 'one', name: 'Original', unrelated: 'kept' }); history.push({ id: 'one', name: 'Changed', unrelated: 'kept' });
    expect(history.undo()).toEqual({ id: 'one', name: 'Original', unrelated: 'kept' }); expect(history.redo()).toEqual({ id: 'one', name: 'Changed', unrelated: 'kept' });
    history.undo(); history.push({ id: 'one', name: 'Replacement', unrelated: 'kept' }); expect(history.redo()).toBeUndefined();
    history.reset({ id: 'two', name: 'Second', unrelated: 'also kept' }); expect(history.canUndo).toBe(false); expect(history.redo()).toBeUndefined();
  });
});
