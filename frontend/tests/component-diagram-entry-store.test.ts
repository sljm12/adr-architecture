import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDocument } from '../../shared/src/index';
import { componentParentFixture, emptyComponentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { useDiagramStore } from '../src/state/diagram-store';
const state = () => useDiagramStore.getState();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const availability = { parentDiagramId: ids.parent, containerId: ids.application, availability: 'none', diagram: null };
afterEach(() => { vi.unstubAllGlobals(); state().startNew(); });

describe('Component entry state', () => {
  it('deduplicates activation for one canonical owner', async () => {
    state().open(componentParentFixture());
    let release!: (response: Response) => void;
    const gate = new Promise<Response>(resolve => { release = resolve; });
    const fetch = vi.fn().mockImplementationOnce(() => gate).mockResolvedValueOnce(json(emptyComponentFixture(), 201)).mockResolvedValueOnce(json(emptyComponentFixture())).mockResolvedValue(json([]));
    vi.stubGlobal('fetch', fetch);
    const first = state().createOrOpenComponentDiagram(ids.application);
    expect(await state().createOrOpenComponentDiagram(ids.application)).toBe(false);
    release(json(availability)); expect(await first).toBe(true);
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(state().document?.id).toBe(ids.child);
  });
  it('requires a successful parent save and preserves canceled or failed drafts', async () => {
    state().open(componentParentFixture()); state().editContainer(ids.application, { name: 'Renamed', description: 'Handles requests', technology: 'TS', containerType: 'application' });
    const draft = state().document;
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await state().createOrOpenComponentDiagram(ids.application)).toBe(false);
    expect(fetch).not.toHaveBeenCalled(); expect(state().document).toBe(draft);
    fetch.mockResolvedValueOnce(json({ message: 'Parent save failed' }, 503));
    await state().save(); expect(state().status).toBe('failed');
    expect(await state().createOrOpenComponentDiagram(ids.application)).toBe(false); expect(state().document).toBe(draft);
    fetch.mockResolvedValueOnce(json(draft)); await state().save(); expect(state().status).toBe('saved');
    const child = { ...emptyComponentFixture(), name: 'Renamed', scope: { ...emptyComponentFixture().scope, containerName: 'Renamed' } };
    fetch.mockResolvedValueOnce(json(availability)).mockResolvedValueOnce(json(child, 201)).mockResolvedValueOnce(json(child)).mockResolvedValue(json([]));
    expect(await state().createOrOpenComponentDiagram(ids.application)).toBe(true);
  });
  it('retries the already-created child after a failed load', async () => {
    state().open(componentParentFixture());
    const child = emptyComponentFixture();
    const fetch = vi.fn().mockResolvedValueOnce(json(availability)).mockResolvedValueOnce(json(child, 201)).mockResolvedValueOnce(json({ message: 'Load temporarily failed' }, 503));
    vi.stubGlobal('fetch', fetch);
    expect(await state().createOrOpenComponentDiagram(ids.application)).toBe(false);
    expect(state().document?.id).toBe(ids.parent); expect(state().componentOpenError).toContain('Load temporarily failed');
    fetch.mockResolvedValueOnce(json({ ...availability, availability: 'active', diagram: child })).mockResolvedValueOnce(json(child)).mockResolvedValue(json([]));
    expect(await state().createOrOpenComponentDiagram(ids.application)).toBe(true);
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(state().document?.id).toBe(ids.child);
  });
  it('keeps newer drafts and suppresses failures from a superseded session', async () => {
    state().open(componentParentFixture());
    let release!: (response: Response) => void;
    const gate = new Promise<Response>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => gate));
    const opening = state().createOrOpenComponentDiagram(ids.application);
    state().open(emptyComponentFixture('datastore') as DiagramDocument);
    release(json({ message: 'Old request failed' }, 503));
    expect(await opening).toBe(false); expect(state().document?.id).toBe(ids.datastoreChild); expect(state().componentOpenError).toBeNull();
  });
  it('rejects a destination or ADR draft that changed while loading', async () => {
    state().open(componentParentFixture());
    let canCommit = true;
    const fetch = vi.fn().mockResolvedValueOnce(json(availability)).mockResolvedValueOnce(json(emptyComponentFixture(), 201)).mockImplementationOnce(() => { canCommit = false; return Promise.resolve(json(emptyComponentFixture())); });
    vi.stubGlobal('fetch', fetch);
    expect(await state().createOrOpenComponentDiagram(ids.application, { canCommit: () => canCommit })).toBe(false);
    expect(state().document?.id).toBe(ids.parent);
  });
  it('routes a supporting container through its canonical parent and owner', async () => {
    state().open(populatedComponentFixture() as DiagramDocument);
    const child = emptyComponentFixture('datastore');
    const fetch = vi.fn().mockResolvedValueOnce(json({ ...availability, containerId: ids.datastore })).mockResolvedValueOnce(json(child, 201)).mockResolvedValueOnce(json(child)).mockResolvedValue(json([]));
    vi.stubGlobal('fetch', fetch);
    expect(await state().createOrOpenComponentDiagram(ids.siblingOccurrence)).toBe(true);
    expect(fetch.mock.calls[1][0]).toBe(`/api/diagrams/${ids.parent}/components/${ids.datastore}/component-diagram`);
    expect(state().document?.scope).toMatchObject({ parentDiagramId: ids.parent, containerId: ids.datastore });
  });
});
