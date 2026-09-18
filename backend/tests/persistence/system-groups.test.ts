import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { DiagramDocument, SystemGroup } from '../../../shared/src/index';
import { calculateGroupBounds } from '../../../shared/src/index';
import { DiagramRepository, PostgresDiagramRepository } from '../../src/persistence/diagram-repository';
import { createDatabase } from '../../src/persistence/database';
import { DiagramService } from '../../src/services/diagram-service';

const diagramId = '00000000-0000-4000-8000-000000000501';
const firstId = '00000000-0000-4000-8000-000000000502';
const secondId = '00000000-0000-4000-8000-000000000503';
const groupId = '00000000-0000-4000-8000-000000000504';
const timestamp = '2026-01-01T00:00:00.000Z';

const baseDocument = (): DiagramDocument => {
  const components = [
    { id: firstId, diagramId, name: ' Checkout ', description: null, type: 'software-system' as const, position: { x: 100, y: 120 }, createdAt: timestamp, updatedAt: timestamp },
    { id: secondId, diagramId, name: 'Ledger', description: null, type: 'software-system' as const, position: { x: 360, y: 180 }, createdAt: timestamp, updatedAt: timestamp },
  ];
  const group: SystemGroup = { id: groupId, diagramId, name: ' Finance ', memberComponentIds: [secondId, firstId], ...calculateGroupBounds(components.map(component => component.position)), createdAt: timestamp, updatedAt: timestamp };
  return { id: diagramId, name: ' Finance topology ', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null, components, relationships: [], groups: [group] };
};

describe('system group persistence compatibility', () => {
  it('round-trips groups in memory while preserving identity, positions, and normalized names', () => {
    const repository = new DiagramRepository();
    const service = new DiagramService(repository);
    repository.create({ ...baseDocument(), groups: [] });
    const saved = service.save(diagramId, baseDocument());
    expect(saved.groups).toHaveLength(1);
    expect(saved.groups[0]).toMatchObject({ id: groupId, name: 'Finance', memberComponentIds: [secondId, firstId] });
    expect(saved.groups[0].createdAt).toBe(timestamp);
    expect(saved.components[0]).toMatchObject({ id: firstId, name: 'Checkout' });

    const renamed = service.save(diagramId, { ...saved, groups: [{ ...saved.groups[0], name: '  FINANCE  ' }] });
    expect(renamed.groups[0]).toMatchObject({ id: groupId, name: 'FINANCE', createdAt: timestamp });
    expect(renamed.groups[0].updatedAt).not.toBe(timestamp);
    expect(repository.get(diagramId)?.groups).toEqual(renamed.groups);
  });

  it('defaults omitted groups to an empty list for legacy documents', () => {
    const repository = new DiagramRepository();
    const service = new DiagramService(repository);
    repository.create({ ...baseDocument(), groups: [] });
    const legacy = { ...baseDocument(), groups: undefined };
    const saved = service.save(diagramId, legacy);
    expect(saved.groups).toEqual([]);
    expect(repository.get(diagramId)?.groups).toEqual([]);
  });

  it('rejects an invalid replacement without mutating the stored group', () => {
    const repository = new DiagramRepository();
    const service = new DiagramService(repository);
    repository.create({ ...baseDocument(), groups: [] });
    const original = service.save(diagramId, baseDocument());
    const invalid = { ...original, groups: [{ ...original.groups[0], memberComponentIds: [firstId] }] };

    expect(() => service.save(diagramId, invalid)).toThrow(/at least two/i);
    expect(repository.get(diagramId)).toEqual(original);
  });

  it('blocks grouped component deletion and reports the stable group ID', () => {
    const repository = new DiagramRepository();
    const service = new DiagramService(repository);
    repository.create({ ...baseDocument(), groups: [] });
    service.save(diagramId, baseDocument());

    expect(() => service.removeComponent(diagramId, firstId)).toThrow(new RegExp(`system group.*${groupId}`));
    expect(repository.get(diagramId)?.components).toHaveLength(2);
  });
});

const postgresEnabled = Boolean(process.env.RUN_POSTGRES_TESTS && process.env.DATABASE_URL);
const database = postgresEnabled ? createDatabase(process.env.DATABASE_URL) : undefined;
const cleanup = async (pool: Pool) => {
  await pool.query('DELETE FROM system_group_members WHERE group_id IN (SELECT id FROM system_groups WHERE diagram_id = $1)', [diagramId]);
  await pool.query('DELETE FROM system_groups WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM relationships WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM components WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM diagrams WHERE id = $1', [diagramId]);
};

describe.skipIf(!postgresEnabled)('PostgreSQL system group persistence', () => {
  beforeAll(async () => { await cleanup(database!.pool as Pool); });
  afterAll(async () => { await cleanup(database!.pool as Pool); await database!.pool.end(); });

  it('round-trips normalized memberships and preserves group creation timestamps on replacement', async () => {
    const repository = new PostgresDiagramRepository(database!.db);
    const service = new DiagramService(repository);
    await repository.create({ ...baseDocument(), groups: [] });
    const created = await service.save(diagramId, baseDocument());
    const loaded = await new PostgresDiagramRepository(database!.db).get(diagramId);
    expect(loaded?.groups[0]).toMatchObject({ id: groupId, name: 'Finance', memberComponentIds: [firstId, secondId] });
    const replaced = await service.save(diagramId, { ...loaded!, groups: [{ ...loaded!.groups[0], name: 'Core Finance' }] });
    expect(replaced.groups[0].id).toBe(created.groups[0].id);
    expect(replaced.groups[0].createdAt).toBe(created.groups[0].createdAt);
    expect(replaced.groups[0].updatedAt).not.toBe(created.groups[0].updatedAt);
  });
});
