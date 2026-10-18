import { describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { seedArchiveRows, snapshotArchiveDatabase } from './diagram-archive-fixtures';
import { archiveFixture, archiveId, emptyArchiveFixture } from '../../../shared/tests/archive-fixtures';
import { parseArchive, type Archive, type ArchiveImportPreview } from '../../../shared/src/index';
import { ArchiveService } from '../../src/services/archive-service';
import { GraphTransaction } from '../../src/persistence/graph-transaction';

const request = (text: string, review: ArchiveImportPreview) => ({ archiveText: text, previewedAt: review.previewedAt, previewToken: review.previewToken, overrideExisting: review.requiresOverride, recoverySaved: review.requiresRecovery, recoveryFileSha256: review.recovery?.fileSha256 ?? null });
describe.skipIf(!postgresEnabled)('authoritative PostgreSQL replacement and recovery', () => {
  it('replaces/removes owned records, preserves additions and unrelated diagrams, and reimports without writes', async () => {
    const db = await componentTestDatabase();
    try {
      await seedArchiveRows(db.pool);
      const service = new ArchiveService(db.diagrams, db.adrs), graph = new GraphTransaction(db.diagrams, db.adrs);
      const unrelated = parseArchive(JSON.stringify(emptyArchiveFixture())).records;
      unrelated.diagrams[0].id = archiveId(777);
      await graph.applyArchiveRows(unrelated);
      const original = await graph.readArchiveSnapshot();
      const incoming = parseArchive(JSON.stringify(archiveFixture()));
      incoming.records.diagrams[0].name = 'Replacement';
      incoming.records.components[0].description = 'Replacement';
      incoming.records.relationships[0].label = 'Replacement';
      incoming.records.systemGroups = []; incoming.records.systemGroupMembers = [];
      incoming.records.adrs[0].context = 'Replacement'; incoming.records.adrComponentLinks = []; incoming.records.adrRelationshipLinks = [];
      const added = { ...incoming.records.diagrams[0], id: archiveId(999) };
      // A new independent hierarchy enters through an explicit Trash dependency.
      incoming.records.diagrams.push({ ...added, status: 'trashed', trashedAt: incoming.exportedAt, trashBatchId: archiveId(998), trashRootDiagramId: added.id });
      incoming.records.diagrams[2].trashRootDiagramId = added.id; incoming.records.diagrams[2].trashBatchId = archiveId(998);
      incoming.includedDiagramIds.push(added.id);
      const text = JSON.stringify(incoming), before = await snapshotArchiveDatabase(db.pool), preview = await service.preview(text);
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
      await service.import(request(text, preview));
      expect(await graph.readArchiveSnapshot()).toEqual({ ...incoming.records, diagrams: [...incoming.records.diagrams, ...unrelated.diagrams].sort((a, b) => a.id.localeCompare(b.id)) });
      const replaced = await snapshotArchiveDatabase(db.pool), same = await service.preview(text);
      expect(same.requiresOverride).toBe(true); expect(same.requiresRecovery).toBe(false);
      expect((await service.import(request(text, same))).affectedDiagramIds).toEqual([]);
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(replaced);
      const recovery = preview.recovery!.archiveText, recoveryPreview = await service.preview(recovery);
      await service.import(request(recovery, recoveryPreview));
      expect(await graph.readArchiveSnapshot()).toEqual({ ...original, diagrams: [...original.diagrams, incoming.records.diagrams.at(-1)!] });
      // Compare the complete recovered raw snapshot, including signed zero and metadata.
      const recovered = await snapshotArchiveDatabase(db.pool);
      for (const collection of ['components', 'relationships', 'systemGroups', 'systemGroupMembers', 'adrs', 'adrComponentLinks', 'adrRelationshipLinks']) expect(recovered[collection]).toEqual(before[collection]);
    } finally { await db.close(); }
  });

  it('accepts source swaps and cyclic ADR replacements under real constraints', async () => {
    const db = await componentTestDatabase();
    try {
      await seedArchiveRows(db.pool);
      const service = new ArchiveService(db.diagrams, db.adrs), incoming = parseArchive(JSON.stringify(archiveFixture()));
      const external = incoming.records.components.find(c => c.id === archiveId(22))!;
      incoming.records.components.find(c => c.id === archiveId(13))!.type = 'software-system';
      incoming.records.components.push({ ...external, id: archiveId(23), sourceComponentId: archiveId(13), x: '-600' });
      let text = JSON.stringify(incoming); await service.import(request(text, await service.preview(text)));
      external.sourceComponentId = archiveId(13); incoming.records.components.at(-1)!.sourceComponentId = archiveId(12);
      incoming.records.adrs[0].replacementAdrId = incoming.records.adrs[1].id; incoming.records.adrs[1].replacementAdrId = incoming.records.adrs[0].id;
      incoming.records.components.sort((a, b) => a.id.localeCompare(b.id));
      text = JSON.stringify(incoming); await service.import(request(text, await service.preview(text)));
      expect(await new GraphTransaction(db.diagrams, db.adrs).readArchiveSnapshot()).toEqual(incoming.records);
    } finally { await db.close(); }
  });

  it('adds, replaces and removes all seven owned collections without cascading away common identities', async () => {
    const db = await componentTestDatabase();
    try {
      await seedArchiveRows(db.pool);
      const service = new ArchiveService(db.diagrams, db.adrs), graph = new GraphTransaction(db.diagrams, db.adrs);
      const original = await graph.readArchiveSnapshot(), incoming = structuredClone(original);
      incoming.diagrams[0].name = 'Updated';
      incoming.components.push({ ...incoming.components[2], id: archiveId(901) });
      for (const component of incoming.components.filter(c => [archiveId(13), archiveId(901)].includes(c.id))) component.type = 'software-system';
      incoming.relationships.push({ ...incoming.relationships[0], id: archiveId(902), targetComponentId: archiveId(901) });
      incoming.systemGroups.push({ ...incoming.systemGroups[0], id: archiveId(903), name: 'Added group', x: '568', width: '244' });
      incoming.systemGroupMembers.push(...[archiveId(13), archiveId(901)].map(componentId => ({ ...incoming.systemGroupMembers[0], groupId: archiveId(903), componentId })));
      incoming.adrs.push({ ...incoming.adrs[0], id: archiveId(904), replacementAdrId: null });
      incoming.adrComponentLinks.push({ ...incoming.adrComponentLinks[0], adrId: archiveId(904), componentId: archiveId(901) });
      incoming.adrRelationshipLinks.push({ ...incoming.adrRelationshipLinks[0], adrId: archiveId(904), relationshipId: archiveId(902) });
      // Keep group member geometry valid and retain raw metadata differences in every collection.
      incoming.components.find(c => c.id === archiveId(901))!.x = '600';
      for (const rows of Object.values(incoming)) rows[0].createdAt = '2024-03-03T00:00:00.000003Z';
      const prepared = service.prepareRows(incoming, [archiveId(1)], archiveFixture().exportedAt);
      await service.import(request(prepared.archiveText, await service.preview(prepared.archiveText)));
      expect(await graph.readArchiveSnapshot()).toEqual(parseArchive(prepared.archiveText).records);
      const restore = service.prepareRows(original, [archiveId(1)], archiveFixture().exportedAt);
      const review = await service.preview(restore.archiveText);
      for (const collection of ['components', 'relationships', 'systemGroups', 'systemGroupMembers', 'adrs', 'adrComponentLinks', 'adrRelationshipLinks'] as const) expect(review.byCollection[collection].removed).toBeGreaterThan(0);
      await service.import(request(restore.archiveText, review));
      expect(await graph.readArchiveSnapshot()).toEqual(original);
    } finally { await db.close(); }
  });

  it('refuses retained child and new dependent recovery without any mutation', async () => {
    const db = await componentTestDatabase();
    try {
      const service = new ArchiveService(db.diagrams, db.adrs), graph = new GraphTransaction(db.diagrams, db.adrs);
      const original = parseArchive(JSON.stringify(emptyArchiveFixture()));
      await graph.applyArchiveRows(original.records);
      const incoming: Archive = parseArchive(JSON.stringify(archiveFixture()));
      const text = JSON.stringify(incoming), preview = await service.preview(text); await service.import(request(text, preview));
      const before = await snapshotArchiveDatabase(db.pool);
      await expect(service.preview(preview.recovery!.archiveText)).rejects.toMatchObject({ code: 'ARCHIVE_DEPENDENCY' });
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
      const ownership = structuredClone(incoming); ownership.records.diagrams[1].ownerComponentId = archiveId(12); ownership.records.diagrams[3].ownerComponentId = archiveId(11);
      ownership.records.components = ownership.records.components.filter(c => c.id !== archiveId(22));
      await expect(service.preview(JSON.stringify(ownership))).rejects.toMatchObject({ code: 'ARCHIVE_OWNERSHIP' });
      expect(await snapshotArchiveDatabase(db.pool)).toEqual(before);
    } finally { await db.close(); }
  });
});
