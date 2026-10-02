import { z } from 'zod';
import type { AdrStatus } from '../domain/types';
import { DEFAULT_COMPONENT_SIZE } from '../domain/types';
export const uuidSchema = z.string().uuid();
export const positionSchema = z.object({x:z.number().finite(), y:z.number().finite()});
export const componentNameSchema = z.string().trim().min(1, 'Component name is required');
export const relationshipDirectionSchema = z.enum(['directed','undirected']);
export const c4ArtifactTypeSchema = z.enum(['person', 'software-system']);
export const componentTypeSchema = c4ArtifactTypeSchema.nullable();
/** Complete documents also accept older free-form classifications for compatibility. */
export const componentSizeSchema = z.object({ width: z.number().finite().positive(), height: z.number().finite().positive() }).default(DEFAULT_COMPONENT_SIZE);
const componentBaseShape = { id:uuidSchema, diagramId:uuidSchema, name:componentNameSchema, description:z.string().nullable(), type:z.string().nullable(), position:positionSchema, size:componentSizeSchema, createdAt:z.string(), updatedAt:z.string() };
export const componentRoleSchema = z.enum(['element', 'container', 'external']);
export const containerTypeSchema = z.enum(['application', 'datastore']);
const componentFeatureShape = { role:componentRoleSchema.default('element'), containerType:containerTypeSchema.nullable().default(null), technology:z.string().trim().max(200).nullable().default(null), sourceComponentId:uuidSchema.nullable().default(null) };
export const componentSchema = z.object({ ...componentBaseShape, ...componentFeatureShape });
export const componentWriteSchema = componentSchema.extend({ type: c4ArtifactTypeSchema });
const relationshipBaseShape = { id:uuidSchema, diagramId:uuidSchema, sourceComponentId:uuidSchema, targetComponentId:uuidSchema, direction:relationshipDirectionSchema, label:z.string().trim().nullable(), createdAt:z.string(), updatedAt:z.string() };
export const relationshipSchema = z.object({ ...relationshipBaseShape, protocol:z.string().trim().max(200).nullable().default(null) });
export const containerScopeSchema = z.object({
  parentDiagramId:uuidSchema,
  softwareSystemId:uuidSchema,
  parentDiagramName:z.string().trim().min(1).max(200),
  softwareSystemName:z.string().trim().min(1).max(200),
  softwareSystemDescription:z.string().nullable(),
}).strict();
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
export const boundaryLayoutSchema = groupBoundaryLayoutSchema.strict();

const generalDiagramDocumentSchema = z.object({
  id:uuidSchema,
  name:z.string().trim().min(1).max(200),
  status:z.enum(['active','trashed']),
  createdAt:z.string(),
  updatedAt:z.string(),
  trashedAt:z.string().nullable(),
  kind:z.literal('general'),
  scope:z.null().optional(),
  boundary:z.null().optional(),
  components:z.array(componentSchema),
  relationships:z.array(relationshipSchema),
  groups:z.array(systemGroupSchema).default([]),
}).superRefine((document, ctx) => {
  const components = new Map(document.components.map(component => [component.id, component]));
  document.components.forEach((component, index) => {
    if (component.containerType !== null) ctx.addIssue({ code:'custom', path:['components',index,'containerType'], message:'General elements require null containerType' });
    if (component.role !== 'element' || component.technology !== null || component.sourceComponentId !== null) {
      ctx.addIssue({ code:'custom', path:['components',index], message:'General diagrams require ordinary element components without technology or source references' });
    }
  });
  document.relationships.forEach((relationship, index) => {
    if (!components.has(relationship.sourceComponentId) || !components.has(relationship.targetComponentId)) ctx.addIssue({ code:'custom', path:['relationships',index], message:`Relationship ${relationship.id} references a missing component` });
    if (relationship.sourceComponentId === relationship.targetComponentId) ctx.addIssue({ code:'custom', path:['relationships',index], message:'Self-referential relationships are not supported' });
  });
}).transform(document => ({ ...document, kind:'general' as const, scope:null, boundary:null }));

