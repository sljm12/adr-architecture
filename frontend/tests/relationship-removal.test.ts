import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDiagramStore } from '../src/state/diagram-store';
import type { DiagramDocument } from '../../shared/src/index';
import { adrClient } from '../src/api/adr-client';

const document: DiagramDocument = { id: '00000000-0000-0000-0000-000000000001', name: 'System', status: 'active', createdAt: 'now', updatedAt: 'now', trashedAt: null, components: [{ id: '00000000-0000-0000-0000-000000000002', diagramId: '00000000-0000-0000-0000-000000000001', name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: 'now', updatedAt: 'now' }, { id: '00000000-0000-0000-0000-000000000003', diagramId: '00000000-0000-0000-0000-000000000001', name: 'DB', description: null, type: null, position: { x: 1, y: 1 }, createdAt: 'now', updatedAt: 'now' }], relationships: [{ id: '00000000-0000-0000-0000-000000000004', diagramId: '00000000-0000-0000-0000-000000000001', sourceComponentId: '00000000-0000-0000-0000-000000000002', targetComponentId: '00000000-0000-0000-0000-000000000003', direction: 'directed', label: 'uses', createdAt: 'now', updatedAt: 'now' }], groups: [] };

afterEach(() => vi.restoreAllMocks());
describe('relationship removal', () => {
  it('preserves components and restores the exact relationship through undo and redo', async () => {
    vi.spyOn(adrClient, 'relationshipSummaries').mockResolvedValue([]);
    const store = useDiagramStore.getState(); store.open(document); await store.update(d => ({ ...d, relationships: [] }));
    expect(useDiagramStore.getState().document?.components).toEqual(document.components); expect(useDiagramStore.getState().document?.relationships).toEqual([]);
    useDiagramStore.getState().undo(); expect(useDiagramStore.getState().document?.relationships).toEqual(document.relationships);
    await useDiagramStore.getState().redo(); expect(useDiagramStore.getState().document?.relationships).toEqual([]);
  });
});
