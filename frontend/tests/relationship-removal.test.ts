import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDiagramStore } from '../src/state/diagram-store';
import type { DiagramDocument } from '../../shared/src/index';

const document: DiagramDocument = { id: '00000000-0000-0000-0000-000000000001', name: 'System', status: 'active', createdAt: 'now', updatedAt: 'now', trashedAt: null, components: [{ id: '00000000-0000-0000-0000-000000000002', diagramId: '00000000-0000-0000-0000-000000000001', name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: 'now', updatedAt: 'now' }, { id: '00000000-0000-0000-0000-000000000003', diagramId: '00000000-0000-0000-0000-000000000001', name: 'DB', description: null, type: null, position: { x: 1, y: 1 }, createdAt: 'now', updatedAt: 'now' }], relationships: [{ id: '00000000-0000-0000-0000-000000000004', diagramId: '00000000-0000-0000-0000-000000000001', sourceComponentId: '00000000-0000-0000-0000-000000000002', targetComponentId: '00000000-0000-0000-0000-000000000003', direction: 'directed', label: 'uses', createdAt: 'now', updatedAt: 'now' }] };

afterEach(() => vi.clearAllTimers());
describe('relationship removal', () => {
  it('preserves components and restores the exact relationship through undo and redo', () => {
    vi.useFakeTimers(); const store = useDiagramStore.getState(); store.open(document); store.removeRelationship(document.relationships[0].id);
    expect(useDiagramStore.getState().document?.components).toEqual(document.components); expect(useDiagramStore.getState().document?.relationships).toEqual([]);
    useDiagramStore.getState().undo(); expect(useDiagramStore.getState().document?.relationships).toEqual(document.relationships);
    useDiagramStore.getState().redo(); expect(useDiagramStore.getState().document?.relationships).toEqual([]); vi.useRealTimers();
  });
});
