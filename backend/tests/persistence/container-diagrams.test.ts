import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { DiagramDocument } from '../../../shared/src/index';
import { containerFixtureIds as ids, generalParentFixture, groupedOwnerParentFixture } from '../../../shared/tests/container-fixtures';
import { ContainerContextService } from '../../src/services/container-context';
import { DiagramService } from '../../src/services/diagram-service';
import { ApiValidationError } from '../../src/api/errors';
import { PostgresAdrRepository } from '../../src/persistence/adr-repository';
import { PostgresDiagramRepository, type DiagramRepositoryLike } from '../../src/persistence/diagram-repository';
import * as schema from '../../src/persistence/schema';

const enabled = process.env.RUN_POSTGRES_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const schemaName = `spec009_graph_${randomUUID().replaceAll('-', '')}`;
const rollbackOwnerId = '99000000-0000-4000-8000-000000000009';
const failedOwnerId = '99000000-0000-4000-8000-000000000010';
const changeOwnerId = '99000000-0000-4000-8000-000000000011';
let admin: Pool | undefined;
let pool: Pool | undefined;
let repository: PostgresDiagramRepository;
let parent: DiagramDocument;

describe.skipIf(!enabled)('C4 container graph PostgreSQL concurrency', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schemaName}`);
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schemaName}` });
    for (const name of ['0001_initial.sql', '0002_adrs.sql', '0003_system_groups.sql', '0004_component_dimensions.sql', '0005_c4_container_diagrams.sql', '0006_container_component_types.sql']) {
      const sql = await readFile(fileURLToPath(new URL(`../../drizzle/${name}`, import.meta.url)), 'utf8');
      await pool.query(sql);
    }
    const db = drizzle(pool, { schema });
    repository = new PostgresDiagramRepository(db);
    parent = groupedOwnerParentFixture() as DiagramDocument;
    parent.components.push({ ...parent.components[0], id:rollbackOwnerId, name:'Rollback owner', description:null, position:{x:900,y:100} });
    parent.components.push({ ...parent.components[0], id:failedOwnerId, name:'Failed owner', description:null, position:{x:1100,y:100} });
    parent.components.push({ ...parent.components[0], id:changeOwnerId, name:'Change race owner', description:null, position:{x:1300,y:100} });
    await repository.create(parent);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await admin.end();
    }
  });

  it('serializes repeated and concurrent create-or-open requests into one complete canonical child', async () => {
    const context = new ContainerContextService(repository);
    const results = await Promise.all([
      context.createOrOpen(parent.id, ids.owner),
      context.createOrOpen(parent.id, ids.owner),
      context.createOrOpen(parent.id, ids.owner),
    ]);
    expect(new Set(results.map(result => result.document.id)).size).toBe(1);
    expect(results.filter(result => result.created)).toHaveLength(1);
    const children = await repository.findChildren(parent.id);
    expect(children.filter(child => child.scope?.softwareSystemId === ids.owner)).toHaveLength(1);
    expect(children.find(child => child.scope?.softwareSystemId === ids.owner)).toMatchObject({ kind:'container', status:'active', scope:{ parentDiagramId:parent.id, softwareSystemId:ids.owner }, components:[], relationships:[], groups:[], boundary:{ position:{x:0,y:0}, size:{width:480,height:320} } });

    const duplicateName = await context.createOrOpen(parent.id, ids.duplicateOwner);
    expect(duplicateName.document.id).not.toBe(results[0].document.id);
    expect((await repository.findChildren(parent.id)).filter(child => child.name === 'Payments')).toHaveLength(2);
    await repository.trash(results[0].document.id);
    await expect(context.createOrOpen(parent.id, ids.owner)).rejects.toMatchObject({ code:'RESTORE_REQUIRED', diagram:{ id:results[0].document.id, status:'trashed' } });
    const reserved = (await repository.findChildren(parent.id)).filter(child => child.scope?.softwareSystemId === ids.owner);
    expect(reserved).toHaveLength(1);
    expect(reserved[0]).toMatchObject({ id:results[0].document.id, kind:'container', status:'trashed', components:[], relationships:[], groups:[] });
  }, 30_000);

  it('rolls back a losing unique-owner insert and resolves the committed winner', async () => {
    const winner = await new ContainerContextService(repository).createOrOpen(parent.id, rollbackOwnerId);
    expect(winner.created).toBe(true);

    // Model a request whose availability read raced with the committed winner:
    // the transaction sees a stale empty lookup, while PostgreSQL enforces the
    // real all-status owner index on the attempted insert.
    let staleLookup = true;
    const racedRepository = instrumentGraphRepository(repository, transactionRepository => proxyRepository(transactionRepository, {
      findContainerForOwner: async ownerId => {
        if (ownerId === rollbackOwnerId && staleLookup) {
          staleLookup = false;
          return undefined;
        }
        return transactionRepository.findContainerForOwner(ownerId);
      },
    }));
    const resolved = await new ContainerContextService(racedRepository).createOrOpen(parent.id, rollbackOwnerId);
    expect(staleLookup).toBe(false);
    expect(resolved).toMatchObject({ created:false, document:{ id:winner.document.id, kind:'container', status:'active', scope:{ parentDiagramId:parent.id, softwareSystemId:rollbackOwnerId }, components:[], relationships:[], groups:[], boundary:{ position:{x:0,y:0}, size:{width:480,height:320} } } });
    const children = (await repository.findChildren(parent.id)).filter(child => child.scope?.softwareSystemId === rollbackOwnerId);
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(winner.document.id);
  }, 30_000);

  it('serializes creation against an owner-role change and rolls back a failed child insert', async () => {
    const context = new ContainerContextService(repository);
    const adrs = new PostgresAdrRepository(drizzle(pool!, { schema }));
    const service = new DiagramService(repository, adrs);
    const current = await repository.get(parent.id);
    const changed = { ...current!, components:current!.components.map(component => component.id === changeOwnerId ? { ...component, type:'person' } : component) };
    const [created, saved] = await Promise.allSettled([
      context.createOrOpen(parent.id, changeOwnerId),
      service.save(parent.id, changed),
    ]);
    const ownerChildren = (await repository.findChildren(parent.id)).filter(item => item.scope?.softwareSystemId === changeOwnerId);
    expect(ownerChildren.length).toBeLessThanOrEqual(1);
    const child = ownerChildren[0];
    if (child) {
      expect(created.status).toBe('fulfilled');
      expect(created.status === 'fulfilled' && created.value.document.id).toBe(child.id);
      expect(child).toMatchObject({ kind:'container', status:'active', scope:{ parentDiagramId:parent.id, softwareSystemId:changeOwnerId }, components:[], relationships:[], groups:[], boundary:{ position:{x:0,y:0}, size:{width:480,height:320} } });
      expect(saved.status).toBe('rejected');
      expect(saved.status === 'rejected' && saved.reason).toMatchObject({ code:'DIAGRAM_DEPENDENCY' });
    } else {
      expect(ownerChildren).toHaveLength(0);
      expect(saved.status).toBe('fulfilled');
      expect(created.status).toBe('rejected');
      expect(created.status === 'rejected' && created.reason).toBeInstanceOf(ApiValidationError);
    }

    const failingRepository = instrumentGraphRepository(repository, transactionRepository => proxyRepository(transactionRepository, {
      create: async document => {
        const inserted = await transactionRepository.create(document);
        if (document.kind === 'container' && document.scope?.softwareSystemId === failedOwnerId) throw new Error('force child creation rollback');
        return inserted;
      },
    }));
    await expect(new ContainerContextService(failingRepository).createOrOpen(parent.id, failedOwnerId)).rejects.toThrow('force child creation rollback');
    expect(await repository.findContainerForOwner(failedOwnerId)).toBeUndefined();
  }, 30_000);

  it('rejects creation when parent trash wins after the initial owner read', async () => {
    const trashParentId = randomUUID();
    const trashOwnerId = randomUUID();
    const source = generalParentFixture().components[0];
    const trashParent: DiagramDocument = {
      id:trashParentId, name:'Trash race parent', status:'active', kind:'general', scope:null, boundary:null,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), trashedAt:null,
      components:[{ ...source, id:trashOwnerId, diagramId:trashParentId, name:'Trash race owner' }],
      relationships:[], groups:[],
    };
    await repository.create(trashParent);

    const transactionStarted = deferred<void>();
    const continueTransaction = deferred<void>();
    const gatedRepository = instrumentGraphRepository(repository, undefined, async () => {
      transactionStarted.resolve();
      await continueTransaction.promise;
    });
    const creating = new ContainerContextService(gatedRepository).createOrOpen(trashParentId, trashOwnerId);
    await transactionStarted.promise;
    try {
      expect((await repository.trash(trashParentId))?.status).toBe('trashed');
    } finally {
      continueTransaction.resolve();
    }
    await expect(creating).rejects.toMatchObject({ code:'PARENT_INACTIVE' });
    expect(await repository.findContainerForOwner(trashOwnerId)).toBeUndefined();
    expect((await repository.findChildren(trashParentId)).filter(child => child.scope?.softwareSystemId === trashOwnerId)).toHaveLength(0);
  }, 30_000);
});

function deferred<T>(): { promise:Promise<T>; resolve:(value:T) => void } {
  let resolve!: (value:T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function proxyRepository(base: DiagramRepositoryLike, overrides: Partial<DiagramRepositoryLike>): DiagramRepositoryLike {
  return new Proxy(base, {
    get(target, property) {
      if (property in overrides) return overrides[property as keyof DiagramRepositoryLike];
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function instrumentGraphRepository(
  base: DiagramRepositoryLike,
  wrapTransactionRepository?: (transactionRepository:DiagramRepositoryLike) => DiagramRepositoryLike,
  beforeTransaction?: () => Promise<void>,
): DiagramRepositoryLike {
  return new Proxy(base, {
    get(target, property) {
      if (property === 'withGraphTransaction') {
        return async (parentDiagramId:string, childDiagramIds:string[], action:(transactionRepository:DiagramRepositoryLike, transaction?:unknown) => unknown) => {
          await beforeTransaction?.();
          return (target.withGraphTransaction as any).call(target, parentDiagramId, childDiagramIds, (transactionRepository:DiagramRepositoryLike, transaction:unknown) =>
            action(wrapTransactionRepository?.(transactionRepository) ?? transactionRepository, transaction));
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
