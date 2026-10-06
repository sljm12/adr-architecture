import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { exportDiagramCommand } from '../src/export-command';
import { populatedChildFixture, emptyChildFixture } from '../../shared/tests/container-fixtures';
import { buildHtmlPackage, type DiagramDocument } from '../../shared/src/index';
import { captureHtmlExportInput } from '../../frontend/src/components/ExportButton';

describe('saved container CLI package', () => {
  it.each(['application', 'datastore', 'empty'] as const)('packages %s without parent requests', async subtype => {
    const diagram = (subtype === 'empty' ? emptyChildFixture() : populatedChildFixture()) as unknown as DiagramDocument;
    diagram.name = 'Saved runtime'; if (subtype !== 'empty') diagram.components[0].containerType = subtype;
    let bytes: any;
    const client = { getDiagram: vi.fn(async () => diagram), listFullAdrs: vi.fn(async () => []) };
    await exportDiagramCommand(client, diagram.id, 'runtime.zip', { statPath: async () => ({ isDirectory: () => true }), openFile: async () => ({ writeFile: async b => { bytes = b; }, close: async () => {} }) as any, write: () => {} });
    const zip = await JSZip.loadAsync(bytes), page = await zip.file('index.html')!.async('string');
    expect(page).toContain('Saved runtime'); expect(page).toContain(diagram.scope!.parentDiagramId); expect(page).toContain('system-boundary');
    if (subtype !== 'empty') expect(page).toContain(subtype === 'application' ? 'Application' : 'Datastore');
    if (subtype === 'application') {
      const draft = structuredClone(diagram); draft.components[0].containerType = 'datastore';
      const browserPage = buildHtmlPackage(captureHtmlExportInput(draft, null))['index.html'];
      expect(browserPage).toContain('Datastore'); expect(page).not.toContain('Datastore');
    }
    expect(client.getDiagram).toHaveBeenCalledExactlyOnceWith(diagram.id);
    expect(client.listFullAdrs).toHaveBeenCalledExactlyOnceWith(diagram.id);
    expect(Object.keys(zip.files).filter(path => !zip.files[path].dir).sort()).toEqual(['adrs.html', 'diagram.svg', 'index.html', 'styles.css']);
    expect(page).not.toContain('Return to System context</a>');
  });
  it.each(['subtype', 'endpoint', 'scope'] as const)('does not open an output file for invalid %s', async invalid => {
    const diagram = populatedChildFixture() as unknown as DiagramDocument;
    if (invalid === 'subtype') delete diagram.components[0].containerType;
    if (invalid === 'endpoint') diagram.relationships[0].targetComponentId = crypto.randomUUID();
    if (invalid === 'scope') diagram.scope = null;
    const openFile = vi.fn();
    await expect(exportDiagramCommand({ getDiagram: async () => diagram, listFullAdrs: async () => [] }, diagram.id, 'bad.zip', { statPath: async () => ({ isDirectory: () => true }), openFile })).rejects.toThrow();
    expect(openFile).not.toHaveBeenCalled();
  });
});
