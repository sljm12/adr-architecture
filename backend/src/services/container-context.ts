import { assertDiagramInvariants, diagramDocumentSchema, getDiagramName, isC4ArtifactType, type ContainerAvailability, type ContainerContext, type DiagramDocument, type DiagramSummary } from '../../../shared/src/index';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { GraphTransaction } from '../persistence/graph-transaction';
import { ApiConflictError, ApiValidationError } from '../api/errors';

export class ContainerContextNotFoundError extends Error {}

interface ResolvedOwner {
  parent: DiagramDocument;
  owner: DiagramDocument['components'][number];
  scope: NonNullable<DiagramDocument['scope']>;
}

export class ContainerContextService {
  private readonly graph: GraphTransaction;

  constructor(private readonly repository: DiagramRepositoryLike) { this.graph = new GraphTransaction(repository); }

  async summaries(status: 'active' | 'trashed'): Promise<DiagramSummary[]> {
    const documents = await this.repository.listAll();
    const byId = new Map(documents.map(document => [document.id, document]));
    return documents.filter(document => document.status === status).map(document => {
      if (document.kind !== 'container') return this.summary(document);
      const parent = document.scope ? byId.get(document.scope.parentDiagramId) : undefined;
      const owner = parent?.components.find(component => component.id === document.scope?.softwareSystemId);
      if (!parent || parent.kind !== 'general' || !owner || owner.diagramId !== parent.id || (owner.role ?? 'element') !== 'element' || owner.type !== 'software-system') throw new ApiConflictError(`Container diagram ${document.id} has a broken parent or owner reference. Repair the referenced Software System.`, 'DIAGRAM_REFERENCE_BROKEN');
      if (status === 'active' && parent.status !== 'active') throw new ApiConflictError(`Restore parent diagram ${parent.name} before opening its container diagrams.`, 'PARENT_INACTIVE');
      for (const occurrence of document.components.filter(component => component.role === 'external')) {
        const source = parent.components.find(component => component.id === occurrence.sourceComponentId);
        if (!source || (source.role ?? 'element') !== 'element' || !isC4ArtifactType(source.type) || source.id === owner.id) throw new ApiConflictError(`External participant ${occurrence.id} has a broken source. Repair its parent reference.`, 'DIAGRAM_REFERENCE_BROKEN');
      }
      return this.summary({ ...document, scope: { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description } });
    });
  }

  async availability(diagramId: string, componentId: string): Promise<ContainerAvailability> {
    const resolved = await this.resolveOwner(diagramId, componentId, this.repository);
    const child = await this.repository.findContainerForOwner(resolved.owner.id);
    if (child && (child.kind !== 'container' || child.scope?.parentDiagramId !== resolved.parent.id)) {
      throw new ApiConflictError('The canonical container diagram has a broken parent reference.', 'DIAGRAM_REFERENCE_BROKEN');
    }
    return {
      parentDiagramId: resolved.parent.id,
      softwareSystemId: resolved.owner.id,
      availability: !child ? 'none' : child.status === 'active' ? 'active' : 'trashed',
      diagram: child ? this.summary({ ...child, scope: resolved.scope }) : null,
    };
  }

  async createOrOpen(diagramId: string, componentId: string): Promise<{ document: DiagramDocument; created: boolean }> {
    const firstResolution = await this.resolveOwner(diagramId, componentId, this.repository);
    const previous = await this.repository.findContainerForOwner(firstResolution.owner.id);
    try {
      return await this.graph.run(firstResolution.parent.id, [diagramId, ...(previous ? [previous.id] : [])], async ({ diagrams }) => {
        const current = await this.resolveOwner(diagramId, componentId, diagrams);
        const existing = await diagrams.findContainerForOwner(current.owner.id);
        if (existing) {
          if (existing.kind !== 'container' || existing.scope?.parentDiagramId !== current.parent.id) throw new ApiConflictError('The canonical container diagram has a broken parent reference.', 'DIAGRAM_REFERENCE_BROKEN');
          if (existing.status === 'trashed') throw new ApiConflictError('A container diagram already exists in trash. Restore it to continue.', 'RESTORE_REQUIRED', this.summary(existing));
          return { document: existing, created: false };
        }
        const now = new Date().toISOString();
        const document: DiagramDocument = {
          id: crypto.randomUUID(), name: current.owner.name, status:'active', kind:'container', scope:current.scope,
          boundary:{ position:{ x:0, y:0 }, size:{ width:480, height:320 } }, createdAt:now, updatedAt:now, trashedAt:null,
          components:[], relationships:[], groups:[],
        };
        return { document: await diagrams.create(document), created:true };
      });
    } catch (error) {
      const pgError = findPostgresError(error);
      if (pgError.code !== '23505' || pgError.constraint !== 'diagrams_owner_component_unique') throw error;
      const winner = await this.repository.findContainerForOwner(firstResolution.owner.id);
      if (!winner) throw error;
      if (winner.status === 'trashed') throw new ApiConflictError('A container diagram already exists in trash. Restore it to continue.', 'RESTORE_REQUIRED', this.summary(winner));
      return { document:winner, created:false };
    }
  }

