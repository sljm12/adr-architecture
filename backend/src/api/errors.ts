import type { FastifyReply } from 'fastify'; import { ZodError } from 'zod'; import { validationFields, type AdrDependencyBlocker, type DiagramDependencyBlocker, type DiagramSummary } from '../../../shared/src/index';
import { deletionErrorSchema, type DeletionError } from '../../../shared/src/index';
export class DeletionRequestError extends Error {
  constructor(readonly status: number, readonly detail: DeletionError) { super(detail.message); this.name = 'DeletionRequestError'; }
}
export function sendDeletionError(reply: FastifyReply, error: unknown) {
  if (error instanceof DeletionRequestError) return reply.code(error.status).send(deletionErrorSchema.parse(error.detail));
  if (error instanceof ZodError || error instanceof ApiValidationError) return reply.code(400).send({ code: 'DELETE_INVALID_REQUEST', message: 'Invalid deletion request or saved artifact.', remedy: 'Check the selector, mode, UUID and confirmation token; repair invalid saved artifacts before previewing again.' });
  if (error instanceof ApiConflictError) return reply.code(409).send({ code: error.code === 'DIAGRAM_DEPENDENCY' ? 'DIAGRAM_DEPENDENCY' : 'DIAGRAM_REFERENCE_BROKEN', message: error.message, remedy: 'Repair the saved parent, owner and source references, then request a new preview.' });
  return reply.code(500).send({ code: 'DELETE_FAILED', message: 'Deletion failed; the transaction was rolled back.', remedy: 'Check service availability and request a new preview before trying again.' });
}
export class DependencyConflictError extends Error { constructor(readonly blockers: AdrDependencyBlocker[], message = 'Action is blocked by dependent ADR references') { super(message); this.name = 'DependencyConflictError'; } }
export class ApiValidationError extends Error { constructor(readonly fields: Record<string, string>, message = 'Validation failed') { super(message); this.name = 'ApiValidationError'; } }
export class ApiConflictError extends Error {
  constructor(message: string, readonly code: string, readonly diagram?: DiagramSummary, readonly blockers?: AdrDependencyBlocker[], readonly diagramBlockers?: DiagramDependencyBlocker[], readonly restoreRootDiagramId?: string) { super(message); this.name = 'ApiConflictError'; }
}
export function sendError(reply:FastifyReply,error:unknown){
  if(error instanceof ZodError)return reply.code(422).send({message:'Validation failed',fields:validationFields(error)});
  if(error instanceof ApiValidationError)return reply.code(422).send({message:error.message,fields:error.fields});
  if(error instanceof ApiConflictError)return reply.code(409).send({message:error.message,code:error.code,...(error.diagram?{diagram:error.diagram}:{}),...(error.blockers?{blockers:error.blockers}:{}),...(error.diagramBlockers?{diagramBlockers:error.diagramBlockers}:{}),...(error.restoreRootDiagramId?{restoreRootDiagramId:error.restoreRootDiagramId}:{})});
  if(error instanceof Error && error.name === 'ComponentDependencyConflictError' && 'componentId' in error) {
    const dependency = error as Error & { componentId: string; relationshipCount: number; groupIds?: string[] };
    return reply.code(409).send({ message: error.message, componentId: dependency.componentId, relationshipCount: dependency.relationshipCount, groupIds: dependency.groupIds ?? [] });
  }
  if(error instanceof DependencyConflictError)return reply.code(409).send({message:error.message,blockers:error.blockers});
  return reply.code(400).send({message:error instanceof Error?error.message:'Request failed',fields:{}});
}
