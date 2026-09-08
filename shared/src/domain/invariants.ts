import type { DiagramDocument } from './types';
import type { ArchitectureDecisionRecord, Component } from './types';
export function assertDiagramInvariants(document: DiagramDocument): void {
  if (!document.name.trim()) throw new Error('Diagram name must not be blank');
  const ids = new Set<string>();
  for (const component of document.components) { if (!component.id || ids.has(component.id)) throw new Error(`Duplicate component ID: ${component.id}`); ids.add(component.id); if (!component.name.trim() || !Number.isFinite(component.position.x) || !Number.isFinite(component.position.y)) throw new Error(`Invalid component: ${component.id}`); }
  const componentIds = new Set(document.components.map(c => c.id));
  for (const relationship of document.relationships) { if (!componentIds.has(relationship.sourceComponentId) || !componentIds.has(relationship.targetComponentId)) throw new Error(`Relationship ${relationship.id} references a missing component`); if (relationship.sourceComponentId === relationship.targetComponentId) throw new Error(`Relationship ${relationship.id} cannot connect a component to itself`); }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (value: string, label: string) => { if (!uuidPattern.test(value)) throw new Error(`${label} must be a valid UUID`); };

export function assertAdrInvariants(adr: ArchitectureDecisionRecord): void {
  assertUuid(adr.id, 'ADR ID');
  assertUuid(adr.diagramId, 'ADR diagram ID');
  for (const [label, value] of [['Title', adr.title], ['Context', adr.context], ['Decision', adr.decision], ['Consequences', adr.consequences]] as const) {
    if (!value.trim()) throw new Error(`${label} is required`);
  }
  if (!['draft', 'accepted', 'superseded', 'rejected'].includes(adr.status)) throw new Error(`Unsupported ADR status: ${adr.status}`);
  if (adr.status === 'superseded' && !adr.replacementAdrId) throw new Error('A superseded ADR must reference its replacement ADR');
  if (adr.replacementAdrId) {
    assertUuid(adr.replacementAdrId, 'Replacement ADR ID');
    if (adr.replacementAdrId === adr.id) throw new Error('An ADR cannot replace itself');
  }
  const componentIds = new Set<string>();
  for (const componentId of adr.componentIds) {
    assertUuid(componentId, 'Component ID');
    if (componentIds.has(componentId)) throw new Error(`Duplicate ADR component link: ${componentId}`);
    componentIds.add(componentId);
  }
}

export function assertAdrComponentOwnership(adr: ArchitectureDecisionRecord, components: Component[]): void {
  const byId = new Map(components.map(component => [component.id, component]));
  for (const componentId of adr.componentIds) {
    const component = byId.get(componentId);
    if (!component) throw new Error(`ADR references missing component ${componentId}`);
    if (component.diagramId !== adr.diagramId) throw new Error(`Component ${componentId} belongs to a different diagram`);
  }
}

export function assertAdrReplacement(adr: ArchitectureDecisionRecord, replacement: ArchitectureDecisionRecord | undefined): void {
  if (!adr.replacementAdrId) return;
  if (!replacement) throw new Error(`Replacement ADR ${adr.replacementAdrId} was not found`);
  if (replacement.id === adr.id) throw new Error('An ADR cannot replace itself');
  if (replacement.diagramId !== adr.diagramId) throw new Error('Replacement ADR must belong to the same diagram');
}
