import { assertDiagramInvariants, diagramCreateSchema, diagramDocumentSchema, isC4ArtifactType, isContainerType, getDiagramOwnerId, getComponentScope, getContainerScope, type ComponentAvailability, type ComponentScope, type DiagramDependencyBlocker, type DiagramDocument } from '../../../shared/src/index';
import type { AdrDependencyBlocker } from '../../../shared/src/index';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import type { DiagramRepositoryLike, MaybePromise, RemoveComponentResult, RemoveRelationshipResult } from '../persistence/diagram-repository';
import { ApiValidationError } from '../api/errors';
import { ContainerContextService, resolveContainerScope, findPostgresError } from './container-context';
import { ComponentContextService } from './component-context';
import { GraphTransaction } from '../persistence/graph-transaction';
import { ApiConflictError } from '../api/errors';
import type { DiagramSummary, RestoreConfirmation, RestoreImpact, TrashImpact } from '../../../shared/src/index';

const summary = (d: DiagramDocument): DiagramSummary => ({ id: d.id, name: d.name, status: d.status, kind: d.kind ?? 'general', scope: d.scope ?? null, createdAt: d.createdAt, updatedAt: d.updatedAt });
const sameIds = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && [...a].sort().every((id, index) => id === [...b].sort()[index]);
const occurrenceBlocker = (child: DiagramDocument, occurrence: DiagramDocument['components'][number]): DiagramDependencyBlocker => ({ diagramId: child.id, name: child.name, status: child.status, componentId: occurrence.id, sourceComponentId: occurrence.sourceComponentId ?? undefined, reason: 'This immediate source is used by a supporting participant occurrence.', nextAction: `${child.status === 'trashed' ? 'Restore this child (and confirm ancestor recovery first if needed), then open it' : 'Open this child'} and explicitly remove occurrence ${occurrence.id} after resolving its relationship and ADR links. Keep its immediate source and canonical source intact until every dependent occurrence is removed.` });

export class DiagramNotFoundError extends Error {}
export class DiagramConflictError extends Error {}
export class ComponentDependencyConflictError extends DiagramConflictError {
  constructor(readonly componentId: string, readonly relationshipCount: number, readonly blockers: AdrDependencyBlocker[] = [], readonly groupIds: string[] = []) {
    super(blockers.length ? 'Component cannot be removed while it is linked to one or more ADRs. Repair those ADR links first.' : groupIds.length ? `Component cannot be removed while it belongs to system group${groupIds.length === 1 ? '' : 's'} ${groupIds.join(', ')}. Remove membership or ungroup first.` : `Component cannot be removed while it has ${relationshipCount} dependent relationship${relationshipCount === 1 ? '' : 's'}. Remove the relationships first.`);
    this.name = 'ComponentDependencyConflictError';
  }
}
export class RelationshipDependencyConflictError extends DiagramConflictError {
  constructor(readonly relationshipId: string, readonly blockers: AdrDependencyBlocker[]) {
    super('Relationship cannot be removed while it is linked to one or more ADRs. Repair those ADR links first.');
    this.name = 'RelationshipDependencyConflictError';
  }
}

const isPromise = <T>(value: MaybePromise<T>): value is Promise<T> => value instanceof Promise;

function invariantFields(document: DiagramDocument, message: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const groupIndex = (document.groups ?? []).findIndex(group => message.includes(group.id));
  if (groupIndex >= 0) {
    const suffix = /name|blank|duplicate/.test(message) ? 'name' : /layout|boundary/.test(message) ? 'size' : 'memberComponentIds';
    fields[`groups[${groupIndex}].${suffix}`] = message;
    return fields;
  }
  const componentIndex = document.components.findIndex(component => message.includes(component.id));
  if (componentIndex >= 0) fields[`components[${componentIndex}].type`] = message;
  else fields.document = message;
  return fields;
}

function assertApiInvariants(document: DiagramDocument): void {
  try { assertDiagramInvariants(document); }
  catch (error) { throw new ApiValidationError(invariantFields(document, error instanceof Error ? error.message : 'Invalid diagram')); }
}

