import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createDatabase } from '../../src/persistence/database';
import { PostgresDiagramRepository } from '../../src/persistence/diagram-repository';
import type { DiagramDocument } from '../../../../shared/src/index';

const enabled = Boolean(process.env.DATABASE_URL);
const postgres = enabled ? createDatabase(process.env.DATABASE_URL) : undefined;
const repository = postgres ? new PostgresDiagramRepository(postgres.db) : undefined;
const diagramId = '10000000-0000-4000-8000-000000000001';
const componentA = '10000000-0000-4000-8000-000000000002';
const componentB = '10000000-0000-4000-8000-000000000003';
const relationshipId = '10000000-0000-4000-8000-000000000004';
const timestamp = '2026-01-01T00:00:00.000Z';
const cleanup = async (pool: Pool) => {
  await pool.query('DELETE FROM relationships WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM components WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM diagrams WHERE id = $1', [diagramId]);
};

const document: DiagramDocument = {
  id: diagramId, name: 'Production topology', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null,
  components: [
    { id: componentA, diagramId, name: 'API', description: 'Public edge', type: 'service', position: { x: 120, y: 80 }, createdAt: timestamp, updatedAt: timestamp },
    { id: componentB, diagramId, name: 'Database', description: null, type: 'store', position: { x: 420, y: 260 }, createdAt: timestamp, updatedAt: timestamp },
  ],
  relationships: [{ id: relationshipId, diagramId, sourceComponentId: componentA, targetComponentId: componentB, direction: 'directed', label: 'queries', createdAt: timestamp, updatedAt: timestamp }],
};

describe.skipIf(!enabled)('PostgreSQL diagram repository', () => {
  beforeAll(async () => {
    await cleanup(postgres!.pool as Pool);
  });

  afterAll(async () => {
    await cleanup(postgres!.pool as Pool);
    await postgres!.pool.end();
  });

  it('round-trips a complete document through a fresh repository instance', async () => {
    await repository!.create(document);
    const freshRepository = new PostgresDiagramRepository(postgres!.db);
    const loaded = await freshRepository.get(diagramId);

    expect(loaded).toMatchObject({ id: diagramId, name: document.name, status: 'active', trashedAt: null });
    expect(loaded?.components).toEqual(expect.arrayContaining(document.components.map(component => expect.objectContaining({
      id: component.id, diagramId: component.diagramId, name: component.name, description: component.description,
      type: component.type, position: component.position,
    }))));
    expect(loaded?.relationships).toEqual(expect.arrayContaining(document.relationships.map(relationship => expect.objectContaining({
      id: relationship.id, diagramId: relationship.diagramId, sourceComponentId: relationship.sourceComponentId,
      targetComponentId: relationship.targetComponentId, direction: relationship.direction, label: relationship.label,
    }))));
    expect(loaded?.components.map(component => component.id)).toEqual([componentA, componentB]);
    expect(loaded?.relationships[0]).toMatchObject({ id: relationshipId, sourceComponentId: componentA, targetComponentId: componentB, direction: 'directed', label: 'queries' });
    expect(loaded?.components.find(component => component.id === componentB)?.position).toEqual({ x: 420, y: 260 });
  });

  it('replaces children transactionally while retaining stable artifact IDs', async () => {
    const updated = { ...document, name: 'Renamed topology', components: document.components.map(component => component.id === componentA ? { ...component, name: 'Gateway', position: { x: 900, y: 700 } } : component) };
    await repository!.replace(updated);
    const loaded = await repository!.get(diagramId);
    expect(loaded?.name).toBe('Renamed topology');
    expect(loaded?.components.find(component => component.id === componentA)).toMatchObject({ id: componentA, name: 'Gateway', position: { x: 900, y: 700 } });
    expect(loaded?.relationships[0].sourceComponentId).toBe(componentA);
  });
});
