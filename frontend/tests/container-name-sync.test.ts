import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagramDocumentSchema, type DiagramDocument } from '../../shared/src/index';
import { generalParentFixture, populatedChildFixture, containerFixtureIds as ids } from '../../shared/tests/container-fixtures';
import { useDiagramStore } from '../src/state/diagram-store';
import { deriveDiagramLibraryDisplay, deriveDiagramGroups } from '../src/state/diagram-list';
import { diagramClient } from '../src/api/diagram-client';

const parent = () => diagramDocumentSchema.parse(generalParentFixture()) as DiagramDocument;
const child = () => diagramDocumentSchema.parse(populatedChildFixture()) as DiagramDocument;
const store = () => useDiagramStore.getState();
afterEach(() => { vi.restoreAllMocks(); store().startNew(); useDiagramStore.setState({ savedDocuments: [], trashedDocuments: [] }); });

describe('container names follow their owner', () => {
  it('previews a draft by UUID before filtering/sorting, without changing saved summaries; undo/redo/discard restores the label', () => {
    const p = parent(), c = child();
    const other = { ...c, id: crypto.randomUUID(), scope: { ...c.scope!, softwareSystemId: ids.duplicateOwner } };
    useDiagramStore.setState({ savedDocuments: [p, c, other] }); store().open(p);
    store().renameComponent(ids.owner, 'aa');
    const display = () => deriveDiagramLibraryDisplay(store().savedDocuments, store().document);
    expect(display().find(d => d.id === c.id)).toMatchObject({ name: 'aa', scope: { softwareSystemName: 'aa' } });
    expect(display().find(d => d.id === other.id)?.name).toBe('Payments');
    expect(store().savedDocuments[1].name).toBe('Payments');
    expect(deriveDiagramGroups(display(), { nameQuery: 'aa' }).items.map(d => d.id)).toEqual([c.id]);
    store().undo(); expect(display()[1].name).toBe('Payments');
    store().redo(); expect(display()[1].name).toBe('aa');
    store().open(p); expect(display()[1].name).toBe('Payments');
  });

  it('reconciles the saved snapshot, keeps newer draft previews and rejects older list metadata', async () => {
    const p = parent(), c = child();
    useDiagramStore.setState({ savedDocuments: [p, c], trashedDocuments: [{ ...c, status: 'trashed' }] }); store().open(p);
    let releaseList!: (rows: typeof p[]) => void, releaseSave!: (d: DiagramDocument) => void;
    vi.spyOn(diagramClient, 'list').mockImplementation(() => new Promise(resolve => { releaseList = resolve; }));
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => { releaseSave = resolve; }));
    const listing = store().refreshSavedDocuments();
    store().renameComponent(ids.owner, 'aa'); const captured = structuredClone(store().document!);
    const saving = store().save(); store().renameComponent(ids.owner, 'aaa'); releaseSave(captured); await saving;
    releaseList([p, c]); await listing;
    expect(store().savedDocuments.find(d => d.id === c.id)).toMatchObject({ name: 'aa', scope: { softwareSystemName: 'aa' }, updatedAt: c.updatedAt });
    expect(store().trashedDocuments[0].name).toBe('aa');
    expect(deriveDiagramLibraryDisplay(store().savedDocuments, store().document)[1].name).toBe('aaa');
    expect(store().status).toBe('unsaved');
  });

  it('keeps failed-save preview and saved metadata until retry succeeds', async () => {
    const p = parent(), c = child(); useDiagramStore.setState({ savedDocuments: [p, c] }); store().open(p);
    store().renameComponent(ids.owner, 'aa');
    vi.spyOn(diagramClient, 'save').mockRejectedValueOnce(new Error('Save failed')).mockImplementationOnce(async d => d);
    await store().save(); expect(store().status).toBe('failed'); expect(store().savedDocuments[1].name).toBe('Payments');
    expect(deriveDiagramLibraryDisplay(store().savedDocuments, store().document)[1].name).toBe('aa');
    await store().retry(); expect(store().savedDocuments[1].name).toBe('aa');
  });

  it('normalizes legacy child names and accepts a current owner name on save without losing newer content', async () => {
    const c = { ...child(), name: 'Old custom title' }; store().open(c);
    expect(store().document?.name).toBe('Payments');
    store().update(d => ({ ...d, name: 'Cannot rename child' })); expect(store().canUndo).toBe(false);
    let release!: (d: DiagramDocument) => void;
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const saving = store().save(); store().renameComponent(ids.container, 'New draft container');
    release({ ...c, name: 'aa', scope: { ...c.scope!, softwareSystemName: 'aa' } }); await saving;
    expect(store()).toMatchObject({ status: 'unsaved', document: { name: 'aa', scope: { softwareSystemName: 'aa' } } });
    expect(store().document?.components[0].name).toBe('New draft container');
  });

  it('retains source metadata for undo after removing an external occurrence and saving', async () => {
    const c = child(); store().open(c);
    store().update(d => ({ ...d, relationships: [], components: d.components.filter(component => component.role !== 'external') }));
    vi.spyOn(diagramClient, 'save').mockImplementation(async d => d);
    await store().save(); store().undo();
    expect(store().document?.components.find(component => component.id === ids.externalOccurrence)?.name).toBe(c.components[1].name);
    expect(store().document?.name).toBe('Payments');
  });
});
