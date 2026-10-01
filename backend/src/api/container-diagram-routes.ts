import type { FastifyInstance } from 'fastify';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { ContainerContextNotFoundError } from '../services/container-context';
import { DiagramService } from '../services/diagram-service';
import { sendError } from './errors';
import { containerAvailabilitySchema, containerContextSchema, diagramDocumentSchema } from '../../../shared/src/index';

export function registerContainerDiagramRoutes(app: FastifyInstance, _repository: DiagramRepositoryLike, service: DiagramService): void {
  app.get<{ Params:{ diagramId:string; componentId:string } }>('/diagrams/:diagramId/components/:componentId/container-diagram', async (request, reply) => {
    try { return reply.send(containerAvailabilitySchema.parse(await service.containerAvailability(request.params.diagramId, request.params.componentId))); }
    catch (error) { if (error instanceof ContainerContextNotFoundError) return reply.code(404).send({ message:error.message }); return sendError(reply,error); }
  });
  app.post<{ Params:{ diagramId:string; componentId:string } }>('/diagrams/:diagramId/components/:componentId/container-diagram', async (request, reply) => {
    try {
      const result = await service.createOrOpenContainerDiagram(request.params.diagramId, request.params.componentId);
      return reply.code(result.created ? 201 : 200).send(diagramDocumentSchema.parse(result.document));
    } catch (error) { if (error instanceof ContainerContextNotFoundError) return reply.code(404).send({ message:error.message }); return sendError(reply,error); }
  });
  app.get<{ Params:{ diagramId:string } }>('/diagrams/:diagramId/container-context', async (request, reply) => {
    try { return reply.send(containerContextSchema.parse(await service.containerSourceContext(request.params.diagramId))); }
    catch (error) { if (error instanceof ContainerContextNotFoundError) return reply.code(404).send({ message:error.message }); return sendError(reply,error); }
  });
}
