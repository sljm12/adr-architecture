import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARCHIVE_MAX_BYTES, parseArchive } from '../../shared/src/index';
import { archiveFixture } from '../../shared/tests/archive-fixtures';
import { archiveClient, downloadArchive, readArchiveFile } from '../src/api/archive-client';
import { ArchiveReviewDialog } from '../src/components/ArchiveReviewDialog';
import { ArchiveService } from '../../backend/src/services/archive-service';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { AdrRepository } from '../../backend/src/persistence/adr-repository';
import { GraphTransaction } from '../../backend/src/persistence/graph-transaction';
import { invalidateArchiveDiagrams, useDiagramStore } from '../src/state/diagram-store';
import { invalidateArchiveAdrs, useAdrStore } from '../src/state/adr-store';
import { generalParentFixture } from '../../shared/tests/container-fixtures';
import { SavedDiagramList } from '../src/components/SavedDiagramList';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('archive client and review', () => {
  it('checks size before read, rejects BOM and invalid UTF-8, retains exact text', async () => {
    const arrayBuffer = vi.fn();
    await expect(readArchiveFile({ size: ARCHIVE_MAX_BYTES + 1, arrayBuffer } as unknown as File)).rejects.toThrow('8 MiB');
    expect(arrayBuffer).not.toHaveBeenCalled();
    for (const bytes of [new Uint8Array([239,187,191,123,125]), new Uint8Array([255])]) {
      await expect(readArchiveFile({ size: bytes.length, arrayBuffer: async () => bytes.buffer } as File)).rejects.toThrow();
    }
    const text = JSON.stringify(archiveFixture(), null, 2) + '\n';
    expect(await readArchiveFile(new Blob([text]) as File)).toBe(text);
  });
  it('downloads only the approved prepared bytes and cleans up the object URL', async () => {
    const diagrams = new DiagramRepository(), adrs = new AdrRepository();
    await new GraphTransaction(diagrams, adrs).applyArchiveRows(parseArchive(JSON.stringify(archiveFixture())).records);
    const prepared = await new ArchiveService(diagrams, adrs).prepare(archiveFixture().selectedDiagramId);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:archive'), revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor, body: { append: vi.fn() } });
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    downloadArchive(prepared, archiveFixture().selectedDiagramId);
    expect(await (create.mock.calls[0][0] as Blob).text()).toBe(prepared.archiveText);
    expect(anchor.download).toBe(`diagram-${archiveFixture().selectedDiagramId}.adr.json`); expect(anchor.click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:archive'); expect(fetch).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(<ArchiveReviewDialog prepared={prepared} onConfirm={() => {}} onCancel={() => {}} />);
    for (const item of prepared.scope) { expect(html).toContain(item.id); expect(html).toContain(item.status); }
    expect(html).toContain('Cancel'); expect(html).toContain('Download archive');
  });
  it('validates responses and forwards the explicit new-only confirmation without retries', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Connection lost')); vi.stubGlobal('fetch', fetch);
    await expect(archiveClient.import({ archiveText: JSON.stringify(archiveFixture()), previewedAt: archiveFixture().exportedAt, previewToken: 'a'.repeat(64), overrideExisting: false, recoverySaved: false, recoveryFileSha256: null })).rejects.toThrow('uncertain');
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0][1].body).overrideExisting).toBe(false);
  });
  it('offers import in an empty library and invalidates only affected histories', () => {
    useDiagramStore.setState({ savedDocuments: [], savedDocumentsStatus: 'loaded' });
    expect(renderToStaticMarkup(<SavedDiagramList onSelect={() => {}} onDelete={() => {}} onCreate={() => {}} />)).toContain('Import diagram archive');
    const diagram = generalParentFixture(); useDiagramStore.getState().open(diagram);
    useDiagramStore.getState().update(d => ({ ...d, name: 'Draft' }));
    useAdrStore.getState().startNew(diagram.id); useAdrStore.getState().update(d => ({ ...d, title: 'Draft ADR' }));
    const current = useDiagramStore.getState().document, draft = useAdrStore.getState().draft;
    invalidateArchiveDiagrams(['aaaaaaaa-0000-4000-8000-000000000999']); invalidateArchiveAdrs(['aaaaaaaa-0000-4000-8000-000000000999']);
    expect(useDiagramStore.getState().document).toBe(current); expect(useDiagramStore.getState().canUndo).toBe(true);
    expect(useAdrStore.getState().draft).toBe(draft); expect(useAdrStore.getState().canUndo).toBe(true);
    invalidateArchiveDiagrams([diagram.id]); invalidateArchiveAdrs([diagram.id]);
    expect(useDiagramStore.getState().document).toBeNull(); expect(useDiagramStore.getState().canUndo).toBe(false); expect(useAdrStore.getState().draft).toBeNull(); expect(useAdrStore.getState().canUndo).toBe(false);
  });
});
