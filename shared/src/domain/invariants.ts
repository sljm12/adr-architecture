import type { DiagramDocument } from './types';
export function assertDiagramInvariants(document: DiagramDocument): void {
  if (!document.name.trim()) throw new Error('Diagram name must not be blank');
  const ids = new Set<string>();
  for (const component of document.components) { if (!component.id || ids.has(component.id)) throw new Error(`Duplicate component ID: ${component.id}`); ids.add(component.id); if (!component.name.trim() || !Number.isFinite(component.position.x) || !Number.isFinite(component.position.y)) throw new Error(`Invalid component: ${component.id}`); }
  const componentIds = new Set(document.components.map(c => c.id));
  for (const relationship of document.relationships) { if (!componentIds.has(relationship.sourceComponentId) || !componentIds.has(relationship.targetComponentId)) throw new Error(`Relationship ${relationship.id} references a missing component`); if (relationship.sourceComponentId === relationship.targetComponentId) throw new Error(`Relationship ${relationship.id} cannot connect a component to itself`); }
}
