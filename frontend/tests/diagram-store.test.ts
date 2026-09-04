import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDocument } from '../../shared/src/index';
import { diagramClient } from '../src/api/diagram-client';
import { useDiagramStore } from '../src/state/diagram-store';

const document: DiagramDocument = {
  id: '00000000-0000-0000-0000-000000000001', name: 'System', status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [], relationships: [],
};

const reset = () => useDiagramStore.getState().open(structuredClone(document));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  reset();
});

describe('explicit diagram saving', () => {
  it('keeps edits, undo, and redo local until the user saves', async () => {
    vi.useFakeTimers();
    const save = vi.spyOn(diagramClient, 'save').mockResolvedValue(structuredClone(document));
    reset();

    useDiagramStore.getState().update(current => ({ ...current, name: 'Edited system' }));
    expect(useDiagramStore.getState().status).toBe('unsaved');
    vi.advanceTimersByTime(1_000);
    expect(save).not.toHaveBeenCalled();

    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().status).toBe('unsaved');
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().status).toBe('unsaved');

    await useDiagramStore.getState().save();
    expect(save).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().status).toBe('saved');
  });

  it('keeps a newer local edit unsaved when an earlier save finishes', async () => {
    let resolveSave: ((value: DiagramDocument) => void) | undefined;
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => {
      resolveSave = resolve;
    }));
    reset();
    useDiagramStore.getState().update(current => ({ ...current, name: 'First edit' }));
    const pendingSave = useDiagramStore.getState().save();
    useDiagramStore.getState().update(current => ({ ...current, name: 'Newer edit' }));

    resolveSave?.({ ...document, name: 'First edit' });
    await pendingSave;

    expect(useDiagramStore.getState().document?.name).toBe('Newer edit');
    expect(useDiagramStore.getState().status).toBe('unsaved');
  });

  it('retains a failed draft and allows an explicit retry', async () => {
    const save = vi.spyOn(diagramClient, 'save')
      .mockRejectedValueOnce(new Error('Temporary save failure.'))
      .mockResolvedValueOnce({ ...document, name: 'Edited system' });
    reset();
    useDiagramStore.getState().update(current => ({ ...current, name: 'Edited system' }));

    await useDiagramStore.getState().save();
    expect(useDiagramStore.getState()).toMatchObject({ status: 'failed', error: 'Temporary save failure.' });
    expect(useDiagramStore.getState().document?.name).toBe('Edited system');

    await useDiagramStore.getState().save();
    expect(save).toHaveBeenCalledTimes(2);
    expect(useDiagramStore.getState().status).toBe('saved');
  });
});
