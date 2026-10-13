import { describe, expect, it } from 'vitest';
import { collectionDeletionFixture } from '../component-recovery-fixture';
import { scopedRepository } from '../html-export-source-fixtures';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { DiagramService } from '../../src/services/diagram-service';
import { componentTestDatabase, postgresEnabled } from './component-test-database';

const target = { kind: 'clear-trash' } as const;
for (const postgres of [false, true]) describe.skipIf(postgres && !postgresEnabled)(`${postgres ? 'PostgreSQL' : 'memory'} clear-Trash persistence`, () => {
  async function setup() {
    const database = postgres ? await componentTestDatabase() : undefined;
    return { ...await collectionDeletionFixture(database?.diagrams ?? new DiagramRepository(), database?.adrs ?? new AdrRepository()), database };
  }
  async function rawSnapshot(database: Awaited<ReturnType<typeof componentTestDatabase>> | undefined) {
    if (!database) return undefined;
    return Promise.all(['diagrams', 'components', 'relationships', 'system_groups', 'system_group_members', 'adrs', 'adr_component_links', 'adr_relationship_links'].map(async table => (await database.pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows));
  }
  async function trashParents(f: Awaited<ReturnType<typeof setup>>) {
    const service = new DiagramService(f.repository, f.adrs);
    for (const graph of [f.first, f.second]) {
      const impact = await service.previewDeletion({ selector: { id: graph.parent }, mode: 'trash' });
      await service.executeDeletion(graph.parent, { mode: 'trash', confirmationToken: impact.confirmationToken });
    }
  }
  it('removes nested and independent batches, all owned rows and internal references while preserving active ancestors', async () => {
    const f = await setup();
    try {
      await f.crossRootReferences(); await trashParents(f);
      const before = await f.snapshot();
      const service = new DiagramService(f.repository, f.adrs);
      const preview = await service.previewCollectionDeletion({ target });
      expect(preview.rootDiagramIds).toEqual([]); expect(preview.affectedCount).toBe(6);
      expect(new Set(preview.affectedDiagrams.map(d => d.id)).size).toBe(6);
      await service.executeCollectionDeletion({ target, rootDiagramIds: [], confirmationToken: preview.confirmationToken });
      expect(await f.repository.listTrash()).toEqual([]);
      const remaining = await f.snapshot();
      const activeIds = new Set(before.documents.filter(d => d.status === 'active').map(d => d.id));
      expect(remaining.documents).toEqual(before.documents.filter(d => activeIds.has(d.id)));
      expect(remaining.saved).toEqual(before.saved.filter(d => activeIds.has(d.id)));
      for (const removed of preview.affectedDiagrams) {
        expect(await f.repository.get(removed.id)).toBeUndefined();
        expect(await f.repository.getDeletionRevision(removed.id)).toBeUndefined();
        expect(await f.repository.getTrashProvenance(removed.id)).toEqual({ trashBatchId: null, trashRootDiagramId: null });
        expect(await f.adrs.listFull(removed.id)).toEqual([]);
      }
      if (f.adrs instanceof AdrRepository) {
        const indexes = f.adrs.snapshotGraph();
        for (const removed of preview.affectedDiagrams) expect(indexes.diagrams.has(removed.id)).toBe(false);
        expect(indexes.components.size).toBe(remaining.documents.reduce((sum, d) => sum + d.components.length, 0));
        expect(indexes.records.size).toBe(0);
      }
      if (f.database) {
        expect((await f.database.pool.query('SELECT id FROM diagrams ORDER BY id')).rows.map(d => d.id)).toEqual(remaining.documents.map(d => d.id));
        for (const table of ['components', 'relationships', 'system_groups', 'adrs']) expect((await f.database.pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE diagram_id=ANY($1::uuid[])`, [preview.affectedDiagrams.map(d => d.id)])).rows[0].count, table).toBe(0);
        for (const table of ['adr_component_links', 'adr_relationship_links']) expect((await f.database.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, table).toBe(0);
        expect((await f.database.pool.query('SELECT count(*)::int AS count FROM system_group_members')).rows[0].count).toBe(remaining.documents.reduce((sum, d) => sum + (d.groups ?? []).reduce((n, g) => n + g.memberComponentIds.length, 0), 0));
      }
      await expect(service.restore(f.first.parent)).rejects.toThrow();
    } finally { await f.database?.close(); }
  });
  it.each(['active-descendant', 'outside-replacement'] as const)('rejects %s dependencies and leaves the entire collection unchanged', async blocker => {
    const f = await setup();
    try {
      if (blocker === 'active-descendant') await f.activeDescendantBlocker();
      else { await f.crossRootReferences(true); await trashParents(f); }
      const before = await f.snapshot();
      await expect(new DiagramService(f.repository, f.adrs).previewCollectionDeletion({ target })).rejects.toMatchObject({ detail: { code: 'DIAGRAM_DEPENDENCY' } });
      expect(await f.snapshot()).toEqual(before);
    } finally { await f.database?.close(); }
  });
  it('returns zero for empty Trash without changing active contents, provenance or revisions', async () => {
    const f = await setup();
    try {
      const service = new DiagramService(f.repository, f.adrs);
      for (const graph of [f.first, f.second]) {
        const impact = await service.restoreImpact(graph.datastoreChild);
        await service.restore(graph.datastoreChild, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId });
      }
      const before = await f.snapshot();
      const rawBefore = await rawSnapshot(f.database);
      const preview = await service.previewCollectionDeletion({ target });
      expect(preview.affectedCount).toBe(0); expect(preview.affectedDiagrams).toEqual([]);
      expect(await service.executeCollectionDeletion({ target, rootDiagramIds: [], confirmationToken: preview.confirmationToken })).toMatchObject({ affectedCount: 0, affectedDiagrams: [] });
      expect(await f.snapshot()).toEqual(before);
      expect(await rawSnapshot(f.database)).toEqual(rawBefore);
    } finally { await f.database?.close(); }
  });
  it.each(['partial', 'final-root'] as const)('rolls back every saved artifact, index and revision after %s purge', async failure => {
    const f = await setup();
    try {
      await trashParents(f); const before = await f.snapshot();
      const rawBefore = await rawSnapshot(f.database);
      const failing = scopedRepository(f.repository, scoped => ({ purge: async ids => {
        await scoped.purge(failure === 'final-root' ? ids : [ids[0]]);
        expect(await scoped.get(ids[0])).toBeUndefined();
        if (failure === 'final-root') for (const id of ids) expect(await scoped.get(id)).toBeUndefined();
        throw Error('Injected clear-Trash failure');
      } }));
      const service = new DiagramService(failing, f.adrs);
      const preview = await service.previewCollectionDeletion({ target });
      await expect(service.executeCollectionDeletion({ target, rootDiagramIds: [], confirmationToken: preview.confirmationToken })).rejects.toThrow('Injected clear-Trash failure');
      expect(await f.snapshot()).toEqual(before);
      expect(await rawSnapshot(f.database)).toEqual(rawBefore);
    } finally { await f.database?.close(); }
  });
});
