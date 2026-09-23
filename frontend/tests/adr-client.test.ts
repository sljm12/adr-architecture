import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdrApiError, adrClient } from '../src/api/adr-client';
import { exportAdrFixture, exportIds } from '../../shared/tests/html-export-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('full ADR list client', () => {
  it('fetches and validates the complete records and artifact links', async () => {
    const adr = exportAdrFixture();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [adr] });
    vi.stubGlobal('fetch', fetchMock);

    await expect(adrClient.listFull(exportIds.diagram)).resolves.toEqual([adr]);
    expect(fetchMock).toHaveBeenCalledWith(`/api/diagrams/${exportIds.diagram}/adrs/full`);
  });

  it('surfaces API failures and rejects invalid response records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ message: 'Diagram not found' }) }));
    await expect(adrClient.listFull(exportIds.diagram)).rejects.toBeInstanceOf(AdrApiError);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'not-a-uuid' }] }));
    await expect(adrClient.listFull(exportIds.diagram)).rejects.toThrow();
  });
});
