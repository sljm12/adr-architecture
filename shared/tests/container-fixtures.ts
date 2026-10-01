import { calculateGroupBounds } from '../src/domain/group-layout';

export const containerFixtureIds = {
  parentDiagram: '90000000-0000-4000-8000-000000000001',
  owner: '90000000-0000-4000-8000-000000000002',
  duplicateOwner: '90000000-0000-4000-8000-000000000003',
  sourceSystem: '90000000-0000-4000-8000-000000000004',
  person: '90000000-0000-4000-8000-000000000005',
  parentRelationship: '90000000-0000-4000-8000-000000000006',
  group: '90000000-0000-4000-8000-000000000007',
  emptyChild: '90000000-0000-4000-8000-000000000008',
  populatedChild: '90000000-0000-4000-8000-000000000009',
  container: '90000000-0000-4000-8000-000000000010',
  externalOccurrence: '90000000-0000-4000-8000-000000000011',
  childRelationship: '90000000-0000-4000-8000-000000000012',
} as const;

export const containerFixtureTimestamp = '2026-01-01T00:00:00.000Z';

const makeComponent = (id: string, diagramId: string, name: string, type: string, x: number, y: number) => ({
  id,
  diagramId,
  name,
  description: null,
  type,
  role: 'element',
  technology: null,
  sourceComponentId: null,
  position: { x, y },
  size: { width: 180, height: 72 },
  createdAt: containerFixtureTimestamp,
  updatedAt: containerFixtureTimestamp,
});

const makeParent = () => {
  const id = containerFixtureIds.parentDiagram;
  const owner = makeComponent(containerFixtureIds.owner, id, 'Payments', 'software-system', 80, 100);
  const duplicateOwner = makeComponent(containerFixtureIds.duplicateOwner, id, 'Payments', 'software-system', 360, 100);
  const sourceSystem = makeComponent(containerFixtureIds.sourceSystem, id, 'Ledger', 'software-system', 640, 100);
  const person = makeComponent(containerFixtureIds.person, id, 'Customer', 'person', -180, 100);
  return {
    id,
    name: 'Payments architecture',
    kind: 'general',
    scope: null,
    boundary: null,
    status: 'active',
    createdAt: containerFixtureTimestamp,
    updatedAt: containerFixtureTimestamp,
    trashedAt: null,
    components: [owner, duplicateOwner, sourceSystem, person],
    relationships: [{
      id: containerFixtureIds.parentRelationship,
      diagramId: id,
      sourceComponentId: owner.id,
      targetComponentId: sourceSystem.id,
      direction: 'directed',
      label: 'records transactions',
      protocol: null,
      createdAt: containerFixtureTimestamp,
      updatedAt: containerFixtureTimestamp,
    }],
    groups: [],
  };
};

export const generalParentFixture = () => structuredClone(makeParent());

export const duplicateNameParentFixture = () => {
  const parent = makeParent();
  return structuredClone({ ...parent, components: parent.components.map(component => ({ ...component, name: 'Payments' })) });
};

export const groupedOwnerParentFixture = () => {
  const parent = makeParent();
  const owner = parent.components[0];
  const source = parent.components[2];
  return structuredClone({
    ...parent,
    groups: [{
      id: containerFixtureIds.group,
      diagramId: parent.id,
      name: 'Finance platforms',
      memberComponentIds: [owner.id, source.id],
      ...calculateGroupBounds([owner, source]),
      createdAt: containerFixtureTimestamp,
      updatedAt: containerFixtureTimestamp,
    }],
  });
};

const makeScope = () => ({
  parentDiagramId: containerFixtureIds.parentDiagram,
  softwareSystemId: containerFixtureIds.owner,
  parentDiagramName: 'Payments architecture',
  softwareSystemName: 'Payments',
  softwareSystemDescription: null,
});

export const emptyChildFixture = () => structuredClone({
  id: containerFixtureIds.emptyChild,
  name: 'Payments',
  kind: 'container',
  scope: makeScope(),
  boundary: { position: { x: 0, y: 0 }, size: { width: 480, height: 320 } },
  status: 'active',
  createdAt: containerFixtureTimestamp,
  updatedAt: containerFixtureTimestamp,
  trashedAt: null,
  components: [],
  relationships: [],
  groups: [],
});

export const populatedChildFixture = () => {
  const id = containerFixtureIds.populatedChild;
  const container = {
    ...makeComponent(containerFixtureIds.container, id, 'Payment API', 'container', 100, 100),
    description: 'Accepts and processes payment requests',
    role: 'container',
    technology: 'TypeScript',
  };
  const external = {
    ...makeComponent(containerFixtureIds.externalOccurrence, id, 'Ledger', 'software-system', 640, 100),
    role: 'external',
    sourceComponentId: containerFixtureIds.sourceSystem,
  };
  return structuredClone({
    ...emptyChildFixture(),
    id,
    components: [container, external],
    relationships: [{
      id: containerFixtureIds.childRelationship,
      diagramId: id,
      sourceComponentId: container.id,
      targetComponentId: external.id,
      direction: 'directed',
      label: 'writes transactions',
      protocol: 'HTTPS',
      createdAt: containerFixtureTimestamp,
      updatedAt: containerFixtureTimestamp,
    }],
    boundary: { position: { x: 76, y: 32 }, size: { width: 228, height: 208 } },
  });
};

export const externalSourceParentFixture = () => {
  const parent = makeParent();
  return structuredClone({
    ...parent,
    components: parent.components.map(component => component.id === containerFixtureIds.sourceSystem
      ? { ...component, description: 'Stores account balances and payment records' }
      : component),
  });
};

export const legacyPayloadFixture = () => {
  const parent = makeParent();
  return structuredClone({
    ...parent,
    kind: undefined,
    scope: undefined,
    boundary: undefined,
    groups: undefined,
    components: parent.components.slice(0, 1).map(({ size: _size, role: _role, technology: _technology, sourceComponentId: _source, ...component }) => ({
      ...component,
      type: 'microservice',
    })),
    relationships: [],
  });
};
