import { describe, expect, it, vi } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { seedArchiveRows, snapshotArchiveDatabase } from './diagram-archive-fixtures';
import { archiveFixture, archiveFieldInventory, archiveId } from '../../../shared/tests/archive-fixtures';
import { ArchiveService } from '../../src/services/archive-service';
import { GraphTransaction } from '../../src/persistence/graph-transaction';

describe.skipIf(!postgresEnabled)('archive PostgreSQL transfer', () => {
  it('compares all 69 fields between independently migrated installations and immediate re-export', async () => {
    const source = await componentTestDatabase(), destination = await componentTestDatabase();
    try {
      await seedArchiveRows(source.pool);
      const exporter = new ArchiveService(source.diagrams, source.adrs), importer = new ArchiveService(destination.diagrams, destination.adrs);
      const prepared = await exporter.prepare(archiveId(2)), preview = await importer.preview(prepared.archiveText);
      const result = await importer.import({ archiveText: prepared.archiveText, previewedAt: preview.previewedAt, previewToken: preview.previewToken, overrideExisting: false, recoverySaved: false, recoveryFileSha256: null });
      expect(result.committed).toBe(true);
      const before = await snapshotArchiveDatabase(source.pool), after = await snapshotArchiveDatabase(destination.pool);
      expect(Object.values(archiveFieldInventory).flat()).toHaveLength(69);
      for (const collection of Object.keys(archiveFieldInventory)) expect(after[collection]).toEqual(before[collection]);
      expect(after.signedZero).toEqual(before.signedZero);
      const reexport = await importer.prepare(archiveId(2));
      expect(JSON.parse(reexport.archiveText).records).toEqual(archiveFixture().records);
      expect(JSON.parse(reexport.archiveText).records).toEqual(JSON.parse(prepared.archiveText).records);
    } finally { await source.close(); await destination.close(); }
  });
  it('holds one snapshot across an observable concurrent writer and refuses unsupported values', async () => {
    const test = await componentTestDatabase();
    try {
      await seedArchiveRows(test.pool);
      const service = new ArchiveService(test.diagrams, test.adrs), original = test.diagrams.withArchiveSnapshot.bind(test.diagrams);
      let writerCommitted = false;
      vi.spyOn(test.diagrams, 'withArchiveSnapshot').mockImplementation(action => original(async (diagrams, tx) => {
        const read = diagrams.readArchiveRows.bind(diagrams);
        vi.spyOn(diagrams, 'readArchiveRows').mockImplementation(async ids => {
          const rows = await read(ids);
          await test.pool.query('BEGIN; UPDATE components SET name = name || \' changed\'; UPDATE adrs SET title = title || \' changed\'; COMMIT');
          writerCommitted = true; return rows;
        });
        return action(diagrams, tx);
      }));
      const prepared = await service.prepare(archiveId(3));
      expect(writerCommitted).toBe(true); expect(JSON.parse(prepared.archiveText).records).toEqual(archiveFixture().records);
      vi.restoreAllMocks();
      await test.pool.query("UPDATE system_groups SET x='Infinity' WHERE id=$1", [archiveId(51)]);
      const before = await snapshotArchiveDatabase(test.pool);
      await expect(new ArchiveService(test.diagrams, test.adrs).prepare(archiveId(1))).rejects.toMatchObject({ code: 'ARCHIVE_INVALID' });
      expect(await snapshotArchiveDatabase(test.pool)).toEqual(before);
      await expect(new GraphTransaction(test.diagrams, test.adrs).readArchiveSnapshot()).rejects.toThrow();
    } finally { vi.restoreAllMocks(); await test.close(); }
  });
  it('rolls back all collections and epochs on a late new-only import failure', async () => {
    const test = await componentTestDatabase();
    try {
      const service = new ArchiveService(test.diagrams, test.adrs), archiveText = JSON.stringify(archiveFixture());
      const preview = await service.preview(archiveText), before = await snapshotArchiveDatabase(test.pool);
      await test.pool.query("ALTER TABLE diagram_confirmation_epochs ADD CONSTRAINT archive_fail_late CHECK (epoch = 0)");
      await expect(service.import({ archiveText, previewedAt: preview.previewedAt, previewToken: preview.previewToken, overrideExisting: false, recoverySaved: false, recoveryFileSha256: null })).rejects.toThrow();
      expect(await snapshotArchiveDatabase(test.pool)).toEqual(before);
    } finally { await test.close(); }
  });
});
