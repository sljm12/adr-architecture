import type { DiagramDocument, DiagramSummary } from '../../shared/src/index';

const timestamps = {
  before: '2026-01-09T12:00:00.000Z',
  start: '2026-01-10T00:00:00.000Z',
  end: '2026-01-12T23:59:59.000Z',
  after: '2026-01-13T08:00:00.000Z',
};

export const diagramListFixtures: DiagramSummary[] = [
  { id: '00000000-0000-4000-8000-000000000401', name: 'Payments', status: 'active', createdAt: timestamps.start, updatedAt: timestamps.start },
  { id: '00000000-0000-4000-8000-000000000402', name: 'Payments API', status: 'active', createdAt: timestamps.end, updatedAt: timestamps.after },
  { id: '00000000-0000-4000-8000-000000000403', name: 'Inventory', status: 'active', createdAt: timestamps.after, updatedAt: timestamps.after },
  { id: '00000000-0000-4000-8000-000000000404', name: 'Payments', status: 'active', createdAt: timestamps.start, updatedAt: timestamps.after },
  { id: '00000000-0000-4000-8000-000000000405', name: 'Before range', status: 'active', createdAt: timestamps.before, updatedAt: timestamps.before },
];

export const recoverableDiagramFixture: DiagramDocument = {
  id: '00000000-0000-4000-8000-000000000410', name: 'Recoverable payments', status: 'trashed',
  createdAt: '2026-01-05T10:00:00.000Z', updatedAt: '2026-01-14T10:00:00.000Z', trashedAt: '2026-01-14T10:00:00.000Z',
  components: [
    { id: '00000000-0000-4000-8000-000000000411', diagramId: '00000000-0000-4000-8000-000000000410', name: 'Checkout', description: 'Payment entry point', type: 'software-system', position: { x: 80, y: 100 }, createdAt: '2026-01-05T10:00:00.000Z', updatedAt: '2026-01-05T10:00:00.000Z' },
    { id: '00000000-0000-4000-8000-000000000412', diagramId: '00000000-0000-4000-8000-000000000410', name: 'Ledger', description: null, type: 'software-system', position: { x: 320, y: 100 }, createdAt: '2026-01-05T10:00:00.000Z', updatedAt: '2026-01-05T10:00:00.000Z' },
  ],
  relationships: [{ id: '00000000-0000-4000-8000-000000000413', diagramId: '00000000-0000-4000-8000-000000000410', sourceComponentId: '00000000-0000-4000-8000-000000000411', targetComponentId: '00000000-0000-4000-8000-000000000412', direction: 'directed', label: 'records', createdAt: '2026-01-05T10:00:00.000Z', updatedAt: '2026-01-05T10:00:00.000Z' }],
  groups: [],
};

export const activeDiagramListFixtures = diagramListFixtures.filter(item => item.status === 'active');
export const duplicateNameFixtures = diagramListFixtures.filter(item => item.name === 'Payments');
export const equalCreationDateFixtures = diagramListFixtures.filter(item => item.createdAt === timestamps.start);
export const dateRangeBoundaryFixtures = diagramListFixtures.filter(item => item.createdAt === timestamps.start || item.createdAt === timestamps.end);
