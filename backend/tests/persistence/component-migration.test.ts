import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { componentContextFixture, componentParentFixture, emptyComponentFixture, populatedComponentFixture, componentFixtureIds as ids, componentFixtureTimestamp as timestamp } from '../../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../../shared/src/index';

describe.skipIf(!postgresEnabled)('Component migration 0007', () => {
  let database: Awaited<ReturnType<typeof componentTestDatabase>>;
  beforeAll(async () => {
    database = await componentTestDatabase(false);
    await database.diagrams.create(componentContextFixture());
    await database.diagrams.create(componentParentFixture());
    const adr = await database.adrs.create(ids.parent, { title: 'Preserved decision', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'accepted' });
    await database.adrs.replaceLinks(adr.id, [ids.application]);
    await database.adrs.replaceRelationshipLinks(adr.id, [componentParentFixture().relationships[0].id]);
    await database.diagrams.trash(ids.parent, { trashBatchId: ids.independentBatch, trashRootDiagramId: ids.parent });
  });
  afterAll(async () => { await database?.close(); });
  it('preserves every pre-0007 row, UUID, subtype, timestamp, layout, ADR/link and trash provenance', async () => {
    const tables = ['diagrams', 'components', 'relationships', 'adrs', 'adr_component_links', 'adr_relationship_links', 'system_groups', 'system_group_members'];
    const snapshot = async () => Promise.all(tables.map(async table => (await database.pool.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows));
    const before = await snapshot();
    await database.pool.query(await readFile(new URL('../../drizzle/0007_c4_component_diagrams.sql', import.meta.url), 'utf8'));
    expect(await snapshot()).toEqual(before);
    expect(await database.diagrams.getTrashProvenance(ids.parent)).toEqual({ trashBatchId: ids.independentBatch, trashRootDiagramId: ids.parent });
    await database.diagrams.restore(ids.parent);
    await database.diagrams.create(populatedComponentFixture() as DiagramDocument);
    expect(await database.diagrams.get(ids.child)).toMatchObject({ kind: 'component', scope: { parentDiagramId: ids.parent, containerId: ids.application }, components: [{ id: ids.internal, role: 'component' }, { id: ids.siblingOccurrence, containerType: 'datastore' }, { id: ids.childPerson, sourceComponentId: ids.personOccurrence }, { id: ids.childSystem }] });
  });
  it('rejects null/nonfinite child boundaries and self parents', async () => {
    for (const column of ['scope_x', 'scope_y', 'scope_width', 'scope_height']) {
      await expect(database.pool.query(`UPDATE diagrams SET ${column}=NULL WHERE id=$1`, [ids.child])).rejects.toMatchObject({ code: '23514' });
      for (const value of ['Infinity', '-Infinity', 'NaN']) await expect(database.pool.query(`UPDATE diagrams SET ${column}=$1 WHERE id=$2`, [value, ids.child])).rejects.toMatchObject({ code: '23514' });
    }
    await expect(database.pool.query('UPDATE diagrams SET parent_diagram_id=id WHERE id=$1', [ids.child])).rejects.toBeDefined();
  });
  it('rejects missing required metadata/type/subtype and unsupported role variants', async () => {
    for (const assignment of ['type=NULL', "type='container'", 'technology=NULL', "technology=' '", 'description=NULL', "description=' '", "container_type='application'", "role='element'"]) {
      await expect(database.pool.query(`UPDATE components SET ${assignment} WHERE id=$1`, [ids.internal])).rejects.toMatchObject({ code: '23514' });
    }
    for (const assignment of ['type=NULL', 'container_type=NULL', "container_type='queue'", 'technology=NULL']) await expect(database.pool.query(`UPDATE components SET ${assignment} WHERE id=$1`, [ids.siblingOccurrence])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query('UPDATE components SET type=NULL WHERE id=$1', [ids.childPerson])).rejects.toMatchObject({ code: '23514' });
  });
  it('retains all-status owner uniqueness and composite/source/parent/trash-root foreign keys', async () => {
    await database.diagrams.trash(ids.child);
    const duplicate = { ...emptyComponentFixture(), id: ids.datastoreChild };
    await expect(database.diagrams.create(duplicate as DiagramDocument)).rejects.toBeDefined();
    await expect(database.pool.query('UPDATE diagrams SET parent_diagram_id=$1 WHERE id=$2', [ids.context, ids.child])).rejects.toMatchObject({ code: '23503' });
    await expect(database.pool.query('UPDATE components SET source_component_id=$1 WHERE id=$2', [ids.linkedAdr, ids.childPerson])).rejects.toMatchObject({ code: '23503' });
    await expect(database.pool.query('UPDATE diagrams SET trash_root_diagram_id=$1 WHERE id=$2', [ids.linkedAdr, ids.child])).rejects.toMatchObject({ code: '23503' });
    expect((await database.pool.query('SELECT created_at FROM components WHERE id=$1', [ids.application])).rows[0].created_at.toISOString()).toBe(timestamp);
  });
});
