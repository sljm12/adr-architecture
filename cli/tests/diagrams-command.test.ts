import { describe, expect, it, vi } from 'vitest';
import { listDiagramsCommand } from '../src/diagrams-command';

const rows = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Payments API', status: 'active' as const, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Payments API', status: 'active' as const, createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-02T00:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Identity', status: 'active' as const, createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-02T00:00:00Z' },
];
const client = { listDiagrams: vi.fn().mockResolvedValue(rows) };

describe('diagrams list command', () => {
  it('shows all summary fields and keeps duplicate names distinguishable by ID', async () => {
    const output = vi.fn();
    await listDiagramsCommand(client, { write: output });
    expect(output.mock.calls[0][0]).toContain('ID');
    expect(output.mock.calls[0][0]).toContain('Payments API');
    expect(output.mock.calls[0][0]).toContain(rows[0].id);
    expect(output.mock.calls[0][0]).toContain(rows[1].id);
    expect(output.mock.calls[0][0]).toContain(rows[0].createdAt);
    expect(output.mock.calls[0][0]).toContain(rows[0].updatedAt);
  });

  it('trims and case-insensitively filters names', async () => {
    const output = vi.fn();
    await listDiagramsCommand(client, { name: '  pAyMeNtS  ', write: output });
    expect(output.mock.calls[0][0]).toContain(rows[0].id);
    expect(output.mock.calls[0][0]).toContain(rows[1].id);
    expect(output.mock.calls[0][0]).not.toContain(rows[2].id);
  });

  it('treats an empty filter as no filter', async () => {
    const output = vi.fn();
    await listDiagramsCommand(client, { name: '  ', write: output });
    expect(output.mock.calls[0][0]).toContain(rows[2].id);
  });

  it('emits JSON array output', async () => {
    const output = vi.fn();
    await listDiagramsCommand(client, { format: 'json', write: output });
    expect(JSON.parse(output.mock.calls[0][0])).toEqual(rows);
  });

  it('returns successful empty states for an empty service result or unmatched filter', async () => {
    const output = vi.fn();
    await listDiagramsCommand({ listDiagrams: async () => [] }, { write: output });
    expect(output.mock.calls[0][0]).toMatch(/no active diagrams/i);
    await listDiagramsCommand(client, { name: 'missing', write: output });
    expect(output.mock.calls[1][0]).toMatch(/no diagrams match/i);
  });
});
