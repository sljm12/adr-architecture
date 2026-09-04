import { assertDiagramInvariants, diagramCreateSchema, diagramDocumentSchema, type DiagramDocument } from '../../../shared/src/index';
import type { DiagramRepositoryLike, MaybePromise, RemoveComponentResult } from '../persistence/diagram-repository';

export class DiagramNotFoundError extends Error {}
export class DiagramConflictError extends Error {}
export class ComponentDependencyConflictError extends DiagramConflictError {
  constructor(readonly componentId: string, readonly relationshipCount: number) {
    super(`Component cannot be removed while it has ${relationshipCount} dependent relationship${relationshipCount === 1 ? '' : 's'}. Remove the relationships first.`);
    this.name = 'ComponentDependencyConflictError';
  }
}

const isPromise = <T>(value: MaybePromise<T>): value is Promise<T> => value instanceof Promise;

export class DiagramService {
  constructor(private readonly repository: DiagramRepositoryLike) {}

  create(name: string): MaybePromise<DiagramDocument> {
    const input = diagramCreateSchema.parse({ name });
    const now = new Date().toISOString();
    return this.repository.create({
      id: crypto.randomUUID(), name: input.name.trim(), status: 'active',
      createdAt: now, updatedAt: now, trashedAt: null, components: [], relationships: [],
    });
  }

  load(id: string): MaybePromise<DiagramDocument> {
    const result = this.repository.get(id);
    const resolve = (document: DiagramDocument | undefined) => {
      if (!document || document.status !== 'active') throw new DiagramNotFoundError('Diagram not found');
      return document;
    };
    return isPromise(result) ? result.then(resolve) : resolve(result);
  }

  save(id: string, input: unknown): MaybePromise<DiagramDocument> {
    const document = diagramDocumentSchema.parse(input);
    if (document.id !== id) throw new Error('Path and document IDs must match');
    assertDiagramInvariants(document);
    for (const component of document.components) {
      if (component.diagramId !== id) throw new Error(`Component ${component.id} must belong to diagram ${id}`);
    }
    for (const relationship of document.relationships) {
      if (relationship.diagramId !== id) throw new Error(`Relationship ${relationship.id} must belong to diagram ${id}`);
    }
    const result = this.repository.replace({
      ...document,
      name: document.name.trim(),
      components: document.components.map(component => ({ ...component, name: component.name.trim() })),
      relationships: document.relationships.map(relationship => ({ ...relationship, label: relationship.label?.trim() || null })),
    });
    const resolve = (saved: DiagramDocument | undefined) => {
      if (!saved) throw new DiagramNotFoundError('Diagram not found');
      return saved;
    };
    return isPromise(result) ? result.then(resolve) : resolve(result);
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

  removeComponent(diagramId: string, componentId: string): MaybePromise<Extract<RemoveComponentResult, { document: DiagramDocument }>> {
    const result = this.repository.removeComponent(diagramId, componentId);
    const resolve = (removal: RemoveComponentResult | undefined) => {
      if (!removal) throw new DiagramNotFoundError('Diagram or component not found');
      if ('conflict' in removal) throw new ComponentDependencyConflictError(componentId, removal.relationshipCount);
      return removal;
    };
    return isPromise(result) ? result.then(resolve) : resolve(result);
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
