import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { seedArchiveRows, snapshotArchiveDatabase } from './diagram-archive-fixtures';
import { archiveFixture, archiveId } from '../../../shared/tests/archive-fixtures';
import { GraphTransaction } from '../../src/persistence/graph-transaction';

describe.skipIf(!postgresEnabled)('archive PostgreSQL migration and codecs', () => {
  it('upgrades populated 0008 without changing artifacts and keeps ledger tombstones', async () => {
    const test = await componentTestDatabase(true, true, false);
    try {
      await seedArchiveRows(test.pool);
      const artifactTables = ['diagrams','components','relationships','system_groups','system_group_members','adrs','adr_component_links','adr_relationship_links'];
      const snapshot = async () => Promise.all(artifactTables.map(async table => (await test.pool.query(`SELECT row_to_json(t)::text AS row FROM ${table} t ORDER BY row_to_json(t)::text`)).rows));
      const before = await snapshot();
      await test.pool.query(await readFile('backend/drizzle/0009_diagram_archive.sql', 'utf8'));
      expect(await snapshot()).toEqual(before);
      expect((await test.pool.query("SELECT * FROM pg_constraint WHERE conrelid='diagram_confirmation_epochs'::regclass AND contype='f'")).rows).toEqual([]);
      const records = await new GraphTransaction(test.diagrams, test.adrs).readArchiveSnapshot();
      expect(records).toEqual(archiveFixture().records);
      expect(records.components[0].x).toBe('-0');
      const scoped = await new GraphTransaction(test.diagrams,test.adrs).runCollection(context => new GraphTransaction(test.diagrams,test.adrs).readArchiveRows(context,[archiveId(1)]));
      expect(scoped.diagrams).toEqual([records.diagrams[0]]);
      expect(scoped.components).toEqual(records.components.filter(c => c.diagramId === archiveId(1)));
      expect(scoped.systemGroupMembers).toEqual(records.systemGroupMembers);
      expect(scoped.adrComponentLinks).toEqual(records.adrComponentLinks);
      const saved = await snapshotArchiveDatabase(test.pool);
      await expect(test.pool.query("INSERT INTO diagram_confirmation_epochs VALUES ($1,-1)", [archiveId(1)])).rejects.toThrow();
      expect(await snapshotArchiveDatabase(test.pool)).toEqual(saved);
    } finally { await test.close(); }
  });
  it('enforces ordinary source uniqueness, permits a deferred swap and retains the ADR replacement FK', async () => {
    const test = await componentTestDatabase(); const connection = await test.pool.connect();
    try {
      await seedArchiveRows(connection);
      await expect(connection.query('UPDATE components SET source_component_id=$1 WHERE id=$2', [archiveId(999), archiveId(22)])).rejects.toThrow();
      const c = archiveFixture().records.components.find(c => c.id === archiveId(22))!;
      await connection.query('INSERT INTO components (id,diagram_id,name,description,type,role,container_type,technology,source_component_id,x,y,width,height,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)', [archiveId(24),c.diagramId,c.name,c.description,c.type,c.role,c.containerType,c.technology,archiveId(13),c.x,c.y,c.width,c.height,c.createdAt,c.updatedAt]);
      await expect(connection.query('UPDATE components SET source_component_id=$1 WHERE id=$2', [archiveId(13), archiveId(22)])).rejects.toThrow(/unique/i);
      await connection.query('BEGIN');
      await connection.query('SET CONSTRAINTS components_diagram_source_unique DEFERRED');
      await connection.query('UPDATE components SET source_component_id=$1 WHERE id=$2', [archiveId(13),archiveId(22)]);
      await connection.query('UPDATE components SET source_component_id=$1 WHERE id=$2', [archiveId(12),archiveId(24)]);
      await connection.query('SET CONSTRAINTS components_diagram_source_unique IMMEDIATE'); await connection.query('COMMIT');
      await expect(connection.query('UPDATE adrs SET replacement_adr_id=$1 WHERE id=$2', [archiveId(999),archiveId(60)])).rejects.toThrow(/foreign key/i);
    } finally { connection.release(); await test.close(); }
  });
  it('rolls back the actual migration when an existing dependency prevents index replacement', async () => {
    const test = await componentTestDatabase(true,true,false), connection = await test.pool.connect();
    try {
      await seedArchiveRows(connection);
      await connection.query('CREATE TABLE archive_migration_blocker (diagram_id uuid, source_component_id uuid, FOREIGN KEY (diagram_id,source_component_id) REFERENCES components(diagram_id,source_component_id))');
      const before = (await connection.query('SELECT row_to_json(t)::text AS row FROM components t ORDER BY id')).rows;
      await expect(connection.query(await readFile('backend/drizzle/0009_diagram_archive.sql','utf8'))).rejects.toThrow(/depend/i);
      await connection.query('ROLLBACK');
      expect((await connection.query("SELECT to_regclass('diagram_confirmation_epochs') AS ledger")).rows[0].ledger).toBeNull();
      expect((await connection.query('SELECT row_to_json(t)::text AS row FROM components t ORDER BY id')).rows).toEqual(before);
      expect((await connection.query("SELECT to_regclass('components_diagram_source_unique') AS source")).rows[0].source).not.toBeNull();
    } finally { connection.release(); await test.close(); }
  });
  it('refuses unsupported stored timestamp and layout values without changing them', async () => {
    const test = await componentTestDatabase();
    try {
      await seedArchiveRows(test.pool);
      const graph = new GraphTransaction(test.diagrams,test.adrs);
      await test.pool.query("UPDATE diagrams SET created_at='infinity' WHERE id=$1",[archiveId(1)]);
      await expect(graph.readArchiveSnapshot()).rejects.toMatchObject({ code: 'ARCHIVE_INVALID' });
      await test.pool.query('UPDATE diagrams SET created_at=$1 WHERE id=$2',[archiveFixture().records.diagrams[0].createdAt,archiveId(1)]);
      await test.pool.query("UPDATE system_groups SET x='NaN' WHERE id=$1",[archiveId(51)]);
      await expect(graph.readArchiveSnapshot()).rejects.toMatchObject({ code: 'ARCHIVE_INVALID' });
      expect((await test.pool.query('SELECT x::text FROM system_groups WHERE id=$1',[archiveId(51)])).rows[0].x).toBe('NaN');
    } finally { await test.close(); }
  });
  it('applies all eight collections exactly, preserves link metadata in ordinary writers and skips a second apply', async () => {
    const test = await componentTestDatabase();
    try {
      const graph = new GraphTransaction(test.diagrams,test.adrs), records = archiveFixture().records;
      expect(await graph.applyArchiveRows(records)).toEqual(records.diagrams.map(d => d.id).sort());
      expect(await graph.readArchiveSnapshot()).toEqual(records);
      const before = await snapshotArchiveDatabase(test.pool);
      const versions = async () => (await test.pool.query('SELECT id,xmin::text FROM components ORDER BY id')).rows;
      const previousVersions = await versions();
      expect(await graph.applyArchiveRows(records)).toEqual([]);
      expect(await snapshotArchiveDatabase(test.pool)).toEqual(before); expect(await versions()).toEqual(previousVersions);
      await graph.run(archiveId(1),[],async ({ diagrams, adrs }) => {
        await diagrams.replace((await diagrams.get(archiveId(1)))!);
        await adrs!.replaceLinks(archiveId(60),[archiveId(11),archiveId(12)]);
        await adrs!.replaceRelationshipLinks(archiveId(61),[archiveId(41)]);
      });
      const rows = await graph.readArchiveSnapshot();
      expect(rows.systemGroupMembers).toEqual(records.systemGroupMembers);
      expect(rows.adrComponentLinks[0]).toEqual(records.adrComponentLinks[0]);
      expect(rows.adrRelationshipLinks).toEqual(records.adrRelationshipLinks);
    } finally { await test.close(); }
  });
  it('handles source swaps, ADR cycles, authoritative removals and rolls back a late ledger failure', async () => {
    const test = await componentTestDatabase();
    try {
      const graph = new GraphTransaction(test.diagrams,test.adrs), records = archiveFixture().records;
      const source = { ...records.components[0], id: archiveId(14), name: 'Person', type: 'person', x: '600' };
      const occurrence = { ...records.components[4], id: archiveId(23), sourceComponentId: source.id, y: '300' };
      const leafOccurrence = { ...records.components[4], id: archiveId(32), diagramId: archiveId(3), sourceComponentId: archiveId(22) };
      records.components.push(source,occurrence,leafOccurrence); records.adrs[1].replacementAdrId = records.adrs[2].id;
      await graph.applyArchiveRows(records);
      records.components[4].sourceComponentId = source.id; occurrence.sourceComponentId = archiveId(12);
      records.components = records.components.filter(c => c.id !== archiveId(13));
      await graph.applyArchiveRows(records);
      expect(await graph.readArchiveSnapshot()).toEqual({ ...records, components: [...records.components].sort((a,b) => a.id.localeCompare(b.id)) });
      records.components = records.components.filter(c => c.id !== archiveId(22) && c.id !== archiveId(32));
      await graph.applyArchiveRows(records);
      const before = await snapshotArchiveDatabase(test.pool);
      await test.pool.query('UPDATE diagram_confirmation_epochs SET epoch=9223372036854775807 WHERE diagram_id=$1',[archiveId(1)]);
      const overflow = await snapshotArchiveDatabase(test.pool);
      records.adrs[0].title = 'changed before overflow'; records.adrComponentLinks = [];
      await expect(graph.applyArchiveRows(records)).rejects.toThrow();
      expect(await snapshotArchiveDatabase(test.pool)).toEqual(overflow);
      expect(overflow.components).toEqual(before.components);
    } finally { await test.close(); }
  });
  it('shares a read-only repeatable-read connection across artifact and ADR reads while writers commit', async () => {
    const test = await componentTestDatabase();
    try {
      const graph = new GraphTransaction(test.diagrams,test.adrs), records = archiveFixture().records;
      await graph.applyArchiveRows(records);
      await test.diagrams.withArchiveSnapshot(async (diagrams, transaction) => {
        const before = await diagrams.readArchiveRows();
        const changed = structuredClone(records); changed.components[0].name = 'Concurrent component'; changed.adrs[0].title = 'Concurrent decision';
        await graph.applyArchiveRows(changed);
        const decisions = await test.adrs.withTransaction(transaction).readArchiveRows();
        expect(before.components).toEqual(records.components); expect(decisions.adrs).toEqual(records.adrs);
      });
      const after = await graph.readArchiveSnapshot(); expect(after.components[0].name).toBe('Concurrent component'); expect(after.adrs[0].title).toBe('Concurrent decision');
      await graph.runCollection(async ({ diagrams,adrs }) => {
        await adrs!.purgeOwned(records.diagrams.map(d => d.id));
        await diagrams.purge([archiveId(3),archiveId(4),archiveId(2),archiveId(1)]);
      });
      const tombstone = await test.diagrams.getConfirmationEpoch(archiveId(1));
      expect(tombstone).toBe('2');
      await graph.applyArchiveRows(records); expect(await test.diagrams.getConfirmationEpoch(archiveId(1))).toBe('3');
    } finally { await test.close(); }
  });
  it('raw upserts preserve all values, skip identical rows and roll back late failures and epoch overflow', async () => {
    const test = await componentTestDatabase();
    try {
      await seedArchiveRows(test.pool); const graph = new GraphTransaction(test.diagrams, test.adrs);
      const before = await snapshotArchiveDatabase(test.pool);
      await expect(graph.runCollection(async ({ diagrams, adrs }) => {
        const rows = await graph.readArchiveRows({ diagrams, adrs });
        await diagrams.upsertArchiveRows('components', rows.components);
        await diagrams.advanceConfirmationEpochs([archiveId(1)]);
        await adrs!.upsertArchiveRows('adrComponentLinks', [{ ...rows.adrComponentLinks[0], createdAt: '2025-01-01T00:00:00.987654Z' }]);
        throw new Error('late failure');
      })).rejects.toThrow('late failure');
      expect(await snapshotArchiveDatabase(test.pool)).toEqual(before);
      await test.pool.query('INSERT INTO diagram_confirmation_epochs VALUES ($1,9223372036854775807)',[archiveId(1)]);
      await expect(graph.runCollection(({ diagrams }) => diagrams.advanceConfirmationEpochs([archiveId(1)]))).rejects.toThrow();
      expect(await test.diagrams.getConfirmationEpoch(archiveId(1))).toBe('9223372036854775807');
    } finally { await test.close(); }
  });
});