const containerComponentSchema = z.object({
  id:uuidSchema,
  diagramId:uuidSchema,
  name:componentNameSchema.max(200),
  description:z.string().trim().nullable(),
  type:z.string().nullable(),
  role:componentRoleSchema,
  containerType:containerTypeSchema.nullable(),
  technology:z.string().trim().max(200).nullable(),
  sourceComponentId:uuidSchema.nullable(),
  position:positionSchema,
  size:z.object({ width:z.number().finite().positive(), height:z.number().finite().positive() }).strict(),
  createdAt:z.string(),
  updatedAt:z.string(),
}).strict();

const containerRelationshipSchema = z.object({
  ...relationshipBaseShape,
  label:z.string().trim().min(1, 'Container interactions need a description'),
  protocol:z.string().trim().max(200).nullable(),
}).strict();

const containerDiagramDocumentSchema = z.object({
  id:uuidSchema,
  name:z.string().trim().min(1).max(200),
  status:z.enum(['active','trashed']),
  createdAt:z.string(),
  updatedAt:z.string(),
  trashedAt:z.string().nullable(),
  kind:z.literal('container'),
  scope:containerScopeSchema,
  boundary:boundaryLayoutSchema,
  components:z.array(containerComponentSchema),
  relationships:z.array(containerRelationshipSchema),
  groups:z.array(systemGroupSchema).max(0),
}).strict().superRefine((document, ctx) => {
  if (document.scope.parentDiagramId === document.id) ctx.addIssue({ code:'custom', path:['scope','parentDiagramId'], message:'A container diagram must have a separate general parent diagram' });
  const byId = new Map(document.components.map(component => [component.id, component]));
  const externalSources = new Set<string>();
  document.components.forEach((component, index) => {
    if (component.diagramId !== document.id) ctx.addIssue({ code:'custom', path:['components',index,'diagramId'], message:'Component must belong to the container diagram' });
    if (component.role === 'container') {
      if (component.containerType === null) ctx.addIssue({ code:'custom', path:['components',index,'containerType'], message:'Choose Application or Datastore for this container' });
      if (component.type !== 'container') ctx.addIssue({ code:'custom', path:['components',index,'type'], message:'Container role requires type container' });
      if (!component.description?.trim()) ctx.addIssue({ code:'custom', path:['components',index,'description'], message:'Container responsibility is required' });
      if (!component.technology?.trim()) ctx.addIssue({ code:'custom', path:['components',index,'technology'], message:'Container technology is required' });
      if (component.sourceComponentId !== null) ctx.addIssue({ code:'custom', path:['components',index,'sourceComponentId'], message:'Internal containers cannot reference an external source' });
      if (!isWithinBoundary(document.boundary, component.position, component.size)) ctx.addIssue({ code:'custom', path:['components',index,'position'], message:'Container must remain inside the fitted Software System boundary' });
    } else if (component.role === 'external') {
      if (component.containerType !== null) ctx.addIssue({ code:'custom', path:['components',index,'containerType'], message:'External participants require null containerType' });
      if (component.type !== 'person' && component.type !== 'software-system') ctx.addIssue({ code:'custom', path:['components',index,'type'], message:'External participants must resolve to a Person or Software System' });
      if (!component.sourceComponentId || component.sourceComponentId === document.scope.softwareSystemId) ctx.addIssue({ code:'custom', path:['components',index,'sourceComponentId'], message:'External participant must reference a different parent element' });
      if (component.technology !== null) ctx.addIssue({ code:'custom', path:['components',index,'technology'], message:'External participant technology comes from its source' });
      if (component.sourceComponentId && externalSources.has(component.sourceComponentId)) ctx.addIssue({ code:'custom', path:['components',index,'sourceComponentId'], message:'A source can appear only once in a container diagram' });
      if (component.sourceComponentId) externalSources.add(component.sourceComponentId);
      if (!outsideBoundaryWithClearance(document.boundary, component.position, component.size)) ctx.addIssue({ code:'custom', path:['components',index,'position'], message:'External participants need 24 units of clearance outside the Software System boundary' });
    } else {
      ctx.addIssue({ code:'custom', path:['components',index,'role'], message:'Container diagrams allow only internal containers and external participants' });
    }
  });
  document.relationships.forEach((relationship, index) => {
    const source = byId.get(relationship.sourceComponentId);
    const target = byId.get(relationship.targetComponentId);
    if (relationship.diagramId !== document.id || !source || !target) ctx.addIssue({ code:'custom', path:['relationships',index], message:'Interaction endpoints must reference components in this container diagram' });
    if (relationship.direction !== 'directed') ctx.addIssue({ code:'custom', path:['relationships',index,'direction'], message:'Container interactions must be directed' });
    if (!relationship.label.trim()) ctx.addIssue({ code:'custom', path:['relationships',index,'label'], message:'Container interactions need a description' });
    if (source?.role !== 'container' && target?.role !== 'container') ctx.addIssue({ code:'custom', path:['relationships',index], message:'At least one interaction endpoint must be an internal container' });
  });
});

