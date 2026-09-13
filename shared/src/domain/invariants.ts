import type { DiagramDocument } from './types';
import type { ArchitectureDecisionRecord, Component, Relationship } from './types';
import { fitGroupBoundsAfterLayout, isMemberWithinGroup } from './group-layout';
export function assertComponentName(name: string): void { if (!name.trim()) throw new Error('Component name must not be blank'); }
export function assertRelationshipDirection(direction: string): void { if (direction !== 'directed' && direction !== 'undirected') throw new Error(`Unsupported relationship direction: ${direction}`); }
export function assertDiagramInvariants(document: DiagramDocument): void {
  if (!document.name.trim()) throw new Error('Diagram name must not be blank');
  const ids = new Set<string>();
  for (const component of document.components) { if (!component.id || ids.has(component.id)) throw new Error(`Duplicate component ID: ${component.id}`); ids.add(component.id); if (component.diagramId !== document.id) throw new Error(`Component ${component.id} must belong to diagram ${document.id}`); if (!component.name.trim() || !Number.isFinite(component.position.x) || !Number.isFinite(component.position.y)) throw new Error(`Invalid component: ${component.id}`); assertComponentName(component.name); }
  const componentIds = new Set(document.components.map(c => c.id));
  for (const relationship of document.relationships) { if (relationship.diagramId !== document.id) throw new Error(`Relationship ${relationship.id} must belong to diagram ${document.id}`); if (!componentIds.has(relationship.sourceComponentId) || !componentIds.has(relationship.targetComponentId)) throw new Error(`Relationship ${relationship.id} references a missing component`); if (relationship.sourceComponentId === relationship.targetComponentId) throw new Error(`Relationship ${relationship.id} cannot connect a component to itself`); assertRelationshipDirection(relationship.direction); }

  const groups = document.groups ?? [];
  const groupIds = new Set(groups.map(group => group.id));
  const seenGroupIds = new Set<string>();
  const memberGroups = new Map<string, string>();
  const names = new Map<string, string>();
  for (const group of groups) {
    assertUuid(group.id, 'Group ID');
    if (seenGroupIds.has(group.id)) throw new Error(`Duplicate group ID: ${group.id}`);
    seenGroupIds.add(group.id);
    if (group.diagramId !== document.id) throw new Error(`Group ${group.id} must belong to diagram ${document.id}`);
    const normalizedName = group.name.trim().toLocaleLowerCase();
    if (!normalizedName) throw new Error(`Group ${group.id} name must not be blank`);
    const priorGroupId = names.get(normalizedName);
    if (priorGroupId) throw new Error(`Group name "${group.name.trim()}" duplicates group ${priorGroupId} after trimming and ignoring capitalization`);
    names.set(normalizedName, group.id);
    if (!Number.isFinite(group.position.x) || !Number.isFinite(group.position.y) || !Number.isFinite(group.size.width) || !Number.isFinite(group.size.height) || group.size.width <= 0 || group.size.height <= 0) throw new Error(`Group ${group.id} must have a positive finite layout`);
    const members = new Set<string>();
    const memberGeometry: Array<{ position: Component['position'] }> = [];
    if (group.memberComponentIds.length < 2) throw new Error(`Group ${group.id} must contain at least two Software System members`);
    for (const memberId of group.memberComponentIds) {
      assertUuid(memberId, 'Group member component ID');
      if (members.has(memberId)) throw new Error(`Group ${group.id} contains duplicate member ${memberId}`);
      members.add(memberId);
      if (groupIds.has(memberId)) throw new Error(`Group ${group.id} cannot contain another group`);
      const member = document.components.find(component => component.id === memberId);
      if (!member) throw new Error(`Group ${group.id} references missing component ${memberId}`);
      if (member.diagramId !== document.id) throw new Error(`Group member ${memberId} must belong to diagram ${document.id}`);
      if (member.type !== 'software-system') throw new Error(`Group member ${memberId} must be a Software System`);
      const priorGroup = memberGroups.get(memberId);
      if (priorGroup) throw new Error(`Component ${memberId} cannot belong to more than one group (${priorGroup} and ${group.id})`);
      memberGroups.set(memberId, group.id);
      memberGeometry.push({ position: member.position });
      if (!isMemberWithinGroup(group, member.position)) throw new Error(`Group ${group.id} boundary does not enclose member ${memberId}`);
    }
    const fitted = fitGroupBoundsAfterLayout(memberGeometry);
    const groupRight = group.position.x + group.size.width;
    const groupBottom = group.position.y + group.size.height;
    const fittedRight = fitted.position.x + fitted.size.width;
    const fittedBottom = fitted.position.y + fitted.size.height;
    if (group.position.x > fitted.position.x || group.position.y > fitted.position.y || groupRight < fittedRight || groupBottom < fittedBottom) {
      throw new Error(`Group ${group.id} boundary does not enclose every rendered member box with its label and padding`);
    }
  }
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
  const relationshipIds = new Set<string>();
  for (const relationshipId of adr.relationshipIds) {
    assertUuid(relationshipId, 'Relationship ID');
    if (relationshipIds.has(relationshipId)) throw new Error(`Duplicate ADR relationship link: ${relationshipId}`);
    relationshipIds.add(relationshipId);
  }
}

export function assertAdrRelationshipOwnership(adr: ArchitectureDecisionRecord, relationships: Array<Pick<Relationship, 'id' | 'diagramId'>>): void {
  const byId = new Map(relationships.map(relationship => [relationship.id, relationship]));
  for (const relationshipId of adr.relationshipIds) {
    const relationship = byId.get(relationshipId);
    if (!relationship) throw new Error(`ADR references missing relationship ${relationshipId}`);
    if (relationship.diagramId !== adr.diagramId) throw new Error(`Relationship ${relationshipId} belongs to a different diagram`);
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
