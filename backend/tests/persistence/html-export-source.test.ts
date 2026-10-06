import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PostgresDiagramRepository, type DiagramRepositoryLike } from '../../src/persistence/diagram-repository';
import { PostgresAdrRepository } from '../../src/persistence/adr-repository';
import { ContainerContextService } from '../../src/services/container-context';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';
import { htmlPackageFixture } from '../../../shared/tests/html-export-fixtures';
import * as schema from '../../src/persistence/schema';
import { HtmlExportSourceService } from '../../src/services/html-export-source';
import { scopedRepository, sourceFixture } from '../html-export-source-fixtures';
import { GraphTransaction } from '../../src/persistence/graph-transaction';

describe('in-memory HTML source graph boundary', () => {
  it('keeps raw memberships when required document loads fail', async () => {
    const { diagrams, adrs, fixture } = sourceFixture();
    const repository = scopedRepository(diagrams, scoped => ({ get: id => id === fixture.children[0].id ? undefined : scoped.get(id) }));
    expect(await repository.findChildMembership(fixture.parent.id)).toMatchObject([...fixture.children, fixture.trashedChild].sort((a,b) => a.id.localeCompare(b.id)).map(child => ({ id: child.id, status: child.status, parentDiagramId: fixture.parent.id, ownerComponentId: child.scope!.softwareSystemId })));
    await expect(new HtmlExportSourceService(repository, adrs).gather(fixture.parent.id)).rejects.toMatchObject({ statusCode: 409, diagramId: fixture.children[0].id });
  });
  it('returns detached data with bounded full-ADR reads and no writes or timestamp/provenance changes', async () => {
    const { diagrams, adrs, fixture } = sourceFixture();
    const before = diagrams.listAll(), decisions = adrs.snapshotGraph(), provenance = diagrams.getTrashProvenance(fixture.trashedChild.id);
    const read = vi.spyOn(adrs, 'listFull'); vi.spyOn(adrs, 'get').mockImplementation(() => { throw new Error('per-ADR read'); });
    const source = await new HtmlExportSourceService(diagrams, adrs).gather(fixture.parent.id);
    expect(read.mock.calls.map(([id]) => id)).toEqual(fixture.expected.diagramIds);
    source.diagrams[0].diagram.name = 'mutated response'; source.diagrams[0].adrs[0].title = 'mutated response';
    expect(diagrams.listAll()).toEqual(before); expect(adrs.snapshotGraph()).toEqual(decisions);
    expect(diagrams.getTrashProvenance(fixture.trashedChild.id)).toEqual(provenance);
  });
  it('uses one canonical parent-first graph transaction and no nested context transaction', async () => {
    const { diagrams, adrs, fixture } = sourceFixture(); const transaction = vi.spyOn(diagrams, 'withGraphTransaction');
    const child = fixture.children[0]; await new HtmlExportSourceService(diagrams, adrs).gather(child.id);
    expect(transaction).toHaveBeenCalledTimes(1); expect(transaction.mock.calls[0].slice(0,2)).toEqual([fixture.parent.id, [child.id]]);
  });
  it('rechecks a changed selected association inside the lock', async () => {
    const { diagrams, adrs, fixture } = sourceFixture(); let calls = 0;
    const repository = scopedRepository(diagrams, scoped => ({ get: async id => {
      const document = await scoped.get(id); if (id === fixture.children[0].id && ++calls > 1) document!.scope!.parentDiagramId = fixture.unrelatedParent.id; return document;
    } }));
    await expect(new HtmlExportSourceService(repository, adrs).gather(fixture.children[0].id)).rejects.toMatchObject({ statusCode: 409, field: 'scope.parentDiagramId' });
  });
  it.each(['status', 'kind', 'owner'])('rechecks selected %s after discovery and before gathering', async kind => {
    const { diagrams, adrs, fixture } = sourceFixture(); let reads = 0;
    const child = fixture.children[0];
    const repository = scopedRepository(diagrams, scoped => ({ get: async id => {
      const document = await scoped.get(id); if (document && id === child.id && ++reads > 1) {
        if (kind === 'status') document.status = 'trashed';
        if (kind === 'kind') document.kind = 'general';
        if (kind === 'owner') document.scope!.softwareSystemId = fixture.children[1].scope!.softwareSystemId;
      }
      return document;
    } }));
    await expect(new HtmlExportSourceService(repository, adrs).gather(child.id)).rejects.toMatchObject({ statusCode: kind === 'status' ? 404 : 409, field: kind === 'status' ? 'status' : kind === 'kind' ? 'kind' : 'scope.softwareSystemId' });
  });
  it('waits for a coordinated parent/ADR edit and returns the complete committed graph', async () => {
    const { diagrams, adrs, fixture } = sourceFixture(); let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }), blocked = new Promise<void>(resolve => { release = resolve; });
    const write = new GraphTransaction(diagrams, adrs).run(fixture.parent.id, [], async ({ diagrams: scoped, adrs: scopedAdrs }) => {
      const parent = await scoped.get(fixture.parent.id); parent!.components[0].name = 'Committed owner'; await scoped.replace(parent!);
      entered(); await blocked; const adr = fixture.adrsByDiagram[fixture.parent.id][0]; await scopedAdrs!.update(adr.id, { ...adr, title: 'Committed ADR' });
    });
    await started; const reading = new HtmlExportSourceService(diagrams, adrs).gather(fixture.parent.id); release(); await write;
    const source = await reading; expect(source.diagrams[0].diagram.components[0].name).toBe('Committed owner'); expect(source.diagrams[0].adrs.find(adr => adr.id === fixture.adrsByDiagram[fixture.parent.id][0].id)?.title).toBe('Committed ADR');
  });
});