function isWithinBoundary(boundary: z.infer<typeof boundaryLayoutSchema>, position: { x:number; y:number }, size: { width:number; height:number }): boolean {
  return position.x >= boundary.position.x + 24
    && position.y >= boundary.position.y + 68
    && position.x + size.width <= boundary.position.x + boundary.size.width - 24
    && position.y + size.height <= boundary.position.y + boundary.size.height - 24;
}

function outsideBoundaryWithClearance(boundary: z.infer<typeof boundaryLayoutSchema>, position: { x:number; y:number }, size: { width:number; height:number }): boolean {
  const left = position.x + size.width <= boundary.position.x - 24;
  const right = position.x >= boundary.position.x + boundary.size.width + 24;
  const above = position.y + size.height <= boundary.position.y - 24;
  const below = position.y >= boundary.position.y + boundary.size.height + 24;
  return left || right || above || below;
}

export const diagramDocumentSchema = z.any().transform((value, ctx) => {
  // General diagrams predate the C4 discriminator. Select their schema before
  // parsing so validation errors retain their field paths through the union.
  const input = typeof value === 'object' && value !== null && !Array.isArray(value) && (!('kind' in value) || value.kind === undefined)
    ? { ...value, kind: 'general' }
    : value;
  const schema = typeof input === 'object' && input !== null && 'kind' in input && input.kind === 'container'
    ? containerDiagramDocumentSchema
    : generalDiagramDocumentSchema;
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  for (const issue of result.error.issues) ctx.addIssue(issue);
  return z.NEVER;
});
export const diagramCreateSchema = z.object({name:z.string().trim().min(1)});
export const diagramSummarySchema = z.object({id:uuidSchema, name:z.string().trim().min(1), status:z.enum(['active','trashed']), createdAt:z.string().datetime({ offset: true }), updatedAt:z.string(), kind:z.enum(['general','container']).default('general'), scope:containerScopeSchema.nullable().default(null)});
export const diagramSummaryListSchema = z.array(diagramSummarySchema);
export const containerAvailabilitySchema = z.object({ parentDiagramId:uuidSchema, softwareSystemId:uuidSchema, availability:z.enum(['none','active','trashed']), diagram:diagramSummarySchema.nullable() }).strict();
export const containerContextSchema = z.object({ scope:containerScopeSchema, sources:z.array(z.object({ id:uuidSchema, name:componentNameSchema.max(200), description:z.string().nullable(), type:c4ArtifactTypeSchema }).strict()), capturedAt:z.string().datetime({offset:true}) }).strict();
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
export const architectureDecisionRecordListSchema = z.array(architectureDecisionRecordSchema);

export const adrSummarySchema = z.object({
  id: uuidSchema,
  title: requiredAdrText('Title'),
  status: adrStatusSchema,
  updatedAt: z.string().datetime({ offset: true }),
  componentCount: z.number().int().nonnegative(),
  relationshipCount: z.number().int().nonnegative(),
});

export const adrSummaryListSchema = z.array(adrSummarySchema);
export const componentAdrCountSchema = z.object({ componentId: uuidSchema, count: z.number().int().positive() });
export const componentAdrCountListSchema = z.array(componentAdrCountSchema);
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
