import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDocument } from '../../shared/src/index';
import { diagramClient } from '../src/api/diagram-client';
import { useDiagramStore } from '../src/state/diagram-store';

const document: DiagramDocument = {
  id: '00000000-0000-0000-0000-000000000301', name: 'System context', status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [], relationships: [], groups: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  useDiagramStore.getState().open(structuredClone(document));
});

describe('C4 component types in the diagram store', () => {
  it('requires a supported type, creates stable IDs, and preserves the type on save/reopen', async () => {
    useDiagramStore.getState().open(structuredClone(document));
    expect(useDiagramStore.getState().addComponent('Unclassified', undefined as never)).toBe(false);
    expect(useDiagramStore.getState().document?.components).toHaveLength(0);
    expect(useDiagramStore.getState().addComponent('Operator', 'person')).toBe(true);
    expect(useDiagramStore.getState().addComponent('Billing', 'software-system')).toBe(true);
    const ids = useDiagramStore.getState().document!.components.map(component => component.id);
    expect(new Set(ids).size).toBe(2);
    expect(useDiagramStore.getState().document!.components.map(component => component.type)).toEqual(['person', 'software-system']);
    const savedDocument = structuredClone(useDiagramStore.getState().document!);
    vi.spyOn(diagramClient, 'save').mockResolvedValue(savedDocument);
    await useDiagramStore.getState().save();
    useDiagramStore.getState().startNew();
    useDiagramStore.getState().open(savedDocument);
    expect(useDiagramStore.getState().document?.components.map(component => component.id)).toEqual(ids);
    expect(useDiagramStore.getState().document?.components.map(component => component.type)).toEqual(['person', 'software-system']);
  });

  it('edits a C4 type in place and keeps the component identity and history', () => {
    useDiagramStore.getState().open({ ...structuredClone(document), components: [{ id: '00000000-0000-0000-0000-000000000302', diagramId: document.id, name: 'API', description: null, type: 'person', position: { x: 0, y: 0 }, createdAt: document.createdAt, updatedAt: document.updatedAt }] });
    const id = document.id === 'never' ? '' : '00000000-0000-0000-0000-000000000302';
    expect(useDiagramStore.getState().updateComponentType(id, 'software-system')).toBe(true);
    expect(useDiagramStore.getState().document?.components[0]).toMatchObject({ id, type: 'software-system' });
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().document?.components[0].type).toBe('person');
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().document?.components[0].id).toBe(id);
  });
});
