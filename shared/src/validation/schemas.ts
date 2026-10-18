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
export const componentRoleSchema = z.enum(['element', 'container', 'component', 'external']);
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
export const componentScopeSchema = z.object({
  parentDiagramId: uuidSchema, containerId: uuidSchema,
  parentDiagramName: z.string().trim().min(1).max(200),
  containerName: z.string().trim().min(1).max(200),
  containerDescription: z.string().nullable(),
  containerTechnology: z.string().trim().min(1).max(200), containerType: containerTypeSchema,
  systemContextDiagramId: uuidSchema, softwareSystemId: uuidSchema,
  softwareSystemName: z.string().trim().min(1).max(200),
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

const componentDiagramDocumentSchema = z.object({
  id: uuidSchema, name: z.string().trim().min(1).max(200), status: z.enum(['active', 'trashed']),
  createdAt: z.string(), updatedAt: z.string(), trashedAt: z.string().nullable(),
  kind: z.literal('component'), scope: componentScopeSchema, boundary: boundaryLayoutSchema,
  components: z.array(containerComponentSchema), relationships: z.array(containerRelationshipSchema), groups: z.array(systemGroupSchema).max(0),
}).strict().superRefine((document, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (document.scope.parentDiagramId === document.id || document.scope.systemContextDiagramId === document.id || document.scope.systemContextDiagramId === document.scope.parentDiagramId) issue(['scope', 'parentDiagramId'], 'Component scope requires distinct Component, Container and Context diagrams');
  const byId = new Map(document.components.map(c => [c.id, c]));
  const sources = new Set<string>(); const ids = new Set<string>();
  document.components.forEach((component, index) => {
    const path = ['components', index];
    if (ids.has(component.id)) issue([...path, 'id'], 'Component IDs must be unique'); ids.add(component.id);
    if (component.diagramId !== document.id) issue([...path, 'diagramId'], 'Component must belong to this diagram');
    if (component.role === 'component') {
      if (component.type !== 'component') issue([...path, 'type'], 'Internal C4 Components require type component');
      if (component.containerType !== null) issue([...path, 'containerType'], 'Internal C4 Components require null containerType');
      if (!component.description?.trim()) issue([...path, 'description'], 'Component responsibilities are required');
      if (!component.technology?.trim()) issue([...path, 'technology'], 'Component technology is required');
      if (component.sourceComponentId !== null) issue([...path, 'sourceComponentId'], 'Internal Components cannot reference a source');
      if (!isWithinBoundary(document.boundary, component.position, component.size)) issue([...path, 'position'], 'Component must remain inside the fitted container boundary');
    } else if (component.role === 'external') {
      if (component.type === 'container') {
        if (!component.containerType) issue([...path, 'containerType'], 'Supporting containers require their source Application/Datastore subtype');
        if (!component.technology?.trim()) issue([...path, 'technology'], 'Supporting containers require source technology');
        if (!component.description?.trim()) issue([...path, 'description'], 'Supporting containers require source responsibilities');
      } else {
        if (component.type !== 'person' && component.type !== 'software-system') issue([...path, 'type'], 'Supporting participants must be a sibling container, Person or Software System');
        if (component.containerType !== null || component.technology !== null) issue(path, 'Person/System participants require null subtype and technology');
      }
      if (!component.sourceComponentId || component.sourceComponentId === document.scope.containerId) issue([...path, 'sourceComponentId'], 'Supporting participants require an immediate parent source other than the owner');
      if (component.sourceComponentId && sources.has(component.sourceComponentId)) issue([...path, 'sourceComponentId'], 'A source can appear only once in a Component diagram');
      if (component.sourceComponentId) sources.add(component.sourceComponentId);
      if (!outsideBoundaryWithClearance(document.boundary, component.position, component.size)) issue([...path, 'position'], 'Supporting participants need 24 units of clearance outside the container boundary');
    } else issue([...path, 'role'], 'Component diagrams allow internal Components and supporting participants');
  });
  const relationshipIds = new Set<string>();
  document.relationships.forEach((relationship, index) => {
    const path = ['relationships', index]; const source = byId.get(relationship.sourceComponentId); const target = byId.get(relationship.targetComponentId);
    if (relationshipIds.has(relationship.id)) issue([...path, 'id'], 'Relationship IDs must be unique'); relationshipIds.add(relationship.id);
    if (relationship.diagramId !== document.id || !source || !target) issue(path, 'Interaction endpoints must reference local elements; boundaries cannot be endpoints');
    if (relationship.sourceComponentId === relationship.targetComponentId) issue(path, 'Self-referential interactions are not supported');
    if (relationship.direction !== 'directed') issue([...path, 'direction'], 'Component interactions must be directed');
    if (source?.role !== 'component' && target?.role !== 'component') issue(path, 'At least one endpoint must be an internal Component');
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
    : typeof input === 'object' && input !== null && 'kind' in input && input.kind === 'component' ? componentDiagramDocumentSchema
    : generalDiagramDocumentSchema;
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  for (const issue of result.error.issues) ctx.addIssue(issue);
  return z.NEVER;
});
export const diagramCreateSchema = z.object({name:z.string().trim().min(1)});
export const diagramSummarySchema = z.object({id:uuidSchema, name:z.string().trim().min(1), status:z.enum(['active','trashed']), createdAt:z.string().datetime({ offset: true }), updatedAt:z.string(), kind:z.enum(['general','container','component']).default('general'), scope:z.union([containerScopeSchema, componentScopeSchema]).nullable().default(null)}).superRefine((value, ctx) => {
  // Legacy Container summaries may omit their scope; Component scope must never be stripped.
  if (value.kind === 'component' ? !value.scope || !('containerId' in value.scope) : value.scope !== null && 'containerId' in value.scope) ctx.addIssue({ code: 'custom', path: ['scope'], message: 'Summary scope must match its diagram level' });
});
export const diagramSummaryListSchema = z.array(diagramSummarySchema);
export const deletionModeSchema = z.enum(['trash', 'permanent']);
export const deletionSelectorSchema = z.union([
  z.object({ id: uuidSchema }).strict(),
  z.object({ name: z.string().refine(name => /\S/.test(name), 'Name must not be blank') }).strict(),
]);
export const deletionPreviewSchema = z.object({ selector: deletionSelectorSchema, mode: deletionModeSchema }).strict();
export const deletionConfirmationSchema = z.object({ mode: deletionModeSchema, confirmationToken: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
// Deletion boundaries preserve literal saved names and reject silently stripped fields.
const deletionSummarySchema = diagramSummarySchema.innerType().extend({ name: z.string().refine(name => /\S/.test(name)) }).strict().superRefine((value, ctx) => {
  if (value.kind === 'general' ? value.scope !== null : !value.scope || (value.kind === 'component') !== ('containerId' in value.scope)) ctx.addIssue({ code: 'custom', path: ['scope'], message: 'Summary scope must match its diagram level' });
});
const deletionResultObject = z.object({ rootDiagramId: uuidSchema, mode: deletionModeSchema, affectedDiagrams: z.array(deletionSummarySchema).min(1) }).strict();
function orderedDeletionSummaries(value: z.infer<typeof deletionResultObject>, ctx: z.RefinementCtx) {
  const seen = new Map<string, { depth: number; kind: string }>(); let lastDepth = 0; let lastId = '';
  for (const [index, diagram] of value.affectedDiagrams.entries()) {
    const parent = diagram.scope ? seen.get(diagram.scope.parentDiagramId) : undefined;
    const depth = index === 0 ? 0 : parent === undefined ? -1 : parent.depth + 1;
    const wrongLevel = index > 0 && (diagram.kind === 'container' ? parent?.kind !== 'general' : diagram.kind === 'component' ? parent?.kind !== 'container' : true);
    if (seen.has(diagram.id) || (index === 0 && diagram.id !== value.rootDiagramId) || wrongLevel || depth < lastDepth || depth > 2 || (index > 0 && depth === lastDepth && diagram.id.localeCompare(lastId) <= 0)) ctx.addIssue({ code: 'custom', path: ['affectedDiagrams', index], message: 'Summaries must be unique, root first, then valid parent-before-child levels and UUID ordered at each depth' });
    seen.set(diagram.id, { depth, kind: diagram.kind }); lastDepth = depth; lastId = diagram.id;
  }
}
export const deletionResultSchema = deletionResultObject.superRefine(orderedDeletionSummaries);
export const deletionImpactSchema = deletionResultObject.extend({ confirmationToken: deletionConfirmationSchema.shape.confirmationToken }).strict().superRefine(orderedDeletionSummaries);
export const deletionErrorSchema = z.object({
  message: z.string().min(1), code: z.enum(['DELETE_INVALID_REQUEST', 'DELETE_NOT_FOUND', 'DELETE_NAME_AMBIGUOUS', 'DELETE_IMPACT_CHANGED', 'DIAGRAM_REFERENCE_BROKEN', 'DIAGRAM_DEPENDENCY', 'DELETE_FAILED']), remedy: z.string().min(1),
  candidates: z.array(deletionSummarySchema).optional(),
  blockers: z.array(z.object({ diagramId: uuidSchema, artifactId: uuidSchema, reason: z.string(), nextAction: z.string() }).strict()).optional(),
}).strict();
export type DeletionPreview = z.infer<typeof deletionPreviewSchema>;
export type DeletionConfirmation = z.infer<typeof deletionConfirmationSchema>;
export type DeletionImpact = z.infer<typeof deletionImpactSchema>;
export type DeletionResult = z.infer<typeof deletionResultSchema>;
export type DeletionError = z.infer<typeof deletionErrorSchema>;
export const collectionTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all-matches'), name: z.string().refine(name => /\S/.test(name), 'Name must not be blank'), mode: deletionModeSchema }).strict(),
  z.object({ kind: z.literal('clear-trash') }).strict(),
]);
export const collectionPreviewSchema = z.object({ target: collectionTargetSchema }).strict();
const collectionRootIdsSchema = z.array(uuidSchema).refine(ids => ids.every((id, index) => index === 0 || ids[index - 1].localeCompare(id) < 0), 'Root IDs must be unique and UUID sorted');
function collectionRoots(value: { target: z.infer<typeof collectionTargetSchema>; rootDiagramIds: string[] }, ctx: z.RefinementCtx) {
  if (value.target.kind === 'all-matches' ? !value.rootDiagramIds.length : value.rootDiagramIds.length !== 0) ctx.addIssue({ code: 'custom', path: ['rootDiagramIds'], message: 'All-matches requires reviewed roots; clear-trash requires an empty root set' });
}
export const collectionConfirmationSchema = z.object({ target: collectionTargetSchema, rootDiagramIds: collectionRootIdsSchema, confirmationToken: deletionConfirmationSchema.shape.confirmationToken }).strict().superRefine(collectionRoots);
const collectionResultObject = z.object({ target: collectionTargetSchema, mode: deletionModeSchema, rootDiagramIds: collectionRootIdsSchema, affectedDiagrams: z.array(deletionSummarySchema), affectedCount: z.number().int().nonnegative() }).strict();
function collectionSummaries(value: z.infer<typeof collectionResultObject>, ctx: z.RefinementCtx) {
  collectionRoots(value, ctx);
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (value.mode !== (value.target.kind === 'all-matches' ? value.target.mode : 'permanent')) issue(['mode'], 'Mode must match the target');
  if (value.affectedCount !== value.affectedDiagrams.length) issue(['affectedCount'], 'Count must equal unique affected summaries');
  const byId = new Map(value.affectedDiagrams.map(d => [d.id, d]));
  if (value.target.kind === 'all-matches') {
    const name = value.target.name;
    if (!value.affectedDiagrams.length || value.rootDiagramIds.some(id => byId.get(id)?.name !== name) || value.affectedDiagrams.some(d => d.name === name && !value.rootDiagramIds.includes(d.id))) issue(['affectedDiagrams'], 'Every eligible matching root must occur in both the reviewed roots and affected set');
  }
  const seen = new Set<string>(); let lastDepth = -1; let lastId = '';
  for (const [index, diagram] of value.affectedDiagrams.entries()) {
    const depth = diagram.kind === 'general' ? 0 : diagram.kind === 'container' ? 1 : 2;
    const parent = diagram.scope ? byId.get(diagram.scope.parentDiagramId) : undefined;
    if (seen.has(diagram.id) || depth < lastDepth || (depth === lastDepth && diagram.id.localeCompare(lastId) <= 0) || (parent && (diagram.kind === 'container' ? parent.kind !== 'general' : diagram.kind === 'component' ? parent.kind !== 'container' : true))) issue(['affectedDiagrams', index], 'Summaries must be unique and ordered by valid absolute hierarchy depth then UUID');
    if ((value.target.kind === 'clear-trash' && diagram.status !== 'trashed') || (value.target.kind === 'all-matches' && value.mode === 'trash' && diagram.status !== 'active')) issue(['affectedDiagrams', index, 'status'], 'Summary status is ineligible for this target');
    seen.add(diagram.id); lastDepth = depth; lastId = diagram.id;
  }
}
export const collectionResultSchema = collectionResultObject.superRefine(collectionSummaries);
export const collectionImpactSchema = collectionResultObject.extend({ confirmationToken: deletionConfirmationSchema.shape.confirmationToken }).strict().superRefine(collectionSummaries);
export type CollectionTarget = z.infer<typeof collectionTargetSchema>;
export type CollectionPreview = z.infer<typeof collectionPreviewSchema>;
export type CollectionConfirmation = z.infer<typeof collectionConfirmationSchema>;
export type CollectionImpact = z.infer<typeof collectionImpactSchema>;
export type CollectionResult = z.infer<typeof collectionResultSchema>;
export const containerAvailabilitySchema = z.object({ parentDiagramId:uuidSchema, softwareSystemId:uuidSchema, availability:z.enum(['none','active','trashed']), diagram:diagramSummarySchema.nullable() }).strict();
const uniqueDiagramIds = z.array(uuidSchema).min(1).refine(ids => new Set(ids).size === ids.length, 'Diagram IDs must be unique');
export const trashConfirmationSchema = z.object({ confirmedDiagramIds: uniqueDiagramIds, impactToken: z.string().regex(/^[0-9a-f]{64}$/).optional() }).strict();
export const restoreConfirmationSchema = z.object({ confirmedDiagramIds: uniqueDiagramIds, confirmedTrashBatchId: uuidSchema.nullable(), impactToken: z.string().regex(/^[0-9a-f]{64}$/).optional() }).strict();
export const trashImpactSchema = z.object({ impactToken: z.string().regex(/^[0-9a-f]{64}$/), diagramId: uuidSchema, affectedDiagramIds: uniqueDiagramIds, affectedDiagrams: z.array(diagramSummarySchema).min(1) }).strict().refine(value => value.affectedDiagramIds.includes(value.diagramId) && value.affectedDiagrams.length === value.affectedDiagramIds.length && new Set(value.affectedDiagrams.map(d => d.id)).size === value.affectedDiagramIds.length && value.affectedDiagrams.every(d => value.affectedDiagramIds.includes(d.id)), 'Impact summaries must match the affected IDs and include the root');
export const restoreImpactSchema = z.object({ impactToken: z.string().regex(/^[0-9a-f]{64}$/), requestedDiagramId: uuidSchema, restoreRootDiagramId: uuidSchema, trashBatchId: uuidSchema.nullable(), affectedDiagramIds: uniqueDiagramIds, affectedDiagrams: z.array(diagramSummarySchema).min(1), requestedDiagramIncluded: z.boolean() }).strict().refine(value => value.affectedDiagramIds.includes(value.restoreRootDiagramId) && value.requestedDiagramIncluded === value.affectedDiagramIds.includes(value.requestedDiagramId) && value.affectedDiagrams.length === value.affectedDiagramIds.length && new Set(value.affectedDiagrams.map(d => d.id)).size === value.affectedDiagramIds.length && value.affectedDiagrams.every(d => value.affectedDiagramIds.includes(d.id)), 'Impact summaries and requested inclusion must match the affected IDs');
export const containerContextSchema = z.object({ scope:containerScopeSchema, sources:z.array(z.object({ id:uuidSchema, name:componentNameSchema.max(200), description:z.string().nullable(), type:c4ArtifactTypeSchema }).strict()), capturedAt:z.string().datetime({offset:true}) }).strict();
export const componentAvailabilitySchema = z.object({ parentDiagramId: uuidSchema, containerId: uuidSchema, availability: z.enum(['none', 'active', 'trashed']), diagram: diagramSummarySchema.nullable() }).strict();
export const componentContextSchema = z.object({ scope: componentScopeSchema, sources: z.array(z.object({
  id: uuidSchema, name: componentNameSchema.max(200), description: z.string().nullable(), type: z.enum(['container', 'person', 'software-system']),
  containerType: containerTypeSchema.nullable(), technology: z.string().trim().max(200).nullable(), canonicalSourceComponentId: uuidSchema, sourceDiagramId: uuidSchema,
}).strict()), capturedAt: z.string().datetime({ offset: true }) }).strict();
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

// Keep the source boundary stricter than historical document date parsing without
// changing persistence or the legacy single-diagram API. Cross-member graph
// integrity is checked by source gathering and aggregate assembly, not this parser.
const htmlSourceDiagramSchema = diagramDocumentSchema.superRefine((document, ctx) => {
  // A failed legacy transform can carry z.NEVER into later refinements.
  if (!Array.isArray(document.components)) return;
  const date = z.string().datetime({ offset: true });
  const check = (value: string, path: (string | number)[]) => {
    if (!date.safeParse(value).success) ctx.addIssue({ code: 'custom', path, message: 'Must be a valid timestamp' });
  };
  check(document.createdAt, ['createdAt']); check(document.updatedAt, ['updatedAt']);
  if (document.trashedAt !== null) check(document.trashedAt, ['trashedAt']);
  for (const kind of ['components', 'relationships', 'groups'] as const) document[kind].forEach((artifact, index) => {
    check(artifact.createdAt, [kind, index, 'createdAt']); check(artifact.updatedAt, [kind, index, 'updatedAt']);
  });
});
const htmlSourceAdrSchema = z.object({
  id: uuidSchema, diagramId: uuidSchema, title: z.string(), context: z.string(), decision: z.string(), consequences: z.string(),
  alternativesOrConstraints: z.string().nullable(), status: adrStatusSchema, replacementAdrId: uuidSchema.nullable(),
  componentIds: z.array(uuidSchema), relationshipIds: z.array(uuidSchema),
  createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }),
}).pipe(architectureDecisionRecordSchema);
export const htmlExportSourceSchema = z.object({
  entryDiagramId: uuidSchema,
  sourceCapturedAt: z.string().datetime({ offset: true }),
  diagrams: z.array(z.object({ diagram: htmlSourceDiagramSchema, adrs: z.array(htmlSourceAdrSchema) }).strict()).min(1),
  availability: z.array(z.union([containerAvailabilitySchema, componentAvailabilitySchema])),
  sourceContexts: z.record(uuidSchema, z.union([containerContextSchema, componentContextSchema])),
}).strict();

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
