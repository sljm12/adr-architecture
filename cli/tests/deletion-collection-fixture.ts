import { vi } from 'vitest';
import { buildApp } from '../../backend/src/api/app';
import { collectionDeletionFixture } from '../../backend/tests/component-recovery-fixture';
import { createApiClient } from '../src/api-client';

export async function collectionCliFixture() {
  const fixture = await collectionDeletionFixture();
  const app = buildApp(fixture.repository, fixture.adrs);
  const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  const requests: Array<{ url: string; body: { target: { kind: string; name?: string }; rootDiagramIds?: string[]; confirmationToken?: string } }> = [];
  const stdout = vi.fn(), stderr = vi.fn(), confirm = vi.fn<() => Promise<string | null>>().mockResolvedValue('yes');
  let afterPreview: (() => Promise<void>) | undefined;
  let executionResponse: ((response: Response) => Promise<Response>) | undefined;
  let previewResponse: ((response: Response) => Promise<Response>) | undefined;
  const client = createApiClient({ baseUrl, fetch: async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const response = await fetch(url, init);
    if (String(url).endsWith('-preview')) {
      await afterPreview?.();
      return previewResponse ? previewResponse(response) : response;
    }
    return executionResponse ? executionResponse(response) : response;
  } });
  return { ...fixture, app, client, requests, stdout, stderr, confirm,
    io: { stdout, stderr, confirm, isTTY: true },
    setAfterPreview: (action: typeof afterPreview) => { afterPreview = action; },
    setExecutionResponse: (action: typeof executionResponse) => { executionResponse = action; },
    setPreviewResponse: (action: typeof previewResponse) => { previewResponse = action; },
    output: () => stdout.mock.calls.flat().join(''), errors: () => stderr.mock.calls.flat().join(''),
  };
}
