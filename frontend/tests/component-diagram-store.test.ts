import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diagramDocumentSchema, type DiagramDocument, type ComponentContext } from '../../shared/src/index';
import { populatedComponentFixture, emptyComponentFixture, componentParentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { diagramClient } from '../src/api/diagram-client';
import { useDiagramStore } from '../src/state/diagram-store';

const store = () => useDiagramStore.getState();
const child = () => diagramDocumentSchema.parse(populatedComponentFixture()) as DiagramDocument;
const context = (): ComponentContext => ({ scope: child().scope as ComponentContext['scope'], capturedAt: new Date().toISOString(), sources: [
  { id: ids.datastore, name: 'Ledger', description: 'Stores payments', type: 'container', containerType: 'datastore', technology: 'PostgreSQL', canonicalSourceComponentId: ids.datastore, sourceDiagramId: ids.parent },
  { id: ids.personOccurrence, name: 'Customer', description: 'Places orders', type: 'person', containerType: null, technology: null, canonicalSourceComponentId: ids.canonicalPerson, sourceDiagramId: ids.context },
  { id: ids.systemOccurrence, name: 'Bank', description: 'Settles payments', type: 'software-system', containerType: null, technology: null, canonicalSourceComponentId: ids.canonicalSystem, sourceDiagramId: ids.context },
] });
beforeEach(() => { vi.restoreAllMocks(); store().open(child()); });

describe('Component modeling commands', () => {
  it('creates complete Component-only internals and validates fields without partial history', () => {
    const before = store().document;
    expect(store().addC4Component({ name: 'Handler', description: ' ', technology: 'TS' })).toBe(false);
    expect(store().addComponent('Person', 'person')).toBe(false);
    expect(store().addContainer({ name: 'API', description: 'Handles', technology: 'TS', containerType: 'application' })).toBe(false);
    expect(store().setComponentType(ids.internal, 'person')).toBe(false);
    expect(store().createGroup('Group', [ids.internal, ids.childPerson])).toBe(false);
    expect(store().document).toBe(before); expect(store().canUndo).toBe(false);
    expect(store().addC4Component({ name: ' Handler ', description: ' Handles requests ', technology: ' TS ' })).toBe(true);
    const after = structuredClone(store().document!);
    expect(after.components.at(-1)).toMatchObject({ name: 'Handler', description: 'Handles requests', technology: 'TS', type: 'component', role: 'component', sourceComponentId: null, containerType: null });
    store().undo(); expect(store().document).toEqual(before); store().redo(); expect(store().document).toEqual(after);
  });
  it('edits stable IDs and fits/displaces as one undoable edit; rejects direct supporting placement', () => {
    const before = structuredClone(store().document!);
    expect(store().moveComponent(ids.internal, { x: 650, y: 68 })).toBe(true);
    const moved = structuredClone(store().document!);
    expect(moved.components[1].position).not.toEqual(before.components[1].position);
    expect(moved.relationships).toEqual(before.relationships);
    store().undo(); expect(store().document).toEqual(before); store().redo(); expect(store().document).toEqual(moved);
    store().undo(); expect(store().moveComponent(ids.childPerson, { x: 100, y: 100 })).toBe(false); expect(store().document).toEqual(before);
    expect(store().resizeComponent(ids.internal, { width: 800, height: 400 })).toBe(true); store().undo(); expect(store().document).toEqual(before);
    expect(store().editC4Component(ids.internal, { name: 'Renamed', description: 'Handles requests', technology: 'Rust' })).toBe(true);
    expect(store().document!.components[0].id).toBe(ids.internal); expect(store().document!.relationships).toEqual(before.relationships);
  });
  it('rejects missing/self/boundary/supporting-only/undirected/blank interactions and retains failed edits', () => {
    const before = store().document;
    for (const [source, target, label, direction] of [[ids.internal, ids.internal, 'Calls', 'directed'], ['boundary', ids.internal, 'Calls', 'directed'], [ids.childPerson, ids.childSystem, 'Calls', 'directed'], [ids.internal, ids.childPerson, ' ', 'directed'], [ids.internal, ids.childPerson, 'Calls', 'undirected']] as const) {
      expect(store().addRelationship(source, target, label, direction)).toBe(false); expect(store().document).toBe(before);
    }
    expect(store().updateRelationship(ids.relationship, { label: ' ' })).toBe(false); expect(store().document).toBe(before);
    expect(store().addRelationship(ids.internal, ids.childPerson, ' Serves ', 'directed', ' HTTPS ')).toBe(true);
    expect(store().document!.relationships.at(-1)).toMatchObject({ label: 'Serves', protocol: 'HTTPS' });
    store().undo(); expect(store().document).toEqual(before);
  });
  it('includes immediate sources independently, excluding owners and canonical duplicates', () => {
    store().open(emptyComponentFixture() as DiagramDocument);
    const sources = context();
    expect(store().includeExternalParticipant(ids.application, sources)).toBe(false);
    expect(store().includeExternalParticipant(ids.personOccurrence, sources)).toBe(true);
    expect(store().document!.components[0]).toMatchObject({ sourceComponentId: ids.personOccurrence, role: 'external' });
    expect(store().document!.relationships).toEqual([]);
    const before = store().document;
    const duplicate = { ...sources.sources[1], id: ids.childPerson };
    expect(store().includeExternalParticipant(duplicate.id, { ...sources, sources: [...sources.sources, duplicate] })).toBe(false); expect(store().document).toBe(before);
    expect(store().renameComponent(before!.components[0].id, 'Local override')).toBe(false);
    store().undo(); expect(store().document!.components).toEqual([]);
  });
  it('preserves the complete document/history when source inclusion fails on another missing source', () => {
    const before = store().document;
    const incomplete = context(); const extraId = 'a0000000-0000-4000-8000-000000000099';
    incomplete.sources = [{ ...incomplete.sources[0], id: extraId, canonicalSourceComponentId: extraId }];
    expect(store().includeExternalParticipant(extraId, incomplete)).toBe(false);
    expect(store().document).toBe(before); expect(store().canUndo).toBe(false);
    expect(store().error).toMatch(/source/i);
    store().update(d => ({ ...d, components: d.components.map(c => c.id === ids.childPerson ? { ...c, sourceComponentId: ids.datastore } : c) }));
    expect(store().document).toBe(before); expect(store().canUndo).toBe(false);
  });
  it('refreshes authoritative source details in a batch, overlays history, and preserves drafts on failures/stale responses', async () => {
    const before = structuredClone(store().document!); const sources = context();
    vi.spyOn(diagramClient, 'componentContext').mockResolvedValue(sources);
    expect(await store().refreshContainerContext()).toBe(true);
    expect(store().document!.components[1]).toMatchObject({ name: 'Ledger', id: ids.siblingOccurrence, sourceComponentId: ids.datastore, position: before.components[1].position });
    expect(store().document!.relationships).toEqual(before.relationships);
    store().moveComponent(ids.internal, { x: 60, y: 80 }); store().undo(); expect(store().document!.components[1].name).toBe('Ledger');
    vi.mocked(diagramClient.componentContext).mockRejectedValue(new Error('Source unavailable'));
    const refreshed = store().document; expect(await store().refreshContainerContext()).toBe(false); expect(store().document).toBe(refreshed);
    vi.mocked(diagramClient.componentContext).mockResolvedValue({ ...sources, sources: [] });
    expect(await store().refreshContainerContext()).toBe(false); expect(store().document).toBe(refreshed);
    let resolve!: (value: ComponentContext) => void;
    vi.mocked(diagramClient.componentContext).mockImplementation(() => new Promise(done => { resolve = done; }));
    const pending = store().refreshContainerContext(); store().open(componentParentFixture()); resolve(sources);
    expect(await pending).toBe(false); expect(store().document!.id).toBe(ids.parent);
  });
  it('reconciles authoritative saved supporting metadata without undo reverting its source details', async () => {
    store().applyContainerContext(context()); store().moveComponent(ids.internal, { x: 40, y: 80 });
    const before = structuredClone(store().document!);
    vi.spyOn(diagramClient, 'save').mockImplementation(async request => ({ ...request, components: request.components.map(c => c.id === ids.siblingOccurrence ? { ...c, name: 'Current ledger', technology: 'SQLite' } : c) }));
    await store().save(); expect(store().status).toBe('saved');
    expect(store().document!.components[1]).toMatchObject({ name: 'Current ledger', technology: 'SQLite', sourceComponentId: ids.datastore, position: before.components[1].position });
    store().undo(); expect(store().document!.components[1]).toMatchObject({ name: 'Current ledger', technology: 'SQLite' });
  });
});
