import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagramClient } from '../src/api/diagram-client';
import { generalParentFixture } from '../../shared/tests/container-fixtures';

afterEach(() => { vi.unstubAllGlobals(); });
describe('recovery token forwarding', () => {
  it('sends complete trash and restore confirmations', async () => {
    const document = generalParentFixture(), impactToken = 'a'.repeat(64);
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(JSON.stringify(document), { status: 200 })); vi.stubGlobal('fetch', fetch);
    await diagramClient.trash(document.id, { confirmedDiagramIds: [document.id], impactToken });
    await diagramClient.restore(document.id, { confirmedDiagramIds: [document.id], confirmedTrashBatchId: null, impactToken });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ confirmedDiagramIds: [document.id], impactToken });
    expect(JSON.parse(fetch.mock.calls[1][1].body).impactToken).toBe(impactToken);
  });
  it('rejects impact responses without a token before presenting a confirmation', async () => {
    const document = generalParentFixture();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ diagramId: document.id, affectedDiagramIds: [document.id], affectedDiagrams: [document] }), { status: 200 })));
    await expect(diagramClient.trashImpact(document.id)).rejects.toThrow();
  });
});
