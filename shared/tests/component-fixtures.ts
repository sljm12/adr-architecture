import type { ArchitectureDecisionRecord, DiagramDocument } from '../src/domain/types';
import { generalParentFixture, populatedChildFixture, containerFixtureIds, containerFixtureTimestamp } from './container-fixtures';

export const componentFixtureIds = {
  context: containerFixtureIds.parentDiagram,
  system: containerFixtureIds.owner,
  canonicalPerson: containerFixtureIds.person,
  canonicalSystem: containerFixtureIds.sourceSystem,
  parent: containerFixtureIds.populatedChild,
  application: containerFixtureIds.container,
  systemOccurrence: containerFixtureIds.externalOccurrence,
  datastore: 'a0000000-0000-4000-8000-000000000001',
  personOccurrence: 'a0000000-0000-4000-8000-000000000002',
  child: 'a0000000-0000-4000-8000-000000000003',
  datastoreChild: 'a0000000-0000-4000-8000-000000000004',
  internal: 'a0000000-0000-4000-8000-000000000005',
  siblingOccurrence: 'a0000000-0000-4000-8000-000000000006',
  childPerson: 'a0000000-0000-4000-8000-000000000007',
  childSystem: 'a0000000-0000-4000-8000-000000000008',
  relationship: 'a0000000-0000-4000-8000-000000000009',
  linkedAdr: 'a0000000-0000-4000-8000-000000000010',
  unlinkedAdr: 'a0000000-0000-4000-8000-000000000011',
  rootBatch: 'a0000000-0000-4000-8000-000000000012',
  independentBatch: 'a0000000-0000-4000-8000-000000000013',
} as const;
export const componentFixtureTimestamp = containerFixtureTimestamp;

export const componentContextFixture = () => generalParentFixture() as DiagramDocument;
export function componentParentFixture(): DiagramDocument {
  const parent = populatedChildFixture() as DiagramDocument;
  // Duplicate owner names prove ownership uses UUIDs rather than labels.
  parent.components.push({ ...parent.components[0], id: componentFixtureIds.datastore, containerType: 'datastore', technology: 'PostgreSQL', position: { x: 360, y: 100 } });
  parent.components.push({ ...parent.components[1], id: componentFixtureIds.personOccurrence, name: 'Customer', type: 'person', sourceComponentId: componentFixtureIds.canonicalPerson, position: { x: -240, y: 100 } });
  parent.boundary = { position: { x: 76, y: 32 }, size: { width: 488, height: 208 } };
  return parent;
}
export function emptyComponentFixture(owner: 'application' | 'datastore' = 'application') {
  const parent = componentParentFixture();
  const container = parent.components.find(c => c.id === componentFixtureIds[owner])!;
  return {
    id: owner === 'application' ? componentFixtureIds.child : componentFixtureIds.datastoreChild,
    name: container.name, kind: 'component', status: 'active', createdAt: componentFixtureTimestamp, updatedAt: componentFixtureTimestamp, trashedAt: null,
    scope: { parentDiagramId: parent.id, containerId: container.id, parentDiagramName: parent.name, containerName: container.name, containerDescription: container.description, containerTechnology: container.technology!, containerType: container.containerType!, systemContextDiagramId: componentFixtureIds.context, softwareSystemId: componentFixtureIds.system, softwareSystemName: 'Payments' },
    boundary: { position: { x: 0, y: 0 }, size: { width: 480, height: 320 } }, components: [], relationships: [], groups: [],
  };
}
export function populatedComponentFixture() {
  const child = emptyComponentFixture();
  const parent = componentParentFixture();
  const internal = { ...parent.components[0], id: componentFixtureIds.internal, diagramId: child.id, name: 'Payment handler', description: 'Validates and records requests', role: 'component', type: 'component', containerType: null, technology: 'TypeScript', position: { x: 24, y: 68 }, size: { width: 180, height: 100 } };
  const supporting = [componentFixtureIds.datastore, componentFixtureIds.personOccurrence, componentFixtureIds.systemOccurrence].map((id, index) => {
    const source = parent.components.find(c => c.id === id)!;
    return { ...source, id: [componentFixtureIds.siblingOccurrence, componentFixtureIds.childPerson, componentFixtureIds.childSystem][index], diagramId: child.id, role: 'external', sourceComponentId: source.id, position: { x: 504, y: index * 120 }, size: { width: 180, height: 72 } };
  });
  return { ...child, components: [internal, ...supporting], relationships: [{ id: componentFixtureIds.relationship, diagramId: child.id, sourceComponentId: internal.id, targetComponentId: supporting[0].id, direction: 'directed', label: 'Records payment', protocol: 'SQL', createdAt: componentFixtureTimestamp, updatedAt: componentFixtureTimestamp }] };
}
export function componentAdrFixtures(): ArchitectureDecisionRecord[] {
  const base = { diagramId: componentFixtureIds.child, title: 'Keep payment validation together', context: 'Validate every request', decision: 'Use one handler', consequences: 'Centralized validation', alternativesOrConstraints: null, status: 'accepted' as const, replacementAdrId: null, createdAt: componentFixtureTimestamp, updatedAt: componentFixtureTimestamp };
  return [{ ...base, id: componentFixtureIds.linkedAdr, componentIds: [componentFixtureIds.internal, componentFixtureIds.childPerson], relationshipIds: [componentFixtureIds.relationship] }, { ...base, id: componentFixtureIds.unlinkedAdr, title: 'Unlinked decision', componentIds: [], relationshipIds: [] }];
}
export function componentTrashFixtures() {
  return [
    { document: { ...emptyComponentFixture('datastore'), status: 'trashed', trashedAt: componentFixtureTimestamp }, provenance: { trashBatchId: componentFixtureIds.independentBatch, trashRootDiagramId: componentFixtureIds.datastoreChild } },
    { document: { ...populatedComponentFixture(), status: 'trashed', trashedAt: componentFixtureTimestamp }, provenance: { trashBatchId: componentFixtureIds.rootBatch, trashRootDiagramId: componentFixtureIds.context } },
  ];
}
