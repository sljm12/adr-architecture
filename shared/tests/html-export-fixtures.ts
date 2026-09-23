import { calculateGroupBounds, type ArchitectureDecisionRecord, type DiagramDocument } from '../src/index';

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
  components: [structuredClone(systemA), structuredClone(systemB), structuredClone(person)],
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
