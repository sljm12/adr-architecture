import type { FastifyInstance } from 'fastify';
import { DiagramConflictError, DiagramNotFoundError, DiagramService, RelationshipDependencyConflictError } from '../services/diagram-service';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { sendError } from './errors';

export function registerDiagramRoutes(app: FastifyInstance, repository: DiagramRepositoryLike, service: DiagramService): void {
  const summary = (document: Awaited<ReturnType<DiagramRepositoryLike['list']>>[number]) => ({ id: document.id, name: document.name, status: document.status, updatedAt: document.updatedAt });
  const completeDocument = (document: Awaited<ReturnType<DiagramRepositoryLike['get']>>) => document ? { ...document, groups: document.groups ?? [] } : document;
  app.get('/diagrams', async () => (await repository.list()).map(summary));

  app.post('/diagrams', async (request, reply) => {
    try { return reply.code(201).send(await service.create((request.body as { name?: unknown } | undefined)?.name as string)); }
    catch (error) { return sendError(reply, error); }
  });

  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId', async (request, reply) => {
    try { return reply.send(completeDocument(await service.load(request.params.diagramId))); }
    catch (error) { if (error instanceof DiagramNotFoundError) return reply.code(404).send({ message: error.message }); return sendError(reply, error); }
  });

  app.put<{ Params: { diagramId: string } }>('/diagrams/:diagramId', async (request, reply) => {
    try { return reply.send(await service.save(request.params.diagramId, request.body)); }
    catch (error) {
      if (error instanceof DiagramNotFoundError) return reply.code(404).send({ message: error.message });
      if (error instanceof Error && error.message === 'Path and document IDs must match') return reply.code(422).send({ message: error.message, fields: { id: 'Must match diagramId' } });
      return sendError(reply, error);
    }
  });

  app.delete<{ Params: { diagramId: string; relationshipId: string } }>('/diagrams/:diagramId/relationships/:relationshipId', async (request, reply) => {
      try { return reply.send(await service.removeRelationship(request.params.diagramId, request.params.relationshipId)); }
      catch (error) {
        if (error instanceof DiagramNotFoundError) return reply.code(404).send({ message: error.message });
      if (error instanceof RelationshipDependencyConflictError) return reply.code(409).send({ message: error.message, blockers: error.blockers });
      if (error instanceof DiagramConflictError) return reply.code(409).send({ message: error.message });
      return sendError(reply, error);
    }
  });
}
