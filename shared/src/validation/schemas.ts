import { z } from 'zod';
import type { AdrStatus } from '../domain/types';
export const uuidSchema = z.string().uuid();
export const positionSchema = z.object({x:z.number().finite(), y:z.number().finite()});
export const componentNameSchema = z.string().trim().min(1, 'Component name is required');
export const relationshipDirectionSchema = z.enum(['directed','undirected']);
export const c4ArtifactTypeSchema = z.enum(['person', 'software-system']);
export const componentTypeSchema = c4ArtifactTypeSchema.nullable();
/** Complete documents also accept older free-form classifications for compatibility. */
export const componentSchema = z.object({id:uuidSchema, diagramId:uuidSchema, name:componentNameSchema, description:z.string().nullable(), type:z.string().trim().nullable(), position:positionSchema, createdAt:z.string(), updatedAt:z.string()});
export const componentWriteSchema = componentSchema.extend({ type: c4ArtifactTypeSchema });
export const relationshipSchema = z.object({id:uuidSchema, diagramId:uuidSchema, sourceComponentId:uuidSchema, targetComponentId:uuidSchema, direction:relationshipDirectionSchema, label:z.string().trim().nullable(), createdAt:z.string(), updatedAt:z.string()});
export const groupSizeSchema = z.object({ width: z.number().finite().positive(), height: z.number().finite().positive() });
export const groupNameSchema = z.string().trim().min(1, 'Group name is required');
export const groupMemberIdsSchema = z.array(uuidSchema).min(2, 'A system group needs at least two Software System members.').superRefine((ids, ctx) => {
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Group members must be unique.' });
});
export const systemGroupSchema = z.object({
  id: uuidSchema,
  diagramId: uuidSchema,
  name: groupNameSchema,
  memberComponentIds: groupMemberIdsSchema,
  position: positionSchema,
  size: groupSizeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const groupBoundaryLayoutSchema = z.object({ position: positionSchema, size: groupSizeSchema });
export const diagramDocumentSchema = z.object({id:uuidSchema, name:z.string().trim().min(1), status:z.enum(['active','trashed']), createdAt:z.string(), updatedAt:z.string(), trashedAt:z.string().nullable(), components:z.array(componentSchema), relationships:z.array(relationshipSchema), groups:z.array(systemGroupSchema).default([])}).superRefine((d,ctx)=>{const ids=new Set(d.components.map(c=>c.id)); d.relationships.forEach((r,i)=>{if(!ids.has(r.sourceComponentId)||!ids.has(r.targetComponentId))ctx.addIssue({code:'custom',path:['relationships',i],message:`Relationship ${r.id} references a missing component`}); if(r.sourceComponentId===r.targetComponentId)ctx.addIssue({code:'custom',path:['relationships',i],message:'Self-referential relationships are not supported'});});});
export const diagramCreateSchema = z.object({name:z.string().trim().min(1)});
export const diagramSummarySchema = z.object({id:uuidSchema, name:z.string().trim().min(1), status:z.enum(['active','trashed']), updatedAt:z.string()});
export const diagramSummaryListSchema = z.array(diagramSummarySchema);
export function validationFields(error: z.ZodError) {
  const path = (parts: (string | number)[]) => parts.reduce((value, part) => typeof part === 'number' ? `${value}[${part}]` : value ? `${value}.${part}` : part, '');
  return Object.fromEntries(error.issues.map(i => [path(i.path) || 'document', i.message]));
}

export const adrStatusSchema = z.enum(['draft', 'accepted', 'superseded', 'rejected']);
const requiredAdrText = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);

const adrWriteBaseSchema = z.object({
  title: requiredAdrText('Title'),
  context: requiredAdrText('Context'),
  decision: requiredAdrText('Decision'),
  consequences: requiredAdrText('Consequences'),
  alternativesOrConstraints: z.string().trim().nullable().optional().transform(value => value || null),
  status: adrStatusSchema,
  replacementAdrId: uuidSchema.nullable().optional().default(null),
});

export const adrWriteSchema = adrWriteBaseSchema.superRefine((value, ctx) => {
  if (value.status === 'superseded' && !value.replacementAdrId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['replacementAdrId'], message: 'A superseded ADR must reference its replacement ADR' });
  }
});

export const adrComponentsWriteSchema = z.object({
  componentIds: z.array(uuidSchema).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Component links must be unique' });
  }),
});

export const adrRelationshipsWriteSchema = z.object({
  relationshipIds: z.array(uuidSchema).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Relationship links must be unique' });
  }),
});

export const architectureDecisionRecordSchema = adrWriteBaseSchema.extend({
  id: uuidSchema,
  diagramId: uuidSchema,
  componentIds: adrComponentsWriteSchema.shape.componentIds,
  relationshipIds: adrRelationshipsWriteSchema.shape.relationshipIds,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).superRefine((value, ctx) => {
  if (value.replacementAdrId === value.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['replacementAdrId'], message: 'An ADR cannot replace itself' });
});

export const adrSummarySchema = z.object({
  id: uuidSchema,
  title: requiredAdrText('Title'),
  status: adrStatusSchema,
  updatedAt: z.string().datetime({ offset: true }),
  componentCount: z.number().int().nonnegative(),
  relationshipCount: z.number().int().nonnegative(),
});

export const adrSummaryListSchema = z.array(adrSummarySchema);
export const componentAdrSummarySchema = z.object({
  id: uuidSchema,
  title: requiredAdrText('Title'),
  status: adrStatusSchema,
  updatedAt: z.string().datetime({ offset: true }),
});
export const componentAdrSummaryListSchema = z.array(componentAdrSummarySchema);
export const relationshipAdrSummarySchema = componentAdrSummarySchema;
export const relationshipAdrSummaryListSchema = z.array(relationshipAdrSummarySchema);
export const adrListPathSchema = z.object({ diagramId: uuidSchema });
export const adrPathSchema = z.object({ adrId: uuidSchema });
export const adrApiErrorSchema = z.object({ message: z.string(), fields: z.record(z.string()).optional(), blockers: z.array(z.object({ adrId: uuidSchema, title: z.string(), reason: z.string() })).optional() });
export type AdrStatusValue = AdrStatus;
