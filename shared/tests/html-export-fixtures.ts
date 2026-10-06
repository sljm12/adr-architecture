import { calculateGroupBounds, diagramDocumentSchema, type ArchitectureDecisionRecord, type ContainerAvailability, type DiagramDocument } from '../src/index';
import { containerFixtureIds, emptyChildFixture, groupedOwnerParentFixture, populatedChildFixture } from './container-fixtures';

export const exportIds = {
  diagram: '00000000-0000-4000-8000-000000000001',
  systemA: '00000000-0000-4000-8000-000000000002',
  systemB: '00000000-0000-4000-8000-000000000003',
  person: '00000000-0000-4000-8000-000000000004',
  relationship: '00000000-0000-4000-8000-000000000005',
  parallelRelationship: '00000000-0000-4000-8000-000000000006',
  adr: '00000000-0000-4000-8000-000000000007',
  relationshipAdr: '00000000-0000-4000-8000-000000000008',
  replacement: '00000000-0000-4000-8000-000000000009',
  unlinkedAdr: '00000000-0000-4000-8000-000000000010',
  otherDiagram: '00000000-0000-4000-8000-000000000011',
  missingArtifact: '00000000-0000-4000-8000-000000000012',
  group: '00000000-0000-4000-8000-000000000013',
};

export const exportTimestamp = '2026-01-01T00:00:00.000Z';

const systemA = { id: exportIds.systemA, diagramId: exportIds.diagram, name: 'Payments <Core>', description: 'Owns & routes payments', type: 'software-system', position: { x: 80, y: 100 }, size: { width: 260, height: 130 }, createdAt: exportTimestamp, updatedAt: exportTimestamp };
const systemB = { id: exportIds.systemB, diagramId: exportIds.diagram, name: 'Ledger', description: null, type: 'software-system', position: { x: 500, y: 220 }, size: { width: 180, height: 72 }, createdAt: exportTimestamp, updatedAt: exportTimestamp };
const person = { id: exportIds.person, diagramId: exportIds.diagram, name: 'Operator', description: null, type: 'person', position: { x: -180, y: 260 }, size: { width: 140, height: 96 }, createdAt: exportTimestamp, updatedAt: exportTimestamp };

export const exportDiagramFixture = (): DiagramDocument => ({
  id: exportIds.diagram,
  name: 'Payments & Ledger',
  status: 'active',
  createdAt: exportTimestamp,
  updatedAt: exportTimestamp,
  trashedAt: null,
  components: [structuredClone(systemA), structuredClone(systemB), structuredClone(person)].map(component=>({...component,containerType:null})),
  relationships: [
    { id: exportIds.relationship, diagramId: exportIds.diagram, sourceComponentId: exportIds.systemA, targetComponentId: exportIds.systemB, direction: 'directed', label: 'writes <events>', createdAt: exportTimestamp, updatedAt: exportTimestamp },
    { id: exportIds.parallelRelationship, diagramId: exportIds.diagram, sourceComponentId: exportIds.systemA, targetComponentId: exportIds.systemB, direction: 'undirected', label: 'reconciles', createdAt: exportTimestamp, updatedAt: exportTimestamp },
  ],
  groups: [{ id: exportIds.group, diagramId: exportIds.diagram, name: 'Finance & ledger', memberComponentIds: [exportIds.systemA, exportIds.systemB], ...calculateGroupBounds([systemA, systemB]), createdAt: exportTimestamp, updatedAt: exportTimestamp }],
});

export const exportAdrFixture = (overrides: Partial<ArchitectureDecisionRecord> = {}): ArchitectureDecisionRecord => ({
  id: exportIds.adr,
  diagramId: exportIds.diagram,
  title: 'Use a payment boundary',
  context: 'Payments need a clear owner.',
  decision: 'Route commands through Payments.',
  consequences: 'The boundary owns retries.',
  alternativesOrConstraints: 'Keep the current provider.',
  status: 'accepted',
  replacementAdrId: null,
  componentIds: [exportIds.systemA],
  relationshipIds: [],
  createdAt: exportTimestamp,
  updatedAt: exportTimestamp,
  ...overrides,
});