  async context(diagramId: string): Promise<ContainerContext> {
    const initial = await this.repository.get(diagramId);
    if (!initial || initial.status !== 'active') throw new ContainerContextNotFoundError('Diagram not found');
    if (initial.kind !== 'container' || !initial.scope) throw new ApiValidationError({ diagramId:'Source context is available only for container diagrams.' });
    return this.graph.run(initial.scope.parentDiagramId, [diagramId], async ({ diagrams }) => {
      const child = await diagrams.get(diagramId);
      if (!child || child.status !== 'active') throw new ContainerContextNotFoundError('Diagram not found');
      if (child.kind !== 'container' || !child.scope) throw new ApiValidationError({ diagramId:'Source context is available only for container diagrams.' });
      const resolved = await this.resolveScope(child, diagrams);
      const sources = resolved.parent.components
        .filter(component => component.id !== resolved.owner.id && (component.role ?? 'element') === 'element' && isC4ArtifactType(component.type))
        .map(component => ({ id:component.id, name:component.name, description:component.description, type:component.type as 'person' | 'software-system' }));
      return { scope:resolved.scope, sources, capturedAt:new Date().toISOString() };
    });
  }

  async resolveDocument(diagramId: string): Promise<DiagramDocument> {
    const initial = await this.repository.get(diagramId);
    if (!initial || initial.status !== 'active') throw new ContainerContextNotFoundError('Diagram not found');
    if (initial.kind !== 'container' || !initial.scope) return initial;
    return this.graph.run(initial.scope.parentDiagramId, [diagramId], async ({ diagrams }) => {
      const child = await diagrams.get(diagramId);
      if (!child || child.status !== 'active') throw new ContainerContextNotFoundError('Diagram not found');
      if (child.kind !== 'container' || !child.scope) throw new ApiConflictError('The container diagram is missing its owner scope.', 'DIAGRAM_REFERENCE_BROKEN');
      return this.hydrateAndValidateDocument(child, diagrams);
    });
  }

  async hydrateAndValidateDocument(child: DiagramDocument, repository: DiagramRepositoryLike): Promise<DiagramDocument> {
    if (child.kind !== 'container') return child;
    if (!child.scope) throw new ApiConflictError('The container diagram is missing its owner scope.', 'DIAGRAM_REFERENCE_BROKEN');
    const resolved = await this.resolveScope(child, repository);
    const components = child.components.map(component => {
      if (component.role !== 'external') return component;
      const source = resolved.parent.components.find(candidate => candidate.id === component.sourceComponentId);
      if (!source || (source.role ?? 'element') !== 'element' || !isC4ArtifactType(source.type) || source.id === resolved.owner.id) {
        throw new ApiConflictError(`External participant ${component.id} has a broken or ineligible source.`, 'DIAGRAM_REFERENCE_BROKEN');
      }
      return { ...component, name:source.name, description:source.description, type:source.type };
    });
    const document = diagramDocumentSchema.parse({ ...child, name:resolved.owner.name, scope:resolved.scope, components }) as DiagramDocument;
    assertDiagramInvariants(document);
    return document;
  }

