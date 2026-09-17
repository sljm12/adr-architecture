import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDocument, DiagramSummary } from '../../shared/src/index';
import { diagramClient } from '../src/api/diagram-client';
import { DiagramApiError } from '../src/api/diagram-client';
import { useDiagramStore } from '../src/state/diagram-store';

const first: DiagramDocument = { id: '00000000-0000-0000-0000-000000000101', name: 'First', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [], groups: [] };
const second: DiagramDocument = { ...first, id: '00000000-0000-0000-0000-000000000102', name: 'Second', updatedAt: '2026-01-02T00:00:00.000Z' };
const summary: DiagramSummary = { id: second.id, name: second.name, status: 'active', createdAt: second.createdAt, updatedAt: second.updatedAt };

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

  it('keeps the original creation date when a saved document summary is replaced', async () => {
    vi.spyOn(diagramClient, 'save').mockResolvedValue({ ...first, name: 'Renamed', updatedAt: '2026-01-03T00:00:00.000Z' });
    useDiagramStore.getState().open(first);
    useDiagramStore.getState().update(document => ({ ...document, name: 'Renamed' }));
    await useDiagramStore.getState().save();
    expect(useDiagramStore.getState().savedDocuments).toContainEqual(expect.objectContaining({ id: first.id, name: 'Renamed', createdAt: first.createdAt }));
  });

  it('removes only the confirmed UUID after successful trashing and keeps duplicate names independent', async () => {
    vi.spyOn(diagramClient, 'trash').mockResolvedValue();
    const duplicate = { ...summary, id: '00000000-0000-0000-0000-000000000103', name: first.name };
    useDiagramStore.setState({ savedDocuments: [summary, duplicate], savedDocumentsStatus: 'loaded', savedDocumentsDeleteStatus: 'idle', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: null, deletedSavedDocumentIds: [] });

    await expect(useDiagramStore.getState().trashSavedDocument(summary.id)).resolves.toBe(true);
    expect(diagramClient.trash).toHaveBeenCalledWith(summary.id);
    expect(useDiagramStore.getState().savedDocuments.map(item => item.id)).toEqual([duplicate.id]);
    expect(useDiagramStore.getState().savedDocumentsDeleteStatus).toBe('succeeded');
  });

  it('retains the target summary and reports an actionable failure when trashing fails', async () => {
    vi.spyOn(diagramClient, 'trash').mockRejectedValue(new DiagramApiError('Diagram is unavailable.', 404));
    useDiagramStore.setState({ savedDocuments: [summary], savedDocumentsStatus: 'loaded', savedDocumentsDeleteStatus: 'idle', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: null, deletedSavedDocumentIds: [] });

    await expect(useDiagramStore.getState().trashSavedDocument(summary.id)).resolves.toBe(false);
    expect(useDiagramStore.getState().savedDocuments).toEqual([summary]);
    expect(useDiagramStore.getState().savedDocumentsDeleteStatus).toBe('failed');
    expect(useDiagramStore.getState().savedDocumentsDeleteError).toBe('Diagram is unavailable.');
  });

  it('handles a target that has disappeared without calling the delete endpoint', async () => {
    const trash = vi.spyOn(diagramClient, 'trash');
    useDiagramStore.setState({ savedDocuments: [], savedDocumentsStatus: 'loaded', savedDocumentsDeleteStatus: 'idle', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: null, deletedSavedDocumentIds: [] });

    await expect(useDiagramStore.getState().trashSavedDocument(summary.id)).resolves.toBe(false);
    expect(trash).not.toHaveBeenCalled();
    expect(useDiagramStore.getState().savedDocumentsDeleteError).toContain('no longer available');
  });

  it('does not re-add a successfully trashed UUID when a refresh races with deletion', async () => {
    vi.spyOn(diagramClient, 'trash').mockResolvedValue();
    vi.spyOn(diagramClient, 'list').mockResolvedValue([summary]);
    useDiagramStore.setState({ savedDocuments: [summary], savedDocumentsStatus: 'loaded', savedDocumentsDeleteStatus: 'idle', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: null, deletedSavedDocumentIds: [] });

    await useDiagramStore.getState().trashSavedDocument(summary.id);
    await useDiagramStore.getState().refreshSavedDocuments();
    expect(useDiagramStore.getState().savedDocuments).toEqual([]);
  });

  it('registers restored documents with their original creation date', () => {
    useDiagramStore.setState({ savedDocuments: [], deletedSavedDocumentIds: [first.id], savedDocumentsDeleteStatus: 'succeeded', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: 'Diagram moved to recoverable trash.' });

    useDiagramStore.getState().registerRestoredSavedDocument(first);
    expect(useDiagramStore.getState().savedDocuments).toEqual([expect.objectContaining({ id: first.id, createdAt: first.createdAt })]);
    expect(useDiagramStore.getState().deletedSavedDocumentIds).toEqual([]);
  });
});
