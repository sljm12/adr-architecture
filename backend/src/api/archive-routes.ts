import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ArchiveValidationError, archiveImportRequestSchema, archivePreviewRequestSchema, archiveUuidSchema, type ArchiveErrorBody } from '../../../shared/src/index';
import { ArchiveOperationError, type ArchiveService } from '../services/archive-service';

export function registerArchiveRoutes(app: FastifyInstance, service: ArchiveService) {
  app.register(async archive => {
    archive.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
    archive.setErrorHandler((error, _request, reply) => {
      let status = 500;
      let body: ArchiveErrorBody = { code: 'ARCHIVE_FAILED', message: 'Archive operation failed.', remedy: 'No successful import was confirmed. Inspect saved data before retrying.' };
      if (error instanceof ArchiveOperationError) { status = error.status; body = { code: error.code, message: error.message, remedy: error.remedy }; }
      else if (error instanceof ArchiveValidationError) {
        status = error.code === 'ARCHIVE_TOO_LARGE' ? 413 : error.code === 'ARCHIVE_JSON_INVALID' ? 400 : 422;
        body = { code: error.code, message: error.message, remedy: 'Repair the indicated file or saved fields and review again.', issues: error.issues };
      } else if (error instanceof ZodError) {
        status = 400; body = { code: 'ARCHIVE_REQUEST_INVALID', message: 'Invalid archive request.', remedy: 'Use the documented request fields and review again.', issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: 'Invalid or unexpected request field.' })) };
      } else if (error instanceof Error && 'code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        status = 413; body = { code: 'ARCHIVE_TOO_LARGE', message: 'Archive request exceeds the body limit.', remedy: 'Select an archive of at most 8 MiB.' };
      } else if (error instanceof Error && 'code' in error && error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
        status = 415; body = { code: 'ARCHIVE_MEDIA_TYPE', message: 'Unsupported archive request media type.', remedy: 'Send application/json.' };
      } else if (error instanceof Error && 'statusCode' in error && error.statusCode === 400) {
        status = 400; body = { code: 'ARCHIVE_JSON_INVALID', message: 'Malformed JSON request.', remedy: 'Send a valid JSON request envelope.' };
      }
      return reply.code(status).send(body);
    });
    archive.post<{ Params: { diagramId: string } }>('/diagrams/:diagramId/archive', async request => {
      const id = archiveUuidSchema.parse(request.params.diagramId);
      if (request.body !== undefined) throw new ArchiveOperationError(400, 'ARCHIVE_REQUEST_INVALID', 'Export does not accept a request body.', 'Select a saved diagram without a body.');
      return service.prepare(id);
    });
    archive.post('/diagram-archives/preview', { bodyLimit: 24 * 1024 * 1024 }, async request => service.preview(archivePreviewRequestSchema.parse(request.body).archiveText));
    archive.post('/diagram-archives/import', { bodyLimit: 24 * 1024 * 1024 }, async request => service.import(archiveImportRequestSchema.parse(request.body)));
  });
}
