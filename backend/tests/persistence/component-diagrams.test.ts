import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { componentContextFixture, componentParentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import { DiagramService } from '../../src/services/diagram-service';
import { GraphTransaction } from '../../src/persistence/graph-transaction';

describe.skipIf(!postgresEnabled)('Component PostgreSQL creation', () => {
  let database: Awaited<ReturnType<typeof componentTestDatabase>>;
  let service: DiagramService;
  beforeEach(async () => {
    database = await componentTestDatabase();
    await database.diagrams.create(componentContextFixture()); await database.diagrams.create(componentParentFixture());
    service = new DiagramService(database.diagrams, database.adrs);
  });
  afterEach(async () => { await database?.close(); });
  it('serializes overlapping creates and lost-response retries without changing ancestors', async () => {
    const before = await database.diagrams.listAll();
    const results = await Promise.all(Array.from({ length: 4 }, () => service.createOrOpenComponentDiagram(ids.parent, ids.application)));
    expect(new Set(results.map(r => r.document.id)).size).toBe(1);
    expect(results.filter(r => r.created)).toHaveLength(1);
    const retry = await service.createOrOpenComponentDiagram(ids.parent, ids.application);
    expect(retry.created).toBe(false); expect(retry.document.id).toBe(results[0].document.id);
    expect(await database.diagrams.get(ids.context)).toEqual(before.find(d => d.id === ids.context));
    expect(await database.diagrams.get(ids.parent)).toEqual(before.find(d => d.id === ids.parent));
    expect(await database.diagrams.findChildren(ids.parent)).toHaveLength(1);
  });
  it('retains owner uniqueness for recoverable children', async () => {
    const child = (await service.createOrOpenComponentDiagram(ids.parent, ids.datastore)).document;
    await database.diagrams.trash(child.id);
    await expect(service.createOrOpenComponentDiagram(ids.parent, ids.datastore)).rejects.toMatchObject({ code: 'RESTORE_REQUIRED', diagram: { id: child.id } });
    expect(await database.diagrams.findChildren(ids.parent)).toHaveLength(1);
  });
  it('creates versus owner removal without dangling references', async () => {
    const outcomes = await Promise.allSettled([service.createOrOpenComponentDiagram(ids.parent, ids.datastore), service.removeComponent(ids.parent, ids.datastore)]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const children = await database.diagrams.findChildren(ids.parent);
    if (children.length) expect((await database.diagrams.get(ids.parent))!.components.some(c => c.id === ids.datastore)).toBe(true);
    else expect((await database.diagrams.get(ids.parent))!.components.some(c => c.id === ids.datastore)).toBe(false);
  });
  it('rechecks activity when a concurrent root trash wins', async () => {
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const trash = new GraphTransaction(database.diagrams).run(ids.context, [], async ({ diagrams }) => { entered(); await gate; await diagrams.trash(ids.parent); await diagrams.trash(ids.context); });
    await started;
    const attempt = expect(service.createOrOpenComponentDiagram(ids.parent, ids.application)).rejects.toMatchObject({ code: 'PARENT_INACTIVE' });
    try { release(); await trash; await attempt; expect(await database.diagrams.findChildren(ids.parent)).toEqual([]); }
    finally { release(); await trash; }
  });
});
