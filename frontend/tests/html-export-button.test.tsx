import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { captureHtmlExportInput, captureHtmlPackage, getHtmlExportBlockReason, getHtmlExportDraft, runHtmlPackageExport } from '../src/components/ExportButton';
import { exportAdrFixture, exportDiagramFixture } from '../../shared/tests/html-export-fixtures';
import { useAdrStore } from '../src/state/adr-store';
import { adrClient } from '../src/api/adr-client';

describe('interactive HTML package export control', () => {
  it('captures one timestamp and only the active matching draft; duplicate operations are blocked', () => {
    const diagram = exportDiagramFixture(), draft = exportAdrFixture();
    const capture = captureHtmlPackage(diagram, draft);
    diagram.name = 'Later'; draft.title = 'Later';
    expect(capture.entryDiagramId).toBe(diagram.id);
    expect(capture.capturedAt).toMatch(/^\d{4}-/);
    expect(Object.keys(capture.overrides)).toEqual([diagram.id]);
    expect(capture.overrides[diagram.id].draft?.title).not.toBe('Later');
    expect(getHtmlExportBlockReason('saved', 'saved', true)).toMatch(/already|progress/i);
    expect(captureHtmlPackage(diagram, { ...draft, diagramId: crypto.randomUUID() }).overrides[diagram.id].draft).toBeNull();
  });
  it('freezes the current diagram and ADR draft before asynchronous export work', () => {
    const diagram = exportDiagramFixture();
    const draft = { ...exportAdrFixture(), title: 'Unsaved title' };
    const frozen = captureHtmlExportInput(diagram, draft);
    diagram.components[0].name = 'Later diagram edit';
    draft.title = 'Later ADR edit';
    expect(frozen.diagram.components[0].name).toBe('Payments <Core>');
    expect(frozen.draft?.title).toBe('Unsaved title');
  });

  it('blocks only while either artifact save is in progress', () => {
    expect(getHtmlExportBlockReason('saving', 'saved')).toMatch(/saving/i);
    expect(getHtmlExportBlockReason('saved', 'saving')).toMatch(/saving/i);
    expect(getHtmlExportBlockReason('unsaved', 'failed')).toBeNull();
  });
  it('retains the in-flight ADR save marker when editing changes its display status', async () => {
    const record = exportAdrFixture();
    useAdrStore.getState().open(record);
    let release!: (value: typeof record) => void;
    const update = vi.spyOn(adrClient, 'update').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const save = useAdrStore.getState().save();
    useAdrStore.getState().update(d => ({ ...d, title: 'Edited during saving' }));
    expect(useAdrStore.getState().status).toBe('unsaved');
    expect(useAdrStore.getState().savePending).toBe(true);
    release(record); await save;
    expect(useAdrStore.getState().savePending).toBe(false);
    expect(useAdrStore.getState().draft?.title).toBe('Edited during saving');
    update.mockRestore();
  });

  it('ignores the untouched blank new-ADR placeholder while retaining edited and saved drafts', () => {
    const draft = exportAdrFixture();
    expect(getHtmlExportDraft('idle', { ...draft, title: '' }, draft.diagramId)).toBeNull();
    expect(getHtmlExportDraft('unsaved', draft, draft.diagramId)).toEqual(draft);
    expect(getHtmlExportDraft('saved', draft, draft.diagramId)).toEqual(draft);
  });

  it('reports ZIP success and failure from the package downloader', async () => {
    const input = captureHtmlExportInput(exportDiagramFixture(), exportAdrFixture());
    await expect(runHtmlPackageExport(input, vi.fn().mockResolvedValue(undefined))).resolves.toMatchObject({ success: true, message: expect.stringMatching(/download/i) });
    await expect(runHtmlPackageExport(input, vi.fn().mockRejectedValue(new Error('ADR 9 relationshipIds is missing')))).resolves.toMatchObject({ success: false, message: expect.stringContaining('relationshipIds') });
  });

  it('keeps this action separate from Mermaid and does not initiate a diagram or ADR save', () => {
    const source = readFileSync(new URL('../src/components/ExportButton.tsx', import.meta.url), 'utf8');
    expect(source).toContain('exportClient.downloadHtmlPackage');
    expect(source).toContain('exportClient.downloadMermaid');
    expect(source).not.toMatch(/(?:diagram|adr)?Store\.(?:getState\(\)\.)?save\s*\(/i);
    expect(source).toContain('html-export-status');
    expect(source).toContain('role="status"');
  });
});
