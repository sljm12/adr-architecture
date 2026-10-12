import { describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { diagramDeletionFixture } from '../component-recovery-fixture';
import { scopedRepository } from '../html-export-source-fixtures';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';

function barrier() {
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  return { entered, release, hold: async () => { enter(); await gate; } };
}

// Observe a real second PostgreSQL connection waiting on a lock, not a timing guess.
async function waitForLock(database: Awaited<ReturnType<typeof componentTestDatabase>>) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { rows } = await database.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND pid IN (SELECT pid FROM pg_locks WHERE relation='diagrams'::regclass)");
    if (rows.length) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('The competing connection never reached the diagram lock');
}

describe.skipIf(!postgresEnabled).each(['trash', 'permanent'] as const)('PostgreSQL %s deletion races', mode => {
  it('reports a queued second confirmation as missing or changed', async () => {
    const database = await componentTestDatabase(), gate = barrier(); let first: Promise<unknown> | undefined, second: Promise<unknown> | undefined;
    try {
      const { ids } = await diagramDeletionFixture(database.diagrams, database.adrs); const service = new DiagramService(database.diagrams, database.adrs);
      const preview = await service.previewDeletion({ selector: { id: ids.context }, mode }), confirmation = { mode, confirmationToken: preview.confirmationToken };
      const repository = scopedRepository(database.diagrams, scoped => ({
        purge: async ids => { await gate.hold(); return scoped.purge(ids); },
        trash: async (id, provenance) => { if (id === ids.context) await gate.hold(); return scoped.trash(id, provenance); },
      }));
      first = new DiagramService(repository, database.adrs).executeDeletion(ids.context, confirmation); await gate.entered;
      second = service.executeDeletion(ids.context, confirmation);
      const rejection = expect(second).rejects.toMatchObject({ detail: { code: mode === 'permanent' ? 'DELETE_NOT_FOUND' : 'DELETE_IMPACT_CHANGED' } });
      try { await waitForLock(database); } finally { gate.release(); }
      await first; await rejection;
    } finally { gate.release(); await Promise.allSettled([first, second].filter(Boolean)); await database.close(); }
  });
  it.each(['save', 'create-child', 'adr', 'links', 'ancestor rename', 'trash', 'restore'])('invalidates consent for %s committed before the deletion lock', async writer => {
    const database = await componentTestDatabase(); const writeGate = barrier(); let pending: Promise<unknown> | undefined, savedWrite: Promise<unknown> | undefined;
    try {
      const { ids } = await diagramDeletionFixture(database.diagrams, database.adrs);
      const normal = new DiagramService(database.diagrams, database.adrs);
      if (writer === 'create-child') await normal.executeDeletion(ids.datastoreChild, { mode: 'permanent', confirmationToken: (await normal.previewDeletion({ selector: { id: ids.datastoreChild }, mode: 'permanent' })).confirmationToken });
      const impact = await normal.previewDeletion({ selector: { id: ids.context }, mode });
      const child = (await database.diagrams.get(ids.child))!, context = (await database.diagrams.get(ids.context))!, adr = (await database.adrs.listFull(ids.child)).find(a => a.status === 'accepted')!;
      // Hold the public writer after its validated mutation, before transaction commit.
      const writeRepository = new Proxy(database.diagrams, { get(target, key) {
        if (key === 'withGraphTransaction') return (root: string, children: string[], callback: Parameters<typeof target.withGraphTransaction>[2]) => target.withGraphTransaction(root, children, async (scoped, tx) => { const result = await callback(scoped, tx); await writeGate.hold(); return result; });
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      const realService = new DiagramService(writeRepository, database.adrs), realDecisions = new AdrService(database.adrs, writeRepository);
      savedWrite = (() => {
        switch (writer) {
          case 'save': child.components[0].description = 'Before deletion'; return realService.save(child.id, child);
          case 'create-child': return realService.createOrOpenComponentDiagram(ids.parent, ids.datastore);
          case 'adr': return realDecisions.update(adr.id, { title: 'Before deletion', context: adr.context, decision: adr.decision, consequences: adr.consequences, status: adr.status });
          case 'links': return realDecisions.replaceLinks(adr.id, { componentIds: [] });
          case 'ancestor rename': return realService.save(context.id, { ...context, name: 'Before deletion' });
          case 'trash': return realService.trash(child.id);
          case 'restore': return realService.restore(ids.datastoreChild);
        }
      })();
      await writeGate.entered;
      pending = normal.executeDeletion(ids.context, { mode, confirmationToken: impact.confirmationToken });
      const rejection = expect(pending).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
      try { await waitForLock(database); } finally { writeGate.release(); }
      await savedWrite; const afterWrite = await database.diagrams.listAll(); const savedAdrs = await database.adrs.listFull(ids.child);
      await rejection;
      expect(await database.diagrams.listAll()).toEqual(afterWrite); expect(await database.adrs.listFull(ids.child)).toEqual(savedAdrs);
    } finally { writeGate.release(); await Promise.allSettled([pending, savedWrite].filter(Boolean)); await database.close(); }
  });

  it.each(['save', 'create-child', 'adr', 'links', 'ancestor rename', 'trash', 'restore'])('rejects %s queued behind committed deletion without resurrection', async writer => {
    const database = await componentTestDatabase(); const gate = barrier(); let deletion: Promise<unknown> | undefined, queued: Promise<unknown> | undefined;
    try {
      const { ids } = await diagramDeletionFixture(database.diagrams, database.adrs); const service = new DiagramService(database.diagrams, database.adrs), decisions = new AdrService(database.adrs, database.diagrams);
      if (writer === 'create-child') await service.executeDeletion(ids.datastoreChild, { mode: 'permanent', confirmationToken: (await service.previewDeletion({ selector: { id: ids.datastoreChild }, mode: 'permanent' })).confirmationToken });
      const child = (await database.diagrams.get(ids.child))!, context = (await database.diagrams.get(ids.context))!, adr = (await database.adrs.listFull(ids.child)).find(a => a.status === 'accepted')!;
      const preview = await service.previewDeletion({ selector: { id: ids.context }, mode });
      const originalDescription = child.components[0].description;
      const repository = scopedRepository(database.diagrams, scoped => ({
        purge: async ids => { await gate.hold(); return scoped.purge(ids); },
        trash: async (id, provenance) => { if (id === preview.rootDiagramId) await gate.hold(); return scoped.trash(id, provenance); },
      }));
      deletion = new DiagramService(repository, database.adrs).executeDeletion(ids.context, { mode, confirmationToken: preview.confirmationToken });
      await gate.entered;
      queued = (() => {
        switch (writer) {
          case 'save': child.components[0].description = 'Must not commit'; return service.save(child.id, child);
          case 'create-child': return service.createOrOpenComponentDiagram(ids.parent, ids.datastore);
          case 'adr': return decisions.update(adr.id, { title: 'Must not commit', context: adr.context, decision: adr.decision, consequences: adr.consequences, status: adr.status });
          case 'links': return decisions.replaceLinks(adr.id, { componentIds: [] });
          case 'ancestor rename': return service.save(context.id, { ...context, name: 'Must not commit' });
          case 'trash': return service.trash(child.id);
          case 'restore': return service.restore(ids.datastoreChild);
        }
      })();
      const rejection = expect(queued).rejects.toThrow(/not found|missing|inactive|Restore|parent/i);
      try { await waitForLock(database); } finally { gate.release(); }
      await deletion; await rejection;
      if (mode === 'permanent') {
        expect(await database.diagrams.get(ids.context)).toBeUndefined(); expect(await database.diagrams.get(ids.child)).toBeUndefined(); expect(await database.adrs.listFull(ids.child)).toEqual([]);
      } else {
        expect((await database.diagrams.get(ids.context))!.name).toBe(context.name); expect((await database.diagrams.get(ids.child))!.components[0].description).toBe(originalDescription);
        expect((await database.adrs.get(adr.id))!.title).toBe(adr.title); expect((await database.adrs.get(adr.id))!.componentIds.sort()).toEqual(adr.componentIds.sort());
      }
      const rows = await database.pool.query('SELECT id,status FROM diagrams WHERE id<>$1', [ids.unrelated]);
      expect(mode === 'permanent' ? rows.rows : rows.rows.filter(d => d.status !== 'trashed')).toEqual([]);
      expect((await database.diagrams.findChildren(ids.parent)).filter(d => d.id !== ids.child && d.id !== ids.datastoreChild)).toEqual([]);
    } finally { gate.release(); await Promise.allSettled([deletion, queued].filter(Boolean)); await database.close(); }
  });
});
