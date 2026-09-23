import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { captureHtmlExportInput, getHtmlExportBlockReason, getHtmlExportDraft, runHtmlPackageExport } from '../src/components/ExportButton';
import { exportAdrFixture, exportDiagramFixture } from '../../shared/tests/html-export-fixtures';

describe('interactive HTML package export control', () => {
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
