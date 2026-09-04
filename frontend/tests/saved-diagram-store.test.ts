import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDocument, DiagramSummary } from '../../shared/src/index';
import { diagramClient } from '../src/api/diagram-client';
import { useDiagramStore } from '../src/state/diagram-store';

const first: DiagramDocument = { id: '00000000-0000-0000-0000-000000000101', name: 'First', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [] };
const second: DiagramDocument = { ...first, id: '00000000-0000-0000-0000-000000000102', name: 'Second', updatedAt: '2026-01-02T00:00:00.000Z' };
const summary: DiagramSummary = { id: second.id, name: second.name, status: 'active', updatedAt: second.updatedAt };

afterEach(() => { vi.restoreAllMocks(); useDiagramStore.getState().open(structuredClone(first)); });

describe('saved-document state', () => {
  it('loads typed summaries and replaces the active document only after a successful load', async () => {
    vi.spyOn(diagramClient, 'list').mockResolvedValue([summary]);
    vi.spyOn(diagramClient, 'get').mockResolvedValue(second);
    useDiagramStore.getState().open(first);

    await useDiagramStore.getState().refreshSavedDocuments();
    expect(useDiagramStore.getState().savedDocuments).toEqual([summary]);
    await expect(useDiagramStore.getState().loadSavedDocument(second.id)).resolves.toBe(true);
    expect(useDiagramStore.getState()).toMatchObject({ document: expect.objectContaining({ id: second.id }), status: 'saved', canUndo: false, canRedo: false });
  });

  it('retains the active document and history when loading fails', async () => {
    vi.spyOn(diagramClient, 'get').mockRejectedValue(new Error('Document is unavailable.'));
    useDiagramStore.getState().open(first);
    useDiagramStore.getState().update(document => ({ ...document, name: 'Unsaved first' }));

    await expect(useDiagramStore.getState().loadSavedDocument(second.id)).resolves.toBe(false);
    expect(useDiagramStore.getState()).toMatchObject({ document: expect.objectContaining({ id: first.id, name: 'Unsaved first' }), status: 'unsaved', loadError: 'Document is unavailable.' });
  });
});