export class DiagramService {
  private readonly containerContext: ContainerContextService;
  private readonly graph: GraphTransaction;
  private readonly componentContext: ComponentContextService;
  constructor(private readonly repository: DiagramRepositoryLike, private readonly adrs?: AdrRepositoryLike) { this.containerContext = new ContainerContextService(repository); this.componentContext = new ComponentContextService(repository); this.graph = new GraphTransaction(repository, adrs); }

  containerAvailability(diagramId: string, componentId: string) { return this.containerContext.availability(diagramId, componentId); }
  createOrOpenContainerDiagram(diagramId: string, componentId: string) { return this.containerContext.createOrOpen(diagramId, componentId); }
  containerSourceContext(diagramId: string) { return this.containerContext.context(diagramId); }
  componentSourceContext(diagramId: string) { return this.componentContext.context(diagramId); }

  async componentAvailability(diagramId: string, componentId: string): Promise<ComponentAvailability> {
    if (!await this.repository.get(diagramId)) throw new DiagramNotFoundError('Diagram not found');
    return this.graph.run(diagramId, [], async ({ diagrams }) => {
      const owner = await this.resolveComponentOwner(diagramId, componentId, diagrams);
      const child = await diagrams.findContainerForOwner(owner.scope.containerId);
      if (child) this.assertComponentChild(child, owner.scope);
      return { parentDiagramId: owner.scope.parentDiagramId, containerId: owner.scope.containerId, availability: !child ? 'none' : child.status === 'active' ? 'active' : 'trashed', diagram: child ? summary({ ...child, name: owner.scope.containerName, scope: owner.scope }) : null };
    });
  }

  async createOrOpenComponentDiagram(diagramId: string, componentId: string): Promise<{ document: DiagramDocument; created: boolean }> {
    if (!await this.repository.get(diagramId)) throw new DiagramNotFoundError('Diagram not found');
    const open = async (diagrams: DiagramRepositoryLike, create: boolean) => {
      const owner = await this.resolveComponentOwner(diagramId, componentId, diagrams);
      const child = await diagrams.findContainerForOwner(owner.scope.containerId);
      if (child) {
        this.assertComponentChild(child, owner.scope);
        if (child.status === 'trashed') throw new ApiConflictError('This container already has a Component diagram in Trash. Restore it before opening.', 'RESTORE_REQUIRED', summary({ ...child, name: owner.scope.containerName, scope: owner.scope }));
        return { document: await this.componentContext.hydrateAndValidateDocument(child, diagrams), created: false };
      }
      if (!create) throw new ApiConflictError('The canonical child changed during creation. Retry from the owning container.', 'DIAGRAM_REFERENCE_BROKEN');
      const now = new Date().toISOString();
      const document: DiagramDocument = { id: crypto.randomUUID(), name: owner.scope.containerName, kind: 'component', status: 'active', scope: owner.scope, boundary: { position: { x: 0, y: 0 }, size: { width: 480, height: 320 } }, components: [], relationships: [], groups: [], createdAt: now, updatedAt: now, trashedAt: null };
      const validated = await this.componentContext.hydrateAndValidateDocument(document, diagrams);
      return { document: await diagrams.create(validated), created: true };
    };
    try { return await this.graph.run(diagramId, [], ({ diagrams }) => open(diagrams, true)); }
    catch (error) {
      const pgError = findPostgresError(error);
      if (pgError.code !== '23505' || pgError.constraint !== 'diagrams_owner_component_unique') throw error;
      // A failed PostgreSQL transaction cannot be queried. Reread in a new coordinated transaction.
      return this.graph.run(diagramId, [], ({ diagrams }) => open(diagrams, false));
    }
  }

  private assertComponentChild(child: DiagramDocument, scope: ComponentScope): void {
    const childScope = getComponentScope(child);
    if (!childScope || childScope.parentDiagramId !== scope.parentDiagramId || childScope.containerId !== scope.containerId || childScope.systemContextDiagramId !== scope.systemContextDiagramId || childScope.softwareSystemId !== scope.softwareSystemId) throw new ApiConflictError('The canonical Component child has a broken owner or ancestor reference. Repair its saved association.', 'DIAGRAM_REFERENCE_BROKEN');
  }

