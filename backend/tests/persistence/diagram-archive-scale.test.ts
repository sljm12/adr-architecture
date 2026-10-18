import { cpus, totalmem, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { archiveFixture, archiveId } from '../../../shared/tests/archive-fixtures';
import { ARCHIVE_MAX_BYTES, parseArchive } from '../../../shared/src/index';
import { ArchiveService } from '../../src/services/archive-service';
import { GraphTransaction } from '../../src/persistence/graph-transaction';

describe.skipIf(!postgresEnabled || process.env.RUN_ARCHIVE_SCALE !== '1')('archive measured acceptance budget', () => {
  it('measures 20 committed samples after two warmups at the planned scale', async () => {
    const db = await componentTestDatabase();
    try {
      const fixture = parseArchive(JSON.stringify(archiveFixture())), rows = fixture.records;
      for (let i = 0; rows.components.length < 1000; i++) rows.components.push({ ...rows.components[2], id: archiveId(10000 + i), x: String(1000 + i * 200) });
      for (let i = 0; rows.relationships.length < 1000; i++) rows.relationships.push({ ...rows.relationships[0], id: archiveId(20000 + i) });
      for (let i = 0; rows.adrs.length < 100; i++) rows.adrs.push({ ...rows.adrs[0], id: archiveId(30000 + i) });
      for (let i = 0; rows.diagrams.length < 100; i++) rows.diagrams.push({ ...rows.diagrams[0], id: archiveId(40000 + i), name: `Unrelated ${i}` });
      const graph = new GraphTransaction(db.diagrams, db.adrs), service = new ArchiveService(db.diagrams, db.adrs);
      await graph.applyArchiveRows(rows);
      const samples = { export: [] as number[], preview: [] as number[], apply: [] as number[], previewLock: [] as number[], applyLock: [] as number[] };
      // Callback entry follows transaction setup and acquisition of the collection table lock.
      const collection = db.diagrams.withCollectionTransaction.bind(db.diagrams); let lockElapsed = 0;
      db.diagrams.withCollectionTransaction = action => {
        const start = performance.now(); return collection((repo, tx) => { lockElapsed += performance.now() - start; return action(repo, tx); });
      };
      let maxArchive = 0, maxRecovery = 0;
      for (let i = 0; i < 22; i++) {
        await graph.applyArchiveRows(rows);
        let start = performance.now(); const prepared = await service.prepare(archiveId(2)); const exported = performance.now() - start;
        const incoming = parseArchive(prepared.archiveText);
        for (const collection of Object.values(incoming.records)) for (const row of collection) row.createdAt = `2024-03-01T00:00:00.${String(i).padStart(6, '0')}Z`;
        const text = JSON.stringify(incoming);
        lockElapsed = 0; start = performance.now(); const preview = await service.preview(text); const reviewed = performance.now() - start, previewLock = lockElapsed;
        lockElapsed = 0; start = performance.now(); const result = await service.import({ archiveText: text, previewedAt: preview.previewedAt, previewToken: preview.previewToken, overrideExisting: true, recoverySaved: true, recoveryFileSha256: preview.recovery!.fileSha256 }); const applied = performance.now() - start;
        expect(result.affectedDiagramIds).toContain(archiveId(1));
        expect(prepared.counts.components).toBe(1000); expect(prepared.counts.relationships).toBe(1000); expect(prepared.counts.adrs).toBe(100);
        maxArchive = Math.max(maxArchive, prepared.byteLength); maxRecovery = Math.max(maxRecovery, preview.recovery!.byteLength);
        if (i >= 2) { samples.export.push(exported); samples.preview.push(reviewed); samples.apply.push(applied); samples.previewLock.push(previewLock); samples.applyLock.push(lockElapsed); }
      }
      const p95 = (values: number[]) => values.toSorted((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
      const p95ms = Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, p95(values)]));
      console.log('ARCHIVE_SCALE_EVIDENCE', JSON.stringify({ runtime: process.version, database: (await db.pool.query('SHOW server_version')).rows[0].server_version, hardware: { cpu: cpus()[0].model, logicalCpus: cpus().length, memoryGiB: totalmem() / 2 ** 30, os: `${platform()} ${release()}` }, samples, p95ms, maxArchive, maxRecovery }));
      expect(maxArchive).toBeLessThanOrEqual(ARCHIVE_MAX_BYTES); expect(maxRecovery).toBeLessThanOrEqual(ARCHIVE_MAX_BYTES);
      for (const key of ['export', 'preview', 'apply']) expect(p95ms[key], key).toBeLessThan(5000);
    } finally { await db.close(); }
  }, 180000);
});
