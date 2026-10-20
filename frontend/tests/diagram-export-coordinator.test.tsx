import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiagramExportHandler } from '../src/components/DiagramExportCoordinator';
import { exportClient } from '../src/api/export-client';
import { useDiagramStore } from '../src/state/diagram-store';
import { useAdrStore } from '../src/state/adr-store';
import { exportAdrFixture, exportDiagramFixture } from '../../shared/tests/html-export-fixtures';

describe('sidebar export coordinator', () => {
  beforeEach(() => {
    useDiagramStore.getState().startNew();
    useAdrStore.getState().clear();
    useDiagramStore.getState().open(exportDiagramFixture());
    useDiagramStore.setState({ savePending: false });
    useAdrStore.setState({ savePending: false });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['html', 'mermaid'] as const)('exports an unopened %s target without touching the open draft or history', async format => {
    useDiagramStore.getState().update(d => ({ ...d, name: 'Current unsaved edit' }));
    useAdrStore.getState().open(exportAdrFixture());
    useAdrStore.getState().update(d => ({ ...d, title: 'Current ADR draft' }));
    const before = useDiagramStore.getState(), adrBefore = useAdrStore.getState();
    const target = crypto.randomUUID(), report = vi.fn();
    const html = vi.spyOn(exportClient, 'downloadHtmlPackage').mockResolvedValue();
    const mermaid = vi.spyOn(exportClient, 'downloadMermaid').mockResolvedValue();
    await createDiagramExportHandler(report)({ id: target, name: 'Unopened target', format });
    if (format === 'html') {
      expect(html.mock.calls[0][0]).toMatchObject({ entryDiagramId: target, overrides: {
        [before.document!.id]: { diagram: { name: 'Current unsaved edit' }, draft: { title: 'Current ADR draft' } },
      } });
    } else expect(mermaid).toHaveBeenCalledWith(target);
    expect(useDiagramStore.getState()).toBe(before);
    expect(useAdrStore.getState()).toBe(adrBefore);
    expect(report.mock.lastCall?.[1]).toMatch(/^Unopened target: .*\b(downloaded|Exported)\b/);
  });

  it.each(['unsaved', 'failed', 'saving'] as const)('blocks Mermaid for the current %s target only', async status => {
    useDiagramStore.setState({ status });
    const download = vi.spyOn(exportClient, 'downloadMermaid').mockResolvedValue(), report = vi.fn();
    const run = createDiagramExportHandler(report);
    await run({ id: useDiagramStore.getState().document!.id, name: 'Current', format: 'mermaid' });
    expect(download).not.toHaveBeenCalled();
    expect(report.mock.lastCall?.[1]).toMatch(/Current: .*sav/i);
    await run({ id: crypto.randomUUID(), name: 'Other', format: 'mermaid' });
    expect(download).toHaveBeenCalledOnce();
  });

  it.each(['diagram', 'adr'] as const)('blocks HTML while %s saving remains pending after another edit', async saving => {
    if (saving === 'diagram') useDiagramStore.setState({ savePending: true, status: 'unsaved' });
    else useAdrStore.setState({ savePending: true, status: 'unsaved' });
    const download = vi.spyOn(exportClient, 'downloadHtmlPackage').mockResolvedValue(), report = vi.fn();
    await createDiagramExportHandler(report)({ id: crypto.randomUUID(), name: 'Target', format: 'html' });
    expect(download).not.toHaveBeenCalled();
    expect(report.mock.lastCall?.[1]).toContain('Wait for diagram or ADR saving');
  });

  it('captures HTML drafts before waiting, prevents duplicates, and allows retry after failure', async () => {
    let reject!: (error: Error) => void;
    const download = vi.spyOn(exportClient, 'downloadHtmlPackage').mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    const report = vi.fn(), run = createDiagramExportHandler(report);
    const request = { id: useDiagramStore.getState().document!.id, name: 'Target', format: 'html' as const };
    const pending = run(request);
    useDiagramStore.getState().update(d => ({ ...d, name: 'Later edit' }));
    expect(download.mock.calls[0][0]).toMatchObject({ overrides: { [request.id]: { diagram: { name: exportDiagramFixture().name } } } });
    await run(request);
    expect(download).toHaveBeenCalledOnce();
    expect(report.mock.lastCall?.[1]).toContain('already in progress');
    reject(new Error('Repair the missing source and retry.')); await pending;
    expect(report.mock.lastCall?.[1]).toBe('Target: Repair the missing source and retry.');
    download.mockResolvedValue(); await run(request);
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('exports saved HTML sources with no open canvas', async () => {
    useDiagramStore.getState().startNew();
    const download = vi.spyOn(exportClient, 'downloadHtmlPackage').mockResolvedValue();
    const id = crypto.randomUUID();
    await createDiagramExportHandler(vi.fn())({ id, name: 'Saved', format: 'html' });
    expect(download.mock.calls[0][0]).toMatchObject({ entryDiagramId: id, overrides: {} });
  });
});
