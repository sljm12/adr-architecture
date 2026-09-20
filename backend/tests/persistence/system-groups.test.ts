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

  it('round-trips an added membership while preserving component identity and position', () => {
    const repository = new DiagramRepository();
    const service = new DiagramService(repository);
    repository.create({ ...baseDocument(), groups: [] });
    const original = service.save(diagramId, baseDocument());
    const outsideId = '00000000-0000-4000-8000-000000000505';
    const outside = { id: outsideId, diagramId, name: 'Notifications', description: null, type: 'software-system' as const, position: { x: 620, y: 260 }, createdAt: timestamp, updatedAt: timestamp };
    const added = service.save(diagramId, { ...original, components: [...original.components, outside], groups: [{ ...original.groups[0], memberComponentIds: [...original.groups[0].memberComponentIds, outsideId], ...calculateGroupBounds([...original.components.map(component => component.position), outside.position]) }] });
    expect(added.groups[0]).toMatchObject({ id: groupId, memberComponentIds: [secondId, firstId, outsideId], createdAt: original.groups[0].createdAt });
    expect(added.components.find(component => component.id === outsideId)).toMatchObject({ id: outsideId, position: outside.position });
    expect(repository.get(diagramId)?.groups[0].memberComponentIds).toContain(outsideId);
  });

  it('rejects invalid memberships without replacing the persisted document', () => {
    const repository = new DiagramRepository();
    const service = new DiagramService(repository);
    repository.create({ ...baseDocument(), groups: [] });
    const original = service.save(diagramId, baseDocument());
    const outsideId = '00000000-0000-4000-8000-000000000506';
    const supportId = '00000000-0000-4000-8000-000000000507';
    const personId = '00000000-0000-4000-8000-000000000508';
    const outside = { id: outsideId, diagramId, name: 'Reporting', description: null, type: 'software-system' as const, position: { x: 620, y: 260 }, createdAt: timestamp, updatedAt: timestamp };
    const support = { id: supportId, diagramId, name: 'Support', description: null, type: 'software-system' as const, position: { x: 860, y: 340 }, createdAt: timestamp, updatedAt: timestamp };
    const person = { id: personId, diagramId, name: 'Operator', description: null, type: 'person' as const, position: { x: 20, y: 20 }, createdAt: timestamp, updatedAt: timestamp };
    const secondGroup: SystemGroup = { id: '00000000-0000-4000-8000-000000000509', diagramId, name: 'Operations', memberComponentIds: [outsideId, supportId], ...calculateGroupBounds([outside.position, support.position]), createdAt: timestamp, updatedAt: timestamp };
    const valid = { ...original, components: [...original.components, outside, support, person], groups: [original.groups[0], secondGroup] };
    const stored = service.save(diagramId, valid);
    const target = stored.groups[0];
    const invalidDocuments = [
      { ...stored, groups: [{ ...target, memberComponentIds: [firstId, secondId, firstId], ...calculateGroupBounds([stored.components[0].position, stored.components[1].position, stored.components[0].position]) }, stored.groups[1]] },
      { ...stored, groups: [{ ...target, memberComponentIds: [firstId, secondId, outsideId], ...calculateGroupBounds([stored.components[0].position, stored.components[1].position, outside.position]) }, stored.groups[1]] },
      { ...stored, groups: [{ ...target, memberComponentIds: [firstId, secondId, personId], ...calculateGroupBounds([stored.components[0].position, stored.components[1].position, person.position]) }, stored.groups[1]] },
      { ...stored, groups: [{ ...target, size: { width: 100, height: 100 } }, stored.groups[1]] },
    ];
    for (const invalid of invalidDocuments) {
      expect(() => service.save(diagramId, invalid)).toThrow();
      expect(repository.get(diagramId)).toEqual(stored);
    }
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