  private async resolveComponentOwner(diagramId: string, componentId: string, diagrams: DiagramRepositoryLike): Promise<{ scope: ComponentScope }> {
    const source = await diagrams.get(diagramId);
    if (!source) throw new DiagramNotFoundError('Diagram not found');
    if (source.status !== 'active') throw new ApiConflictError('Restore the source diagram and its ancestors before opening a Component diagram.', 'PARENT_INACTIVE');
    await this.assertActiveAncestors(diagramId, diagrams);
    const selected = source.components.find(c => c.id === componentId);
    if (!selected) throw new DiagramNotFoundError('Component not found in this diagram');
    let parent = source, ownerId = selected.id;
    if (source.kind === 'component' && selected.role === 'external' && selected.type === 'container') {
      const context = await this.componentContext.contextFromRepository(source, diagrams);
      const candidate = context.sources.find(c => c.id === selected.sourceComponentId);
      if (!candidate || candidate.type !== 'container' || candidate.canonicalSourceComponentId !== candidate.id || candidate.sourceDiagramId !== context.scope.parentDiagramId) throw new ApiConflictError('This supporting container has a broken immediate source. Repair it in its parent Container diagram.', 'DIAGRAM_REFERENCE_BROKEN');
      parent = (await diagrams.get(candidate.sourceDiagramId))!; ownerId = candidate.id;
    } else if (source.kind !== 'container' || selected.role !== 'container' || selected.type !== 'container') {
      throw new ApiValidationError({ componentId: 'Only an internal Application/Datastore or a supporting container can open a Component diagram.' });
    }
    const parentScope = getContainerScope(parent);
    if (!parentScope) throw new ApiConflictError('The owning Container has a broken parent association.', 'DIAGRAM_REFERENCE_BROKEN');
    const ancestor = resolveContainerScope(parent, await diagrams.get(parentScope.parentDiagramId));
    const owner = parent.components.find(c => c.id === ownerId);
    if (!owner || owner.diagramId !== parent.id || owner.role !== 'container' || owner.type !== 'container' || !isContainerType(owner.containerType) || owner.sourceComponentId || !owner.name.trim() || !owner.description?.trim() || !owner.technology?.trim()) throw new ApiConflictError('The owning Application/Datastore reference is missing or ineligible. Repair it in the parent Container.', 'DIAGRAM_REFERENCE_BROKEN');
    return { scope: { parentDiagramId: parent.id, containerId: owner.id, parentDiagramName: ancestor.owner.name, containerName: owner.name, containerDescription: owner.description, containerTechnology: owner.technology, containerType: owner.containerType, systemContextDiagramId: ancestor.parent.id, softwareSystemId: ancestor.owner.id, softwareSystemName: ancestor.owner.name } };
  }
  listSummaries(status: 'active' | 'trashed' = 'active') { return this.containerContext.summaries(status); }

  create(name: string): MaybePromise<DiagramDocument> {
    const input = diagramCreateSchema.parse({ name });
    const now = new Date().toISOString();
    return this.repository.create({
      id: crypto.randomUUID(), name: input.name.trim(), status: 'active',
      createdAt: now, updatedAt: now, trashedAt: null, components: [], relationships: [], groups: [],
    });
  }

