import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveClient } from '../src/api/archive-client';
import { diagramClient } from '../src/api/diagram-client';
import { adrClient } from '../src/api/adr-client';
import { invalidateArchiveDiagrams, useDiagramStore } from '../src/state/diagram-store';
import { invalidateArchiveAdrs, useAdrStore } from '../src/state/adr-store';
import { generalParentFixture } from '../../shared/tests/container-fixtures';
import { archiveFixture } from '../../shared/tests/archive-fixtures';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); useDiagramStore.getState().startNew(); useAdrStore.getState().clear(); });
describe('archive failures and cache generations', () => {
  it.each(['network', 'unreadable', 'invalid-result'] as const)('never retries an uncertain %s commit', async failure => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    if (failure === 'network') fetch.mockRejectedValue(new Error('lost'));
    else fetch.mockResolvedValue({ ok: true, json: failure === 'unreadable' ? async () => { throw new Error('lost'); } : async () => ({ committed: true }) });
    await expect(archiveClient.import({ archiveText: JSON.stringify(archiveFixture()), previewedAt: archiveFixture().exportedAt, previewToken: 'a'.repeat(64), overrideExisting: false, recoverySaved: false, recoveryFileSha256: null })).rejects.toThrow('uncertain');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('shows structured path and remedy without losing their context', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ code: 'ARCHIVE_INVALID', message: 'Invalid archive.', remedy: 'Repair and review again.', issues: [{ path: 'records.components.0.x', message: 'Expected canonical scalar.' }] }) }));
    await expect(archiveClient.preview('{}')).rejects.toThrow('Repair and review again. records.components.0.x');
  });
  it('ignores an affected in-flight diagram load after successful import invalidation', async () => {
    const document = generalParentFixture();
    useDiagramStore.getState().startNew();
    let resolve!: (value: typeof document) => void;
    vi.spyOn(diagramClient, 'get').mockImplementation(() => new Promise(done => { resolve = done; }));
    const loading = useDiagramStore.getState().loadSavedDocument(document.id);
    invalidateArchiveDiagrams([document.id]); resolve(document);
    expect(await loading).toBe(false); expect(useDiagramStore.getState().document).toBeNull();
    expect(useDiagramStore.getState().navigationStatus).toBe('idle');
  });
  it('does not reload retained histories or late ADR caches for an affected diagram', async () => {
    const document = generalParentFixture(), other = { ...document, id: 'aaaaaaaa-0000-4000-8000-000000000999' };
    useDiagramStore.getState().open(document);
    useDiagramStore.getState().update(value => ({ ...value, name: 'Retained history' })); useDiagramStore.setState({ status: 'saved' });
    useDiagramStore.getState().open(other, true);
    useAdrStore.getState().startNew(document.id);
    let resolve!: (value: Awaited<ReturnType<typeof adrClient.list>>) => void;
    vi.spyOn(adrClient, 'list').mockImplementation(() => new Promise(done => { resolve = done; }));
    const loading = useAdrStore.getState().load(document.id);
    invalidateArchiveDiagrams([document.id]); invalidateArchiveAdrs([document.id]); resolve([]); await loading;
    expect(useAdrStore.getState().recordsStatus).toBe('idle');
    expect(useDiagramStore.getState().document?.id).toBe(other.id);
    useDiagramStore.getState().open(document, true); expect(useDiagramStore.getState().canUndo).toBe(false);
  });
});
