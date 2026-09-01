import { DiagramRepository } from '../persistence/diagram-repository';
export class DiagramNotFoundError extends Error {}
export class DiagramConflictError extends Error {}
export class ComponentDependencyConflictError extends DiagramConflictError {
  constructor(readonly componentId: string, readonly relationshipCount: number) {
    super(`Component cannot be removed while it has ${relationshipCount} dependent relationship${relationshipCount === 1 ? '' : 's'}. Remove the relationships first.`);
    this.name = 'ComponentDependencyConflictError';
  }
}
export class DiagramService {
  constructor(private readonly repository: DiagramRepository) {}
  dependencyCount(diagramId: string, componentId: string) { const d = this.repository.get(diagramId); if (!d || d.status !== 'active') throw new DiagramNotFoundError('Diagram not found'); if (!d.components.some(c => c.id === componentId)) throw new DiagramNotFoundError('Component not found'); return d.relationships.filter(r => r.sourceComponentId === componentId || r.targetComponentId === componentId).length; }
  removeComponent(diagramId: string, componentId: string) { const result = this.repository.removeComponent(diagramId, componentId); if (!result) throw new DiagramNotFoundError('Diagram or component not found'); if ('conflict' in result) throw new ComponentDependencyConflictError(componentId, result.relationshipCount); return result; }
  trash(id: string) { const d = this.repository.trash(id); if (!d) throw new DiagramNotFoundError('Active diagram not found'); return d; }
  restore(id: string) { const d = this.repository.restore(id); if (!d) { if (this.repository.get(id)) throw new DiagramConflictError('Diagram is not trashed'); throw new DiagramNotFoundError('Diagram not found'); } return d; }
}
