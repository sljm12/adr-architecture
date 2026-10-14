import type * as Domain from '../../shared/src/index';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { componentParentFixture, populatedComponentFixture, emptyComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { diagramDocumentSchema, type DiagramDocument } from '../../shared/src/index';
import { useDiagramStore } from '../src/state/diagram-store';
import { deriveDiagramLibraryDisplay } from '../src/state/diagram-list';
import { diagramClient } from '../src/api/diagram-client';

const store = () => useDiagramStore.getState();
const child = () => diagramDocumentSchema.parse(populatedComponentFixture()) as DiagramDocument;
afterEach(() => { vi.restoreAllMocks(); store().startNew(); useDiagramStore.setState({ savedDocuments: [], trashedDocuments: [] }); });
describe('Component owner naming and reconciliation', () => {
  it('previews only the UUID-owned child and restores undo/redo/discard without modifying saved metadata', () => {
    const p = componentParentFixture(), c = child(), sibling = emptyComponentFixture('datastore') as DiagramDocument;
    store().open(p); useDiagramStore.setState({ savedDocuments: [p, c, sibling] });
    const display = () => deriveDiagramLibraryDisplay(store().savedDocuments, store().document);
    store().renameComponent(ids.application, 'AA handler');
    expect(display()[1]).toMatchObject({ name: 'AA handler', scope: { containerName: 'AA handler' }, updatedAt: c.updatedAt });
    expect(display()[2].name).toBe(sibling.name); expect(store().savedDocuments[1].name).toBe(c.name);
    store().undo(); expect(display()[1].name).toBe(c.name);
    store().redo(); expect(display()[1].name).toBe('AA handler');
    store().open(p); expect(display()[1].name).toBe(c.name);
  });
  it('reconciles captured owner metadata while preserving a newer rename and an older list response', async () => {
    const p = componentParentFixture(), c = child(); store().open(p);
    useDiagramStore.setState({ savedDocuments: [p, c], trashedDocuments: [{ ...c, status: 'trashed' }] });
    let list!: (rows: DiagramDocument[]) => void, save!: (d: DiagramDocument) => void;
    vi.spyOn(diagramClient, 'list').mockImplementation(() => new Promise(resolve => { list = resolve; }));
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => { save = resolve; }));
    const listing = store().refreshSavedDocuments(); store().renameComponent(ids.application, 'Saved name');
    const captured = structuredClone(store().document!); const saving = store().save(); store().renameComponent(ids.application, 'Newer name');
    save(captured); await saving; list([p, c]); await listing;
    expect(store().savedDocuments[1].name).toBe('Saved name'); expect(store().trashedDocuments[0].name).toBe('Saved name');
    expect(deriveDiagramLibraryDisplay(store().savedDocuments, store().document)[1].name).toBe('Newer name'); expect(store().status).toBe('unsaved');
  });
  it.each(['id', 'kind', 'parent', 'owner', 'name'])('keeps the draft when a save response changes %s', async field => {
    const c = child(); store().open(c); store().renameComponent(ids.internal, 'Draft handler'); const draft = store().document!;
    const invalid = structuredClone(draft);
    if (field === 'id') invalid.id = crypto.randomUUID();
    if (field === 'kind') invalid.kind = 'container';
    if (field === 'parent') invalid.scope!.parentDiagramId = crypto.randomUUID();
    if (field === 'owner' && 'containerId' in invalid.scope!) invalid.scope.containerId = crypto.randomUUID();
    if (field === 'name') invalid.name = 'Independent title';
    vi.spyOn(diagramClient, 'save').mockResolvedValue(invalid); await store().save();
    expect(store().status).toBe('failed'); expect(store().document).toEqual(draft);
    vi.mocked(diagramClient.save).mockResolvedValue(draft); await store().retry(); expect(store().status).toBe('saved');
  });
  it('accepts authoritative owner metadata without losing newer content and overlays refreshed metadata through history', async () => {
    const c = child(); store().open(c); let release!: (d: DiagramDocument) => void;
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const saving = store().save(); store().renameComponent(ids.internal, 'Newer internal');
    const scope = { ...(c.scope as Domain.ComponentScope), containerName: 'Renamed owner' };
    release({ ...c, name: scope.containerName, scope }); await saving;
    expect(store().document).toMatchObject({ name: 'Renamed owner', components: [expect.objectContaining({ name: 'Newer internal' }), ...c.components.slice(1)] });
    store().undo(); expect(store().document?.name).toBe('Renamed owner'); store().redo(); expect(store().document?.components[0].name).toBe('Newer internal');
  });
});
