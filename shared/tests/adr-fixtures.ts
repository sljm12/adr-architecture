import type { ArchitectureDecisionRecord, Component, Diagram } from '../src/index';

export const adrFixtureIds = {
  diagram: '00000000-0000-0000-0000-000000000201',
  otherDiagram: '00000000-0000-0000-0000-000000000202',
  componentA: '00000000-0000-0000-0000-000000000211',
  componentB: '00000000-0000-0000-0000-000000000212',
  otherComponent: '00000000-0000-0000-0000-000000000213',
  adr: '00000000-0000-0000-0000-000000000221',
  replacementAdr: '00000000-0000-0000-0000-000000000222',
};

export const adrFixtureTimestamp = '2026-01-01T00:00:00.000Z';

export const adrDiagramFixture: Diagram = {
  id: adrFixtureIds.diagram,
  name: 'Payments platform',
  status: 'active',
  createdAt: adrFixtureTimestamp,
  updatedAt: adrFixtureTimestamp,
  trashedAt: null,
};

export const adrComponentFixtures: Component[] = [
  { id: adrFixtureIds.componentA, diagramId: adrFixtureIds.diagram, name: 'API gateway', description: null, type: 'service', position: { x: 80, y: 100 }, createdAt: adrFixtureTimestamp, updatedAt: adrFixtureTimestamp },
  { id: adrFixtureIds.componentB, diagramId: adrFixtureIds.diagram, name: 'Payments database', description: null, type: 'store', position: { x: 320, y: 100 }, createdAt: adrFixtureTimestamp, updatedAt: adrFixtureTimestamp },
  { id: adrFixtureIds.otherComponent, diagramId: adrFixtureIds.otherDiagram, name: 'Other diagram component', description: null, type: null, position: { x: 0, y: 0 }, createdAt: adrFixtureTimestamp, updatedAt: adrFixtureTimestamp },
];

export const completeAdrFixture = (overrides: Partial<ArchitectureDecisionRecord> = {}): ArchitectureDecisionRecord => ({
  id: adrFixtureIds.adr,
  diagramId: adrFixtureIds.diagram,
  title: 'Use a payment service boundary',
  context: 'Payment processing needs an explicit boundary.',
  decision: 'Route payment commands through the payment service.',
  consequences: 'The service owns payment provider integration and retries.',
  alternativesOrConstraints: 'Must support the existing provider API.',
  status: 'accepted',
  replacementAdrId: null,
  componentIds: [adrFixtureIds.componentA],
  createdAt: adrFixtureTimestamp,
  updatedAt: adrFixtureTimestamp,
  ...overrides,
});

export const incompleteAdrFixture = (field: 'title' | 'context' | 'decision' | 'consequences'): Record<string, unknown> => {
  const fixture = completeAdrFixture();
  return { ...fixture, [field]: '' };
};

export const supersededAdrFixture = completeAdrFixture({ status: 'superseded', replacementAdrId: adrFixtureIds.replacementAdr });
export const unlinkedAdrFixture = completeAdrFixture({ componentIds: [] });
