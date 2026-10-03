import { assertDiagramInvariants, diagramCreateSchema, diagramDocumentSchema, isC4ArtifactType, type DiagramDependencyBlocker, type DiagramDocument } from '../../../shared/src/index';
import type { AdrDependencyBlocker } from '../../../shared/src/index';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import type { DiagramRepositoryLike, MaybePromise, RemoveComponentResult, RemoveRelationshipResult } from '../persistence/diagram-repository';
import { ApiValidationError } from '../api/errors';
import { ContainerContextService } from './container-context';
import { GraphTransaction } from '../persistence/graph-transaction';
import { ApiConflictError } from '../api/errors';

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
  constructor(private readonly repository: DiagramRepositoryLike, private readonly adrs?: AdrRepositoryLike) { this.containerContext = new ContainerContextService(repository); this.graph = new GraphTransaction(repository, adrs); }

  containerAvailability(diagramId: string, componentId: string) { return this.containerContext.availability(diagramId, componentId); }
  createOrOpenContainerDiagram(diagramId: string, componentId: string) { return this.containerContext.createOrOpen(diagramId, componentId); }
  containerSourceContext(diagramId: string) { return this.containerContext.context(diagramId); }
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
    if (document.id !== id) throw new Error('Path and document IDs must match');
    const initial = await this.repository.get(id);
    if (!initial || initial.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
    const parentDiagramId = initial.kind === 'container' ? initial.scope?.parentDiagramId : initial.id;
    if (!parentDiagramId) throw new ApiConflictError('The container diagram is missing its parent association.', 'DIAGRAM_REFERENCE_BROKEN');
    const children = initial.kind === 'container' ? [initial] : await this.repository.findChildren(initial.id);
    return this.graph.run(parentDiagramId, children.map(child => child.id), async ({ diagrams, adrs }) => {
      const previous = await diagrams.get(id);
      if (!previous || previous.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
      const incoming = previous.kind === 'container'
        ? await this.containerContext.hydrateAndValidateDocument(document, diagrams)
        : document;
      assertApiInvariants(incoming);
      this.assertDocumentTransition(previous, incoming);
      if (incoming.components.some(component => component.diagramId !== id)) throw new ApiValidationError({ components:'Every component must belong to the saved diagram.' });
      if (incoming.relationships.some(relationship => relationship.diagramId !== id)) throw new ApiValidationError({ relationships:'Every relationship must belong to the saved diagram.' });
      const currentChildren = previous.kind === 'general' ? await diagrams.findChildren(id) : [];
      const hierarchyBlockers = this.findHierarchyBlockers(incoming, currentChildren);
      if (hierarchyBlockers.length) throw new ApiConflictError('This diagram has dependent container diagrams that must be repaired first.', 'DIAGRAM_DEPENDENCY', undefined, undefined, hierarchyBlockers);
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
    if (previousKind === 'container') {
      const before = previous.scope;
      const next = incoming.scope;
      if (!before || !next || before.parentDiagramId !== next.parentDiagramId || before.softwareSystemId !== next.softwareSystemId || !incoming.boundary) {
        throw new ApiConflictError('Container diagram ownership is immutable after creation.', 'IMMUTABLE_SCOPE');
      }
    }
    if (previousKind === 'container') {
      const incomingById = new Map(incoming.components.map(component => [component.id, component]));
      for (const component of previous.components.filter(item => item.role === 'external')) {
        const next = incomingById.get(component.id);
        if (next && (next.role !== 'external' || next.sourceComponentId !== component.sourceComponentId)) {
          throw new ApiConflictError('An external occurrence cannot change its role or source identity.', 'IMMUTABLE_SCOPE');
        }
      }
    }
  }

  private findHierarchyBlockers(incoming: DiagramDocument, children: DiagramDocument[]): DiagramDependencyBlocker[] {
    if ((incoming.kind ?? 'general') !== 'general') return [];
    const blockers: DiagramDependencyBlocker[] = [];
    for (const child of children) {
      if (child.kind !== 'container' || !child.scope) continue;
      const owner = incoming.components.find(component => component.id === child.scope!.softwareSystemId);
      const ownerValid = owner && (owner.role ?? 'element') === 'element' && owner.type === 'software-system';
      if (!ownerValid) blockers.push({ diagramId:child.id, name:child.name, status:child.status, componentId:child.scope.softwareSystemId, reason:'This Software System owns a container diagram.', nextAction:'Keep the owning Software System as an ordinary Software System or trash the parent diagram.' });
      for (const occurrence of child.components.filter(component => component.role === 'external')) {
        const source = incoming.components.find(component => component.id === occurrence.sourceComponentId);
        if (!source || (source.role ?? 'element') !== 'element' || !isC4ArtifactType(source.type)) blockers.push({ diagramId:child.id, name:child.name, status:child.status, sourceComponentId:occurrence.sourceComponentId ?? undefined, reason:'This source is used by an external participant occurrence.', nextAction:'Keep the source as a Person or Software System until its occurrences are removed.' });
      }
    }
    return blockers.filter((blocker, index, all) => all.findIndex(candidate => candidate.diagramId === blocker.diagramId && candidate.componentId === blocker.componentId && candidate.sourceComponentId === blocker.sourceComponentId) === index);
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

  async removeComponent(diagramId: string, componentId: string): Promise<Extract<RemoveComponentResult, { document: DiagramDocument }>> {
    const initial = await this.repository.get(diagramId);
    if (!initial || initial.status !== 'active' || !initial.components.some(component => component.id === componentId)) throw new DiagramNotFoundError('Diagram or component not found');
    const parentDiagramId = initial.kind === 'container' ? initial.scope?.parentDiagramId : diagramId;
    if (!parentDiagramId) throw new ApiConflictError('The container diagram is missing its parent association.', 'DIAGRAM_REFERENCE_BROKEN');
    const children = await this.repository.findChildren(parentDiagramId);
    return this.graph.run(parentDiagramId, children.map(child => child.id), async ({ diagrams, adrs }) => {
      const current = await diagrams.get(diagramId);
      if (!current || current.status !== 'active' || !current.components.some(component => component.id === componentId)) throw new DiagramNotFoundError('Diagram or component not found');
      if (current.kind === 'general') {
        const blockers: DiagramDependencyBlocker[] = [];
        for (const child of await diagrams.findChildren(diagramId)) {
          if (child.kind !== 'container' || !child.scope) continue;
          if (child.scope.softwareSystemId === componentId) blockers.push({ diagramId:child.id, name:child.name, status:child.status, componentId, reason:'This Software System owns a container diagram.', nextAction:'Keep the owning Software System or trash the parent diagram.' });
          if (child.components.some(component => component.role === 'external' && component.sourceComponentId === componentId)) blockers.push({ diagramId:child.id, name:child.name, status:child.status, sourceComponentId:componentId, reason:'This source is used by an external participant occurrence.', nextAction:'Remove its external occurrences after resolving their local dependencies.' });
        }
        if (blockers.length) throw new ApiConflictError('Component cannot be removed while container diagrams depend on it.', 'DIAGRAM_DEPENDENCY', undefined, undefined, blockers);
      }
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
    const parentDiagramId = initial.kind === 'container' ? initial.scope?.parentDiagramId : diagramId;
    if (!parentDiagramId) throw new ApiConflictError('The container diagram is missing its parent association.', 'DIAGRAM_REFERENCE_BROKEN');
    const children = await this.repository.findChildren(parentDiagramId);
    return this.graph.run(parentDiagramId, children.map(child => child.id), async ({ diagrams, adrs }) => {
      const current = await diagrams.get(diagramId);
      if (!current || current.status !== 'active' || !current.relationships.some(relationship => relationship.id === relationshipId)) throw new DiagramNotFoundError('Diagram or relationship not found');
      const blockers = adrs ? await adrs.relationshipBlockers(relationshipId) : [];
      if (blockers.length) throw new RelationshipDependencyConflictError(relationshipId, blockers);
      const removal = await diagrams.removeRelationship(diagramId, relationshipId);
      if (!removal) throw new DiagramNotFoundError('Diagram or relationship not found');
      if ('conflict' in removal) throw new DiagramConflictError('Relationship cannot be removed.');
      return removal;
    });
  }

  trash(id: string): MaybePromise<DiagramDocument> {
    const result = this.repository.trash(id);
    const resolve = (document: DiagramDocument | undefined) => {
      if (!document) throw new DiagramNotFoundError('Active diagram not found');
      return document;
    };
    return isPromise(result) ? result.then(resolve) : resolve(result);
  }

  restore(id: string): MaybePromise<DiagramDocument> {
    const result = this.repository.restore(id);
    const resolve = (document: DiagramDocument | undefined) => {
      if (document) return document;
      const existing = this.repository.get(id);
      if (isPromise(existing)) return existing.then(found => { if (found) throw new DiagramConflictError('Diagram is not trashed'); throw new DiagramNotFoundError('Diagram not found'); });
      if (existing) throw new DiagramConflictError('Diagram is not trashed');
      throw new DiagramNotFoundError('Diagram not found');
    };
    return isPromise(result) ? result.then(resolve) : resolve(result);
  }
}
