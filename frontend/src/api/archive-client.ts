import { z } from 'zod';
import { ARCHIVE_MAX_BYTES, ArchiveValidationError, archiveErrorSchema, archiveImportPreviewSchema, archiveImportRequestSchema, archiveImportResultSchema, archivePreviewRequestSchema, archiveUuidSchema, parseArchive, preparedArchiveSchema, type ArchiveErrorBody, type ArchiveImportRequest, type PreparedArchive } from '../../../shared/src/index';

export class ArchiveApiError extends Error {
  constructor(readonly status: number, readonly detail: ArchiveErrorBody) {
    super([detail.message, detail.remedy, ...(detail.issues ?? []).map(issue => `${issue.path}: ${issue.message}`)].join(' '));
  }
}
async function post<T>(path: string, schema: z.ZodType<T>, body?: unknown, commit = false): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, { method: 'POST', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }); }
  catch { throw new Error(commit ? 'Import outcome is uncertain. Inspect saved diagrams before reviewing and trying again.' : 'Could not contact the server. Retry the archive review.'); }
  let value: unknown;
  try { value = await response.json(); }
  catch { throw new Error(commit ? 'Import outcome is uncertain. Inspect saved diagrams before trying again.' : 'The archive response was unreadable. Retry the review.'); }
  if (!response.ok) {
    const error = archiveErrorSchema.safeParse(value);
    if (error.success) throw new ArchiveApiError(response.status, error.data);
    throw new Error(commit ? 'Import outcome is uncertain. Inspect saved diagrams before trying again.' : 'The server could not prepare the archive. Retry the review.');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(commit ? 'Import outcome is uncertain. Inspect saved diagrams before trying again.' : 'The server returned an invalid archive response. Retry the review.');
  return parsed.data;
}
export const archiveClient = {
  prepare: (id: string) => post(`/diagrams/${archiveUuidSchema.parse(id)}/archive`, preparedArchiveSchema),
  preview: (archiveText: string) => post('/diagram-archives/preview', archiveImportPreviewSchema, archivePreviewRequestSchema.parse({ archiveText })),
  import: (request: ArchiveImportRequest) => post('/diagram-archives/import', archiveImportResultSchema, archiveImportRequestSchema.parse(request), true),
};

export async function readArchiveFile(file: File): Promise<string> {
  if (file.size > ARCHIVE_MAX_BYTES) throw new Error('The selected file exceeds 8 MiB. Select a smaller complete archive.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error('The file is not valid UTF-8. Select an original UTF-8 archive.'); }
  if (text.charCodeAt(0) === 0xfeff) throw new Error('UTF-8 BOM is unsupported. Save the archive without a BOM.');
  try { parseArchive(text); }
  catch (error) {
    if (error instanceof ArchiveValidationError) throw new Error([error.message, error.remedy, ...(error.issues ?? []).map(issue => `${issue.path}: ${issue.message}`)].join(' '));
    throw error;
  }
  return text;
}

export function downloadArchive(prepared: PreparedArchive, selectedDiagramId: string): void {
  const id = archiveUuidSchema.parse(selectedDiagramId);
  const url = URL.createObjectURL(new Blob([prepared.archiveText], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `diagram-${id.toLowerCase()}.adr.json`;
  try { document.body.append(anchor); anchor.click(); }
  finally { anchor.remove(); URL.revokeObjectURL(url); }
}
