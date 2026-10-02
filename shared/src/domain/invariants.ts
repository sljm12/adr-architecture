import type { DiagramDocument } from './types';
import type { ArchitectureDecisionRecord, Component, Relationship } from './types';
import { fitGroupBoundsAfterLayout, isLessThanOrApproximatelyEqual, isMemberWithinGroup } from './group-layout';
import { isExternalOutsideBoundary } from './container-layout';
import { isContainerType } from './c4';

export type GroupMemberAddReasonCode =
  | 'missing-group'
  | 'missing-component'
  | 'group-cross-diagram'
  | 'component-cross-diagram'
  | 'ineligible-component'
  | 'already-member'
  | 'already-in-other-group';

export type GroupMemberAddReason = {
  code: GroupMemberAddReasonCode;
  groupId: string;
  componentId: string;
  currentGroupId?: string;
  message: string;
};

/** Returns a stable preflight reason, or null when the component can be added. */
export function assertCanAddGroupMember(document: DiagramDocument, groupId: string, componentId: string): GroupMemberAddReason | null {
  const group = document.groups?.find(item => item.id === groupId);
  if (!group) return { code: 'missing-group', groupId, componentId, message: `Group ${groupId} was not found in this diagram.` };
  if (group.diagramId !== document.id) return { code: 'group-cross-diagram', groupId, componentId, message: `Group ${groupId} belongs to a different diagram.` };

  const component = document.components.find(item => item.id === componentId);
  if (!component) return { code: 'missing-component', groupId, componentId, message: `Component ${componentId} was not found in this diagram.` };
  if (component.diagramId !== document.id) return { code: 'component-cross-diagram', groupId, componentId, message: `Component ${componentId} belongs to a different diagram.` };
  if (component.type !== 'software-system') return { code: 'ineligible-component', groupId, componentId, message: `Component ${componentId} is not a Software System and cannot join a system group.` };
  if (group.memberComponentIds.includes(componentId)) return { code: 'already-member', groupId, componentId, message: `Component ${componentId} is already a member of group ${groupId}.` };

  const currentGroup = (document.groups ?? []).find(candidate => candidate.id !== groupId && candidate.memberComponentIds.includes(componentId));
  if (currentGroup) return { code: 'already-in-other-group', groupId, componentId, currentGroupId: currentGroup.id, message: `Component ${componentId} already belongs to group ${currentGroup.id}.` };
  return null;
}