export const exportAdrsFixture = (): ArchitectureDecisionRecord[] => [
  exportAdrFixture(),
  exportAdrFixture({ id: exportIds.relationshipAdr, title: 'Keep ledger writes ordered', componentIds: [], relationshipIds: [exportIds.relationship] }),
  exportAdrFixture({ id: exportIds.unlinkedAdr, title: 'Review token rotation', componentIds: [], relationshipIds: [], status: 'rejected' }),
];

export const htmlPackageFixtureIds = {
  ...containerFixtureIds,
  datastore: '90000000-0000-4000-8000-000000000201',
  datastoreRelationship: '90000000-0000-4000-8000-000000000202',
  trashedOwner: '90000000-0000-4000-8000-000000000203',
  trashedChild: '90000000-0000-4000-8000-000000000204',
  unrelatedParent: '90000000-0000-4000-8000-000000000205',
  unrelatedOwner: '90000000-0000-4000-8000-000000000206',
  unrelatedChild: '90000000-0000-4000-8000-000000000207',
  parentAcceptedAdr: '90000000-0000-4000-8000-000000000208',
  parentDraftAdr: '90000000-0000-4000-8000-000000000209',
  parentSupersededAdr: '90000000-0000-4000-8000-000000000210',
  parentRejectedAdr: '90000000-0000-4000-8000-000000000211',
  childAcceptedAdr: '90000000-0000-4000-8000-000000000212',
  childDraftAdr: '90000000-0000-4000-8000-000000000213',
  childSupersededAdr: '90000000-0000-4000-8000-000000000214',
  childRejectedAdr: '90000000-0000-4000-8000-000000000215',
} as const;

export interface HtmlPackageFixture {
  parent: DiagramDocument;
  children: DiagramDocument[];
  trashedChild: DiagramDocument;
  unrelatedParent: DiagramDocument;
  unrelatedChild: DiagramDocument;
  adrsByDiagram: Record<string, ArchitectureDecisionRecord[]>;
  availability: ContainerAvailability[];
  expected: ReturnType<typeof htmlPackageFixtureExpectations>;
}

/** Recompute after persisted fixtures receive fresh server-generated identities. */
export function htmlPackageFixtureExpectations(fixture: Omit<HtmlPackageFixture, 'expected'>) {
  const diagrams = [fixture.parent, ...[...fixture.children].sort((a, b) => a.id.localeCompare(b.id))];
  const adrs = diagrams.flatMap(diagram => fixture.adrsByDiagram[diagram.id] ?? []);
  const ownerChildren = Object.fromEntries(fixture.children.map(child => [child.scope!.softwareSystemId, child.id]));
  const directAdrIds: Record<string, string[]> = {};
  for (const diagram of diagrams) {
    for (const artifact of [...diagram.components, ...diagram.relationships]) {
      directAdrIds[artifact.id] = adrs.filter(adr => adr.diagramId === diagram.id &&
        (adr.componentIds.includes(artifact.id) || adr.relationshipIds.includes(artifact.id))).map(adr => adr.id);
    }
  }
  return {
    diagramIds: diagrams.map(diagram => diagram.id),
    excludedDiagramIds: [fixture.trashedChild.id, fixture.unrelatedParent.id, fixture.unrelatedChild.id],
    componentIds: diagrams.flatMap(diagram => diagram.components.map(component => component.id)),
    relationshipIds: diagrams.flatMap(diagram => diagram.relationships.map(relationship => relationship.id)),
    adrIds: adrs.map(adr => adr.id),
    ownerChildren,
    directAdrIds,
    parentLinks: fixture.children.map(child => ({ fromDiagramId: child.id, toDiagramId: fixture.parent.id, componentId: child.scope!.softwareSystemId })),
    siblingLinks: fixture.children.flatMap(child => child.components.filter(component =>
      component.role === 'external' && component.type === 'software-system' && ownerChildren[component.sourceComponentId!])
      .map(component => ({ fromDiagramId: child.id, componentId: component.id, toDiagramId: ownerChildren[component.sourceComponentId!] }))),
    filePaths: [
      'index.html', 'adrs.html', 'diagram.svg', 'styles.css',
      ...diagrams.slice(1).flatMap(diagram => [`diagrams/${diagram.id}/index.html`, `diagrams/${diagram.id}/diagram.svg`]),
      ...adrs.map(adr => `adrs/${adr.id}.md`),
    ],
  };
}

