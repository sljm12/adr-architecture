import type { FastifyInstance } from 'fastify';
import { ExportNotFoundError, ExportService, MermaidExportError } from '../services/export-service';
export function registerExportRoutes(app: FastifyInstance, service: ExportService): void {
  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId/export/mermaid', async (request, reply) => {
    try { const result = await service.exportMermaid(request.params.diagramId); return reply.type('text/vnd.mermaid; charset=utf-8').header('content-disposition', `attachment; filename="${result.filename}"`).send(result.source); }
    catch (error) { if (error instanceof ExportNotFoundError) return reply.code(404).send({ message: error.message }); if (error instanceof MermaidExportError) return reply.code(422).send({ message: error.message, fields: error.fields }); throw error; }
  });
}
