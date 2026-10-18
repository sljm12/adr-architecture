import type { Pool, PoolClient } from 'pg';
import { archiveFixture, archiveFieldInventory } from '../../../shared/tests/archive-fixtures';

const tables = { diagrams: 'diagrams', components: 'components', relationships: 'relationships', systemGroups: 'system_groups', systemGroupMembers: 'system_group_members', adrs: 'adrs', adrComponentLinks: 'adr_component_links', adrRelationshipLinks: 'adr_relationship_links' };
const column = (field: string) => field.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
type TestConnection = Pick<Pool | PoolClient, 'query'>;
export async function seedArchiveRows(db: TestConnection, fixture = archiveFixture()) {
  const insert = async (collection: keyof typeof tables, row: object) => {
    const fields = archiveFieldInventory[collection];
    const values = fields.map(field => (row as Record<string, unknown>)[field]);
    await db.query(`INSERT INTO ${tables[collection]} (${fields.map(column).join(',')}) VALUES (${values.map((_,i) => `$${i+1}`).join(',')})`, values);
  };
  for (const kind of ['general','container','component']) for (const diagram of fixture.records.diagrams.filter(d => d.kind === kind)) {
    await insert('diagrams', diagram);
    for (const component of fixture.records.components.filter(c => c.diagramId === diagram.id)) await insert('components', component);
  }
  for (const collection of ['relationships','systemGroups','systemGroupMembers','adrs','adrComponentLinks','adrRelationshipLinks'] as const) {
    for (const row of fixture.records[collection]) await insert(collection, collection === 'adrs' ? { ...row, replacementAdrId: null } : row);
  }
  for (const adr of fixture.records.adrs) if (adr.replacementAdrId) await db.query('UPDATE adrs SET replacement_adr_id=$1 WHERE id=$2', [adr.replacementAdrId, adr.id]);
}

/** Independent SQL expectation: no editor hydration or production codec. */
export async function snapshotArchiveDatabase(db: TestConnection) {
  const snapshot: Record<string, unknown> = {};
  for (const collection of Object.keys(tables) as Array<keyof typeof tables>) {
    const fields = archiveFieldInventory[collection];
    const projection = fields.map(field => {
      const col = column(field);
      if (field.endsWith('At')) return `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "${field}"`;
      if (['x','y','width','height','scopeX','scopeY','scopeWidth','scopeHeight','deletionRevision'].includes(field)) return `${col}::text AS "${field}"`;
      return `${col} AS "${field}"`;
    });
    snapshot[collection] = (await db.query(`SELECT ${projection.join(',')} FROM ${tables[collection]} ORDER BY ${fields.filter(f => f === 'id' || f.endsWith('Id')).map(column).join(',')}`)).rows;
  }
  snapshot.signedZero = (await db.query("SELECT id, encode(float8send(x),'hex') AS x, encode(float8send(y),'hex') AS y FROM components ORDER BY id")).rows;
  snapshot.epochs = (await db.query('SELECT diagram_id, epoch::text FROM diagram_confirmation_epochs ORDER BY diagram_id')).rows;
  return snapshot;
}
