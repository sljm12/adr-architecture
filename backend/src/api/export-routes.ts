import type { FastifyInstance } from 'fastify';
import { ExportNotFoundError, ExportService, MermaidExportError } from '../services/export-service';
import { sendError } from './errors';
import { HtmlExportSourceError, type HtmlExportSourceService } from '../services/html-export-source';
export function registerExportRoutes(app: FastifyInstance, service: ExportService, htmlSource: HtmlExportSourceService): void {
  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId/export/html-source', async (request, reply) => {
    try { return await htmlSource.gather(request.params.diagramId); }
    catch (error) {
      if (error instanceof HtmlExportSourceError) return reply.code(error.statusCode).send(error.toResponse());
      return reply.code(500).send(new HtmlExportSourceError(500, request.params.diagramId, 'diagram', request.params.diagramId,
        'source', 'The saved export source could not be read.', 'Retry the export or check the API service.').toResponse());
    }
  });
  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId/export/mermaid', async (request, reply) => {
    try { const result = await service.exportMermaid(request.params.diagramId); return reply.type('text/vnd.mermaid; charset=utf-8').header('content-disposition', `attachment; filename="${result.filename}"`).send(result.source); }
    catch (error) { if (error instanceof ExportNotFoundError) return reply.code(404).send({ message: error.message }); if (error instanceof MermaidExportError) return reply.code(422).send({ message: error.message, fields: error.fields, ...(error.code ? { code: error.code } : {}) }); return sendError(reply, error); }
  });
}
