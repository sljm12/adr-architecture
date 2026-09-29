import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportAdrsFixture, exportDiagramFixture, exportIds } from '../../shared/tests/html-export-fixtures';
import { runCli, type CliIo } from '../src/main';

const directories: string[] = [];
async function temporaryDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'adr-cli-main-'));
  directories.push(dir);
  return dir;
}
afterEach(async () => Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))));

function io() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, streams: { stdout: (text: string) => stdout.push(text), stderr: (text: string) => stderr.push(text) } satisfies CliIo };
}

const summary = { id: exportIds.diagram, name: 'Payments & Ledger', status: 'active' as const, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const client = () => ({
  listDiagrams: vi.fn().mockResolvedValue([summary]),
  getDiagram: vi.fn().mockResolvedValue(exportDiagramFixture()),
  listFullAdrs: vi.fn().mockResolvedValue(exportAdrsFixture()),
});

describe('CLI help and process contract', () => {
  it('prints global and diagrams help to stdout without contacting the service', async () => {
    for (const args of [['--help'], ['diagrams', '--help']]) {
      const streams = io();
      const result = await runCli(args, streams.streams);
      expect(result).toBe(0);
      expect(streams.stdout.join('')).toMatch(/diagrams list/);
      expect(streams.stdout.join('')).toMatch(/diagrams export/);
      expect(streams.stdout.join('')).toMatch(/ADR_DIAGRAM_API_URL/);
      expect(streams.stderr).toEqual([]);
    }
  });

  it('sends successful table and JSON results only to stdout', async () => {
    const service = client();
    const table = io();
    expect(await runCli(['diagrams', 'list'], table.streams, service)).toBe(0);
    expect(table.stdout.join('')).toContain(summary.id);
    expect(table.stderr).toEqual([]);
    const json = io();
    expect(await runCli(['diagrams', 'list', '--format', 'json'], json.streams, service)).toBe(0);
    expect(JSON.parse(json.stdout.join(''))).toEqual([summary]);
    expect(json.stderr).toEqual([]);
  });

  it('returns operational errors as exit 1 on stderr and usage errors as exit 2', async () => {
    const failed = io();
    expect(await runCli(['diagrams', 'list'], failed.streams, { listDiagrams: async () => { throw new Error('service offline'); } } as never)).toBe(1);
    expect(failed.stdout).toEqual([]);
    expect(failed.stderr.join('')).toContain('service offline');
    const invalid = io();
    expect(await runCli(['diagrams', 'list', '--format', 'xml'], invalid.streams, client())).toBe(2);
    expect(invalid.stdout).toEqual([]);
    expect(invalid.stderr.join('')).toContain('--format must be table or json');
  });

  it('exports a selected persisted diagram and returns success only after writing', async () => {
    const dir = await temporaryDirectory();
    const streams = io();
    const service = client();
    expect(await runCli(['diagrams', 'export', exportIds.diagram, '--output', join(dir, 'diagram.zip')], streams.streams, service)).toBe(0);
    expect(streams.stdout.join('')).toContain('diagram.zip');
    expect(streams.stderr).toEqual([]);
    expect(service.getDiagram).toHaveBeenCalledWith(exportIds.diagram);
    expect(service.listFullAdrs).toHaveBeenCalledWith(exportIds.diagram);
  });
});
