import type { DiagramDocument } from '../../../shared/src/index';
const clone = (document: DiagramDocument) => structuredClone(document);
export class DiagramRepository {
  private documents = new Map<string, DiagramDocument>();
  list() { return [...this.documents.values()].filter(d => d.status === 'active').map(clone); }
  listTrash() { return [...this.documents.values()].filter(d => d.status === 'trashed').map(clone); }
  get(id: string) { const document = this.documents.get(id); return document && clone(document); }
  create(document: DiagramDocument) { this.documents.set(document.id, clone(document)); return clone(document); }
  replace(document: DiagramDocument) { this.documents.set(document.id, clone(document)); return clone(document); }
  removeComponent(diagramId: string, componentId: string): { document: DiagramDocument; relationshipCount: number } | undefined {
    const document = this.documents.get(diagramId); if (!document || document.status !== 'active' || !document.components.some(component => component.id === componentId)) return undefined;
    const dependentIds = new Set(document.relationships.filter(r => r.sourceComponentId === componentId || r.targetComponentId === componentId).map(r => r.id));
    const updated = { ...document, updatedAt: new Date().toISOString(), components: document.components.filter(c => c.id !== componentId), relationships: document.relationships.filter(r => !dependentIds.has(r.id)) };
    this.documents.set(diagramId, clone(updated)); return { document: clone(updated), relationshipCount: dependentIds.size };
  }
  trash(id: string) { const document = this.documents.get(id); if (!document || document.status === 'trashed') return undefined; const now = new Date().toISOString(); const updated = { ...document, status: 'trashed' as const, trashedAt: now, updatedAt: now }; this.documents.set(id, clone(updated)); return clone(updated); }
  restore(id: string) { const document = this.documents.get(id); if (!document || document.status !== 'trashed') return undefined; const updated = { ...document, status: 'active' as const, trashedAt: null, updatedAt: new Date().toISOString() }; this.documents.set(id, clone(updated)); return clone(updated); }
}
