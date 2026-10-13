import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, emptyComponentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../../shared/src/index';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';
import { DiagramRepository, PostgresDiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import * as schema from '../../src/persistence/schema';

describe('Component memory graph transactions', () => {
  it('rolls diagrams, local ADRs and provenance back together on failure', async () => {
    const diagrams = new DiagramRepository(); const adrs = new AdrRepository();
    diagrams.create(componentContextFixture()); diagrams.create(componentParentFixture()); diagrams.create(populatedComponentFixture() as DiagramDocument);
    adrs.registerDiagram(ids.child);
    const before = diagrams.get(ids.child);
    await expect(new GraphTransaction(diagrams, adrs).run(ids.child, [], async context => {
      await context.diagrams.trash(ids.child);
      await context.adrs!.create(ids.child, { title: 'Rollback', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' });
      throw new Error('abort');
    })).rejects.toThrow('abort');
    expect(diagrams.get(ids.child)).toEqual(before); expect(adrs.list(ids.child)).toEqual([]);
    expect(diagrams.getTrashProvenance(ids.child)).toEqual({ trashBatchId: null, trashRootDiagramId: null });
  });
  it('queues unrelated-root diagram and ADR changes and preserves them after rollback', async () => {
    const diagrams = new DiagramRepository(); const adrs = new AdrRepository();
    diagrams.create(componentContextFixture()); diagrams.create(componentParentFixture()); diagrams.create(populatedComponentFixture() as DiagramDocument);
    const other = { ...componentContextFixture(), id: ids.unlinkedAdr, components: [], relationships: [] };
    diagrams.create(other); adrs.registerDiagram(other.id);
    let entered!: () => void; let release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    const first = new GraphTransaction(diagrams, adrs).run(ids.child, [], async context => {
      await context.diagrams.trash(ids.child); entered(); await gate; throw new Error('rollback only this root');
    });
    const rejection = expect(first).rejects.toThrow('rollback only this root');
    let queued: Promise<unknown> | undefined;
    try {
      await started;
      let enteredOther = false;
      queued = new GraphTransaction(diagrams, adrs).run(other.id, [], async context => {
        enteredOther = true;
        await context.diagrams.replace({ ...other, name: 'Independent edit' });
        await context.adrs!.create(other.id, { title: 'Independent decision', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' });
      });
      await Promise.resolve(); expect(enteredOther).toBe(false);
    } finally { release(); await rejection; await queued; }
    expect(diagrams.get(other.id)?.name).toBe('Independent edit'); expect(adrs.list(other.id)).toHaveLength(1); expect(diagrams.get(ids.child)?.status).toBe('active');
  });
});

describe.skipIf(!postgresEnabled)('Component PostgreSQL graph foundations', () => {
  let database: Awaited<ReturnType<typeof componentTestDatabase>>;
  const otherRoot = 'b0000000-0000-4000-8000-000000000001';
  beforeAll(async () => {
    database = await componentTestDatabase();
    await database.diagrams.create(componentContextFixture()); await database.diagrams.create(componentParentFixture()); await database.diagrams.create(populatedComponentFixture() as DiagramDocument); await database.diagrams.create(emptyComponentFixture('datastore') as DiagramDocument);
    await database.diagrams.create({ ...componentContextFixture(), id: otherRoot, components: [], relationships: [] });
  });
  afterAll(async () => { await database?.close(); });
  it('locks every descendant by depth then UUID after rediscovering membership', async () => {
    const locks: string[] = [];
    const db = drizzle(database.pool, { schema, logger: { logQuery(query, params) { if (/for update/i.test(query)) locks.push(params[0] as string); } } });
    await new GraphTransaction(new PostgresDiagramRepository(db)).run(ids.child, [], () => undefined);
    expect(locks).toEqual([ids.context, ids.parent, ...[ids.child, ids.datastoreChild].sort()]);
  });
  it('locks Context before Container and Component, while unrelated roots remain writable', async () => {
    const client = await database.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await client.query('BEGIN'); await client.query('SELECT id FROM diagrams WHERE id=$1 FOR UPDATE', [ids.context]);
      let entered = false;
      pending = new GraphTransaction(database.diagrams).run(ids.child, [], () => { entered = true; });
      // A writer waiting on root must not have acquired a lower-level lock.
      await new Promise(resolve => setTimeout(resolve, 75)); expect(entered).toBe(false);
      await client.query('SELECT id FROM diagrams WHERE id=$1 FOR UPDATE NOWAIT', [ids.parent]);
      await client.query('SELECT id FROM diagrams WHERE id=$1 FOR UPDATE NOWAIT', [ids.child]);
      await new GraphTransaction(database.diagrams).run(otherRoot, [], () => undefined);
    } finally { await client.query('ROLLBACK'); client.release(); await pending; }
  });
  it('shares diagram/ADR transaction rollback and rejects writes under an inactive root', async () => {
    const before = await database.diagrams.get(ids.child);
    await expect(new GraphTransaction(database.diagrams, database.adrs).run(ids.child, [], async context => {
      await context.diagrams.trash(ids.child);
      await context.adrs!.create(ids.child, { title: 'Rollback', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' });
      throw new Error('abort PostgreSQL graph');
    })).rejects.toThrow('abort PostgreSQL graph');
    expect(await database.diagrams.get(ids.child)).toEqual(before); expect(await database.adrs.list(ids.child)).toEqual([]);
    await database.db.update(schema.diagrams).set({ status: 'trashed' }).where(eq(schema.diagrams.id, ids.context));
    await expect(new DiagramService(database.diagrams).save(ids.child, before)).rejects.toMatchObject({ code: 'PARENT_INACTIVE' });
    await expect(new AdrService(database.adrs, database.diagrams).create(ids.child, { title: 'Blocked', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' })).rejects.toMatchObject({ code: 'PARENT_INACTIVE' });
    await database.db.update(schema.diagrams).set({ status: 'active' }).where(eq(schema.diagrams.id, ids.context));
  });
  it('protects immediate Container sources and stable parent rows across child saves', async () => {
    const service = new DiagramService(database.diagrams, database.adrs);
    const parent = (await database.diagrams.get(ids.parent))!;
    const before = await database.pool.query('SELECT * FROM components WHERE diagram_id=$1 ORDER BY id', [ids.parent]);
    await service.save(ids.child, await database.diagrams.get(ids.child));
    expect((await database.pool.query('SELECT * FROM components WHERE diagram_id=$1 ORDER BY id', [ids.parent])).rows).toEqual(before.rows);
    await expect(service.save(ids.parent, { ...parent, components: parent.components.filter(c => c.id !== ids.personOccurrence) })).rejects.toMatchObject({ code: 'DIAGRAM_DEPENDENCY' });
    await database.diagrams.trash(ids.child);
    await expect(service.removeComponent(ids.parent, ids.personOccurrence)).rejects.toMatchObject({ code: 'DIAGRAM_DEPENDENCY' });
    await database.diagrams.restore(ids.child);
  });
  it('serializes immediate-source inclusion versus parent omission without a dangling child', async () => {
    const service = new DiagramService(database.diagrams, database.adrs);
    const child = (await database.diagrams.get(ids.child))!; const parent = (await database.diagrams.get(ids.parent))!;
    await service.save(ids.child, { ...child, components: child.components.filter(c => c.id !== ids.childPerson) });
    const attempts = await Promise.allSettled([
      service.save(ids.child, child),
      service.save(ids.parent, { ...parent, components: parent.components.filter(c => c.id !== ids.personOccurrence) }),
    ]);
    expect(attempts.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const currentChild = (await database.diagrams.get(ids.child))!; const currentParent = (await database.diagrams.get(ids.parent))!;
    if (currentChild.components.some(c => c.id === ids.childPerson)) expect(currentParent.components.some(c => c.id === ids.personOccurrence)).toBe(true);
    await service.save(ids.parent, parent); await service.save(ids.child, child);
  });
  it('rechecks ancestor activity after a root mutation wins over Component and ADR saves', async () => {
    let entered!: () => void; let release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    const rootWrite = new GraphTransaction(database.diagrams).run(ids.context, [], async context => {
      entered(); await gate; await context.diagrams.trash(ids.context);
    });
    await started;
    const saves = Promise.allSettled([
      new DiagramService(database.diagrams, database.adrs).save(ids.child, await database.diagrams.get(ids.child)),
      new AdrService(database.adrs, database.diagrams).create(ids.child, { title: 'Concurrent decision', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' }),
    ]);
    try {
      await new Promise(resolve => setTimeout(resolve, 50)); release(); await rootWrite;
      const results = await saves;
      expect(results).toHaveLength(2);
      for (const result of results) { expect(result.status).toBe('rejected'); if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'PARENT_INACTIVE' }); }
      expect(await database.adrs.list(ids.child)).toEqual([]);
    } finally { release(); await rootWrite; await database.diagrams.restore(ids.context); }
  });
  it('serializes confirmed root trash against Component and ADR writes without active orphans', async () => {
    const service = new DiagramService(database.diagrams, database.adrs);
    const child = await service.load(ids.child);
    const impact = await service.trashImpact(ids.context);
    const results = await Promise.allSettled([
      service.trash(ids.context, impact.affectedDiagramIds),
      service.save(ids.child, child),
      new AdrService(database.adrs, database.diagrams).create(ids.child, { title: 'Concurrent', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' }),
    ]);
    expect(results[0].status).toBe('fulfilled');
    for (const id of [ids.context, ids.parent, ids.child, ids.datastoreChild]) expect((await database.diagrams.get(id))?.status).toBe('trashed');
    for (const result of results.slice(1)) if (result.status === 'rejected') expect(['Diagram not found', 'Restore every inactive ancestor before changing this diagram.', 'Restore every inactive ancestor before accessing or changing decisions.']).toContain(result.reason.message);
    const restore = await service.restoreImpact(ids.child);
    await service.restore(ids.context, { confirmedDiagramIds: restore.affectedDiagramIds, confirmedTrashBatchId: restore.trashBatchId });
  });
  it('rechecks confirmation membership under the root lock', async () => {
    const service = new DiagramService(database.diagrams);
    const stale = await service.trashImpact(ids.context);
    await service.trash(ids.datastoreChild);
    const before = await database.diagrams.listAll();
    await expect(service.trash(ids.context, stale.affectedDiagramIds)).rejects.toMatchObject({ code: 'TRASH_IMPACT_CHANGED' });
    expect(await database.diagrams.listAll()).toEqual(before);
    await service.restore(ids.datastoreChild);
  });
  it('serializes independent child trash versus confirmed ancestor trash with exact batches', async () => {
    const service = new DiagramService(database.diagrams);
    const impact = await service.trashImpact(ids.context);
    const results = await Promise.allSettled([service.trash(ids.context, impact.affectedDiagramIds), service.trash(ids.datastoreChild)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    if ((await database.diagrams.get(ids.context))?.status === 'trashed') {
      expect(results[0].status).toBe('fulfilled');
      expect(await database.diagrams.getTrashProvenance(ids.datastoreChild)).toEqual(await database.diagrams.getTrashProvenance(ids.context));
      const restore = await service.restoreImpact(ids.child);
      await service.restore(ids.context, { confirmedDiagramIds: restore.affectedDiagramIds, confirmedTrashBatchId: restore.trashBatchId });
    } else {
      expect(results[1].status).toBe('fulfilled');
      if (results[0].status === 'rejected') expect(results[0].reason).toMatchObject({ code: 'TRASH_IMPACT_CHANGED' });
      expect((await database.diagrams.get(ids.child))?.status).toBe('active');
      expect(await database.diagrams.getTrashProvenance(ids.datastoreChild)).toMatchObject({ trashRootDiagramId: ids.datastoreChild });
      await service.restore(ids.datastoreChild);
    }
  });
});
