import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDocument } from '../../shared/src/index';
import { containerFixtureIds as ids, emptyChildFixture, generalParentFixture } from '../../shared/tests/container-fixtures';
import { useDiagramStore } from '../src/state/diagram-store';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const parent = () => generalParentFixture() as DiagramDocument;
const child = () => emptyChildFixture() as DiagramDocument;
const availability = { parentDiagramId: ids.parentDiagram, softwareSystemId: ids.owner, availability: 'none', diagram: null };
const reset = () => { useDiagramStore.getState().startNew(); useDiagramStore.setState({ containerOpenStatus: 'idle', containerOpenError: null }); };

afterEach(() => { vi.unstubAllGlobals(); reset(); });

describe('container diagram entry store action', () => {
  it('deduplicates concurrent activation and opens only the fetched canonical document', async () => {
    useDiagramStore.getState().open(parent());
    let release!: (response: Response) => void;
    const gate = new Promise<Response>(resolve => { release = resolve; });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => gate)
      .mockResolvedValueOnce(json(child()))
      .mockResolvedValueOnce(json(child()));
    vi.stubGlobal('fetch', fetchMock);

    const first = useDiagramStore.getState().createOrOpenContainerDiagram(ids.owner);
    const duplicate = await useDiagramStore.getState().createOrOpenContainerDiagram(ids.owner);
    expect(duplicate).toBe(false);
    release(json(availability));
    expect(await first).toBe(true);
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/container-diagram'))).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(4); // availability, POST, resolved load, and refreshed library
    expect(useDiagramStore.getState().document?.id).toBe(ids.emptyChild);
  });

  it('requires a saved owner and leaves an unsaved or missing owner untouched', async () => {
    useDiagramStore.getState().open(parent());
    useDiagramStore.getState().update(current => ({ ...current, components: current.components.filter(component => component.id !== ids.owner) }));
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect(await useDiagramStore.getState().createOrOpenContainerDiagram(ids.owner)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useDiagramStore.getState().document?.id).toBe(ids.parentDiagram);
  });

  it('does not replace a parent edited while the child load is in flight', async () => {
    useDiagramStore.getState().open(parent());
    let release!: (response: Response) => void;
    const gate = new Promise<Response>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json(availability))
      .mockResolvedValueOnce(json(child()))
      .mockImplementationOnce(() => gate));
    const opening = useDiagramStore.getState().createOrOpenContainerDiagram(ids.owner);
    await vi.waitFor(() => expect(useDiagramStore.getState().containerOpenStatus).toBe('loading'));
    useDiagramStore.getState().update(current => ({ ...current, name: 'Edited while opening' }));
    release(json(child()));
    expect(await opening).toBe(false);
    expect(useDiagramStore.getState().document?.name).toBe('Edited while opening');
  });

  it('keeps the parent and retry intent when creation succeeds but loading fails', async () => {
    useDiagramStore.getState().open(parent());
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(availability))
      .mockResolvedValueOnce(json(child()))
      .mockResolvedValueOnce(json({ message: 'temporary load failure' }, 503))
      .mockResolvedValueOnce(json({ ...availability, availability: 'active', diagram: { id: ids.emptyChild, name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', kind: 'container', scope: null } }))
      .mockResolvedValueOnce(json(child()))
      .mockResolvedValueOnce(json(child()));
    vi.stubGlobal('fetch', fetchMock);
    expect(await useDiagramStore.getState().createOrOpenContainerDiagram(ids.owner)).toBe(false);
    expect(useDiagramStore.getState().document?.id).toBe(ids.parentDiagram);
    expect(useDiagramStore.getState().containerOpenStatus).toBe('failed');
    expect(await useDiagramStore.getState().createOrOpenContainerDiagram(ids.owner)).toBe(true);
    expect(useDiagramStore.getState().document?.id).toBe(ids.emptyChild);
  });
});
