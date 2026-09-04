import type { FastifyInstance } from 'fastify';
import { DiagramNotFoundError, DiagramService } from '../services/diagram-service';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { sendError } from './errors';

export function registerDiagramRoutes(app: FastifyInstance, repository: DiagramRepositoryLike, service: DiagramService): void {
  const summary = (document: Awaited<ReturnType<DiagramRepositoryLike['list']>>[number]) => ({ id: document.id, name: document.name, status: document.status, updatedAt: document.updatedAt });
  app.get('/diagrams', async () => (await repository.list()).map(summary));

  app.post('/diagrams', async (request, reply) => {
    try { return reply.code(201).send(await service.create((request.body as { name?: unknown } | undefined)?.name as string)); }
    catch (error) { return sendError(reply, error); }
  });

  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId', async (request, reply) => {
    try { return reply.send(await service.load(request.params.diagramId)); }
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
}
