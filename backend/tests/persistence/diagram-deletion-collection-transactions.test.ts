import { describe, expect, it } from 'vitest';
import { collectionDeletionFixture } from '../component-recovery-fixture';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import type { CollectionTarget, CollectionImpact } from '../../../shared/src/index';
import type { CollectionTransactionContext } from '../../src/persistence/graph-transaction';

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function waitForLock(database: Awaited<ReturnType<typeof componentTestDatabase>>, mode: string) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { rows } = await database.pool.query("SELECT pid FROM pg_locks WHERE relation='diagrams'::regclass AND NOT granted AND mode=$1", [mode]);
    if (rows.length) {
      const earlyRows = await database.pool.query("SELECT pid FROM pg_locks WHERE pid=ANY($1::int[]) AND relation='diagrams'::regclass AND granted AND mode='RowShareLock'", [rows.map(r => r.pid)]);
      expect(earlyRows.rows).toEqual([]);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error(`No queued ${mode} table lock observed`);
}

for (const storage of ['memory', 'postgres'] as const) describe.skipIf(storage === 'postgres' && !postgresEnabled)(`${storage} collection transactions`, () => {
  async function setup() {
    const database = storage === 'postgres' ? await componentTestDatabase() : undefined;
    const fixture = await collectionDeletionFixture(database?.diagrams ?? new DiagramRepository(), database?.adrs ?? new AdrRepository());
    return { ...fixture, database, graph: new GraphTransaction(fixture.repository, fixture.adrs), close: () => database?.close() };
  }
  it('shares one scoped pair, reenters in opposite graph order and supports empty collections', async () => {
    const f = await setup();
    try {
      await f.graph.runCollection(async context => {
        await context.diagrams.withCollectionTransaction(scoped => expect(scoped).toBe(context.diagrams));
        const a = await context.adrs!.create(f.first.context, { title: 'Collection', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' });
        for (const id of [f.second.context, f.first.context]) await context.diagrams.withGraphTransaction(id, [], async (scoped, transaction) => {
          expect(scoped).toBe(context.diagrams);
          if (f.database) {
            const locks = await f.database.pool.query("SELECT mode FROM pg_locks WHERE relation='diagrams'::regclass AND granted");
            expect(locks.rows.map(r => r.mode)).toContain('ShareRowExclusiveLock');
            expect(transaction).toBeDefined();
          }
          expect(await context.adrs!.get(a.id)).toBeDefined();
        });
      });
      const empty = new DiagramRepository();
      expect(await new GraphTransaction(empty, new AdrRepository()).runCollection(({ diagrams }) => diagrams.listAll())).toEqual([]);
      await f.graph.run(f.first.context, [], async ({ diagrams }) => {
        await expect(diagrams.withCollectionTransaction(() => undefined)).rejects.toThrow('Collection coordination must start before graph locks');
      });
    } finally { await f.close(); }
  });
  it('restores all documents, ADRs, indexes, provenance and revisions after every root disappears', async () => {
    const f = await setup();
    try {
      await expect(f.graph.runCollection(async ({ diagrams, adrs }) => {
        const added = await diagrams.create({ ...(await diagrams.get(f.first.unrelated))!, id: crypto.randomUUID(), name: 'Created inside failed collection' });
        if (adrs instanceof AdrRepository) adrs.registerDiagram(added.id);
        await adrs!.create(added.id, { title: 'Rolled back', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' });
        const documents = await diagrams.listAll();
        const ids = documents.sort((a, b) => (b.kind === 'component' ? 2 : b.kind === 'container' ? 1 : 0) - (a.kind === 'component' ? 2 : a.kind === 'container' ? 1 : 0)).map(d => d.id);
        await adrs!.purgeOwned(ids); await diagrams.purge(ids);
        expect(await diagrams.listAll()).toEqual([]);
        throw Error('After final root');
      })).rejects.toThrow('After final root');
      expect(await f.snapshot()).toEqual(f.before);
    } finally { await f.close(); }
  });
  it('serializes opposite collection root orders without deadlock or per-root transactions', async () => {
    const f = await setup(), entered = barrier(), release = barrier();
    let first: Promise<unknown> | undefined, second: Promise<unknown> | undefined;
    try {
      const visit = async (context: CollectionTransactionContext, ids: string[]) => {
        for (const id of ids) await context.diagrams.withGraphTransaction(id, [], scoped => expect(scoped).toBe(context.diagrams));
        return ids;
      };
      first = f.graph.runCollection(async context => { entered.release(); await release.promise; return visit(context, [f.first.context, f.second.context]); });
      await entered.promise;
      let started = false;
      second = f.graph.runCollection(context => { started = true; return visit(context, [f.second.context, f.first.context]); });
      if (f.database) await waitForLock(f.database, 'ShareRowExclusiveLock');
      else { await Promise.resolve(); await Promise.resolve(); }
      expect(started).toBe(false); release.release();
      expect(await first).toEqual([f.first.context, f.second.context]);
      expect(await second).toEqual([f.second.context, f.first.context]);
    } finally { release.release(); await Promise.allSettled([first, second].filter(Boolean)); await f.close(); }
  });
  it.each(['create', 'save', 'child', 'adr'] as const)('queues ordinary %s before row locks and preserves it after rollback', async writer => {
    const f = await setup(), entered = barrier(), release = barrier();
    let collection: Promise<unknown> | undefined, queued: Promise<unknown> | undefined;
    try {
      collection = f.graph.runCollection(async ({ diagrams, adrs }) => {
        await adrs!.purgeOwned([f.first.child]); await diagrams.purge([f.first.child]);
        entered.release(); await release.promise; throw Error('Rollback');
      });
      const rejected = expect(collection).rejects.toThrow('Rollback');
      await entered.promise;
      const service = new DiagramService(f.repository, f.adrs);
      const original = (await f.repository.get(f.second.context))!;
      const adr = (await f.adrs.listFull(f.second.child)).find(a => a.status === 'accepted')!;
      let finished = false;
      queued = Promise.resolve(writer === 'create' ? service.create('Queued unrelated') : writer === 'save' ? service.save(original.id, { ...original, name: 'Queued saved' }) : writer === 'child' ? service.createOrOpenComponentDiagram(f.second.parent, f.second.application) : new AdrService(f.adrs, f.repository).update(adr.id, { ...adr, title: 'Queued ADR' })).then(value => { finished = true; return value; });
      if (f.database) await waitForLock(f.database, 'RowExclusiveLock');
      else { await Promise.resolve(); await Promise.resolve(); }
      expect(finished).toBe(false);
      release.release(); await rejected;
      const value = await queued;
      expect(value).toBeDefined();
      expect(await f.repository.get(f.first.child)).toBeDefined();
      if (writer === 'create') expect((await f.repository.list()).some(d => d.name === 'Queued unrelated')).toBe(true);
      if (writer === 'save') expect((await f.repository.get(original.id))!.name).toBe('Queued saved');
      if (writer === 'adr') expect((await f.adrs.get(adr.id))!.title).toBe('Queued ADR');
    } finally { release.release(); await Promise.allSettled([collection, queued].filter(Boolean)); await f.close(); }
  });
  it('waits for an ordinary writer table lock before collection discovery', async () => {
    const f = await setup(), entered = barrier(), release = barrier();
    let writer: Promise<unknown> | undefined, collection: Promise<unknown> | undefined;
    try {
      writer = f.graph.run(f.first.context, [], async ({ diagrams }) => {
        if (f.database) {
          const locks = await f.database.pool.query("SELECT mode FROM pg_locks WHERE relation='diagrams'::regclass AND granted");
          expect(locks.rows.map(r => r.mode)).toContain('RowExclusiveLock');
        }
        entered.release(); await release.promise;
        await diagrams.replace({ ...(await diagrams.get(f.first.context))!, name: 'Committed before discovery' });
      });
      await entered.promise;
      let discovered = false;
      collection = f.graph.runCollection(async ({ diagrams }) => { discovered = true; return (await diagrams.get(f.first.context))!.name; });
      if (f.database) await waitForLock(f.database, 'ShareRowExclusiveLock');
      else { await Promise.resolve(); await Promise.resolve(); }
      expect(discovered).toBe(false); release.release(); await writer;
      expect(await collection).toBe('Committed before discovery');
    } finally { release.release(); await Promise.allSettled([writer, collection].filter(Boolean)); await f.close(); }
  });
  it('gathers a unique depth-ordered union and checks references across the complete set', async () => {
    const f = await setup();
    try {
      const service = new DiagramService(f.repository, f.adrs) as unknown as { collectionSnapshot(target: CollectionTarget, context: CollectionTransactionContext): Promise<CollectionImpact> };
      const target: CollectionTarget = { kind: 'all-matches', name: f.name, mode: 'permanent' };
      const snapshot = () => f.graph.runCollection(context => service.collectionSnapshot(target, context));
      const before = await snapshot();
      expect(before.rootDiagramIds).toEqual([f.first.context, f.first.parent, f.first.child, f.second.context, f.second.parent, f.second.child].sort());
      expect(before.affectedCount).toBe(8);
      expect(new Set(before.affectedDiagrams.map(d => d.id)).size).toBe(8);
      expect(before.affectedDiagrams.some(d => f.nearNames.includes(d.id))).toBe(false);
      await f.crossRootReferences();
      const internal = await snapshot();
      expect(internal.confirmationToken).not.toBe(before.confirmationToken);
      await f.crossRootReferences(true);
      await expect(snapshot()).rejects.toMatchObject({ detail: { code: 'DIAGRAM_DEPENDENCY' } });
    } finally { await f.close(); }
  });
  it('hashes target, membership, revisions, ADR-only writes and required ancestors without unrelated graphs', async () => {
    const f = await setup();
    try {
      const service = new DiagramService(f.repository, f.adrs) as unknown as { collectionSnapshot(target: CollectionTarget, context: CollectionTransactionContext): Promise<CollectionImpact> };
      const target: CollectionTarget = { kind: 'all-matches', name: f.name, mode: 'trash' };
      const snapshot = (selection = target) => f.graph.runCollection(context => service.collectionSnapshot(selection, context));
      const original = await snapshot();
      await new DiagramService(f.repository, f.adrs).create('Unrelated new graph');
      expect((await snapshot()).confirmationToken).toBe(original.confirmationToken);
      const adr = (await f.adrs.listFull(f.first.child)).find(a => a.status === 'accepted')!;
      await new AdrService(f.adrs, f.repository).update(adr.id, { ...adr, title: adr.title + ' edited' });
      const adrEdit = await snapshot(); expect(adrEdit.confirmationToken).not.toBe(original.confirmationToken);
      await new AdrService(f.adrs, f.repository).update(adr.id, adr);
      expect((await snapshot()).confirmationToken).not.toBe(original.confirmationToken);
      await new DiagramService(f.repository, f.adrs).create(f.name);
      expect((await snapshot()).rootDiagramIds).toHaveLength(original.rootDiagramIds.length + 1);
      expect((await snapshot({ kind: 'all-matches', name: f.name, mode: 'permanent' })).confirmationToken).not.toBe(adrEdit.confirmationToken);
      const clear = await snapshot({ kind: 'clear-trash' });
      expect(clear.affectedCount).toBe(2); expect(clear.rootDiagramIds).toEqual([]);
      const ancestor = (await f.repository.get(f.first.context))!;
      await new DiagramService(f.repository, f.adrs).save(ancestor.id, { ...ancestor, components: ancestor.components.map(c => c.id === f.first.system ? { ...c, description: 'Ancestor edited' } : c) });
      expect((await snapshot({ kind: 'clear-trash' })).confirmationToken).not.toBe(clear.confirmationToken);
    } finally { await f.close(); }
  });
  it('blocks clear-Trash active descendants and accepts an empty saved collection', async () => {
    const f = await setup();
    try {
      const service = new DiagramService(f.repository, f.adrs) as unknown as { collectionSnapshot(target: CollectionTarget, context: CollectionTransactionContext): Promise<CollectionImpact> };
      await f.activeDescendantBlocker();
      await expect(f.graph.runCollection(context => service.collectionSnapshot({ kind: 'clear-trash' }, context))).rejects.toMatchObject({ detail: { code: 'DIAGRAM_DEPENDENCY' } });
      const diagrams = new DiagramRepository(); const empty = new DiagramService(diagrams) as unknown as typeof service;
      const impact = await new GraphTransaction(diagrams).runCollection(context => empty.collectionSnapshot({ kind: 'clear-trash' }, context));
      expect(impact.affectedCount).toBe(0); expect(impact.rootDiagramIds).toEqual([]);
      expect(impact.confirmationToken).toMatch(/^[0-9a-f]{64}$/);
    } finally { await f.close(); }
  });
});