/** Valid saved graph; every call returns detached data, including deliberate exclusions. */
export function htmlPackageFixture(): HtmlPackageFixture {
  const ids = htmlPackageFixtureIds;
  const normalize = (input: unknown): DiagramDocument => diagramDocumentSchema.parse(input);
  const parent = normalize(groupedOwnerParentFixture());
  parent.components.push({ ...parent.components[0], id: ids.trashedOwner, position: { x: 920, y: 100 } });

  const populated = normalize(populatedChildFixture());
  populated.components[0].name = 'Payments';
  populated.components[1] = {
    ...populated.components[1], name: 'Payments', sourceComponentId: ids.duplicateOwner, position: { x: 740, y: 100 },
  };
  populated.components.push({
    ...populated.components[0], id: ids.datastore, containerType: 'datastore',
    description: 'Stores payment records', technology: 'PostgreSQL', position: { x: 360, y: 100 },
  });
  populated.boundary!.size.width = 500;
  populated.relationships.push({
    ...populated.relationships[0], id: ids.datastoreRelationship, targetComponentId: ids.datastore, label: 'stores records', protocol: 'SQL',
  });
  const empty = normalize(emptyChildFixture());
  empty.scope!.softwareSystemId = ids.duplicateOwner;
  const trashedChild = normalize({
    ...empty, id: ids.trashedChild, status: 'trashed', trashedAt: exportTimestamp,
    scope: { ...empty.scope, softwareSystemId: ids.trashedOwner },
  });
  const unrelatedParent = normalize({
    ...parent, id: ids.unrelatedParent, components: [{ ...parent.components[0], id: ids.unrelatedOwner, diagramId: ids.unrelatedParent }],
    relationships: [], groups: [],
  });
  const unrelatedChild = normalize({
    ...empty, id: ids.unrelatedChild,
    scope: { ...empty.scope, parentDiagramId: ids.unrelatedParent, softwareSystemId: ids.unrelatedOwner },
  });
  const decisions = (diagramId: string, adrIds: string[], components: string[][], relationships: string[][]) =>
    adrIds.map((id, index) => exportAdrFixture({
      id, diagramId, title: 'Payment policy', status: (['accepted', 'draft', 'superseded', 'rejected'] as const)[index],
      replacementAdrId: index === 2 ? adrIds[0] : null, componentIds: components[index], relationshipIds: relationships[index],
    }));
  const children = [empty, populated].sort((a, b) => a.id.localeCompare(b.id));
  const adrsByDiagram = {
    [parent.id]: decisions(parent.id, [ids.parentAcceptedAdr, ids.parentDraftAdr, ids.parentSupersededAdr, ids.parentRejectedAdr],
      [[ids.owner], [ids.owner, ids.sourceSystem], [], []], [[], [ids.parentRelationship], [ids.parentRelationship], []]),
    [populated.id]: decisions(populated.id, [ids.childAcceptedAdr, ids.childDraftAdr, ids.childSupersededAdr, ids.childRejectedAdr],
      [[ids.container], [ids.externalOccurrence], [], []], [[], [], [ids.childRelationship], []]),
    [empty.id]: [],
  };
  const availability: ContainerAvailability[] = parent.components.filter(component => component.type === 'software-system').map(owner => {
    const child = [...children, trashedChild].find(child => child.scope!.softwareSystemId === owner.id);
    return {
      parentDiagramId: parent.id, softwareSystemId: owner.id,
      availability: child ? child.status : 'none',
      diagram: child ? { id: child.id, name: child.name, kind: child.kind, scope: child.scope, status: child.status, createdAt: child.createdAt, updatedAt: child.updatedAt } : null,
    };
  });
  const fixture = { parent, children, trashedChild, unrelatedParent, unrelatedChild, adrsByDiagram, availability };
  return { ...fixture, expected: htmlPackageFixtureExpectations(fixture) };
}
