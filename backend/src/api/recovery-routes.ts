import type { FastifyInstance } from 'fastify';
import { DiagramRepository } from '../persistence/diagram-repository';
import { DiagramConflictError, DiagramNotFoundError, DiagramService } from '../services/diagram-service';
export function registerRecoveryRoutes(app: FastifyInstance, repository: DiagramRepository, service: DiagramService) {
  const missing = (error: unknown, reply: any) => error instanceof DiagramNotFoundError ? reply.code(404).send({ message: error.message }) : undefined;
  app.get('/diagrams/trash', async () => repository.listTrash());
  app.get<{ Params: { diagramId: string; componentId: string } }>('/diagrams/:diagramId/components/:componentId/dependencies', async (request, reply) => { try { return { relationshipCount: service.dependencyCount(request.params.diagramId, request.params.componentId) }; } catch (error) { return missing(error, reply); } });
  app.delete<{ Params: { diagramId: string; componentId: string } }>('/diagrams/:diagramId/components/:componentId', async (request, reply) => { try { return reply.code(200).send(service.removeComponent(request.params.diagramId, request.params.componentId)); } catch (error) { return missing(error, reply); } });
  app.delete<{ Params: { diagramId: string } }>('/diagrams/:diagramId', async (request, reply) => { try { service.trash(request.params.diagramId); return reply.code(204).send(); } catch (error) { return missing(error, reply); } });
  app.post<{ Params: { diagramId: string } }>('/diagrams/:diagramId/restore', async (request, reply) => { try { return service.restore(request.params.diagramId); } catch (error) { if (error instanceof DiagramConflictError) return reply.code(409).send({ message: error.message }); return missing(error, reply); } });
}
