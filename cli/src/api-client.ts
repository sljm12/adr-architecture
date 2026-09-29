import {
  architectureDecisionRecordListSchema,
  diagramDocumentSchema,
  diagramSummaryListSchema,
} from '../../shared/src/validation/schemas.js';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class ApiClientError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiClientError';
  }
}

export function getApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.ADR_DIAGRAM_API_URL?.trim() || 'http://localhost:3000';
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new ApiClientError(`ADR_DIAGRAM_API_URL must be an absolute HTTP or HTTPS URL: ${String(cause)}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ApiClientError('ADR_DIAGRAM_API_URL must be an HTTP or HTTPS URL without credentials, query, or fragment.');
  }
  return url.toString().replace(/\/$/, '');
}

export function createApiClient(options: { baseUrl?: string; fetch?: FetchLike } = {}) {
  const baseUrl = (options.baseUrl ?? getApiBaseUrl()).replace(/\/$/, '');
  const fetcher = options.fetch ?? globalThis.fetch;

  async function getJson(path: string): Promise<unknown> {
    const url = `${baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetcher(url, { method: 'GET', headers: { accept: 'application/json' } });
    } catch (cause) {
      throw new ApiClientError(`Could not reach ADR Diagram service at ${baseUrl}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    if (!response.ok) {
      const detail = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? `: ${body.message}`
        : '';
      throw new ApiClientError(`ADR Diagram service returned HTTP ${response.status}${detail}`);
    }
    if (body === undefined) throw new ApiClientError(`ADR Diagram service returned an invalid response from ${url}: expected JSON.`);
    return body;
  }

  function parse<T>(data: unknown, schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } }, url: string): T {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    const fields = result.error.issues.slice(0, 5).map(issue => `${issue.path.map(String).join('.') || 'response'}: ${issue.message}`).join('; ');
    throw new ApiClientError(`ADR Diagram service returned an invalid response from ${url}: ${fields}`);
  }

  return {
    async listDiagrams() {
      const path = '/diagrams';
      return parse(await getJson(path), diagramSummaryListSchema, `${baseUrl}${path}`);
    },
    async getDiagram(diagramId: string) {
      const path = `/diagrams/${encodeURIComponent(diagramId)}`;
      return parse(await getJson(path), diagramDocumentSchema, `${baseUrl}${path}`);
    },
    async listFullAdrs(diagramId: string) {
      const path = `/diagrams/${encodeURIComponent(diagramId)}/adrs/full`;
      return parse(await getJson(path), architectureDecisionRecordListSchema, `${baseUrl}${path}`);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
