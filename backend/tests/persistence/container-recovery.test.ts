import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DiagramRepository, PostgresDiagramRepository, type DiagramRepositoryLike } from '../../src/persistence/diagram-repository';
import { DiagramService } from '../../src/services/diagram-service';
import { generalParentFixture, populatedChildFixture, emptyChildFixture, containerFixtureIds as ids } from '../../../shared/tests/container-fixtures';
import * as schema from '../../src/persistence/schema';
import { PostgresAdrRepository } from '../../src/persistence/adr-repository';
import { AdrService } from '../../src/services/adr-service';
import { ContainerContextService } from '../../src/services/container-context';
import { completeAdrPayload } from '../fixtures';

function barrier() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
function controlled(repository: DiagramRepositoryLike, acquired: ReturnType<typeof barrier>, release: ReturnType<typeof barrier>): DiagramRepositoryLike {
  return new Proxy(repository, { get(target, key) {
    if (key === 'withGraphTransaction') return async (parent: string, children: string[], action: any) => target.withGraphTransaction(parent, children, async (scoped, transaction) => { acquired.release(); await release.promise; return action(scoped, transaction); });
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
}
function attempted(repository: DiagramRepositoryLike, entered: ReturnType<typeof barrier>): DiagramRepositoryLike {
  return new Proxy(repository, { get(target, key) {
    if (key === 'withGraphTransaction') return (parent: string, children: string[], action: any) => { entered.release(); return target.withGraphTransaction(parent, children, action); };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
}

async function seed(repository: DiagramRepositoryLike) {
  await repository.create(generalParentFixture() as any); await repository.create(populatedChildFixture() as any);
  const early = emptyChildFixture(); early.scope.softwareSystemId = ids.duplicateOwner; await repository.create(early as any);
}
async function roundTrip(repository: DiagramRepositoryLike) {
  await seed(repository); const service = new DiagramService(repository), before = await repository.get(ids.populatedChild);
  await service.trash(ids.emptyChild); await service.trash(ids.parentDiagram, [ids.parentDiagram, ids.populatedChild]);
  const preview = await service.restoreImpact(ids.emptyChild);
  expect(preview.requestedDiagramIncluded).toBe(false);
  const body = { confirmedDiagramIds: preview.affectedDiagramIds, confirmedTrashBatchId: preview.trashBatchId };
  await service.restore(ids.parentDiagram, body);
  expect(await repository.get(ids.populatedChild)).toMatchObject({ ...before, updatedAt: expect.any(String) });
  expect((await repository.get(ids.emptyChild))?.status).toBe('trashed');
  await service.trash(ids.parentDiagram, preview.affectedDiagramIds);
  await expect(service.restore(ids.parentDiagram, body)).rejects.toMatchObject({ code: 'RESTORE_IMPACT_CHANGED' });
}
describe('memory recovery rollback', () => {
  it('preserves independent trash and rejects a stale same-ID batch', async () => { await roundTrip(new DiagramRepository()); });
  it('rolls back server provenance and all statuses on an aborted transaction', async () => {
    const repository = new DiagramRepository(); await seed(repository);
    const before = repository.listAll();
    await expect(repository.withGraphTransaction(ids.parentDiagram, [ids.populatedChild], async scoped => { await scoped.trash(ids.parentDiagram); throw new Error('abort'); })).rejects.toThrow('abort');
    expect(repository.listAll()).toEqual(before); expect(repository.getTrashProvenance(ids.parentDiagram)).toEqual({ trashBatchId: null, trashRootDiagramId: null });
  });
  it('rolls back the whole batch when an owning source has become invalid', async () => {
    const repository = new DiagramRepository(); await seed(repository); const service = new DiagramService(repository);
    const parent = repository.get(ids.parentDiagram)!; parent.components.find(c => c.id === ids.owner)!.type = 'person'; repository.replace(parent);
    await service.trash(ids.parentDiagram, [ids.parentDiagram, ids.populatedChild, ids.emptyChild]);
    const before = repository.listAll(), provenance = repository.getTrashProvenance(ids.parentDiagram), impact = await service.restoreImpact(ids.populatedChild);
    await expect(service.restore(ids.parentDiagram, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId })).rejects.toMatchObject({ code: 'DIAGRAM_REFERENCE_BROKEN' });
    expect(repository.listAll()).toEqual(before); expect(repository.getTrashProvenance(ids.parentDiagram)).toEqual(provenance);
  });
});
const enabled = process.env.RUN_POSTGRES_TESTS === '1' && Boolean(process.env.DATABASE_URL);
describe.skipIf(!enabled)('PostgreSQL exact recovery', () => {
  const name = `spec009_recovery_${randomUUID().replaceAll('-', '')}`;
  let admin: Pool, pool: Pool, repository: PostgresDiagramRepository;
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.DATABASE_URL }); await admin.query(`CREATE SCHEMA ${name}`);
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${name}` });
    for (const migration of ['0001_initial.sql', '0002_adrs.sql', '0003_system_groups.sql', '0004_component_dimensions.sql', '0005_c4_container_diagrams.sql', '0006_container_component_types.sql']) await pool.query(await readFile(new URL(`../../drizzle/${migration}`, import.meta.url), 'utf8'));
    repository = new PostgresDiagramRepository(drizzle(pool, { schema }));
  });
  afterAll(async () => { await pool?.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`); await admin.end(); } });
  beforeEach(async () => { await pool.query('TRUNCATE diagrams CASCADE'); });
  it('preserves content and creation timestamps and rejects old provenance', async () => { await roundTrip(repository); });
  it('serializes competing restores, leaving exactly one successful batch', async () => {
    await seed(repository); await new DiagramService(repository).trash(ids.parentDiagram, [ids.parentDiagram, ids.populatedChild, ids.emptyChild]);
    const service = new DiagramService(repository), impact = await service.restoreImpact(ids.populatedChild);
    const results = await Promise.allSettled([service.restore(ids.parentDiagram, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId }), service.restore(ids.parentDiagram, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect((await repository.get(ids.populatedChild))?.status).toBe('active');
  });
  it('rolls back a broken-source batch and preserves all ADR links and provenance', async () => {
    await seed(repository);
    const adrs = new PostgresAdrRepository(drizzle(pool, { schema })), adrService = new AdrService(adrs, repository), service = new DiagramService(repository, adrs);
    const adr = await adrService.create(ids.populatedChild, completeAdrPayload); await adrService.replaceLinks(adr.id, { componentIds: [ids.container, ids.externalOccurrence] }); await adrService.replaceRelationshipLinks(adr.id, { relationshipIds: [ids.childRelationship] });
    const decision = await adrs.get(adr.id);
    await service.trash(ids.parentDiagram, [ids.parentDiagram, ids.populatedChild, ids.emptyChild]);
    await pool.query("UPDATE components SET type='person' WHERE id=$1", [ids.owner]);
    const before = await repository.listAll(), provenance = await repository.getTrashProvenance(ids.parentDiagram), impact = await service.restoreImpact(ids.populatedChild);
    await expect(service.restore(ids.parentDiagram, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId })).rejects.toMatchObject({ code: 'DIAGRAM_REFERENCE_BROKEN' });
    expect(await repository.listAll()).toEqual(before); expect(await repository.getTrashProvenance(ids.parentDiagram)).toEqual(provenance); expect(await adrs.get(adr.id)).toEqual(decision);
    await pool.query("UPDATE components SET type='software-system' WHERE id=$1", [ids.owner]);
    await service.restore(ids.parentDiagram, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId }); expect(await adrs.get(adr.id)).toEqual(decision);
  });
  it('rechecks a trash confirmation after a competing canonical child creation', async () => {
    await repository.create(generalParentFixture() as any); await repository.create(populatedChildFixture() as any);
    const acquired = barrier(), release = barrier(), entered = barrier();
    const creating = new ContainerContextService(controlled(repository, acquired, release)).createOrOpen(ids.parentDiagram, ids.duplicateOwner);
    await acquired.promise;
    const trashing = new DiagramService(attempted(repository, entered)).trash(ids.parentDiagram, [ids.parentDiagram, ids.populatedChild]); const observed = trashing.catch(error => error);
    await entered.promise; release.release(); await creating;
    expect(await observed).toMatchObject({ code: 'TRASH_IMPACT_CHANGED' }); expect((await repository.list()).length).toBe(3);
  });
  it('serializes an ADR write behind parent trash and rejects it without a partial record', async () => {
    await seed(repository); const acquired = barrier(), release = barrier(), entered = barrier();
    const adrs = new PostgresAdrRepository(drizzle(pool, { schema }));
    const trashing = new DiagramService(controlled(repository, acquired, release), adrs).trash(ids.parentDiagram, [ids.parentDiagram, ids.populatedChild, ids.emptyChild]); await acquired.promise;
    const writing = new AdrService(adrs, attempted(repository, entered)).create(ids.populatedChild, completeAdrPayload); const observed = writing.catch(error => error);
    await entered.promise; release.release(); await trashing;
    expect(await observed).toBeInstanceOf(Error); expect(await adrs.listFull(ids.populatedChild)).toEqual([]);
  });
  it.each([{ operation: 'create', action: 'retype' }, { operation: 'remove', action: 'retype' }, { operation: 'create', action: 'delete' }, { operation: 'remove', action: 'delete' }] as const)('coordinates source $action against occurrence $operation without losing links', async ({ operation, action }) => {
    await seed(repository); const service = new DiagramService(repository);
    if (action === 'delete') await service.removeRelationship(ids.parentDiagram, ids.parentRelationship);
    if (operation === 'create') { await service.removeRelationship(ids.populatedChild, ids.childRelationship); await service.save(ids.populatedChild, { ...(await repository.get(ids.populatedChild))!, components: (await repository.get(ids.populatedChild))!.components.filter(c => c.role === 'container'), relationships: [] }); }
    const acquired = barrier(), release = barrier(), entered = barrier();
    const changed = operation === 'create' ? populatedChildFixture() as any : { ...(await repository.get(ids.populatedChild))!, components: (await repository.get(ids.populatedChild))!.components.filter(c => c.role === 'container'), relationships: [] };
    if (operation === 'remove') await service.removeRelationship(ids.populatedChild, ids.childRelationship);
    const writing = new DiagramService(controlled(repository, acquired, release)).save(ids.populatedChild, changed); await acquired.promise;
    const parent = (await repository.get(ids.parentDiagram))!; parent.components.find(c => c.id === ids.sourceSystem)!.type = 'database';
    if (action === 'delete') { parent.components = parent.components.filter(c => c.id !== ids.sourceSystem); parent.relationships = parent.relationships.filter(r => r.sourceComponentId !== ids.sourceSystem && r.targetComponentId !== ids.sourceSystem); }
    const retyping = new DiagramService(attempted(repository, entered)).save(parent.id, parent); const observed = retyping.catch(error => error); await entered.promise; release.release(); await writing;
    const outcome = await observed;
    if (operation === 'create') expect(outcome).toMatchObject({ code: 'DIAGRAM_DEPENDENCY', diagramBlockers: [expect.objectContaining({ componentId: ids.externalOccurrence })] });
    else if (action === 'retype') expect(outcome).toMatchObject({ id: ids.parentDiagram, components: expect.arrayContaining([expect.objectContaining({ id: ids.sourceSystem, type: 'database' })]) });
    else expect(outcome).toMatchObject({ id: ids.parentDiagram, components: expect.not.arrayContaining([expect.objectContaining({ id: ids.sourceSystem })]) });
  });
  it('protects a recoverable occurrence from source deletion and unsupported retyping without changing decisions', async () => {
    await seed(repository);
    const adrs = new PostgresAdrRepository(drizzle(pool, { schema })), service = new DiagramService(repository, adrs), adrService = new AdrService(adrs, repository);
    const decision = await adrService.create(ids.populatedChild, completeAdrPayload); await adrService.replaceLinks(decision.id, { componentIds: [ids.externalOccurrence] });
    await service.trash(ids.populatedChild); const before = await repository.listAll(), links = await adrs.get(decision.id);
    const parent = (await repository.get(ids.parentDiagram))!; parent.components.find(c => c.id === ids.sourceSystem)!.type = 'database';
    await expect(service.save(parent.id, parent)).rejects.toMatchObject({ code: 'DIAGRAM_DEPENDENCY', diagramBlockers: [expect.objectContaining({ status: 'trashed', componentId: ids.externalOccurrence, sourceComponentId: ids.sourceSystem })] });
    await expect(service.removeComponent(parent.id, ids.sourceSystem)).rejects.toMatchObject({ code: 'DIAGRAM_DEPENDENCY' });
    expect(await repository.listAll()).toEqual(before); expect(await adrs.get(decision.id)).toEqual(links);
  });
  it('serializes restoration with a source write and parent trash', async () => {
    await seed(repository); const service = new DiagramService(repository); await service.trash(ids.populatedChild);
    const impact = await service.restoreImpact(ids.populatedChild), acquired = barrier(), release = barrier(), entered = barrier();
    const restoring = new DiagramService(controlled(repository, acquired, release)).restore(ids.populatedChild, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId }); await acquired.promise;
    const parent = (await repository.get(ids.parentDiagram))!; parent.components.find(c => c.id === ids.sourceSystem)!.type = 'database';
    const retyping = new DiagramService(attempted(repository, entered)).save(parent.id, parent); const observed = retyping.catch(error => error); await entered.promise; release.release(); await restoring;
    expect(await observed).toMatchObject({ code: 'DIAGRAM_DEPENDENCY' });
    await service.trash(ids.parentDiagram, [ids.parentDiagram, ids.populatedChild, ids.emptyChild]);
    const rootImpact = await service.restoreImpact(ids.populatedChild);
    const settled = await Promise.allSettled([service.restore(ids.parentDiagram, { confirmedDiagramIds: rootImpact.affectedDiagramIds, confirmedTrashBatchId: rootImpact.trashBatchId }), service.trash(ids.parentDiagram, rootImpact.affectedDiagramIds)]);
    expect(settled.filter(r => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect((await repository.get(ids.parentDiagram))!.status).toBe((await repository.get(ids.populatedChild))!.status);
  });
});
