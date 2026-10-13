import { describe, expect, it } from 'vitest';
import { collectionDeletionFixture } from '../component-recovery-fixture';
import { scopedRepository } from '../html-export-source-fixtures';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';
import type { CollectionTarget } from '../../../shared/src/index';
import { componentTestDatabase, postgresEnabled } from './component-test-database';

function barrier() {
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  return { entered, release, hold: async () => { enter(); await gate; } };
}

async function waitForLock(database: Awaited<ReturnType<typeof componentTestDatabase>>, mode: string) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { rows } = await database.pool.query("SELECT pid FROM pg_locks WHERE relation='diagrams'::regclass AND NOT granted AND mode=$1", [mode]);
    if (rows.length) {
      // Ordinary writers must wait at the table barrier before taking graph row locks.
      const early = await database.pool.query("SELECT pid FROM pg_locks WHERE pid=ANY($1::int[]) AND relation='diagrams'::regclass AND granted AND mode='RowShareLock'", [rows.map(r => r.pid)]);
      expect(early.rows).toEqual([]);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error(`No queued ${mode} observed`);
}

const writers = ['create', 'child', 'owner rename', 'save', 'adr', 'links', 'trash', 'restore'] as const;
type Writer = typeof writers[number];

describe.skipIf(!postgresEnabled).each(['all-trash', 'all-permanent', 'clear-trash'] as const)('PostgreSQL %s collection races', action => {
  async function setup() {
    const database = await componentTestDatabase();
    try {
      const f = await collectionDeletionFixture(database.diagrams, database.adrs);
      const service = new DiagramService(f.repository, f.adrs);
      // An absent child lets the public child writer actually create rather than reopen.
      const absent = await service.previewDeletion({ selector: { id: f.first.datastoreChild }, mode: 'permanent' });
      await service.executeDeletion(absent.rootDiagramId, { mode: absent.mode, confirmationToken: absent.confirmationToken });
      const parentAdr = await new AdrService(f.adrs, f.repository).create(f.first.parent, { title: 'Parent ADR', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' });
      if (action === 'clear-trash') {
        await service.trash(f.first.child);
        await service.trash(f.second.child);
      }
      const target: CollectionTarget = action === 'clear-trash' ? { kind: 'clear-trash' } : { kind: 'all-matches', name: f.name, mode: action === 'all-trash' ? 'trash' : 'permanent' };
      const preview = await service.previewCollectionDeletion({ target });
      const confirmation = { target: preview.target, rootDiagramIds: preview.rootDiagramIds, confirmationToken: preview.confirmationToken };
      const saved = (await f.repository.get(action === 'clear-trash' ? f.first.parent : f.first.child))!;
      const parent = (await f.repository.get(f.first.parent))!;
      const adr = action === 'clear-trash' ? parentAdr : (await f.adrs.listFull(f.first.child)).find(a => a.status === 'accepted')!;
      const write = (writer: Writer, diagrams = f.repository) => {
        const s = new DiagramService(diagrams, f.adrs), decisions = new AdrService(f.adrs, diagrams);
        switch (writer) {
          case 'create': return s.create(f.name);
          case 'child': return s.createOrOpenComponentDiagram(f.first.parent, f.first.datastore);
          case 'owner rename': return s.save(parent.id, { ...parent, components: parent.components.map(c => c.id === f.first.application ? { ...c, name: 'Saved owner rename' } : c) });
          case 'save': return s.save(saved.id, { ...saved, components: saved.components.map((c, i) => i ? c : { ...c, description: 'Saved race edit' }) });
          case 'adr': return decisions.update(adr.id, { ...adr, title: 'Saved race ADR' });
          case 'links': return decisions.replaceLinks(adr.id, { componentIds: [] });
          case 'trash': return s.trash(action === 'clear-trash' ? f.second.context : f.first.child, action === 'clear-trash' ? (f.before.documents.filter(d => [f.second.context, f.second.parent].includes(d.id)).map(d => d.id)) : undefined);
          case 'restore': return s.restore(action === 'clear-trash' ? f.first.child : f.second.datastoreChild);
        }
      };
      return { ...f, database, service, preview, confirmation, write };
    } catch (error) { await database.close(); throw error; }
  }

  it.each(writers)('checks %s committed ahead of the collection barrier', async writer => {
    const f = await setup(), gate = barrier();
    let write: Promise<unknown> | undefined, deletion: Promise<unknown> | undefined;
    try {
      const held = new Proxy(f.repository, { get(target, key) {
        if (key === 'withGraphTransaction') return (id: string, children: string[], callback: Parameters<typeof target.withGraphTransaction>[2]) => target.withGraphTransaction(id, children, async (scoped, tx) => { const value = await callback(scoped, tx); await gate.hold(); return value; });
        if (key === 'create') return (document: Parameters<typeof target.create>[0]) => target.withGraphTransaction(f.first.context, [], async scoped => { const value = await scoped.create(document); await gate.hold(); return value; });
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      write = Promise.resolve(f.write(writer, held));
      await gate.entered;
      deletion = f.service.executeCollectionDeletion(f.confirmation);
      // New active roots/siblings are outside clear-Trash membership and saved state.
      const unchanged = action === 'clear-trash' && (writer === 'create' || writer === 'child');
      const outcome = unchanged ? expect(deletion).resolves.toMatchObject({ affectedCount: f.preview.affectedCount }) : expect(deletion).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
      await waitForLock(f.database, 'ShareRowExclusiveLock');
      gate.release(); await write;
      const afterWrite = unchanged ? undefined : await f.snapshot();
      await outcome;
      if (afterWrite) expect(await f.snapshot()).toEqual(afterWrite);
      else if (writer === 'create') expect((await f.repository.list()).some(d => d.name === f.name)).toBe(true);
      else expect((await f.repository.findChildMembership(f.first.parent)).some(d => d.ownerComponentId === f.first.datastore && d.status === 'active')).toBe(true);
    } finally { gate.release(); await Promise.allSettled([write, deletion].filter(Boolean)); await f.database.close(); }
  });

  it.each(writers)('coordinates %s queued behind execution before graph locks', async writer => {
    const f = await setup(), gate = barrier();
    let deletion: Promise<unknown> | undefined, queued: Promise<unknown> | undefined;
    try {
      let held = false;
      const repository = scopedRepository(f.repository, scoped => ({
        purge: async ids => { if (!held) { held = true; await gate.hold(); } return scoped.purge(ids); },
        trash: async (id, provenance) => { if (!held) { held = true; await gate.hold(); } return scoped.trash(id, provenance); },
      }));
      deletion = new DiagramService(repository, f.adrs).executeCollectionDeletion(f.confirmation);
      await gate.entered;
      // Attach rejection handling immediately while the real connection waits.
      queued = Promise.resolve(f.write(writer)).then(value => ({ value }), error => ({ error }));
      await waitForLock(f.database, 'RowExclusiveLock');
      gate.release(); await deletion;
      const outcome = await queued as { value?: unknown; error?: Error };
      const survives = writer === 'create' || action === 'clear-trash' && writer !== 'restore';
      if (survives) { expect(outcome.error).toBeUndefined(); expect(outcome.value).toBeDefined(); }
      else expect(outcome.error?.message).toMatch(/not found|missing|inactive|Restore|parent/i);
      for (const d of f.preview.affectedDiagrams) {
        if (action === 'all-trash') expect((await f.repository.get(d.id))!.status).toBe('trashed');
        else expect(await f.repository.get(d.id)).toBeUndefined();
      }
      if (writer === 'child' && survives) expect((outcome.value as { document: { id: string } }).document.id).not.toBe(f.first.datastoreChild);
      if (writer === 'create') expect((await f.repository.list()).some(d => d.name === f.name)).toBe(true);
    } finally { gate.release(); await Promise.allSettled([deletion, queued].filter(Boolean)); await f.database.close(); }
  });

  it('serializes opposite graph orders and releases preview locks before consent', async () => {
    const f = await setup(), gate = barrier();
    let first: Promise<unknown> | undefined, second: Promise<unknown> | undefined;
    try {
      const locks = await f.database.pool.query("SELECT mode FROM pg_locks WHERE relation='diagrams'::regclass AND granted AND mode='ShareRowExclusiveLock'");
      expect(locks.rows).toEqual([]);
      // A writer completes between preview and execution without a confirmation-time lock.
      await f.service.create('Unrelated while awaiting user consent');
      const repository = scopedRepository(f.repository, scoped => ({
        purge: async ids => { await gate.hold(); return scoped.purge(ids); },
        trash: async (id, provenance) => { if (id === f.preview.rootDiagramIds.find(root => f.preview.affectedDiagrams.find(d => d.id === root)?.kind === 'general')) await gate.hold(); return scoped.trash(id, provenance); },
      }));
      const visit = (repository: typeof f.repository, ids: string[]) => new Proxy(repository, { get(target, key) {
        if (key === 'withCollectionTransaction') return (callback: Parameters<typeof target.withCollectionTransaction>[0]) => target.withCollectionTransaction(async (scoped, tx) => {
          for (const id of ids) await scoped.withGraphTransaction(id, [], () => undefined);
          return callback(scoped, tx);
        });
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      first = new DiagramService(visit(repository, [f.first.context, f.second.context]), f.adrs).executeCollectionDeletion(f.confirmation);
      await gate.entered;
      second = new DiagramService(visit(f.repository, [f.second.context, f.first.context]), f.adrs).executeCollectionDeletion(f.confirmation);
      const rejected = expect(second).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
      await waitForLock(f.database, 'ShareRowExclusiveLock'); gate.release();
      await first; await rejected;
      expect((await f.repository.list()).some(d => d.name === 'Unrelated while awaiting user consent')).toBe(true);
    } finally { gate.release(); await Promise.allSettled([first, second].filter(Boolean)); await f.database.close(); }
  });
});
