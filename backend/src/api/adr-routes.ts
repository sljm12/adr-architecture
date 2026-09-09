import type { FastifyInstance } from 'fastify';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import { AdrComponentNotFoundError, AdrDiagramNotFoundError, AdrNotFoundError, AdrRelationshipNotFoundError, AdrService } from '../services/adr-service';
import { sendError } from './errors';

export function registerAdrRoutes(app: FastifyInstance, service: AdrService): void {
  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId/adrs', async (request, reply) => {
    try { return reply.send(await service.list(request.params.diagramId)); }
    catch (error) { if (error instanceof AdrDiagramNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });
  app.post<{ Params: { diagramId: string } }>('/diagrams/:diagramId/adrs', async (request, reply) => {
    try { return reply.code(201).send(await service.create(request.params.diagramId, request.body)); }
    catch (error) { if (error instanceof AdrDiagramNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });
  app.get<{ Params: { adrId: string } }>('/adrs/:adrId', async (request, reply) => {
    try { return reply.send(await service.load(request.params.adrId)); }
    catch (error) { if (error instanceof AdrNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });
  app.patch<{ Params: { adrId: string } }>('/adrs/:adrId', async (request, reply) => {
    try { return reply.send(await service.update(request.params.adrId, request.body)); }
    catch (error) { if (error instanceof AdrNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });
  app.put<{ Params: { adrId: string } }>('/adrs/:adrId/components', async (request, reply) => {
    try { return reply.send(await service.replaceLinks(request.params.adrId, request.body)); }
    catch (error) { if (error instanceof AdrNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });
  app.put<{ Params: { adrId: string } }>('/adrs/:adrId/relationships', async (request, reply) => {
    try { return reply.send(await service.replaceRelationshipLinks(request.params.adrId, request.body)); }
    catch (error) { if (error instanceof AdrNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });
  app.get<{ Params: { diagramId: string; componentId: string } }>('/diagrams/:diagramId/components/:componentId/adrs', async (request, reply) => {
    try { return reply.send(await service.componentSummaries(request.params.diagramId, request.params.componentId)); }
    catch (error) {
      if (error instanceof AdrDiagramNotFoundError || error instanceof AdrComponentNotFoundError) return reply.code(404).send({ message: error.message });
      return sendError(reply, error);
    }
  });
  app.get<{ Params: { diagramId: string; relationshipId: string } }>('/diagrams/:diagramId/relationships/:relationshipId/adrs', async (request, reply) => {
    try { return reply.send(await service.relationshipSummaries(request.params.diagramId, request.params.relationshipId)); }
    catch (error) {
      if (error instanceof AdrDiagramNotFoundError || error instanceof AdrRelationshipNotFoundError) return reply.code(404).send({ message: error.message });
      return sendError(reply, error);
    }
  });
  app.delete<{ Params: { adrId: string } }>('/adrs/:adrId', async (request, reply) => {
    try { await service.remove(request.params.adrId); return reply.code(204).send(); }
    catch (error) { if (error instanceof AdrNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });
}