  private async resolveOwner(diagramId: string, componentId: string, repository: DiagramRepositoryLike): Promise<ResolvedOwner> {
    const sourceDiagram = await repository.get(diagramId);
    if (!sourceDiagram) throw new ContainerContextNotFoundError('Diagram not found');
    if (sourceDiagram.status !== 'active') {
      if (sourceDiagram.kind === 'general') throw new ApiConflictError('The parent diagram must be active before opening a container diagram.', 'PARENT_INACTIVE');
      throw new ContainerContextNotFoundError('Diagram not found');
    }
    const selected = sourceDiagram.components.find(component => component.id === componentId);
    if (!selected) throw new ContainerContextNotFoundError('Component not found in this diagram');
    let owner = selected;
    let parentDiagramId = sourceDiagram.id;
    if (selected.role === 'external') {
      if (selected.type !== 'software-system' || !selected.sourceComponentId) throw new ApiValidationError({ componentId:'Only an external Software System can open a container diagram.' });
      const source = await repository.findComponent(selected.sourceComponentId);
      if (!source) throw new ApiConflictError('The external Software System source no longer exists.', 'DIAGRAM_REFERENCE_BROKEN');
      parentDiagramId = source.diagramId;
      const parent = await repository.get(parentDiagramId);
      owner = parent?.components.find(component => component.id === source.id)!;
    }
    const parent = await repository.get(parentDiagramId);
    if (!parent || parent.status !== 'active') throw new ApiConflictError('The parent diagram must be active before opening its container diagram.', 'PARENT_INACTIVE');
    if (parent.kind !== 'general') throw new ApiValidationError({ componentId:'Only a Software System in a general diagram can own a container diagram.' });
    const canonical = parent.components.find(component => component.id === owner.id);
    if (!canonical || canonical.diagramId !== parent.id) throw new ApiConflictError('The Software System owner reference is broken.', 'DIAGRAM_REFERENCE_BROKEN');
    if ((canonical.role ?? 'element') !== 'element' || canonical.type !== 'software-system') throw new ApiValidationError({ componentId:'Only an ordinary Software System can own a container diagram.' });
    return {
      parent,
      owner:canonical,
      scope:{ parentDiagramId:parent.id, softwareSystemId:canonical.id, parentDiagramName:parent.name, softwareSystemName:canonical.name, softwareSystemDescription:canonical.description },
    };
  }

  private async resolveScope(child: DiagramDocument, repository: DiagramRepositoryLike): Promise<ResolvedOwner> {
    const scope = child.scope!;
    const parent = await repository.get(scope.parentDiagramId);
    if (!parent) throw new ApiConflictError('The source parent diagram no longer exists.', 'DIAGRAM_REFERENCE_BROKEN');
    if (parent.status !== 'active') throw new ApiConflictError('The parent diagram must be active before loading this container diagram.', 'PARENT_INACTIVE');
    if (parent.kind !== 'general') throw new ApiConflictError('The container parent reference no longer points to a general diagram.', 'DIAGRAM_REFERENCE_BROKEN');
    const owner = parent.components.find(component => component.id === scope.softwareSystemId);
    if (!owner || owner.type !== 'software-system' || (owner.role ?? 'element') !== 'element') throw new ApiConflictError('The owning Software System reference is broken or no longer eligible.', 'DIAGRAM_REFERENCE_BROKEN');
    return { parent, owner, scope:{ parentDiagramId:parent.id, softwareSystemId:owner.id, parentDiagramName:parent.name, softwareSystemName:owner.name, softwareSystemDescription:owner.description } };
  }

  private summary(document: DiagramDocument) {
    return { id:document.id, name:getDiagramName(document), status:document.status, createdAt:document.createdAt, updatedAt:document.updatedAt, kind:document.kind ?? 'general', scope:document.scope ?? null };
  }
}

function findPostgresError(error: unknown): { code?:string; constraint?:string } {
  const seen = new Set<object>();
  let current = error;
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?:unknown; constraint?:unknown; cause?:unknown };
    if (typeof candidate.code === 'string' || typeof candidate.constraint === 'string') {
      return {
        ...(typeof candidate.code === 'string' ? { code:candidate.code } : {}),
        ...(typeof candidate.constraint === 'string' ? { constraint:candidate.constraint } : {}),
      };
    }
    current = candidate.cause;
  }
  return {};
}
