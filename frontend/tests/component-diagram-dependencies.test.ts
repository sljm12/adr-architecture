import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDiagramStore } from '../src/state/diagram-store';
import { diagramClient } from '../src/api/diagram-client';
import { componentParentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';

afterEach(() => vi.restoreAllMocks());
describe('current Component dependency history guards', () => {
  it('blocks undo after a child begins using a source, preserving document and cursor', async () => {
    const parent = componentParentFixture();
    const without = { ...parent, components: parent.components.filter(c => c.id !== ids.personOccurrence) };
    useDiagramStore.getState().open(without);
    useDiagramStore.getState().update(() => parent);
    vi.spyOn(diagramClient, 'save').mockResolvedValue(useDiagramStore.getState().document!);
    await useDiagramStore.getState().save();
    const before = useDiagramStore.getState().document;
    vi.spyOn(diagramClient, 'dependencyCount').mockResolvedValue({ relationshipCount: 0, diagramBlockers: [{ diagramId: ids.child, name: 'Payment API', status: 'trashed', componentId: ids.childPerson, sourceComponentId: ids.personOccurrence, nextAction: 'Restore this child and remove the occurrence.' }] });
    await useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().document).toBe(before);
    expect(useDiagramStore.getState()).toMatchObject({ canUndo: true, canRedo: false, error: expect.stringContaining(ids.childPerson) });
  });
  it('blocks direct removal and redo using fresh ADR blockers, while failed checks preserve history', async () => {
    const parent = componentParentFixture();
    useDiagramStore.getState().open(parent);
    const check = vi.spyOn(diagramClient, 'dependencyCount').mockResolvedValue({ relationshipCount: 0 });
    await useDiagramStore.getState().update(d => ({ ...d, components: d.components.filter(c => c.id !== ids.personOccurrence) }));
    await useDiagramStore.getState().undo();
    const before = useDiagramStore.getState().document;
    check.mockResolvedValue({ relationshipCount: 0, blockers: [{ adrId: ids.linkedAdr, title: 'Keep source', reason: 'linked' }] });
    await useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().document).toBe(before);
    expect(useDiagramStore.getState()).toMatchObject({ canRedo: true, error: expect.stringContaining('Keep source') });
    await useDiagramStore.getState().update(d => ({ ...d, components: d.components.filter(c => c.id !== ids.personOccurrence) }));
    expect(useDiagramStore.getState().document).toBe(before);
    check.mockRejectedValue(new Error('Dependency check unavailable'));
    await useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().document).toBe(before);
    expect(useDiagramStore.getState().canRedo).toBe(true);
  });
  it('ignores a delayed removal check after a newer edit or navigation', async () => {
    const parent = componentParentFixture(); useDiagramStore.getState().open(parent);
    let release!: (value: { relationshipCount: number }) => void;
    vi.spyOn(diagramClient, 'dependencyCount').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const removal = useDiagramStore.getState().update(d => ({ ...d, components: d.components.filter(c => c.id !== ids.personOccurrence) }));
    useDiagramStore.getState().renameComponent(ids.application, 'Newer owner draft');
    const newer = useDiagramStore.getState().document;
    release({ relationshipCount: 0 }); await removal;
    expect(useDiagramStore.getState().document).toBe(newer);
    expect(useDiagramStore.getState().document?.components.some(c => c.id === ids.personOccurrence)).toBe(true);
  });
});
