import { DiagramRepository } from '../persistence/diagram-repository';
export class DiagramNotFoundError extends Error {}
export class DiagramConflictError extends Error {}
export class DiagramService {
  constructor(private readonly repository: DiagramRepository) {}
  dependencyCount(diagramId: string, componentId: string) { const d = this.repository.get(diagramId); if (!d || d.status !== 'active') throw new DiagramNotFoundError('Diagram not found'); if (!d.components.some(c => c.id === componentId)) throw new DiagramNotFoundError('Component not found'); return d.relationships.filter(r => r.sourceComponentId === componentId || r.targetComponentId === componentId).length; }
  removeComponent(diagramId: string, componentId: string) { const result = this.repository.removeComponent(diagramId, componentId); if (!result) throw new DiagramNotFoundError('Diagram or component not found'); return result; }
  trash(id: string) { const d = this.repository.trash(id); if (!d) throw new DiagramNotFoundError('Active diagram not found'); return d; }
  restore(id: string) { const d = this.repository.restore(id); if (!d) { if (this.repository.get(id)) throw new DiagramConflictError('Diagram is not trashed'); throw new DiagramNotFoundError('Diagram not found'); } return d; }
}
