import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ArchiveReviewDialog } from '../src/components/ArchiveReviewDialog';
import { ArchiveService } from '../../backend/src/services/archive-service';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { AdrRepository } from '../../backend/src/persistence/adr-repository';
import { GraphTransaction } from '../../backend/src/persistence/graph-transaction';
import { archiveFixture } from '../../shared/tests/archive-fixtures';
import { parseArchive } from '../../shared/src/index';
import { downloadArchive } from '../src/api/archive-client';
import { invalidateArchiveAdrs, useAdrStore } from '../src/state/adr-store';
import { adrClient } from '../src/api/adr-client';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('replacement review', () => {
  it('lists every change and starts override and recovery acknowledgement unchecked with safe cancellation', async () => {
    const diagrams = new DiagramRepository(), adrs = new AdrRepository(), fixture = parseArchive(JSON.stringify(archiveFixture()));
    await new GraphTransaction(diagrams, adrs).applyArchiveRows(fixture.records);
    fixture.records.components[0].description = 'New content';
    const preview = await new ArchiveService(diagrams, adrs).preview(JSON.stringify(fixture));
    const html = renderToStaticMarkup(<ArchiveReviewDialog preview={preview} onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('Download recovery archive'); expect(html).toContain('I saved the recovery file'); expect(html).toContain('Approve override');
    expect(html).not.toContain('checked=""'); expect(html).toContain('disabled=""');
    expect(html.indexOf('Cancel')).toBeLessThan(html.indexOf('Import archive'));
    for (const change of preview.changes) for (const id of change.identity) expect(html).toContain(id);
    expect(html).toContain('keeps newly added diagrams');
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recovery'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('document', { createElement: () => anchor, body: { append: vi.fn() } });
    downloadArchive(preview.recovery!, fixture.selectedDiagramId);
    expect(anchor.download).toMatch(/^recovery-.*\.adr\.json$/); expect(anchor.click).toHaveBeenCalledOnce();
  });

  it('does not resurrect an affected ADR selection response after invalidation', async () => {
    const fixture = archiveFixture(), diagramId = fixture.records.diagrams[0].id;
    let resolve!: (value: Awaited<ReturnType<typeof adrClient.get>>) => void;
    vi.spyOn(adrClient, 'get').mockImplementation(() => new Promise(done => { resolve = done; }));
    useAdrStore.getState().startNew(diagramId);
    const pending = useAdrStore.getState().select(fixture.records.adrs[0].id);
    invalidateArchiveAdrs([diagramId]);
    resolve({ ...fixture.records.adrs[0], status: 'draft', componentIds: [], relationshipIds: [] });
    await pending;
    expect(useAdrStore.getState().draft).toBeNull();
  });
});
