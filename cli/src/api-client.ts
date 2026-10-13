import {
  architectureDecisionRecordListSchema,
  diagramDocumentSchema,
  diagramSummaryListSchema,
  deletionPreviewSchema, deletionConfirmationSchema, deletionImpactSchema, deletionResultSchema, deletionErrorSchema, uuidSchema,
  type DeletionPreview, type DeletionConfirmation, type DeletionError,
  collectionPreviewSchema, collectionConfirmationSchema, collectionImpactSchema, collectionResultSchema,
  type CollectionPreview, type CollectionImpact,
} from '../../shared/src/validation/schemas.js';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class ApiClientError extends Error {
  detail?: DeletionError;
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

  const uncertain = () => new ApiClientError('Deletion outcome is uncertain. Verify the saved active/Trash state in the application before retrying; this command will not retry automatically.');
  async function postDeletion(path: string, payload: unknown, executing: boolean): Promise<unknown> {
    let response: Response;
    try { response = await fetcher(`${baseUrl}${path}`, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(payload) }); }
    catch { throw executing ? uncertain() : new ApiClientError(`Could not reach ADR Diagram service at ${baseUrl}. Check service availability and request a new preview.`); }
    let body: unknown;
    try { body = await response.json(); } catch { body = undefined; }
    if (!response.ok) {
      const detail = deletionErrorSchema.safeParse(body);
      const error = new ApiClientError(detail.success ? `HTTP ${response.status}: ${detail.data.message} ${detail.data.remedy}` : `ADR Diagram service rejected deletion with HTTP ${response.status}. Check the service and request a fresh preview.`);
      if (detail.success) error.detail = detail.data;
      throw error;
    }
    if (body === undefined) throw executing ? uncertain() : new ApiClientError('ADR Diagram service returned an invalid preview. Request a new preview.');
    return body;
  }

  return {
    async previewCollectionDeletion(input: CollectionPreview) {
      const request = collectionPreviewSchema.parse(input);
      const target = request.target;
      const impact = parse(await postDeletion('/diagrams/deletion-set-preview', request, false), collectionImpactSchema, `${baseUrl}/diagrams/deletion-set-preview`);
      if (JSON.stringify(impact.target) !== JSON.stringify(target) || (target.kind === 'all-matches' && impact.rootDiagramIds.some(id => impact.affectedDiagrams.find(d => d.id === id)?.name !== target.name))) throw new ApiClientError('Deletion preview identity or mode does not match the request. Request a new preview.');
      return impact;
    },
    async executeCollectionDeletion(preview: CollectionImpact) {
      const reviewed = collectionImpactSchema.parse(preview);
      const confirmation = collectionConfirmationSchema.parse({ target: reviewed.target, rootDiagramIds: reviewed.rootDiagramIds, confirmationToken: reviewed.confirmationToken });
      const body = await postDeletion('/diagrams/deletion-set', confirmation, true);
      const result = collectionResultSchema.safeParse(body);
      const { confirmationToken: _token, ...expected } = reviewed;
      if (!result.success || JSON.stringify(result.data) !== JSON.stringify(expected)) throw uncertain();
      return result.data;
    },
    async previewDeletion(input: DeletionPreview) {
      const request = deletionPreviewSchema.parse(input);
      const impact = parse(await postDeletion('/diagrams/deletion-preview', request, false), deletionImpactSchema, `${baseUrl}/diagrams/deletion-preview`);
      if (impact.mode !== request.mode || ('id' in request.selector ? impact.rootDiagramId !== request.selector.id : impact.affectedDiagrams[0].name !== request.selector.name)) throw new ApiClientError('Deletion preview identity or mode does not match the request. Request a new preview.');
      return impact;
    },
    async executeDeletion(id: string, input: DeletionConfirmation) {
      uuidSchema.parse(id); const confirmation = deletionConfirmationSchema.parse(input);
      const body = await postDeletion(`/diagrams/${encodeURIComponent(id)}/deletion`, confirmation, true);
      const result = deletionResultSchema.safeParse(body);
      if (!result.success || result.data.rootDiagramId !== id || result.data.mode !== confirmation.mode) throw uncertain();
      return result.data;
    },
    async listDiagrams() {
      const path = '/diagrams';
      return parse(await getJson(path), diagramSummaryListSchema, `${baseUrl}${path}`);
    },
    async getDiagram(diagramId: string) {
      const path = `/diagrams/${encodeURIComponent(diagramId)}`;
      const document = parse(await getJson(path), diagramDocumentSchema, `${baseUrl}${path}`);
      if (document.id !== diagramId) throw new ApiClientError('ADR Diagram service returned a diagram identity that does not match the requested saved diagram.');
      return document;
    },
    async listFullAdrs(diagramId: string) {
      const path = `/diagrams/${encodeURIComponent(diagramId)}/adrs/full`;
      return parse(await getJson(path), architectureDecisionRecordListSchema, `${baseUrl}${path}`);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
