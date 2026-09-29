import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportAdrsFixture, exportDiagramFixture, exportIds } from '../../shared/tests/html-export-fixtures';
import { exportDiagramCommand } from '../src/export-command';

const tempDirs: string[] = [];
async function newTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'adr-cli-'));
  tempDirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

function fakeClient() {
  return {
    getDiagram: vi.fn().mockResolvedValue(exportDiagramFixture()),
    listFullAdrs: vi.fn().mockResolvedValue(exportAdrsFixture()),
  };
}

describe('diagrams export command', () => {
  it('builds a compatible ZIP from the persisted diagram and complete ADR response', async () => {
    const dir = await newTempDir();
    const output = vi.fn();
    const client = fakeClient();
    await exportDiagramCommand(client, exportIds.diagram, join(dir, 'architecture.zip'), { write: output });

    const zip = await JSZip.loadAsync(await readFile(join(dir, 'architecture.zip')));
    expect(Object.keys(zip.files).filter(path => !zip.files[path].dir).sort()).toEqual([
      'adrs.html', `adrs/${exportIds.adr}.md`, `adrs/${exportIds.relationshipAdr}.md`, `adrs/${exportIds.unlinkedAdr}.md`,
      'diagram.svg', 'index.html', 'styles.css',
    ].sort());
    expect(await zip.file('adrs.html')!.async('string')).toContain(exportIds.unlinkedAdr);
    expect(await zip.file(`adrs/${exportIds.relationshipAdr}.md`)!.async('string')).toContain(exportIds.relationship);
    expect(client.getDiagram).toHaveBeenCalledWith(exportIds.diagram);
    expect(client.listFullAdrs).toHaveBeenCalledWith(exportIds.diagram);
    expect(output.mock.calls[0][0]).toContain('architecture.zip');
  });

  it('rejects invalid IDs, missing diagrams, mismatched data, and package validation errors', async () => {
    const dir = await newTempDir();
    const path = join(dir, 'bad.zip');
    await expect(exportDiagramCommand(fakeClient(), 'bad-id', path)).rejects.toThrow(/UUID/i);
    await expect(exportDiagramCommand({ ...fakeClient(), getDiagram: async () => { throw new Error('HTTP 404: not found'); } }, exportIds.diagram, path)).rejects.toThrow(/404/);
    const mismatched = { ...fakeClient(), getDiagram: async () => ({ ...exportDiagramFixture(), id: exportIds.otherDiagram }) };
    await expect(exportDiagramCommand(mismatched, exportIds.diagram, path)).rejects.toThrow(/does not match/);
    const unsupported = exportDiagramFixture();
    unsupported.components[2].type = 'legacy';
    await expect(exportDiagramCommand({ ...fakeClient(), getDiagram: async () => unsupported }, exportIds.diagram, path)).rejects.toThrow(/Unsupported component type/);
    await expect(readFile(path)).rejects.toThrow();
  });

  it('preserves an existing destination and rejects invalid extension or missing parent', async () => {
    const dir = await newTempDir();
    const path = join(dir, 'existing.zip');
    await writeFile(path, 'original');
    await expect(exportDiagramCommand(fakeClient(), exportIds.diagram, path)).rejects.toThrow(/already exists|EEXIST/i);
    expect(await readFile(path, 'utf8')).toBe('original');
    await expect(exportDiagramCommand(fakeClient(), exportIds.diagram, join(dir, 'wrong.txt'))).rejects.toThrow(/\.zip/);
    await expect(exportDiagramCommand(fakeClient(), exportIds.diagram, join(dir, 'missing', 'out.zip'))).rejects.toThrow(/directory/i);
  });

  it('removes an incomplete file and fails when the write fails', async () => {
    const dir = await newTempDir();
    const path = join(dir, 'failed.zip');
    const realOpen = await import('node:fs/promises').then(module => module.open);
    const openFile = vi.fn(async (filePath: string, flags: string) => {
      const handle = await realOpen(filePath, flags as 'wx');
      return Object.assign(handle, { writeFile: async () => { throw new Error('disk full'); } });
    });
    await expect(exportDiagramCommand(fakeClient(), exportIds.diagram, path, { openFile: openFile as never })).rejects.toThrow(/disk full/);
    expect(openFile).toHaveBeenCalledOnce();
    await expect(readFile(path)).rejects.toThrow();
  });
});
