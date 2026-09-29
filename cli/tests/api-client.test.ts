import { describe, expect, it, vi } from 'vitest';
import { createApiClient, getApiBaseUrl } from '../src/api-client';

const diagramId = '00000000-0000-4000-8000-000000000001';
const summary = { id: diagramId, name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' };
const diagram = { ...summary, trashedAt: null, components: [], relationships: [], groups: [] };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('API client', () => {
  it('uses the default and configured service URL', () => {
    expect(getApiBaseUrl({})).toBe('http://localhost:3000');
    expect(getApiBaseUrl({ ADR_DIAGRAM_API_URL: 'https://diagram.example/api/' })).toBe('https://diagram.example/api');
  });

  it('rejects non-absolute, non-HTTP, or URL values with query and fragment', () => {
    for (const value of ['relative/path', 'file:///tmp/api', 'http://localhost:3000/?x=1', 'http://localhost:3000/#x']) {
      expect(() => getApiBaseUrl({ ADR_DIAGRAM_API_URL: value })).toThrow(/ADR_DIAGRAM_API_URL/);
    }
  });

  it('requests diagram summaries, a saved document, and the full ADR list with GET', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response([summary]))
      .mockResolvedValueOnce(response(diagram))
      .mockResolvedValueOnce(response([]));
    const client = createApiClient({ baseUrl: 'http://localhost:3000/', fetch: fetcher });

    await expect(client.listDiagrams()).resolves.toEqual([summary]);
    await expect(client.getDiagram(diagramId)).resolves.toMatchObject({ id: diagramId });
    await expect(client.listFullAdrs(diagramId)).resolves.toEqual([]);
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['http://localhost:3000/diagrams', 'GET'],
      [`http://localhost:3000/diagrams/${diagramId}`, 'GET'],
      [`http://localhost:3000/diagrams/${diagramId}/adrs/full`, 'GET'],
    ]);
  });

  it('reports HTTP errors with status and service detail', async () => {
    const client = createApiClient({ fetch: vi.fn().mockResolvedValue(response({ message: 'Diagram not found' }, 404)) });
    await expect(client.getDiagram(diagramId)).rejects.toThrow(/404.*Diagram not found/);
  });

  it('reports network failures with service context', async () => {
    const client = createApiClient({ baseUrl: 'http://service.test', fetch: vi.fn().mockRejectedValue(new Error('connection refused')) });
    await expect(client.listDiagrams()).rejects.toThrow(/http:\/\/service\.test.*connection refused/);
  });

  it('rejects malformed payloads from each endpoint', async () => {
    const client = createApiClient({ fetch: vi.fn().mockResolvedValueOnce(response([{ ...summary, id: 'bad' }])) });
    await expect(client.listDiagrams()).rejects.toThrow(/invalid response/i);
  });
});
