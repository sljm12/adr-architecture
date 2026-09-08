import type { FastifyReply } from 'fastify'; import { ZodError } from 'zod'; import { validationFields, type AdrDependencyBlocker } from '../../../shared/src/index';
export class DependencyConflictError extends Error { constructor(readonly blockers: AdrDependencyBlocker[], message = 'Action is blocked by dependent ADR references') { super(message); this.name = 'DependencyConflictError'; } }
export function sendError(reply:FastifyReply,error:unknown){
  if(error instanceof ZodError)return reply.code(422).send({message:'Validation failed',fields:validationFields(error)});
  if(error instanceof DependencyConflictError)return reply.code(409).send({message:error.message,blockers:error.blockers});
  return reply.code(400).send({message:error instanceof Error?error.message:'Request failed',fields:{}});
}