  async load(id: string): Promise<DiagramDocument> {
    const document = await this.repository.get(id);
    if (!document || document.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
    if (document.kind === 'component') return this.graph.run(id, [], async ({ diagrams }) => {
      const current = await diagrams.get(id);
      if (!current || current.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
      return this.componentContext.hydrateAndValidateDocument(current, diagrams);
    });
    if (document.kind === 'container') {
      try { return await this.containerContext.resolveDocument(id); }
      catch (error) {
        if (error instanceof Error && error.name === 'ContainerContextNotFoundError') throw new DiagramNotFoundError(error.message);
        throw error;
      }
    }
    return document;
  }

  async save(id: string, input: unknown): Promise<DiagramDocument> {
    if (input && typeof input === 'object' && ('trashBatchId' in input || 'trashRootDiagramId' in input)) throw new ApiValidationError({ status:'Server-managed recovery provenance cannot be changed through a document save.' });
    const document = diagramDocumentSchema.parse(input) as DiagramDocument;
    if (document.id !== id) throw new ApiValidationError({ id: 'Path and document IDs must match. Save to this document’s original UUID.' });
    const initial = await this.repository.get(id);
    if (!initial || initial.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
    const parentDiagramId = initial.scope?.parentDiagramId ?? initial.id;
    if (!parentDiagramId) throw new ApiConflictError('The container diagram is missing its parent association.', 'DIAGRAM_REFERENCE_BROKEN');
    const children = initial.kind === 'container' ? [initial] : await this.repository.findChildren(initial.id);
    return this.graph.run(parentDiagramId, children.map(child => child.id), async ({ diagrams, adrs }) => {
      const previous = await diagrams.get(id);
      if (!previous || previous.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
      await this.assertActiveAncestors(id, diagrams);
      const currentChildren = await diagrams.findChildren(id);
      const hierarchyBlockers = await this.hierarchyBlockers(document, diagrams, currentChildren);
      if (hierarchyBlockers.length) throw new ApiConflictError('Keep the owners and immediate sources used by active or recoverable child diagrams. Repair their dependencies first.', 'DIAGRAM_DEPENDENCY', undefined, undefined, hierarchyBlockers);
      this.assertDocumentTransition(previous, document);
      const incoming = previous.kind === 'container'
        ? await this.containerContext.hydrateAndValidateDocument(document, diagrams)
        : previous.kind === 'component' ? await this.componentContext.hydrateAndValidateDocument(document, diagrams) : document;
      assertApiInvariants(incoming);
      this.assertDocumentTransition(previous, incoming);
      if (incoming.components.some(component => component.diagramId !== id)) throw new ApiValidationError({ components:'Every component must belong to the saved diagram.' });
      if (incoming.relationships.some(relationship => relationship.diagramId !== id)) throw new ApiValidationError({ relationships:'Every relationship must belong to the saved diagram.' });
      await this.assertArtifactRemovalAllowed(previous, incoming, adrs);
      const saved = await diagrams.replace({
        ...incoming,
        name:incoming.name.trim(),
        components:incoming.components.map(component => ({ ...component, name:component.name.trim() })),
        relationships:incoming.relationships.map(relationship => ({ ...relationship, label:relationship.label?.trim() || null, protocol:relationship.protocol?.trim() || null })),
        groups:incoming.groups.map(group => ({ ...group, name:group.name.trim(), memberComponentIds:[...group.memberComponentIds] })),
      });
      if (!saved) throw new DiagramNotFoundError('Diagram not found');
      return saved;
    });
  }

  private assertDocumentTransition(previous: DiagramDocument, incoming: DiagramDocument): void {
    const previousKind = previous.kind ?? 'general';
    const incomingKind = incoming.kind ?? 'general';
    if (previousKind !== incomingKind) throw new ApiConflictError('Diagram kind is immutable after creation.', 'IMMUTABLE_SCOPE');
    if (previous.status !== incoming.status || previous.trashedAt !== incoming.trashedAt) throw new ApiConflictError('Diagram recovery status can only be changed through the recovery workflow.', 'IMMUTABLE_SCOPE');
    if (previousKind !== 'general') {
      const before = previous.scope;
      const next = incoming.scope;
      if (!before || !next || before.parentDiagramId !== next.parentDiagramId || getDiagramOwnerId(previous) !== getDiagramOwnerId(incoming) || !incoming.boundary) {
        throw new ApiConflictError('Diagram ownership is immutable after creation. Keep its original parent and owner UUIDs.', 'IMMUTABLE_SCOPE');
      }
      if (previousKind === 'component') {
        const beforeComponent = getComponentScope(previous); const nextComponent = getComponentScope(incoming);
        if (!beforeComponent || !nextComponent || beforeComponent.softwareSystemId !== nextComponent.softwareSystemId || beforeComponent.systemContextDiagramId !== nextComponent.systemContextDiagramId) throw new ApiConflictError('Component ancestor identities are immutable. Keep the original Context and Software System references.', 'IMMUTABLE_SCOPE');
      }
    }
    {
      const incomingById = new Map(incoming.components.map(component => [component.id, component]));
      for (const component of previous.components) {
        const next = incomingById.get(component.id);
        if (next && ((next.role ?? 'element') !== (component.role ?? 'element') || (next.sourceComponentId ?? null) !== (component.sourceComponentId ?? null))) {
          throw new ApiConflictError('An existing element cannot change its role or source identity. Remove it explicitly after resolving its dependencies, then add a new occurrence.', 'IMMUTABLE_SCOPE');
        }
      }
    }
  }

  private findHierarchyBlockers(incoming: DiagramDocument, children: DiagramDocument[]): DiagramDependencyBlocker[] {
    const blockers: DiagramDependencyBlocker[] = [];
    for (const child of children) {
      if (!child.scope) throw new ApiConflictError(`Child diagram ${child.id} has a missing owner scope. Repair its saved parent and owner references before editing this graph.`, 'DIAGRAM_REFERENCE_BROKEN');
      const ownerId = getDiagramOwnerId(child)!;
      const owner = incoming.components.find(component => component.id === ownerId);
      const ownerValid = child.kind === 'component' ? owner?.role === 'container' && owner.type === 'container' && isContainerType(owner.containerType) : owner && (owner.role ?? 'element') === 'element' && owner.type === 'software-system';
      if (!ownerValid) blockers.push({ diagramId:child.id, name:child.name, status:child.status, componentId:ownerId, reason:`This element owns a ${child.kind} diagram.`, nextAction:child.kind === 'component' ? 'Keep the owning Application/Datastore and its UUID, or trash the parent graph through confirmed recovery.' : 'Keep the owning Software System as an ordinary Software System or trash the parent diagram.' });
      for (const occurrence of child.components.filter(component => component.role === 'external')) {
        const source = incoming.components.find(component => component.id === occurrence.sourceComponentId);
        const validSource = child.kind === 'component' ? source && (source.role === 'container' && source.type === 'container' && isContainerType(source.containerType) || source.role === 'external' && isC4ArtifactType(source.type) && !!source.sourceComponentId) : source && (source.role ?? 'element') === 'element' && isC4ArtifactType(source.type);
        if (!validSource) blockers.push(occurrenceBlocker(child, occurrence));
      }
    }
    return blockers.filter((blocker, index, all) => all.findIndex(candidate => candidate.diagramId === blocker.diagramId && candidate.componentId === blocker.componentId && candidate.sourceComponentId === blocker.sourceComponentId) === index);
  }

  private async hierarchyBlockers(incoming: DiagramDocument, repository: DiagramRepositoryLike, children?: DiagramDocument[]): Promise<DiagramDependencyBlocker[]> {
    const immediate = children ?? await repository.findChildren(incoming.id);
    const blockers = this.findHierarchyBlockers(incoming, immediate);
    // A Context source is also used through the exact Container occurrence; report both hops.
    for (const child of immediate) {
      const childBlockers = blockers.filter(b => b.diagramId === child.id);
      if (!childBlockers.length) continue;
      for (const descendant of await repository.findChildren(child.id)) {
        for (const occurrence of descendant.components.filter(c => c.role === 'external' && childBlockers.some(b => b.componentId === c.sourceComponentId))) blockers.push(occurrenceBlocker(descendant, occurrence));
        if (childBlockers.some(b => b.componentId === getDiagramOwnerId(child))) blockers.push({ diagramId: descendant.id, name: descendant.name, status: descendant.status, componentId: getDiagramOwnerId(descendant) ?? undefined, reason: 'The owning ancestor is required by this Component diagram.', nextAction: 'Keep the ancestor owner and its UUID. Use confirmed graph recovery to move the hierarchy to trash.' });
      }
    }
    return blockers;
  }

  private async assertActiveAncestors(id: string, diagrams: DiagramRepositoryLike): Promise<void> {
    for (const ancestor of await diagrams.findAncestors(id)) if (ancestor.status !== 'active') throw new ApiConflictError('Restore every inactive ancestor before changing this diagram.', 'PARENT_INACTIVE');
  }

  private async validateScopedDocument(document: DiagramDocument, diagrams: DiagramRepositoryLike): Promise<void> {
    await this.assertActiveAncestors(document.id, diagrams);
    if (document.kind === 'container') await this.containerContext.hydrateAndValidateDocument(document, diagrams);
    if (document.kind === 'component') await this.componentContext.hydrateAndValidateDocument(document, diagrams);
  }

  private async assertArtifactRemovalAllowed(previous: DiagramDocument, incoming: DiagramDocument, adrs?: AdrRepositoryLike): Promise<void> {
    const incomingComponents = new Set(incoming.components.map(component => component.id));
    const incomingRelationships = new Set(incoming.relationships.map(relationship => relationship.id));
    for (const component of previous.components) {
      if (incomingComponents.has(component.id)) continue;
      const relationshipCount = previous.relationships.filter(relationship => relationship.sourceComponentId === component.id || relationship.targetComponentId === component.id).length;
      const groupIds = (previous.groups ?? []).filter(group => group.memberComponentIds.includes(component.id)).map(group => group.id);
      if (relationshipCount || groupIds.length) throw new ComponentDependencyConflictError(component.id, relationshipCount, [], groupIds);
      const blockers = adrs ? await adrs.componentBlockers(component.id) : [];
      if (blockers.length) throw new ApiConflictError('Component cannot be removed while it is linked to one or more ADRs. Repair those ADR links first.', 'DIAGRAM_DEPENDENCY', undefined, blockers);
    }
    for (const relationship of previous.relationships) {
      if (incomingRelationships.has(relationship.id)) continue;
      const blockers = adrs ? await adrs.relationshipBlockers(relationship.id) : [];
      if (blockers.length) throw new ApiConflictError('Relationship cannot be removed while it is linked to one or more ADRs. Repair those ADR links first.', 'DIAGRAM_DEPENDENCY', undefined, blockers);
    }
  }

  dependencyCount(diagramId: string, componentId: string): MaybePromise<number> {
    const result = this.repository.get(diagramId);
    const resolve = (document: DiagramDocument | undefined) => {
      if (!document || document.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
      if (!document.components.some(component => component.id === componentId)) throw new DiagramNotFoundError('Component not found');
      return document.relationships.filter(r => r.sourceComponentId === componentId || r.targetComponentId === componentId).length;
    };
    return isPromise(result) ? result.then(resolve) : resolve(result);
  }

  async componentDependencies(diagramId: string, componentId: string) {
    const initial = await this.repository.get(diagramId);
    if (!initial) throw new DiagramNotFoundError('Diagram not found');
    const parentId = initial.scope?.parentDiagramId ?? diagramId;
    return this.graph.run(parentId, (await this.repository.findChildren(parentId)).map(c => c.id), async ({ diagrams, adrs }) => {
      const current = await diagrams.get(diagramId);
      if (!current || current.status !== 'active' || !current.components.some(c => c.id === componentId)) throw new DiagramNotFoundError('Diagram or component not found');
      await this.validateScopedDocument(current, diagrams);
      const relationships = current.relationships.filter(r => r.sourceComponentId === componentId || r.targetComponentId === componentId);
      const blockers = adrs ? (await Promise.all([adrs.componentBlockers(componentId), ...relationships.map(r => adrs.relationshipBlockers(r.id))])).flat() : [];
      return { relationshipCount: relationships.length, groupIds: current.groups.filter(g => g.memberComponentIds.includes(componentId)).map(g => g.id), blockers: blockers.filter((b, i, all) => all.findIndex(other => other.adrId === b.adrId) === i), diagramBlockers: await this.hierarchyBlockers({ ...current, components: current.components.filter(c => c.id !== componentId) }, diagrams) };
    });
  }

  async removeComponent(diagramId: string, componentId: string): Promise<Extract<RemoveComponentResult, { document: DiagramDocument }>> {
    const initial = await this.repository.get(diagramId);
    if (!initial || initial.status !== 'active' || !initial.components.some(component => component.id === componentId)) throw new DiagramNotFoundError('Diagram or component not found');
    const parentDiagramId = initial.scope?.parentDiagramId ?? diagramId;
    if (!parentDiagramId) throw new ApiConflictError('The container diagram is missing its parent association.', 'DIAGRAM_REFERENCE_BROKEN');
    const children = await this.repository.findChildren(parentDiagramId);
    return this.graph.run(parentDiagramId, children.map(child => child.id), async ({ diagrams, adrs }) => {
      const current = await diagrams.get(diagramId);
      if (!current || current.status !== 'active' || !current.components.some(component => component.id === componentId)) throw new DiagramNotFoundError('Diagram or component not found');
      await this.validateScopedDocument(current, diagrams);
      const blockers = await this.hierarchyBlockers({ ...current, components: current.components.filter(c => c.id !== componentId) }, diagrams);
      if (blockers.length) throw new ApiConflictError('Element cannot be removed while active or recoverable child diagrams depend on it.', 'DIAGRAM_DEPENDENCY', undefined, undefined, blockers);
      const dependentRelationships = current.relationships.filter(relationship => relationship.sourceComponentId === componentId || relationship.targetComponentId === componentId);
      const adrBlockers = adrs ? await Promise.all([adrs.componentBlockers(componentId), ...dependentRelationships.map(relationship => adrs.relationshipBlockers(relationship.id))]) : [];
      const combined = adrBlockers.flat().filter((blocker,index,all) => all.findIndex(candidate => candidate.adrId === blocker.adrId) === index);
      if (combined.length) throw new ComponentDependencyConflictError(componentId, dependentRelationships.length, combined, []);
      const removal = await diagrams.removeComponent(diagramId, componentId);
      if (!removal) throw new DiagramNotFoundError('Diagram or component not found');
      if ('conflict' in removal) throw new ComponentDependencyConflictError(componentId, removal.relationshipCount, [], removal.groupIds);
      return removal;
    });
  }

  async removeRelationship(diagramId: string, relationshipId: string): Promise<Extract<RemoveRelationshipResult, { document: DiagramDocument }>> {
    const initial = await this.repository.get(diagramId);
    if (!initial || initial.status !== 'active' || !initial.relationships.some(relationship => relationship.id === relationshipId)) throw new DiagramNotFoundError('Diagram or relationship not found');
    const parentDiagramId = initial.scope?.parentDiagramId ?? diagramId;
    if (!parentDiagramId) throw new ApiConflictError('The container diagram is missing its parent association.', 'DIAGRAM_REFERENCE_BROKEN');
    const children = await this.repository.findChildren(parentDiagramId);
    return this.graph.run(parentDiagramId, children.map(child => child.id), async ({ diagrams, adrs }) => {
      const current = await diagrams.get(diagramId);
      if (!current || current.status !== 'active' || !current.relationships.some(relationship => relationship.id === relationshipId)) throw new DiagramNotFoundError('Diagram or relationship not found');
      await this.validateScopedDocument(current, diagrams);
      const blockers = adrs ? await adrs.relationshipBlockers(relationshipId) : [];
      if (blockers.length) throw new RelationshipDependencyConflictError(relationshipId, blockers);
      const removal = await diagrams.removeRelationship(diagramId, relationshipId);
      if (!removal) throw new DiagramNotFoundError('Diagram or relationship not found');
      if ('conflict' in removal) throw new DiagramConflictError('Relationship cannot be removed.');
      return removal;
    });
  }

  private async recoveryTransaction<T>(id: string, action: (repository: DiagramRepositoryLike) => Promise<T>): Promise<T> {
    const initial = await this.repository.get(id);
    if (!initial) throw new DiagramNotFoundError('Diagram not found');
    return this.graph.run(id, [], ({ diagrams }) => action(diagrams));
  }

  private async trashSnapshot(id: string, repository: DiagramRepositoryLike): Promise<TrashImpact> {
    const root = await repository.get(id);
    if (!root || root.status !== 'active') throw new DiagramNotFoundError('Active diagram not found');
    const children = await Promise.all((await repository.findDescendants(id)).filter(child => child.status === 'active').map(async child => {
      const document = await repository.get(child.id);
      if (!document) throw new ApiConflictError('A required descendant is unavailable. Repair its saved references before recovery.', 'DIAGRAM_REFERENCE_BROKEN');
      return document;
    }));
    const affected = [root, ...children].sort((a, b) => a.id.localeCompare(b.id));
    return { diagramId: id, affectedDiagramIds: affected.map(d => d.id), affectedDiagrams: affected.map(summary) };
  }

  trashImpact(id: string): Promise<TrashImpact> { return this.recoveryTransaction(id, repository => this.trashSnapshot(id, repository)); }

  async trash(id: string, confirmedDiagramIds?: string[]): Promise<DiagramDocument> {
    return this.recoveryTransaction(id, async repository => {
      const impact = await this.trashSnapshot(id, repository);
      if ((confirmedDiagramIds && !sameIds(confirmedDiagramIds, impact.affectedDiagramIds)) || (!confirmedDiagramIds && impact.affectedDiagramIds.length > 1)) throw new ApiConflictError('The affected diagrams changed or require confirmation. Preview and confirm the full named set again.', 'TRASH_IMPACT_CHANGED');
      const provenance = { trashBatchId: crypto.randomUUID(), trashRootDiagramId: id };
      for (const affectedId of impact.affectedDiagramIds) {
        if (!await repository.trash(affectedId, provenance)) throw new DiagramConflictError('Diagram activity changed while moving the batch to trash.');
      }
      return (await repository.get(id))!;
    });
  }

  private async restoreSnapshot(id: string, repository: DiagramRepositoryLike): Promise<RestoreImpact> {
    const requested = await repository.get(id);
    if (!requested) throw new DiagramNotFoundError('Diagram not found');
    if (requested.status !== 'trashed') throw new DiagramConflictError('Diagram is not trashed');
    let root = requested;
    for (const ancestor of await repository.findAncestors(id)) {
      if (ancestor.status === 'trashed') {
        const parent = await repository.get(ancestor.id);
        if (!parent) throw new ApiConflictError('Repair the missing parent reference before restoring.', 'DIAGRAM_REFERENCE_BROKEN');
        root = parent;
      }
    }
    const provenance = await repository.getTrashProvenance(root.id);
    const affected = [root];
    if (provenance.trashBatchId && provenance.trashRootDiagramId === root.id) {
      for (const child of await repository.findDescendants(root.id)) {
        const childProvenance = await repository.getTrashProvenance(child.id);
        if (child.status === 'trashed' && childProvenance.trashRootDiagramId === root.id && childProvenance.trashBatchId === provenance.trashBatchId) {
          const document = await repository.get(child.id);
          if (!document) throw new ApiConflictError('A required batch member is unavailable. Repair its references before recovery.', 'DIAGRAM_REFERENCE_BROKEN');
          affected.push(document);
        }
      }
    }
    affected.sort((a, b) => a.id.localeCompare(b.id));
    return { requestedDiagramId: id, restoreRootDiagramId: root.id, trashBatchId: provenance.trashBatchId, affectedDiagramIds: affected.map(d => d.id), affectedDiagrams: affected.map(summary), requestedDiagramIncluded: affected.some(d => d.id === id) };
  }

  restoreImpact(id: string): Promise<RestoreImpact> { return this.recoveryTransaction(id, repository => this.restoreSnapshot(id, repository)); }

  async restore(id: string, confirmation?: RestoreConfirmation): Promise<DiagramDocument> {
    return this.recoveryTransaction(id, async repository => {
      const impact = await this.restoreSnapshot(id, repository);
      if (impact.restoreRootDiagramId !== id) throw new ApiConflictError('Restore the parent and its confirmed trash batch before restoring this child.', 'PARENT_INACTIVE', undefined, undefined, undefined, impact.restoreRootDiagramId);
      if (!confirmation && impact.affectedDiagramIds.length > 1) throw new ApiConflictError('Preview and confirm every diagram in this restoration batch.', 'RESTORE_CONFIRMATION_REQUIRED', undefined, undefined, undefined, id);
      if (confirmation && (!sameIds(confirmation.confirmedDiagramIds, impact.affectedDiagramIds) || confirmation.confirmedTrashBatchId !== impact.trashBatchId)) throw new ApiConflictError('The restoration set or trash batch changed. Preview and confirm again.', 'RESTORE_IMPACT_CHANGED', undefined, undefined, undefined, id);
      // Stage the entire post-restore graph on the transaction. Any invalid reference rolls it all back.
      const ordered = [id, ...(await repository.findDescendants(id)).filter(member => impact.affectedDiagramIds.includes(member.id)).map(member => member.id)];
      for (const affectedId of ordered) if (!await repository.restore(affectedId)) throw new DiagramConflictError('Diagram activity changed during restoration.');
      for (const affectedId of ordered) {
        const document = (await repository.get(affectedId))!;
        if (document.kind === 'container') await this.containerContext.hydrateAndValidateDocument(document, repository);
        else if (document.kind === 'component') await this.componentContext.hydrateAndValidateDocument(document, repository);
        else assertApiInvariants(document);
      }
      const restored = (await repository.get(id))!;
      return restored.kind === 'container' ? this.containerContext.hydrateAndValidateDocument(restored, repository) : restored.kind === 'component' ? this.componentContext.hydrateAndValidateDocument(restored, repository) : restored;
    });
  }
}
