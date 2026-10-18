import { describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { seedArchiveRows, snapshotArchiveDatabase } from './diagram-archive-fixtures';
import { archiveFixture, archiveId } from '../../../shared/tests/archive-fixtures';
import { ArchiveService } from '../../src/services/archive-service';
import { DiagramService } from '../../src/services/diagram-service';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { scopedRepository } from '../html-export-source-fixtures';
import type { ArchiveImportPreview } from '../../../shared/src/index';
import { AdrService } from '../../src/services/adr-service';

const request = (archiveText: string, p: ArchiveImportPreview) => ({ archiveText, previewedAt: p.previewedAt, previewToken: p.previewToken, overrideExisting: p.requiresOverride, recoverySaved: p.requiresRecovery, recoveryFileSha256: p.recovery?.fileSha256 ?? null });
describe.skipIf(!postgresEnabled)('archive PostgreSQL races and rollback', () => {
  it('keeps epochs durable through historical revert, purge/reintroduction and both legacy recovery paths', async () => {
    const db = await componentTestDatabase();
    try {
      const fixture = archiveFixture(); fixture.records.diagrams[2].deletionRevision = '37'; await seedArchiveRows(db.pool, fixture);
      const service = new DiagramService(db.diagrams, db.adrs), graph = new GraphTransaction(db.diagrams, db.adrs);
      const trash = await service.trashImpact(archiveId(1)), restore = await service.restoreImpact(archiveId(4));
      const deletion = await service.previewDeletion({ selector: { id: archiveId(1) }, mode: 'permanent' });
      const collection = await service.previewCollectionDeletion({ target: { kind: 'all-matches', name: fixture.records.diagrams[0].name, mode: 'permanent' } });
      const changed = structuredClone(fixture.records); changed.components[0].description = 'Historical edit';
      await graph.applyArchiveRows(changed); await graph.applyArchiveRows(fixture.records);
      const recreated = new DiagramService(db.diagrams, db.adrs), before = await snapshotArchiveDatabase(db.pool);
      await expect(recreated.trash(archiveId(1), { confirmedDiagramIds: trash.affectedDiagramIds, impactToken: trash.impactToken })).rejects.toMatchObject({ code: 'TRASH_IMPACT_CHANGED' });
      await expect(recreated.restore(archiveId(4), { confirmedDiagramIds: restore.affectedDiagramIds, confirmedTrashBatchId: restore.trashBatchId, impactToken: restore.impactToken })).rejects.toMatchObject({ code: 'RESTORE_IMPACT_CHANGED' });
      await expect(recreated.trash(archiveId(1))).rejects.toMatchObject({ code: 'TRASH_IMPACT_CHANGED' });
      await expect(recreated.restore(archiveId(4))).rejects.toMatchObject({ code: 'RESTORE_IMPACT_CHANGED' });
      await expect(recreated.executeDeletion(archiveId(1), { mode: 'permanent', confirmationToken: deletion.confirmationToken })).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
      await expect(recreated.executeCollectionDeletion({ target: collection.target, rootDiagramIds: collection.rootDiagramIds, confirmationToken: collection.confirmationToken })).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
      const fresh = await recreated.previewDeletion({ selector: { id: archiveId(1) }, mode: 'permanent' });
      await recreated.executeDeletion(archiveId(1), { mode: 'permanent', confirmationToken: fresh.confirmationToken });
      const epoch = await db.diagrams.getConfirmationEpoch(archiveId(1)); expect(epoch).not.toBe('0');
      await graph.applyArchiveRows(fixture.records); expect(BigInt(await db.diagrams.getConfirmationEpoch(archiveId(1)))).toBeGreaterThan(BigInt(epoch));
      await expect(recreated.trash(archiveId(1), { confirmedDiagramIds: trash.affectedDiagramIds, impactToken: trash.impactToken })).rejects.toMatchObject({ code: 'TRASH_IMPACT_CHANGED' });
    } finally { await db.close(); }
  });
  it.each(['adr', 'links', 'create', 'trash', 'restore'] as const)('serializes %s queued behind import through the real table barrier', async writer => {
    const db = await componentTestDatabase(); let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    let importing: Promise<unknown> | undefined, queued: Promise<unknown> | undefined;
    try {
      const fixture = archiveFixture(); fixture.records.diagrams[2].deletionRevision = '37'; await seedArchiveRows(db.pool, fixture);
      const service = new ArchiveService(db.diagrams, db.adrs), normal = new DiagramService(db.diagrams, db.adrs), decisions = new AdrService(db.adrs, db.diagrams);
      fixture.records.components[0].description = 'Imported'; const text = JSON.stringify(fixture), preview = await service.preview(text);
      const trash = await normal.trashImpact(archiveId(2)), restore = await normal.restoreImpact(archiveId(4));
      const wrapped = scopedRepository(db.diagrams, scoped => ({ advanceConfirmationEpochs: async ids => { await scoped.advanceConfirmationEpochs(ids); entered(); await gate; } }));
      importing = new ArchiveService(wrapped, db.adrs).import(request(text, preview)); await started;
      switch (writer) {
        case 'adr': queued = decisions.update(archiveId(60), { ...fixture.records.adrs[0], title: 'Queued decision', status: 'draft' }); break;
        case 'links': queued = decisions.replaceLinks(archiveId(60), { componentIds: [] }); break;
        case 'create': queued = Promise.resolve(normal.create('Queued root')); break;
        case 'trash': queued = normal.trash(archiveId(2), { confirmedDiagramIds: trash.affectedDiagramIds, impactToken: trash.impactToken }); break;
        case 'restore': queued = normal.restore(archiveId(4), { confirmedDiagramIds: restore.affectedDiagramIds, confirmedTrashBatchId: restore.trashBatchId, impactToken: restore.impactToken }); break;
      }
      const outcome = queued.then(value => ({ value }), error => ({ error }));
      let waiting = false; const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if ((await db.pool.query("SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND pid IN (SELECT pid FROM pg_locks WHERE relation='diagrams'::regclass)")).rowCount) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true); release(); await importing;
      const result = await outcome;
      if (writer === 'trash' || writer === 'restore') expect(result).toHaveProperty('error'); else expect(result).toHaveProperty('value');
      expect((await new GraphTransaction(db.diagrams, db.adrs).readArchiveSnapshot()).components[0].description).toBe('Imported');
    } finally { release(); await Promise.allSettled([importing, queued]); await db.close(); }
  });
  it.each(['diagrams', 'components', 'relationships', 'systemGroups', 'systemGroupMembers', 'adrs', 'adrComponentLinks', 'adrRelationshipLinks'] as const)('invalidates review after %s changes', async collection => {
    const db = await componentTestDatabase();
    try {
      await seedArchiveRows(db.pool); const service = new ArchiveService(db.diagrams, db.adrs);
      const text = JSON.stringify(archiveFixture()), preview = await service.preview(text);
      const tables = { diagrams: 'diagrams', components: 'components', relationships: 'relationships', systemGroups: 'system_groups', systemGroupMembers: 'system_group_members', adrs: 'adrs', adrComponentLinks: 'adr_component_links', adrRelationshipLinks: 'adr_relationship_links' };
      // Change raw values without advancing epochs to exercise the row fingerprint itself.
      await db.pool.query(`UPDATE ${tables[collection]} SET created_at=$1`, ['2024-01-01T00:00:00.000001Z']);
      const before = await snapshotArchiveDatabase(db.pool);
      await expect(service.import(request(text, preview))).rejects.toMatchObject({ code: 'ARCHIVE_PREVIEW_CHANGED' });
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
    } finally { await db.close(); }
  });
  it('binds exact whitespace while keeping an unrelated destination addition outside consent', async () => {
    const db = await componentTestDatabase();
    try {
      await seedArchiveRows(db.pool); const service = new ArchiveService(db.diagrams, db.adrs), graph = new GraphTransaction(db.diagrams, db.adrs);
      const fixture = archiveFixture(), text = JSON.stringify(fixture), preview = await service.preview(text);
      const unrelated = { ...fixture.records, diagrams: [{ ...fixture.records.diagrams[0], id: archiveId(999) }], components: [], relationships: [], systemGroups: [], systemGroupMembers: [], adrs: [], adrComponentLinks: [], adrRelationshipLinks: [] };
      await graph.applyArchiveRows(unrelated); const before = await snapshotArchiveDatabase(db.pool);
      await expect(service.import(request(text + '\n', preview))).rejects.toMatchObject({ code: 'ARCHIVE_PREVIEW_CHANGED' });
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
      expect((await service.import(request(text, preview))).affectedDiagramIds).toEqual([]);
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
    } finally { await db.close(); }
  });
  it.each(['parents', 'references', 'deletes', 'epochs', 'deferred'] as const)('rolls back every table and ledger after %s failure', async stage => {
    const db = await componentTestDatabase();
    try {
      await seedArchiveRows(db.pool);
      const fixture = archiveFixture(); fixture.records.diagrams[0].name = 'Changed'; fixture.records.components[0].description = 'Changed';
      fixture.records.systemGroups = []; fixture.records.systemGroupMembers = [];
      const service = new ArchiveService(db.diagrams, db.adrs), text = JSON.stringify(fixture), preview = await service.preview(text);
      const before = await snapshotArchiveDatabase(db.pool);
      const fail = () => { throw new Error('Injected late failure'); };
      const wrapped = scopedRepository(db.diagrams, scoped => ({
        upsertArchiveRows: async (collection, rows) => { await scoped.upsertArchiveRows(collection, rows); if (stage === 'parents' && collection === 'diagrams' || stage === 'references' && collection === 'relationships') fail(); },
        removeArchiveRows: async (collection, ids) => { await scoped.removeArchiveRows(collection, ids); if (stage === 'deletes' && collection === 'systemGroups') fail(); },
        advanceConfirmationEpochs: async ids => { await scoped.advanceConfirmationEpochs(ids); if (stage === 'epochs') fail(); },
        checkArchiveSources: async () => { await scoped.checkArchiveSources(); if (stage === 'deferred') fail(); },
      }));
      await expect(new ArchiveService(wrapped, db.adrs).import(request(text, preview))).rejects.toThrow('Injected late failure');
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
    } finally { await db.close(); }
  });
  it('queues a real save behind import and invalidates historical confirmations across recreated services', async () => {
    const db = await componentTestDatabase(); let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }); let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    let importing: Promise<unknown> | undefined, saving: Promise<unknown> | undefined;
    try {
      await seedArchiveRows(db.pool);
      const normal = new DiagramService(db.diagrams, db.adrs), service = new ArchiveService(db.diagrams, db.adrs);
      const old = await normal.previewDeletion({ selector: { id: archiveId(1) }, mode: 'trash' });
      const document = (await db.diagrams.get(archiveId(1)))!;
      const fixture = archiveFixture(); fixture.records.components[0].description = 'Imported';
      const text = JSON.stringify(fixture), preview = await service.preview(text);
      const wrapped = scopedRepository(db.diagrams, scoped => ({ advanceConfirmationEpochs: async ids => { await scoped.advanceConfirmationEpochs(ids); entered(); await gate; } }));
      importing = new ArchiveService(wrapped, db.adrs).import(request(text, preview)); await started;
      saving = normal.save(document.id, { ...document, name: 'Queued save' });
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        const result = await db.pool.query("SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND pid IN (SELECT pid FROM pg_locks WHERE relation='diagrams'::regclass)");
        if (result.rowCount) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true); release(); await importing; await saving;
      const graph = new GraphTransaction(db.diagrams, db.adrs); await graph.applyArchiveRows(archiveFixture().records);
      const before = await snapshotArchiveDatabase(db.pool);
      await expect(new DiagramService(db.diagrams, db.adrs).executeDeletion(archiveId(1), { mode: 'trash', confirmationToken: old.confirmationToken })).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
    } finally { release(); await Promise.allSettled([importing, saving]); await db.close(); }
  });
});
