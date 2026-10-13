import { describe, expect, it } from 'vitest';
import { collectionDeletionFixture } from '../component-recovery-fixture';
import { scopedRepository } from '../html-export-source-fixtures';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { DiagramService } from '../../src/services/diagram-service';
import { componentTestDatabase, postgresEnabled } from './component-test-database';

for (const postgres of [false, true]) describe.skipIf(postgres && !postgresEnabled)(`${postgres ? 'PostgreSQL' : 'memory'} all-matches persistence`, () => {
  async function setup() {
    const database = postgres ? await componentTestDatabase() : undefined;
    return { ...await collectionDeletionFixture(database?.diagrams ?? new DiagramRepository(), database?.adrs ?? new AdrRepository()), database };
  }
  async function rawSnapshot(database: Awaited<ReturnType<typeof componentTestDatabase>> | undefined) {
    if (!database) return undefined;
    return Promise.all(['diagrams', 'components', 'relationships', 'system_groups', 'system_group_members', 'adrs', 'adr_component_links', 'adr_relationship_links'].map(async table => (await database.pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows));
  }
  it('deduplicates nested roots, preserves earlier batches and restores disjoint subtrees independently', async () => {
    const f = await setup();
    try {
      const service = new DiagramService(f.repository, f.adrs);
      const target = { kind: 'all-matches', name: f.name, mode: 'trash' } as const;
      const preview = await service.previewCollectionDeletion({ target });
      expect(preview.rootDiagramIds).toHaveLength(6);
      expect(preview.affectedCount).toBe(6);
      const result = await service.executeCollectionDeletion({ target, rootDiagramIds: preview.rootDiagramIds, confirmationToken: preview.confirmationToken });
      expect(result.affectedDiagrams).toEqual(preview.affectedDiagrams);
      const batches = [];
      for (const graph of [f.first, f.second]) {
        const provenance = await f.repository.getTrashProvenance(graph.context);
        expect(provenance.trashRootDiagramId).toBe(graph.context);
        expect(provenance.trashBatchId).toBeTruthy(); batches.push(provenance.trashBatchId);
        for (const id of [graph.parent, graph.child]) expect(await f.repository.getTrashProvenance(id)).toEqual(provenance);
        expect(await f.repository.getTrashProvenance(graph.datastoreChild)).toEqual(f.before.saved.find(d => d.id === graph.datastoreChild)!.provenance);
      }
      expect(new Set(batches).size).toBe(2);
      const impact = await service.restoreImpact(f.first.context);
      await service.restore(f.first.context, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId });
      for (const id of [f.first.context, f.first.parent, f.first.child]) expect((await f.repository.get(id))!.status).toBe('active');
      for (const id of [f.second.context, f.second.parent, f.second.child, f.first.datastoreChild, f.second.datastoreChild]) expect((await f.repository.get(id))!.status).toBe('trashed');
      for (const original of f.before.documents) {
        const current = (await f.repository.get(original.id))!;
        expect({ ...current, status: original.status, trashedAt: original.trashedAt, updatedAt: original.updatedAt }).toEqual(original);
        expect(await f.adrs.listFull(original.id)).toEqual(f.before.saved.find(d => d.id === original.id)!.adrs);
      }
    } finally { await f.database?.close(); }
  });
  it('purges the unique union including earlier Trash and internal cross-root links and replacement chains', async () => {
    const f = await setup();
    try {
      await f.crossRootReferences();
      const service = new DiagramService(f.repository, f.adrs);
      const target = { kind: 'all-matches', name: f.name, mode: 'permanent' } as const;
      const preview = await service.previewCollectionDeletion({ target });
      expect(preview.rootDiagramIds).toHaveLength(6); expect(preview.affectedCount).toBe(8);
      expect(new Set(preview.affectedDiagrams.map(d => d.id)).size).toBe(8);
      await service.executeCollectionDeletion({ target, rootDiagramIds: preview.rootDiagramIds, confirmationToken: preview.confirmationToken });
      const removed = new Set(preview.affectedDiagrams.map(d => d.id));
      const remaining = await f.snapshot();
      expect(remaining.documents).toEqual(f.before.documents.filter(d => !removed.has(d.id)));
      expect(remaining.saved).toEqual(f.before.saved.filter(d => !removed.has(d.id)));
      for (const id of removed) {
        expect(await f.repository.getDeletionRevision(id)).toBeUndefined();
        expect(await f.repository.getTrashProvenance(id)).toEqual({ trashBatchId: null, trashRootDiagramId: null });
        expect(await f.adrs.listFull(id)).toEqual([]);
      }
      if (f.adrs instanceof AdrRepository) {
        const indexes = f.adrs.snapshotGraph();
        for (const id of removed) expect(indexes.diagrams.has(id)).toBe(false);
        expect(indexes.components.size).toBe(0); expect(indexes.relationships.size).toBe(0); expect(indexes.records.size).toBe(0);
      }
      if (f.database) {
        for (const table of ['components', 'relationships', 'system_groups', 'system_group_members', 'adrs', 'adr_component_links', 'adr_relationship_links']) expect((await f.database.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, table).toBe(0);
        expect((await f.database.pool.query('SELECT id FROM diagrams ORDER BY id')).rows.map(d => d.id)).toEqual(remaining.documents.map(d => d.id));
      }
    } finally { await f.database?.close(); }
  });
  it('blocks an outside replacement without mutating any graph', async () => {
    const f = await setup();
    try {
      await f.crossRootReferences(true); const before = await f.snapshot();
      await expect(new DiagramService(f.repository, f.adrs).previewCollectionDeletion({ target: { kind: 'all-matches', name: f.name, mode: 'permanent' } })).rejects.toMatchObject({ detail: { code: 'DIAGRAM_DEPENDENCY' } });
      expect(await f.snapshot()).toEqual(before);
    } finally { await f.database?.close(); }
  });
  it('rolls back all Trash batches after the second graph root changes', async () => {
    const f = await setup();
    try {
      const rawBefore = await rawSnapshot(f.database);
      const roots = [f.first.context, f.second.context].sort();
      const failing = scopedRepository(f.repository, scoped => ({ trash: async (id, provenance) => {
        const result = await scoped.trash(id, provenance);
        if (id === roots[1]) {
          expect((await scoped.get(roots[0]))!.status).toBe('trashed');
          expect((await scoped.get(id))!.status).toBe('trashed');
          throw Error('Injected collection Trash failure');
        }
        return result;
      } }));
      const service = new DiagramService(failing, f.adrs);
      const target = { kind: 'all-matches', name: f.name, mode: 'trash' } as const;
      const preview = await service.previewCollectionDeletion({ target });
      await expect(service.executeCollectionDeletion({ target, rootDiagramIds: preview.rootDiagramIds, confirmationToken: preview.confirmationToken })).rejects.toThrow('Injected collection Trash failure');
      expect(await f.snapshot()).toEqual(f.before);
      expect(await rawSnapshot(f.database)).toEqual(rawBefore);
    } finally { await f.database?.close(); }
  });
  it.each(['subtree', 'final-root'] as const)('restores the complete saved snapshot after %s removal fails', async failure => {
    const f = await setup();
    try {
      const rawBefore = await rawSnapshot(f.database);
      const failing = scopedRepository(f.repository, scoped => ({ purge: async ids => {
        const firstGraph = new Set([f.first.context, f.first.parent, f.first.child, f.first.datastoreChild]);
        await scoped.purge(failure === 'final-root' ? ids : ids.filter(id => firstGraph.has(id)));
        expect(await scoped.get(f.first.context)).toBeUndefined();
        if (failure === 'final-root') expect(await scoped.get(f.second.context)).toBeUndefined();
        throw Error('Injected collection purge failure');
      } }));
      const service = new DiagramService(failing, f.adrs);
      const target = { kind: 'all-matches', name: f.name, mode: 'permanent' } as const;
      const preview = await service.previewCollectionDeletion({ target });
      await expect(service.executeCollectionDeletion({ target, rootDiagramIds: preview.rootDiagramIds, confirmationToken: preview.confirmationToken })).rejects.toThrow('Injected collection purge failure');
      expect(await f.snapshot()).toEqual(f.before);
      expect(await rawSnapshot(f.database)).toEqual(rawBefore);
    } finally { await f.database?.close(); }
  });
});
