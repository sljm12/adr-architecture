import type { FastifyInstance } from 'fastify';
import { componentAvailabilitySchema, componentContextSchema, diagramDocumentSchema } from '../../../shared/src/index';
import { DiagramNotFoundError, type DiagramService } from '../services/diagram-service';
import { ContainerContextNotFoundError } from '../services/container-context';
import { sendError } from './errors';

export function registerComponentDiagramRoutes(app: FastifyInstance, service: DiagramService): void {
  const errorResponse = (reply: Parameters<typeof sendError>[0], error: unknown) => error instanceof DiagramNotFoundError || error instanceof ContainerContextNotFoundError ? reply.code(404).send({ message: error.message }) : sendError(reply, error);
  app.get<{ Params: { diagramId: string; componentId: string } }>('/diagrams/:diagramId/components/:componentId/component-diagram', async (request, reply) => {
    try { return reply.send(componentAvailabilitySchema.parse(await service.componentAvailability(request.params.diagramId, request.params.componentId))); }
    catch (error) { return errorResponse(reply, error); }
  });
  app.post<{ Params: { diagramId: string; componentId: string } }>('/diagrams/:diagramId/components/:componentId/component-diagram', async (request, reply) => {
    try {
      if (request.body !== undefined) return reply.code(422).send({ message: 'Validation failed', fields: { body: 'Component entry is bodyless. Save owner changes in the parent before creating its child.' } });
      const result = await service.createOrOpenComponentDiagram(request.params.diagramId, request.params.componentId);
      return reply.code(result.created ? 201 : 200).send(diagramDocumentSchema.parse(result.document));
    } catch (error) { return errorResponse(reply, error); }
  });
  app.get<{ Params: { diagramId: string } }>('/diagrams/:diagramId/component-context', async (request, reply) => {
    try { return reply.send(componentContextSchema.parse(await service.componentSourceContext(request.params.diagramId))); }
    catch (error) { return errorResponse(reply, error); }
  });
}
