import type { FastifyInstance } from 'fastify';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { ComponentDependencyConflictError, DiagramConflictError, DiagramNotFoundError, DiagramService } from '../services/diagram-service';
import { sendError } from './errors';
import { restoreConfirmationSchema, trashConfirmationSchema } from '../../../shared/src/index';
export function registerRecoveryRoutes(app: FastifyInstance, repository: DiagramRepositoryLike, service: DiagramService) {
  const missing = (error: unknown, reply: any) => error instanceof DiagramNotFoundError ? reply.code(404).send({ message: error.message }) : undefined;
  app.get('/diagrams/trash', async (_request, reply) => {
    try { return await service.listSummaries('trashed'); }
    catch (error) { return sendError(reply, error); }
  });
  app.get<{ Params: { diagramId: string; componentId: string } }>('/diagrams/:diagramId/components/:componentId/dependencies', async (request, reply) => { try { return await service.componentDependencies(request.params.diagramId, request.params.componentId); } catch (error) { return missing(error, reply) ?? sendError(reply, error); } });
  app.delete<{ Params: { diagramId: string; componentId: string } }>('/diagrams/:diagramId/components/:componentId', async (request, reply) => { try { return reply.code(200).send(await service.removeComponent(request.params.diagramId, request.params.componentId)); } catch (error) { if (error instanceof ComponentDependencyConflictError) { const dependency = { message: error.message, componentId: error.componentId, relationshipCount: error.relationshipCount, groupIds: error.groupIds }; return reply.code(409).send(error.blockers.length ? { ...dependency, code:'DIAGRAM_DEPENDENCY', blockers: error.blockers } : dependency); } const notFound = missing(error, reply); return notFound ?? sendError(reply, error); } });
  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId/trash-impact', async (request, reply) => { try { return await service.trashImpact(request.params.diagramId); } catch (error) { return missing(error, reply) ?? sendError(reply, error); } });
  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId/restore-impact', async (request, reply) => { try { return await service.restoreImpact(request.params.diagramId); } catch (error) { if (error instanceof DiagramConflictError) return reply.code(409).send({ message: error.message }); return missing(error, reply) ?? sendError(reply, error); } });
  app.delete<{ Params: { diagramId: string } }>('/diagrams/:diagramId', async (request, reply) => { try { const confirmed = request.body === undefined ? undefined : trashConfirmationSchema.parse(request.body).confirmedDiagramIds; await service.trash(request.params.diagramId, confirmed); return reply.code(204).send(); } catch (error) { return missing(error, reply) ?? sendError(reply, error); } });
  app.post<{ Params: { diagramId: string } }>('/diagrams/:diagramId/restore', async (request, reply) => { try { const confirmation = request.body === undefined ? undefined : restoreConfirmationSchema.parse(request.body); return await service.restore(request.params.diagramId, confirmation); } catch (error) { if (error instanceof DiagramConflictError) return reply.code(409).send({ message: error.message }); return missing(error, reply) ?? sendError(reply, error); } });
}