export function assertComponentName(name: string): void { if (!name.trim()) throw new Error('Component name must not be blank'); }
export function assertRelationshipDirection(direction: string): void { if (direction !== 'directed' && direction !== 'undirected') throw new Error(`Unsupported relationship direction: ${direction}`); }
export function assertDiagramInvariants(document: DiagramDocument): void {
  assertUuid(document.id, 'Diagram ID');
  if (!document.name.trim() || document.name.trim().length > 200) throw new Error('Diagram name must contain 1 to 200 characters');
  const kind = document.kind ?? 'general';
  if (kind !== 'general' && kind !== 'container') throw new Error(`Unsupported diagram kind: ${kind}`);
  if (kind === 'general' && (document.scope != null || document.boundary != null)) throw new Error('General diagrams cannot have container scope or boundary data');
  if (kind === 'container') {
    const scope = document.scope;
    const boundary = document.boundary;
    if (!scope || !boundary) throw new Error('Container diagrams require an owning Software System and a boundary');
    assertUuid(scope.parentDiagramId, 'Parent diagram ID');
    assertUuid(scope.softwareSystemId, 'Owning Software System ID');
    if (scope.parentDiagramId === document.id) throw new Error('A container diagram must reference a separate parent diagram');
    if (!scope.parentDiagramName.trim() || !scope.softwareSystemName.trim()) throw new Error('Resolved container scope names must not be blank');
    if (![boundary.position.x, boundary.position.y, boundary.size.width, boundary.size.height].every(Number.isFinite) || boundary.size.width <= 0 || boundary.size.height <= 0) throw new Error('Container boundary must have finite coordinates and positive finite dimensions');
    if ((document.groups ?? []).length > 0) throw new Error('Container diagrams cannot contain SystemGroups');
  }
  const ids = new Set<string>();
  const externalSources = new Set<string>();
  for (const component of document.components) {
    assertUuid(component.id, 'Component ID');
    if (ids.has(component.id)) throw new Error(`Duplicate component ID: ${component.id}`);
    ids.add(component.id);
    if (component.diagramId !== document.id) throw new Error(`Component ${component.id} must belong to diagram ${document.id}`);
    if (!component.name.trim() || component.name.trim().length > 200 || !Number.isFinite(component.position.x) || !Number.isFinite(component.position.y) || !Number.isFinite(component.size.width) || !Number.isFinite(component.size.height) || component.size.width <= 0 || component.size.height <= 0) throw new Error(`Invalid component layout: ${component.id}`);
    assertComponentName(component.name);
    const role = component.role ?? 'element';
    if (role === 'container' ? !isContainerType(component.containerType) : component.containerType != null) throw new Error(`Component ${component.id} requires ${role === 'container' ? 'Application or Datastore' : 'null containerType'}`);
    if (kind === 'general') {
      if (role !== 'element' || (component.technology ?? null) !== null || (component.sourceComponentId ?? null) !== null) throw new Error(`General component ${component.id} must remain an ordinary element without source metadata`);
      continue;
    }
    if (role === 'container') {
      if (component.type !== 'container' || !component.description?.trim() || !component.technology?.trim() || component.technology.trim().length > 200 || component.sourceComponentId) throw new Error(`Container ${component.id} needs a name, responsibility, technology, and no source reference`);
      const boundary = document.boundary!;
      const minX = boundary.position.x + 24;
      const minY = boundary.position.y + 68;
      const maxX = boundary.position.x + boundary.size.width - 24 - component.size.width;
      const maxY = boundary.position.y + boundary.size.height - 24 - component.size.height;
      if (!isLessThanOrApproximatelyEqual(minX, component.position.x) || !isLessThanOrApproximatelyEqual(minY, component.position.y) || !isLessThanOrApproximatelyEqual(component.position.x, maxX) || !isLessThanOrApproximatelyEqual(component.position.y, maxY)) throw new Error(`Container ${component.id} must fit inside the Software System boundary`);
    } else if (role === 'external') {
      if ((component.type !== 'person' && component.type !== 'software-system') || !component.sourceComponentId || component.sourceComponentId === document.scope!.softwareSystemId || (component.technology ?? null) !== null) throw new Error(`External participant ${component.id} must reference a different Person or Software System source`);
      assertUuid(component.sourceComponentId, 'External source component ID');
      if (externalSources.has(component.sourceComponentId)) throw new Error(`External source ${component.sourceComponentId} is included more than once`);
      externalSources.add(component.sourceComponentId);
      if (!isExternalOutsideBoundary(document.boundary!, component.position, component.size)) throw new Error(`External participant ${component.id} needs 24 units of clearance outside the Software System boundary`);
    } else {
      throw new Error(`Container diagram component ${component.id} has unsupported role ${role}`);
    }
  }
  const componentIds = new Set(document.components.map(c => c.id));
  const relationshipIds = new Set<string>();
  for (const relationship of document.relationships) {
    assertUuid(relationship.id, 'Relationship ID');
    if (relationshipIds.has(relationship.id)) throw new Error(`Duplicate relationship ID: ${relationship.id}`);
    relationshipIds.add(relationship.id);
    assertUuid(relationship.diagramId, 'Relationship diagram ID');
    assertUuid(relationship.sourceComponentId, 'Relationship source component ID');
    assertUuid(relationship.targetComponentId, 'Relationship target component ID');
    if (relationship.diagramId !== document.id) throw new Error(`Relationship ${relationship.id} must belong to diagram ${document.id}`);
    if (!componentIds.has(relationship.sourceComponentId) || !componentIds.has(relationship.targetComponentId)) throw new Error(`Relationship ${relationship.id} references a missing component`);
    if (relationship.sourceComponentId === relationship.targetComponentId) throw new Error(`Relationship ${relationship.id} cannot connect a component to itself`);
    assertRelationshipDirection(relationship.direction);
    if (kind === 'container') {
      const source = document.components.find(component => component.id === relationship.sourceComponentId)!;
      const target = document.components.find(component => component.id === relationship.targetComponentId)!;
      if (relationship.direction !== 'directed' || !relationship.label?.trim()) throw new Error(`Container interaction ${relationship.id} needs a direction and nonblank description`);
      if (source.role !== 'container' && target.role !== 'container') throw new Error(`Container interaction ${relationship.id} must connect to an internal container`);
    }
  }

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
    const memberGeometry: Array<{ position: Component['position']; size: Component['size'] }> = [];
    if (group.memberComponentIds.length < 2) throw new Error(`Group ${group.id} must contain at least two Software System members`);
    for (const memberId of group.memberComponentIds) {
      assertUuid(memberId, 'Group member component ID');
      if (members.has(memberId)) throw new Error(`Group ${group.id} contains duplicate member ${memberId}`);
      members.add(memberId);
      if (groupIds.has(memberId)) throw new Error(`Group ${group.id} cannot contain another group`);
      const member = document.components.find(component => component.id === memberId);
      if (!member) throw new Error(`Group ${group.id} references missing component ${memberId}`);
      if (member.diagramId !== document.id) throw new Error(`Group member ${memberId} must belong to diagram ${document.id}`);
      if (member.type !== 'software-system') throw new Error(`Group ${group.id} member ${memberId} must be a Software System`);
      const priorGroup = memberGroups.get(memberId);
      if (priorGroup) throw new Error(`Component ${memberId} cannot belong to more than one group (${priorGroup} and ${group.id})`);
      memberGroups.set(memberId, group.id);
      memberGeometry.push({ position: member.position, size: member.size });
      if (!isMemberWithinGroup(group, member.position, member.size)) throw new Error(`Group ${group.id} boundary does not enclose member ${memberId}`);
    }
    const fitted = fitGroupBoundsAfterLayout(memberGeometry);
    const groupRight = group.position.x + group.size.width;
    const groupBottom = group.position.y + group.size.height;
    const fittedRight = fitted.position.x + fitted.size.width;
    const fittedBottom = fitted.position.y + fitted.size.height;
    if (!isLessThanOrApproximatelyEqual(group.position.x, fitted.position.x)
      || !isLessThanOrApproximatelyEqual(group.position.y, fitted.position.y)
      || !isLessThanOrApproximatelyEqual(fittedRight, groupRight)
      || !isLessThanOrApproximatelyEqual(fittedBottom, groupBottom)) {
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
