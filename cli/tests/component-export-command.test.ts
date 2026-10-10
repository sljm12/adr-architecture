import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { exportDiagramCommand } from '../src/export-command';
import { renderDiagramTable } from '../src/output';
import { componentPackageInput } from '../../shared/tests/component-package-input';
import { createApiClient } from '../src/api-client';

describe('saved selected Component CLI', () => {
  it('parses Component documents and scoped list summaries through the existing shared API validation', async () => {
    const { child } = componentPackageInput('component');
    const client = createApiClient({ fetch: async url => new Response(JSON.stringify(String(url).endsWith('/diagrams') ? [child] : child)) });
    expect(await client.getDiagram(child.id)).toMatchObject({ kind: 'component', scope: { containerId: (child.scope as any).containerId } });
    expect(await client.listDiagrams()).toMatchObject([{ kind: 'component', scope: { containerId: (child.scope as any).containerId } }]);
  });
  it('exports only the selected saved document and local ADRs and labels its scope', async () => {
    const { child, source } = componentPackageInput('component'); let bytes: any;
    const client = { getDiagram: vi.fn(async () => child), listFullAdrs: vi.fn(async () => source.diagrams[0].adrs) };
    await exportDiagramCommand(client, child.id, 'component.zip', { statPath: async () => ({ isDirectory: () => true }), openFile: async () => ({ writeFile: async b => { bytes = b; }, close: async () => {} }) as any, write: () => {} });
    const zip = await JSZip.loadAsync(bytes); expect(Object.keys(zip.files).some(p => p.startsWith('diagrams/'))).toBe(false);
    expect(await zip.file('index.html')!.async('string')).toContain('Component diagram');
    expect(client.getDiagram).toHaveBeenCalledExactlyOnceWith(child.id);
    expect(renderDiagramTable([child as any])).toContain('Component');
    expect(renderDiagramTable([child as any])).toContain((child.scope as any).containerId);
  });
  it('keeps exclusive-create overwrite behavior', async () => {
    const { child } = componentPackageInput('component');
    await expect(exportDiagramCommand({ getDiagram: async () => child, listFullAdrs: async () => [] }, child.id, 'existing.zip', { statPath: async () => ({ isDirectory: () => true }), openFile: async () => { throw Object.assign(new Error('exists'), { code: 'EEXIST' }); } })).rejects.toThrow(/already exists.*not changed/);
  });
});
