import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import type { DiagramDocument } from '../../../shared/src/index';

const ids = {
  diagram: '00000000-0000-0000-0000-000000000001',
  api: '00000000-0000-0000-0000-000000000002',
  database: '00000000-0000-0000-0000-000000000003',
  relationship: '00000000-0000-0000-0000-000000000004'
};

const document: DiagramDocument = {
  id: ids.diagram, name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [
    { id: ids.api, diagramId: ids.diagram, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: ids.database, diagramId: ids.diagram, name: 'Database', description: null, type: null, position: { x: 1, y: 1 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
  ],
  relationships: [{ id: ids.relationship, diagramId: ids.diagram, sourceComponentId: ids.api, targetComponentId: ids.database, direction: 'directed', label: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }]
};

describe('recovery API', () => {
  it('returns dependency count and blocks connected component deletion', async () => {
    const repository = new DiagramRepository(); repository.create(document);
    const app = buildApp(repository); await app.ready();
    const count = await app.inject({ method: 'GET', url: `/diagrams/${ids.diagram}/components/${ids.api}/dependencies` });
    expect(count.statusCode).toBe(200); expect(count.json()).toEqual({ relationshipCount: 1 });
    const removal = await app.inject({ method: 'DELETE', url: `/diagrams/${ids.diagram}/components/${ids.api}` });
    expect(removal.statusCode).toBe(409); expect(removal.json()).toMatchObject({ componentId: ids.api, relationshipCount: 1 });
    expect(repository.get(ids.diagram)?.components).toHaveLength(2);
    await app.close();
  });

  it('removes an unconnected component and returns the updated document', async () => {
    const repository = new DiagramRepository(); repository.create({ ...document, components: [document.components[0]], relationships: [] });
    const app = buildApp(repository); await app.ready();
    const removal = await app.inject({ method: 'DELETE', url: `/diagrams/${ids.diagram}/components/${ids.api}` });
    expect(removal.statusCode).toBe(200); expect(removal.json().relationshipCount).toBe(0); expect(removal.json().document.components).toHaveLength(0);
    await app.close();
  });

  it('returns 404 for a missing component', async () => {
    const repository = new DiagramRepository(); repository.create({ ...document, relationships: [] });
    const app = buildApp(repository); await app.ready();
    const response = await app.inject({ method: 'GET', url: `/diagrams/${ids.diagram}/components/00000000-0000-0000-0000-000000000099/dependencies` });
    expect(response.statusCode).toBe(404); await app.close();
  });
});
