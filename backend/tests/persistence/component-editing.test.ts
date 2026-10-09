import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, componentAdrFixtures, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import { DiagramService } from '../../src/services/diagram-service';
import type { DiagramDocument } from '../../../shared/src/index';

describe.skipIf(!postgresEnabled)('Component PostgreSQL navigation and naming', () => {
  let db: Awaited<ReturnType<typeof componentTestDatabase>>, service: DiagramService;
  beforeEach(async () => { db = await componentTestDatabase(); for (const d of [componentContextFixture(), componentParentFixture(), populatedComponentFixture()]) await db.diagrams.create(d as DiagramDocument); service = new DiagramService(db.diagrams, db.adrs); });
  afterEach(async () => { await db?.close(); });
  it('preserves stored child content/timestamps on owner projection and exact UUIDs across repeated saves', async () => {
    const before = (await db.diagrams.get(ids.child))!;
    const parent = (await service.load(ids.parent)); parent.components[0] = { ...parent.components[0], name: 'Renamed owner', containerType: 'datastore', position: { x: 100, y: 100 }, size: { width: 220, height: 120 } };
    parent.boundary = { position: { x: 76, y: 32 }, size: { width: 488, height: 250 } };
    await service.save(ids.parent, parent); const ancestors = [await db.diagrams.get(ids.context), await db.diagrams.get(ids.parent)];
    const loaded = await service.load(ids.child); expect(loaded).toMatchObject({ id: before.id, name: 'Renamed owner', createdAt: before.createdAt, updatedAt: before.updatedAt, scope: { containerType: 'datastore' } });
    expect(await db.diagrams.get(ids.child)).toMatchObject({ createdAt: before.createdAt, updatedAt: before.updatedAt, components: before.components, relationships: before.relationships, boundary: before.boundary });
    const stored = await db.pool.query('SELECT name, created_at, updated_at FROM diagrams WHERE id = $1', [ids.child]);
    expect(stored.rows[0].name).toBe(before.name); expect(stored.rows[0].updated_at.toISOString()).toBe(before.updatedAt);
    expect((await service.listSummaries()).find(d => d.id === ids.child)?.name).toBe('Renamed owner');
    const record = await db.adrs.create(ids.child, componentAdrFixtures()[0]); await db.adrs.replaceLinks(record.id, [ids.internal, ids.childPerson]); await db.adrs.replaceRelationshipLinks(record.id, [ids.relationship]); const adr = await db.adrs.get(record.id);
    for (let i = 0; i < 2; i++) { const saved = await service.save(ids.child, loaded); expect(saved).toMatchObject({ id: before.id, kind: 'component', createdAt: before.createdAt, scope: { parentDiagramId: ids.parent, containerId: ids.application } }); expect(saved.components.map(c => c.id)).toEqual(before.components.map(c => c.id)); expect(saved.relationships.map(({ updatedAt, ...r }) => r)).toEqual(before.relationships.map(({ updatedAt, ...r }) => r)); expect(saved.boundary).toEqual(before.boundary); }
    expect(await db.adrs.get(record.id)).toEqual(adr);
    expect([await db.diagrams.get(ids.context), await db.diagrams.get(ids.parent)]).toEqual(ancestors);
  });
});