const postgresEnabled = process.env.RUN_POSTGRES_TESTS === '1' && Boolean(process.env.DATABASE_URL);
describe.skipIf(!postgresEnabled)('PostgreSQL HTML source consistency and zero writes', () => {
  const namespace = `spec007_source_${randomUUID().replaceAll('-', '')}`;
  let admin: Pool, pool: Pool, diagrams: PostgresDiagramRepository, adrs: PostgresAdrRepository;
  let fixture: ReturnType<typeof htmlPackageFixture>;
  const queries: string[] = [];
  const lockedIds: string[] = [];
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${namespace}` });
    for (const migration of ['0001_initial.sql', '0002_adrs.sql', '0003_system_groups.sql', '0004_component_dimensions.sql', '0005_c4_container_diagrams.sql', '0006_container_component_types.sql']) await pool.query(await readFile(new URL(`../../drizzle/${migration}`, import.meta.url), 'utf8'));
    const db = drizzle(pool, { schema, logger: { logQuery(query, params) { queries.push(query); if (query.includes('for update')) lockedIds.push(String(params[0])); } } });
    diagrams = new PostgresDiagramRepository(db); adrs = new PostgresAdrRepository(db);
  }, 30_000);
  afterAll(async () => { await pool?.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await admin.end(); } });
  beforeEach(async () => {
    await pool.query('TRUNCATE diagrams CASCADE'); fixture = htmlPackageFixture();
    for (const document of [fixture.parent, ...fixture.children, fixture.trashedChild, fixture.unrelatedParent, fixture.unrelatedChild]) await diagrams.create(document);
    await diagrams.trash(fixture.trashedChild.id);
    const db = drizzle(pool, { schema });
    for (const record of Object.values(fixture.adrsByDiagram).flat()) {
      const { componentIds, relationshipIds, ...adr } = record;
      await db.insert(schema.adrs).values({ ...adr, createdAt: new Date(adr.createdAt), updatedAt: new Date(adr.updatedAt) });
      if (componentIds.length) await db.insert(schema.adrComponentLinks).values(componentIds.map(componentId => ({ adrId: adr.id, componentId, createdAt: new Date(adr.createdAt) })));
      if (relationshipIds.length) await db.insert(schema.adrRelationshipLinks).values(relationshipIds.map(relationshipId => ({ adrId: adr.id, relationshipId, createdAt: new Date(adr.createdAt) })));
    }
    queries.length = 0; lockedIds.length = 0;
  });
  async function rows() {
    const tables = ['diagrams','components','relationships','system_groups','system_group_members','adrs','adr_component_links','adr_relationship_links'];
    return Promise.all(tables.map(async table => (await pool.query(`SELECT row_to_json(t)::text AS row FROM ${table} t ORDER BY row_to_json(t)::text`)).rows));
  }
  it('locks parent before sorted children, reads full ADRs in bounded queries and changes no rows', async () => {
    const before = await rows();
    const source = await new HtmlExportSourceService(diagrams, adrs).gather(fixture.parent.id);
    expect(source.diagrams.map(member => member.diagram.id)).toEqual(fixture.expected.diagramIds);
    expect(source.diagrams.flatMap(member => member.adrs)).toHaveLength(8);
    expect(queries.filter(query => query.includes('for update'))).toHaveLength(4);
    expect(lockedIds).toEqual([fixture.parent.id, ...[...fixture.children.map(child => child.id), fixture.trashedChild.id].sort()]);
    expect(queries.filter(query => query.includes('from "adrs"'))).toHaveLength(3);
    expect(queries.filter(query => query.includes('from "adr_component_links"'))).toHaveLength(2);
    expect(queries.filter(query => query.includes('from "adr_relationship_links"'))).toHaveLength(2);
    expect(queries.some(query => /^(insert|update|delete) /i.test(query))).toBe(false);
    expect(await rows()).toEqual(before);
    source.diagrams[0].diagram.name = 'Response only'; expect((await diagrams.get(fixture.parent.id))!.name).toBe(fixture.parent.name);
  });
  it('preserves raw expected IDs when hydration cannot load an active row', async () => {
    const before = await rows();
    const repository = scopedRepository(diagrams, scoped => ({ get: async id => id === fixture.children[0].id ? undefined : scoped.get(id) }));
    expect((await repository.findChildMembership(fixture.parent.id)).map(row => row.id)).toContain(fixture.children[0].id);
    await expect(new HtmlExportSourceService(repository, adrs).gather(fixture.parent.id)).rejects.toMatchObject({ statusCode: 409, diagramId: fixture.children[0].id });
    expect(await rows()).toEqual(before);
  });
  it('returns a complete after graph when parent and ADR writes commit before its lock', async () => {
    const started = barrier(), release = barrier();
    const adr = fixture.adrsByDiagram[fixture.parent.id][0];
    const writing = new GraphTransaction(diagrams, adrs).run(fixture.parent.id, [], async ({ diagrams: scoped, adrs: scopedAdrs }) => {
      const parent = (await scoped.get(fixture.parent.id))!; parent.components[0].name = 'Committed owner'; await scoped.replace(parent);
      started.resolve(); await release.promise; await scopedAdrs!.update(adr.id, { ...adr, title: 'Committed decision' });
    });
    await started.promise;
    const reading = new HtmlExportSourceService(diagrams, adrs).gather(fixture.parent.id);
    release.resolve(); await writing; const source = await reading;
    expect(source.diagrams[0].diagram.components[0].name).toBe('Committed owner');
    expect(source.diagrams[0].adrs.find(record => record.id === adr.id)?.title).toBe('Committed decision');
    expect(source.diagrams.find(member => member.diagram.scope?.softwareSystemId === fixture.parent.components[0].id)?.diagram.scope?.softwareSystemName).toBe('Committed owner');
  });
  it.each(['save', 'create-child', 'trash', 'restore', 'ADR-content', 'ADR-links'])('returns the complete before graph while racing %s', async operation => {
    const baseline = await new HtmlExportSourceService(diagrams, adrs).gather(fixture.parent.id);
    const entered = barrier(), release = barrier(), attempted = barrier();
    const gated = new Proxy(diagrams, { get(target, key) {
      if (key === 'withGraphTransaction') return (parent: string, children: string[], action: Parameters<DiagramRepositoryLike['withGraphTransaction']>[2]) => target.withGraphTransaction(parent, children, async (scoped, executor) => { entered.resolve(); await release.promise; return action(scoped, executor); });
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    const reading = new HtmlExportSourceService(gated, adrs).gather(fixture.parent.id);
    await entered.promise;
    const writer = new Proxy(diagrams, { get(target, key) {
      if (key === 'withGraphTransaction') return (parent: string, children: string[], action: Parameters<DiagramRepositoryLike['withGraphTransaction']>[2]) => { attempted.resolve(); return target.withGraphTransaction(parent, children, action); };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    const diagramService = new DiagramService(writer, adrs), adrService = new AdrService(adrs, writer);
    const adr = fixture.adrsByDiagram[fixture.parent.id][0];
    const mutate = async () => {
      if (operation === 'save') { const parent = (await writer.get(fixture.parent.id))!; parent.components[0].name = 'After race'; return diagramService.save(parent.id, parent); }
      if (operation === 'create-child') { const owner = fixture.availability.find(item => item.availability === 'none')!; return new ContainerContextService(writer).createOrOpen(fixture.parent.id, owner.softwareSystemId); }
      if (operation === 'trash') return diagramService.trash(fixture.children[0].id, [fixture.children[0].id]);
      if (operation === 'restore') { const impact = await diagramService.restoreImpact(fixture.trashedChild.id); return diagramService.restore(fixture.trashedChild.id, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId }); }
      if (operation === 'ADR-links') return adrService.replaceLinks(adr.id, { componentIds: [] });
      return adrService.update(adr.id, { ...adr, title: 'After race' });
    };
    const writing = mutate(); const observed = writing.catch(error => { throw error; });
    try { await attempted.promise; } finally { release.resolve(); }
    const source = await reading; await observed;
    expect(source.diagrams).toEqual(baseline.diagrams); expect(source.availability).toEqual(baseline.availability);
    const after = await new HtmlExportSourceService(diagrams, adrs).gather(fixture.parent.id);
    expect({ diagrams: after.diagrams, availability: after.availability }).not.toEqual({ diagrams: baseline.diagrams, availability: baseline.availability });
  }, 15_000);
});

function barrier() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
