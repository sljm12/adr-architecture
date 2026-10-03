import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagramDocumentSchema, type DiagramDocument, type ContainerContext } from '../../shared/src/index';
import { populatedChildFixture, generalParentFixture, containerFixtureIds as ids } from '../../shared/tests/container-fixtures';
import { diagramClient } from '../src/api/diagram-client';
import { useDiagramStore } from '../src/state/diagram-store';

const child = () => diagramDocumentSchema.parse({ ...populatedChildFixture(), name: 'Runtime' }) as DiagramDocument;
const parent = () => diagramDocumentSchema.parse(generalParentFixture()) as DiagramDocument;
const row = (d: DiagramDocument) => ({ id: d.id, name: d.name, kind: d.kind, scope: d.scope, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); useDiagramStore.getState().startNew(); useDiagramStore.setState({ savedDocuments: [] }); });

describe('container save and reopen identity', () => {
  it('retains child name, subtype, boundary and scope through the actual list/load/PUT response parsers', async () => {
    const d = child(); d.components[0].containerType = 'datastore';
    const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    const fetcher = vi.fn().mockResolvedValueOnce(response([row(d)])).mockResolvedValueOnce(response(d)).mockResolvedValueOnce(response(d));
    vi.stubGlobal('fetch', fetcher);
    expect(await diagramClient.list()).toEqual([row(d)]); expect(await diagramClient.get(d.id)).toEqual(d); expect(await diagramClient.save(d)).toEqual(d);
    expect(fetcher.mock.calls[2]).toEqual([`/api/diagrams/${d.id}`, expect.objectContaining({ method: 'PUT', body: JSON.stringify(d) })]);
  });
  it('repeated saves update exactly one child summary with its own name and canonical scope', async () => {
    const d = child(), p = row(parent());
    useDiagramStore.setState({ savedDocuments: [p, row(d)] }); useDiagramStore.getState().open(d);
    const save = vi.spyOn(diagramClient, 'save').mockImplementation(async captured => ({ ...captured, name: captured.name.trim() }));
    const create = vi.spyOn(diagramClient, 'create');
    for (const name of ['  Runtime two  ', 'Runtime three']) { useDiagramStore.getState().update(current => ({ ...current, name })); await useDiagramStore.getState().save(); }
    expect(save.mock.calls.map(([captured]) => [captured.id, captured.kind, captured.scope?.parentDiagramId])).toEqual([[d.id, 'container', ids.parentDiagram], [d.id, 'container', ids.parentDiagram]]);
    expect(create).not.toHaveBeenCalled(); expect(useDiagramStore.getState().savedDocuments).toEqual([p, expect.objectContaining({ id: d.id, name: 'Runtime three', scope: d.scope })]);
    vi.spyOn(diagramClient, 'get').mockResolvedValue(useDiagramStore.getState().document!);
    useDiagramStore.getState().open(parent()); await useDiagramStore.getState().loadSavedDocument(d.id);
    expect(useDiagramStore.getState().document).toMatchObject({ id: d.id, name: 'Runtime three', kind: 'container', scope: d.scope });
  });

  it.each(['id', 'name', 'kind', 'parent', 'owner'])('rejects a save response with wrong %s, retaining draft/history/list and retrying the same child', async field => {
    const d = child(); useDiagramStore.getState().open(d); useDiagramStore.setState({ savedDocuments: [row(d)] });
    useDiagramStore.getState().update(current => ({ ...current, name: 'Edited runtime' }));
    const draft = useDiagramStore.getState().document!;
    const wrong = structuredClone(draft);
    if (field === 'id') wrong.id = crypto.randomUUID();
    if (field === 'name') wrong.name = 'Parent Diagram';
    if (field === 'kind') { wrong.kind = 'general'; wrong.scope = null; }
    if (field === 'parent') wrong.scope!.parentDiagramId = crypto.randomUUID();
    if (field === 'owner') wrong.scope!.softwareSystemId = crypto.randomUUID();
    const save = vi.spyOn(diagramClient, 'save').mockResolvedValueOnce(wrong).mockResolvedValueOnce(draft);
    await useDiagramStore.getState().save();
    expect(useDiagramStore.getState()).toMatchObject({ document: draft, status: 'failed', canUndo: true, error: expect.stringMatching(/match|identity/i), savedDocuments: [row(d)] });
    await useDiagramStore.getState().retry(); expect(useDiagramStore.getState().status).toBe('saved');
    expect(save.mock.calls.every(([captured]) => captured.id === d.id && captured.scope?.parentDiagramId === ids.parentDiagram)).toBe(true);
  });

  it('preserves a newer local edit while registering only the captured successful save', async () => {
    const d = child(); useDiagramStore.getState().open(d);
    let release!: (d: DiagramDocument) => void;
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const saving = useDiagramStore.getState().save(); useDiagramStore.getState().update(current => ({ ...current, name: 'Newer draft' })); release(d); await saving;
    expect(useDiagramStore.getState().document?.name).toBe('Newer draft'); expect(useDiagramStore.getState().status).toBe('unsaved');
    expect(useDiagramStore.getState().savedDocuments).toEqual([row(d)]);
  });

  it('keeps a successful child summary when an older library refresh completes afterward', async () => {
    const d = child(); useDiagramStore.getState().open(d); useDiagramStore.setState({ savedDocuments: [row(d)] });
    let release!: (rows: ReturnType<typeof row>[]) => void;
    vi.spyOn(diagramClient, 'list').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const refresh = useDiagramStore.getState().refreshSavedDocuments();
    useDiagramStore.getState().update(current => ({ ...current, name: 'Saved newer name' }));
    vi.spyOn(diagramClient, 'save').mockImplementation(async captured => captured);
    await useDiagramStore.getState().save(); release([row(d)]); await refresh;
    expect(useDiagramStore.getState().savedDocuments).toEqual([expect.objectContaining({ id: d.id, name: 'Saved newer name' })]);
  });

  it('does not navigate during save and rejects a load after local or caller draft revisions change', async () => {
    const d = child(); useDiagramStore.getState().open(d);
    const get = vi.spyOn(diagramClient, 'get'); useDiagramStore.setState({ status: 'saving' });
    expect(await useDiagramStore.getState().loadSavedDocument(ids.parentDiagram)).toBe(false); expect(get).not.toHaveBeenCalled();
    useDiagramStore.setState({ status: 'saved' }); let release!: (d: DiagramDocument) => void;
    get.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const loading = useDiagramStore.getState().loadSavedDocument(ids.parentDiagram);
    useDiagramStore.getState().update(current => ({ ...current, name: 'Edit while loading' })); release(parent());
    expect(await loading).toBe(false); expect(useDiagramStore.getState().document?.name).toBe('Edit while loading');
    const guardedLoad = useDiagramStore.getState().loadSavedDocument(ids.parentDiagram, { canCommit: () => false }); release(parent());
    expect(await guardedLoad).toBe(false); expect(useDiagramStore.getState().document?.id).toBe(d.id);
  });

  it('rejects superseded loads and leaves retry failures in the original view', async () => {
    useDiagramStore.getState().open(child()); let release!: (d: DiagramDocument) => void;
    vi.spyOn(diagramClient, 'get').mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValueOnce(child());
    const first = useDiagramStore.getState().loadSavedDocument(ids.parentDiagram);
    expect(await useDiagramStore.getState().loadSavedDocument(ids.populatedChild)).toBe(true); release(parent());
    expect(await first).toBe(false); expect(useDiagramStore.getState().document?.id).toBe(ids.populatedChild);
  });

  it('refreshes source context outside history and reapplies current display metadata through undo/redo', () => {
    const d = child(); useDiagramStore.getState().open(d);
    useDiagramStore.getState().update(current => ({ ...current, name: 'Local name' }));
    const context: ContainerContext = { scope: { ...d.scope!, parentDiagramName: 'Renamed parent', softwareSystemName: 'Renamed owner' }, sources: [{ id: ids.sourceSystem, name: 'Renamed source', description: 'Fresh', type: 'person' }], capturedAt: new Date().toISOString() };
    expect(useDiagramStore.getState().applyContainerContext(context)).toBe(true);
    const refreshed = useDiagramStore.getState().document!;
    expect(refreshed.name).toBe('Local name'); expect(refreshed.boundary).toEqual(d.boundary); expect(refreshed.components[0]).toEqual(d.components[0]); expect(refreshed.components[1]).toMatchObject({ id: ids.externalOccurrence, name: 'Renamed source', type: 'person', position: d.components[1].position });
    useDiagramStore.getState().undo(); expect(useDiagramStore.getState().document?.name).toBe('Runtime'); expect(useDiagramStore.getState().document?.scope?.softwareSystemName).toBe('Renamed owner');
    useDiagramStore.getState().redo(); expect(useDiagramStore.getState().document?.name).toBe('Local name'); expect(useDiagramStore.getState().document?.components[1].name).toBe('Renamed source');
    expect(useDiagramStore.getState().applyContainerContext({ ...context, scope: { ...context.scope, parentDiagramId: crypto.randomUUID() } })).toBe(false);
  });
  it('keeps source-only refresh clean and rejects failed or stale context without replacing work', async () => {
    const d = child(); useDiagramStore.getState().open(d);
    const context: ContainerContext = { scope: { ...d.scope!, softwareSystemName: 'Current owner' }, sources: [{ id: ids.sourceSystem, name: 'Current source', description: null, type: 'software-system' }], capturedAt: new Date().toISOString() };
    const fetchContext = vi.spyOn(diagramClient, 'containerContext').mockResolvedValueOnce(context).mockRejectedValueOnce(new Error('Source lookup failed'));
    expect(await useDiagramStore.getState().refreshContainerContext()).toBe(true);
    expect(useDiagramStore.getState()).toMatchObject({ status: 'saved', canUndo: false, canRedo: false, document: { name: d.name, boundary: d.boundary } });
    const before = useDiagramStore.getState().document;
    expect(await useDiagramStore.getState().refreshContainerContext()).toBe(false); expect(useDiagramStore.getState().document).toBe(before);
    let release!: (context: ContainerContext) => void; fetchContext.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const pending = useDiagramStore.getState().refreshContainerContext(); useDiagramStore.getState().open(parent()); release(context);
    expect(await pending).toBe(false); expect(useDiagramStore.getState().document?.id).toBe(ids.parentDiagram);
  });
});
